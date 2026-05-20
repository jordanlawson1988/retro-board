# User Settings Page — Design Spec

**Date:** 2026-05-20
**Status:** Design approved; spec for implementation planning
**Trigger:** `/settings` (linked from the header dropdown) 404s — the route was never built.

---

## 1. Goal

Build a real user settings page at `/settings` where a signed-in user can manage their own account: appearance (theme), profile (name), view their fixed identity (email), change their password, manage active sessions, sign out, and delete their account.

## 2. Non-goals

- Email-based password reset / "forgot password" link (no email provider is configured; would require wiring an email service — separate feature).
- Changing the email/username (it is the fixed login identity).
- Avatar upload (avatars are auto-derived from a per-user hue).
- Two-factor auth.
- Board-level or admin settings (this is the personal user profile; admin settings live under `/admin`).

## 3. Context

- **Auth:** BetterAuth (`lib/auth.ts`) with `emailAndPassword` enabled, captcha plugin. React client in `lib/auth-client.ts` (`authClient`). No email provider configured.
- **User shape** (`types/index.ts`): `{ id, email, name, image?, createdAt? }`. **No separate username field** — the email is the login identity.
- **Theme:** `hooks/useTheme.ts` exposes `theme`, `setTheme('light'|'dark'|'system')`, persists to `localStorage('retro-theme')`, applies `data-theme` on `<html>`.
- **Auth store:** `stores/authStore.ts` — `user`, `isAuthenticated`, `loading`, `initialize()`, `signOut()`.
- **Page pattern:** `app/*` routes are thin shells over `components/pages/*` (e.g., `HomePage`, `DashboardPage`, `BoardPage`).
- **Avatar hue:** `utils/avatarHue.ts` → `avatarBackground(userId)`.

## 4. Route & structure

- **Create `app/settings/page.tsx`** — thin shell that renders `<SettingsPage />`.
- **Create `components/pages/SettingsPage.tsx`** — client component, auth-guarded: if `!authLoading && !isAuthenticated`, `router.push('/login?redirect=/settings')`. Renders within `AppShell` (header) so the topbar/back-nav is consistent.
- Layout: a single page with **stacked section cards** (`bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-xl)] p-5/6`), max-width container (`max-w-2xl` or `max-w-3xl`), consistent with the dashboard's visual language. Section heading + body each.

## 5. Sections

### 5.1 Appearance
- Segmented control (reusing the `ViewToggle`/tray-with-pill visual pattern, or simple radio buttons) with **Light / Dark / System**.
- Bound to `useTheme()`: current value = `theme`; on change → `setTheme(value)` (instant apply + persist). No save button needed.

### 5.2 Profile
- **Avatar preview**: 40px circle using `avatarBackground(user.id)` + first initial (read-only).
- **Name**: text input pre-filled with `user.name`. "Save" button → `authClient.updateUser({ name })`. On success, call `authStore.initialize()` to refresh the cached user so the header avatar/name update live. Inline success/error.
- **Email** ("Username"): read-only field showing `user.email`, with a lock icon + helper text "Your email is your username and can't be changed."
- **Member since**: `user.createdAt` formatted (e.g., "May 2026"). Read-only.

### 5.3 Security
- **Change password**: three fields — current, new, confirm. Validate: new ≥ 8 chars, new === confirm. Submit → `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: false })`. BetterAuth verifies the current password server-side; surface its error (e.g., "Current password is incorrect"). Clear fields + show success on completion.
- **Active sessions**: `authClient.listSessions()` → list each session (created date, user-agent if available, "current" badge for the active session token). **Sign out all other devices** button → `authClient.revokeOtherSessions()` → refresh the list.
- **Sign out (this device)**: button → `authStore.signOut()` → `router.push('/')`.

### 5.4 Danger zone
- Visually distinct (danger border/heading using `--danger`).
- **Delete account**: a confirmation flow — user must type `DELETE` into a field AND enter their password, then confirm. Submit → `authClient.deleteUser({ password })`. On success → redirect to `/` (session is gone).
- Requires enabling deletion in BetterAuth (see §6).

## 6. Backend changes

### 6.1 Enable account deletion (`lib/auth.ts`)
Add to the `betterAuth({ ... })` config:
```ts
user: {
  deleteUser: {
    enabled: true,
  },
},
```
Password-based confirmation (the client passes the current password to `deleteUser`). No email verification step (no email provider). This is the only auth-config change.

### 6.2 FK fix for delete cascade (migration 007)
`board_members.invited_by TEXT REFERENCES "user"(id)` currently has **no `ON DELETE` rule** (defaults to `NO ACTION`/restrict). If a user being deleted had invited others, the delete would be **rejected** by the constraint. Fix:
```sql
-- 007_invited_by_on_delete.sql
ALTER TABLE board_members DROP CONSTRAINT IF EXISTS board_members_invited_by_fkey;
ALTER TABLE board_members
  ADD CONSTRAINT board_members_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES "user"(id) ON DELETE SET NULL;
```
(Verify the exact constraint name during implementation; the column persists, only the referenced user is nulled.)

### 6.3 Verify admin_users on delete
If the deleted user has an `admin_users` row, confirm its FK does not block deletion (it references BetterAuth accounts). If it restricts, add `ON DELETE CASCADE`/`SET NULL` to that constraint in migration 007.

### 6.4 Everything else = BetterAuth client calls
`updateUser`, `changePassword`, `listSessions`, `revokeOtherSessions`, `deleteUser` are all on `authClient`. **No new custom API routes, no new app tables.**

## 7. Delete-account cascade behavior (intended)

When a user is deleted, via existing FKs:
- `boards.owner_id` → **SET NULL**: owned boards become ownerless but persist (the app already handles ownerless/legacy boards).
- `participants.user_id` → **SET NULL**: participant records de-link; their cards/votes/action items persist (attributed to a now-userless participant).
- `board_members` (membership rows where `user_id` = deleted) → **CASCADE**: removed.
- `board_members.invited_by` → **SET NULL** after migration 007.
- BetterAuth `user`/`session`/`account` rows for the user → removed by BetterAuth.

This orphans owned boards rather than deleting them — intentional, so co-participants don't lose shared boards. Flag in the delete confirmation copy ("Boards you created will remain accessible to their members but will no longer be owned by you").

## 8. Data refresh & state

- After a successful name change, call `authStore.initialize()` so the header (avatar initial, dropdown name) reflects the new name without a reload.
- Theme changes propagate via `useTheme`'s shared store (header toggle stays in sync automatically).

## 9. Validation & error handling

- **Name**: non-empty, trimmed, ≤ 100 chars.
- **Password**: new ≥ 8 chars; new === confirm; current required. Server enforces current-password correctness — surface BetterAuth's error message inline.
- **Delete**: requires exact text `DELETE` + a non-empty password; button disabled until both present. Surface BetterAuth errors (e.g., wrong password).
- Each section shows its own inline success/error state; no global page error.

## 10. Files

| File | Change |
|---|---|
| `app/settings/page.tsx` | Create — thin shell rendering `<SettingsPage />` |
| `components/pages/SettingsPage.tsx` | Create — auth-guarded settings UI with the four sections |
| `lib/auth.ts` | Enable `user.deleteUser` |
| `scripts/migrations/007_invited_by_on_delete.sql` | Create — `invited_by` (and possibly `admin_users`) `ON DELETE SET NULL` |
| `components/Layout/Header.tsx` | (No change — the dropdown already links to `/settings`.) |

## 11. Deploy notes

- Standard `feature/* → develop → main`. Touches `lib/auth.ts` (sensitive auth config) — review carefully.
- Migration 007 runs once on the shared dev/prod Neon DB (additive/constraint change; safe — the column already exists, only its delete-rule changes). Apply before the delete-account code path is exercised in prod.
- No new env vars or external services.

## 12. Out of scope (recap)

Email-based reset, email/username change, avatar upload, 2FA, admin/board settings.
