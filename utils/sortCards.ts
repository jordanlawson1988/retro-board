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
