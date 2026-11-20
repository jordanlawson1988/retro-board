import { describe, it, expect } from 'vitest';
import {
  tallyAfterFetch, EMPTY_VOTE_SLOT, startVoteClick, finishVoteClick, voteResult,
} from '@/lib/votes';
import {
  currentTallyVersion, bumpTallyVersion,
} from '@/lib/voteTallyVersion';
import type { Vote } from '@/types';

const row = (count: number, id = 'v1'): Vote =>
  ({ id, card_id: 'c1', board_id: 'b1', voter_id: 'p1', count, created_at: 'x' }) as Vote;
const ctx = { boardId: 'b1', cardId: 'c1', voterId: 'p1', nowIso: 'now' };

describe('tallyAfterFetch', () => {
  it('takes the GET tally when nothing was applied since the GET started', () => {
    expect(tallyAfterFetch({ used: 5, at: 9 }, { used: 4, at: 0 }, false)).toEqual({ used: 4, at: 0 });
  });
  it('keeps the current tally when a vote response or event was applied meanwhile', () => {
    const cur = { used: 5, at: 9 };
    expect(tallyAfterFetch(cur, { used: 4, at: 0 }, true)).toBe(cur);
  });
  it('a board with no tally yet always takes the GET tally', () => {
    expect(tallyAfterFetch(null, { used: 4, at: 0 }, true)).toEqual({ used: 4, at: 0 });
  });
  it('an open board (no tally in the GET) ends with none', () => {
    expect(tallyAfterFetch({ used: 5, at: 9 }, null, false)).toBeNull();
    expect(tallyAfterFetch({ used: 5, at: 9 }, null, true)).toBeNull();
  });
});

describe('tally version counter', () => {
  it('increments on every bump', () => {
    const before = currentTallyVersion();
    bumpTallyVersion();
    bumpTallyVersion();
    expect(currentTallyVersion()).toBe(before + 2);
  });
});

describe('vote click slot', () => {
  it('counts clicks in flight and settles only when the last one is answered', () => {
    let slot = startVoteClick(startVoteClick(EMPTY_VOTE_SLOT));
    expect(slot.pending).toBe(2);
    let r = finishVoteClick(slot, { at: 20, vote: row(2) });
    expect(r.settle).toBeNull();
    slot = r.slot;
    r = finishVoteClick(slot, { at: 10, vote: row(1) });
    expect(r.settle).toEqual({ vote: row(2) });
    expect(r.slot).toEqual(EMPTY_VOTE_SLOT);
  });
  it('the newest result by tally.at wins, not the last to arrive', () => {
    let slot = startVoteClick(startVoteClick(EMPTY_VOTE_SLOT));
    slot = finishVoteClick(slot, { at: 10, vote: row(1) }).slot;
    const r = finishVoteClick(slot, { at: 20, vote: row(2) });
    expect(r.settle).toEqual({ vote: row(2) });
  });
  it('a removal to zero is a result with no vote row', () => {
    const r = finishVoteClick(startVoteClick(EMPTY_VOTE_SLOT), { at: 5, vote: null });
    expect(r.settle).toEqual({ vote: null });
  });
  it('a lone failed click settles nothing', () => {
    const r = finishVoteClick(startVoteClick(EMPTY_VOTE_SLOT), null);
    expect(r.settle).toBeNull();
    expect(r.slot).toEqual(EMPTY_VOTE_SLOT);
  });
  it('a failed click still lets the newest success settle when it is the last answer', () => {
    let slot = startVoteClick(startVoteClick(EMPTY_VOTE_SLOT));
    slot = finishVoteClick(slot, { at: 10, vote: row(1) }).slot;
    const r = finishVoteClick(slot, null);
    expect(r.settle).toEqual({ vote: row(1) });
  });
});

describe('voteResult', () => {
  it('reads an add answer', () => {
    expect(voteResult({ action: 'added', vote: row(2), tally: { used: 3, at: 7 } }, undefined, ctx))
      .toEqual({ tally: { used: 3, at: 7 }, vote: row(2) });
  });
  it('reads a remove answer as the local row with the server count', () => {
    expect(voteResult({ action: 'removed', voteId: 'v1', count: 1, tally: { used: 1, at: 8 } }, row(3), ctx))
      .toEqual({ tally: { used: 1, at: 8 }, vote: row(1) });
  });
  it('count 0 means no row', () => {
    expect(voteResult({ action: 'removed', voteId: 'v1', count: 0, tally: { used: 0, at: 8 } }, row(1), ctx))
      .toEqual({ tally: { used: 0, at: 8 }, vote: null });
  });
  it('builds a row when the answer says votes remain but none is held locally', () => {
    const r = voteResult({ action: 'removed', voteId: 'v9', count: 2, tally: { used: 2, at: 8 } }, undefined, ctx);
    expect(r?.vote).toEqual({ id: 'v9', card_id: 'c1', board_id: 'b1', voter_id: 'p1', count: 2, created_at: 'now' });
  });
  it('returns null for anything malformed', () => {
    for (const bad of [null, 'x', {}, { action: 'added', tally: { used: 1, at: 1 } },
      { action: 'added', vote: row(1), tally: { used: -1, at: 1 } },
      { action: 'removed', voteId: 'v1', count: -1, tally: { used: 0, at: 1 } },
      { action: 'removed', voteId: 'v1', tally: { used: 0, at: 1 } },
      { action: 'weird', tally: { used: 0, at: 1 } }]) {
      expect(voteResult(bad, row(1), ctx)).toBeNull();
    }
  });
});
