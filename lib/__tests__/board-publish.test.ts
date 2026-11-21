import { describe, it, expect } from 'vitest';
import { cardEventPayload, commentDeletedPayload, commentEventPayload, voteEventPayload, voteTallyPayload } from '@/lib/board-publish';
import type { BoardSettings, Card, Comment } from '@/types';
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

const comment = (over: Partial<Comment> = {}): Comment => ({ id: 'm1', board_id: 'b1', card_id: 'L', parent_id: null,
  author_participant_id: 'p2', author_name: 'Bo', is_anonymous: false, body: 'hi', created_at: 'x', edited_at: null, deleted_at: null, ...over });

describe('comment payloads', () => {
  it('are shaped for nobody', () => {
    expect(commentEventPayload(comment({ is_anonymous: true })).comment).toMatchObject({ author_participant_id: null, is_mine: false });
    expect(commentDeletedPayload(['m2'], comment({ deleted_at: 'y', body: '' })))
      .toEqual({ ids: ['m2'], tombstone: expect.objectContaining({ id: 'm1', body: '', author_name: null }) });
    expect(commentDeletedPayload(['m2'], null)).toEqual({ ids: ['m2'], tombstone: null });
  });
  it('always carry is_mine false, named or anonymous, whatever the input said', () => {
    for (const c of [comment(), comment({ is_anonymous: true }), comment({ is_mine: true })]) {
      const { comment: out } = commentEventPayload(c);
      expect('is_mine' in out).toBe(true);
      expect(out.is_mine).toBe(false);
    }
    const tomb = commentDeletedPayload(['m2'], comment({ is_mine: true, deleted_at: 'y', body: '' })).tombstone;
    expect(tomb?.is_mine).toBe(false);
  });
  it('a named comment keeps its author on the wire; an anonymous one never does', () => {
    expect(commentEventPayload(comment()).comment).toMatchObject({ author_participant_id: 'p2', author_name: 'Bo' });
    const anon = commentEventPayload(comment({ is_anonymous: true })).comment;
    expect(anon.author_participant_id).toBeNull();
    expect(anon.author_name).toBeNull();
  });
  it('have exactly the documented keys', () => {
    expect(Object.keys(commentEventPayload(comment()))).toEqual(['comment']);
    expect(Object.keys(commentDeletedPayload(['m2'], null)).sort()).toEqual(['ids', 'tombstone']);
  });
});
