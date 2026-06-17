# Mobile UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two reported mobile bugs (document-scroll/FAB-layering, fake-tab nav) at the root and bring the mobile board view to a genuinely good standard across layout, a11y, iOS Safari correctness, touch ergonomics, visual consistency, and parity.

**Architecture:** Bound the scroll height at the *mobile wrapper* (not global `html,body`) so only the card list scrolls; make the bottom nav an honest toolbar driven by sheet-open state; consolidate the three bottom sheets onto one accessible `MobileSheet` primitive; standardize 44px touch targets and a single z-scale; re-skin the legacy-token Actions sheet; surface participant management on mobile via a shared `ParticipantList`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4 (`@theme` tokens in `styles/index.css`), lucide-react, vitest (node-only), TypeScript 5.9.

## Global Constraints

- **Honest-toolbar nav model only.** Board = base view, lit only when nothing open; Actions/More are sheet-openers that light their own icon while open; tapping Board dismisses any open sheet. No fake active state, no real tab views.
- **Mobile = grid/column-tab layout only.** No swimlane/list/timeline switcher on mobile.
- **Never lock `html,body` globally** — the board route also renders the desktop shell; scope height bounding to the `md:hidden` mobile wrapper.
- **Design tokens:** use the current OKLCH set (`--bg`, `--ink`, `--ink-2..5`, `--surface`, `--surface-muted`, `--line`, `--line-strong`, `--accent`, `--accent-soft`, `--on-accent`, `--danger`, `--success`, `--r-*`, `--shadow-*`). Do **not** introduce or keep legacy `--color-*` / `--radius-*` tokens in mobile code.
- **z-scale (mobile):** bottom nav `z-30` < FAB `z-40` < sheets/overlays `z-50`. Floating timer below sheets on mobile.
- **Touch target minimum:** 44×44px hit area for interactive controls on the mobile path.
- **Single source of truth:** `--safe-bottom` token, `computeMobileNavActive`, and `ParticipantList` each declared once and imported.
- **Verification gate:** `npx tsc --noEmit` + `npm run build` + `vitest run` green **and** the browser checklist observed at 390×844 (responsive devtools) before any "done" claim. Visual/scroll/keyboard/safe-area behaviors also confirmed on physical iOS Safari before merge to `main`.
- **Branch:** `feature/mobile-ux-overhaul`. Commit per task. Explicit `git add <paths>` only — never `-a`/`-am` (untracked `retro-board-phase0*` dirs must stay unstaged).

---

## Phase 0: P0 — fix the two reported bugs + coupled siblings

### Task 1: Safe-area viewport, tokens, and tap-highlight reset

**Files:**
- Modify: `app/layout.tsx` (add `viewport` export)
- Modify: `styles/index.css` (add `--safe-bottom` token; `-webkit-tap-highlight-color` reset)

**Interfaces:**
- Produces: CSS var `--safe-bottom` (= `env(safe-area-inset-bottom)`) usable as `var(--safe-bottom)` in later tasks; `viewport-fit=cover` enabling `env(safe-area-inset-*)`.

- [ ] **Step 1: Add the `viewport` export to `app/layout.tsx`**

Add `Viewport` to the type import and a `viewport` export after `metadata`:

```tsx
import type { Metadata, Viewport } from 'next';
// ...
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' }, // ≈ --bg light oklch(0.985 0.004 80)
    { media: '(prefers-color-scheme: dark)', color: '#15161b' },  // ≈ --bg dark  oklch(0.155 0.012 260)
  ],
};
```

- [ ] **Step 2: Add `--safe-bottom` token + tap-highlight reset to `styles/index.css`**

In the `:root` token block (near line 15-25, alongside `--r-2xl`), add:

```css
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-top: env(safe-area-inset-top, 0px);
```

In `@layer base` (near the `html`/`body` rules ~344), add a tap-highlight reset:

```css
  * { -webkit-tap-highlight-color: transparent; }
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS, route table compiles.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx styles/index.css
git commit -m "feat(mobile): viewport-fit=cover + --safe-bottom token + tap-highlight reset"
```

---

### Task 2: Bounded scroll container (fixes scroll/FAB-layering bug)

**Files:**
- Modify: `components/pages/BoardPage.tsx:298` (mobile wrapper)
- Modify: `components/Board/MobileBoardShell.tsx` (outer container, chrome `shrink-0`, card list `min-h-0`/`overscroll-contain`/`pb` calc, FAB position)
- Modify: `components/Board/MobileBottomNav.tsx:27` (remove `sticky`, z-30, safe-area pad)
- Modify: `components/Board/MobileFAB.tsx:16` (absolute, z-40, safe-area offset)

**Interfaces:**
- Consumes: `--safe-bottom` (Task 1).
- Produces: a bounded mobile shell where only the card list scrolls; FAB and nav share the shell's box.

- [ ] **Step 1: Bound the mobile wrapper in `BoardPage.tsx`**

Change line 298 from `<div className="md:hidden">` to:

```tsx
      <div className="md:hidden h-[100dvh] overflow-hidden">
```

- [ ] **Step 2: Make `MobileBoardShell` a bounded flex column**

Outer container (line 156) from `flex flex-col min-h-dvh bg-[var(--bg)]` to:

```tsx
    <div className="relative flex flex-col h-full overflow-hidden bg-[var(--bg)]">
```

Wrap the non-scrolling chrome so it can't shrink: the `ConnectionStatusBanner`, `MobileVoteTracker`, `MobileColumnTabs`, merge banner, and sort-control blocks each get `shrink-0`. Simplest: leave them as-is (they're block siblings) but add `shrink-0` to each top-level chrome wrapper. For the column tabs and vote tracker (their own components) no change needed if the card list owns the flex growth; explicitly mark the merge banner and sort row containers `shrink-0`.

Card list (line 204) from `flex-1 px-4 pt-3 pb-[136px] flex flex-col gap-2 overflow-y-auto` to:

```tsx
      <div className="flex-1 min-h-0 px-4 pt-3 pb-[calc(84px+var(--safe-bottom))] flex flex-col gap-2 overflow-y-auto overscroll-contain">
```

- [ ] **Step 3: Un-stick the bottom nav and add z-30 + safe-area pad**

In `MobileBottomNav.tsx:27`, change `sticky bottom-0 ... pb-[18px] ... z-20` to a normal flex child:

```tsx
      className="grid grid-cols-3 gap-1 px-2 pt-2 border-t border-[var(--line)] z-30"
      style={{
        paddingBottom: 'calc(8px + var(--safe-bottom))',
        background: 'color-mix(in oklab, var(--bg) 85%, transparent)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
```

- [ ] **Step 4: Make the FAB absolute within the shell, z-40, safe-area aware**

In `MobileFAB.tsx:16`, change `fixed right-4 bottom-[84px] ... z-20` to:

```tsx
      className="absolute right-4 bottom-[calc(76px+var(--safe-bottom))] w-[52px] h-[52px] rounded-full grid place-items-center border-none cursor-pointer text-[var(--on-accent)] shadow-[var(--shadow-lg)] z-40 active:scale-95 transition-transform duration-75"
```

(`absolute` resolves against the now-`relative` shell; `76px` clears the nav height + gap above `--safe-bottom`.)

- [ ] **Step 5: Browser verify at 390×844**

Run the app (dev server) and in responsive mode: load a board with enough cards to overflow. Confirm: only the card list scrolls; vote tracker + column tabs stay pinned; the FAB stays put above the nav and never overlaps it; the last card clears the FAB; nothing sits under the home-indicator area (toggle a device with a safe-area inset).

- [ ] **Step 6: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add components/pages/BoardPage.tsx components/Board/MobileBoardShell.tsx components/Board/MobileBottomNav.tsx components/Board/MobileFAB.tsx
git commit -m "fix(mobile): bounded scroll container so card list scrolls, not the document; FAB/nav share the shell box"
```

---

### Task 3: Honest toolbar (fixes "nothing changes" bug)

**Files:**
- Create: `lib/mobileNav.ts`
- Create: `lib/__tests__/mobileNav.test.ts`
- Modify: `components/pages/BoardPage.tsx` (pass `actionsOpen` + `onCloseActionItems`)
- Modify: `components/Board/MobileBoardShell.tsx` (accept props, compute active, Board dismisses sheets)

**Interfaces:**
- Produces: `computeMobileNavActive({ moreOpen, actionsOpen }: { moreOpen: boolean; actionsOpen: boolean }): MobileNavKey` returning `'more' | 'actions' | 'board'`.
- `MobileBoardShellProps` gains `actionsOpen: boolean` and `onCloseActionItems: () => void`.

- [ ] **Step 1: Write the failing test** — `lib/__tests__/mobileNav.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { computeMobileNavActive } from '@/lib/mobileNav';

describe('computeMobileNavActive', () => {
  it('returns board when nothing is open', () => {
    expect(computeMobileNavActive({ moreOpen: false, actionsOpen: false })).toBe('board');
  });
  it('returns actions when the actions sheet is open', () => {
    expect(computeMobileNavActive({ moreOpen: false, actionsOpen: true })).toBe('actions');
  });
  it('returns more when the more sheet is open', () => {
    expect(computeMobileNavActive({ moreOpen: true, actionsOpen: false })).toBe('more');
  });
  it('prefers more over actions when both are open', () => {
    expect(computeMobileNavActive({ moreOpen: true, actionsOpen: true })).toBe('more');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run lib/__tests__/mobileNav.test.ts`
Expected: FAIL — cannot resolve `@/lib/mobileNav`.

- [ ] **Step 3: Implement** — `lib/mobileNav.ts`

```ts
import type { MobileNavKey } from '@/components/Board/MobileBottomNav';

export function computeMobileNavActive({
  moreOpen,
  actionsOpen,
}: {
  moreOpen: boolean;
  actionsOpen: boolean;
}): MobileNavKey {
  if (moreOpen) return 'more';
  if (actionsOpen) return 'actions';
  return 'board';
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run lib/__tests__/mobileNav.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Thread props from `BoardPage.tsx`**

In the `<MobileBoardShell ... />` props block (around line 327), replace the single `onOpenActionItems` line with:

```tsx
            actionsOpen={showActionItems}
            onOpenActionItems={() => setShowActionItems(true)}
            onCloseActionItems={() => setShowActionItems(false)}
```

- [ ] **Step 6: Wire the honest active state in `MobileBoardShell.tsx`**

Add `actionsOpen: boolean` and `onCloseActionItems: () => void` to `MobileBoardShellProps` and the destructured params. Import the helper:

```tsx
import { computeMobileNavActive } from '@/lib/mobileNav';
```

Replace the bottom nav block (lines 258-266) with:

```tsx
      {/* Bottom nav — honest toolbar */}
      <MobileBottomNav
        active={computeMobileNavActive({ moreOpen, actionsOpen })}
        onSelect={(key) => {
          if (key === 'board') {
            setMoreOpen(false);
            onCloseActionItems();
          }
          if (key === 'actions') onOpenActionItems();
          if (key === 'more') setMoreOpen(true);
        }}
        actionBadgeCount={actionItems.length}
      />
```

- [ ] **Step 7: Browser verify**

At 390×844: tap **Actions** → Actions icon lights, Board un-lights, sheet opens. Tap **More** → More lights. With a sheet open, tap **Board** → sheet closes and Board lights. No dead state.

- [ ] **Step 8: Build + commit**

```bash
npx tsc --noEmit && npm run build && npx vitest run
git add lib/mobileNav.ts lib/__tests__/mobileNav.test.ts components/pages/BoardPage.tsx components/Board/MobileBoardShell.tsx
git commit -m "fix(mobile): honest toolbar — nav active reflects open sheet; Board dismisses sheets"
```

---

## Phase 1: P1 — a11y, touch, parity, contrast

### Task 4: Shared accessible `MobileSheet` primitive

**Files:**
- Create: `components/common/Sheet.tsx`
- Create: `hooks/useFocusTrap.ts`
- Create: `hooks/useDismissable.ts`

**Interfaces:**
- Produces:
  - `useFocusTrap(active: boolean): React.RefObject<HTMLDivElement>` — on activate, moves focus into the ref'd container, traps Tab, restores focus to the previously-focused element on deactivate.
  - `useDismissable(active: boolean, onClose: () => void): void` — closes on Escape and on browser Back (pushes a history state on open, listens for `popstate`).
  - `MobileSheet({ open, onClose, label, children, footer? })` — bottom sheet: backdrop (fade), `role="dialog" aria-modal="true" aria-label={label}`, slide-up transition, `overscroll-contain` scroll body, `pb` includes `--safe-bottom`, unmounts when closed, respects `prefers-reduced-motion`. z-50.

- [ ] **Step 1: Implement `hooks/useFocusTrap.ts`**

```ts
'use client';
import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    focusables()[0]?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active]);
  return ref;
}
```

- [ ] **Step 2: Implement `hooks/useDismissable.ts`**

```ts
'use client';
import { useEffect } from 'react';

export function useDismissable(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.history.pushState({ sheet: true }, '');
    function onPop() {
      onClose();
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
    };
  }, [active, onClose]);
}
```

- [ ] **Step 3: Implement `components/common/Sheet.tsx`**

```tsx
'use client';
import type { ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDismissable } from '@/hooks/useDismissable';

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}

export function MobileSheet({ open, onClose, label, children }: MobileSheetProps) {
  const trapRef = useFocusTrap(open);
  useDismissable(open, onClose);
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-[oklch(0.15_0.01_260/0.40)] motion-safe:animate-[fadeIn_150ms_ease]"
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-y-auto overscroll-contain rounded-t-2xl border-t border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-lg)] motion-safe:animate-[slideUp_300ms_cubic-bezier(0.32,0.72,0,1)]"
        style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}
      >
        {children}
      </div>
    </>
  );
}
```

Add the keyframes to `styles/index.css`:

```css
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
```

- [ ] **Step 4: Build (no consumers yet — just compiles)**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/common/Sheet.tsx hooks/useFocusTrap.ts hooks/useDismissable.ts styles/index.css
git commit -m "feat(mobile): accessible MobileSheet primitive (focus trap, Escape, Android-back, slide-up)"
```

---

### Task 5: Refactor `MobileMoreSheet` onto the primitive

**Files:**
- Modify: `components/Board/MobileMoreSheet.tsx`

- [ ] **Step 1: Replace the hand-rolled overlay/dialog with `MobileSheet`**

Import `MobileSheet`; remove the manual backdrop + `fixed inset-x-0 bottom-0 ...` container and the `if (!open) return null` (the primitive owns open/close). Keep the inner content (header, share, participants, facilitator) as `MobileSheet` children. Pass `label={boardTitle}`. Remove the duplicate close `<X>` button if the heading row is retained (keep one). Use the 44px close-button hit area (`min-w-11 min-h-11 grid place-items-center`).

- [ ] **Step 2: Browser verify**

Open More → focus moves in, Tab cycles within, Escape closes, Android Back (devtools: history back) closes, focus returns to the More nav button. Slide-up animates.

- [ ] **Step 3: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add components/Board/MobileMoreSheet.tsx
git commit -m "refactor(mobile): More sheet on MobileSheet primitive (focus mgmt + transitions)"
```

---

### Task 6: Refactor card composer onto the primitive + keyboard-aware (rank 8)

**Files:**
- Create: `hooks/useVisualViewportInset.ts`
- Modify: `components/Board/MobileCardComposerSheet.tsx`

**Interfaces:**
- Produces: `useVisualViewportInset(): number` — pixels the bottom is obscured by the on-screen keyboard (0 when no keyboard), via the VisualViewport API.

- [ ] **Step 1: Implement `hooks/useVisualViewportInset.ts`**

```ts
'use client';
import { useEffect, useState } from 'react';

export function useVisualViewportInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const bottom = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(Math.max(0, Math.round(bottom)));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}
```

- [ ] **Step 2: Use `MobileSheet` + apply the keyboard inset**

Refactor `MobileCardComposerSheet` to render its content inside `MobileSheet` (label = `Add to ${columnTitle}`). Call `const kb = useVisualViewportInset();` and set the sheet's bottom padding to `calc(1rem + var(--safe-bottom) + ${kb}px)` (pass through a style or wrap the footer) so Cancel/Share stay above the keyboard. Keep the textarea at `text-[16px]` (already correct — prevents iOS zoom). Keep auto-focus.

- [ ] **Step 3: Browser verify**

Open composer, focus the textarea → keyboard appears, Cancel/Share remain visible and tappable; no iOS auto-zoom; Escape/Back close.

- [ ] **Step 4: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add hooks/useVisualViewportInset.ts components/Board/MobileCardComposerSheet.tsx
git commit -m "feat(mobile): card composer keyboard-aware + on MobileSheet primitive"
```

---

### Task 7: Re-skin Actions sheet onto current tokens + contrast + 16px inputs + touch delete (ranks 5, 11, 12)

**Files:**
- Modify: `components/ActionItems/ActionItemsPanel.tsx`
- Modify: `components/ActionItems/ActionItemRow.tsx`

- [ ] **Step 1: Token swap in `ActionItemsPanel.tsx`** — replace every legacy token:

`--color-surface`→`--surface`, `--color-gray-1`→`--line`, `--color-gray-2`→`--line`, `--color-gray-4`→`--ink-4`, `--color-gray-6`→`--ink-2`, `--color-gray-8`→`--ink`, `--color-navy`→`--accent`, `--color-navy-hover`→`--accent-hover`, `--radius-md`→`--r-md`, `text-white`→`text-[var(--on-accent)]`. The add button becomes `bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]`. (Desktop and mobile share this component; the swap is correct for both — these are dark-theme-aware tokens.)

- [ ] **Step 2: Token swap + contrast + 16px + touch-delete in `ActionItemRow.tsx`**

Replace legacy tokens as above. For contrast: secondary metadata text `--color-gray-4`→`--ink-3` (passes AA), the status `in_progress` color `--color-navy`→`--accent`, `--color-success`/`--color-error` → `--success`/`--danger`. Inputs: the description edit input `text-sm`→`text-[16px] md:text-sm`; the assignee `<select>` and date `<input>` `text-xs`→`text-[16px] md:text-xs`. Delete button: drop the `opacity-0 group-hover:opacity-100` gate so it's always visible on touch (`md:opacity-0 md:group-hover:opacity-100` to keep desktop hover-reveal), and give it a `min-w-11 min-h-11 grid place-items-center` hit area on mobile.

- [ ] **Step 3: Browser verify**

Actions sheet visually matches the rest of mobile (accent add button, correct borders/surfaces); metadata text is legible (dark mode); tapping date/assignee/edit does not zoom; delete is visible without hover.

- [ ] **Step 4: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add components/ActionItems/ActionItemsPanel.tsx components/ActionItems/ActionItemRow.tsx
git commit -m "fix(actions): re-skin onto current tokens, fix dark-mode contrast, 16px inputs, touch-visible delete"
```

> Note: `ActionItemsPanel` keeps its own responsive desktop-drawer / mobile-sheet classes (it is shared with desktop). Mobile a11y (focus trap / Escape / Back) for the Actions sheet is delivered by adding `role="dialog" aria-modal="true"` here and marking it `inert`/unmounted when closed; if time allows, route the mobile presentation through `MobileSheet`, but the desktop right-drawer must remain. Minimum: add `aria-modal`, `aria-label="Action Items"`, and `inert` when `!open` on the mobile breakpoint.

---

### Task 8: 44px touch targets (rank 4) + resting merge affordance (rank 11)

**Files:**
- Modify: `components/common/IconButton.tsx` (add a touch size)
- Modify: `components/Board/RetroCard.tsx` (card actions hit area, emoji grid, merge-target resting state)
- Modify: `components/Board/VotePill.tsx` (min-h-11 hit area on mobile)

- [ ] **Step 1: Add a `touch` size to `IconButton`**

Extend `IconButtonSize` to `'sm' | 'md' | 'lg' | 'touch'` and add to `sizeStyles`:

```ts
  touch: 'min-w-11 min-h-11 rounded-[var(--r-md)]',
```

- [ ] **Step 2: Use 44px hit areas on the card action row (mobile)**

In `RetroCard.tsx`, the author/non-author action `<IconButton size="sm">` controls: on mobile they should be `size="touch"`. Since size is a prop (not responsive), use `size="touch"` with inner `sm:w-7 sm:h-7` overrides via `className`, OR (simpler) keep `size="sm"` on desktop and render the mobile path with `size="touch"`. Implement by passing `className="min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:w-7 sm:h-7"` to each card-action `IconButton`. Increase the row gap from `gap-0.5` to `gap-1.5` on mobile (`gap-1.5 sm:gap-0.5`).

- [ ] **Step 3: Emoji reaction palette as a ≥44px grid**

In the emoji picker popover (`RetroCard.tsx` ~line 308-326), change the flex row to `grid grid-cols-4 gap-1` and each emoji button to `min-w-11 min-h-11 grid place-items-center text-lg` on mobile.

- [ ] **Step 4: Resting merge-target affordance (rank 11)**

The merge-target ring/fill is hover-gated (`RetroCard.tsx:145`). Make it resting on touch: change `isMergeTarget && 'cursor-pointer ring-2 ring-dashed ring-[var(--accent)]/50 hover:ring-[var(--accent)] hover:bg-[var(--accent-soft)]'` so the strong ring + `--accent-soft` fill apply unconditionally below `md` (e.g. add `isMergeTarget && 'ring-[var(--accent)] bg-[var(--accent-soft)] sm:ring-[var(--accent)]/50 sm:bg-transparent'`).

- [ ] **Step 5: VotePill 44px hit area on mobile**

In `VotePill.tsx`, the interactive vote button and voted-badge button: add `min-h-11 sm:min-h-0` and increase tap padding on mobile (`py-2 sm:py-1`). Keep the glyph/text sizes.

- [ ] **Step 6: Browser verify**

Card edit/delete/merge/color, vote pill, and each emoji are all ≥44px and comfortably tappable; delete not flush against edit; merge-target cards visibly highlight on tap-to-start-merge.

- [ ] **Step 7: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add components/common/IconButton.tsx components/Board/RetroCard.tsx components/Board/VotePill.tsx
git commit -m "fix(mobile): 44px touch targets for card actions, votes, emoji; resting merge-target affordance"
```

---

### Task 9: Participant management on mobile via shared `ParticipantList` (rank 7)

**Files:**
- Create: `components/Board/ParticipantList.tsx`
- Modify: `components/Board/ParticipantPopover.tsx` (consume the shared list)
- Modify: `components/Board/MobileMoreSheet.tsx` (render the list + accept new props)
- Modify: `components/Board/MobileBoardShell.tsx` (thread props through)
- Modify: `components/pages/BoardPage.tsx` (pass handlers/ids into the shell)

**Interfaces:**
- Produces: `ParticipantList({ participants, onlineParticipantIds, currentParticipantId, isAdmin, boardCreatorId, onPromote, onDemote, onRemove })` — the `<ul>` list body (sort online-first, avatar, online dot, facilitator tag, admin promote/demote/remove with 44px buttons). Extracted verbatim from `ParticipantPopover`'s current list (single source of truth).
- `MobileMoreSheetProps` gains `onlineParticipantIds`, `currentParticipantId`, `boardCreatorId`, `onPromoteParticipant`, `onDemoteParticipant`, `onRemoveParticipant`.

- [ ] **Step 1: Extract `ParticipantList.tsx`** — move the sort + `<ul>...</ul>` (lines 44-139 of `ParticipantPopover.tsx`) into the new component with the props above; admin action buttons get `min-w-11 min-h-11` hit areas.

- [ ] **Step 2: Consume it in `ParticipantPopover.tsx`** — replace the inline list with `<ParticipantList ... />`, passing through its existing props. Desktop behavior unchanged.

- [ ] **Step 3: Render it in `MobileMoreSheet.tsx`** — replace the read-only comma-joined names (lines 88-97) with `<ParticipantList ... />` fed by the new props. Keep the `Users` count header.

- [ ] **Step 4: Thread props** — add the new fields to `MobileBoardShellProps`, pass them down to `MobileMoreSheet`; in `BoardPage.tsx` pass `onlineParticipantIds`, `currentParticipantId`, `board.created_by`, and the same `updateParticipant`/`removeParticipant` handlers already used by the desktop `ParticipantPopover` (lines 383-392).

- [ ] **Step 5: Browser verify** — On mobile More sheet: online dots correct; as admin, promote/demote/remove work and update live; non-admin sees read-only list; can't act on self or creator.

- [ ] **Step 6: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add components/Board/ParticipantList.tsx components/Board/ParticipantPopover.tsx components/Board/MobileMoreSheet.tsx components/Board/MobileBoardShell.tsx components/pages/BoardPage.tsx
git commit -m "feat(mobile): participant management in More sheet via shared ParticipantList"
```

---

### Task 10: Stacked facilitator controls + de-dupe (rank 10)

**Files:**
- Modify: `components/Board/FacilitatorToolbar.tsx` (add a `layout` variant)
- Modify: `components/Board/MobileMoreSheet.tsx` (use stacked variant; drop duplicate Complete Retro + redundant Actions)

**Interfaces:**
- `FacilitatorToolbarProps` gains `layout?: 'inline' | 'stacked'` (default `'inline'`). In `'stacked'`: full-width rows, icon + always-visible label + state; omits the internal Complete Retro button and the Actions button (those are owned by the More sheet's dedicated controls / bottom nav).

- [ ] **Step 1: Add the `stacked` variant** — when `layout==='stacked'`, render each control as a full-width labeled row (`w-full justify-start`, label not `hidden`), and skip the Actions `ToolbarButton` + the Complete Retro `<button>` (guard those two with `layout==='inline'`).

- [ ] **Step 2: Update `MobileMoreSheet.tsx`** — pass `layout="stacked"`; remove the standalone duplicate "Complete retro" button (lines 119-129) only if FacilitatorToolbar still renders one in stacked mode — since stacked omits its own, KEEP the single explicit Complete Retro button in the More sheet (the labeled full-width one), switch it to `bg-[var(--accent)] text-[var(--on-accent)]`. Net: exactly one Complete Retro, no Actions inside the toolbar.

- [ ] **Step 3: Browser verify** — More sheet facilitator section shows labeled full-width rows; exactly one Complete Retro; no Actions button inside the toolbar (Actions lives in the bottom nav).

- [ ] **Step 4: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add components/Board/FacilitatorToolbar.tsx components/Board/MobileMoreSheet.tsx
git commit -m "fix(mobile): stacked labeled facilitator controls; de-dupe Complete Retro + Actions"
```

---

## Phase 2: P2 — polish & decisions

### Task 11: z-scale + mobile timer relocation (rank 14)

**Files:**
- Modify: `components/Timer/TimerFloating.tsx`
- Verify z-classes set in Tasks 2/4 (nav z-30, FAB z-40, sheets z-50).

- [ ] **Step 1: Relocate + lower the mobile timer** — in `TimerFloating.tsx:95,127`, change `fixed bottom-6 right-6 z-50 max-md:bottom-28` to keep desktop bottom-right but on mobile move to bottom-left and below sheets: `max-md:left-6 max-md:right-auto max-md:bottom-[calc(84px+var(--safe-bottom))] max-md:z-30`. (Below the FAB corner, above the nav, beneath sheets.)

- [ ] **Step 2: Browser verify** — timer doesn't collide with FAB; sits below open sheets.

- [ ] **Step 3: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add components/Timer/TimerFloating.tsx
git commit -m "fix(mobile): timer to bottom-left, below sheets; explicit z-scale (nav<FAB<sheets)"
```

---

### Task 12: Polish — nav press feedback, badge number, vote dots, empty states (rank 15)

**Files:**
- Modify: `components/Board/MobileBottomNav.tsx` (press state; badge = open-count number)
- Modify: `components/Board/MobileBoardShell.tsx` (feed badge the OPEN count; richer empty state)
- Modify: `components/Board/MobileVoteTracker.tsx` (progress bar above 10)

- [ ] **Step 1: Nav press feedback** — add `active:bg-[var(--surface-muted)] active:scale-95` to the nav buttons.

- [ ] **Step 2: Badge = open-count number** — change `actionBadgeCount` to the count of OPEN action items (`actionItems.filter(i => i.status !== 'done').length`) computed in `MobileBoardShell`, and render it as a small numeric pill in `MobileBottomNav` (replace the presence dot at lines 52-58 with a number when `> 0`).

- [ ] **Step 3: Vote tracker above 10** — in `MobileVoteTracker.tsx`, when `total > 10` render a thin progress bar (`used/total`) instead of dots so the dots never disagree with the numeric label.

- [ ] **Step 4: Richer empty / not-joined states** — in `MobileBoardShell.tsx` empty-column block (lines 245-249), add an icon + a real "Add a card" affordance, and only show "tap +" when the FAB is actually rendered (`!cardCreationDisabled && !isCompleted && currentParticipantId`). In `BoardPage.tsx:331-333` not-joined state, don't reference the absent FAB.

- [ ] **Step 5: Browser verify** — taps feel responsive; Actions badge shows the open count as a number; >10 votes shows a bar that matches the label; empty/not-joined states read intentionally.

- [ ] **Step 6: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add components/Board/MobileBottomNav.tsx components/Board/MobileBoardShell.tsx components/Board/MobileVoteTracker.tsx
git commit -m "polish(mobile): nav press feedback, numeric Actions badge, vote progress bar, richer empty states"
```

---

### Task 13: Minimal PWA + document parity decisions

**Files:**
- Create: `app/manifest.ts` (Next metadata route)
- Modify: `app/layout.tsx` (appleWebApp status bar via `metadata`)
- Modify: `docs/superpowers/specs/2026-06-17-mobile-ux-overhaul-design.md` (record final decisions)

- [ ] **Step 1: Add `app/manifest.ts`**

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RetroBoard',
    short_name: 'RetroBoard',
    description: 'Real-time retrospective board for team collaboration',
    start_url: '/',
    display: 'standalone',
    background_color: '#15161b',
    theme_color: '#15161b',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
```

- [ ] **Step 2: Add appleWebApp to `metadata` in `app/layout.tsx`**

```tsx
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'RetroBoard' },
```

(No service worker — explicitly out of scope.)

- [ ] **Step 3: Record decisions** — append a "Final decisions" note to the design spec: board views (swimlane/list/timeline) remain desktop-only by design; Add Column remains a desktop facilitator action (not surfaced on mobile this pass); PWA is install-only, no offline.

- [ ] **Step 4: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add app/manifest.ts app/layout.tsx docs/superpowers/specs/2026-06-17-mobile-ux-overhaul-design.md
git commit -m "feat(mobile): minimal PWA manifest + apple-web-app meta; document parity decisions"
```

---

## Final verification (before PR / merge to develop)

- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — clean, all routes compile
- [ ] `npx vitest run` — all green (incl. `mobileNav`)
- [ ] Browser checklist at 390×844 (responsive): scroll isolation; FAB never overlaps nav; honest nav active state + Board-dismisses-sheet; sheet focus-trap/Escape/Back/restore for all three sheets; no iOS input zoom; composer above keyboard; all controls ≥44px; Actions sheet token/contrast correct; participant mgmt works; timer placement; safe-area clearance.
- [ ] At least one physical iOS Safari pass for: dynamic-toolbar scroll, keyboard inset, safe-area insets, momentum/overscroll.
- [ ] `/deploy-check` then push `feature/mobile-ux-overhaul` → open PR to `develop`.

## Self-review notes (coverage)

All 15 ranked audit issues are covered: rank 1→T2, 2→T3, 3→T4-T7, 4→T8, 5→T7, 6→T1, 7→T9, 8→T6, 9→T2(overscroll)+T4(sheets), 10→T10, 11→T7+T8, 12→T7, 13→T2, 14→T11, 15→T12. PWA + parity decisions → T13.
