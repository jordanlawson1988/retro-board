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
vi.mock('@/lib/board-publish', () => ({ publishVote: (...a: unknown[]) => mocks.publish(...a) }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { POST } from '@/app/api/boards/[boardId]/votes/route';
import { NextRequest } from 'next/server';

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

function ctxRow(settings: Record<string, unknown> = {}) {
  return {
    id: 'b1', title: 'T', trust_version: 2,
    settings: { voting_enabled: true, max_votes_per_participant: 5, ...settings },
    archived_at: null, deleted_at: null, owner_id: 'owner', created_by: null,
    cp_id: 'p1', cp_is_admin: false, cp_display_name: 'Ann', claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, session_live: true, user_participant_id: null,
  };
}

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
