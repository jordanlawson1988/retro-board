# Handoff: Retroboard — Visual Refresh ("Quiet Modern")

## Overview

A visual refresh for the Retroboard app — same functionality, refreshed look and feel.
Goal: a sleeker, more modern aesthetic with seamless mobile interaction, a calm
density, and full parity between light and dark mode.

**No features were added or removed.** This is purely a re-skin: the component
tree, routes, real-time wiring, store shapes, and APIs all stay as they are.

## About the design files

The HTML files in this bundle are **design references**, not production code to drop in.
They were created as static prototypes (React + Babel inline JSX) so the visual
direction could be evaluated quickly. Your job is to **recreate this look inside the
existing Next.js + Tailwind + Zustand codebase** — not to ship the HTML.

In practical terms:

- Replace the CSS custom properties / Tailwind theme tokens (`styles/index.css`)
  with the new ones documented below. Most existing component classNames already
  use `var(--color-…)` or token-named utilities, so this is mostly a token swap.
- Update typography to Geist Sans + Geist Mono.
- Adjust the handful of components that need shape/layout updates (cards, columns,
  buttons, pills, board header, mobile column nav). These are listed under
  **Component-level changes** below.
- Keep all existing logic intact — `useBoardStore`, `useBoardChannel`, polling,
  presence, dnd-kit, etc.

## Fidelity

**High-fidelity.** Exact hex/oklch values, type stack, spacing, radii, and
component states are all specified. Recreate pixel-perfect; deviations should be
deliberate (e.g. to match a pre-existing component pattern in your codebase).

---

## Design System

### Type

```
--font-sans: 'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif;
--font-mono: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

Load via Google Fonts:
`https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap`

Heading letter-spacing: `-0.02em` (`-0.025em` on H1). Body letter-spacing: `-0.005em`.
All headings use weight 600, not 700 (less rigid).

| Token        | Size              | Use                                |
|--------------|-------------------|------------------------------------|
| `--t-display`| clamp(2.4, 5vw, 3.5rem) | Hero on Home                  |
| `--t-h1`     | 2.1rem            | Page titles                        |
| `--t-h2`     | 1.5rem            | Section titles                     |
| `--t-h3`     | 1.125rem          | Tile / column titles               |
| `--t-body`   | 0.9375rem (15px)  | Body, card text                    |
| `--t-sm`     | 0.8125rem (13px)  | Secondary, metadata, button labels |
| `--t-xs`     | 0.6875rem (11px)  | Captions, pills, badges            |

Numeric values (vote counts, join codes, timer, durations) **always** use mono
with `font-variant-numeric: tabular-nums` for steady alignment.

### Color tokens (OKLCH)

All colors are defined in OKLCH so light/dark match perceptually.

#### Light mode (`[data-theme="light"]`)

```
--bg:           oklch(0.985 0.004 80);  /* warm off-white app background */
--bg-elev:      oklch(1     0     0);   /* surface on top of bg          */
--bg-sunken:    oklch(0.965 0.005 80);  /* board canvas behind columns   */
--surface:      oklch(1     0     0);   /* cards                         */
--surface-hover:oklch(0.98  0.004 80);
--surface-muted:oklch(0.965 0.005 80);  /* chips, filled inputs, kbd     */

--ink:          oklch(0.18 0.015 260);  /* primary text                  */
--ink-2:        oklch(0.32 0.012 260);
--ink-3:        oklch(0.50 0.012 260);  /* secondary text                */
--ink-4:        oklch(0.65 0.010 260);  /* tertiary / metadata           */
--ink-5:        oklch(0.80 0.008 260);

--line:         oklch(0.93 0.005 260);  /* hairlines                     */
--line-strong:  oklch(0.88 0.006 260);  /* hover borders                 */

--accent:       oklch(0.55 0.18 280);   /* indigo — the single accent    */
--accent-hover: oklch(0.50 0.20 280);
--accent-soft:  oklch(0.95 0.04 280);   /* accent bg tint                */
--on-accent:    oklch(0.99 0.003 280);
```

#### Dark mode (`[data-theme="dark"]`)

```
--bg:           oklch(0.155 0.012 260);
--bg-elev:      oklch(0.20  0.012 260);
--bg-sunken:    oklch(0.13  0.012 260);
--surface:      oklch(0.20  0.012 260);
--surface-hover:oklch(0.235 0.013 260);
--surface-muted:oklch(0.18  0.012 260);

--ink:          oklch(0.97 0.005 80);
--ink-2:        oklch(0.88 0.008 80);
--ink-3:        oklch(0.72 0.008 260);
--ink-4:        oklch(0.58 0.010 260);
--ink-5:        oklch(0.42 0.012 260);

--line:         oklch(0.27 0.012 260);
--line-strong:  oklch(0.34 0.014 260);

--accent:       oklch(0.72 0.16 280);   /* lifted for dark               */
--accent-hover: oklch(0.78 0.17 280);
--accent-soft:  oklch(0.30 0.08 280);
--on-accent:    oklch(0.14 0.02 280);
```

#### Column tints (shared, same name in both modes)

Each tint has a fully-saturated value (`--rose`, etc.) for dots/strips and a
soft pastel (`--rose-soft`) for background fills. They share lightness and
chroma, varying only hue.

```
Light:                                  Dark:
--rose:    oklch(0.70 0.13 18)          oklch(0.74 0.13 18)
--rose-soft: oklch(0.96 0.025 18)       oklch(0.32 0.06 18)
--amber:   oklch(0.78 0.13 70)          oklch(0.80 0.13 70)
--amber-soft: oklch(0.96 0.04 70)       oklch(0.34 0.06 70)
--emerald: oklch(0.65 0.13 160)         oklch(0.74 0.13 160)
--emerald-soft: oklch(0.95 0.04 160)    oklch(0.30 0.06 160)
--sky:     oklch(0.70 0.12 230)         oklch(0.75 0.12 230)
--sky-soft: oklch(0.95 0.03 230)        oklch(0.30 0.06 230)
--violet:  oklch(0.62 0.15 290)         oklch(0.72 0.14 290)
--violet-soft: oklch(0.95 0.03 290)     oklch(0.32 0.06 290)
```

#### Semantic

```
--danger:  oklch(0.58 0.20 25)    / dark: oklch(0.68 0.18 25)
--success: oklch(0.55 0.14 155)   / dark: oklch(0.72 0.14 155)
```

> Drop-in mapping for the existing tokens (in `styles/index.css`): preserve the
> `--color-*` variable names if you want to avoid touching every component;
> simply re-point them at the new oklch values. Or migrate to the cleaner
> `--bg`, `--ink`, etc. names — both work, the latter is preferred.

### Template column colors (data layer)

Update `utils/templates.ts` so seed columns use the new tint palette:

| Template                  | Columns                                                         |
|---------------------------|-----------------------------------------------------------------|
| Mad / Sad / Glad          | `--rose` / `--sky` / `--emerald`                                |
| Liked / Learned / Lacked  | `--emerald` / `--sky` / `--amber`                               |
| Start / Stop / Continue   | `--emerald` / `--rose` / `--sky`                                |
| Went Well / Didn't / …    | `--emerald` / `--rose` / `--violet`                             |
| Custom                    | `--sky` / `--emerald` / `--rose`                                |

Persist them as the resolved OKLCH or as hex equivalents — your call. Resolved
hex (sRGB) values for the saturated variants (light mode reference):

```
rose    #DD8C84
amber   #E0B265
emerald #2DA37F
sky     #5FA3CC
violet  #8270C8
```

### Spacing

4 px base. Most layout uses 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48.

### Radius

```
--r-xs:  6px   /* tiny chips                  */
--r-sm:  8px   /* small buttons, inputs       */
--r-md:  12px  /* buttons, inputs, popovers   */
--r-lg:  14px  /* cards (RetroCard)           */
--r-xl:  18px  /* large tiles (BoardCard)     */
--r-2xl: 22px  /* columns, modals             */
--r-pill: 999px
```

### Shadows

Light mode uses ink-tinted shadows; dark mode uses pure black with higher alpha.

```
--shadow-xs: 0 1px 2px  rgba(ink, 0.06);
--shadow-sm: 0 1px 3px  rgba(ink, 0.04), 0 1px 2px rgba(ink, 0.06);
--shadow-md: 0 4px 12px rgba(ink, 0.06), 0 2px 4px rgba(ink, 0.04);
--shadow-lg: 0 16px 40px rgba(ink, 0.10), 0 4px 12px rgba(ink, 0.06);
--shadow-pop:0 24px 60px rgba(accent, 0.18); /* modals only */
```

Cards rest with `--shadow-xs`; lift to `--shadow-sm` on hover. Modals use
`--shadow-pop`.

### Motion

- Hover transitions: 120ms ease, animated `background`, `border-color`, `color`.
- Card lift on hover: `transform: translateY(-1px)`, 150ms ease.
- Button press: `transform: translateY(1px)`, 80ms.
- Focus ring: `0 0 0 3px var(--accent-soft)` + `border-color: var(--accent)`.

---

## Component-level changes

These are the components that need real markup/structure tweaks beyond just
token swaps. Anything not listed should pick up the refresh automatically once
tokens are updated.

### `components/common/Button.tsx`

Add three variants matching the prototype:

| Variant   | Background      | Text          | Border           | Notes                            |
|-----------|-----------------|---------------|------------------|----------------------------------|
| `default` | `--surface`     | `--ink`       | `--line`         | Default — was navy filled        |
| `primary` | `--ink`         | `--bg-elev`   | transparent      | High-contrast — was red          |
| `accent`  | `--accent`      | `--on-accent` | transparent      | Use sparingly (Create board CTA) |
| `ghost`   | transparent     | `--ink-3`     | transparent      | Hover bg = `--surface-muted`     |

Sizes:
- `sm`: padding `7px 10px`, font 11px, radius `--r-sm`
- `md` (default): padding `10px 14px`, font 13px, radius `--r-md`
- `lg`: padding `14px 22px`, font 15px, radius `--r-lg`

### Pills / chips

Two new primitives:

- **`Pill`** — display badge. `padding: 4px 10px`, `border-radius: 999px`,
  `border: 1px solid var(--line)`, `background: var(--surface-muted)`,
  font-size 11px. Tinted variant uses `--accent-soft` + `--accent` (no border).
- **`Chip`** — interactive (filter). Like Pill but `background: var(--bg-elev)`,
  hover lifts border to `--line-strong`. Active state: `background: var(--ink)`,
  `color: var(--bg-elev)`, no border.

### `components/Board/RetroCard.tsx`

- Drop the colored-fill mode. The card always sits on `--surface` with a 1px
  `--line` border. **Card-level accent color becomes a 3px left border**
  (`border-left: 3px solid <columnColor>`) when applicable, or
  `border-left: 3px solid var(--accent)` for combined-parent cards.
- Remove the `getCardTextColor` contrast logic — text is always `--ink` since
  cards are always neutral.
- Vote pill: 28px height, mono font, `--surface-muted` resting,
  `--accent-soft` + accent text when voted. Use the new `rb-vote` styles.
- Reactions: pill chips, `--surface-muted` background, `--accent-soft` when
  current user has reacted. 11px label, mono count.
- Hover: border → `--line-strong`, shadow → `--shadow-sm`. No transform on the
  card itself (only on `tile`).
- The "Edit / Color / Trash" hover row remains, but uses `rb-icon-btn` style:
  32×32, transparent, hover bg `--surface-muted`.

### `components/Board/BoardColumn.tsx`

- Column container: `border-radius: 22px`, `border: 1px solid var(--line)`,
  `background: var(--bg-elev)`.
- **3px stripe at top** in the column tint (`background: var(--tint)`,
  `opacity: 0.85`). Replaces the colored dot in the header (an 8×8 squared dot
  in the tint still sits next to the title for redundancy).
- Header: 16px top padding, 18px horizontal. Title 15px / weight 600.
  Count and any vote-total are mono numbers in `--ink-4`.
- Description sits in the header area, 13px, `--ink-4`, no border separator.
- The "Add card" input becomes a dashed-border ghost row at the top of the
  column body — `border: 1px dashed var(--line-strong)`,
  `background: var(--surface-muted)`. On focus it becomes a real input.
- Admin action bar (Color / Delete) becomes ghost icon buttons in the column
  header overflow (`More` icon → menu), rather than a separate stripe.

### `components/Layout/Header.tsx`

- Logo: 28×28 dark square (`--ink`), white letter "R" inside, with a 6×6
  `--accent` dot at the bottom-right. Wordmark "Retroboard" in 16px / weight 600
  to the right.
- Topbar height drops to 60px, with `border-bottom: 1px solid var(--line)` and
  `background: color-mix(in oklab, var(--bg) 90%, transparent)` +
  `backdrop-filter: blur(8px)`.
- Avatar button: 32px, radius 999px, background derived from `oklch(0.62 0.13
  <userHue>)` (hue stable per user — hash the user ID modulo 360).
- Sign-in button uses the default Button variant.

### `components/Layout/ThemeToggle.tsx`

Single icon button (32×32, `rb-icon-btn`) that toggles between sun/moon. No
"system" picker visible in the topbar — keep it under `/settings`.

### `components/Board/ViewToggle.tsx`

Inline pill group inside a soft tray. Tray: `padding: 3px`, `border-radius: 10px`,
`background: var(--surface-muted)`, `border: 1px solid var(--line)`.

Each option: 5×10px padding, 12px font, 7px radius, transparent until active.
Active state: `background: var(--bg-elev)`, `color: var(--ink)`, shadow `--shadow-xs`.

### `components/Board/FacilitatorToolbar.tsx`

Use ghost icon buttons with text labels at `sm` size. Order:
`Timer · Hide cards · Settings · | · Complete retro (primary)`.
The pipe `|` is a 1px × 22px `--line` divider.

### `components/Timer/TimerFloating.tsx`

- Floating capsule, bottom-right (24px insets).
- `background: var(--bg-elev)`, `border-radius: 999px`,
  `border: 1px solid var(--line)`, `box-shadow: var(--shadow-lg)`.
- Play/pause icon in a small ghost button on the left.
- Time in mono / tabular numerals (`12:30`), then a thin separator and a
  caption (`brainstorm`).
- A small `×` on the right to dismiss.

### Mobile (board route at <768px)

Replace the horizontal-scroll-columns pattern with a **snap-tab column nav**:

1. Top app bar (44px iOS status spacer + 56px nav row).
2. **Vote tracker row** — left: small accent-soft circle with vote icon,
   "Your votes / N of 5 used". Right: 5 dots that fill as votes are spent.
3. **Column tabs** — horizontal scroll, pill chips with the column tint dot.
   Active tab uses the column's tint as background, white text.
4. **Single column view** — vertically stacked cards in the active column.
   No horizontal swipe at this level (predictable, accessible).
5. **FAB** — 52px circle, bottom-right, `--accent` background, plus icon.
   Opens a bottom-sheet composer (full-width sheet, top drag handle, 16px text
   field, share button).
6. **Persistent bottom nav** — 4 items: Board · Votes · Actions · More.
   Items are 64×52 with 20px icon + 10px label. Active item is `--accent`.
   Action items badge (number) sits at top-right of its icon as a small
   accent dot.

### Home (`/`)

- Hero: badge pill ("Real-time, no install, ready in 5 seconds"), then a 48px+
  display headline. Accent word ("finishes") in `--accent`.
- Two side-by-side CTA tiles ("Start a new retro" / "Join with a code") with
  big rounded icons, ⌘N kbd hint and a 5-digit code preview, respectively.
- Below: 4-up feature row (icons + label + 1-line description).
- Create modal: title input + 2×2 template grid. Template buttons show a row
  of small tint stripes at the top.

### Dashboard (`/dashboard`)

- Welcome line ("Welcome back, <first name>") + H1.
- 4-up stat strip cards (Active boards / Action items / Cards shared / Votes
  cast). Active items number uses `--accent`; others use `--ink`.
- Filter tray (`all / active / completed`) with the same active-pill pattern as
  ViewToggle.
- Board cards (3-column grid):
  - 6px-tall row of tint stripes representing the columns (preserves brand
    recognition without making the card feel busy).
  - Title (15px/600) + 12px caption "Description · Template name".
  - Bottom row: mono counts for cards, votes, participants, then "X ago"
    timestamp on the right.

---

## Interactions & Behavior

All existing interactions are preserved. The redesign just changes their feel:

- **Voting** — tap the vote pill. State flips immediately; pill changes to
  accent-soft fill with mono count. Visible regardless of `secret_voting`
  setting (count hides as before when secret).
- **Card combine (drag)** — same dnd-kit flow; the combine drop zone overlay
  uses `--accent-soft` + dashed accent border instead of the navy.
- **Combined cards** — parent has a 3px `--accent` left border + a small
  "merged · +N" pill next to the author. Expand/collapse via chevron button.
- **Column filter chip** — tap to filter, tap again to clear. Active chip
  takes on the column's tint.
- **Mobile column swap** — tap the column tab; the column content fades/swaps
  underneath. Smooth scroll the tab strip so the active tab is in view.
- **Theme toggle** — instantly applies `[data-theme="..."]` on
  `document.documentElement`. Persist in localStorage as today.

### Focus + a11y

- All interactive elements show a focus ring:
  `outline: 2px solid var(--accent); outline-offset: 2px;`
- Color contrast meets WCAG AA in both modes:
  - `--ink` on `--bg` ≥ 12:1
  - `--ink-3` on `--bg` ≥ 4.5:1
  - `--accent` on `--bg-elev` ≥ 4.5:1 (light) / ≥ 6:1 (dark)

---

## State Management

No changes. The existing Zustand stores (`boardStore`, `authStore`,
`appSettingsStore`, `featureFlagStore`) and Ably/polling layers stay intact.

The only new client-side state to consider is the per-user theme preference,
which already exists via `useTheme` — no new hook needed.

---

## Assets

- **Fonts:** Geist + Geist Mono via Google Fonts (already shown in the CSS
  example above). Pin to `display=swap`.
- **Icons:** Continue using `lucide-react`. The mocks use the same icon names
  (`ThumbsUp`, `Merge`, `MoreHorizontal`, `Sun`, `Moon`, etc.) so no swap is
  needed — they just need consistent sizing (14px in `sm` buttons, 16px in `md`,
  18-20px in icon-only mobile buttons).
- **Logo mark:** The new mark is generated in CSS (28×28 dark square + letter
  "R" + 6×6 accent dot). Replace the SVG in `Header.tsx` with this — or, if you
  want it on the favicon too, export an SVG matching `public/favicon.svg`.

---

## Files in this bundle

- `Retroboard Refresh.html` — entry. Loads the design canvas with eight
  artboards (Home, Dashboard, Board desktop, Board mobile — each light + dark).
- `styles.css` — all the design tokens and primitive component CSS the mocks
  use. The cleanest source for the new design tokens.
- `screen-home.jsx`, `screen-dashboard.jsx`, `screen-board.jsx`,
  `screen-mobile.jsx` — per-screen React components. Mostly markup references.
- `data.jsx` — sample data + shared primitives (Avatar, AvatarStack, Logo,
  ThemeSwitch).
- `icons.jsx` — inline SVG icon set used in the mocks (lucide-equivalent).
- `design-canvas.jsx` — the canvas chrome (pan/zoom layout). **Not for prod;
  don't ship.**

Open `Retroboard Refresh.html` in a browser to see all eight artboards live —
the theme switch in each artboard's top-right toggles light/dark per artboard,
so you can compare modes side-by-side while you implement.

---

## Suggested implementation order

1. **Tokens** — replace `:root` and `[data-theme="dark"]` blocks in
   `styles/index.css` with the new palette. Run the app — most screens already
   look noticeably better just from this.
2. **Type** — swap font families to Geist / Geist Mono in the same file.
3. **Primitives** — update `Button`, add `Pill` and `Chip`, update
   `ThemeToggle`.
4. **RetroCard + BoardColumn** — biggest visual lift; do these together so the
   board looks right end-to-end.
5. **Header + AppShell** — small but visible changes.
6. **Home + Dashboard** — refit to the new tokens.
7. **Mobile board route** — new component pattern (snap-tab columns + FAB +
   bottom nav). This is the largest structural change.
8. **Polish pass** — focus states, motion, dashboard board-tile, modal shadows.

Total: ~1–2 days of focused work for a developer who knows the codebase.
