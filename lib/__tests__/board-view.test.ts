import { describe, it, expect } from 'vitest';
import {
  PUBLIC_VIEWER,
  shapeCard,
  shapeVotes,
  votesAreSecret,
  isRevealingChange,
  type ViewBoard,
} from '@/lib/board-view';
import type { BoardSettings, Card, Vote } from '@/types';

const baseSettings: BoardSettings = {
  card_visibility: 'visible',
  voting_enabled: true,
  max_votes_per_participant: 5,
  secret_voting: false,
  board_locked: false,
  card_creation_disabled: false,
  anonymous_cards: false,
  timer: { duration: 0, remaining: 0, status: 'idle', started_at: null },
  highlighted_card_id: null,
};

function board(
  o: { trust_version?: 1 | 2; archived_at?: string | null; settings?: Partial<BoardSettings> } = {}
): ViewBoard {
  return {
    trust_version: o.trust_version ?? 2,
    archived_at: o.archived_at ?? null,
    settings: { ...baseSettings, ...o.settings },
  };
}

function card(o: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    column_id: 'col1',
    board_id: 'b1',
    text: 'original text',
    author_name: 'Alice',
    author_id: 'p1',
    color: null,
    position: 0,
    merged_with: null,
    reactions: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...o,
  };
}

function vote(id: string, voter: string): Vote {
  return { id, card_id: 'c1', board_id: 'b1', voter_id: voter, created_at: '2026-01-01T00:00:00Z' };
}

const ME = { participantId: 'p1' };
const OTHER = { participantId: 'p2' };

describe('PUBLIC_VIEWER', () => {
  it('has no participant', () => {
    expect(PUBLIC_VIEWER).toEqual({ participantId: null });
  });
});

describe('shapeCard on a v1 board', () => {
  const v1 = board({
    trust_version: 1,
    settings: { card_visibility: 'hidden', anonymous_cards: true, secret_voting: true },
  });

  it('removes nothing, whoever is looking', () => {
    const shaped = shapeCard(card(), v1, OTHER);
    expect(shaped.text).toBe('original text');
    expect(shaped.author_id).toBe('p1');
    expect(shaped.author_name).toBe('Alice');
    expect(shaped.text_hidden).toBe(false);
    expect(shaped.is_mine).toBe(false);
  });

  it('sets is_mine for the author', () => {
    expect(shapeCard(card(), v1, ME).is_mine).toBe(true);
  });

  it('does not mutate the input card', () => {
    const c = card();
    shapeCard(c, board({ settings: { card_visibility: 'hidden' } }), OTHER);
    expect(c.text).toBe('original text');
    expect((c as Card).text_hidden).toBeUndefined();
  });
});

describe('shapeCard on a v2 board', () => {
  it('is_mine is true for the author and false for others', () => {
    expect(shapeCard(card(), board(), ME).is_mine).toBe(true);
    expect(shapeCard(card(), board(), OTHER).is_mine).toBe(false);
  });

  it('is_mine is false for a null viewer, even for a card with a null author', () => {
    expect(shapeCard(card(), board(), PUBLIC_VIEWER).is_mine).toBe(false);
    expect(shapeCard(card({ author_id: null, author_name: null }), board(), PUBLIC_VIEWER).is_mine).toBe(false);
  });

  it('visible cards pass through untouched', () => {
    const shaped = shapeCard(card(), board(), OTHER);
    expect(shaped.text).toBe('original text');
    expect(shaped.text_hidden).toBe(false);
    expect(shaped.author_name).toBe('Alice');
  });

  it('hidden cards: others get empty text and text_hidden', () => {
    const shaped = shapeCard(card(), board({ settings: { card_visibility: 'hidden' } }), OTHER);
    expect(shaped.text).toBe('');
    expect(shaped.text_hidden).toBe(true);
    expect(shaped.is_mine).toBe(false);
    expect(shaped.author_name).toBe('Alice'); // not anonymous
  });

  it('hidden cards: the author still sees their own text', () => {
    const shaped = shapeCard(card(), board({ settings: { card_visibility: 'hidden' } }), ME);
    expect(shaped.text).toBe('original text');
    expect(shaped.text_hidden).toBe(false);
    expect(shaped.is_mine).toBe(true);
  });

  it('hidden cards: the public viewer gets no text', () => {
    const shaped = shapeCard(card(), board({ settings: { card_visibility: 'hidden' } }), PUBLIC_VIEWER);
    expect(shaped.text).toBe('');
    expect(shaped.text_hidden).toBe(true);
  });

  it('hidden cards: archived board reveals the text', () => {
    const b = board({ archived_at: '2026-02-01T00:00:00Z', settings: { card_visibility: 'hidden' } });
    const shaped = shapeCard(card(), b, OTHER);
    expect(shaped.text).toBe('original text');
    expect(shaped.text_hidden).toBe(false);
  });

  it('anonymous cards: others get null author fields', () => {
    const shaped = shapeCard(card(), board({ settings: { anonymous_cards: true } }), OTHER);
    expect(shaped.author_id).toBeNull();
    expect(shaped.author_name).toBeNull();
    expect(shaped.text).toBe('original text');
  });

  it('anonymous cards: the author keeps their author fields', () => {
    const shaped = shapeCard(card(), board({ settings: { anonymous_cards: true } }), ME);
    expect(shaped.author_id).toBe('p1');
    expect(shaped.author_name).toBe('Alice');
  });

  it('anonymous cards: stay anonymous after the board is archived (only text and votes are revealed)', () => {
    const b = board({ archived_at: '2026-02-01T00:00:00Z', settings: { anonymous_cards: true } });
    expect(shapeCard(card(), b, OTHER).author_name).toBeNull();
  });

  it('the facilitator gets no exception to hiding or anonymity', () => {
    // A facilitator is just another viewer to the shaper: there is no facilitator flag on Viewer.
    const b = board({ settings: { card_visibility: 'hidden', anonymous_cards: true } });
    const shaped = shapeCard(card(), b, { participantId: 'facilitator-pid' });
    expect(shaped.text).toBe('');
    expect(shaped.author_name).toBeNull();
  });

  it('hidden and anonymous: shaped JSON for the public viewer contains neither text nor author name', () => {
    const b = board({ settings: { card_visibility: 'hidden', anonymous_cards: true } });
    const c = card({ text: 'SECRET-xyz-123', author_name: 'Alice-abc-789', author_id: 'pid-author-555' });
    const json = JSON.stringify(shapeCard(c, b, PUBLIC_VIEWER));
    expect(json).not.toContain('SECRET-xyz-123');
    expect(json).not.toContain('Alice-abc-789');
    expect(json).not.toContain('pid-author-555');
  });

  it('keeps unrelated fields (position, reactions, color)', () => {
    const c = card({ position: 3, color: '#fff', reactions: { '👍': ['p2'] } });
    const shaped = shapeCard(c, board({ settings: { card_visibility: 'hidden' } }), OTHER);
    expect(shaped.position).toBe(3);
    expect(shaped.color).toBe('#fff');
    expect(shaped.reactions).toEqual({ '👍': ['p2'] });
  });

  it('secret voting: embedded card.votes and vote_count do not leak other voters', () => {
    const c = card({ votes: [vote('v1', 'p2'), vote('v2', 'p1')], vote_count: 2 });
    const shaped = shapeCard(c, board({ settings: { secret_voting: true } }), ME);
    expect(shaped.votes?.map((v) => v.id)).toEqual(['v2']);
    expect(shaped.vote_count).toBeUndefined();
  });
});

describe('votesAreSecret', () => {
  it('true on a v2 board with secret_voting and not archived', () => {
    expect(votesAreSecret(board({ settings: { secret_voting: true } }))).toBe(true);
  });
  it('false when secret_voting is off', () => {
    expect(votesAreSecret(board())).toBe(false);
  });
  it('false on a v1 board', () => {
    expect(votesAreSecret(board({ trust_version: 1, settings: { secret_voting: true } }))).toBe(false);
  });
  it('false once archived', () => {
    expect(
      votesAreSecret(board({ archived_at: '2026-02-01T00:00:00Z', settings: { secret_voting: true } }))
    ).toBe(false);
  });
});

describe('shapeVotes', () => {
  const votes = [vote('v1', 'p1'), vote('v2', 'p2'), vote('v3', 'p2')];

  it('returns all votes when voting is not secret', () => {
    expect(shapeVotes(votes, board(), OTHER)).toEqual(votes);
  });

  it('secret: returns only the viewer own votes', () => {
    const shaped = shapeVotes(votes, board({ settings: { secret_voting: true } }), OTHER);
    expect(shaped.map((v) => v.id)).toEqual(['v2', 'v3']);
  });

  it('secret: the public viewer gets no votes', () => {
    expect(shapeVotes(votes, board({ settings: { secret_voting: true } }), PUBLIC_VIEWER)).toEqual([]);
  });

  it('v1 board returns all votes even with secret_voting on', () => {
    expect(shapeVotes(votes, board({ trust_version: 1, settings: { secret_voting: true } }), OTHER)).toEqual(votes);
  });

  it('archived v2 board returns all votes', () => {
    const b = board({ archived_at: '2026-02-01T00:00:00Z', settings: { secret_voting: true } });
    expect(shapeVotes(votes, b, OTHER)).toEqual(votes);
  });

  it('does not mutate the input array', () => {
    const copy = [...votes];
    shapeVotes(votes, board({ settings: { secret_voting: true } }), OTHER);
    expect(votes).toEqual(copy);
  });
});

describe('isRevealingChange', () => {
  const s = (o: Partial<BoardSettings>): BoardSettings => ({ ...baseSettings, ...o });

  it('card_visibility hidden to visible reveals', () => {
    expect(isRevealingChange(s({ card_visibility: 'hidden' }), s({ card_visibility: 'visible' }))).toBe(true);
  });
  it('card_visibility visible to hidden does not', () => {
    expect(isRevealingChange(s({ card_visibility: 'visible' }), s({ card_visibility: 'hidden' }))).toBe(false);
  });
  it('secret_voting true to false reveals', () => {
    expect(isRevealingChange(s({ secret_voting: true }), s({ secret_voting: false }))).toBe(true);
  });
  it('secret_voting false to true does not', () => {
    expect(isRevealingChange(s({ secret_voting: false }), s({ secret_voting: true }))).toBe(false);
  });
  it('anonymous_cards true to false reveals', () => {
    expect(isRevealingChange(s({ anonymous_cards: true }), s({ anonymous_cards: false }))).toBe(true);
  });
  it('anonymous_cards false to true does not', () => {
    expect(isRevealingChange(s({ anonymous_cards: false }), s({ anonymous_cards: true }))).toBe(false);
  });
  it('unrelated changes do not reveal', () => {
    expect(isRevealingChange(s({}), s({ board_locked: true, voting_enabled: false }))).toBe(false);
  });
  it('no change does not reveal', () => {
    expect(isRevealingChange(s({}), s({}))).toBe(false);
  });
});

describe('group title shaping and secret vote counts', () => {
  it('a withheld text also withholds the group title; a visible card or my own keeps it', () => {
    const hidden = board({ settings: { card_visibility: 'hidden' } });
    const c = card({ author_id: 'someone', group_title: 'Release pain' });
    expect(shapeCard(c, hidden, { participantId: 'p1' }).group_title).toBeNull();
    expect(shapeCard(c, board(), { participantId: 'p1' }).group_title).toBe('Release pain');
    expect(shapeCard({ ...c, author_id: 'p1' }, hidden, { participantId: 'p1' }).group_title).toBe('Release pain');
    expect('group_title' in shapeCard(card({ author_id: 'someone' }), hidden, { participantId: 'p1' })).toBe(false);
  });
  it('secret voting keeps my vote with its count and drops everyone else', () => {
    const secret = board({ settings: { secret_voting: true } });
    const votes = [
      { id: 'v1', card_id: 'c1', board_id: 'b1', voter_id: 'p1', count: 2, created_at: 'x' },
      { id: 'v2', card_id: 'c1', board_id: 'b1', voter_id: 'p2', count: 3, created_at: 'x' },
    ];
    expect(shapeVotes(votes, secret, { participantId: 'p1' })).toEqual([votes[0]]);
  });
});
