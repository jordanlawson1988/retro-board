# Board Management v1 — Design Spec

- **Date:** 2026-05-22
- **Status:** Approved (brainstorming) → ready for implementation plan
- **Initiative:** Self-service accounts & board lifecycle — **sub-project 1 of 3**
  1. **Board Management** ← *this spec*
  2. Retroactive linking + claim UX (separate spec)
  3. Account lifecycle: password reset, email verification (separate spec)

## Context

RetroBoard already ships the *spine* of user accounts (in prod): Better Auth signup/login/settings, `boards.owner_id`, a `board_members` table with roles, `participants.user_id` linkage, and a read-only `/dashboard` that lists owned + shared boards with All/Active/Completed filters and per-user stats.

What's missing: the dashboard **lists** boards but offers **no management actions**, and several board-mutation API routes have **no authorization check**. This spec makes boards manageable and closes that auth gap.

## Goal

Let board **owners** manage their boards and **members** leave shared boards, all from the dashboard (plus a couple of board-page surfaces). No new third-party infra.

## Locked decisions

| Decision | Choice |
|---|---|
| Delete model | **Soft delete → Trash**, recoverable 30 days |
| Purge mechanism | **Lazy purge** (opportunistic on Trash-view load) — no cron |
| Testing | **Vitest for pure logic only** (no DB/integration tests) |
| Permissions | Destructive/management = **owner only**; **Leave** = any non-owner member |
| "Archive" | = the existing **Complete retro** action; we add **Reopen** (not a 2nd archive) |

## Scope — in

1. **Rename** board (title & description) — owner
2. **Soft-delete → Trash** (recoverable 30 days, then lazy-purged) — owner
3. **Reopen** a completed board (clear `archived_at`, unlock editing) — owner
4. **Leave** a shared board (member removes own access) — non-owner member
5. **Manage members & roles** (view / change role / remove) — owner
6. **Regenerate join code** (rotate the 5-digit code) — owner

## Scope — out (guardrails)

- Email invites (`board_invites` table stays unused by UI)
- **Transfer ownership** → consequence: an **owner cannot Leave** (must delete or transfer, and transfer is out). Documented limitation; likely fast-follow.
- Bulk actions, board duplication, export changes
- Sub-projects 2 (retroactive linking) and 3 (account lifecycle)

## Data model — migration `008_board_management.sql`

The **only** schema change:

```sql
ALTER TABLE boards ADD COLUMN deleted_at TIMESTAMPTZ;   -- NULL = live; set = in Trash

-- Active-board listing stays fast; partial index matches the common WHERE.
CREATE INDEX idx_boards_deleted_at_null ON boards (id) WHERE deleted_at IS NULL;
-- Trash listing + purge scan.
CREATE INDEX idx_boards_deleted_at ON boards (deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN boards.deleted_at IS 'NULL = live; timestamptz when soft-deleted (in Trash). Hard-purged ~30 days after.';
```

Rename reuses `title`/`description`; Reopen reuses `archived_at`; Members reuse `board_members`; Code reuses `join_code`. No `deleted_by` column (owner-only — YAGNI).

> **Rollout note:** dev and prod share one Neon database (per prior migration merges: "already applied to the shared dev/prod DB"). `deleted_at` is additive and backwards-compatible, so applying it is safe ahead of the code merge.

## Authorization — shared helper (closes existing gap)

Today `PATCH /boards/[id]` (settings) and `POST /boards/[id]` (`complete`) accept mutations with **no auth check**. We add a single source of authorization in `lib/auth-helpers.ts`:

```ts
// Returns the session user id or throws a typed 401/403 the routes convert to NextResponse.
assertCanFacilitate(boardId): Promise<{ userId: string }>  // owner OR board_members(owner|facilitator) OR admin_users
assertBoardOwner(boardId): Promise<{ userId: string }>     // strict owner (or admin_users)
```

- **Owner-only:** rename, soft-delete, restore, reopen, purge, regenerate-code, member add/role-change/remove.
- **Facilitator-or-owner:** the existing `complete` + `PATCH settings` (retrofit auth onto these while we're here).
- **Leave:** any authenticated member removing *their own* `board_members` row.

## API surface

| Action | Method + path | Auth | Body → Result |
|---|---|---|---|
| Rename | `PATCH /api/boards/[id]` (extend) | owner | `{ title?, description? }` → `{ ok }` + Ably `board-updated` |
| Soft-delete | `DELETE /api/boards/[id]` | owner | — → sets `deleted_at`, `{ ok }` |
| Restore | `POST /api/boards/[id]` `{action:'restore'}` | owner | clears `deleted_at` |
| Reopen | `POST /api/boards/[id]` `{action:'reopen'}` | owner | clears `archived_at`, sets `settings.board_locked=false`; Ably `board-reopened` |
| Delete forever | `POST /api/boards/[id]` `{action:'purge'}` | owner | hard delete (cascades) — from Trash only |
| Regenerate code | `POST /api/boards/[id]/regenerate-code` | owner | → `{ joinCode }` (new unique 5-digit) |
| Role change | members `POST` (existing upsert) | owner | `{ userId, role }` |
| Remove member | members `DELETE` (existing) | owner | `{ userId }` (blocks owner) |
| **Leave** | members `DELETE` (relaxed) | member | `{ userId: self }` allowed for the requester |
| Trash list | `GET /api/user/boards?filter=trash` | owner | boards with `deleted_at NOT NULL`, owner-scoped |

`generateJoinCode()` is extracted from `app/api/boards/route.ts` into `lib/join-code.ts` and shared by create + regenerate (no duplication).

## Soft-delete filtering — cross-cutting checklist (bug-prone; test it)

Every board read **must** exclude `deleted_at IS NOT NULL` (except the explicit Trash view):

- [ ] `GET /api/user/boards` — all / active / completed branches → `AND b.deleted_at IS NULL`
- [ ] `GET /api/user/stats` — `active_boards` count excludes deleted
- [ ] `GET /api/boards/[id]` — a trashed board returns **404** to non-owners; owner gets a "in Trash, restore?" signal
- [ ] `POST /api/boards/join` (by code) — trashed board → "no board found"
- [ ] `GET /api/admin/boards` — exclude (or visibly flag) trashed
- [ ] New `filter=trash` branch is the *only* place `deleted_at NOT NULL` is selected

A **Vitest contract test** enumerates every board-list consumer and asserts each excludes soft-deleted rows (mirrors the "vocabulary contract test" pattern).

## Purge — lazy

When the Trash view loads (`filter=trash`), first run:

```sql
DELETE FROM boards WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
```

Cascades remove the board's columns/cards/votes/action_items/members. No cron, no secret. Acceptable trade-off: a trashed board lingers (hidden) until *someone* opens Trash — harmless because it's already invisible everywhere else.

## Client + UI

- **`BoardCard` overflow menu (`⋯`)** — new small outside-click popover, modeled on `components/Board/ParticipantPopover.tsx`. Card body keeps its `<Link>`; the menu button uses `stopPropagation`/`preventDefault` so it doesn't navigate.
  - Owner: Rename · Reopen *(if completed)* · Manage members · Regenerate code · Delete
  - Non-owner member: Leave
- **"Trash" filter chip** appended to All/Active/Completed. Trash cards show **Restore** and **Delete forever** (type-to-confirm) instead of the normal menu.
- **Modals** (reuse `components/common/Modal.tsx`):
  - *Rename* — title + description form (`Input`/`Textarea`)
  - *Delete* — light confirm (soft-delete is reversible); *Delete forever* — type-to-confirm
  - *Members* — list (name/email/role), role `<select>` from `BOARD_MEMBER_ROLES`, remove button; owner row locked
  - *Regenerate code* — confirm, then reveals the new code with copy
- Dashboard mutations use **direct `fetch` + optimistic list update**, matching the existing `DashboardPage` (which does not use `boardStore`). `reopen`/`regenerate` invoked from the board page go through `boardStore`.

## Single source of truth — roles & join code

`types/index.ts` currently has only a hand-written `type BoardMemberRole`. Promote to a runtime const and derive the type:

```ts
export const BOARD_MEMBER_ROLES = ['owner', 'facilitator', 'participant', 'viewer'] as const;
export type BoardMemberRole = (typeof BOARD_MEMBER_ROLES)[number];
```

Used by the role `<select>` **and** server-side role validation, keeping SQL `CHECK` ↔ TS ↔ UI aligned. `generateJoinCode()` likewise centralized in `lib/join-code.ts`.

## Testing — Vitest (pure logic)

Set up Vitest (`vitest`, `vitest.config.ts`, `npm test`). Unit tests, **no DB**:

1. **Authorization helper** — owner / facilitator / viewer / non-member / admin matrices resolve correctly (pure function over injected membership rows).
2. **Soft-delete contract test** — every board-list query string includes the `deleted_at` exclusion (or via a shared `notDeleted()` SQL fragment the consumers import).
3. **Role SSOT** — `BOARD_MEMBER_ROLES` matches the SQL `CHECK` set; server validation rejects anything outside it.
4. **`generateJoinCode()`** — always 5 digits, zero-padded, string type.

Browser verification (per `ui-feature-verify`) still required before claiming the UI done; deploy gate stays `tsc --noEmit && npm run build` **+ `npm test`**.

## Security considerations

- Adds the missing auth on board mutations (net security improvement).
- Regenerate-code invalidates old shares immediately (mitigates over-shared codes).
- Soft-delete keeps data recoverable 30 days (guards against accidental/malicious deletion); Delete-forever requires type-to-confirm.
- Leave cannot strand a board (owner cannot leave; only delete/transfer).

## Rollout

`feature/board-management` → `develop` (preview review) → `main`. Apply migration `008` to the shared Neon DB before merge (additive, safe). Pre-push: `tsc --noEmit && npm run build && npm test`.

## Open risks

- **Owner-can't-leave** is a real UX dead-end for shared boards until transfer-ownership ships. Acceptable for v1; flagged.
- Lazy purge means purge timing is non-deterministic (only on Trash open). Acceptable — trashed boards are already hidden.
