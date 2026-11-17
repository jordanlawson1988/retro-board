import { describe, it, expect, vi, beforeEach } from 'vitest';

// Round-trip budget for POST /api/boards/[boardId]/join (audit R8).
// Budget achieved: every path is at most 2 database round-trips
// (1 loadBoardActor query + 1 write: a single INSERT, an UPDATE, or one atomic
// transaction holding the participant upsert and the board_members upsert).
// Before: a signed-in new joiner took 5 (loader, existing-participant SELECT,
// ownership SELECT, participant INSERT, board_members INSERT), a signed-in
// returning joiner 3, an anonymous joiner 2.

type Call = { text: string; values: unknown[] };
const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  tx: vi.fn(),
  session: vi.fn(),
  cookieId: vi.fn(),
  setCookie: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  sql: (s: TemplateStringsArray, ...v: unknown[]) => mocks.sql(s.join('?').replace(/\s+/g, ' ').trim(), v),
  sqlTransaction: (build: (t: unknown) => unknown[], o?: unknown) => mocks.tx(build, o),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/ably-server', () => ({
  ablyServer: { channels: { get: () => ({ publish: mocks.publish }) } },
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimitOr429: async () => null }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({
  readParticipantId: () => mocks.cookieId(),
  setParticipantCookie: (...a: unknown[]) => mocks.setCookie(...a),
}));

import { POST } from '@/app/api/boards/[boardId]/join/route';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const call = (body: Record<string, unknown> = { displayName: 'Ann' }) =>
  POST(
    new Request('http://x/api/boards/b1/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx
  );

function boardRow(over: Record<string, unknown> = {}) {
  return {
    id: 'b1', title: 'T', trust_version: 2, settings: {}, archived_at: null, deleted_at: null,
    owner_id: 'owner', created_by: 'creator-pid',
    cp_id: null, cp_is_admin: null, cp_display_name: null, claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, session_live: true, user_participant_id: null,
    ...over,
  };
}

/** sql mock: first call is the loader, the rest are writes answered from `writes`. */
let sqlCalls: Call[];
let txCalls: Call[];
function arrange(loader: Record<string, unknown>, writes: unknown[][] = []) {
  sqlCalls = [];
  const queue = [...writes];
  mocks.sql.mockImplementation(async (text: string, values: unknown[]) => {
    sqlCalls.push({ text, values });
    if (sqlCalls.length === 1) return [loader];
    return queue.shift() ?? [];
  });
}
function arrangeTx(result: unknown[][]) {
  txCalls = [];
  mocks.tx.mockImplementation(async (build: (t: unknown) => unknown[]) => {
    const t = (s: TemplateStringsArray, ...v: unknown[]) => {
      const c = { text: s.join('?').replace(/\s+/g, ' ').trim(), values: v };
      txCalls.push(c);
      return c;
    };
    build(t);
    return result;
  });
}
const roundTrips = () => sqlCalls.length + (mocks.tx.mock.calls.length ? 1 : 0);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.cookieId.mockReturnValue(null);
});

describe('join: anonymous (no user_id), unchanged behaviour', () => {
  it('new v2 joiner: 2 round-trips, server-generated id, body id and isAdmin ignored', async () => {
    arrange(boardRow(), [[{ id: 'SERVERID', display_name: 'Ann', is_admin: false }]]);
    const res = await call({ displayName: 'Ann', participantId: 'evil', isAdmin: true });
    expect(res.status).toBe(200);
    expect(roundTrips()).toBe(2);
    expect(mocks.tx).not.toHaveBeenCalled();
    const insert = sqlCalls[1];
    expect(insert.text).toContain('INSERT INTO participants');
    expect(insert.text).not.toContain('ON CONFLICT');
    expect(insert.values[0]).not.toBe('evil');
    expect(insert.values[3]).toBe(false); // is_admin
    expect(insert.values[4]).toBeNull(); // user_id
    expect(mocks.setCookie).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ reused: false });
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it('v2 cookie holder re-joining: 2 round-trips, reused, no publish', async () => {
    mocks.cookieId.mockReturnValue('p1');
    arrange(boardRow({ cp_id: 'p1', cp_is_admin: false, cp_display_name: 'Old' }), [[{ id: 'p1' }]]);
    const res = await call();
    expect(roundTrips()).toBe(2);
    expect(await res.json()).toMatchObject({ reused: true, participant: { id: 'p1' } });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('creator claim: cookie == boards.created_by with no row yet becomes admin under that id', async () => {
    mocks.cookieId.mockReturnValue('creator-pid');
    arrange(boardRow(), [[{ id: 'creator-pid', is_admin: true }]]);
    await call();
    expect(sqlCalls[1].values[0]).toBe('creator-pid');
    expect(sqlCalls[1].values[3]).toBe(true);
  });

  it('v1 board: claimed id required (400) and used as the participant id', async () => {
    arrange(boardRow({ trust_version: 1 }));
    expect((await call()).status).toBe(400);
    arrange(boardRow({ trust_version: 1 }), [[{ id: 'client-1' }]]);
    const res = await call({ displayName: 'Ann', participantId: 'client-1' });
    expect(res.status).toBe(200);
    expect(sqlCalls[1].values[0]).toBe('client-1');
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});

describe('join: signed-in', () => {
  beforeEach(() => mocks.session.mockResolvedValue({ user: { id: 'u1' } }));

  it('new non-owner joiner: 2 round-trips, one atomic transaction with upsert + membership', async () => {
    arrange(boardRow());
    arrangeTx([[{ id: 'NEW', is_admin: false }], []]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(roundTrips()).toBe(2);
    expect(sqlCalls).toHaveLength(1); // loader only: no ownership / existing re-queries
    expect(txCalls).toHaveLength(2);
    expect(txCalls[0].text).toContain('ON CONFLICT (board_id, user_id) WHERE user_id IS NOT NULL DO UPDATE');
    expect(txCalls[1].text).toContain('INSERT INTO board_members');
    expect(txCalls[1].text).toContain('ON CONFLICT (board_id, user_id) DO NOTHING');
    expect(txCalls[1].values).toContain('participant');
    expect(txCalls[0].values[3]).toBe(false);
    expect(txCalls[0].values[4]).toBe('u1');
  });

  it('owner is promoted to admin / facilitator without any ownership query', async () => {
    arrange(boardRow({ owner_id: 'u1' }));
    arrangeTx([[{ id: 'NEW', is_admin: true }], []]);
    await call();
    expect(roundTrips()).toBe(2);
    expect(txCalls[0].values[3]).toBe(true);
    expect(txCalls[1].values).toContain('facilitator');
  });

  it.each(['owner', 'facilitator'])('board_members role %s is promoted', async (role) => {
    arrange(boardRow({ member_role: role, is_member: true }));
    arrangeTx([[{ id: 'NEW', is_admin: true }], []]);
    await call();
    expect(txCalls[0].values[3]).toBe(true);
  });

  it('plain member and system admin (not owner/facilitator) are not promoted', async () => {
    arrange(boardRow({ member_role: 'participant', is_member: true }));
    arrangeTx([[{ id: 'NEW' }], []]);
    await call();
    expect(txCalls[0].values[3]).toBe(false);
    arrange(boardRow({ is_system_admin: true }));
    arrangeTx([[{ id: 'NEW' }], []]);
    await call();
    expect(txCalls[0].values[3]).toBe(false);
  });

  it('returning signed-in user: 2 round-trips, UPDATE of their existing participant, no transaction', async () => {
    arrange(boardRow({ user_participant_id: 'mine' }), [[{ id: 'mine', is_admin: true }]]);
    const res = await call();
    expect(roundTrips()).toBe(2);
    expect(mocks.tx).not.toHaveBeenCalled();
    expect(sqlCalls[1].text).toContain('UPDATE participants');
    expect(sqlCalls[1].values).toContain('mine');
    expect(await res.json()).toMatchObject({ reused: true, participant: { id: 'mine' } });
    expect(mocks.setCookie).toHaveBeenCalledWith(expect.anything(), 'b1', 'mine');
  });

  it('lost race: upsert returns the other join\'s row -> reused, cookie of the surviving row, no publish', async () => {
    arrange(boardRow());
    arrangeTx([[{ id: 'WINNER', is_admin: false }], []]);
    const res = await call();
    expect(await res.json()).toMatchObject({ reused: true, participant: { id: 'WINNER' } });
    expect(mocks.setCookie).toHaveBeenCalledWith(expect.anything(), 'b1', 'WINNER');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('a fresh insert publishes participant-joined once', async () => {
    arrange(boardRow());
    mocks.tx.mockImplementation(async (build: (t: unknown) => unknown[]) => {
      let newId = '';
      build((s: TemplateStringsArray, ...v: unknown[]) => { if (!newId) newId = String(v[0]); return {}; });
      return [[{ id: newId }], []];
    });
    const res = await call();
    expect(await res.json()).toMatchObject({ reused: false });
    expect(mocks.publish).toHaveBeenCalledWith('participant-joined', expect.anything());
  });
});

describe('join: completed board', () => {
  it('stranger gets 409 after one round-trip', async () => {
    arrange(boardRow({ archived_at: '2026-01-01' }));
    const res = await call();
    expect(res.status).toBe(409);
    expect(roundTrips()).toBe(1);
  });

  it('signed-in user with an existing participant may still re-establish', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'u1' } });
    arrange(boardRow({ archived_at: '2026-01-01', user_participant_id: 'mine' }), [[{ id: 'mine' }]]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(roundTrips()).toBe(2);
  });
});
