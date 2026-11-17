import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ sql: vi.fn(), session: vi.fn(), pid: vi.fn() }));

vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => mocks.sql(...a) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/ably-server', () => ({ ablyServer: { channels: { get: () => ({ publish: vi.fn() }) } } }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { POST } from '@/app/api/boards/[boardId]/columns/route';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const req = (body: unknown) =>
  new Request('http://x/api/boards/b1/columns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const good = { id: 'col1234567', title: 'T', color: '#fff', position: 0 };

function ctxRow() {
  return {
    id: 'b1', trust_version: 2, settings: { card_visibility: 'visible' }, archived_at: null, deleted_at: null,
    owner_id: 'owner', created_by: null,
    cp_id: 'p1', cp_is_admin: true, cp_display_name: 'Ann', claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, session_live: true, user_participant_id: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
});

describe('column POST ids', () => {
  it('rejects an over-long or malformed id with 400 and writes nothing', async () => {
    for (const id of ['x'.repeat(65), '', 'a b']) {
      const res = await POST(req({ ...good, id }), ctx);
      expect(res.status).toBe(400);
      expect(typeof (await res.json()).error).toBe('string');
    }
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('duplicate column id (23505 on columns_pkey) is 409', async () => {
    const dup = Object.assign(new Error('dup'), { code: '23505', constraint: 'columns_pkey' });
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockRejectedValueOnce(dup);
    const res = await POST(req(good), ctx);
    expect(res.status).toBe(409);
    expect(typeof (await res.json()).error).toBe('string');
  });

  it('a unique violation on another constraint still propagates', async () => {
    const other = Object.assign(new Error('dup'), { code: '23505', constraint: 'cards_pkey' });
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockRejectedValueOnce(other);
    await expect(POST(req(good), ctx)).rejects.toBe(other);
  });
});
