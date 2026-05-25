# Emoji Reactor Tooltips + Sortable Card Columns — Design

**Date:** 2026-05-25
**Status:** Approved, pending implementation
**Author:** Jordan Lawson (with Claude)

## Problem

Two related polish gaps on the retro board:

1. **Emoji reactions are anonymous.** A card showing `😂 8` tells you eight people reacted, but not who. The reactor identity is already in the data (`card.reactions[emoji]` is a list of participant IDs); we just don't surface it.
2. **Card ordering inside a column is fixed.** Today the grid sorts by votes desc → group size desc → position asc with no UI to change it. Users want to default to most-votes-first (already true) but be able to flip a column to fewest-votes or to manual (drag) order. The choice must be shared in real time across every viewer of the board.

## Goals

- Hovering (or tapping, on touch) an emoji pill reveals which participants reacted with that specific emoji.
- Each column gets a sort selector (Most votes / Fewest votes / Manual). Default is Most votes.
- Sort selection persists on the column itself and is broadcast to all viewers via Ably so the order is identical for everyone in the board, in real time.
- Sort selector is admin/facilitator-only to prevent "sort wars" mid-discussion.
- Behavior applies consistently to Grid view, Swimlane view, and the mobile shell.

## Non-goals

- Adding new sort options (Newest/Oldest, Author A–Z): explicitly cut from scope.
- Sort indicator in List view: List already has per-column sortable table headers and a different interaction model.
- Sort applied to Timeline view: Timeline is chronological by definition.
- Server-side facilitator gating on `PATCH /columns`: the rest of that endpoint is unguarded today; closing that gap is a pre-existing concern, not regression here.
- Touch-friendly tooltip via Radix/Floating UI: a small purpose-built popover is enough.
- Migrating the existing pre-200-byte reaction storage format.

## Architecture decisions

### Sort state lives on the column row (not in board settings, not in localStorage)

Three locations were considered:

| Location | Verdict |
|---|---|
| `columns.sort_by` column (chosen) | Normalized, deletes with the column, naturally per-column. |
| `board.settings.column_sorts` JSONB map | Orphans entries when columns are deleted; conflates board-global state with column state. |
| Client localStorage | Fails the shared/real-time intent — a sort change must propagate to all viewers. |

### Reuse the existing `column-updated` Ably event

No new event type. Sort changes ride the same channel + handler that already drives column renames, color changes, and description edits. The store's `updateColumn` action and `useBoardChannel`'s `column-updated` listener already replace the column object in state, which triggers re-render and re-sort.

### Sort is a pure function, not store-resident

Centralize the sort logic in `utils/sortCards.ts`. `BoardColumn`, `SwimlaneView`, and `MobileBoardShell` all call it. This removes three nearly-identical inline sorts that exist today.

## Data model

### Migration `009_column_sort_by.sql`

```sql
ALTER TABLE columns
  ADD COLUMN sort_by TEXT NOT NULL DEFAULT 'votes_desc'
  CHECK (sort_by IN ('votes_desc', 'votes_asc', 'manual'));
```

All existing columns inherit `votes_desc`, which matches today's visible behavior — no perceptible change on rollout.

### TypeScript types (in `types/index.ts`)

```ts
export const CARD_SORT_OPTIONS = ['votes_desc', 'votes_asc', 'manual'] as const;
export type CardSort = (typeof CARD_SORT_OPTIONS)[number];
export function isCardSort(v: unknown): v is CardSort {
  return typeof v === 'string' && (CARD_SORT_OPTIONS as readonly string[]).includes(v);
}

export interface Column {
  // …existing fields…
  sort_by: CardSort;
}
```

`CARD_SORT_OPTIONS` is the single source of truth for the enum (per the `single-source-of-truth` rule).

## API changes

### `PATCH /api/boards/[boardId]/columns`

Extend the existing handler to accept `sort_by` in `updates`. Validate against `isCardSort()` and reject 400 on invalid input. Reuse the existing `column-updated` Ably publish — no new event type.

```ts
if (updates.sort_by !== undefined) {
  if (!isCardSort(updates.sort_by)) {
    return NextResponse.json({ error: 'Invalid sort_by' }, { status: 400 });
  }
  await sql`UPDATE columns SET sort_by = ${updates.sort_by} WHERE id = ${columnId} AND board_id = ${boardId}`;
}
```

The existing `SELECT * FROM columns WHERE id = ${columnId}` after the patches and the existing `channel.publish('column-updated', { column })` cover the read-back and broadcast.

### Initial board load

`GET /api/boards/[boardId]` already returns `columns` via `SELECT *`. The new `sort_by` field will flow through automatically.

## Realtime sync

No new wiring. Existing path:

1. Admin clicks a sort option in `ColumnSortMenu`.
2. Store action `updateColumn(columnId, { sort_by })` does an optimistic update, then PATCHes the API.
3. API persists, publishes `column-updated` with the full updated column row.
4. All connected clients (including the one that initiated) receive the broadcast through `useBoardChannel` and replace the column in the Zustand store.
5. `sortCards()` re-derives and components re-render.

Existing echo-dedup in `useBoardChannel` prevents the initiator from double-processing.

## Sort algorithm — `utils/sortCards.ts`

The helper takes a `voteCountFor` callback so callers control whether a "card" counts only its own votes (flat lists in Swimlane / Mobile) or its own votes plus merged-children's votes (Grid). This keeps the helper pure and lets Grid preserve its merged-group semantics without leaking grouping logic into the utility.

```ts
import type { Card, CardSort } from '@/types';

export function sortCards(
  cards: Card[],
  sortBy: CardSort,
  voteCountFor: (cardId: string) => number,
): Card[] {
  const out = [...cards];
  switch (sortBy) {
    case 'votes_desc':
      out.sort((a, b) => {
        const va = voteCountFor(a.id);
        const vb = voteCountFor(b.id);
        if (vb !== va) return vb - va;
        return a.position - b.position;
      });
      break;
    case 'votes_asc':
      out.sort((a, b) => {
        const va = voteCountFor(a.id);
        const vb = voteCountFor(b.id);
        if (va !== vb) return va - vb;
        return a.position - b.position;
      });
      break;
    case 'manual':
      out.sort((a, b) => a.position - b.position);
      break;
  }
  return out;
}
```

### Caller responsibilities

- **Swimlane, Mobile:** `voteCountFor(id) = simpleVoteCount.get(id) ?? 0` — flat per-card count.
- **Grid (`BoardColumn`):** root cards only. `voteCountFor(rootId) = simpleVoteCount.get(rootId) + sum(simpleVoteCount.get(childId) for childId in childrenByParent[rootId])`. Children themselves are sorted under their parent by raw `simpleVoteCount` desc (unchanged from today).

### Tiebreaker simplification (intentional behavior change)

Today's Grid sort uses three tiers: votes desc → group size desc → position asc. The new helper uses two: votes (per `sortBy`) → position asc. The group-size tiebreaker is **dropped** — when two root cards have equal aggregate votes, the user's drag-ordered position wins instead of "the bigger merged group bubbles up." This makes the sort match the user's explicit ordering action and removes a quirk most users likely don't notice. Documented here so it isn't read as a regression.

## Sort UI — `ColumnSortMenu`

New component at `components/Board/ColumnSortMenu.tsx`.

- Trigger: small `<ArrowUpDown size={14}>` icon button in the column header, rendered between the card count badge and the admin overflow menu.
- Visibility: admin/facilitator only. Non-admins see the current sort take effect but no control.
- Popover: anchored to trigger, three rows ("Most votes" / "Fewest votes" / "Manual"), check icon on the active row, outside-click closes.
- Behavior: clicking a row calls `onChangeSort(columnId, sortBy)` then closes. `BoardColumn` and `SwimlaneView` headers wire this to `updateColumn(columnId, { sort_by })`.
- Style: matches the existing column-color picker and admin overflow menu (same border, shadow, radius tokens).
- Accessibility: focus-trap inside popover; `aria-haspopup="menu"`, `role="menuitemradio"` on options, ESC closes, returns focus to trigger.

The mobile column header (in `MobileBoardShell` via the column tab strip) gets the same trigger when the active column is shown and the participant is admin. Same popover, same component.

## Reaction tooltip — `ReactionPill`

New component at `components/Board/ReactionPill.tsx` that wraps the inline `<button>` currently in `RetroCard:308-321`.

Props:
```ts
interface ReactionPillProps {
  emoji: string;
  reactorIds: string[];
  participants: Participant[];          // for ID → display_name lookup
  currentParticipantId: string | null;  // for "You" tagging
  isMine: boolean;                      // already computed by caller
  onToggle: () => void;                 // unchanged toggle behavior
}
```

### Desktop behavior (hover)

- `onMouseEnter` → `setTimeout(showTooltip, 200)` (matches common UI debounce, avoids flashing).
- `onMouseLeave` → `setTimeout(hideTooltip, 100)` (small grace so moving onto tooltip itself doesn't close it).
- Tooltip is positioned absolutely above the pill via CSS; if the pill is within 80px of the viewport top, flip to below.
- Click still toggles the user's own reaction (unchanged).

### Touch behavior (no hover)

- Detect touch via `pointerType === 'touch'` on first `pointerdown` against the pill.
- On touch:
  - First tap → show tooltip; suppress the toggle.
  - Tap outside, ESC, or scroll → hide tooltip.
  - The tooltip header includes a small inline "Add yours" / "Remove yours" button that triggers `onToggle()`. This preserves the toggle affordance without conflicting with tap-to-reveal.

### Tooltip content

```
😂 Reactions
─────────────
Jordan (You)
Charlton
Harry
Mysterio
+ 4 more
```

- One row per reactor, `display_name` looked up from `participants`.
- Current user shown with bold `display_name` and `(You)` suffix (accent color).
- Missing participant (`id` not found — facilitator removed them) renders as `Someone`. Count stays accurate.
- Cap at 8 visible names + `+N more` row. Hovering `+N more` does not expand; this is a polish item not an essential.
- Header line shows the emoji + the word "Reactions" for clarity.

### Styling

- Surface, line, shadow, and radius tokens consistent with the existing column color popover and emoji picker.
- Min-width ~180px, max-width ~260px.
- Dark mode: inherits via tokens, nothing custom.

## Where the components plug in

| File | Change |
|---|---|
| `types/index.ts` | Add `CardSort`, `CARD_SORT_OPTIONS`, `isCardSort`, add `sort_by` to `Column`. |
| `utils/sortCards.ts` | **New.** Pure helper. |
| `components/Board/ColumnSortMenu.tsx` | **New.** Trigger + popover. |
| `components/Board/ReactionPill.tsx` | **New.** Hover/tap-aware emoji button + tooltip. |
| `components/Board/RetroCard.tsx` | Replace inline reaction button with `<ReactionPill />`. Pass `participants` prop down. |
| `components/Board/BoardColumn.tsx` | Render `ColumnSortMenu` in header (admin-only). Replace inline sort with `sortCards(...)`, preserving merged-group totals via wrapper. |
| `components/Board/SwimlaneView.tsx` | Render `ColumnSortMenu` per column header (admin-only). Replace inline sort with `sortCards(...)`. |
| `components/Board/MobileBoardShell.tsx` | Render `ColumnSortMenu` for the active column (admin-only). Replace inline sort with `sortCards(...)`. Receive `isAdmin` prop (already wired). |
| `components/pages/BoardPage.tsx` | Pass `participants` to children that render `RetroCard`. |
| `stores/boardStore.ts` | `updateColumn` already supports arbitrary `updates`; just update its `Partial<Column>` shape to include `sort_by`. |
| `app/api/boards/[boardId]/columns/route.ts` | Add `sort_by` branch in PATCH handler with validation. |
| `scripts/migrations/009_column_sort_by.sql` | **New.** |

`MobileBoardShell` already receives `isAdmin` per its prop interface (line 32), so threading is minimal.

## Testing strategy

Vitest (already configured per recent `feat(api): member role validation (SSOT) + self-leave`).

### Unit tests

`utils/__tests__/sortCards.test.ts`:
- 3 modes × scenarios: empty cards, no votes, ties (position breaks), missing votes for some cards, manual mode ignores votes entirely.
- Stability check: input array not mutated.

`components/Board/__tests__/ReactionPill.test.ts` (or component test if RTL is configured; if not, extract a `formatReactorList()` helper and unit-test that):
- Maps reactor IDs to display names.
- Tags current participant with "You".
- Falls back to "Someone" for unknown IDs.
- Caps at 8 names with "+N more".

`app/api/boards/[boardId]/__tests__/columns.test.ts` (follow the pattern of the existing tests added in the member-role-validation commit):
- PATCH with valid `sort_by` updates the row and returns the column.
- PATCH with invalid `sort_by` returns 400, leaves the row unchanged.
- Existing `title`/`color`/`description` patches still work (regression guard).

### Manual smoke test (per `ui-feature-verify`)

Before declaring done, run `npm run dev`, open two browser windows with the same board, and verify:

1. Default sort is "Most votes" on every column.
2. Admin changes column A to "Fewest votes" → both windows reorder column A within ~1 sec; column B unchanged.
3. Admin switches column B to "Manual" → drag-and-drop reorder reflects on both windows.
4. Non-admin window shows the same order but no sort control.
5. Reaction pill on hover (desktop): list of reactor names appears, "You" tag visible on current user's row.
6. Reaction pill on tap (mobile): list appears; tap outside closes; "Add yours" toggle button works.
7. Remove a participant who has reacted, reload → that name renders as "Someone", count unchanged.

## Known limitations

- Server-side facilitator gating on the columns PATCH endpoint is not added here (pre-existing gap across `title`, `color`, `description`, `position`). Should be tackled in a follow-up alongside other unguarded board endpoints.
- "+N more" in the tooltip is not expandable. If the team finds this annoying, follow up with a click-to-expand pattern or a "Show all reactors" modal.
- The sort respects merged-group totals in Grid but flattens them in Swimlane/Mobile (which already do). No behavior change for those views.
- Tooltip animations are minimal (opacity transition only). Not using Floating UI / Radix to keep the bundle and dep surface clean.

## Open questions

None — the design is approved as-is. Implementation will follow `writing-plans` next.
