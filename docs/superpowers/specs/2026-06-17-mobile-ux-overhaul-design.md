# Mobile UX Overhaul — Board View

- **Date:** 2026-06-17
- **Status:** Draft for review
- **Author:** Jordan Lawson (with Claude)
- **Scope:** Everything (P0 + P1 + P2) — all 15 ranked issues from the audit
- **Source audit:** 5-lens multi-agent audit, 48 adversarially-verified findings (run `wf_94a53942-eb8`)

---

## 1. Context & goals

The mobile board view (rendered below 768px via the `md:hidden` branch in `BoardPage.tsx`) is functionally usable but undermined by two structural defects the user reported, plus a long tail of touch-target, accessibility, parity, and polish gaps.

**The two reported bugs share root causes:**

1. **"None of the bottom options change anything."** `MobileBoardShell.tsx:260` hardcodes `active="board"`, so the nav highlight never moves, and tapping **Board** is a literal no-op. The sheet-open state (`moreOpen` local to the shell; `showActionItems` up in `BoardPage`) is never reflected back into the nav.
2. **"When you scroll, the bottom sections go over the + button."** The shell is `min-h-dvh` (a *minimum*, not a fixed height) with no bounded-height ancestor, so the **whole document scrolls** instead of the inner card list. The `fixed` FAB (`bottom-[84px]`) and `sticky` bottom nav then anchor to different references and drift apart as iOS Safari's toolbar collapses.

**Goals:** Fix both bugs at the root; bring the mobile board to a genuinely good standard (a11y, touch ergonomics, iOS-Safari correctness, visual consistency, feature parity with desktop where it matters); ship it through `develop` → `main` with real mobile-viewport verification.

**Non-goals:** Redesigning the desktop board; changing data model, realtime, or board business logic; offline/service-worker PWA.

---

## 2. Decided constraints (do not re-litigate)

- **Honest-toolbar nav model** (chosen by Jordan): **Board** is the always-present base view and stays lit only when nothing is open; **Actions** and **More** are sheet-openers that light *their* icon while their sheet is open; tapping **Board** dismisses any open sheet. No fake/dead active state, no real "tab views."
- **Mobile stays a single-column-per-tab layout.** No swimlane/list/timeline view switcher on mobile (see §9 Decisions).

---

## 3. Architecture decisions

### 3.1 Bounded scroll container — scoped to mobile, not global (root fix for bug #2)

The audit recommended `html, body { height: 100%; overflow: hidden }`. **We will NOT do that** — `BoardPage` renders the desktop shell on the same route (`hidden md:block`), and every other route (dashboard, settings, admin, marketing) relies on normal document scroll. A global body lock would break all of them.

**Instead, bound the height at the mobile wrapper:**

- `BoardPage` mobile wrapper: `md:hidden h-[100dvh] overflow-hidden` (currently a bare `<div className="md:hidden">` with no height).
- `MobileBoardShell` root: `relative flex flex-col h-full overflow-hidden` (was `flex flex-col min-h-dvh`).
- Header chrome — `ConnectionStatusBanner`, `MobileVoteTracker`, `MobileColumnTabs`, merge banner, sort row — each `shrink-0`.
- Card list: `flex-1 min-h-0 overflow-y-auto overscroll-contain` (the missing **`min-h-0`** is what lets a flex child actually shrink-and-scroll).
- Bottom nav: last `shrink-0` flex child — **drop `sticky bottom-0`** (it's pinned by being the last child of a full-height column).
- FAB: `absolute` within the now-`relative` shell (was `fixed`), so it shares the shell's bounded box and can't desync from the nav.

Because the mobile wrapper is exactly `100dvh` and `overflow-hidden`, and its desktop sibling is `display:none` on mobile, the document body has no overflow → **the page itself never scrolls; only the card list does.** This also inherently kills pull-to-refresh-reload of a live retro without a global lock.

`100dvh` (dynamic viewport) handles Safari's collapsing toolbar; fine-tuning is a browser-verification item, not a code unknown.

### 3.2 Honest toolbar (root fix for bug #1)

- Thread `actionsOpen` (the existing `showActionItems` boolean) and `onCloseActionItems` from `BoardPage` into `MobileBoardShell`.
- Extract a **pure function** `computeMobileNavActive({ moreOpen, actionsOpen }): MobileNavKey` → `'more' | 'actions' | 'board'` (precedence: more > actions > board). Unit-tested.
- `onSelect('board')` closes both sheets (`setMoreOpen(false); onCloseActionItems()`).
- `MobileBottomNav` already derives accent + `aria-current` from `active`; just feed it the computed value.

### 3.3 Shared bottom-sheet primitive (rank 3)

Create one primitive — `components/common/Sheet.tsx` (`MobileSheet`) — and refactor `MobileMoreSheet`, `MobileCardComposerSheet`, and the mobile presentation of `ActionItemsPanel` onto it. Responsibilities:

- `role="dialog"`, `aria-modal="true"`, labelled by its heading.
- On open: move focus to the heading/first control. **Focus trap** on Tab. **Escape** from anywhere closes. On close: restore focus to the trigger.
- **Android Back / gesture:** push a history entry on open, listen for `popstate` to close (so Back dismisses the sheet instead of leaving the board).
- When closed: **unmount** (or `inert` + `aria-hidden`) so its controls leave the tab/AT order. (`ActionItemsPanel` currently stays mounted with `translate-y-full`, leaving its inputs focusable behind the board.)
- Slide-up enter/leave transition + backdrop fade (≈300ms, matching the current `ActionItemsPanel`), `overscroll-contain` on the scroll body, `pb` includes `--safe-bottom`.
- Respects `prefers-reduced-motion`.

Trap/dismiss logic lives in small hooks (`useFocusTrap`, `useDismissable`) co-located with the primitive.

### 3.4 Safe-area + viewport (rank 6)

- Add to `app/layout.tsx`: `export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [...] }`. Note: `themeColor` needs a **literal hex** (CSS custom props don't resolve here) — read the resolved `--bg` value(s) from `styles/index.css` and inline them, optionally split by `prefers-color-scheme`. **Do not** disable user scaling (a11y).
- Declare once in `styles/index.css`: `--safe-bottom: env(safe-area-inset-bottom)` (and `--safe-top` if needed). Single source of truth.
- Apply `calc(... + var(--safe-bottom))` to: nav bottom pad, FAB offset, both bottom-anchored sheets, and the card-list bottom spacer.

### 3.5 Touch-target standard (rank 4)

Standard: **44×44px** minimum hit area on the mobile path, glyph stays compact via inner padding.

- `IconButton` (`components/common/IconButton.tsx`, currently used `size="sm"` = ~28px in `RetroCard`): add a `touch` size (or `hitArea` prop) yielding `min-w-11 min-h-11`; use it for card edit/delete/merge/color on mobile, with ≥8px gaps and delete not immediately adjacent to edit.
- `VotePill` (primary mobile action, ~24px): `min-h-11` hit area on mobile.
- Emoji reaction palette (`RetroCard`): render as a grid of ≥44px buttons.
- Sheet/overlay close buttons (`MobileCardComposerSheet`, `MobileMoreSheet`, `TimerFloating`): 44px hit area (folds into the Sheet primitive's header).

### 3.6 Token & contrast consistency (rank 5, 12)

`ActionItemsPanel` + `ActionItemRow` use the legacy `--color-*` palette while the rest of mobile uses `--ink/--surface/--line/--accent`. Re-skin onto the current tokens: `--line` borders, `--surface` backgrounds, `--ink-3` secondary metadata (≈7.3:1, passes AA), `--ink-2` editable/delete glyphs, `--accent`/`--on-accent` add button (matches FAB + composer). Bump the select/date/edit inputs to **16px on mobile** (`text-[16px] md:text-xs`) to stop iOS focus auto-zoom.

### 3.7 z-scale (rank 14) — single source of truth

Define an explicit mobile stacking order (CSS vars or a documented constant): **nav z-30 < FAB z-40 < sheets/overlays z-50+**. Today FAB and nav are both `z-20` in one stacking context, so paint order decides and the FAB shadow is clipped. Move the floating timer (`TimerFloating`, `fixed ... z-50 max-md:bottom-28`) off the FAB corner on mobile and below sheet overlays (or hide it while a sheet is open).

### 3.8 Single-source-of-truth extractions (Quality Gate)

- **Participant list** (rank 7): extract the interactive list rendering from `ParticipantPopover` into a shared `ParticipantList` consumed by both the desktop popover and the mobile More sheet — don't fork the promote/demote/remove + online-dot logic. (`ParticipantPopover` already accepts `onlineParticipantIds`, `onPromote/onDemote/onRemove`, `boardCreatorId`, `currentParticipantId`; mobile is mostly *surfacing*, not new logic.)
- `--safe-bottom`, the z-scale, and `computeMobileNavActive` each declared once and imported.

---

## 4. Change map (rank → files → change)

| # | Sev/Effort | Change | Primary files |
|---|---|---|---|
| 1 | high/M | Bounded `h-[100dvh]` mobile wrapper + `h-full overflow-hidden` shell; card list `flex-1 min-h-0 overflow-y-auto overscroll-contain`; chrome+nav `shrink-0`; nav loses `sticky`; FAB `absolute` | `BoardPage.tsx`, `MobileBoardShell.tsx`, `MobileBottomNav.tsx`, `MobileFAB.tsx` |
| 2 | high/S | Honest toolbar: thread `actionsOpen`+`onCloseActionItems`; `computeMobileNavActive`; Board dismisses sheets | `BoardPage.tsx`, `MobileBoardShell.tsx`, `lib/mobileNav.ts` (+ test) |
| 6 | med/S | `viewport` export + `viewport-fit=cover` + `themeColor`; `--safe-bottom` token; apply to nav/FAB/sheets/spacer | `app/layout.tsx`, `styles/index.css`, mobile components |
| 9 | med/S | `overscroll-contain` on card list + sheet scrollers (body lock unnecessary per §3.1) | `MobileBoardShell.tsx`, Sheet primitive |
| 13 | low/S | Replace `pb-[136px]` with a `calc()` that clears only the FAB (≈ FAB height + gaps + `var(--safe-bottom)`; exact value tuned in browser) — the nav is now a flex child, not an overlay | `MobileBoardShell.tsx` |
| 3 | high/L | Shared `MobileSheet` primitive (focus trap/Escape/restore, Android-back, aria-modal, inert-when-closed, transition); refactor 3 sheets onto it | `components/common/Sheet.tsx` (new), `MobileMoreSheet.tsx`, `MobileCardComposerSheet.tsx`, `ActionItemsPanel.tsx` |
| 4 | high/M | 44px hit areas: IconButton `touch` size, VotePill `min-h-11`, emoji grid, close buttons | `IconButton.tsx`, `RetroCard.tsx`, `VotePill.tsx` |
| 5 | high/M | Re-skin Actions sheet onto current tokens; fix dark-mode contrast | `ActionItemsPanel.tsx`, `ActionItemRow.tsx` |
| 7 | high/M | Surface participant mgmt on mobile via shared `ParticipantList` | `ParticipantList.tsx` (new), `ParticipantPopover.tsx`, `MobileMoreSheet.tsx`, `MobileBoardShell.tsx`, `BoardPage.tsx` |
| 8 | med/M | Card composer above iOS keyboard (VisualViewport inset) | `MobileCardComposerSheet.tsx`, `hooks/useVisualViewportInset.ts` (new) |
| 10 | med/M | Facilitator controls as labeled stacked rows; remove duplicate Complete Retro + redundant Actions in More | `FacilitatorToolbar.tsx`, `MobileMoreSheet.tsx` |
| 11 | med/S | Drop hover gate on merge-target + action-item delete below md (resting touch affordance) | `RetroCard.tsx`, `ActionItemRow.tsx` |
| 12 | med/S | 16px Action-item select/date/edit inputs on mobile | `ActionItemRow.tsx` |
| 14 | low/S | Explicit z-scale; relocate/hide mobile timer | `MobileBottomNav.tsx`, `MobileFAB.tsx`, `ActionItemsPanel.tsx`, `TimerFloating.tsx` |
| 15 | low/M | `-webkit-tap-highlight-color: transparent`; nav/FAB press states; More/Composer slide-up; Actions badge = open count number; vote dots → bar above 10; richer empty/not-joined states | `styles/index.css`, `MobileBottomNav.tsx`, `MobileFAB.tsx`, `MobileVoteTracker.tsx`, `MobileBoardShell.tsx` |

---

## 5. Data-flow changes

New props threaded `BoardPage → MobileBoardShell → MobileMoreSheet`:

- `actionsOpen: boolean` (= `showActionItems`), `onCloseActionItems: () => void` — honest toolbar (rank 2).
- `onlineParticipantIds: string[]`, `onUpdateParticipant`, `onRemoveParticipant`, `boardCreatorId: string` — participant mgmt (rank 7). (`currentParticipantId` already passed.)

No new store fields, no new API calls — same data the desktop path already derives.

---

## 6. New / refactored files

- `lib/mobileNav.ts` + `lib/__tests__/mobileNav.test.ts` — `computeMobileNavActive` (pure, tested).
- `components/common/Sheet.tsx` — `MobileSheet` primitive + `useFocusTrap` / `useDismissable`.
- `components/Board/ParticipantList.tsx` — shared interactive participant list.
- `hooks/useVisualViewportInset.ts` — keyboard-aware bottom inset.
- Token additions in `styles/index.css` (`--safe-bottom`, z-scale, tap-highlight reset).

---

## 7. Testing strategy (honest about what's testable)

Current harness: **node-only vitest** (`lib/**/*.test.ts`, `app/**/*.test.ts`), no jsdom/testing-library, no Playwright. Per Jordan's UI-feature-verify gate, "tests pass + types pass" does **not** verify a UI feature.

- **Unit-testable now (node vitest, TDD — write test first):** `computeMobileNavActive` precedence; the bottom-spacer/FAB-offset calc helper; Actions-badge open-count logic; vote-dot vs numeric-label reconciliation (>10); any extracted contrast/token mapping helper. Extract logic into `lib/` specifically so it *is* testable.
- **Not unit-testable in this harness (browser-verified):** the bounded scroll container, safe-area insets, 44px hit areas, focus traps/Escape/Android-back, VisualViewport keyboard handling, transitions, z-scale, contrast. These are verified via the `ui-feature-verify` skill against a **real mobile viewport** (responsive devtools at 390×844 + at least one physical iOS Safari pass for the toolbar/keyboard/safe-area behaviors), with before/after screenshots.
- **Gate before "done":** `npx tsc --noEmit` + `npm run build` + `vitest run` all green **and** the browser checklist (below) observed. No "done" claim on tsc/build alone.
- **Optional (not required this pass):** add `jsdom` + `@testing-library/react` to test the honest-toolbar state machine and sheet focus behavior as component tests. Flagged, not committed — avoid scope creep unless the state machine proves fragile.

**Browser verification checklist:** scroll a long column → only the list scrolls, chrome stays put, FAB stays put above the nav, nothing overlaps the home indicator; tap Actions/More → correct icon lights, Board un-lights; tap Board with a sheet open → sheet closes, Board lights; open each sheet → focus moves in, Tab is trapped, Escape + Android Back close, focus returns; focus a card-edit/action-item input → no iOS auto-zoom, composer stays above the keyboard; all primary controls ≥44px.

---

## 8. Phasing

- **P0 (one shell pass):** ranks 1, 2, 6, 9, 13 — fixes both reported bugs + their coupled siblings.
- **P1:** ranks 3, 4, 5, 7, 8, 10, 11, 12 — a11y, touch, parity, contrast.
- **P2:** ranks 14, 15 + decisions (§9).

Each phase is independently shippable and browser-verifiable. P0 could ship to `main` alone if needed; P1/P2 follow.

---

## 9. Decisions made (Jordan can veto on review)

- **Body-scroll lock:** scoped to the mobile wrapper, NOT global `html,body` (protects desktop board + all other routes). Deviates from the audit's literal recommendation; safer.
- **Board views on mobile (swimlane/list/timeline):** **grid/column-tab only on mobile**, documented — not a regression. These views target wide screens; the column-tab layout *is* the mobile view. No mobile view switcher.
- **Add Column on mobile:** surface a minimal admin "Add column" action in the More sheet **only if** the handler threads cleanly; otherwise document as desktop-only facilitator action. Low priority.
- **PWA:** minimal `manifest.json` + `themeColor` + `appleWebApp` status-bar style for Add-to-Home-Screen polish. **No service worker / no offline** (over-engineering for now).

---

## 10. Out of scope

Desktop board changes; data model / realtime / auth changes; offline support; native apps; rewriting `boardStore`; the prod 4-tab nav (already superseded on `develop`).

---

## 11. Risks & rollout

- **iOS `100dvh` + dynamic toolbar** is the highest-risk area — must be physically verified on iOS Safari, not just devtools.
- **Sheet refactor (rank 3)** touches 3 consumers; refactor onto the primitive one at a time, verifying each.
- **Re-skin (rank 5)** is token-only — low risk, high consistency payoff.
- Rollout: feature branch → `develop` (preview) → browser-verify on a phone → `main`. Pre-push gate: `npx tsc --noEmit && npm run build && vitest run` + `/deploy-check`.
