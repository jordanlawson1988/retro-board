import type { Card, CardSort } from '@/types';

export interface SortContext {
  votingEnabled: boolean;
  secretVoting: boolean;
  isCompleted: boolean;
}

/**
 * Vote-based sorts apply live, including while voting is active — the board
 * must always read most→least voted (facilitator decision, 2026-08-13; this
 * supersedes the earlier freeze-during-voting behavior). The one hold-back:
 * on secret boards, vote order would leak the hidden counts, so cards keep
 * manual (position) order until the retro is completed.
 */
export function effectiveCardSort(sortBy: CardSort, ctx: SortContext): CardSort {
  if (sortBy === 'manual') return sortBy;
  const secretPending = ctx.secretVoting && !ctx.isCompleted;
  return secretPending ? 'manual' : sortBy;
}

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
