# Completed-Board Vote Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On completed retro boards, show vote counts on every card (even when `secret_voting` was on during the session) and reveal voter names on hover/tap — while keeping active-board voting blind and respecting the secret-voting promise (counts revealed, names not).

**Architecture:** Extract a pure decision function (`lib/votePillPolicy.ts`) that decides what to render based on `(mode, voteCount, hasVoted, secretVoting, isCompleted)`. Factor the hover/tap tooltip wrapper out of `ReactionPill` into a shared `PeoplePopover` primitive. Build one `VotePill` React component as a thin renderer over the policy + the popover + a `formatVoterList` helper. Replace every inline vote-display in `RetroCard`, `ListView`, and `TimelineView` with `<VotePill />`. Side-effect: closes a latent bug where List/Timeline kept showing an interactive vote button on completed boards.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind 4, Vitest (node env, lib + app glob), lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-28-completed-board-vote-visibility-design.md`

---

## File Map

| Status | Path | Responsibility |
|---|---|---|
| Modify | `utils/constants.ts` | Add shared `MAX_PEOPLE_NAMES = 8` constant (final location after code review). |
| Modify | `utils/formatReactorList.ts` | Drop local `MAX_REACTOR_NAMES`; import `MAX_PEOPLE_NAMES` from `@/utils/constants`. |
| Modify | `lib/__tests__/formatReactorList.test.ts` | Assert `MAX_PEOPLE_NAMES` from `@/utils/constants`. |
| New | `utils/formatVoterList.ts` | ID → display-name list with "You"/"Someone" handling. Mirrors `formatReactorList`. |
| New | `lib/__tests__/formatVoterList.test.ts` | Formatter tests, row-for-row mirror of `formatReactorList.test.ts`. |
| New | `lib/votePillPolicy.ts` | Pure decision function: `(input) → { render, showCount, popover, interactive, ariaLabel }`. |
| New | `lib/__tests__/votePillPolicy.test.ts` | Exhaustive table-driven test of the display matrix. Includes the explicit secret-completed contract test. |
| New | `components/common/PeoplePopover.tsx` | Shared hover/tap tooltip wrapper. Render-prop trigger; renders heading + entries + overflow + optional touch action. Lifted from `ReactionPill`. |
| Modify | `components/Board/ReactionPill.tsx` | Refactor to use `PeoplePopover`. Behavior unchanged. |
| New | `components/Board/VotePill.tsx` | Thin renderer: calls `votePillPolicy`, renders one of (PeoplePopover, static span, vote button, voted badge, nothing). |
| Modify | `components/Board/RetroCard.tsx` | Replace inline vote pill/button (lines ~209–239) with `<VotePill />`. |
| Modify | `components/Board/ListView.tsx` | Replace inline vote button (lines ~189–205) with `<VotePill />`; pass `isCompleted`, `secretVoting`, `participants`. |
| Modify | `components/Board/TimelineView.tsx` | Replace inline vote button (lines ~143–158) with `<VotePill />`; pass `isCompleted`, `secretVoting`, `participants`. |
| Modify | `components/pages/BoardPage.tsx` | Add `isCompleted`, `secretVoting`, `participants`, `currentParticipantId` to `ListView` and `TimelineView` prop passing. |

Test path note: `vitest.config.ts` globs `lib/**/*.test.ts` and `app/**/*.test.ts` only. All new unit tests therefore live under `lib/__tests__/`. No React component tests (no RTL/jsdom in the project) — `VotePill` is tested via its underlying pure policy function.

Branch convention: this work happens on `develop` directly (per project CLAUDE.md: `feature/*` → `develop` → `main`). Each task ends in its own commit on `develop`. No deploy until Task 10 explicitly approves.

---

### Task 1: Rename `MAX_REACTOR_NAMES` → `MAX_PEOPLE_NAMES` (shared constant)

**Files:**
- Modify: `utils/formatReactorList.ts`
- Modify: `lib/__tests__/formatReactorList.test.ts`

- [ ] **Step 1: Rename the constant in the formatter**

Edit `utils/formatReactorList.ts`. Replace the existing constant export and its in-function reference:

```ts
import type { Participant } from '@/types';

export interface ReactorEntry {
  id: string;
  name: string;     // display_name or "Someone"
  isMine: boolean;
}

export interface FormattedReactors {
  entries: ReactorEntry[];   // capped at MAX_PEOPLE_NAMES
  overflow: number;          // count of names beyond the cap
}

export const MAX_PEOPLE_NAMES = 8;

export function formatReactorList(
  reactorIds: string[],
  participants: Participant[],
  currentParticipantId: string | null,
): FormattedReactors {
  const byId = new Map(participants.map((p) => [p.id, p.display_name]));
  const visible = reactorIds.slice(0, MAX_PEOPLE_NAMES);
  const overflow = Math.max(0, reactorIds.length - MAX_PEOPLE_NAMES);

  const entries: ReactorEntry[] = visible.map((id) => ({
    id,
    name: byId.get(id) ?? 'Someone',
    isMine: id === currentParticipantId,
  }));

  return { entries, overflow };
}
```

- [ ] **Step 2: Update the existing test's import**

The current test does not import `MAX_REACTOR_NAMES` (verified — it imports only `formatReactorList`), so no import change is needed. But add an assertion that exercises the new exported name to lock it in:

Open `lib/__tests__/formatReactorList.test.ts` and add this case at the end of the `describe('formatReactorList', ...)` block (just before the closing `});`):

```ts
  it('exports MAX_PEOPLE_NAMES as the cap', async () => {
    const mod = await import('@/utils/formatReactorList');
    expect(mod.MAX_PEOPLE_NAMES).toBe(8);
  });
```

- [ ] **Step 3: Grep for any other consumers of the old constant name**

Run: `grep -rn "MAX_REACTOR_NAMES" --include="*.ts" --include="*.tsx" .`

Expected: no matches (the constant was only used inside `formatReactorList.ts`). If matches exist, update them to `MAX_PEOPLE_NAMES`.

- [ ] **Step 4: Run tests**

Run: `npm test -- formatReactorList`
Expected: PASS — all six tests (five existing + one new MAX_PEOPLE_NAMES assertion).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 6: Commit**

```bash
git add utils/formatReactorList.ts lib/__tests__/formatReactorList.test.ts
git commit -m "$(cat <<'EOF'
refactor: rename MAX_REACTOR_NAMES → MAX_PEOPLE_NAMES

Same cap (8), shared with the upcoming voter list formatter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `formatVoterList` utility (TDD)

**Files:**
- Create: `utils/formatVoterList.ts`
- Create: `lib/__tests__/formatVoterList.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/formatVoterList.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatVoterList } from '@/utils/formatVoterList';
import type { Participant } from '@/types';

function p(id: string, name: string): Participant {
  return {
    id,
    board_id: 'b1',
    display_name: name,
    is_admin: false,
    user_id: null,
    joined_at: '2026-05-28T00:00:00Z',
    last_seen: '2026-05-28T00:00:00Z',
  };
}

const PEOPLE = [p('1', 'Jordan'), p('2', 'Charlton'), p('3', 'Harry')];

describe('formatVoterList', () => {
  it('maps voter IDs to display names in input order', () => {
    const out = formatVoterList(['1', '2', '3'], PEOPLE, null);
    expect(out.entries).toEqual([
      { id: '1', name: 'Jordan', isMine: false },
      { id: '2', name: 'Charlton', isMine: false },
      { id: '3', name: 'Harry', isMine: false },
    ]);
    expect(out.overflow).toBe(0);
  });

  it('tags the current participant as mine', () => {
    const out = formatVoterList(['2', '1'], PEOPLE, '1');
    expect(out.entries.find((e) => e.id === '1')?.isMine).toBe(true);
    expect(out.entries.find((e) => e.id === '2')?.isMine).toBe(false);
  });

  it('renders unknown IDs as Someone', () => {
    const out = formatVoterList(['1', 'ghost'], PEOPLE, null);
    expect(out.entries[1]).toEqual({ id: 'ghost', name: 'Someone', isMine: false });
  });

  it('caps at MAX_PEOPLE_NAMES entries and reports overflow', () => {
    const ids = Array.from({ length: 11 }, (_, i) => String(i + 1));
    const people = ids.map((id) => p(id, `User${id}`));
    const out = formatVoterList(ids, people, null);
    expect(out.entries).toHaveLength(8);
    expect(out.entries[0].name).toBe('User1');
    expect(out.entries[7].name).toBe('User8');
    expect(out.overflow).toBe(3);
  });

  it('handles empty voter list', () => {
    const out = formatVoterList([], PEOPLE, '1');
    expect(out.entries).toEqual([]);
    expect(out.overflow).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- formatVoterList`
Expected: FAIL — `Cannot find module '@/utils/formatVoterList'`.

- [ ] **Step 3: Implement the formatter**

Create `utils/formatVoterList.ts`:

```ts
import type { Participant } from '@/types';
import { MAX_PEOPLE_NAMES } from '@/utils/formatReactorList';

export interface VoterEntry {
  id: string;
  name: string;     // display_name or "Someone"
  isMine: boolean;
}

export interface FormattedVoters {
  entries: VoterEntry[];   // capped at MAX_PEOPLE_NAMES
  overflow: number;        // count of names beyond the cap
}

export function formatVoterList(
  voterIds: string[],
  participants: Participant[],
  currentParticipantId: string | null,
): FormattedVoters {
  const byId = new Map(participants.map((p) => [p.id, p.display_name]));
  const visible = voterIds.slice(0, MAX_PEOPLE_NAMES);
  const overflow = Math.max(0, voterIds.length - MAX_PEOPLE_NAMES);

  const entries: VoterEntry[] = visible.map((id) => ({
    id,
    name: byId.get(id) ?? 'Someone',
    isMine: id === currentParticipantId,
  }));

  return { entries, overflow };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- formatVoterList`
Expected: PASS — all five tests.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/formatVoterList.ts lib/__tests__/formatVoterList.test.ts
git commit -m "$(cat <<'EOF'
feat(util): add formatVoterList helper

Mirrors formatReactorList: maps voter IDs to display names with "You"/
"Someone" handling and an 8-entry cap. Used by the upcoming VotePill.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add `votePillPolicy` decision function (TDD, exhaustive matrix)

**Files:**
- Create: `lib/votePillPolicy.ts`
- Create: `lib/__tests__/votePillPolicy.test.ts`

- [ ] **Step 1: Write the failing test (exhaustive matrix + contract case)**

Create `lib/__tests__/votePillPolicy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { votePillPolicy } from '@/lib/votePillPolicy';
import type { VotePillPolicyInput } from '@/lib/votePillPolicy';

function input(overrides: Partial<VotePillPolicyInput>): VotePillPolicyInput {
  return {
    voteCount: 0,
    mode: 'interactive',
    hasVoted: false,
    secretVoting: false,
    isCompleted: false,
    ...overrides,
  };
}

describe('votePillPolicy', () => {
  describe('active board (interactive mode)', () => {
    it('non-secret, count > 0: pill with count, no popover, interactive', () => {
      const out = votePillPolicy(input({ voteCount: 3, mode: 'interactive' }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });

    it('non-secret, count == 0: pill without count, interactive (empty vote button)', () => {
      const out = votePillPolicy(input({ voteCount: 0, mode: 'interactive' }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(false);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });

    it('secret + hasVoted: voted-badge, no count, no popover, interactive', () => {
      const out = votePillPolicy(input({
        voteCount: 2,
        mode: 'interactive',
        hasVoted: true,
        secretVoting: true,
      }));
      expect(out.render).toBe('voted-badge');
      expect(out.showCount).toBe(false);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });

    it('secret + !hasVoted: pill without count, interactive (empty vote button)', () => {
      const out = votePillPolicy(input({
        voteCount: 2,
        mode: 'interactive',
        hasVoted: false,
        secretVoting: true,
      }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(false);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(true);
    });
  });

  describe('completed board (readonly mode)', () => {
    it('non-secret, count > 0: pill with count, popover shows voters, NOT interactive', () => {
      const out = votePillPolicy(input({
        voteCount: 4,
        mode: 'readonly',
        isCompleted: true,
      }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('voters');
      expect(out.interactive).toBe(false);
    });

    it('non-secret, count == 0: render none', () => {
      const out = votePillPolicy(input({
        voteCount: 0,
        mode: 'readonly',
        isCompleted: true,
      }));
      expect(out.render).toBe('none');
    });

    it('secret, count > 0: pill with count, NO popover, NOT interactive', () => {
      const out = votePillPolicy(input({
        voteCount: 5,
        mode: 'readonly',
        secretVoting: true,
        isCompleted: true,
      }));
      expect(out.render).toBe('pill');
      expect(out.showCount).toBe(true);
      expect(out.popover).toBe('none');
      expect(out.interactive).toBe(false);
    });

    it('secret, count == 0: render none', () => {
      const out = votePillPolicy(input({
        voteCount: 0,
        mode: 'readonly',
        secretVoting: true,
        isCompleted: true,
      }));
      expect(out.render).toBe('none');
    });
  });

  it('CONTRACT: secret-voting + completed reveals counts but hides voter names', () => {
    // Explicit contract test — regression here would silently violate the
    // secret-voting promise documented in the design spec. If this changes,
    // the change is intentional and the spec must be updated first.
    const out = votePillPolicy(input({
      voteCount: 7,
      mode: 'readonly',
      secretVoting: true,
      isCompleted: true,
    }));
    expect(out.showCount).toBe(true);
    expect(out.popover).toBe('none');
  });

  describe('ariaLabel', () => {
    it('interactive non-voted: "Vote for this card"', () => {
      const out = votePillPolicy(input({ voteCount: 1, mode: 'interactive', hasVoted: false }));
      expect(out.ariaLabel).toBe('Vote for this card');
    });

    it('interactive voted: "Remove vote"', () => {
      const out = votePillPolicy(input({ voteCount: 1, mode: 'interactive', hasVoted: true }));
      expect(out.ariaLabel).toBe('Remove vote');
    });

    it('readonly non-secret: "N votes — hover to see voters" with count', () => {
      const out = votePillPolicy(input({ voteCount: 3, mode: 'readonly', isCompleted: true }));
      expect(out.ariaLabel).toBe('3 votes — hover to see voters');
    });

    it('readonly non-secret single vote: "1 vote — hover to see voters"', () => {
      const out = votePillPolicy(input({ voteCount: 1, mode: 'readonly', isCompleted: true }));
      expect(out.ariaLabel).toBe('1 vote — hover to see voters');
    });

    it('readonly secret: "N votes" (no "hover" suffix — there is no tooltip)', () => {
      const out = votePillPolicy(input({
        voteCount: 4, mode: 'readonly', secretVoting: true, isCompleted: true,
      }));
      expect(out.ariaLabel).toBe('4 votes');
    });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- votePillPolicy`
Expected: FAIL — `Cannot find module '@/lib/votePillPolicy'`.

- [ ] **Step 3: Implement the policy**

Create `lib/votePillPolicy.ts`:

```ts
export interface VotePillPolicyInput {
  voteCount: number;
  mode: 'interactive' | 'readonly';
  hasVoted: boolean;
  secretVoting: boolean;
  isCompleted: boolean;
}

export interface VotePillPolicyOutput {
  /** Top-level: what to render. */
  render: 'pill' | 'voted-badge' | 'none';
  /** Whether the numeric count is visible on the pill. */
  showCount: boolean;
  /** Whether hover/tap opens a popover with voter names. */
  popover: 'voters' | 'none';
  /** Whether the pill is an active vote-toggle button. */
  interactive: boolean;
  /** aria-label string for the rendered element. */
  ariaLabel: string;
}

export function votePillPolicy(input: VotePillPolicyInput): VotePillPolicyOutput {
  const { voteCount, mode, hasVoted, secretVoting, isCompleted } = input;

  // Readonly (completed boards)
  if (mode === 'readonly') {
    if (voteCount === 0) {
      return {
        render: 'none',
        showCount: false,
        popover: 'none',
        interactive: false,
        ariaLabel: '',
      };
    }
    const noun = voteCount === 1 ? 'vote' : 'votes';
    if (secretVoting) {
      return {
        render: 'pill',
        showCount: true,
        popover: 'none',
        interactive: false,
        ariaLabel: `${voteCount} ${noun}`,
      };
    }
    return {
      render: 'pill',
      showCount: true,
      popover: 'voters',
      interactive: false,
      ariaLabel: `${voteCount} ${noun} — hover to see voters`,
    };
  }

  // Interactive (active boards)
  if (secretVoting && hasVoted) {
    return {
      render: 'voted-badge',
      showCount: false,
      popover: 'none',
      interactive: true,
      ariaLabel: 'Remove vote',
    };
  }

  return {
    render: 'pill',
    showCount: !secretVoting && voteCount > 0,
    popover: 'none',
    interactive: true,
    ariaLabel: hasVoted ? 'Remove vote' : 'Vote for this card',
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- votePillPolicy`
Expected: PASS — all matrix cases + contract case + ariaLabel cases.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/votePillPolicy.ts lib/__tests__/votePillPolicy.test.ts
git commit -m "$(cat <<'EOF'
feat(lib): votePillPolicy pure decision function

Encodes the full display matrix for vote pills across (active/completed,
secret/non-secret, voted/unvoted, count==0/count>0). One explicit contract
test asserts secret-voting + completed reveals counts but hides voter names.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Extract `PeoplePopover` primitive from `ReactionPill`

**Files:**
- Create: `components/common/PeoplePopover.tsx`
- Modify: `components/Board/ReactionPill.tsx`

This is a refactor — no user-visible behavior change. Verified by running existing tests + a manual emoji-reaction tap on a board.

- [ ] **Step 1: Create the `PeoplePopover` component**

Create `components/common/PeoplePopover.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface PeoplePopoverEntry {
  id: string;
  name: string;
  isMine: boolean;
}

export interface PeoplePopoverTouchAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface RenderTriggerState {
  /** True if the most recent pointer interaction was touch (no hover). */
  isTouch: boolean;
  /** True if the popover is currently open. */
  isOpen: boolean;
  /** Click handler the trigger should ALSO invoke (e.g., to toggle the reaction). On touch, the popover suppresses this and just toggles open. */
  onTriggerClick: (e: React.MouseEvent) => void;
  /** Pointer-down handler for touch detection. The trigger MUST attach this. */
  onTriggerPointerDown: (e: React.PointerEvent) => void;
}

export interface PeoplePopoverProps {
  /** Render the trigger element with the provided handlers and state. */
  renderTrigger: (state: RenderTriggerState) => ReactNode;
  /** Optional underlying action when the trigger is clicked on desktop (e.g., toggle vote/reaction). On touch, click is suppressed in favor of opening the popover. */
  onClick?: () => void;
  /** Heading row inside the popover panel (e.g., emoji + "Reactions"). */
  heading: ReactNode;
  /** List of people to show. */
  entries: PeoplePopoverEntry[];
  /** Count of additional names beyond the cap. */
  overflow: number;
  /** Optional action button shown in the popover panel on touch devices only (e.g., "Add yours"). */
  touchAction?: PeoplePopoverTouchAction;
}

export function PeoplePopover({
  renderTrigger,
  onClick,
  heading,
  entries,
  overflow,
  touchAction,
}: PeoplePopoverProps) {
  const [open, setOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  // Outside-click + ESC close
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

  const handleTriggerPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      setIsTouch(true);
      // touch: tap shows tooltip, suppress underlying click
      e.preventDefault();
      setOpen((v) => !v);
    }
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTouch) return; // touch path handled by pointerdown
    onClick?.();
  };

  return (
    <div
      ref={wrapRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {renderTrigger({
        isTouch,
        isOpen: open,
        onTriggerClick: handleTriggerClick,
        onTriggerPointerDown: handleTriggerPointerDown,
      })}

      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[260px] min-w-[180px] -translate-x-1/2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-2 text-[12px] shadow-[var(--shadow-md)]"
        >
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-[var(--line)] pb-1">
            <span className="flex items-center gap-1 font-medium text-[var(--ink-2)]">
              {heading}
            </span>
            {isTouch && touchAction && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  touchAction.onClick();
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--ink-3)] hover:bg-[var(--bg-elev)]"
              >
                {touchAction.icon}
                <span>{touchAction.label}</span>
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

- [ ] **Step 2: Refactor `ReactionPill` to use `PeoplePopover`**

Replace the entire contents of `components/Board/ReactionPill.tsx` with:

```tsx
// components/Board/ReactionPill.tsx
'use client';

import { Plus, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatReactorList } from '@/utils/formatReactorList';
import { PeoplePopover } from '@/components/common/PeoplePopover';
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
  const { entries, overflow } = formatReactorList(
    reactorIds,
    participants,
    currentParticipantId
  );

  return (
    <PeoplePopover
      onClick={onToggle}
      heading={
        <>
          <span>{emoji}</span>
          <span>Reactions</span>
        </>
      }
      entries={entries}
      overflow={overflow}
      touchAction={{
        label: isMine ? 'Remove yours' : 'Add yours',
        icon: isMine ? <Minus size={10} /> : <Plus size={10} />,
        onClick: onToggle,
      }}
      renderTrigger={({ onTriggerClick, onTriggerPointerDown }) => (
        <button
          type="button"
          onClick={onTriggerClick}
          onPointerDown={onTriggerPointerDown}
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
      )}
    />
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Run all existing tests**

Run: `npm test`
Expected: PASS — no test should regress.

- [ ] **Step 5: Visual smoke check (deferred to Task 10)**

The full browser-pass is in Task 10. Note here: when verifying, confirm that emoji reactions on an active board still show the names tooltip on hover and the "Add yours / Remove yours" button on touch.

- [ ] **Step 6: Commit**

```bash
git add components/common/PeoplePopover.tsx components/Board/ReactionPill.tsx
git commit -m "$(cat <<'EOF'
refactor(board): extract PeoplePopover primitive from ReactionPill

No user-visible behavior change. Lifts hover/tap timing, outside-click + ESC
dismissal, touch detection, and the entry-list panel into a shared component
that both ReactionPill and the upcoming VotePill consume.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add `VotePill` component (thin renderer over policy + popover)

**Files:**
- Create: `components/Board/VotePill.tsx`

- [ ] **Step 1: Create the component**

Create `components/Board/VotePill.tsx`:

```tsx
'use client';

import { ThumbsUp } from 'lucide-react';
import { cn } from '@/utils/cn';
import { votePillPolicy } from '@/lib/votePillPolicy';
import { formatVoterList } from '@/utils/formatVoterList';
import { PeoplePopover } from '@/components/common/PeoplePopover';
import type { Participant, Vote } from '@/types';

export interface VotePillProps {
  voteCount: number;
  voters: Vote[];                  // full vote rows for THIS card
  participants: Participant[];
  currentParticipantId: string | null;
  mode: 'interactive' | 'readonly';
  // Interactive-mode only:
  hasVoted?: boolean;
  voteLimitReached?: boolean;
  onToggleVote?: () => void;
  // Policy flag:
  secretVoting: boolean;
}

export function VotePill({
  voteCount,
  voters,
  participants,
  currentParticipantId,
  mode,
  hasVoted = false,
  voteLimitReached = false,
  onToggleVote,
  secretVoting,
}: VotePillProps) {
  const policy = votePillPolicy({
    voteCount,
    mode,
    hasVoted,
    secretVoting,
  });

  if (policy.render === 'none') return null;

  if (policy.render === 'voted-badge') {
    // Active board + secret + hasVoted — "Voted" pill
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleVote?.(); }}
        aria-pressed
        aria-label={policy.ariaLabel}
        className="inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 font-mono tabular-nums text-[11px] border transition-[background-color,color,border-color] duration-150 bg-[var(--accent-soft)] text-[var(--accent)] border-transparent"
      >
        <ThumbsUp size={12} />
        <span className="text-[10px]">Voted</span>
      </button>
    );
  }

  // policy.render === 'pill'

  // Readonly + non-secret + count > 0 — popover with voter names
  if (policy.popover === 'voters') {
    const voterIds = voters.map((v) => v.voter_id);
    const { entries, overflow } = formatVoterList(voterIds, participants, currentParticipantId);

    return (
      <PeoplePopover
        heading={
          <>
            <ThumbsUp size={12} />
            <span>Voters</span>
          </>
        }
        entries={entries}
        overflow={overflow}
        renderTrigger={({ onTriggerClick, onTriggerPointerDown }) => (
          <button
            type="button"
            onClick={onTriggerClick}
            onPointerDown={onTriggerPointerDown}
            aria-label={policy.ariaLabel}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-mono tabular-nums text-[var(--ink-4)] cursor-help hover:bg-[var(--bg-elev)] transition-colors"
          >
            <ThumbsUp size={12} />
            <span>{voteCount}</span>
          </button>
        )}
      />
    );
  }

  // Readonly + secret + count > 0 — static count badge, no popover
  if (mode === 'readonly') {
    return (
      <span
        aria-label={policy.ariaLabel}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-mono tabular-nums text-[var(--ink-4)]"
      >
        <ThumbsUp size={12} />
        <span>{voteCount}</span>
      </span>
    );
  }

  // Interactive (active board) — vote toggle button
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggleVote?.(); }}
      disabled={!hasVoted && voteLimitReached}
      aria-pressed={hasVoted}
      aria-label={policy.ariaLabel}
      title={voteLimitReached && !hasVoted ? 'No votes remaining' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 font-mono tabular-nums text-[11px] border transition-[background-color,color,border-color] duration-150',
        hasVoted
          ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent'
          : voteLimitReached
          ? 'cursor-not-allowed bg-[var(--bg-elev)] text-[var(--ink-5)] border-[var(--line)] opacity-50'
          : 'bg-[var(--bg-elev)] text-[var(--ink-3)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
      )}
    >
      <ThumbsUp size={12} />
      {policy.showCount && <span>{voteCount}</span>}
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/Board/VotePill.tsx
git commit -m "$(cat <<'EOF'
feat(board): add VotePill component

Thin renderer over votePillPolicy. Encapsulates all four display states
(interactive button, voted badge for secret active, readonly count with
voter popover, readonly count without popover). Used by RetroCard, ListView,
TimelineView in subsequent tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Integrate `VotePill` into `RetroCard`

**Files:**
- Modify: `components/Board/RetroCard.tsx`

- [ ] **Step 1: Replace inline vote pill/button with `<VotePill />`**

Open `components/Board/RetroCard.tsx`. The current code has two separate rendering branches for votes (lines ~209–239 — one interactive, one read-only). Replace **both** branches with a single `<VotePill />` invocation.

Add the import at the top, alongside the existing imports:

```tsx
import { VotePill } from './VotePill';
```

Then locate the existing vote-rendering block — it currently looks like this (this is the snippet to remove):

```tsx
{/* Vote button (interactive — only when voting enabled and board active) */}
{votingEnabled && !isCompleted && (
  <button
    onClick={(e) => { e.stopPropagation(); onToggleVote(id); }}
    disabled={!hasVoted && voteLimitReached}
    aria-pressed={hasVoted}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 font-mono tabular-nums text-[11px] border transition-[background-color,color,border-color] duration-150',
      hasVoted
        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent'
        : voteLimitReached
        ? 'cursor-not-allowed bg-[var(--bg-elev)] text-[var(--ink-5)] border-[var(--line)] opacity-50'
        : 'bg-[var(--bg-elev)] text-[var(--ink-3)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
    )}
    aria-label={hasVoted ? 'Remove vote' : voteLimitReached ? 'Vote limit reached' : 'Vote for this card'}
    title={voteLimitReached && !hasVoted ? 'No votes remaining' : undefined}
  >
    <ThumbsUp size={12} />
    {secretVoting
      ? (hasVoted && <span className="text-[10px]">Voted</span>)
      : (voteCount > 0 && <span>{voteCount}</span>)
    }
  </button>
)}
{/* Vote count (read-only — voting disabled or board completed) */}
{(!votingEnabled || isCompleted) && !secretVoting && voteCount > 0 && (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-mono tabular-nums text-[var(--ink-4)]">
    <ThumbsUp size={12} />
    <span>{voteCount}</span>
  </span>
)}
```

Replace it with:

```tsx
{votingEnabled && (
  <VotePill
    voteCount={voteCount}
    voters={(votes ?? []).filter((v) => v.card_id === id)}
    participants={participants}
    currentParticipantId={currentParticipantId ?? null}
    mode={isCompleted ? 'readonly' : 'interactive'}
    hasVoted={hasVoted}
    voteLimitReached={voteLimitReached}
    onToggleVote={() => onToggleVote(id)}
    secretVoting={secretVoting}
  />
)}
```

The `ThumbsUp` import from `lucide-react` is still used elsewhere in `RetroCard` (for the emoji palette is `SmilePlus`; `ThumbsUp` is only used in the now-removed code). Check if `ThumbsUp` remains in any other JSX inside `RetroCard.tsx`. If not, remove it from the `lucide-react` import line.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

`RetroCard` already accepts `votes?: Vote[]`, `participants?: Participant[]`, `currentParticipantId?: string | null` (from the merge feature) — no new props needed. `BoardColumn` already passes all three.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/Board/RetroCard.tsx
git commit -m "$(cat <<'EOF'
feat(board): RetroCard uses VotePill

Replaces two inline render branches (interactive button + readonly count)
with one VotePill invocation. Behavior is a strict superset: completed
non-secret boards now reveal voter names on hover; completed secret boards
now show counts that were previously hidden.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Integrate `VotePill` into `ListView`

**Files:**
- Modify: `components/Board/ListView.tsx`
- Modify: `components/pages/BoardPage.tsx`

This also closes the latent "interactive vote button on completed board" bug.

- [ ] **Step 1: Widen `ListView` props**

Open `components/Board/ListView.tsx`. Edit the `ListViewProps` interface to add the three new props:

```tsx
interface ListViewProps {
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  currentParticipantId: string | null;
  isObscured: boolean;
  votingEnabled: boolean;
  maxVotesPerParticipant: number;
  onToggleVote: (cardId: string) => void;
  // NEW:
  isCompleted: boolean;
  secretVoting: boolean;
  participants: Participant[];
}
```

Add `Participant` to the existing type import: `import type { Column, Card, Vote, Participant } from '@/types';`. Add `Participant` to the destructured params in the function signature, and `isCompleted`, `secretVoting` too.

- [ ] **Step 2: Replace the inline vote button with `<VotePill />`**

At the top of `ListView.tsx`, add:

```tsx
import { VotePill } from './VotePill';
```

Locate the inline vote-button block inside the `<td>` (currently around lines 189–205):

```tsx
{votingEnabled && (
  <td className="px-4 py-3">
    <button
      onClick={() => onToggleVote(card.id)}
      disabled={!hasVoted && voteLimitReached}
      className={cn(
        'flex items-center gap-1 rounded-[var(--r-pill)] px-2 py-0.5 text-xs font-mono tabular-nums transition-colors',
        hasVoted
          ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
          : 'text-[var(--ink-4)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink-2)]'
      )}
    >
      <ThumbsUp size={12} />
      <span>{voteCount}</span>
    </button>
  </td>
)}
```

Replace with:

```tsx
{votingEnabled && (
  <td className="px-4 py-3">
    <VotePill
      voteCount={voteCount}
      voters={votes.filter((v) => v.card_id === card.id)}
      participants={participants}
      currentParticipantId={currentParticipantId}
      mode={isCompleted ? 'readonly' : 'interactive'}
      hasVoted={hasVoted}
      voteLimitReached={voteLimitReached}
      onToggleVote={() => onToggleVote(card.id)}
      secretVoting={secretVoting}
    />
  </td>
)}
```

The `ThumbsUp` import is now only used in the table header for the sort indicator — verify with a quick grep inside the file. If `ThumbsUp` is not used elsewhere in `ListView.tsx`, remove it from the `lucide-react` import line. Otherwise leave it.

- [ ] **Step 3: Pass the three new props from `BoardPage.tsx`**

Open `components/pages/BoardPage.tsx`. Find the `<ListView ... />` invocation (currently around lines 536–546):

```tsx
{currentView === 'list' && (
  <ListView
    columns={filteredColumns}
    cards={filteredCards}
    votes={votes}
    currentParticipantId={currentParticipantId}
    isObscured={isObscured}
    votingEnabled={board.settings.voting_enabled}
    maxVotesPerParticipant={board.settings.max_votes_per_participant}
    onToggleVote={toggleVote}
  />
)}
```

Replace with:

```tsx
{currentView === 'list' && (
  <ListView
    columns={filteredColumns}
    cards={filteredCards}
    votes={votes}
    currentParticipantId={currentParticipantId}
    isObscured={isObscured}
    votingEnabled={board.settings.voting_enabled}
    maxVotesPerParticipant={board.settings.max_votes_per_participant}
    onToggleVote={toggleVote}
    isCompleted={isCompleted}
    secretVoting={board.settings.secret_voting}
    participants={participants}
  />
)}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/Board/ListView.tsx components/pages/BoardPage.tsx
git commit -m "$(cat <<'EOF'
feat(board): ListView uses VotePill

Replaces inline vote button. Closes a latent bug: clicking the vote button
on a completed board used to attempt a server toggle (no-op). Now it's
read-only on completed and reveals voter names on hover when non-secret.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Integrate `VotePill` into `TimelineView`

**Files:**
- Modify: `components/Board/TimelineView.tsx`
- Modify: `components/pages/BoardPage.tsx`

Mirror of Task 7. Also closes the latent bug.

- [ ] **Step 1: Widen `TimelineView` props**

Open `components/Board/TimelineView.tsx`. Edit `TimelineViewProps`:

```tsx
interface TimelineViewProps {
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  currentParticipantId: string | null;
  isObscured: boolean;
  votingEnabled: boolean;
  maxVotesPerParticipant: number;
  onToggleVote: (cardId: string) => void;
  // NEW:
  isCompleted: boolean;
  secretVoting: boolean;
  participants: Participant[];
}
```

Add `Participant` to the type import. Add the three new destructured params to the function signature.

- [ ] **Step 2: Replace the inline vote button**

Add the import:

```tsx
import { VotePill } from './VotePill';
```

Locate the inline vote-button block (currently around lines 142–159):

```tsx
{votingEnabled && (
  <div className="mt-2 flex items-center">
    <button
      onClick={() => onToggleVote(card.id)}
      disabled={!hasVoted && voteLimitReached}
      className={cn(
        'flex items-center gap-1 rounded-[var(--r-pill)] px-2 py-0.5 text-xs font-mono tabular-nums transition-colors',
        hasVoted
          ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
          : 'text-[var(--ink-4)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink-2)]'
      )}
    >
      <ThumbsUp size={12} />
      {voteCount > 0 && <span>{voteCount}</span>}
    </button>
  </div>
)}
```

Replace with:

```tsx
{votingEnabled && (
  <div className="mt-2 flex items-center">
    <VotePill
      voteCount={voteCount}
      voters={votes.filter((v) => v.card_id === card.id)}
      participants={participants}
      currentParticipantId={currentParticipantId}
      mode={isCompleted ? 'readonly' : 'interactive'}
      hasVoted={hasVoted}
      voteLimitReached={voteLimitReached}
      onToggleVote={() => onToggleVote(card.id)}
      secretVoting={secretVoting}
    />
  </div>
)}
```

Remove `ThumbsUp` from the `lucide-react` import if no other usage remains in the file (grep to confirm).

- [ ] **Step 3: Pass the three new props from `BoardPage.tsx`**

In `components/pages/BoardPage.tsx`, update the `<TimelineView ... />` invocation (currently around lines 549–558):

```tsx
{currentView === 'timeline' && (
  <TimelineView
    columns={filteredColumns}
    cards={filteredCards}
    votes={votes}
    currentParticipantId={currentParticipantId}
    isObscured={isObscured}
    votingEnabled={board.settings.voting_enabled}
    maxVotesPerParticipant={board.settings.max_votes_per_participant}
    onToggleVote={toggleVote}
    isCompleted={isCompleted}
    secretVoting={board.settings.secret_voting}
    participants={participants}
  />
)}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/Board/TimelineView.tsx components/pages/BoardPage.tsx
git commit -m "$(cat <<'EOF'
feat(board): TimelineView uses VotePill

Same fix as ListView: replaces inline vote button, closes the latent
"interactive vote button on completed board" bug, and reveals voter names
on hover after completion when non-secret.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Full verification — build + types + tests

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — `formatReactorList` (6), `formatVoterList` (5), `votePillPolicy` (13), plus all pre-existing tests.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS — clean build, no warnings about VotePill, ReactionPill, or PeoplePopover.

(Note: per Jordan's standing rule, do NOT run `npm run build` while `npm run dev` is also running — kill the dev server first if active.)

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS — no new warnings or errors introduced by the diff.

If any of the above fail, fix in place (no commit until the gate passes), then re-run the failing command. Do NOT proceed to Task 10 until all four pass.

---

### Task 10: Browser verification (ui-feature-verify gate)

**Files:** none (manual verification)

This task is required by the project's `ui-feature-verify` skill. Tests passing != feature working.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on the project's configured port (per Jordan's instruction, verify port vs `.env.local`).

- [ ] **Step 2: Verify active-board behavior is unchanged**

Open or create a non-secret board with at least one card and one vote. Confirm:
- Vote button on each card looks and behaves identically to before (count visible when >0, click toggles, vote-limit-reached state correct).
- Hovering the vote button does NOT open a voter-names tooltip (intentional — blind voting during active session).
- Emoji reactions still show the names tooltip on hover and the "Add yours / Remove yours" button on touch.

- [ ] **Step 3: Verify completed-board behavior (non-secret)**

Mark the board complete. Confirm:
- Cards with votes show a static count pill (no longer an interactive button).
- Hovering a vote pill opens a tooltip listing voter names. Current user shows `(You)` and is bold/accent-colored.
- Cards with zero votes show no pill at all.
- Test all four views: Grid, Swimlane, List, Timeline. Behavior identical across all four.

- [ ] **Step 4: Verify completed-board behavior (secret voting)**

Create a second board with `secret_voting` enabled. Cast votes from at least two participants. Mark it complete. Confirm:
- Vote counts are now visible (they were hidden previously — this is the new behavior).
- Hovering a vote pill does NOT open a tooltip. No voter names are revealed anywhere.
- Test in all four views.

- [ ] **Step 5: Mobile spot-check**

Open the completed non-secret board on a touch device (or DevTools touch emulation). Tap the vote pill. Confirm:
- Tap opens the voter-names tooltip.
- Tooltip closes on outside tap and on a second tap of the pill.

- [ ] **Step 6: Report**

Confirm to Jordan with a short summary: "All four views verified on completed non-secret board (names revealed on hover) and completed secret board (counts revealed, names hidden). Active-board behavior unchanged."

- [ ] **Step 7: No-op cleanup commit if needed**

If browser verification surfaced any issues, address them in a new commit on `develop`. Otherwise, the feature is complete on `develop` — Jordan decides when to promote to `main` per his standard SDLC flow.

---

## Self-review notes (reviewed inline during plan writing)

- **Spec coverage:** Every spec section maps to at least one task. Display matrix → Task 3. PeoplePopover extraction → Task 4. VotePill → Task 5. Each view integration → Tasks 6–8. Tests → Tasks 1–3 (formatter rename, formatVoterList, votePillPolicy). Browser verify → Task 10.
- **No placeholders:** Every code block is complete. No "TBD", no "add appropriate X".
- **Type/signature consistency:** `VotePillPolicyInput`, `VotePillPolicyOutput`, `VotePillProps`, `formatVoterList` signature, `PeoplePopoverProps` are all defined once and used consistently. `voters: Vote[]` at call sites; `voterIds: string[]` at the formatter boundary.
- **Test ordering:** TDD throughout for new utilities and the policy function. Refactors (Task 1 rename, Task 4 PeoplePopover extraction) verified by running existing tests + browser pass.
- **Commit cadence:** 10 commits — one per task. Each is self-contained and revertible.
