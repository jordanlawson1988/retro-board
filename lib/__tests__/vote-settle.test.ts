import { describe, it, expect } from 'vitest';
import {
  tallyAfterFetch, EMPTY_VOTE_SLOT, startVoteClick, finishVoteClick, voteResult, errorMessageOf,
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
  const ok = (at: number, vote: Vote | null) => ({ kind: 'ok' as const, at, vote, otherRow: false });
  const failed = (over: Partial<{ refetched: boolean; delta: 1 | -1; currentCount: number }> = {}) =>
    ({ kind: 'failed' as const, refetched: false, delta: 1 as const, currentCount: -1, ...over });
  const two = () => startVoteClick(startVoteClick(EMPTY_VOTE_SLOT, 1), 2);

  it('counts clicks in flight and settles only when the last one is answered', () => {
    let slot = two();
    expect(slot.pending).toBe(2);
    let r = finishVoteClick(slot, ok(20, row(2)));
    expect(r.settle).toBeNull();
    expect(r.refetch).toBe(false);
    slot = r.slot;
    r = finishVoteClick(slot, ok(10, row(1)));
    expect(r.settle).toEqual({ vote: row(2) });
    expect(r.slot).toEqual(EMPTY_VOTE_SLOT);
  });
  it('the newest result by tally.at wins, not the last to arrive', () => {
    const slot = finishVoteClick(two(), ok(10, row(1))).slot;
    expect(finishVoteClick(slot, ok(20, row(2))).settle).toEqual({ vote: row(2) });
  });
  it('a removal to zero is a result with no vote row', () => {
    const r = finishVoteClick(startVoteClick(EMPTY_VOTE_SLOT, 0), ok(5, null));
    expect(r.settle).toEqual({ vote: null });
  });
  it('a lone failed click settles nothing and asks for a refetch', () => {
    const r = finishVoteClick(startVoteClick(EMPTY_VOTE_SLOT, 1), failed());
    expect(r.settle).toBeNull();
    expect(r.refetch).toBe(true);
    expect(r.slot).toEqual(EMPTY_VOTE_SLOT);
  });
  it('a failure whose own handling already refetched does not ask for another', () => {
    expect(finishVoteClick(startVoteClick(EMPTY_VOTE_SLOT, 1), failed({ refetched: true })).refetch).toBe(false);
  });
  it('a failed click still lets the newest success settle when it is the last answer, and the burst refetches', () => {
    const slot = finishVoteClick(two(), ok(10, row(1))).slot;
    const r = finishVoteClick(slot, failed());
    expect(r.settle).toEqual({ vote: row(1) });
    expect(r.refetch).toBe(true);
  });
  it('a failure in the middle of a burst defers the refetch to the end of the burst', () => {
    let r = finishVoteClick(two(), failed());
    expect(r.refetch).toBe(false);
    r = finishVoteClick(r.slot, ok(9, row(1)));
    expect(r.refetch).toBe(true);
  });
});

describe('reversing a failed click', () => {
  it('reverses when the row still has the count this burst expects, and lowers the expectation', () => {
    const slot = startVoteClick(EMPTY_VOTE_SLOT, 1);
    const r = finishVoteClick(startVoteClick(slot, 2), { kind: 'failed', refetched: false, delta: 1, currentCount: 2 });
    expect(r.reverse).toBe(true);
    expect(r.slot.expected).toBe(1);
  });
  it('does not reverse when a refetch replaced the rows (count differs from the expectation)', () => {
    const slot = startVoteClick(startVoteClick(EMPTY_VOTE_SLOT, 2), 3);
    const r = finishVoteClick(slot, { kind: 'failed', refetched: false, delta: 1, currentCount: 1 });
    expect(r.reverse).toBe(false);
    expect(r.slot.expected).toBe(3);
  });
  it('reverses a failed removal by adding back', () => {
    const r = finishVoteClick(startVoteClick(EMPTY_VOTE_SLOT, 0), { kind: 'failed', refetched: false, delta: -1, currentCount: 0 });
    expect(r.reverse).toBe(true);
  });
});

describe('errorMessageOf', () => {
  it('takes the server message and falls back otherwise', () => {
    expect(errorMessageOf({ error: 'Nope' }, 'Fallback')).toBe('Nope');
    for (const bad of [null, {}, { error: '' }, { error: 3 }, 'x']) expect(errorMessageOf(bad, 'Fallback')).toBe('Fallback');
  });
});

describe('voteResult', () => {
  it('reads an add answer', () => {
    expect(voteResult({ action: 'added', vote: row(2), tally: { used: 3, at: 7 } }, undefined, ctx))
      .toEqual({ tally: { used: 3, at: 7 }, cardId: 'c1', vote: row(2) });
  });
  it('reads a remove answer as the local row with the server count', () => {
    expect(voteResult({ action: 'removed', voteId: 'v1', count: 1, tally: { used: 1, at: 8 } }, row(3), ctx))
      .toEqual({ tally: { used: 1, at: 8 }, cardId: 'c1', vote: row(1) });
  });
  it('count 0 means no row', () => {
    expect(voteResult({ action: 'removed', voteId: 'v1', count: 0, tally: { used: 0, at: 8 } }, row(1), ctx))
      .toEqual({ tally: { used: 0, at: 8 }, cardId: 'c1', vote: null });
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
