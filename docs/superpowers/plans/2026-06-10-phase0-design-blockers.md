# Phase 0C: Design Launch Blockers + Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the design-domain launch blockers from the 2026-06-09 review — dead mobile bottom nav (phone users get timer/actions/share/facilitation), WCAG contrast failures at the token level, iOS input auto-zoom — plus password reset via Resend, and the 10-minute reduced-motion fix.

**Architecture:** The mobile fix is deliberately NOT a parallel mobile build: `TimerFloating`, `ActionItemsPanel`, and the panel overlay are fixed-position overlays that already work on any viewport — they just live inside BoardPage's desktop-only wrapper. We lift them out, restyle the panel as a bottom sheet under 768px, and wire the existing nav tabs to existing components (plus one new `MobileMoreSheet` that reuses `FacilitatorToolbar`). Contrast is fixed at the token level, not at 140 call sites.

**Tech Stack:** React 19, Tailwind 4 + OKLCH tokens, Better Auth 1.5.5 (`sendResetPassword`), Resend.

**Branch:** `feature/phase0-design` off `develop`. Independent of Plans 0A/0B (no shared files except trivial `lib/auth.ts` vs none — 0A/0B don't touch it).

**Prerequisites (Jordan, manual):**
- Resend account (free tier, 3k emails/mo): verify the `retroboard.live` domain (DNS records) and create an API key → `RESEND_API_KEY` in `.env.local` + Vercel. The `.env.example` placeholder already exists.

**Review reference:** design findings "Mobile bottom nav is dead UI", "WCAG AA contrast failures", "iOS Safari auto-zooms", "No prefers-reduced-motion", and architecture finding "No password reset" in `docs/superpowers/specs/2026-06-09-saas-readiness-review.md`. **Deliberately deferred to Phase 1** (do not scope-creep them in): toast channel, 44px touch targets, focus traps, invite-moment modal, OG metadata, email verification.

---

### Task 1: Contrast fixes at the token level

**Files:**
- Modify: `styles/index.css` (light `--ink-4`/`--ink-5`; dark `--ink-4`)
- Modify: `components/Board/MobileColumnTabs.tsx` (active tab: ink-on-tint instead of white-on-color)
- Modify: `components/pages/BoardPage.tsx` (~lines 426–439, desktop column filter: same pattern)

- [ ] **Step 1: Darken the light-mode ink ramp**

In `styles/index.css`, light block (`:root, [data-theme="light"]`), change:

```css
/* before */
--ink-4: oklch(0.65 0.010 260);
--ink-5: oklch(0.80 0.008 260);
/* after */
--ink-4: oklch(0.56 0.012 260);   /* ~4.6:1 on --bg — passes AA for the 78 small-text call sites */
--ink-5: oklch(0.70 0.010 260);   /* placeholder/disabled tier — clears 3:1 for UI text */
```

In the dark block (`[data-theme="dark"]` — find the `--ink-4` line there), raise its lightness by `+0.05` (the review measured dark `--ink-4` at 4.23:1 — just under AA for small text). Example: if it reads `oklch(0.62 …)`, set `oklch(0.67 …)` and keep chroma/hue.

- [ ] **Step 2: Active column tabs — ink on tint, not white on color**

In `components/Board/MobileColumnTabs.tsx`, replace the active styling (className + the two `style` props):

```tsx
className={cn(
  'shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-[13px] font-medium',
  'transition-[background-color,color,border-color] duration-150',
  active
    ? 'border-transparent text-[var(--ink)]'
    : 'bg-[var(--bg-elev)] border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--line-strong)]'
)}
style={
  active
    ? { background: `color-mix(in oklab, ${c.color || 'var(--accent)'} 22%, var(--bg-elev))` }
    : undefined
}
```

And the identity dot keeps the full column color in BOTH states (it carries the color identity now that the text doesn't):

```tsx
<span
  aria-hidden
  className="w-2 h-2 rounded-full shrink-0"
  style={{ background: c.color || 'var(--accent)' }}
/>
```

- [ ] **Step 3: Desktop column filter — same pattern**

In `components/pages/BoardPage.tsx` (~lines 426–439), in the per-column filter buttons change the active branch of the `cn()` from `'text-white shadow-sm'` to `'text-[var(--color-gray-8)] shadow-sm'` and the style prop from:

```tsx
style={activeColumnFilter === col.id ? { backgroundColor: col.color } : undefined}
```

to:

```tsx
style={
  activeColumnFilter === col.id
    ? { backgroundColor: `color-mix(in oklab, ${col.color} 22%, var(--bg-elev))` }
    : undefined
}
```

The "All" button (`bg-[var(--color-navy)] text-white`) already passes (ink on white) — leave it.

- [ ] **Step 4: Verify**

Browser at 375px and 1280px, light AND dark themes: active mobile column tab label readable on every template color; card author names / column descriptions / empty states visibly darker than before. DevTools → element → Accessibility pane: contrast on an author name ≥ 4.5:1, active tab label ≥ 4.5:1. Check siblings per the design-system polish rule: dashboard labels and settings page text (same tokens) still look intentional, not muddy.

- [ ] **Step 5: Commit**

```bash
git add styles/index.css components/Board/MobileColumnTabs.tsx components/pages/BoardPage.tsx
git commit -m "fix(a11y): WCAG AA contrast — darken ink ramp, ink-on-tint active chips"
```

---

### Task 2: Lift the overlays out of the desktop-only wrapper

**Files:**
- Modify: `components/pages/BoardPage.tsx` (move `TimerFloating`, `ActionItemsPanel`, the panel overlay, and the Complete-retro `Modal` from inside the `hidden md:block` AppShell out to the fragment root)
- Modify: `components/ActionItems/ActionItemsPanel.tsx` (bottom-sheet styling under 768px)
- Modify: `components/Timer/TimerFloating.tsx` (clear the mobile bottom nav + FAB)

- [ ] **Step 1: Move the four overlay blocks in BoardPage**

In `components/pages/BoardPage.tsx`, the desktop wrapper is `<div className="hidden md:block"><AppShell>…</AppShell></div>`. Near its end (~lines 585–655) live four overlay blocks: the Complete-retro `<Modal>`, the panel overlay `{showActionItems && <div className="fixed inset-0 …" />}`, `{isJoined && !isCompleted && <TimerFloating …/>}`, and `{isJoined && <ActionItemsPanel …/>}`.

Cut all four blocks and paste them AFTER the closing `</div>` of the desktop wrapper, immediately before the final `</>`. They are fixed-position (or modal) elements — rendering them at the fragment root makes them work on both shells with zero prop changes. Result shape:

```tsx
return (
  <>
    {/* ── Mobile shell (< 768px) ─────────────── */}
    <div className="md:hidden">…</div>

    {/* ── Desktop shell (≥ 768px) ────────────── */}
    <div className="hidden md:block">
      <AppShell …>…</AppShell>
    </div>

    {/* ── Shared overlays (both shells) ──────── */}
    <Modal … >{/* Complete retro */}</Modal>
    {showActionItems && (
      <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setShowActionItems(false)} />
    )}
    {isJoined && !isCompleted && (
      <TimerFloating timer={timer} isAdmin={isAdmin} onStart={timerStart} onPause={timerPause} onResume={timerResume} onReset={timerReset} />
    )}
    {isJoined && (
      <ActionItemsPanel
        open={showActionItems}
        onClose={() => setShowActionItems(false)}
        actionItems={actionItems}
        participants={participants}
        onAddItem={addActionItem}
        onUpdateItem={updateActionItem}
        onDeleteItem={deleteActionItem}
        onExportMarkdown={handleExportMarkdown}
        onExportCsv={handleExportCsv}
        readOnly={isCompleted}
      />
    )}
  </>
);
```

(`npx tsc --noEmit` confirms nothing referenced inside AppShell was lost in the move.)

- [ ] **Step 2: ActionItemsPanel as a bottom sheet under 768px**

In `components/ActionItems/ActionItemsPanel.tsx`, replace the root `cn(...)`:

```tsx
className={cn(
  // Desktop: right-side slide-in panel (unchanged ≥768px)
  'fixed z-40 flex flex-col bg-[var(--color-surface)] shadow-xl transition-transform duration-300',
  'md:inset-y-0 md:right-0 md:w-full md:max-w-md md:border-l md:border-[var(--color-gray-1)]',
  // Mobile: bottom sheet
  'max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[80dvh] max-md:rounded-t-2xl max-md:border-t max-md:border-[var(--color-gray-1)]',
  open
    ? 'md:translate-x-0 max-md:translate-y-0'
    : 'md:translate-x-full max-md:translate-y-full'
)}
```

- [ ] **Step 3: TimerFloating clears the mobile chrome**

In `components/Timer/TimerFloating.tsx`, find the root container's positioning class (`grep -n "fixed" components/Timer/TimerFloating.tsx`) and add a mobile offset so it floats above the bottom nav + FAB: append `max-md:bottom-28` next to its existing `bottom-*` class (keep the desktop value via `md:bottom-<existing>` if the class isn't already breakpoint-scoped).

- [ ] **Step 4: Verify (375px viewport)**

Phone viewport, joined board: start a timer as facilitator from desktop → the floating timer is now VISIBLE on the phone above the nav; it doesn't cover the FAB. Completed board: timer hidden (unchanged logic). Desktop unchanged at 1280px.

- [ ] **Step 5: Commit**

```bash
git add components/pages/BoardPage.tsx components/ActionItems/ActionItemsPanel.tsx components/Timer/TimerFloating.tsx
git commit -m "fix(mobile): timer + action items render on mobile; panel becomes bottom sheet"
```

---

### Task 3: Wire the bottom nav — Actions opens the panel, More opens a real sheet, Votes tab dropped

**Files:**
- Create: `components/Board/MobileMoreSheet.tsx`
- Modify: `components/Board/MobileBottomNav.tsx` (3 tabs, momentary actions)
- Modify: `components/Board/MobileBoardShell.tsx` (wire tabs; render ConnectionStatusBanner + MobileMoreSheet; new props)
- Modify: `components/pages/BoardPage.tsx` (pass the new props)

- [ ] **Step 1: MobileMoreSheet**

```tsx
// components/Board/MobileMoreSheet.tsx
'use client';

import { useState } from 'react';
import { X, Check, Link2, Users, CheckCircle2 } from 'lucide-react';
import { FacilitatorToolbar } from './FacilitatorToolbar';
import type { BoardSettings, Participant } from '@/types';

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  boardTitle: string;
  joinCode: string | null;
  participants: Participant[];
  isAdmin: boolean;
  isCompleted: boolean;
  settings: BoardSettings;
  onUpdateSettings: (settings: Partial<BoardSettings>) => void;
  actionItemCount: number;
  onToggleActionItems: () => void;
  onCompleteRetro: () => void;
}

export function MobileMoreSheet({
  open,
  onClose,
  boardTitle,
  joinCode,
  participants,
  isAdmin,
  isCompleted,
  settings,
  onUpdateSettings,
  actionItemCount,
  onToggleActionItems,
  onCompleteRetro,
}: MobileMoreSheetProps) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href.split('?')[0]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Board options"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl border-t border-[var(--line)] bg-[var(--surface)] p-4 pb-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="min-w-0 truncate text-base font-semibold text-[var(--ink)]">
            {boardTitle}
            {isCompleted && (
              <span className="ml-2 text-xs font-medium text-[var(--success)]">Completed</span>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[var(--r-md)] p-2 text-[var(--ink-3)] hover:bg-[var(--surface-muted)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Share */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-[var(--ink-2)]"
          >
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            {copied ? 'Link copied!' : 'Copy board link'}
          </button>
          {joinCode && (
            <p className="text-center text-[13px] text-[var(--ink-3)]">
              Join code: <span className="mono font-semibold text-[var(--ink)]">{joinCode}</span>
            </p>
          )}
        </div>

        {/* Participants */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--ink-2)]">
            <Users size={16} />
            {participants.length} participant{participants.length === 1 ? '' : 's'}
          </div>
          <p className="mt-1 text-[13px] leading-5 text-[var(--ink-3)]">
            {participants.map((p) => p.display_name).join(', ')}
          </p>
        </div>

        {/* Facilitator controls — same component as the desktop header */}
        {isAdmin && !isCompleted && (
          <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-4)]">
              Facilitator
            </span>
            <FacilitatorToolbar
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              actionItemCount={actionItemCount}
              onToggleActionItems={() => {
                onClose();
                onToggleActionItems();
              }}
              isCompleted={isCompleted}
              onCompleteRetro={() => {
                onClose();
                onCompleteRetro();
              }}
            />
            <button
              type="button"
              onClick={() => {
                onClose();
                onCompleteRetro();
              }}
              className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-[var(--bg-elev)]"
            >
              <CheckCircle2 size={16} />
              Complete retro
            </button>
          </div>
        )}
      </div>
    </>
  );
}
```

(If `FacilitatorToolbar` already includes a Complete control, keep the explicit button anyway — it's the sheet's primary action and the toolbar's version is icon-sized.)

- [ ] **Step 2: Three momentary tabs**

In `components/Board/MobileBottomNav.tsx`: remove the `votes` entry (MobileVoteTracker already shows vote state) and switch the grid:

```tsx
const ITEMS: Array<{ key: MobileNavKey; icon: typeof Columns3; label: string }> = [
  { key: 'board',   icon: Columns3,       label: 'Board' },
  { key: 'actions', icon: ListChecks,     label: 'Actions' },
  { key: 'more',    icon: MoreHorizontal, label: 'More' },
];
```

Change `grid-cols-4` → `grid-cols-3`, delete the `ThumbsUp` import, and narrow the type: `export type MobileNavKey = 'board' | 'actions' | 'more';`

- [ ] **Step 3: Wire MobileBoardShell**

In `components/Board/MobileBoardShell.tsx`:

1. Extend the props interface:

```ts
// New props (wired from BoardPage):
boardTitle: string;
joinCode: string | null;
settings: BoardSettings;
onUpdateSettings: (settings: Partial<BoardSettings>) => void;
onOpenActionItems: () => void;
onCompleteRetro: () => void;
```

Add `BoardSettings` to the type import and `import { MobileMoreSheet } from './MobileMoreSheet';` and `import { ConnectionStatusBanner } from './ConnectionStatusBanner';`

2. Replace the `navTab` state with a sheet state and momentary tab handling — delete `const [navTab, setNavTab] = useState<MobileNavKey>('board');`, add `const [moreOpen, setMoreOpen] = useState(false);`, and change the nav render to:

```tsx
<MobileBottomNav
  active="board"
  onSelect={(key) => {
    if (key === 'actions') onOpenActionItems();
    if (key === 'more') setMoreOpen(true);
  }}
  actionBadgeCount={actionItems.length}
/>
```

(Remove the now-unused `MobileNavKey` import.)

3. Render the connection banner at the top of the shell, right after the opening `<div className="flex flex-col min-h-dvh …">`:

```tsx
<ConnectionStatusBanner />
```

4. Render the sheet before the composer sheet:

```tsx
<MobileMoreSheet
  open={moreOpen}
  onClose={() => setMoreOpen(false)}
  boardTitle={boardTitle}
  joinCode={joinCode}
  participants={participants}
  isAdmin={isAdmin}
  isCompleted={isCompleted}
  settings={settings}
  onUpdateSettings={onUpdateSettings}
  actionItemCount={actionItems.length}
  onToggleActionItems={onOpenActionItems}
  onCompleteRetro={onCompleteRetro}
/>
```

- [ ] **Step 4: Pass the props from BoardPage**

In the `<MobileBoardShell` call in `components/pages/BoardPage.tsx`, add:

```tsx
boardTitle={board.title}
joinCode={board.join_code ?? null}
settings={board.settings}
onUpdateSettings={updateSettings}
onOpenActionItems={() => setShowActionItems(true)}
onCompleteRetro={() => setShowCompleteModal(true)}
```

- [ ] **Step 5: Verify on a phone viewport (the ui-feature-verify gate — this is the flow the review called the most important in the product)**

375px viewport, two browser contexts (one desktop facilitator, one mobile participant):
1. Mobile tabs: Actions opens the action-items bottom sheet (add/check an item; count badge matches); More opens the sheet (copy link works, join code shown, participants listed).
2. Facilitator on the phone: More → reveal/hide cards, toggle voting, lock board — desktop context reflects each within a second; Complete retro opens the confirm modal (now shared) and completes.
3. Timer started on desktop is visible on the phone; connection banner appears on the phone when you toggle network off/on.
4. Non-admin participant: More sheet shows share/participants but NO facilitator section.
5. Desktop at 1280px: zero behavior change (toolbar, panel slide-in from right, timer position).

- [ ] **Step 6: Run checks and commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add components/Board/MobileMoreSheet.tsx components/Board/MobileBottomNav.tsx components/Board/MobileBoardShell.tsx components/pages/BoardPage.tsx
git commit -m "feat(mobile): working bottom nav — actions sheet, more sheet with facilitation"
```

---

### Task 4: Kill iOS input auto-zoom (16px inputs)

**Files:**
- Modify: `components/common/Input.tsx:28` (`text-[15px]` → `text-[16px]`)
- Modify: `components/Board/AddCardForm.tsx` (textarea `text-[15px]` → `text-[16px]`)
- Modify: `components/Board/RetroCard.tsx` (edit textarea — `grep -n "text-\[15px\]" components/Board/RetroCard.tsx` → same change)

- [ ] **Step 1: Make the three changes** (find any stragglers: `grep -rn "text-\[15px\]" components | grep -iE "input|textarea|composer|form"` — `MobileCardComposerSheet` is already 16px and is the reference).

- [ ] **Step 2: Verify** — iOS Safari (or simulator): tapping the join-name input, join-code input, add-card textarea, and card-edit textarea no longer zooms the viewport. Desktop: the 15→16px bump is visually negligible; confirm the join modal and card composer still look right.

- [ ] **Step 3: Commit**

```bash
git add components/common/Input.tsx components/Board/AddCardForm.tsx components/Board/RetroCard.tsx
git commit -m "fix(mobile): 16px inputs — stop iOS Safari auto-zoom on join and card entry"
```

---

### Task 5: prefers-reduced-motion

**Files:**
- Modify: `styles/index.css` (append at the end, after the utility-helpers section)

- [ ] **Step 1: Append**

```css
/* ------------------------------------------------------------------ */
/* 9. Reduced motion                                                    */
/* ------------------------------------------------------------------ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Verify** — DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: modals appear without scale animation, timer expiry doesn't pulse, panel appears without slide. Commit:

```bash
git add styles/index.css
git commit -m "fix(a11y): respect prefers-reduced-motion"
```

---

### Task 6: Password reset via Resend

**Files:**
- Create: `lib/email.ts`
- Modify: `lib/auth.ts` (add `sendResetPassword` to `emailAndPassword`)
- Create: `app/forgot-password/page.tsx`
- Create: `app/reset-password/page.tsx`
- Modify: `app/login/page.tsx` (add "Forgot password?" link near the password field)

- [ ] **Step 1: Install and write the email helper**

```bash
npm install resend
```

```ts
// lib/email.ts
// Lazy init, same pattern as lib/db.ts — never crash the build without env.
import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendPasswordResetEmail(to: string, url: string) {
  await getResend().emails.send({
    from: 'RetroBoard <noreply@retroboard.live>',
    to,
    subject: 'Reset your RetroBoard password',
    text: [
      'Someone (hopefully you) asked to reset the password for this RetroBoard account.',
      '',
      `Reset it here: ${url}`,
      '',
      "The link expires in 1 hour. If you didn't request this, you can ignore this email — nothing changes.",
    ].join('\n'),
  });
}
```

- [ ] **Step 2: Wire Better Auth**

In `lib/auth.ts`, add the import `import { sendPasswordResetEmail } from './email';` and extend the `emailAndPassword` block inside `getAuth()`:

```ts
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url }) => {
    await sendPasswordResetEmail(user.email, url);
  },
},
```

(Better Auth generates the tokenized `url` pointing at the `redirectTo` you pass from the client; 1-hour expiry is its default.)

- [ ] **Step 3: Forgot-password page**

```tsx
// app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Always show success — never reveal whether an email has an account.
    await authClient.forgetPassword({
      email,
      redirectTo: '/reset-password',
    }).catch(() => {});
    setSent(true);
    setLoading(false);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-bold text-[var(--ink)]">Reset your password</h1>
      {sent ? (
        <p className="mt-4 text-sm leading-6 text-[var(--ink-2)]">
          If an account exists for <strong>{email}</strong>, a reset link is on its way.
          Check your inbox (and spam) — the link expires in 1 hour.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Input
            id="email"
            type="email"
            label="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 text-sm text-[var(--accent)]">
        Back to sign in
      </Link>
    </main>
  );
}
```

(If `authClient.forgetPassword` doesn't exist on this Better Auth client version, the renamed API is `authClient.requestPasswordReset({ email, redirectTo })` — `npx tsc --noEmit` will tell you which one this version exports; use that one.)

- [ ] **Step 4: Reset-password page**

```tsx
// app/reset-password/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <p className="mt-4 text-sm text-[var(--ink-2)]">
        This reset link is invalid or incomplete. Request a new one from the{' '}
        <a href="/forgot-password" className="text-[var(--accent)]">forgot password</a> page.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    const { error: apiError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setLoading(false);
    if (apiError) {
      setError('This link has expired or was already used. Request a new one.');
      return;
    }
    router.push('/login?reset=success');
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <Input
        id="new-password"
        type="password"
        label="New password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
        autoComplete="new-password"
      />
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-bold text-[var(--ink)]">Choose a new password</h1>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 5: Login page link**

In `app/login/page.tsx`, near the password input (find the password `<Input`), add below it:

```tsx
<Link href="/forgot-password" className="self-end text-xs text-[var(--accent)]">
  Forgot password?
</Link>
```

(Match the page's existing Link import/styling conventions. Optional: if the page reads `searchParams` already, show a one-line "Password updated — sign in" notice when `?reset=success`.)

- [ ] **Step 6: Verify end-to-end (real email)**

With `RESEND_API_KEY` set and the domain verified: forgot-password with your real account email → email arrives → link opens reset page → new password works on login → old password rejected. Also: unknown email shows the same "on its way" message (no enumeration); reusing the link fails with the expired message.

- [ ] **Step 7: Run checks and commit**

Run: `npx tsc --noEmit && npm test && npm run build`

```bash
git add lib/email.ts lib/auth.ts app/forgot-password app/reset-password app/login/page.tsx package.json package-lock.json
git commit -m "feat(auth): self-serve password reset via Resend"
```

---

### Task 7: Ship the branch

- [ ] Full gate: `npx tsc --noEmit && npm run build && npm test` (never under a live `next dev`).
- [ ] Push `feature/phase0-design`, `gh pr create` → develop. PR description: include phone-viewport screenshots from Task 3 Step 5 (mobile sheets, timer, facilitator flow) and contrast before/after — this is the browser-verification evidence the ui-feature-verify gate requires.
- [ ] Jordan reviews → `/deploy-check` → merge → verify the mobile flow once more on the develop preview URL **on a real phone**.

**Definition of done:** a facilitator can run a complete retro from a phone (reveal, vote toggle, timer visible, action items, complete); contrast spot-checks pass AA in both themes; iOS doesn't zoom on first touch; password reset round-trips with a real email.
