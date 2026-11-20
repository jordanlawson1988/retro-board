import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  tx: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
  publish: vi.fn(),
  tally: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  sql: (...a: unknown[]) => mocks.sql(...a),
  sqlTransaction: (...a: unknown[]) => mocks.tx(...a),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/ably-server', () => ({ ablyServer: {} }));
vi.mock('@/lib/rate-limit', () => ({ rateLimitOr429: async () => null }));
vi.mock('@/lib/board-publish', () => ({
  publishVote: (...a: unknown[]) => mocks.publish(...a),
  publishVoteTally: (...a: unknown[]) => mocks.tally(...a),
}));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { POST } from '@/app/api/boards/[boardId]/votes/route';
import { NextRequest } from 'next/server';
import { phaseSettings } from '@/lib/phases';
import { ctxRow } from './vote-test-helpers';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import { OPEN_MAX_VOTES_PER_CARD } from '@/lib/constants/board-settings';
import { votesPerCardError } from '@/lib/votes';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const call = (body: unknown) =>
  POST(
    new NextRequest('http://x/api/boards/b1/votes', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    ctx
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
  mocks.publish.mockResolvedValue(undefined);
  mocks.tally.mockResolvedValue(undefined);
});

function guidedRow(settings: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  return ctxRow({ ...phaseSettings('vote'), max_votes_per_participant: 5, max_votes_per_card: 3, ...settings }, { mode: 'guided', phase: 'vote', ...over });
}
const txTexts = () => {
  const calls: { text: string; values: unknown[] }[] = [];
  mocks.tx.mock.calls[0][0]((s: TemplateStringsArray, ...values: unknown[]) => { calls.push({ text: s.join('?'), values }); return {}; });
  return calls;
};
const saved = { id: 'v1', card_id: 'c1', board_id: 'b1', voter_id: 'p1', count: 2, created_at: '2026-11-20T00:00:00Z' };
const addRow = (o: Record<string, unknown> = {}) =>
  ({ card_found: 1, card_parent: null, spent: 1, on_card: 1, per_person: 5, per_card: 3, team_used_before: 4, tally_at: 1_700_000_000_000, ...saved, ...o });
const NO_VOTE = { id: null, card_id: null, board_id: null, voter_id: null, count: null, created_at: null };

describe('guided add', () => {
  it('increments under a per-board lock, returns the vote and the tally, publishes only the tally', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow()]]);
    const res = await call({ cardId: 'c1', action: 'add', voteId: '00000000-0000-4000-8000-000000000002' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ action: 'added', vote: saved, tally: { used: 5, at: 1_700_000_000_000 } });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
    const [lock, stmt] = txTexts();
    expect(lock.values).toEqual(['b1:votes']);
    expect(stmt.text).toContain('ON CONFLICT (card_id, voter_id) DO UPDATE SET count = votes.count + 1');
    expect(stmt.text).toContain('SUM(count)');
    expect(stmt.text).toContain("settings ->> 'max_votes_per_participant'");
    expect(stmt.text).toContain("settings ->> 'max_votes_per_card'");
    expect(stmt.text).toContain('FROM boards WHERE id = ?');
    expect(stmt.text).toContain('mine.spent < lim.per_person AND mine.on_card < lim.per_card');
    expect(stmt.values).toEqual(expect.arrayContaining([DEFAULT_BOARD_SETTINGS.max_votes_per_participant, OPEN_MAX_VOTES_PER_CARD]));
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.tally).toHaveBeenCalledWith('b1', { used: 5, at: 1_700_000_000_000 });
  });
  it('422 at the per-card limit, with the limit', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, spent: 3, on_card: 3 })]]);
    const res = await call({ cardId: 'c1', action: 'add' });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'You can put at most 3 votes on one card', maxVotesPerCard: 3 });
    expect(mocks.tally).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it('422 at the per-person limit takes precedence', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, spent: 5, on_card: 3 })]]);
    expect(await (await call({ cardId: 'c1', action: 'add' })).json()).toEqual({ error: 'Vote limit reached', maxVotes: 5 });
    expect(mocks.tally).not.toHaveBeenCalled();
  });
  it('the limits the statement returns decide a per-person refusal, not the earlier load', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ max_votes_per_participant: 5 })]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, spent: 3, on_card: 0, per_person: 3 })]]);
    const res = await call({ cardId: 'c1', action: 'add' });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Vote limit reached', maxVotes: 3 });
    expect(mocks.tally).not.toHaveBeenCalled();
  });
  it('the limits the statement returns decide a per-card refusal, not the earlier load', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ max_votes_per_card: 3 })]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, spent: 1, on_card: 1, per_card: 1 })]]);
    const res = await call({ cardId: 'c1', action: 'add' });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: votesPerCardError(1), maxVotesPerCard: 1 });
    expect(mocks.tally).not.toHaveBeenCalled();
  });
  it('404 for an unknown card, 409 for a card inside a group', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, card_found: 0 })]]);
    expect((await call({ cardId: 'nope', action: 'add' })).status).toBe(404);
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, card_parent: 'lead' })]]);
    const res = await call({ cardId: 'c2', action: 'add' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Votes go on the group, not on a card inside it');
    expect(mocks.tally).not.toHaveBeenCalled();
  });
  it('a guided board without max_votes_per_card allows 1 per card', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ max_votes_per_card: undefined })]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, on_card: 1, per_card: 1 })]]);
    expect(await (await call({ cardId: 'c1', action: 'add' })).json()).toEqual({ error: 'You can put at most 1 vote on one card', maxVotesPerCard: 1 });
  });
  it('passes the identity from the cookie, never the body, and a generated id when voteId is absent', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow()]]);
    await call({ cardId: 'c1', action: 'add', voterId: 'someone-else' });
    const [, stmt] = txTexts();
    expect(stmt.values).toContain('p1');
    expect(stmt.values).not.toContain('someone-else');
    expect(stmt.values.some((x) => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x))).toBe(true);
  });
  it('a failed tally publish after the commit propagates like the toggle publish does', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow()]]);
    mocks.tally.mockRejectedValueOnce(new Error('ably down'));
    await expect(call({ cardId: 'c1', action: 'add' })).rejects.toThrow('ably down');
  });
});

describe('guided remove', () => {
  const removeRow = (o: Record<string, unknown> = {}) => ({ vote_id: 'v1', count_before: 2, team_used_before: 5, tally_at: 1_700_000_000_001, ...o });
  it('decrements and returns the new count and tally', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [removeRow()]]);
    expect(await (await call({ cardId: 'c1', action: 'remove' })).json())
      .toEqual({ action: 'removed', voteId: 'v1', count: 1, tally: { used: 4, at: 1_700_000_000_001 } });
    const [lock, stmt] = txTexts();
    expect(lock.values).toEqual(['b1:votes']);
    expect(stmt.text).toContain('decremented');
    expect(mocks.tally).toHaveBeenCalledWith('b1', { used: 4, at: 1_700_000_000_001 });
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
  });
  it('removing the last vote reports count 0', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [removeRow({ count_before: 1 })]]);
    expect((await (await call({ cardId: 'c1', action: 'remove' })).json()).count).toBe(0);
  });
  it('409 when there is nothing to remove, nothing published', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [removeRow({ vote_id: null, count_before: null })]]);
    const res = await call({ cardId: 'c1', action: 'remove' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('You have no vote on this card');
    expect(mocks.tally).not.toHaveBeenCalled();
  });
});

describe('guided request shape and guard', () => {
  it('400 for an unknown action before any database call', async () => {
    expect((await call({ cardId: 'c1', action: 'boost' })).status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it('400 on a guided board without an action, after the context query only', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    const res = await call({ cardId: 'c1' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Guided boards take add or remove');
    expect(mocks.tx).not.toHaveBeenCalled();
  });
  it('the phase guard answers first: 409 in Reflect', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow(phaseSettings('reflect'), { phase: 'reflect' })]);
    expect((await (await call({ cardId: 'c1', action: 'add' })).json()).error).toBe('Not available during Reflect');
    expect(mocks.tx).not.toHaveBeenCalled();
  });
  it('401 without a participant', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({}, { cp_id: null })]);
    expect((await call({ cardId: 'c1', action: 'add' })).status).toBe(401);
    expect(mocks.tx).not.toHaveBeenCalled();
  });
  it('a malformed voteId is 400', async () => {
    expect((await call({ cardId: 'c1', action: 'add', voteId: 5 })).status).toBe(400);
  });
});
