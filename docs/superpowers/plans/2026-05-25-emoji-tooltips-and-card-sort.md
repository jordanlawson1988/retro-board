# Emoji Reactor Tooltips + Sortable Card Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-column sort selector (Most votes / Fewest votes / Manual; admin-only, shared in real time) and hover/tap tooltips on emoji reactions that show which participants reacted.

**Architecture:** Sort lives as a new `columns.sort_by` field, syncs via the existing `column-updated` Ably broadcast — no new event type. Sorting is centralized in a pure helper used by Grid, Swimlane, and Mobile views. A new `ReactionPill` component wraps each emoji with hover/tap-aware tooltip content built from the existing `participants` array.

**Tech Stack:** Next.js 16, React 19, Zustand, Neon Postgres, Ably, Tailwind 4, Vitest (node env, lib + app glob).

**Spec:** `docs/superpowers/specs/2026-05-25-emoji-tooltips-and-sortable-columns-design.md`

---

## File Map

| Status | Path | Responsibility |
|---|---|---|
| New | `scripts/migrations/009_column_sort_by.sql` | Schema migration |
| New | `utils/sortCards.ts` | Pure sort helper |
| New | `lib/__tests__/sortCards.test.ts` | Sort helper tests |
| New | `utils/formatReactorList.ts` | ID → display-name list with "You"/"Someone" handling |
| New | `lib/__tests__/formatReactorList.test.ts` | Formatter tests |
| New | `components/Board/ColumnSortMenu.tsx` | Admin-only sort dropdown |
| New | `components/Board/ReactionPill.tsx` | Hover/tap emoji button + tooltip |
| Modify | `types/index.ts` | Add `CardSort`, `CARD_SORT_OPTIONS`, `isCardSort`, extend `Column` |
| Modify | `lib/__tests__/card-sort-type.test.ts` (new) | `isCardSort` guard tests |
| Modify | `stores/boardStore.ts` | Widen `updateColumn` signature to allow `sort_by` |
| Modify | `app/api/boards/[boardId]/columns/route.ts` | Accept `sort_by` in PATCH with validation |
| Modify | `components/Board/RetroCard.tsx` | Accept `participants`, render `ReactionPill` instead of inline button |
| Modify | `components/Board/BoardColumn.tsx` | Render `ColumnSortMenu`, use `sortCards` (with merged-children aggregation), pass `participants` to `RetroCard` |
| Modify | `components/Board/SwimlaneView.tsx` | Render `ColumnSortMenu`, use `sortCards`, pass `participants` |
| Modify | `components/Board/MobileBoardShell.tsx` | Render `ColumnSortMenu`, use `sortCards`, pass `participants` |
| Modify | `components/pages/BoardPage.tsx` | Pass `participants` to all three view components |
| Modify | `components/Board/index.ts` | Re-export new components if barrel exists |

A test path note: `vitest.config.ts` only globs `lib/**/*.test.ts` and `app/**/*.test.ts`. New unit tests for helpers in `utils/` therefore live under `lib/__tests__/` (mirroring `lib/__tests__/join-code.test.ts`).

---

### Task 1: Add `CardSort` type + `isCardSort` guard

**Files:**
- Modify: `types/index.ts` (append exports near other `as const` blocks)
- Create: `lib/__tests__/card-sort-type.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/card-sort-type.test.ts
import { describe, it, expect } from 'vitest';
import { isCardSort, CARD_SORT_OPTIONS } from '@/types';

describe('isCardSort', () => {
  it('accepts each value in CARD_SORT_OPTIONS', () => {
    for (const v of CARD_SORT_OPTIONS) {
      expect(isCardSort(v)).toBe(true);
    }
  });

  it('rejects unknown strings, null, undefined, and non-strings', () => {
    expect(isCardSort('votes')).toBe(false);
    expect(isCardSort('manual ')).toBe(false);
    expect(isCardSort('')).toBe(false);
    expect(isCardSort(null)).toBe(false);
    expect(isCardSort(undefined)).toBe(false);
    expect(isCardSort(0)).toBe(false);
    expect(isCardSort({})).toBe(false);
  });

  it('exposes the three expected options', () => {
    expect([...CARD_SORT_OPTIONS]).toEqual(['votes_desc', 'votes_asc', 'manual']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- card-sort-type`
Expected: FAIL — `isCardSort`/`CARD_SORT_OPTIONS` not exported from `@/types`.

- [ ] **Step 3: Implement the type, guard, and add `sort_by` to `Column`**

Add at the end of `types/index.ts`, after the existing `BoardSettings` and before `Column`:

```ts
export const CARD_SORT_OPTIONS = ['votes_desc', 'votes_asc', 'manual'] as const;
export type CardSort = (typeof CARD_SORT_OPTIONS)[number];
export function isCardSort(v: unknown): v is CardSort {
  return typeof v === 'string' && (CARD_SORT_OPTIONS as readonly string[]).includes(v);
}
```

Then update the existing `Column` interface in the same file (currently lines 62–71). Add the new field at the end of the interface:

```ts
export interface Column {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  color: string;
  position: number;
  created_at: string;
  sort_by: CardSort;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- card-sort-type`
Expected: PASS (3 tests).

- [ ] **Step 5: Type-check (sanity)**

Run: `npx tsc --noEmit`
Expected: Some new errors elsewhere (callers reading `column.sort_by` that don't have it yet). Skim them — they should be limited to component prop spreading or test fixtures. They will be fixed in later tasks (the DB migration in Task 2 makes the real column rows carry the field, and components are updated in Task 11+). Note them and proceed.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts lib/__tests__/card-sort-type.test.ts
git commit -m "feat(types): CardSort enum, isCardSort guard, sort_by on Column

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration 009 — `columns.sort_by`

**Files:**
- Create: `scripts/migrations/009_column_sort_by.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 009_column_sort_by.sql
-- Adds per-column sort preference, shared across all viewers.

ALTER TABLE columns
  ADD COLUMN sort_by TEXT NOT NULL DEFAULT 'votes_desc'
  CHECK (sort_by IN ('votes_desc', 'votes_asc', 'manual'));
```

- [ ] **Step 2: Apply the migration to the dev DB**

Run: `node --env-file=.env.local scripts/run-one.mjs scripts/migrations/009_column_sort_by.sql`
Expected output: `Applied scripts/migrations/009_column_sort_by.sql`

- [ ] **Step 3: Verify the column exists and defaults are populated**

Run a quick check via the existing migration runner pattern. Use psql if available, or any short script. Acceptable: open `scripts/migrations/009_column_sort_by.sql` mentally with a sanity SELECT in your DB tool, or run an ad-hoc query:

```bash
node --env-file=.env.local -e "
import('@neondatabase/serverless').then(async ({ Pool }) => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await p.query(\"SELECT id, sort_by FROM columns LIMIT 5\");
  console.log(r.rows);
  await p.end();
});
"
```

Expected: each row has `sort_by: 'votes_desc'`.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrations/009_column_sort_by.sql
git commit -m "feat(db): migration 009 — columns.sort_by (votes_desc default)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `sortCards` helper (TDD)

**Files:**
- Create: `utils/sortCards.ts`
- Create: `lib/__tests__/sortCards.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/sortCards.test.ts
import { describe, it, expect } from 'vitest';
import { sortCards } from '@/utils/sortCards';
import type { Card } from '@/types';

function card(id: string, position: number, overrides: Partial<Card> = {}): Card {
  return {
    id,
    column_id: 'col1',
    board_id: 'b1',
    text: `card ${id}`,
    author_name: 'A',
    author_id: 'A',
    color: null,
    position,
    merged_with: null,
    reactions: {},
    created_at: '2026-05-25T00:00:00Z',
    updated_at: '2026-05-25T00:00:00Z',
    ...overrides,
  };
}

describe('sortCards', () => {
  const cards = [card('a', 0), card('b', 1), card('c', 2)];
  const votes = (m: Record<string, number>) =>
    (id: string) => m[id] ?? 0;

  it('votes_desc: highest votes first, position tiebreaker', () => {
    const out = sortCards(cards, 'votes_desc', votes({ a: 1, b: 3, c: 1 }));
    expect(out.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('votes_asc: lowest votes first, position tiebreaker', () => {
    const out = sortCards(cards, 'votes_asc', votes({ a: 1, b: 3, c: 1 }));
    expect(out.map((c) => c.id)).toEqual(['a', 'c', 'b']);
  });

  it('manual: position ascending only', () => {
    const messed = [card('a', 2), card('b', 0), card('c', 1)];
    const out = sortCards(messed, 'manual', votes({ a: 99, b: 0, c: 50 }));
    expect(out.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const original = [...cards];
    sortCards(cards, 'votes_desc', votes({ a: 5, b: 1, c: 3 }));
    expect(cards).toEqual(original);
  });

  it('handles empty input', () => {
    expect(sortCards([], 'votes_desc', votes({}))).toEqual([]);
  });

  it('handles missing votes (treated as 0)', () => {
    const out = sortCards(cards, 'votes_desc', votes({ b: 2 }));
    // b (2) before a (0) before c (0); a vs c broken by position
    expect(out.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sortCards`
Expected: FAIL — module `@/utils/sortCards` not found.

- [ ] **Step 3: Implement the helper**

```ts
// utils/sortCards.ts
import type { Card, CardSort } from '@/types';

/**
 * Pure card sorter. Caller supplies a vote-count function so consumers can
 * choose whether merged-child votes roll up into the parent (Grid) or stay
 * per-card (Swimlane / Mobile).
 */
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- sortCards`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add utils/sortCards.ts lib/__tests__/sortCards.test.ts
git commit -m "feat(utils): sortCards helper (votes_desc/asc/manual)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `formatReactorList` helper (TDD)

**Files:**
- Create: `utils/formatReactorList.ts`
- Create: `lib/__tests__/formatReactorList.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/formatReactorList.test.ts
import { describe, it, expect } from 'vitest';
import { formatReactorList } from '@/utils/formatReactorList';
import type { Participant } from '@/types';

function p(id: string, name: string): Participant {
  return {
    id,
    board_id: 'b1',
    display_name: name,
    is_admin: false,
    user_id: null,
    joined_at: '2026-05-25T00:00:00Z',
    last_seen: '2026-05-25T00:00:00Z',
  };
}

const PEOPLE = [p('1', 'Jordan'), p('2', 'Charlton'), p('3', 'Harry')];

describe('formatReactorList', () => {
  it('maps participant IDs to display names in input order', () => {
    const out = formatReactorList(['1', '2', '3'], PEOPLE, null);
    expect(out.entries).toEqual([
      { id: '1', name: 'Jordan', isMine: false },
      { id: '2', name: 'Charlton', isMine: false },
      { id: '3', name: 'Harry', isMine: false },
    ]);
    expect(out.overflow).toBe(0);
  });

  it('tags the current participant as mine', () => {
    const out = formatReactorList(['2', '1'], PEOPLE, '1');
    expect(out.entries.find((e) => e.id === '1')?.isMine).toBe(true);
    expect(out.entries.find((e) => e.id === '2')?.isMine).toBe(false);
  });

  it('renders unknown IDs as Someone', () => {
    const out = formatReactorList(['1', 'ghost'], PEOPLE, null);
    expect(out.entries[1]).toEqual({ id: 'ghost', name: 'Someone', isMine: false });
  });

  it('caps at 8 entries and reports overflow', () => {
    const ids = Array.from({ length: 11 }, (_, i) => String(i + 1));
    const people = ids.map((id) => p(id, `User${id}`));
    const out = formatReactorList(ids, people, null);
    expect(out.entries).toHaveLength(8);
    expect(out.entries[0].name).toBe('User1');
    expect(out.entries[7].name).toBe('User8');
    expect(out.overflow).toBe(3);
  });

  it('handles empty reactor list', () => {
    const out = formatReactorList([], PEOPLE, '1');
    expect(out.entries).toEqual([]);
    expect(out.overflow).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- formatReactorList`
Expected: FAIL — module `@/utils/formatReactorList` not found.

- [ ] **Step 3: Implement the formatter**

```ts
// utils/formatReactorList.ts
import type { Participant } from '@/types';

export interface ReactorEntry {
  id: string;
  name: string;     // display_name or "Someone"
  isMine: boolean;
}

export interface FormattedReactors {
  entries: ReactorEntry[];   // capped at MAX_REACTOR_NAMES
  overflow: number;          // count of names beyond the cap
}

export const MAX_REACTOR_NAMES = 8;

export function formatReactorList(
  reactorIds: string[],
  participants: Participant[],
  currentParticipantId: string | null,
): FormattedReactors {
  const byId = new Map(participants.map((p) => [p.id, p.display_name]));
  const visible = reactorIds.slice(0, MAX_REACTOR_NAMES);
  const overflow = Math.max(0, reactorIds.length - MAX_REACTOR_NAMES);

  const entries: ReactorEntry[] = visible.map((id) => ({
    id,
    name: byId.get(id) ?? 'Someone',
    isMine: id === currentParticipantId,
  }));

  return { entries, overflow };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- formatReactorList`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add utils/formatReactorList.ts lib/__tests__/formatReactorList.test.ts
git commit -m "feat(utils): formatReactorList for reaction tooltips

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Widen `updateColumn` to accept `sort_by`

**Files:**
- Modify: `stores/boardStore.ts` (line 40 — the `updateColumn` signature in the store interface)

- [ ] **Step 1: Locate the current signature**

Open `stores/boardStore.ts` and find line 40, which currently reads:

```ts
updateColumn: (columnId: string, updates: Partial<Pick<Column, 'title' | 'color' | 'description'>>) => Promise<void>;
```

- [ ] **Step 2: Add `sort_by` to the allowed update keys**

Replace that line with:

```ts
updateColumn: (columnId: string, updates: Partial<Pick<Column, 'title' | 'color' | 'description' | 'sort_by'>>) => Promise<void>;
```

(The implementation body around line 397 spreads `updates` into the column object and into the PATCH request body — no changes needed there.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors fewer than Task 1 — at least the store signature now lets callers pass `sort_by`. Remaining errors will be elsewhere (component prop spreading or API route, both fixed in Task 6+).

- [ ] **Step 4: Commit**

```bash
git add stores/boardStore.ts
git commit -m "feat(store): updateColumn accepts sort_by

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: API — `PATCH /api/boards/[boardId]/columns` accepts `sort_by`

**Files:**
- Modify: `app/api/boards/[boardId]/columns/route.ts` (the PATCH handler)

No vitest test added — the existing route tests pattern in this repo is logic-tests-only (see `lib/__tests__/`). Coverage comes from the smoke test (Task 14) and the `isCardSort` test (Task 1).

- [ ] **Step 1: Update imports**

At the top of `app/api/boards/[boardId]/columns/route.ts`, add `isCardSort` to the import from `@/types`. The file currently imports from `@/lib/db`, `@/lib/ably-server`, and `next/server` only. Add this new import line near the top:

```ts
import { isCardSort } from '@/types';
```

- [ ] **Step 2: Add the validation + branch in PATCH**

After the existing `if (updates.description !== undefined)` block (around line 38) and before the `SELECT * FROM columns ...` line (around line 41), insert:

```ts
  if (updates.sort_by !== undefined) {
    if (!isCardSort(updates.sort_by)) {
      return NextResponse.json({ error: 'Invalid sort_by' }, { status: 400 });
    }
    await sql`UPDATE columns SET sort_by = ${updates.sort_by} WHERE id = ${columnId} AND board_id = ${boardId}`;
  }
```

The subsequent `SELECT *` re-fetch and `channel.publish('column-updated', { column })` reuse the existing pattern — no other changes in this file.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: This file is clean. Remaining type errors are downstream UI files, fixed in later tasks.

- [ ] **Step 4: Smoke the endpoint manually (optional but cheap)**

Start the dev server in another terminal (`npm run dev`) and curl the PATCH (substitute IDs):

```bash
curl -X PATCH http://localhost:3000/api/boards/<boardId>/columns \
  -H 'Content-Type: application/json' \
  -d '{"columnId":"<colId>","updates":{"sort_by":"votes_asc"}}'
```

Expected: 200 with the column row showing `"sort_by":"votes_asc"`. Then PATCH with `"sort_by":"bogus"` and expect 400.

Stop the dev server before continuing.

- [ ] **Step 5: Commit**

```bash
git add app/api/boards/[boardId]/columns/route.ts
git commit -m "feat(api): columns PATCH accepts sort_by (validates via isCardSort)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `ColumnSortMenu` component

**Files:**
- Create: `components/Board/ColumnSortMenu.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/Board/ColumnSortMenu.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { IconButton } from '@/components/common/IconButton';
import type { CardSort } from '@/types';

interface ColumnSortMenuProps {
  value: CardSort;
  onChange: (next: CardSort) => void;
  /** Force-hide on mobile / non-admin contexts. */
  disabled?: boolean;
}

const OPTIONS: { value: CardSort; label: string }[] = [
  { value: 'votes_desc', label: 'Most votes' },
  { value: 'votes_asc', label: 'Fewest votes' },
  { value: 'manual', label: 'Manual' },
];

export function ColumnSortMenu({ value, onChange, disabled }: ColumnSortMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (disabled) return null;

  return (
    <div className="relative" ref={ref}>
      <IconButton
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="Sort cards"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Sort cards"
      >
        <ArrowUpDown size={14} />
      </IconButton>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)]"
        >
          {OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors hover:bg-[var(--surface-muted)]',
                  active ? 'text-[var(--ink)] font-medium' : 'text-[var(--ink-3)]'
                )}
              >
                <Check size={14} className={cn(active ? 'opacity-100' : 'opacity-0')} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: this file is clean. Existing downstream errors persist; fixed in Tasks 10–12.

- [ ] **Step 3: Commit**

```bash
git add components/Board/ColumnSortMenu.tsx
git commit -m "feat(board): ColumnSortMenu component (admin-only sort dropdown)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `ReactionPill` component

**Files:**
- Create: `components/Board/ReactionPill.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/Board/ReactionPill.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatReactorList } from '@/utils/formatReactorList';
import type { Participant } from '@/types';

interface ReactionPillProps {
  emoji: string;
  reactorIds: string[];
  participants: Participant[];
  currentParticipantId: string | null;
  isMine: boolean;
  onToggle: () => void;
}

export function ReactionPill({
  emoji,
  reactorIds,
  participants,
  currentParticipantId,
  isMine,
  onToggle,
}: ReactionPillProps) {
  const [open, setOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  const { entries, overflow } = formatReactorList(
    reactorIds,
    participants,
    currentParticipantId
  );

  // Outside-click + ESC close (touch + after-open desktop)
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const clearTimers = () => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  };

  const handleMouseEnter = () => {
    if (isTouch) return;
    clearTimers();
    showTimer.current = window.setTimeout(() => setOpen(true), 200);
  };

  const handleMouseLeave = () => {
    if (isTouch) return;
    clearTimers();
    hideTimer.current = window.setTimeout(() => setOpen(false), 100);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      setIsTouch(true);
      // touch: tap shows tooltip, suppress toggle
      e.preventDefault();
      setOpen((v) => !v);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTouch) return; // touch path handled by pointerdown
    onToggle();
  };

  return (
    <div
      ref={wrapRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono cursor-pointer border transition-[background-color,border-color] duration-150',
          isMine
            ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent'
            : 'bg-[var(--surface-muted)] text-[var(--ink-3)] border-transparent hover:bg-[var(--bg-elev)] hover:border-[var(--line)]'
        )}
      >
        <span>{emoji}</span>
        <span className="text-[10px]">{reactorIds.length}</span>
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[260px] min-w-[180px] -translate-x-1/2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-2 text-[12px] shadow-[var(--shadow-md)]"
        >
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-[var(--line)] pb-1">
            <span className="flex items-center gap-1 font-medium text-[var(--ink-2)]">
              <span>{emoji}</span>
              <span>Reactions</span>
            </span>
            {isTouch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--ink-3)] hover:bg-[var(--bg-elev)]"
              >
                {isMine ? <Minus size={10} /> : <Plus size={10} />}
                <span>{isMine ? 'Remove yours' : 'Add yours'}</span>
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-0.5">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  'truncate',
                  entry.isMine
                    ? 'font-semibold text-[var(--accent)]'
                    : 'text-[var(--ink-3)]'
                )}
              >
                {entry.name}
                {entry.isMine ? ' (You)' : ''}
              </li>
            ))}
            {overflow > 0 && (
              <li className="text-[var(--ink-4)]">+ {overflow} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: this file is clean.

- [ ] **Step 3: Commit**

```bash
git add components/Board/ReactionPill.tsx
git commit -m "feat(board): ReactionPill — hover/tap emoji button with reactor tooltip

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Thread `participants` + use `ReactionPill` in `RetroCard`

This task is wider than 2-5 minutes because the prop addition is cross-cutting (RetroCard + each parent that renders it). It's still one atomic change to keep the type-check green at the commit boundary.

**Files:**
- Modify: `components/Board/RetroCard.tsx`
- Modify: `components/Board/BoardColumn.tsx`
- Modify: `components/Board/SwimlaneView.tsx`
- Modify: `components/Board/MobileBoardShell.tsx`
- Modify: `components/pages/BoardPage.tsx`

- [ ] **Step 1: Add `participants` prop to `RetroCard` interface**

In `components/Board/RetroCard.tsx`, update imports (add `Participant` to the type import):

```ts
import type { Card, CardReactions, Participant, Vote } from '@/types';
```

Add to the `RetroCardProps` interface (near the other optional props):

```ts
  participants?: Participant[];
```

Add the prop to the destructured args in the function signature, defaulting to `[]`:

```ts
  participants = [],
```

- [ ] **Step 2: Replace the inline emoji-reaction button block**

In `components/Board/RetroCard.tsx`, find the block currently at lines ~305–323 (the `{Object.entries(reactions).map(...)}` block) and replace just the inner `<button>...</button>` (the pill — NOT the picker) with the new `ReactionPill`.

Add this import near the top:

```ts
import { ReactionPill } from './ReactionPill';
```

Replace the body of the `{Object.entries(reactions).map(...)}` block with:

```tsx
{Object.entries(reactions).map(([emoji, users]) => users.length > 0 && (
  <ReactionPill
    key={emoji}
    emoji={emoji}
    reactorIds={users}
    participants={participants}
    currentParticipantId={currentParticipantId ?? null}
    isMine={users.includes(String(currentParticipantId || ''))}
    onToggle={() => onToggleReaction(id, emoji)}
  />
))}
```

Leave the `{!isCompleted && (<div className="relative" ref={emojiPickerRef}>...)}` picker block underneath unchanged.

- [ ] **Step 3: Thread `participants` through `BoardColumn`**

In `components/Board/BoardColumn.tsx`:

- Add to imports: `import type { Column, Card, Vote, Participant } from '@/types';`
- Add to `BoardColumnProps`: `participants?: Participant[];`
- Add to destructured args: `participants = [],`
- In each `<RetroCard ... />` render (there are two — root card around line 500 and child card around line 563), add: `participants={participants}` as a prop.

- [ ] **Step 4: Thread `participants` through `SwimlaneView`**

In `components/Board/SwimlaneView.tsx`:

- Add to imports: `import type { Column, Card, Vote, Participant } from '@/types';`
- Add to `SwimlaneViewProps`: `participants?: Participant[];`
- Add to destructured args: `participants = [],`
- In the `<RetroCard ... />` render inside the cards map (around line 123), add: `participants={participants}`.

- [ ] **Step 5: Thread `participants` through `MobileBoardShell`**

In `components/Board/MobileBoardShell.tsx`:

- The file already imports `Participant`-adjacent types; update the import line at the top to add `Participant`:

```ts
import type { Column, Card, Vote, ActionItem, CardReactions, Participant } from '@/types';
```

- Add to `MobileBoardShellProps`: `participants: Participant[];` (required — it's always available from the store).
- Add to destructured args: `participants,`
- In the `<RetroCard ... />` render (around line 170), add: `participants={participants}`.

- [ ] **Step 6: Pass `participants` from `BoardPage`**

In `components/pages/BoardPage.tsx`, `participants` is already destructured from the store (line 40). Find each of the three view renders and add the prop:

- `<MobileBoardShell ...>` around line 300: add `participants={participants}`.
- The `<BoardColumn ...>` render inside the Grid map (around line 466): add `participants={participants}`.
- `<SwimlaneView ...>` around line 511: add `participants={participants}`.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors related to `participants` or `ReactionPill`. Errors related to `column.sort_by` may remain (fixed in Tasks 10–12).

- [ ] **Step 8: Smoke-test that reactions still render**

Run `npm run dev` and open a board. Confirm existing reactions display (the pill markup hasn't visually changed — it's the same shape, now wrapped in `ReactionPill`) and hover shows the reactor tooltip.

Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add components/Board/RetroCard.tsx components/Board/BoardColumn.tsx components/Board/SwimlaneView.tsx components/Board/MobileBoardShell.tsx components/pages/BoardPage.tsx
git commit -m "feat(board): emoji pills show reactor tooltip on hover/tap

Threads participants through RetroCard's renderers and swaps the inline
reaction button for the new ReactionPill component.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Wire `ColumnSortMenu` + `sortCards` into Grid (`BoardColumn`)

**Files:**
- Modify: `components/Board/BoardColumn.tsx`

- [ ] **Step 1: Update imports**

In `components/Board/BoardColumn.tsx`, add:

```ts
import { ColumnSortMenu } from './ColumnSortMenu';
import { sortCards } from '@/utils/sortCards';
```

- [ ] **Step 2: Replace the inline `sortedCards` block with the helper**

The current block (lines 232–271, three `useMemo`s: `rootCards`, `voteCountByCard`, `childrenByParent`, `sortedCards`) becomes:

```ts
  // Separate root cards from children
  const rootCards = useMemo(
    () => cards.filter((c) => !c.merged_with),
    [cards]
  );

  // Vote counts per card
  const voteCountByCard = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of votes) {
      map.set(v.card_id, (map.get(v.card_id) || 0) + 1);
    }
    return map;
  }, [votes]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const card of cards) {
      if (card.merged_with) {
        const list = map.get(card.merged_with) || [];
        list.push(card);
        map.set(card.merged_with, list);
      }
    }
    // Children always sorted by raw vote count desc (unchanged from prior behavior)
    for (const [key, list] of map) {
      list.sort((a, b) => (voteCountByCard.get(b.id) || 0) - (voteCountByCard.get(a.id) || 0));
      map.set(key, list);
    }
    return map;
  }, [cards, voteCountByCard]);

  const aggregateVotesFor = useCallback(
    (cardId: string) => {
      const own = voteCountByCard.get(cardId) || 0;
      const kids = childrenByParent.get(cardId) || [];
      return own + kids.reduce((s, c) => s + (voteCountByCard.get(c.id) || 0), 0);
    },
    [voteCountByCard, childrenByParent]
  );

  const sortedCards = useMemo(
    () => sortCards(rootCards, column.sort_by, aggregateVotesFor),
    [rootCards, column.sort_by, aggregateVotesFor]
  );
```

Add `useCallback` to the `react` imports at the top of the file if not present (the file already imports `useState, useRef, useEffect, useMemo`).

- [ ] **Step 3: Widen the `onUpdateColumn` prop type**

`BoardColumn` already accepts `onUpdateColumn` (line 36) but only for `title | color | description`. Widen the type to include `sort_by` to match the store's widened signature (Task 5):

```ts
  onUpdateColumn?: (columnId: string, updates: Partial<Pick<Column, 'title' | 'color' | 'description' | 'sort_by'>>) => void;
```

`BoardPage` already passes the store's `updateColumn` to this prop — no change required there.

- [ ] **Step 4: Render `ColumnSortMenu` in the header (admin-only)**

Find the column-header block (around line 320 — the `<div className="flex items-center gap-2.5 px-[18px] pt-4 pb-3">`). Currently it shows: dot, title, count, optional vote pill, optional admin overflow menu.

Insert this right after the `</span>` for the optional vote pill (around line 361) and before the admin overflow menu (around line 363):

```tsx
{isAdmin && !isCompleted && !isEditingTitle && (
  <ColumnSortMenu
    value={column.sort_by}
    onChange={(next) => onUpdateColumn?.(column.id, { sort_by: next })}
  />
)}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: this file clean. Errors remain only in SwimlaneView/MobileBoardShell (Tasks 11–12) and possibly `column.sort_by` reads that depend on the DB returning the field (which it already does — Task 2 added the column).

- [ ] **Step 6: Smoke**

Run `npm run dev`, open a board as admin, click the new sort icon in a column header. Verify the popover opens, picking "Fewest votes" reorders the column, and a second window viewing the same board picks up the change within a second or two. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add components/Board/BoardColumn.tsx
git commit -m "feat(board): ColumnSortMenu wired into Grid view

Uses sortCards with aggregate-vote function so merged-child votes still
roll up into the parent for sort purposes. Drops the group-size
tiebreaker in favor of position (drag order) as a tiebreak.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Wire `ColumnSortMenu` + `sortCards` into `SwimlaneView`

**Files:**
- Modify: `components/Board/SwimlaneView.tsx`

- [ ] **Step 1: Update imports + props**

Add:

```ts
import { useCallback } from 'react';
import { ColumnSortMenu } from './ColumnSortMenu';
import { sortCards } from '@/utils/sortCards';
```

Add two new props to `SwimlaneViewProps`:

```ts
  isAdmin?: boolean;
  onUpdateColumn?: (columnId: string, updates: { sort_by: import('@/types').CardSort }) => void;
```

And to destructured args: `isAdmin, onUpdateColumn,`.

- [ ] **Step 2: Compute vote counts once**

Add a memoized vote-count map at the top of the function body (right after `sortedColumns`):

```ts
  const voteCountByCard = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of votes) map.set(v.card_id, (map.get(v.card_id) || 0) + 1);
    return map;
  }, [votes]);

  const voteCountFor = useCallback(
    (id: string) => voteCountByCard.get(id) || 0,
    [voteCountByCard]
  );
```

(Add `useMemo` to the `react` import if not already there.)

- [ ] **Step 3: Replace inline sort with `sortCards`**

In the `sortedColumns.map((col) => {...})` block, replace this:

```ts
const colCards = cards
  .filter((c) => c.column_id === col.id && !c.merged_with)
  .sort((a, b) => {
    const aVotes = votes.filter((v) => v.card_id === a.id).length;
    const bVotes = votes.filter((v) => v.card_id === b.id).length;
    if (bVotes !== aVotes) return bVotes - aVotes;
    return a.position - b.position;
  });
```

with:

```ts
const colCards = sortCards(
  cards.filter((c) => c.column_id === col.id && !c.merged_with),
  col.sort_by,
  voteCountFor
);
```

- [ ] **Step 4: Render the sort menu in the swimlane row header**

In the swimlane row header `<button onClick={() => toggleRow(col.id)} ...>` block (around line 87), inject the sort menu near the right side. Since this header is itself a `<button>`, the menu needs to be a sibling outside the toggle button to avoid nested-interactive issues. Restructure the row header from:

```tsx
<button onClick={() => toggleRow(col.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]">
  {/* …existing content… */}
</button>
```

to:

```tsx
<div className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]">
  <button
    onClick={() => toggleRow(col.id)}
    className="flex flex-1 items-center gap-3 text-left"
  >
    {/* …existing content (chevron, dot, title, count badge, vote badge)… */}
  </button>
  {isAdmin && onUpdateColumn && (
    <ColumnSortMenu
      value={col.sort_by}
      onChange={(next) => onUpdateColumn(col.id, { sort_by: next })}
    />
  )}
</div>
```

Keep all existing classes and content inside the inner `<button>`.

- [ ] **Step 5: Pass new props from `BoardPage`**

In `components/pages/BoardPage.tsx`, the `<SwimlaneView ...>` render needs two new props:

```tsx
isAdmin={isAdmin}
onUpdateColumn={updateColumn}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: SwimlaneView and BoardPage clean.

- [ ] **Step 7: Smoke**

Open the board, switch to swimlane view (`?view=swimlane`), verify sort menu appears next to each row header for admins, picking a sort reorders the cards in that row, and changes propagate to other viewers.

- [ ] **Step 8: Commit**

```bash
git add components/Board/SwimlaneView.tsx components/pages/BoardPage.tsx
git commit -m "feat(board): ColumnSortMenu wired into Swimlane view

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Wire `ColumnSortMenu` + `sortCards` into `MobileBoardShell`

**Files:**
- Modify: `components/Board/MobileBoardShell.tsx`

- [ ] **Step 1: Update imports + props**

Add to imports:

```ts
import { ColumnSortMenu } from './ColumnSortMenu';
import { sortCards } from '@/utils/sortCards';
import { useMemo, useCallback } from 'react';
```

(Merge with the existing `useState, useMemo` import.)

Add a new prop:

```ts
  onUpdateColumn?: (columnId: string, updates: { sort_by: import('@/types').CardSort }) => void;
```

Add to destructured args: `onUpdateColumn,`.

- [ ] **Step 2: Replace inline sort with `sortCards`**

In the `rootCards` `useMemo` (around line 94), replace its body:

```ts
  const voteCountByCard = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of votes) map.set(v.card_id, (map.get(v.card_id) || 0) + 1);
    return map;
  }, [votes]);

  const voteCountFor = useCallback(
    (id: string) => voteCountByCard.get(id) || 0,
    [voteCountByCard]
  );

  const rootCards = useMemo(
    () => sortCards(
      cards.filter((c) => c.column_id === activeColumn?.id && !c.merged_with),
      activeColumn?.sort_by ?? 'votes_desc',
      voteCountFor
    ),
    [cards, activeColumn, voteCountFor]
  );
```

- [ ] **Step 3: Render the sort menu in the active-column header area**

Above the cards list (after the merge banner around line 160 and before the `<div className="flex-1 px-4 pt-3 ...">` cards container), inject:

```tsx
{isAdmin && onUpdateColumn && activeColumn && (
  <div className="flex items-center justify-end px-4 pt-2">
    <ColumnSortMenu
      value={activeColumn.sort_by}
      onChange={(next) => onUpdateColumn(activeColumn.id, { sort_by: next })}
    />
  </div>
)}
```

- [ ] **Step 4: Pass the new prop from `BoardPage`**

In `components/pages/BoardPage.tsx`, the `<MobileBoardShell ...>` render needs:

```tsx
onUpdateColumn={updateColumn}
```

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit`
Then: `npm run build`
Expected: clean.

- [ ] **Step 6: Smoke (mobile viewport)**

Run `npm run dev`. Open the board with a mobile viewport (Chrome dev tools, < 768px). As admin, verify the sort icon appears above the cards in the active column, picking a sort reorders, and another participant's window picks up the change in real time.

- [ ] **Step 7: Commit**

```bash
git add components/Board/MobileBoardShell.tsx components/pages/BoardPage.tsx
git commit -m "feat(board): ColumnSortMenu wired into Mobile shell

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Type-check, build, lint, and run the full test suite

**Files:** None changed. Verification only.

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success, all routes compiled.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 0 errors. If a pre-existing lint error appears (per memory: the `set-state-in-effect` rule on BoardPage.tsx:82), confirm it's unrelated to this change and proceed.

- [ ] **Step 4: Test**

Run: `npm test`
Expected: all tests pass (the existing ones plus the four new files: `card-sort-type`, `sortCards`, `formatReactorList`, plus the pre-existing tests).

---

### Task 14: Manual smoke test (per `ui-feature-verify`)

**Files:** None changed. End-to-end manual verification.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Open the served URL (likely http://localhost:3000 — check console output, see project `feedback_dev_server_port.md`).

- [ ] **Step 2: Verify the spec's smoke list**

Open the same board in two browser windows (one signed in as the board's owner/facilitator, one as a non-admin participant).

Confirm:

1. Default sort on every column is "Most votes" (no perceived behavior change vs. before).
2. Admin's window shows the sort icon in each column header. Non-admin window does not.
3. Admin changes column A to "Fewest votes" → column A reorders in both windows within ~1 second. Column B unchanged.
4. Admin sets column B to "Manual" → drag-to-reorder works and the order matches in both windows.
5. Hover an emoji pill (desktop): tooltip lists reactor display names. Your own row is bolded with "(You)".
6. Tap an emoji pill (touch / responsive view): tooltip opens, "Add yours" / "Remove yours" button works, tap outside closes.
7. Use the admin participants panel to remove a participant who has reacted. Reload. That reaction renders as "Someone"; counts remain accurate.

- [ ] **Step 3: Stop the dev server**

Per `feedback_dev_server_vs_build.md`, do not run a build alongside the dev server. If you need a build later, stop dev first.

- [ ] **Step 4: Final commit if anything was tweaked during smoke**

If smoke uncovered a fix, commit it with `fix(board): <description>` and re-run Task 13.

---

## Definition of done

- All 14 tasks above checked off.
- New tests added: `card-sort-type`, `sortCards`, `formatReactorList`.
- `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm test` all clean.
- Smoke list in Task 14 fully verified in browser.
- Spec's "Known limitations" still accurately describe what's *not* fixed (server-side facilitator gating on column PATCH, "+N more" expansion).

## Notes for the implementer

- The plan never widens scope. Do not "while you're here" refactor `boardStore.ts` (memory note: it's 837 lines and a known split candidate — explicitly out of scope here).
- Tests live under `lib/__tests__/` because the vitest config only globs `lib/**` and `app/**`. Putting utility tests in `utils/__tests__/` would silently never run.
- Commit after every task — frequent commits are the norm in this repo (`git log` shows lots of small commits per feature branch).
- All commits should end with the existing footer used in this repo:

  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
