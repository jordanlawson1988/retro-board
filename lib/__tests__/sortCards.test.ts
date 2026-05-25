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
