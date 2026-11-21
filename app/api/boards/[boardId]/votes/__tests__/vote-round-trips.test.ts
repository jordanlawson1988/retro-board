import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  tx: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
  publish: vi.fn(),
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
  publishVoteTally: vi.fn(),
}));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { POST } from '@/app/api/boards/[boardId]/votes/route';
import { NextRequest } from 'next/server';
import { ctxRow } from './vote-test-helpers';

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

// Budget: the board-context query plus ONE transaction (lock + toggle statement) = 2 round trips.
const expectTwoCalls = () => {
  expect(mocks.sql).toHaveBeenCalledTimes(1);
  expect(mocks.tx).toHaveBeenCalledTimes(1);
};

const voteRow = { id: 'v1', card_id: 'c1', board_id: 'b1', voter_id: 'p1', created_at: '2026-11-17T00:00:00Z' };

function pgError(code: string, constraint: string) {
  return Object.assign(new Error('fk'), { code, constraint });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
  mocks.publish.mockResolvedValue(undefined);
});

describe('vote toggle round-trip budget', () => {
  it('add: context query plus one statement', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    mocks.tx.mockResolvedValueOnce([[], [{ outcome: 'added', ...voteRow }]]);
    const res = await call({ cardId: 'c1', voteId: '00000000-0000-4000-8000-000000000001' });
    expect(res.status).toBe(200);
    expectTwoCalls();
    // The transaction builder yields the advisory lock then the toggle, in that order.
    const calls: { text: string; values: unknown[] }[] = [];
    const txn = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = { text: strings.join('?'), values }; calls.push(q); return q;
    };
    const queries = mocks.tx.mock.calls[0][0](txn);
    expect(queries).toHaveLength(2);
    expect(calls[0].text).toContain('pg_advisory_xact_lock');
    expect(calls[0].values).toEqual(['b1:p1']);
    expect(calls[1].text).toContain('WITH removed AS');
    const json = await res.json();
    expect(json.action).toBe('added');
    expect(json.vote).toEqual(voteRow);
    expect(mocks.publish).toHaveBeenCalledWith('b1', 'vote-cast', { vote: voteRow }, expect.anything());
  });

  it('remove: context query plus one statement', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    mocks.tx.mockResolvedValueOnce([[], [{ outcome: 'removed', ...voteRow }]]);
    const res = await call({ cardId: 'c1' });
    expect(await res.json()).toEqual({ action: 'removed' });
    expectTwoCalls();
    expect(mocks.publish).toHaveBeenCalledWith(
      'b1', 'vote-removed', { voteId: 'v1', cardId: 'c1', voterId: 'p1' }, expect.anything()
    );
  });

  it('limit reached: 422 with maxVotes, two calls', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ max_votes_per_participant: 3 })]);
    mocks.tx.mockResolvedValueOnce([[], []]);
    const res = await call({ cardId: 'c1' });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Vote limit reached', maxVotes: 3 });
    expectTwoCalls();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('unknown card or card on another board: FK 23503 becomes 404', async () => {
    for (const constraint of ['votes_card_id_board_id_fkey', 'votes_card_id_fkey']) {
      mocks.sql.mockReset();
      mocks.tx.mockReset();
      mocks.sql.mockResolvedValueOnce([ctxRow()]);
      mocks.tx.mockRejectedValueOnce(pgError('23503', constraint));
      const res = await call({ cardId: 'nope' });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Card not found' });
      expectTwoCalls();
    }
  });

  it('other database errors are not swallowed', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    mocks.tx.mockRejectedValueOnce(pgError('08006', ''));
    await expect(call({ cardId: 'c1' })).rejects.toThrow();
  });

  it('voting closed: denied after the context query only', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ voting_enabled: false })]);
    const res = await call({ cardId: 'c1' });
    expect(res.status).toBe(409);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).not.toHaveBeenCalled();
  });
});

describe('open path pin', () => {
  it('the open toggle statements are unchanged by Step 2', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    mocks.tx.mockResolvedValueOnce([[], [{ outcome: 'added', ...voteRow }]]);
    await call({ cardId: 'c1', voteId: '00000000-0000-4000-8000-000000000001' });
    const texts: string[] = [];
    mocks.tx.mock.calls[0][0]((s: TemplateStringsArray) => { texts.push(s.join('?')); return {}; });
    expect(texts).toMatchInlineSnapshot(`
      [
        "SELECT pg_advisory_xact_lock(hashtext(?))",
        "
              WITH removed AS (
                DELETE FROM votes
                WHERE card_id = ? AND voter_id = ? AND board_id = ?
                RETURNING *
              ), added AS (
                INSERT INTO votes (id, card_id, board_id, voter_id)
                SELECT ?, ?, ?, ?
                WHERE NOT EXISTS (SELECT 1 FROM removed)
                  AND (?::int IS NULL
                       OR (SELECT COUNT(*) FROM votes WHERE board_id = ? AND voter_id = ?) < ?::int
                       OR NOT EXISTS (SELECT 1 FROM cards WHERE id = ? AND board_id = ?))
                RETURNING *
              )
              SELECT 'removed' AS outcome, r.* FROM removed r
              UNION ALL
              SELECT 'added' AS outcome, a.* FROM added a
            ",
      ]
    `);
  });
  it('an open board refuses an action field with 409 and runs no transaction', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    const res = await call({ cardId: 'c1', action: 'add' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'This board is not in guided mode' });
    expect(mocks.tx).not.toHaveBeenCalled();
  });
});
