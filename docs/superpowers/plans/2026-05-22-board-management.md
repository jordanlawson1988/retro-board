# Board Management v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Calibrated for inline execution by the spec author.

**Goal:** Let board owners manage their boards (rename, soft-delete→Trash, reopen, manage members/roles, regenerate join code) and let members leave shared boards — all from the dashboard.

**Architecture:** One additive migration (`boards.deleted_at`). A shared authorization helper closes the existing open-route gap. Soft delete is a `deleted_at` timestamp excluded from every board-list read; a 30-day lazy purge runs when the Trash view loads. Dashboard mutations use direct `fetch` + optimistic updates (matching the existing `DashboardPage`).

**Tech Stack:** Next.js 16 App Router, Neon serverless (`@neondatabase/serverless` `sql`), Better Auth, Ably, Tailwind v4, Zustand, **Vitest** (new).

Spec: `docs/superpowers/specs/2026-05-22-board-management-design.md`

---

## File Structure

**Create:**
- `vitest.config.ts` — Vitest config (node env)
- `lib/join-code.ts` — `generateJoinCode()`, `isValidJoinCode()` (extracted from board create route)
- `lib/__tests__/join-code.test.ts`
- `lib/__tests__/board-authority.test.ts` — pure authority resolver tests
- `lib/__tests__/board-roles.test.ts` — roles SSOT contract
- `lib/__tests__/soft-delete-contract.test.ts` — every board-list consumer excludes deleted rows
- `scripts/migrations/008_board_management.sql`
- `app/api/boards/[boardId]/regenerate-code/route.ts`
- `components/Dashboard/BoardCardMenu.tsx` — `⋯` overflow popover
- `components/Dashboard/RenameBoardModal.tsx`
- `components/Dashboard/DeleteBoardDialog.tsx` — soft-delete confirm + delete-forever (type-to-confirm)
- `components/Dashboard/ManageMembersModal.tsx`
- `components/Dashboard/RegenerateCodeModal.tsx`

**Modify:**
- `types/index.ts` — add `BOARD_MEMBER_ROLES` const + derive `BoardMemberRole` + `isBoardMemberRole()`
- `lib/auth-helpers.ts` — add `resolveBoardAuthority()` (pure) + `assertCanFacilitate()` / `assertBoardOwner()`
- `app/api/boards/route.ts` — import `generateJoinCode` from `lib/join-code`
- `app/api/boards/[boardId]/route.ts` — auth on PATCH; PATCH accepts title/description; DELETE (soft); POST actions restore/reopen/purge; GET 404s trashed boards for non-owners
- `app/api/boards/[boardId]/members/route.ts` — relax DELETE to allow self-leave; validate role via SSOT
- `app/api/user/boards/route.ts` — exclude deleted; add `filter=trash` (+ lazy purge)
- `app/api/user/stats/route.ts` — exclude deleted from active_boards
- `app/api/boards/join/route.ts` — treat trashed board as not found
- `app/api/admin/boards/route.ts` — exclude (or flag) deleted
- `components/Dashboard/BoardCard.tsx` — host the menu; stop nav on menu click
- `components/pages/DashboardPage.tsx` — Trash chip, action handlers, modal wiring, optimistic updates
- `package.json` — `"test": "vitest run"`, `"test:watch": "vitest"`

---

## Task 1: Vitest setup

**Files:** Create `vitest.config.ts`; Modify `package.json`; Create `lib/__tests__/smoke.test.ts`

- [ ] **Step 1: Install Vitest** — `npm i -D vitest` (verify it doesn't pull conflicting deps)
- [ ] **Step 2: Config** — `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Scripts** — add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`
- [ ] **Step 4: Smoke test** — `lib/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
describe('vitest', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 5: Run** — `npm test` → expect 1 passing. Then delete `smoke.test.ts`.
- [ ] **Step 6: Commit** — `git add vitest.config.ts package.json package-lock.json && git commit -m "chore: add Vitest for unit tests"`

## Task 2: Board roles SSOT (`types/index.ts`)

- [ ] **Step 1: Failing test** — `lib/__tests__/board-roles.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BOARD_MEMBER_ROLES, isBoardMemberRole } from '@/types';

describe('board roles SSOT', () => {
  it('matches the SQL CHECK set exactly', () => {
    expect([...BOARD_MEMBER_ROLES]).toEqual(['owner', 'facilitator', 'participant', 'viewer']);
  });
  it('isBoardMemberRole guards membership', () => {
    expect(isBoardMemberRole('facilitator')).toBe(true);
    expect(isBoardMemberRole('admin')).toBe(false);
    expect(isBoardMemberRole('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`@/types` exports missing). `npx vitest run lib/__tests__/board-roles.test.ts`
- [ ] **Step 3: Implement** — in `types/index.ts`, replace the hand-written `type BoardMemberRole` with:

```ts
export const BOARD_MEMBER_ROLES = ['owner', 'facilitator', 'participant', 'viewer'] as const;
export type BoardMemberRole = (typeof BOARD_MEMBER_ROLES)[number];
export function isBoardMemberRole(v: unknown): v is BoardMemberRole {
  return typeof v === 'string' && (BOARD_MEMBER_ROLES as readonly string[]).includes(v);
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `git add types/index.ts lib/__tests__/board-roles.test.ts && git commit -m "refactor: board roles as runtime SSOT const"`

## Task 3: Join-code util (`lib/join-code.ts`)

- [ ] **Step 1: Failing test** — `lib/__tests__/join-code.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateJoinCode, isValidJoinCode } from '@/lib/join-code';

describe('join-code', () => {
  it('generates a 5-char zero-padded numeric string', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^\d{5}$/);
    }
  });
  it('validates format', () => {
    expect(isValidJoinCode('01234')).toBe(true);
    expect(isValidJoinCode('1234')).toBe(false);
    expect(isValidJoinCode('abcde')).toBe(false);
    expect(isValidJoinCode(12345 as unknown as string)).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `lib/join-code.ts`:

```ts
/** 5-digit zero-padded numeric join code (e.g. "04207"). */
export function generateJoinCode(): string {
  return String(Math.floor(Math.random() * 100000)).padStart(5, '0');
}
export function isValidJoinCode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{5}$/.test(code);
}
```

- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Refactor caller** — in `app/api/boards/route.ts`, remove the local `generateJoinCode` and `import { generateJoinCode } from '@/lib/join-code';`
- [ ] **Step 6: Typecheck** — `npx tsc --noEmit` → clean
- [ ] **Step 7: Commit** — `git add lib/join-code.ts lib/__tests__/join-code.test.ts app/api/boards/route.ts && git commit -m "refactor: extract join-code util (shared by create + regenerate)"`

## Task 4: Board authority helper (`lib/auth-helpers.ts`)

The DB query is thin; the *decision* is a pure function we unit-test.

- [ ] **Step 1: Failing test** — `lib/__tests__/board-authority.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveBoardAuthority } from '@/lib/auth-helpers';

const base = { userId: 'u1', ownerId: null as string | null, memberRole: null as string | null, isSystemAdmin: false };

describe('resolveBoardAuthority', () => {
  it('owner can facilitate and is owner', () => {
    const r = resolveBoardAuthority({ ...base, ownerId: 'u1' });
    expect(r).toEqual({ isOwner: true, canFacilitate: true });
  });
  it('facilitator member can facilitate but is not owner', () => {
    const r = resolveBoardAuthority({ ...base, memberRole: 'facilitator' });
    expect(r).toEqual({ isOwner: false, canFacilitate: true });
  });
  it('participant member cannot facilitate', () => {
    expect(resolveBoardAuthority({ ...base, memberRole: 'participant' }).canFacilitate).toBe(false);
  });
  it('system admin can facilitate (covers legacy null-owner boards)', () => {
    expect(resolveBoardAuthority({ ...base, isSystemAdmin: true }).canFacilitate).toBe(true);
  });
  it('non-member has no authority', () => {
    expect(resolveBoardAuthority(base)).toEqual({ isOwner: false, canFacilitate: false });
  });
});
```

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — add to `lib/auth-helpers.ts`:

```ts
import { sql } from '@/lib/db';
// (getSessionOrNull already exists in this file)

export interface BoardAuthorityInput {
  userId: string;
  ownerId: string | null;
  memberRole: string | null;        // board_members.role for this user, or null
  isSystemAdmin: boolean;           // present in admin_users
}
export interface BoardAuthority { isOwner: boolean; canFacilitate: boolean; }

export function resolveBoardAuthority(i: BoardAuthorityInput): BoardAuthority {
  const isOwner = i.ownerId !== null && i.ownerId === i.userId;
  const canFacilitate =
    isOwner || i.isSystemAdmin || i.memberRole === 'owner' || i.memberRole === 'facilitator';
  return { isOwner, canFacilitate };
}

export class AuthzError extends Error {
  constructor(public status: 401 | 403, message: string) { super(message); }
}

async function loadAuthority(boardId: string): Promise<BoardAuthority & { userId: string }> {
  const session = await getSessionOrNull();
  const userId = session?.user?.id ?? null;
  if (!userId) throw new AuthzError(401, 'Sign in required');
  const [row] = await sql`
    SELECT
      (SELECT owner_id FROM boards WHERE id = ${boardId}) AS owner_id,
      (SELECT role FROM board_members WHERE board_id = ${boardId} AND user_id = ${userId}) AS member_role,
      EXISTS (SELECT 1 FROM admin_users WHERE id = ${userId}) AS is_system_admin
  `;
  const authority = resolveBoardAuthority({
    userId, ownerId: row?.owner_id ?? null, memberRole: row?.member_role ?? null,
    isSystemAdmin: !!row?.is_system_admin,
  });
  return { ...authority, userId };
}

export async function assertCanFacilitate(boardId: string) {
  const a = await loadAuthority(boardId);
  if (!a.canFacilitate) throw new AuthzError(403, 'Facilitator access required');
  return { userId: a.userId };
}
export async function assertBoardOwner(boardId: string) {
  const a = await loadAuthority(boardId);
  if (!a.isOwner && !a.isSystemAdmin) throw new AuthzError(403, 'Only the board owner can do this');
  return { userId: a.userId };
}
```

> Note: `loadAuthority` re-derives `isSystemAdmin` for `assertBoardOwner`; include it in the returned authority object (extend `BoardAuthority` locally or re-query). Simplest: have `loadAuthority` also return `isSystemAdmin`.

- [ ] **Step 4: Run → PASS**; `npx tsc --noEmit` clean
- [ ] **Step 5: Commit** — `git add lib/auth-helpers.ts lib/__tests__/board-authority.test.ts && git commit -m "feat: shared board authorization helper (pure resolver + assert wrappers)"`

## Task 5: Migration 008 (`boards.deleted_at`)

- [ ] **Step 1: Write** — `scripts/migrations/008_board_management.sql`:

```sql
-- 008_board_management.sql
-- Soft-delete (Trash) support for boards. Additive + backwards-compatible.
ALTER TABLE boards ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_boards_deleted_at_null ON boards (id) WHERE deleted_at IS NULL;
CREATE INDEX idx_boards_deleted_at ON boards (deleted_at) WHERE deleted_at IS NOT NULL;
COMMENT ON COLUMN boards.deleted_at IS 'NULL = live; timestamptz when soft-deleted (in Trash). Lazy-purged ~30 days later.';
```

- [ ] **Step 2: Inspect runner** — read `scripts/run-migration.mjs` for invocation; confirm `DATABASE_URL` source (`.env.local`).
- [ ] **Step 3: Apply** — run the migration against the (shared dev/prod) Neon DB. **SAFE:** additive nullable column + indexes; non-breaking; reversible via `DROP COLUMN`. **Report that prod DB was altered.** If `DATABASE_URL` is unavailable, STOP and report — code can't be verified without it.
- [ ] **Step 4: Commit** — `git add scripts/migrations/008_board_management.sql && git commit -m "feat: migration 008 — boards.deleted_at for soft delete"`

## Task 6: Board route — auth, rename, soft-delete, actions (`app/api/boards/[boardId]/route.ts`)

- [ ] **Step 1:** Wrap mutations in a try/catch that converts `AuthzError` → `NextResponse.json({error}, {status})`.
- [ ] **Step 2: PATCH** — require `assertCanFacilitate(boardId)`. Accept `{ title?, description?, settings? }`. Build a dynamic update for provided fields. For title: trim, reject empty (400). Publish Ably `board-updated` with the changed fields.
- [ ] **Step 3: DELETE** (new) — `assertBoardOwner(boardId)`; `UPDATE boards SET deleted_at = now() WHERE id = ${boardId}`; return `{ ok: true }`.
- [ ] **Step 4: POST actions** — keep `complete` but add `assertCanFacilitate`. Add:
  - `restore`: `assertBoardOwner`; `UPDATE boards SET deleted_at = NULL WHERE id = ${boardId}`.
  - `reopen`: `assertBoardOwner`; clear `archived_at`, set `settings.board_locked=false` (leave `card_visibility`); publish `board-reopened`.
  - `purge`: `assertBoardOwner`; `DELETE FROM boards WHERE id = ${boardId} AND deleted_at IS NOT NULL` (hard delete; only from Trash). Cascades handle children.
- [ ] **Step 5: GET** — after loading board, if `board.deleted_at` is set and the requester is not owner/admin → return 404. (Owner sees it so the client can offer Restore.)
- [ ] **Step 6: Verify** — `npx tsc --noEmit`; manual curl/Ably check deferred to Task 13.
- [ ] **Step 7: Commit** — `git commit -m "feat(api): board rename + soft-delete + restore/reopen/purge with auth"`

## Task 7: Regenerate join code (`app/api/boards/[boardId]/regenerate-code/route.ts`)

- [ ] **Step 1: Implement** POST handler: `assertBoardOwner(boardId)`; generate a unique code with `generateJoinCode()` (retry up to 10 on collision against `boards.join_code`); `UPDATE boards SET join_code = ${code}`; return `{ joinCode }`.
- [ ] **Step 2: Typecheck**; **Step 3: Commit** — `git commit -m "feat(api): regenerate board join code (owner)"`

## Task 8: Members route — role validation + self-leave (`app/api/boards/[boardId]/members/route.ts`)

- [ ] **Step 1: POST** — validate `role` via `isBoardMemberRole(role)` (400 if invalid). Keep owner-only `assertBoardOwner`.
- [ ] **Step 2: DELETE** — allow **either** the board owner removing another member **or** the requester removing themselves:
  - load session; if `userId === requesterId` → allow (self-leave); else require `assertBoardOwner`.
  - keep "cannot remove the owner" guard (owner must delete/transfer).
- [ ] **Step 3: Typecheck**; **Step 4: Commit** — `git commit -m "feat(api): member role validation + self-leave"`

## Task 9: Soft-delete filtering across consumers + lazy purge

- [ ] **Step 1:** `app/api/user/boards/route.ts` — add `AND b.deleted_at IS NULL` to all/active/completed branches. Add `filter === 'trash'` branch: `WHERE b.owner_id = ${userId} AND b.deleted_at IS NOT NULL ORDER BY b.deleted_at DESC`. **Before** the trash query, run lazy purge: `DELETE FROM boards WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'`.
- [ ] **Step 2:** `app/api/user/stats/route.ts` — add `AND b.deleted_at IS NULL` to the `active_boards` subquery.
- [ ] **Step 3:** `app/api/boards/join/route.ts` — `WHERE join_code = ${joinCode} AND deleted_at IS NULL` (trashed → 404 path).
- [ ] **Step 4:** `app/api/admin/boards/route.ts` — exclude `deleted_at IS NOT NULL` (read it first to match its query shape).
- [ ] **Step 5: Typecheck**; **Step 6: Commit** — `git commit -m "feat(api): exclude trashed boards from all reads + 30-day lazy purge"`

## Task 10: Soft-delete contract test

- [ ] **Step 1:** `lib/__tests__/soft-delete-contract.test.ts` — enumerate consumer files; assert each contains the guard:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const MUST_EXCLUDE_DELETED = [
  'app/api/user/boards/route.ts',
  'app/api/user/stats/route.ts',
  'app/api/boards/join/route.ts',
  'app/api/admin/boards/route.ts',
];

describe('soft-delete contract', () => {
  for (const f of MUST_EXCLUDE_DELETED) {
    it(`${f} guards against deleted_at`, () => {
      const src = readFileSync(join(root, f), 'utf8');
      expect(src).toMatch(/deleted_at IS NULL/);
    });
  }
  it('user/boards has a trash branch', () => {
    const src = readFileSync(join(root, 'app/api/user/boards/route.ts'), 'utf8');
    expect(src).toMatch(/deleted_at IS NOT NULL/);
  });
});
```

- [ ] **Step 2: Run → PASS**; **Step 3: Commit** — `git commit -m "test: soft-delete exclusion contract across board-list consumers"`

## Task 11: BoardCardMenu + BoardCard integration

- [ ] **Step 1:** `components/Dashboard/BoardCardMenu.tsx` — outside-click popover (model on `components/Board/ParticipantPopover.tsx`). Props: `{ board, onRename, onDelete, onReopen, onManageMembers, onRegenerateCode, onLeave }`. Owner items: Rename, Reopen (if `archived_at`), Manage members, Regenerate code, Delete. Non-owner: Leave. Trigger = `IconButton` with `MoreHorizontal`.
- [ ] **Step 2:** `components/Dashboard/BoardCard.tsx` — keep the `<Link>` on the body; render the menu button in the top-right; the menu button calls `e.preventDefault(); e.stopPropagation()` so it doesn't navigate. Accept action callbacks as props.
- [ ] **Step 3: Typecheck**; **Step 4: Commit** — `git commit -m "feat(dashboard): board card overflow menu"`

## Task 12: Dashboard modals + Trash chip + wiring (`DashboardPage.tsx`)

- [ ] **Step 1:** Build modals reusing `components/common/Modal.tsx`: `RenameBoardModal` (Input/Textarea → `PATCH /api/boards/[id]`), `DeleteBoardDialog` (soft-delete confirm; in Trash → delete-forever type-to-confirm → `POST {action:'purge'}`), `ManageMembersModal` (GET members, role `<select>` from `BOARD_MEMBER_ROLES` → `POST {userId,role}`, remove → `DELETE {userId}`), `RegenerateCodeModal` (`POST regenerate-code`, reveal + copy).
- [ ] **Step 2:** Add `'trash'` to the `Filter` type + chips. In trash mode render Restore (`POST {action:'restore'}`) + Delete-forever; hide normal sections.
- [ ] **Step 3:** Wire `BoardCard` action callbacks to open modals / call APIs; apply optimistic list updates (remove on trash/leave, update title on rename, move on restore/reopen) and refetch on error.
- [ ] **Step 4: Typecheck**; **Step 5: Commit** — `git commit -m "feat(dashboard): rename/delete/restore/reopen/members/regenerate + Trash view"`

## Task 13: Verify + finalize

- [ ] **Step 1:** `npm test` → all green
- [ ] **Step 2:** `npx tsc --noEmit` → clean
- [ ] **Step 3:** `npm run build` → succeeds (NOT under a running `next dev`)
- [ ] **Step 4: Browser verification (ui-feature-verify)** — start dev server; as an owner: rename, trash→Trash chip→restore, reopen a completed board, regenerate code, open Manage members + change a role; as a non-owner: leave a shared board. Confirm trashed boards vanish from All/Active/Completed and the join-by-code path. Capture results; if dev server can't run, say so explicitly.
- [ ] **Step 5: Commit** any fixes; push `feature/board-management` (feature-branch push passes the pre-push gate). **Do NOT merge to develop/main** — Jordan reviews first.

---

## Spec coverage check
- Rename ✔ T6/T12 · Soft-delete+Trash ✔ T5/T6/T9/T12 · Lazy purge ✔ T9 · Reopen ✔ T6/T12 · Leave ✔ T8/T12 · Members&roles ✔ T8/T12 · Regenerate code ✔ T7/T12 · Auth helper + retrofit ✔ T4/T6 · Cross-cutting exclusion + contract test ✔ T9/T10 · Roles SSOT ✔ T2 · join-code SSOT ✔ T3 · Vitest ✔ T1 · Browser verify ✔ T13.
- Out of scope honored: no invites, no transfer-ownership, no bulk/duplicate.
