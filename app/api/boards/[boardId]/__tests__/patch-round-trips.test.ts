import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  sql: (...a: unknown[]) => mocks.sql(...a),
  sqlTransaction: vi.fn(),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/ably-server', () => ({
  ablyServer: { channels: { get: () => ({ publish: (...a: unknown[]) => mocks.publish(...a) }) } },
}));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { PATCH as boardPatch } from '@/app/api/boards/[boardId]/route';
import { PATCH as itemPatch } from '@/app/api/boards/[boardId]/action-items/route';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const req = (path: string, body: unknown) =>
  new Request(`http://x/api/boards/b1${path}`, { method: 'PATCH', body: JSON.stringify(body) });

function ctxRow(over: Record<string, unknown> = {}) {
  return {
    id: 'b1', title: 'T', trust_version: 2, settings: { ...DEFAULT_BOARD_SETTINGS }, archived_at: null, deleted_at: null,
    owner_id: 'owner', created_by: null,
    cp_id: 'p1', cp_is_admin: true, cp_display_name: 'Ann', claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, user_participant_id: null,
    ...over,
  };
}

const ITEM_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
});

describe('board PATCH round-trip budget: 2 statements (context + one UPDATE)', () => {
  it('settings patch: one context query, one UPDATE, merged settings published', async () => {
    const merged = { ...DEFAULT_BOARD_SETTINGS, card_visibility: 'visible', timer: { duration: 60, remaining: 60, status: 'running', started_at: null } };
    mocks.sql
      .mockResolvedValueOnce([ctxRow()])
      .mockResolvedValueOnce([{ title: 'T', description: null, settings: merged }]);
    const res = await boardPatch(req('', { settings: { card_visibility: 'visible' } }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    // The UPDATE carries ONLY the patch (not the whole settings object).
    const updateValues = mocks.sql.mock.calls[1].slice(1);
    expect(updateValues).toContain(JSON.stringify({ card_visibility: 'visible' }));
    // Echo carries the MERGED settings and asks clients to refetch (hidden -> visible).
    expect(mocks.publish).toHaveBeenCalledWith('board-updated', { settings: merged, refetch: true });
  });

  it('reveal is judged against the merged result, not the patch: no refetch when already visible', async () => {
    const loadedVisible = { ...DEFAULT_BOARD_SETTINGS, card_visibility: 'visible' };
    mocks.sql
      .mockResolvedValueOnce([ctxRow({ settings: loadedVisible })])
      .mockResolvedValueOnce([{ title: 'T', description: null, settings: { ...loadedVisible, voting_enabled: true } }]);
    const res = await boardPatch(req('', { settings: { voting_enabled: true } }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.publish.mock.calls[0][1]).not.toHaveProperty('refetch');
  });

  it('invalid settings: 400 with zero queries', async () => {
    const res = await boardPatch(req('', { settings: { card_visibility: 'nope' } }), ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid value for setting: card_visibility' });
    const res2 = await boardPatch(req('', { settings: { mystery: 1 } }), ctx);
    expect(res2.status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('completed board: settings still 409, no UPDATE', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ archived_at: '2026-01-01' })]);
    const res = await boardPatch(req('', { settings: { card_visibility: 'visible' } }), ctx);
    expect(res.status).toBe(409);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it('title + description rename: one context query and one UPDATE for both fields', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'owner' } });
    mocks.sql
      .mockResolvedValueOnce([ctxRow()])
      .mockResolvedValueOnce([{ title: 'New', description: 'd', settings: DEFAULT_BOARD_SETTINGS }]);
    const res = await boardPatch(req('', { title: ' New ', description: 'd' }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(mocks.publish).toHaveBeenCalledWith('board-updated', { title: 'New', description: 'd' });
  });

  it('rename by a non-facilitator: 403 after the context query only; anonymous: 401', async () => {
    mocks.sql.mockResolvedValue([ctxRow()]);
    expect((await boardPatch(req('', { title: 'x' }), ctx)).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { id: 'stranger' } });
    expect((await boardPatch(req('', { title: 'x' }), ctx)).status).toBe(403);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
  });
});

describe('action-item PATCH round-trip budget: 2 statements (context + one UPDATE)', () => {
  it('multi-field patch is a single UPDATE ... RETURNING', async () => {
    const item = { id: ITEM_ID, board_id: 'b1', description: 'd', assignee: 'a', due_date: null, status: 'done' };
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([item]);
    const res = await itemPatch(req('/action-items', { itemId: ITEM_ID, updates: { description: 'd', assignee: 'a', status: 'done' } }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({ item });
    expect(mocks.publish).toHaveBeenCalledWith('action-item-updated', { item });
  });

  it('missing item: 404 after two statements', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([]);
    const res = await itemPatch(req('/action-items', { itemId: ITEM_ID, updates: { status: 'done' } }), ctx);
    expect(res.status).toBe(404);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
  });
});
