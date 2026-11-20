import { describe, it, expect } from 'vitest';
import { cardEventPayload, voteEventPayload, voteTallyPayload } from '@/lib/board-publish';
import type { BoardSettings, Card } from '@/types';
import type { ViewBoard } from '@/lib/board-view';

const settings = (o: Partial<BoardSettings>) =>
  ({ card_visibility: 'visible', secret_voting: false, anonymous_cards: false, ...o }) as BoardSettings;
const board = (o: Partial<BoardSettings>, v: 1 | 2 = 2): ViewBoard => ({
  trust_version: v,
  settings: settings(o),
  archived_at: null,
});
const card = { id: 'c1', text: 'secret', author_id: 'p1', author_name: 'Ann' } as Card;

describe('cardEventPayload', () => {
  it('withholds text on a hidden v2 board', () => {
    const { card: c } = cardEventPayload(card, board({ card_visibility: 'hidden' }));
    expect(c.text).toBe('');
    expect(c.text_hidden).toBe(true);
  });
  it('strips author when anonymous', () => {
    const { card: c } = cardEventPayload(card, board({ anonymous_cards: true }));
    expect(c.author_id).toBeNull();
    expect(c.author_name).toBeNull();
  });
  it('is unshaped on v1', () => {
    expect(cardEventPayload(card, board({ card_visibility: 'hidden' }, 1)).card.text).toBe('secret');
  });
  it('does not mutate the input', () => {
    cardEventPayload(card, board({ card_visibility: 'hidden' }));
    expect(card.text).toBe('secret');
  });
});

describe('voteEventPayload', () => {
  const p = { vote: { id: 'v1' } };
  it('is null under secret voting on v2', () => {
    expect(voteEventPayload(p, board({ secret_voting: true }))).toBeNull();
  });
  it('passes through otherwise', () => {
    expect(voteEventPayload(p, board({}))).toBe(p);
    expect(voteEventPayload(p, board({ secret_voting: true }, 1))).toBe(p);
  });
});

describe('voteTallyPayload', () => {
  it('the tally payload carries only used and at', () => {
    expect(voteTallyPayload({ used: 4, at: 17, voter_id: 'p2' } as never)).toEqual({ used: 4, at: 17 });
  });
});
