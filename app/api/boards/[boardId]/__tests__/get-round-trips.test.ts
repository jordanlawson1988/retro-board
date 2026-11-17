import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  tx: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  sql: (...a: unknown[]) => mocks.sql(...a),
  sqlTransaction: (...a: unknown[]) => mocks.tx(...a),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/ably-server', () => ({ ablyServer: {} }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { GET } from '@/app/api/boards/[boardId]/route';
import { NextRequest } from 'next/server';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const call = () => GET(new NextRequest('http://x/api/boards/b1'), ctx);

function ctxRow(over: Record<string, unknown> = {}) {
  return {
    id: 'b1', title: 'T', trust_version: 2, settings: {}, archived_at: null, deleted_at: null,
    owner_id: 'owner', created_by: null,
    cp_id: null, cp_is_admin: null, cp_display_name: null, claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, user_participant_id: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue(null);
  mocks.tx.mockResolvedValue([[{ id: 'c1' }], [], [], [], [{ id: 'p1', user_id: 'u1' }]]);
});

describe('board GET round-trip budget', () => {
  it('signed-in joined v2 viewer: one sql + one transaction', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'u1' } });
    mocks.pid.mockReturnValue('p1');
    mocks.sql.mockResolvedValue([
      ctxRow({ cp_id: 'p1', cp_is_admin: false, cp_display_name: 'Ann', is_member: true, user_participant_id: 'p1' }),
    ]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
    expect(mocks.tx.mock.calls[0][1]).toEqual({ readOnly: true, isolationLevel: 'RepeatableRead' });
    const json = await res.json();
    expect(json.yourParticipantId).toBe('p1');
    expect(json.youAre).toMatchObject({ participantId: 'p1', joined: true });
    expect(json.board.id).toBe('b1');
    expect(json.board).not.toHaveProperty('cp_id');
  });

  it('completed-closed stranger: one sql, no transaction', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ archived_at: '2026-01-01' })]);
    const res = await call();
    const json = await res.json();
    expect(json.access).toBe('completed-closed');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).not.toHaveBeenCalled();
  });

  it('missing board: 404 after one sql', async () => {
    mocks.sql.mockResolvedValue([]);
    expect((await call()).status).toBe(404);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it('trashed board: 404 for a stranger, visible to its owner and to a system admin', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ deleted_at: '2026-01-01' })]);
    expect((await call()).status).toBe(404);
    mocks.session.mockResolvedValue({ user: { id: 'owner' } });
    expect((await call()).status).toBe(200);
    mocks.session.mockResolvedValue({ user: { id: 'adm' } });
    mocks.sql.mockResolvedValue([ctxRow({ deleted_at: '2026-01-01', is_system_admin: true })]);
    expect((await call()).status).toBe(200);
    mocks.sql.mockResolvedValue([ctxRow({ deleted_at: '2026-01-01', is_member: true, member_role: 'facilitator' })]);
    expect((await call()).status).toBe(404);
  });
});
