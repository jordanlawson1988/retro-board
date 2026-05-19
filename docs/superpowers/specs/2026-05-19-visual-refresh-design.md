# Visual Refresh — "Quiet Modern" — Design Spec

**Date:** 2026-05-19
**Status:** Brainstorm complete, awaiting written-spec sign-off
**Source design:** `design_handoff_visual_refresh/` (Claude Design handoff, 8 artboards + tokens + per-screen JSX references)
**Implementation branch:** `feature/visual-refresh`
**Target deploy:** `develop` (preview) → `main` (prod) per repo branch flow

---

## 1. Goal

A high-fidelity visual + UX refresh of RetroBoard to a calmer, more modern aesthetic ("Quiet Modern"), without degrading existing product capability or runtime performance.

Same-or-better is the contract. Pure visual changes are unambiguously safe. Enhancements that change interaction patterns (e.g. the new mobile snap-tab column navigation) are acceptable because they preserve every capability and are a UX upgrade, not a regression.

## 2. Non-goals

- No changes to component tree, routes, data model, real-time wiring (Ably channels, presence, polling), middleware, BetterAuth, API contracts, or store shapes.
- No new features. No removed features. No data migrations.
- No tests are added (consistent with repo convention: "No tests" per `CLAUDE.md`).

## 3. Source of truth

`design_handoff_visual_refresh/README.md` is canonical for visual specifications. This spec records strategy, sequencing, deviations, and verification — not the design itself. Where this spec and the handoff disagree, deviations are called out explicitly in §11.

## 4. Approach

### 4.1 Token migration strategy — **Hybrid**

Replace tokens in `styles/index.css` with the new OKLCH set AND retain a compatibility shim that re-points the existing `--color-*` names to the new tokens. Update Tailwind v4 `@theme {}` to reference the new tokens via `var(--…)` so utilities like `bg-warm-white` automatically track the new palette. Components in the handoff change-list migrate to the cleaner `--ink`/`--bg`/`--accent` names as they are rewritten anyway; everything else continues to work through the shim with zero file edits.

Why hybrid: smallest diff per PR, no big-bang risk, paradigm converges toward the cleaner naming over the course of the refresh, shim can be deleted in a follow-up cleanup or left in place (cheap).

### 4.2 Typography — `next/font/google`

Geist and Geist Mono load via `next/font/google` (built into Next.js — no new dependency). This avoids the extra DNS lookup to `fonts.googleapis.com` that the handoff's `@import` example would incur, gives a `display: swap` fallback to `ui-sans-serif`, and keeps font CSS self-hosted from Vercel's edge.

### 4.3 Theme picker — preserve 3-state behavior

Handoff says the topbar shows only a sun/moon toggle and moves "system" mode under `/settings`. RetroBoard's current `ThemeToggle` is already a single icon button that cycles `system → light → dark` — visually identical to the handoff's single-icon-button requirement, while preserving the `system` capability without needing a new settings UI. Kept as-is; restyled to `rb-icon-btn` size and tokens.

## 5. Phased PR plan

Five PRs on `feature/visual-refresh`, each deployed to a Vercel preview, each verified via ui-feature-verify before merge.

### PR 1 — Foundation (low risk)

| File | Change |
|---|---|
| `styles/index.css` | Replace `:root` + `[data-theme="dark"]` blocks with new OKLCH tokens. Add type scale (`--t-display/h1/h2/h3/body/sm/xs`) and radius scale (`--r-xs..2xl`, `--r-pill`). Update Tailwind `@theme {}` to map utilities to new tokens. Add compat shim re-pointing `--color-*` → new tokens. Global `:focus-visible` ring, `.mono`/`.tnum` helpers, body font + letter-spacing. |
| `app/layout.tsx` | Import Geist + Geist Mono via `next/font/google`; expose as `--font-sans`, `--font-mono`; apply font className to `<html>`. |

### PR 2 — Primitives (low-med risk)

| File | Change |
|---|---|
| `components/common/Button.tsx` | Rewrite to variants `default/primary/accent/ghost` × sizes `sm/md/lg` per handoff §Component-level changes. Migrate call sites: existing `primary` (crimson) → `accent`; existing `secondary` (navy) → `primary` (ink-fill); `danger` retained, restyled with `--danger`. Loading spinner preserved. |
| `components/common/Pill.tsx` *(new)* | Display badge: `--surface-muted` bg, 1px `--line` border, 11px, pill radius. `tinted` variant uses `--accent-soft` + `--accent` (no border). `bare` variant: no bg/border. |
| `components/common/Chip.tsx` *(new)* | Interactive filter: `--bg-elev` resting, hover lifts border to `--line-strong`, active = `--ink` bg + `--bg-elev` text. |
| `components/common/IconButton.tsx` *(new)* | 32×32 ghost icon button matching `rb-icon-btn`; optional `lg` 40×40. |
| `components/common/Badge.tsx` | Thin wrapper around `Pill` — preserves call sites. |
| `components/common/index.ts` | Export new primitives. |

A temporary `app/__refresh-primitives/page.tsx` route renders every variant of every primitive for visual regression review. **Removed before merge.**

### PR 3 — Board surface (medium risk — biggest surface area)

| File | Change |
|---|---|
| `components/Board/RetroCard.tsx` | Drop colored-fill mode. Render `card.color` as 3px left border instead of background. Combined-card parent: 3px `--accent` left border + "merged · +N" `tinted` Pill next to author. Remove `getCardTextColor` — text always `--ink`. New vote pill: 28px height, mono, `--surface-muted` resting, `--accent-soft` + accent text when voted. Reactions: pill chips, `--surface-muted` resting, `--accent-soft` when current user reacted. Hover row (Edit/Color/Trash) uses new `IconButton`. Hover lifts shadow only — no card transform. |
| `components/Board/BoardColumn.tsx` | Container: `--r-2xl`, `--bg-elev`, 1px `--line`. 3px top stripe in column tint at 0.85 opacity. 8×8 tint dot next to title. Title 15px/600. Description 13px `--ink-4`, no separator. Mono count + vote-total in `--ink-4`. Admin actions (Color/Delete) move into header overflow menu (More icon → ghost menu). |
| `components/Board/AddCardForm.tsx` | Becomes the dashed-border ghost row at top of column body; expands to real input on focus. |
| `components/Board/ViewToggle.tsx` | Tray-with-pill pattern: tray 3px padding, 10px radius, `--surface-muted` bg, `--line` border. Active option: `--bg-elev`, `--ink`, `--shadow-xs`. |
| `components/Board/FacilitatorToolbar.tsx` | Ghost icon buttons + text labels at `sm` size. Order: `Timer · Hide cards · Settings · │ · Complete retro (accent)`. The `│` is a 1px × 22px `--line` divider. |
| `components/Board/ConnectionStatusBanner.tsx` | Token swap only. |
| `components/Board/ParticipantPopover.tsx` | Token swap + per-user hue avatar. |
| `components/Board/CardColorPicker.tsx` | Swatch palette updated to new tints (rose/amber/emerald/sky/violet ± soft variants) so picker matches column tints. |
| `app/board/[boardId]/page.tsx` | Background `--bg-sunken`. dnd-kit combine drop overlay → `--accent-soft` + dashed `--accent` border (replaces navy). |

### PR 4 — Shell + marketing (medium risk)

| File | Change |
|---|---|
| `components/Layout/Header.tsx` | Topbar 60px height with `border-bottom: 1px solid var(--line)` and `backdrop-filter: blur(8px)` over `color-mix(in oklab, var(--bg) 90%, transparent)`. CSS-rendered logo mark (28×28 `--ink` square + mono "R" + 6×6 `--accent` dot bottom-right) replaces current SVG. Wordmark 16px/600. Avatar 32px circle with per-user hue (see §10.6). Sign-in is `default` Button. Dropdown contents unchanged. |
| `components/Layout/ThemeToggle.tsx` | Keep 3-state cycle (`system → light → dark`); re-style as `rb-icon-btn` 32×32. |
| `components/Layout/AppShell.tsx` | Token swap. |
| `app/page.tsx` (Home) | Hero: badge `Pill` ("Real-time, no install, ready in 5 seconds") + 48px+ display headline with accent word ("finishes") in `--accent`. Two side-by-side CTA tiles: "Start a new retro" (with ⌘N kbd hint) and "Join with a code" (with 5-digit code preview). 4-up feature row below (icon + label + 1-line description). Create modal: title input + 2×2 template grid with tint-stripe row at top of each template button. |
| `app/dashboard/page.tsx` | "Welcome back, <first name>" + H1. 4-up stat strip cards (Active boards / Action items / Cards shared / Votes cast) — "Active" number in `--accent`, others in `--ink`. Filter tray (`all / active / completed`) using `Chip`s in the ViewToggle pattern. 3-column board grid: each card has 6px-tall row of tint stripes representing columns, title (15px/600) + 12px caption "Description · Template", mono counts row, "X ago" timestamp right. |
| `utils/templates.ts` | Update template column colors to new tint palette: Mad/Sad/Glad → rose/sky/emerald; Liked/Learned/Lacked → emerald/sky/amber; Start/Stop/Continue → emerald/rose/sky; Went Well/Didn't/… → emerald/rose/violet; Custom → sky/emerald/rose. Persist resolved hex (sRGB equivalents in handoff README). Existing boards keep stored values. |
| `components/common/Modal.tsx` | `--shadow-pop`, `--r-2xl`, 24px padding, ink-tinted backdrop with backdrop-blur. |
| `components/common/Input.tsx`, `Textarea.tsx` | `--surface` bg, 1px `--line` border, `--ink` text, `--ink-4` placeholder. Focus: `border-color: var(--accent)` + `box-shadow: 0 0 0 3px var(--accent-soft)`. |
| `app/login/*`, `app/signup/*` | Token swap; CTAs updated. |

### PR 5 — Mobile + polish (medium-high risk)

| File | Change |
|---|---|
| `app/board/[boardId]/page.tsx` (mobile branch) | Below 768px breakpoint, render mobile shell instead of horizontal-scroll columns. Same store, same hooks, same data flow. |
| `components/Board/MobileBoardShell.tsx` *(new)* | Top app bar (44px iOS status spacer + 56px nav row). Vote tracker row (small accent-soft circle with vote icon, "Your votes / N of 5 used", 5 dots right). Column tabs as scroll-snap pill chips with column tint dot — active tab uses column's tint as background, white text. Single-column vertically-stacked view of the active column's cards. |
| `components/Board/MobileFAB.tsx` *(new)* | 52px accent circle bottom-right (above bottom nav). Opens bottom-sheet composer (full-width sheet, top drag handle, 16px text field, share button). |
| `components/Board/MobileBottomNav.tsx` *(new)* | 4 items 64×52: Board · Votes · Actions · More. 20px icon + 10px label. Active item uses `--accent`. Action-items badge sits top-right of icon as small accent dot. Persistent. |
| `components/Timer/TimerFloating.tsx` | Floating capsule, bottom-right (24px insets). `--bg-elev`, `--r-pill`, 1px `--line`, `--shadow-lg`. Play/pause ghost button left, mono time (tabular numerals), thin separator, caption ("brainstorm"), `×` dismiss right. |
| `public/favicon.svg` | Side-by-side comparison in PR. Replaced only if obviously better. |
| Various | Final focus-ring sweep (`2px solid var(--accent)`, 2px offset), hover motion (120ms ease), press transform (`translateY(1px)` / 80ms). |

## 6. Token mapping (Tailwind `@theme {}` plus shim)

Compatibility-shim block in `styles/index.css` re-points existing `--color-*` names so unchanged components keep working:

```
--color-primary           → var(--accent)              (was crimson)
--color-primary-hover     → var(--accent-hover)
--color-navy              → var(--ink)                  (was navy)
--color-navy-hover        → var(--ink-2)
--color-warm-white        → var(--bg)
--color-warm-gray         → var(--surface-muted)
--color-gray-1..8         → var(--surface-muted/line/line-strong/ink-5/ink-4/ink-3/ink-2/ink)
--color-error             → var(--danger)
--color-success           → var(--success)
--color-surface*          → var(--surface*)
--color-text-default      → var(--ink-3)
--color-text-primary      → var(--accent)
```

Tailwind `@theme {}` block declares the new tokens directly so utilities like `bg-surface`, `text-ink-3` and `border-line` work natively.

## 7. Always-on regression smoke (every PR)

Run on Vercel preview after each PR push, before requesting merge:

1. Sign in → dashboard renders → open an existing board.
2. From a second browser window, add a card → both windows show it within 2s.
3. Vote on a card → both windows show the count change.
4. Drag a card onto another in the same column → combine works; expand/collapse works.
5. Open settings → toggle secret voting → verify cards/votes hide correctly.
6. Presence indicator shows both sessions.
7. Complete the retro → board locks → all cards visible, no edit controls.
8. Toggle theme → reload → theme persists.

## 8. PR-specific verification additions

- **PR 1** — App boots in both themes. No console errors. Compat shim renders unchanged components correctly. Geist visible in body + headings. Lighthouse FCP not noticeably worse than baseline (eyeball).
- **PR 2** — Every Button/Pill/Chip/IconButton variant rendered on `/__refresh-primitives` for review. Focus rings visible on each. Disabled state visible.
- **PR 3** — All four board views (grid/swimlane/list/timeline) render correctly. Voting (incl. `secret_voting`). Combine flow drag + drop. Color picker per card. Hide-cards mode. Completed-retro read-only mode.
- **PR 4** — Header dropdown items all navigate. Avatar hue stable across renders. Home create modal opens, templates render, new board lands on `/board/[id]`. Dashboard counts match DB. New boards pick up new tint palette.
- **PR 5** — Tap to switch column tabs. FAB opens composer; submitted card appears in active column. Bottom-nav nav items work. Timer FAB floats above content, dismissable, mono time updates. iOS Safari and Android Chrome. No layout shift on tab switch.

## 9. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Tailwind `@theme {}` mismatch (utilities stale while CSS vars new) | Med | PR 1 points `@theme` at new `--…` vars so utilities track tokens automatically. Audit hard-coded `bg-[#…]` in components during PR 1 review. |
| Pre-existing board card colors thin as 3px stripe | Low | Data preserved either way. Spot-check on preview. |
| dnd-kit combine drop overlay visual regression | Med | Re-verify in PR 3. Accent-soft + dashed accent border is visually clearer than current navy. |
| Geist FOUT on first paint | Low | `next/font` + `display: swap` + preload; fallback `ui-sans-serif`. Measure FCP on preview. |
| Mobile snap-tab confuses returning users | Low-med | Same data, larger touch targets, fewer gestures required. Optional `?mobileV2=1` query gate during PR 5 verification if you want a soft launch. |
| Avatar hue collisions | Low cosmetic | Use 11 hues spaced 32° apart instead of `% 360`. |
| Perf regression from blur + OKLCH everywhere | Low | Blur is topbar-only (already exists). OKLCH is GPU-cheap. Lighthouse spot check on preview if needed. |
| Auth / middleware / Ably affected | Very low | None of `lib/auth.ts`, `middleware.ts`, API routes, `useBoardChannel`, presence, or polling are touched. |

## 10. Implementation details

### 10.1 Token compatibility shim location

In `styles/index.css`, the shim block goes between the OKLCH token blocks and the `@theme {}` block. Selector: `:root, [data-theme="light"], [data-theme="dark"]` so it applies in all theme states. Drop in a follow-up cleanup PR after refactor, or retain indefinitely (cost is ~30 CSS lines).

### 10.2 Tailwind `@theme {}` update

The `@theme {}` block is rewritten to declare the new token names (`--bg`, `--ink`, `--accent`, tint set) and to point the legacy `--color-*` entries at the new tokens via `var(--…)`. Tailwind v4 reads `@theme {}` at build time to generate utilities, so `bg-warm-white` and `bg-bg` both work, both resolve to the new palette.

### 10.3 Font loading

```ts
import { Geist, Geist_Mono } from 'next/font/google';
const geist = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
// applied to <html className={`${geist.variable} ${geistMono.variable}`}>
```

Removes the `@import url('https://fonts.googleapis.com/…')` from the handoff `tokens.css`. The CSS variables `--font-sans` and `--font-mono` are still declared (and used) by all components — only the source changes.

### 10.4 Card color migration

`card.color` is preserved in the DB. Rendering changes only:
- Before: `<div style={{ background: card.color }}>` with `getCardTextColor` for legibility.
- After: `<div style={{ borderLeftColor: card.color }} className="border-l-[3px]">` on a `--surface` background; text always `--ink`.
- `getCardTextColor` is deleted.
- Color picker swatches updated to the new tint palette (rose/amber/emerald/sky/violet ± soft) so new picks look consistent with column tints.

### 10.5 Template column colors

`utils/templates.ts` updates the seed columns per the handoff table (§4 Template column colors). Stored as the resolved hex equivalents shown in the handoff README (`#DD8C84` for rose, etc.). Existing boards in the DB are unchanged — they keep whatever color string was stored at creation time.

### 10.6 Avatar hue

```ts
function userHue(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return (h % 11) * 32; // 11 distinct hues, 32° apart
}
// background: `oklch(0.62 0.13 ${userHue(user.id)})`
```

11 hues is enough perceptual separation that any two users in the same session will look distinct without needing to track which hues are already taken.

### 10.7 Logo mark

CSS-rendered (per handoff styles.css `.rb-logo-mark`):

```css
.rb-logo-mark {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--ink); color: var(--bg-elev);
  display: grid; place-items: center;
  font-family: var(--font-mono); font-weight: 600; font-size: 14px;
  position: relative;
}
.rb-logo-mark::after {
  content: ''; position: absolute;
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--accent);
  bottom: 4px; right: 4px;
}
```

Inner text: literal `R`. Replaces the red/navy SVG in `Header.tsx`.

### 10.8 Favicon

Default: keep `public/favicon.svg` as-is. In PR 5, propose a replacement matching the new logo mark (export the CSS shape as SVG) and decide via side-by-side. No commitment up front.

## 11. Intentional deviations from the handoff

1. **ThemeToggle stays a 3-state cycle.** Handoff says topbar = sun/moon only with `system` mode behind `/settings`. We keep the current 3-state cycle behavior in the topbar (which is already a single icon button); avoids needing to build new settings UI just to preserve the `system` capability.
2. **`Badge.tsx` becomes a wrapper around `Pill`.** Handoff implies a sweeping rename to `Pill`; we wrap instead to avoid touching every call site.
3. **`card.color` rendered as 3px left border.** Handoff says "drop the colored-fill mode" but doesn't speak to retained data. We retain the data and render it as a left border, matching the handoff's combined-card pattern.
4. **Geist via `next/font/google`** (not the handoff's `@import url(fonts.googleapis.com)`). Same fonts, better perf and self-hosted from Vercel edge.

## 12. Out of scope

- Settings page (`/settings`) — referenced by handoff but not currently exposed in app; not built as part of this refresh.
- Admin section visual refresh — outside the handoff scope; remains on existing tokens via the compat shim until a follow-up.
- Action items list view refresh — same.
- New animations beyond the handoff motion spec (120ms hover, 80ms press, 150ms card lift).
- Documentation site / marketing site updates.
- E2E tests (per repo convention).

## 13. Branch and deploy

- Branch: `feature/visual-refresh` (off `develop`).
- Each PR merges back into `feature/visual-refresh` (not `develop`) until all five are complete and signed off.
- After PR 5 sign-off, single merge from `feature/visual-refresh` → `develop` (deploys to Vercel preview).
- Jordan reviews on `develop` → merges `develop` → `main` (deploys to prod).
- Pre-push gate per project `CLAUDE.md`: `npx tsc --noEmit && npm run build`.

Alternative if you want preview-per-PR rather than preview-only-at-the-end: each PR opens against `develop` directly, with the branch named `feature/visual-refresh-pr1`, `-pr2`, etc. — gives a deploy preview per PR but means `develop` accumulates partial states. Default plan is the single-branch flow above; change if you prefer the per-PR preview model.

---

**Status:** Awaiting written-spec review. After approval, the next step is to invoke the `writing-plans` skill to produce the implementation plan (one for each PR, or one consolidated — your call at that point).
