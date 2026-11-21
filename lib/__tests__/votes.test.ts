import { describe, it, expect } from 'vitest';
import {
  voteWeight, voteTotalsByCard, votesUsedBy, myVotesOn, sumVoteCounts, groupScore, leadCardVotes, voteSortKey, voteSurface, maxVotesPerCard,
  guidedVoteDefaults, voteControlKind, voteControlState, applyVoteDelta, settleOwnVote, applyVoteTally,
  teamVotesRemaining, teamVotesLeftFor, teamVotesLabel, votesPerCardError, voteLimitProblem, limitRefusal,
  hasLimitKey, voteLimitsEditable, teamUsedAfter, GROUP_VOTE_ERROR, NO_VOTES_LEFT, VOTE_LIMIT_RELATION_ERROR,
  myGroupVotesOn, groupRemoveTarget, hasVotedOn, finishVoteClick, EMPTY_VOTE_SLOT, startVoteClick, voteResult,
} from '@/lib/votes';
import { phaseSettings } from '@/lib/phases';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import type { Board, Vote } from '@/types';

const v = (o: Partial<Vote> & Pick<Vote, 'card_id' | 'voter_id'>): Vote =>
  ({ id: `${o.card_id}-${o.voter_id}`, board_id: 'b1', created_at: '2026-11-20T00:00:00Z', ...o });
const rows = [
  v({ card_id: 'c1', voter_id: 'p1', count: 3 }),
  v({ card_id: 'c1', voter_id: 'p2' }),
  v({ card_id: 'c2', voter_id: 'p1', count: 1 }),
];

describe('vote arithmetic', () => {
  it('a row without count weighs 1, so open-board numbers are unchanged', () => {
    const open = [v({ card_id: 'c1', voter_id: 'p1' }), v({ card_id: 'c1', voter_id: 'p2' })];
    expect(voteWeight({})).toBe(1);
    expect(voteTotalsByCard(open).get('c1')).toBe(open.filter((x) => x.card_id === 'c1').length);
    expect(votesUsedBy(open, 'p1')).toBe(1);
  });
  it('totals, spending and the board sum add counts', () => {
    expect(voteTotalsByCard(rows).get('c1')).toBe(4);
    expect(votesUsedBy(rows, 'p1')).toBe(4);
    expect(votesUsedBy(rows, null)).toBe(0);
    expect(myVotesOn(rows, 'c1', 'p1')).toBe(3);
    expect(myVotesOn(rows, 'c2', 'p2')).toBe(0);
    expect(sumVoteCounts(rows)).toBe(5);
  });
  it('a group scores its lead plus its children', () => {
    const cards = [{ id: 'c1', merged_with: null }, { id: 'c2', merged_with: 'c1' }, { id: 'c3', merged_with: null }];
    expect(groupScore('c1', cards, voteTotalsByCard(rows))).toBe(5);
    expect(groupScore('c3', cards, voteTotalsByCard(rows))).toBe(0);
  });
  it('a lead card shows its group on a guided board and its own total on an open one', () => {
    const cards = [{ id: 'c1', merged_with: null }, { id: 'c2', merged_with: 'c1' }];
    const totals = voteTotalsByCard(rows);
    expect(leadCardVotes(true, 'c1', cards, totals)).toBe(5);
    expect(leadCardVotes(false, 'c1', cards, totals)).toBe(4);
    expect(leadCardVotes(false, 'missing', cards, totals)).toBe(0);
  });
  it('the phone list sorts a lead by its group score on a guided board and by its own total on an open one', () => {
    const cards = [{ id: 'c1', merged_with: null }, { id: 'c2', merged_with: 'c1' }];
    const totals = new Map([['c1', 1], ['c2', 4]]);
    expect(voteSortKey(true, cards, totals)('c1')).toBe(5);
    expect(voteSortKey(false, cards, totals)('c1')).toBe(1);
    expect(voteSortKey(true, cards, totals)('missing')).toBe(0);
  });
});

describe('which vote control a card shows', () => {
  const one = { max_votes_per_card: 1 };
  const three = { max_votes_per_card: 3 };
  it('an open board always keeps the existing pill', () => {
    expect(voteSurface('open', three, true, false)).toBe('pill');
    expect(voteSurface('open', three, true, true)).toBe('pill');
  });
  it('a guided board with voting on gives a root the stepper above 1 per card, else the pill', () => {
    expect(voteSurface('guided', three, true, false)).toBe('stepper');
    expect(voteSurface('guided', one, true, false)).toBe('pill');
  });
  it('a guided child card gets the child control whatever the limit', () => {
    expect(voteSurface('guided', three, true, true)).toBe('child');
    expect(voteSurface('guided', one, true, true)).toBe('child');
  });
  it('a guided board with voting off or completed keeps the pill', () => {
    expect(voteSurface('guided', three, false, false)).toBe('pill');
    expect(voteSurface('guided', three, false, true)).toBe('pill');
  });
});

describe('limits and control state', () => {
  it('an open board reads as 1 per card; guided create takes 3 but never more than per person', () => {
    expect(maxVotesPerCard(DEFAULT_BOARD_SETTINGS)).toBe(1);
    expect(maxVotesPerCard({ max_votes_per_card: 3 })).toBe(3);
    expect(guidedVoteDefaults({ max_votes_per_participant: 5 })).toEqual({ max_votes_per_card: 3 });
    expect(guidedVoteDefaults({ max_votes_per_participant: 2 })).toEqual({ max_votes_per_card: 2 });
    expect(guidedVoteDefaults({ max_votes_per_participant: 'junk' })).toEqual({ max_votes_per_card: 3 });
  });
  it('the stepper shows only on a guided board above 1 per card', () => {
    expect(voteControlKind('open', { max_votes_per_card: 3 })).toBe('toggle');
    expect(voteControlKind('guided', { max_votes_per_card: 1 })).toBe('toggle');
    expect(voteControlKind('guided', {})).toBe('toggle');
    expect(voteControlKind('guided', { max_votes_per_card: 3 })).toBe('stepper');
  });
  it('add is blocked by group, then person, then card, each with its reason', () => {
    const base = { onCard: 1, spent: 2, perCard: 3, perPerson: 5, childCard: false };
    expect(voteControlState(base)).toEqual({ canAdd: true, canRemove: true, addBlockedReason: null });
    expect(voteControlState({ ...base, childCard: true }).addBlockedReason).toBe(GROUP_VOTE_ERROR);
    expect(voteControlState({ ...base, spent: 5 }).addBlockedReason).toBe(NO_VOTES_LEFT);
    expect(voteControlState({ ...base, onCard: 3, spent: 3 })).toEqual({ canAdd: false, canRemove: true, addBlockedReason: 'You can put at most 3 votes on one card' });
    expect(voteControlState({ ...base, onCard: 0 }).canRemove).toBe(false);
  });
  it('per-card message is singular at 1', () => {
    expect(votesPerCardError(1)).toBe('You can put at most 1 vote on one card');
  });
  it('the merged limits must keep per card at or below per person', () => {
    const s = { ...DEFAULT_BOARD_SETTINGS, max_votes_per_participant: 5, max_votes_per_card: 3 };
    expect(voteLimitProblem(s, { max_votes_per_participant: 2 })).toBe(VOTE_LIMIT_RELATION_ERROR);
    expect(voteLimitProblem(s, { max_votes_per_card: 6 })).toBe(VOTE_LIMIT_RELATION_ERROR);
    expect(voteLimitProblem(s, { max_votes_per_participant: 4, max_votes_per_card: 4 })).toBeNull();
    expect(hasLimitKey({ anonymous_cards: true })).toBe(false);
    expect(hasLimitKey({ max_votes_per_card: 2 })).toBe(true);
  });
  it('a refused lowering says which limit it hit, with no numbers', () => {
    expect(limitRefusal({ perPerson: 3, perCard: null, maxSpent: 4, maxOnCard: 1 }))
      .toBe('Votes per person cannot go below what someone has already used.');
    expect(limitRefusal({ perPerson: null, perCard: 1, maxSpent: 4, maxOnCard: 2 }))
      .toBe('Votes per card cannot go below what someone already has on one card.');
    expect(limitRefusal({ perPerson: 9, perCard: 9, maxSpent: 0, maxOnCard: 0 })).toBe('The board changed. Try again.');
  });
  it('limits are editable on a guided board until totals show', () => {
    const b = (phase: Board['phase'], archived_at: string | null = null) => ({ mode: 'guided' as const, phase, archived_at });
    expect(voteLimitsEditable(b('reflect'))).toBe(true);
    expect(voteLimitsEditable(b('vote'))).toBe(true);
    expect(voteLimitsEditable(b('discuss'))).toBe(false);
    expect(voteLimitsEditable(b('vote', '2026-11-20'))).toBe(false);
    expect(voteLimitsEditable({ mode: 'open', phase: null, archived_at: null })).toBe(false);
  });
});

describe('optimistic own votes', () => {
  const d = { boardId: 'b1', cardId: 'c9', voterId: 'p1', voteId: 'new', nowIso: '2026-11-20T00:00:00Z' };
  it('+1 creates a row with count 1, then increments; -1 decrements and removes at zero', () => {
    const one = applyVoteDelta([], { ...d, delta: 1 });
    expect(one).toEqual([{ id: 'new', card_id: 'c9', board_id: 'b1', voter_id: 'p1', count: 1, created_at: d.nowIso }]);
    const two = applyVoteDelta(one, { ...d, delta: 1 });
    expect(two[0].count).toBe(2);
    expect(applyVoteDelta(applyVoteDelta(two, { ...d, delta: -1 }), { ...d, delta: -1 })).toEqual([]);
  });
  it('-1 with no row returns the same array', () => {
    expect(applyVoteDelta(rows, { ...d, delta: -1 })).toBe(rows);
  });
  it('settle replaces or removes only my row on that card', () => {
    const server = v({ card_id: 'c1', voter_id: 'p1', count: 2, id: 'srv' });
    expect(settleOwnVote(rows, { cardId: 'c1', voterId: 'p1', vote: server }).find((x) => x.voter_id === 'p1' && x.card_id === 'c1')).toEqual(server);
    const gone = settleOwnVote(rows, { cardId: 'c1', voterId: 'p1', vote: null });
    expect(gone).toHaveLength(2);
    expect(gone.some((x) => x.voter_id === 'p2')).toBe(true);
  });
});

describe('team tally', () => {
  it('applies a newer or equal tally, ignores an older or malformed one', () => {
    const cur = { used: 3, at: 100 };
    expect(applyVoteTally(null, { used: 1, at: 5 })).toEqual({ used: 1, at: 5 });
    expect(applyVoteTally(cur, { used: 4, at: 100 })).toEqual({ used: 4, at: 100 });
    expect(applyVoteTally(cur, { used: 2, at: 99 })).toBe(cur);
    for (const bad of [null, 'x', { used: -1, at: 1 }, { used: 1.5, at: 1 }, { used: 1 }]) expect(applyVoteTally(cur, bad)).toBe(cur);
  });
  it('remaining is per person times joined participants minus used, never below zero', () => {
    expect(teamVotesRemaining(5, 2, 3)).toBe(7);
    expect(teamVotesRemaining(5, 1, 9)).toBe(0);
    expect(teamVotesLabel(7)).toBe('Team: 7 votes left');
    expect(teamVotesLabel(1)).toBe('Team: 1 vote left');
  });
  it('is shown only on a guided board in Vote with a tally', () => {
    const board = { mode: 'guided' as const, phase: 'vote' as const, archived_at: null, settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings('vote'), max_votes_per_participant: 5 } };
    expect(teamVotesLeftFor(board, 2, { used: 3, at: 1 })).toBe(7);
    expect(teamVotesLeftFor({ ...board, phase: 'group' }, 2, { used: 3, at: 1 })).toBeNull();
    expect(teamVotesLeftFor({ ...board, mode: 'open', phase: null }, 2, { used: 3, at: 1 })).toBeNull();
    expect(teamVotesLeftFor(board, 2, null)).toBeNull();
  });
});

describe('teamUsedAfter', () => {
  it('adds or subtracts the one vote the statement changed after reading the state before it', () => {
    expect(teamUsedAfter(4, 1)).toBe(5);
    expect(teamUsedAfter(5, -1)).toBe(4);
    expect(teamUsedAfter(0, 1)).toBe(1);
  });
});

describe('group-aware votes', () => {
  const at = (ms: number) => new Date(Date.UTC(2026, 10, 20, 10, 0, 0, ms)).toISOString();
  const cards = [
    { id: 'L', merged_with: null, created_at: at(0) },
    { id: 'c2', merged_with: 'L', created_at: at(2) },
    { id: 'c1', merged_with: 'L', created_at: at(1) },
    { id: 'S', merged_with: null, created_at: at(3) },
  ];
  it('a lead counts my votes on it and its children; a child or solo card counts its own row', () => {
    const vs = [
      v({ card_id: 'L', voter_id: 'p1', count: 1 }), v({ card_id: 'c2', voter_id: 'p1', count: 2 }),
      v({ card_id: 'c1', voter_id: 'p2', count: 1 }), v({ card_id: 'S', voter_id: 'p1', count: 1 }),
    ];
    expect(myGroupVotesOn(vs, cards, 'L', 'p1')).toBe(3);
    expect(myGroupVotesOn(vs, cards, 'L', 'p2')).toBe(1);
    expect(myGroupVotesOn(vs, cards, 'c2', 'p1')).toBe(2);
    expect(myGroupVotesOn(vs, cards, 'S', 'p1')).toBe(1);
    expect(myGroupVotesOn(vs, cards, 'L', null)).toBe(0);
  });
  it('a remove on a lead takes the lead row first, then my earliest child row', () => {
    const both = [v({ card_id: 'L', voter_id: 'p1' }), v({ card_id: 'c2', voter_id: 'p1' }), v({ card_id: 'c1', voter_id: 'p1' })];
    expect(groupRemoveTarget(both, cards, 'L', 'p1')).toBe('L');
    expect(groupRemoveTarget(both.slice(1), cards, 'L', 'p1')).toBe('c1');
    expect(groupRemoveTarget([v({ card_id: 'c2', voter_id: 'p1' })], cards, 'L', 'p1')).toBe('c2');
  });
  it('a child target uses its own row only; no vote in the group is null', () => {
    expect(groupRemoveTarget([v({ card_id: 'L', voter_id: 'p1' })], cards, 'c1', 'p1')).toBeNull();
    expect(groupRemoveTarget([v({ card_id: 'c1', voter_id: 'p2' })], cards, 'L', 'p1')).toBeNull();
  });
  it('a removed answer names the row it changed', () => {
    const r = voteResult({ action: 'removed', voteId: 'v9', cardId: 'c2', count: 1, tally: { used: 3, at: 7 } }, undefined,
      { boardId: 'b1', cardId: 'L', voterId: 'p1', nowIso: 'x' });
    expect(r).toEqual({ tally: { used: 3, at: 7 }, cardId: 'c2', vote: expect.objectContaining({ id: 'v9', card_id: 'c2', count: 1 }) });
  });
});

describe('a click that changes another row', () => {
  it('ends its burst with no settle and one refetch', () => {
    const slot = startVoteClick(EMPTY_VOTE_SLOT, 1);
    const done = finishVoteClick(slot, { kind: 'ok', at: 5, vote: null, otherRow: true });
    expect(done.settle).toBeNull();
    expect(done.refetch).toBe(true);
  });
  it('an ordinary burst still settles on the newest answer and does not refetch', () => {
    const done = finishVoteClick(startVoteClick(EMPTY_VOTE_SLOT, 1), { kind: 'ok', at: 5, vote: null, otherRow: false });
    expect(done.settle).toEqual({ vote: null });
    expect(done.refetch).toBe(false);
  });
});

describe('hasVotedOn', () => {
  const cards = [
    { id: 'L', merged_with: null },
    { id: 'c', merged_with: 'L' },
    { id: 'S', merged_with: null },
  ];
  const onChild = [v({ card_id: 'c', voter_id: 'p1' })];
  const onLead = [v({ card_id: 'L', voter_id: 'p1' })];
  it('an open board reads the card own row only, as the views always did', () => {
    expect(hasVotedOn(false, onChild, cards, 'L', 'p1')).toBe(false);
    expect(hasVotedOn(false, onLead, cards, 'L', 'p1')).toBe(true);
    expect(hasVotedOn(false, onLead, cards, 'L', 'p2')).toBe(false);
  });
  it('a guided root counts the whole group', () => {
    expect(hasVotedOn(true, onChild, cards, 'L', 'p1')).toBe(true);
    expect(hasVotedOn(true, onLead, cards, 'L', 'p1')).toBe(true);
    expect(hasVotedOn(true, onChild, cards, 'S', 'p1')).toBe(false);
  });
  it('a guided child reads its own row only', () => {
    expect(hasVotedOn(true, onLead, cards, 'c', 'p1')).toBe(false);
    expect(hasVotedOn(true, onChild, cards, 'c', 'p1')).toBe(true);
  });
  it('no participant never has voted', () => {
    expect(hasVotedOn(true, onLead, cards, 'L', null)).toBe(false);
    expect(hasVotedOn(false, onLead, cards, 'L', null)).toBe(false);
  });
});
