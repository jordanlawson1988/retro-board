import { describe, it, expect } from 'vitest';
import { mergeIncomingCard } from '@/lib/mergeIncomingCard';
import type { Card } from '@/types';

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    column_id: 'col1',
    board_id: 'b1',
    text: 'real text',
    author_name: 'Ada',
    author_id: 'p1',
    color: null,
    position: 0,
    merged_with: null,
    reactions: {},
    created_at: '2026-11-16T00:00:00Z',
    updated_at: '2026-11-16T00:00:00Z',
    is_mine: false,
    text_hidden: false,
    ...overrides,
  };
}

// What Ably delivers: shaped for nobody.
const hiddenEcho = (overrides: Partial<Card> = {}): Card =>
  card({ text: '', text_hidden: true, is_mine: false, author_id: null, author_name: null, ...overrides });

describe('mergeIncomingCard', () => {
  it('returns incoming when there is no local card', () => {
    const incoming = hiddenEcho();
    expect(mergeIncomingCard(undefined, incoming)).toBe(incoming);
  });

  it('own hidden card keeps its text and author while position and reactions update', () => {
    const local = card({ is_mine: true });
    const out = mergeIncomingCard(local, hiddenEcho({ position: 3, reactions: { '👍': ['p2'] }, column_id: 'col2' }));
    expect(out.text).toBe('real text');
    expect(out.author_id).toBe('p1');
    expect(out.author_name).toBe('Ada');
    expect(out.is_mine).toBe(true);
    expect(out.text_hidden).toBe(false);
    expect(out.position).toBe(3);
    expect(out.column_id).toBe('col2');
    expect(out.reactions).toEqual({ '👍': ['p2'] });
  });

  it("someone else's hidden card stays hidden", () => {
    const local = card({ text: '', text_hidden: true, author_id: null, author_name: null, is_mine: false });
    const out = mergeIncomingCard(local, hiddenEcho({ position: 2 }));
    expect(out.text).toBe('');
    expect(out.text_hidden).toBe(true);
    expect(out.is_mine).toBe(false);
    expect(out.position).toBe(2);
  });

  it('a revealed incoming card replaces local text on a card that is not mine', () => {
    const local = card({ text: '', text_hidden: true, is_mine: false });
    const out = mergeIncomingCard(local, card({ text: 'now visible', text_hidden: false }));
    expect(out.text).toBe('now visible');
    expect(out.text_hidden).toBe(false);
  });

  it('a revealed incoming card replaces local text on my card too, and stays mine', () => {
    const local = card({ is_mine: true, text: 'old' });
    const out = mergeIncomingCard(local, card({ text: 'edited elsewhere', is_mine: false }));
    expect(out.text).toBe('edited elsewhere');
    expect(out.is_mine).toBe(true);
  });

  it('my card keeps its author fields when the incoming author is withheld', () => {
    const local = card({ is_mine: true });
    const out = mergeIncomingCard(local, card({ author_id: null, author_name: null, text: 'visible', text_hidden: false }));
    expect(out.author_id).toBe('p1');
    expect(out.author_name).toBe('Ada');
    expect(out.is_mine).toBe(true);
    expect(out.text).toBe('visible');
  });

  it('keys on the local is_mine, ignoring an incoming is_mine of true', () => {
    const local = card({ text: '', text_hidden: true, is_mine: false });
    const out = mergeIncomingCard(local, hiddenEcho({ is_mine: true }));
    expect(out.is_mine).toBe(false);
    expect(out.text).toBe('');
  });

  it('does not mutate its inputs', () => {
    const local = card({ is_mine: true });
    const incoming = hiddenEcho();
    const lSnap = JSON.stringify(local);
    const iSnap = JSON.stringify(incoming);
    mergeIncomingCard(local, incoming);
    expect(JSON.stringify(local)).toBe(lSnap);
    expect(JSON.stringify(incoming)).toBe(iSnap);
  });
});
