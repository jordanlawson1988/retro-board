# User Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/settings` page where a signed-in user can manage appearance (theme), profile (name; read-only email), password, active sessions, sign out, and delete their account.

**Architecture:** New `app/settings/page.tsx` thin shell over a new `components/pages/SettingsPage.tsx` (auth-guarded, stacked section cards). Almost all behavior uses BetterAuth client methods (`updateUser`, `changePassword`, `listSessions`, `revokeOtherSessions`, `deleteUser`) — no new custom API routes. One auth-config change (enable `deleteUser`) and one migration (`board_members.invited_by` → `ON DELETE SET NULL`) so account deletion isn't blocked by the FK.

**Tech Stack:** Next.js 16 App Router, React 19, BetterAuth (`better-auth/react` client), Zustand (`authStore`), `useTheme`, Tailwind v4 + Quiet Modern tokens, Neon Postgres.

**Spec:** [`docs/superpowers/specs/2026-05-20-user-settings-page-design.md`](../specs/2026-05-20-user-settings-page-design.md)

**Convention note:** No automated tests in this repo (`CLAUDE.md`: "No tests"). Each task verifies with `npx tsc --noEmit`, a phase-end `npm run build`, and a final manual walkthrough on the dev server. **Do not run `npm run build` while a `next dev` server is live on this working tree** (it clobbers the dev server's `.next/` cache) — stop the dev server first or build in a separate worktree.

**Commit convention (HEREDOC):**
```
feat/fix/docs: description

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/migrations/007_invited_by_on_delete.sql` | Create — change `board_members.invited_by` FK to `ON DELETE SET NULL` |
| `lib/auth.ts` | Modify — enable `user.deleteUser` |
| `app/settings/page.tsx` | Create — thin route shell rendering `<SettingsPage />` |
| `components/pages/SettingsPage.tsx` | Create — the settings UI (Appearance, Profile, Security, Danger zone) |

`scripts/run-one.mjs` already exists (reused to apply migration 007).

---

## Pre-flight

### Task P.1: Branch + baseline

- [ ] **Step 1: From up-to-date develop, create the feature branch**

```bash
git checkout develop
git pull origin develop
git checkout -b feature/user-settings
```

- [ ] **Step 2: Baseline build (stop any dev server on this tree first)**

```bash
npx tsc --noEmit && npm run build
```
Expected: both pass. If not, stop and report.

---

## Task 1: Migration 007 — invited_by ON DELETE SET NULL

**Files:**
- Create: `scripts/migrations/007_invited_by_on_delete.sql`

- [ ] **Step 1: Confirm the actual FK constraint name on the shared DB**

```bash
node --env-file=.env.local -e "
import('@neondatabase/serverless').then(async ({ Pool }) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  const r = await c.query(\"SELECT conname FROM pg_constraint WHERE conrelid = 'board_members'::regclass AND contype = 'f'\");
  console.log(JSON.stringify(r.rows));
  c.release(); await pool.end();
});
"
```
Expected: lists FK constraint names, e.g. `board_members_user_id_fkey`, `board_members_board_id_fkey`, `board_members_invited_by_fkey`. Note the exact name targeting `invited_by`. If it differs from `board_members_invited_by_fkey`, use the actual name in Step 2.

- [ ] **Step 2: Write the migration**

```sql
-- 007_invited_by_on_delete.sql
-- board_members.invited_by had no ON DELETE rule (defaults to NO ACTION),
-- which would block deleting a user who invited others. Switch to SET NULL
-- so account deletion succeeds and the invite reference is simply cleared.

ALTER TABLE board_members DROP CONSTRAINT IF EXISTS board_members_invited_by_fkey;
ALTER TABLE board_members
  ADD CONSTRAINT board_members_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES "user"(id) ON DELETE SET NULL;
```
(If Step 1 showed a different constraint name, replace `board_members_invited_by_fkey` in the `DROP` line with that name; keep the `ADD` name as written for consistency.)

- [ ] **Step 3: Apply to the shared dev/prod DB**

```bash
node --env-file=.env.local scripts/run-one.mjs scripts/migrations/007_invited_by_on_delete.sql
```
Expected: `Applied scripts/migrations/007_invited_by_on_delete.sql`

- [ ] **Step 4: Verify the rule is now SET NULL**

```bash
node --env-file=.env.local -e "
import('@neondatabase/serverless').then(async ({ Pool }) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  const r = await c.query(\"SELECT confdeltype FROM pg_constraint WHERE conname='board_members_invited_by_fkey'\");
  console.log('confdeltype (n = SET NULL):', JSON.stringify(r.rows));
  c.release(); await pool.end();
});
"
```
Expected: `confdeltype` = `n` (SET NULL).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrations/007_invited_by_on_delete.sql
git commit -m "$(cat <<'EOF'
feat(db): migration 007 — board_members.invited_by ON DELETE SET NULL

Allows account deletion to succeed when the user had invited others;
the invite reference is cleared rather than blocking the delete.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

> Note: `admin_users` has no FK to `"user"` (standalone table keyed by id/email), so it neither cascades nor blocks deletion. A stale `admin_users` row could remain after deletion — harmless; out of scope to clean up here.

---

## Task 2: Enable account deletion in BetterAuth

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Add the `user.deleteUser` config**

In `lib/auth.ts`, inside the `betterAuth({ ... })` object, add a `user` block alongside `emailAndPassword` / `session` / `plugins`:

```ts
      emailAndPassword: {
        enabled: true,
      },
      user: {
        deleteUser: {
          enabled: true,
        },
      },
      session: {
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "$(cat <<'EOF'
feat(auth): enable BetterAuth account deletion (password-confirmed)

Enables user.deleteUser so the settings page can offer account deletion.
Password-confirmed; no email verification step (no email provider).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 3: Settings route shell

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1: Write the thin shell**

```tsx
import { SettingsPage } from '@/components/pages/SettingsPage';

export default function Settings() {
  return <SettingsPage />;
}
```

- [ ] **Step 2: Typecheck** — will fail until Task 4 creates `SettingsPage`. That's expected; proceed to Task 4 before committing.

---

## Task 4: SettingsPage scaffold (auth guard + shell + section frame)

**Files:**
- Create: `components/pages/SettingsPage.tsx`

- [ ] **Step 1: Write the scaffold with auth guard and an empty section layout**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { AppShell } from '@/components/Layout';

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-xl)] p-6">
      <h2 className="text-[var(--t-h3)] font-semibold mb-1">{title}</h2>
      {description && <p className="text-[13px] text-[var(--ink-4)] mb-4">{description}</p>}
      <div className={description ? '' : 'mt-2'}>{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuthStore();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/login?redirect=/settings');
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated || !user) {
    return (
      <AppShell>
        <div className="min-h-[40vh] grid place-items-center text-[13px] text-[var(--ink-4)]">
          Loading…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1>Settings</h1>
          <p className="text-[13px] text-[var(--ink-4)] mt-1">Manage your account and preferences.</p>
        </div>
        <div className="flex flex-col gap-4">
          {/* Sections added in Tasks 5–10 */}
        </div>
      </div>
    </AppShell>
  );
}
```

**Note:** verify `AppShell` is exported from `@/components/Layout` (it is, via `components/Layout/index.ts`). If the import path differs, use the actual one.

- [ ] **Step 2: Typecheck + build (stop dev server first)**

```bash
npx tsc --noEmit && npm run build
```
Expected: PASS. `/settings` now compiles (no more 404).

- [ ] **Step 3: Commit**

```bash
git add app/settings/page.tsx components/pages/SettingsPage.tsx
git commit -m "$(cat <<'EOF'
feat(settings): scaffold /settings route + auth-guarded SettingsPage

Adds the settings route shell and an auth-guarded page frame with the
section card layout. Sections wired in follow-up commits.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 5: Appearance section (theme)

**Files:**
- Modify: `components/pages/SettingsPage.tsx`

- [ ] **Step 1: Import `useTheme` and the icons**

Add to the imports at the top:
```tsx
import { useState } from 'react';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/utils/cn';
```

- [ ] **Step 2: Add the Appearance section component (above `SettingsPage`)**

```tsx
const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <Section title="Appearance" description="Choose how RetroBoard looks on this device.">
      <div className="inline-flex p-[3px] gap-0.5 rounded-[10px] bg-[var(--surface-muted)] border border-[var(--line)]">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150',
                active
                  ? 'bg-[var(--bg-elev)] text-[var(--ink)] shadow-[var(--shadow-xs)]'
                  : 'bg-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
              )}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Render it in `SettingsPage`'s section stack**

Replace the `{/* Sections added... */}` comment with:
```tsx
          <AppearanceSection />
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/pages/SettingsPage.tsx
git commit -m "$(cat <<'EOF'
feat(settings): appearance section — light/dark/system theme picker

Reuses the useTheme store (same persistence as the header toggle).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 6: Profile section (avatar, name edit, read-only email, member since)

**Files:**
- Modify: `components/pages/SettingsPage.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { authClient } from '@/lib/auth-client';
import { avatarBackground } from '@/utils/avatarHue';
import { Lock } from 'lucide-react';
import type { User } from '@/types';
```

- [ ] **Step 2: Add the ProfileSection component**

```tsx
function ProfileSection({ user }: { user: User }) {
  const refreshUser = useAuthStore((s) => s.initialize);
  const [name, setName] = useState(user.name ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const dirty = name.trim() !== (user.name ?? '').trim();
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : '—';

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setMsg({ kind: 'err', text: 'Name cannot be empty.' }); return; }
    setSaving(true);
    setMsg(null);
    const { error } = await authClient.updateUser({ name: trimmed });
    setSaving(false);
    if (error) { setMsg({ kind: 'err', text: error.message ?? 'Could not update name.' }); return; }
    await refreshUser();
    setMsg({ kind: 'ok', text: 'Saved.' });
  };

  return (
    <Section title="Profile">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-full grid place-items-center text-[15px] font-medium text-[var(--bg-elev)]"
          style={{ background: avatarBackground(user.id) }}
        >
          {(user.name || user.email).charAt(0).toUpperCase()}
        </div>
        <div className="text-[12px] text-[var(--ink-4)]">Member since {memberSince}</div>
      </div>

      <label className="block text-[13px] text-[var(--ink-2)] mb-1.5" htmlFor="settings-name">Name</label>
      <div className="flex gap-2 mb-1">
        <input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="flex-1 px-3 py-2.5 rounded-[var(--r-md)] text-[15px] bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition-[border-color,box-shadow] duration-150"
        />
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="px-3.5 py-2.5 rounded-[var(--r-md)] text-[13px] font-medium bg-[var(--ink)] text-[var(--bg-elev)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {msg && (
        <p className={cn('text-[12px] mb-4', msg.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>
          {msg.text}
        </p>
      )}

      <label className="block text-[13px] text-[var(--ink-2)] mt-4 mb-1.5">Email (username)</label>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--r-md)] bg-[var(--surface-muted)] border border-[var(--line)] text-[15px] text-[var(--ink-3)]">
        <Lock size={14} className="text-[var(--ink-4)]" />
        <span>{user.email}</span>
      </div>
      <p className="text-[12px] text-[var(--ink-4)] mt-1.5">Your email is your username and can't be changed.</p>
    </Section>
  );
}
```

- [ ] **Step 3: Render it (pass `user`)**

Under `<AppearanceSection />` add:
```tsx
          <ProfileSection user={user} />
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS. If `authClient.updateUser`'s return type differs, adjust the destructure (BetterAuth returns `{ data, error }`).

- [ ] **Step 5: Commit**

```bash
git add components/pages/SettingsPage.tsx
git commit -m "$(cat <<'EOF'
feat(settings): profile section — editable name, read-only email, member since

Name updates via authClient.updateUser then refreshes the auth store so the
header reflects it. Email shown read-only as the fixed username.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 7: Security — change password

**Files:**
- Modify: `components/pages/SettingsPage.tsx`

- [ ] **Step 1: Add the ChangePassword component**

```tsx
function ChangePasswordBlock() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const inputCls =
    'w-full px-3 py-2.5 rounded-[var(--r-md)] text-[15px] bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition-[border-color,box-shadow] duration-150';

  const submit = async () => {
    if (next.length < 8) { setMsg({ kind: 'err', text: 'New password must be at least 8 characters.' }); return; }
    if (next !== confirm) { setMsg({ kind: 'err', text: 'New passwords do not match.' }); return; }
    setBusy(true);
    setMsg(null);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: false,
    });
    setBusy(false);
    if (error) { setMsg({ kind: 'err', text: error.message ?? 'Could not change password.' }); return; }
    setCurrent(''); setNext(''); setConfirm('');
    setMsg({ kind: 'ok', text: 'Password changed.' });
  };

  return (
    <div>
      <h3 className="text-[14px] font-semibold mb-3">Change password</h3>
      <div className="flex flex-col gap-2.5 max-w-sm">
        <input type="password" placeholder="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
        <input type="password" placeholder="New password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
        <input type="password" placeholder="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !current || !next || !confirm}
          className="self-start px-3.5 py-2.5 rounded-[var(--r-md)] text-[13px] font-medium bg-[var(--ink)] text-[var(--bg-elev)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Updating…' : 'Update password'}
        </button>
        {msg && (
          <p className={cn('text-[12px]', msg.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>{msg.text}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS. (Adjust the `changePassword` arg/return shape if BetterAuth's types differ — it accepts `{ currentPassword, newPassword, revokeOtherSessions }` and returns `{ data, error }`.)

- [ ] **Step 3: Commit**

```bash
git add components/pages/SettingsPage.tsx
git commit -m "$(cat <<'EOF'
feat(settings): change-password block (current -> new, confirm)

Uses authClient.changePassword; server enforces current-password check
and min length. Inline validation + success/error.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 8: Security — active sessions + sign out everywhere + sign out

**Files:**
- Modify: `components/pages/SettingsPage.tsx`

- [ ] **Step 1: Add the SecuritySessions component**

```tsx
interface SessionRow { token: string; createdAt?: string; userAgent?: string | null; }

function SecuritySessionsBlock() {
  const signOut = useAuthStore((s) => s.signOut);
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [list, current] = await Promise.all([
      authClient.listSessions(),
      authClient.getSession(),
    ]);
    setSessions((list.data as SessionRow[] | undefined) ?? []);
    setCurrentToken((current.data?.session as { token?: string } | undefined)?.token ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const revokeOthers = async () => {
    setBusy(true);
    await authClient.revokeOtherSessions();
    setBusy(false);
    await load();
  };

  const doSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div className="mt-6">
      <h3 className="text-[14px] font-semibold mb-3">Active sessions</h3>
      {loading ? (
        <p className="text-[13px] text-[var(--ink-4)]">Loading sessions…</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-3">
          {sessions.map((s) => (
            <li key={s.token} className="flex items-center justify-between px-3 py-2 rounded-[var(--r-md)] bg-[var(--surface-muted)] border border-[var(--line)] text-[13px]">
              <span className="text-[var(--ink-2)] truncate">{s.userAgent || 'Unknown device'}</span>
              {s.token === currentToken && (
                <span className="ml-2 shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">This device</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={revokeOthers}
          disabled={busy || sessions.length <= 1}
          className="px-3.5 py-2.5 rounded-[var(--r-md)] text-[13px] font-medium bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Working…' : 'Sign out all other devices'}
        </button>
        <button
          type="button"
          onClick={doSignOut}
          className="px-3.5 py-2.5 rounded-[var(--r-md)] text-[13px] font-medium bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-hover)]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add a SecuritySection wrapper that composes the two blocks**

```tsx
function SecuritySection() {
  return (
    <Section title="Security">
      <ChangePasswordBlock />
      <SecuritySessionsBlock />
    </Section>
  );
}
```

- [ ] **Step 3: Render `<SecuritySection />`** under `<ProfileSection ... />`:
```tsx
          <SecuritySection />
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS. BetterAuth `listSessions()` returns `{ data, error }` where `data` is an array of session objects with `token`, `userAgent`, `createdAt`. `getSession()` returns `{ data: { user, session } }`. If field names differ, adjust `SessionRow` and the accessors.

- [ ] **Step 5: Commit**

```bash
git add components/pages/SettingsPage.tsx
git commit -m "$(cat <<'EOF'
feat(settings): security section — sessions, sign out everywhere, sign out

Lists active sessions (flags current device), revokeOtherSessions, and a
sign-out action. Composes the change-password block under one Security card.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 9: Danger zone — delete account

**Files:**
- Modify: `components/pages/SettingsPage.tsx`

- [ ] **Step 1: Add the DangerZone component**

```tsx
function DangerZoneSection() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canDelete = confirmText === 'DELETE' && password.length > 0 && !busy;

  const inputCls =
    'w-full px-3 py-2.5 rounded-[var(--r-md)] text-[15px] bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] outline-none focus:border-[var(--danger)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger)_20%,transparent)] transition-[border-color,box-shadow] duration-150';

  const doDelete = async () => {
    setBusy(true);
    setErr(null);
    const { error } = await authClient.deleteUser({ password });
    if (error) { setBusy(false); setErr(error.message ?? 'Could not delete account.'); return; }
    router.push('/');
  };

  return (
    <section className="bg-[var(--surface)] border border-[var(--danger)] rounded-[var(--r-xl)] p-6">
      <h2 className="text-[var(--t-h3)] font-semibold mb-1 text-[var(--danger)]">Delete account</h2>
      <p className="text-[13px] text-[var(--ink-3)] mb-4">
        This permanently deletes your account. Boards you created will remain accessible to their
        members but will no longer be owned by you. This cannot be undone.
      </p>
      <div className="flex flex-col gap-2.5 max-w-sm">
        <label className="text-[12px] text-[var(--ink-3)]">Type <span className="font-mono font-semibold text-[var(--ink)]">DELETE</span> to confirm</label>
        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={inputCls} placeholder="DELETE" />
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Your password" />
        <button
          type="button"
          onClick={doDelete}
          disabled={!canDelete}
          className="self-start px-3.5 py-2.5 rounded-[var(--r-md)] text-[13px] font-medium bg-[var(--danger)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        {err && <p className="text-[12px] text-[var(--danger)]">{err}</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render `<DangerZoneSection />`** last in the stack:
```tsx
          <DangerZoneSection />
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS. (`authClient.deleteUser({ password })` requires the `user.deleteUser` config from Task 2; returns `{ data, error }`.)

- [ ] **Step 4: Commit**

```bash
git add components/pages/SettingsPage.tsx
git commit -m "$(cat <<'EOF'
feat(settings): danger zone — delete account (type-to-confirm + password)

Requires typing DELETE and the account password; calls
authClient.deleteUser then redirects home. Owned boards are orphaned
(owner_id SET NULL), not destroyed.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

---

## Task 10: Build + manual verification

**Files:** none

- [ ] **Step 1: Final typecheck + build (stop dev server first)**

```bash
npx tsc --noEmit && npm run build
```
Expected: PASS; `/settings` listed as a route.

- [ ] **Step 2: Manual walkthrough on a fresh dev server**

Start `npm run dev -- -p 3001`, sign in, go to `/settings`. Verify:
- Not-signed-in → redirected to `/login?redirect=/settings`.
- Appearance: clicking Light/Dark/System changes the theme instantly and persists on reload; header toggle stays in sync.
- Profile: edit name → Save → header avatar/name update without reload; email shown read-only; member-since correct.
- Change password: wrong current → inline error; mismatch → inline error; valid → success and you can sign in again with the new password.
- Sessions: list shows at least the current device (flagged); "Sign out all other devices" disabled when only one session; sign out → redirected home.
- Danger zone: button disabled until `DELETE` + password entered. (Optionally test delete with a throwaway account — destructive.)

If the dev server can't be run, say so explicitly rather than claiming success.

---

## Deploy (separate, gated)

1. Push `feature/user-settings`; open PR → `develop`.
2. Migration 007 already applied to the shared dev/prod DB (Task 1). No further DB step at promotion.
3. Verify on develop preview, then promote `develop → main` (Jordan-gated) following the deploy-pipeline.

---

## Self-review

**Spec coverage:**
- §4 route/structure → Tasks 3, 4.
- §5.1 Appearance → Task 5.
- §5.2 Profile (avatar/name/email/member-since) → Task 6.
- §5.3 Security (change password, sessions, revoke others, sign out) → Tasks 7, 8.
- §5.4 Danger zone (delete account) → Task 9.
- §6.1 enable deleteUser → Task 2.
- §6.2 migration 007 → Task 1.
- §6.3 admin_users → noted in Task 1 (no FK, no action needed).
- §6.4 client calls only → Tasks 5–9 (no custom routes added).
- §7 cascade → migration 007 (Task 1) + delete copy (Task 9).
- §8 data refresh → Task 6 (`refreshUser`).
- §9 validation → Tasks 6, 7, 9.
- §11 deploy → Deploy section.

**Placeholder scan:** none — every step has real code/commands. The "adjust if BetterAuth types differ" notes are deliberate guards, not placeholders.

**Type/name consistency:** `Section` used consistently; `authClient.updateUser/changePassword/listSessions/revokeOtherSessions/deleteUser` consistent; `useAuthStore` selectors (`initialize`, `signOut`) match the store; `useTheme().setTheme`/`Theme` consistent; `avatarBackground` matches `utils/avatarHue.ts`.

No issues found.

---

## Plan complete

Saved to `docs/superpowers/plans/2026-05-20-user-settings-page.md`.
