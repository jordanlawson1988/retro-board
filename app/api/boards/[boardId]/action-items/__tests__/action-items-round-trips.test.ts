import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
  channelPublish: vi.fn(),
}));
const channelPublish = mocks.channelPublish;

vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => mocks.sql(...a) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/ably-server', () => ({
  ablyServer: { channels: { get: () => ({ publish: (...a: unknown[]) => mocks.channelPublish(...a) }) } },
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimitOr429: async () => null }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { POST, PATCH, DELETE } from '@/app/api/boards/[boardId]/action-items/route';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const req = (method: string, body: unknown) =>
  new Request('http://x/api/boards/b1/action-items', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

function ctxRow(over: Record<string, unknown> = {}) {
  return {
    id: 'b1', trust_version: 2, settings: { card_visibility: 'visible' }, archived_at: null, deleted_at: null,
    owner_id: 'owner', created_by: null,
    cp_id: 'p1', cp_is_admin: false, cp_display_name: 'Ann', claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, session_live: true, user_participant_id: null,
    ...over,
  };
}

const callValues = (i: number) => mocks.sql.mock.calls[i].slice(1);
const callText = (i: number) => (mocks.sql.mock.calls[i][0] as string[]).join('?');

const ITEM_ID = '123e4567-e89b-12d3-a456-426614174000';
const item = { id: ITEM_ID, board_id: 'b1', description: 'Do it', assignee: 'Ann', due_date: '2026-12-01', status: 'open', created_by: 'p1' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
});

describe('open board action item statements (pinned before the guided work)', () => {
  it('POST insert statement', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([item]);
    const res = await POST(req('POST', { description: 'Do it', assignee: 'Ann', dueDate: '2026-12-01' }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ item });
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toMatchInlineSnapshot(`
      "
          INSERT INTO action_items (board_id, description, assignee, due_date, created_by)
          VALUES (?, ?, ?, ?, ?)
          RETURNING *
        "
    `);
    expect(callValues(1)).toEqual(['b1', 'Do it', 'Ann', '2026-12-01', 'p1']);
    expect(channelPublish).toHaveBeenCalledWith('action-item-created', { item });
  });

  it('PATCH update statement', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([{ ...item, status: 'done' }]);
    const res = await PATCH(req('PATCH', { itemId: ITEM_ID, updates: { status: 'done' } }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ item: { ...item, status: 'done' } });
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toMatchInlineSnapshot(`
      "
          UPDATE action_items SET
            description = CASE WHEN ?::boolean THEN ?::text ELSE description END,
            assignee = CASE WHEN ?::boolean THEN ?::text ELSE assignee END,
            due_date = CASE WHEN ?::boolean THEN ?::date ELSE due_date END,
            status = CASE WHEN ?::boolean THEN ?::text ELSE status END
          WHERE id = ? AND board_id = ?
          RETURNING *
        "
    `);
    expect(callValues(1)).toEqual([false, null, false, null, false, null, true, 'done', ITEM_ID, 'b1']);
    expect(channelPublish).toHaveBeenCalledWith('action-item-updated', { item: { ...item, status: 'done' } });
  });

  it('DELETE statement', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([{ id: ITEM_ID }]);
    const res = await DELETE(req('DELETE', { itemId: ITEM_ID }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toMatchInlineSnapshot(`"DELETE FROM action_items WHERE id = ? AND board_id = ? RETURNING id"`);
    expect(callValues(1)).toEqual([ITEM_ID, 'b1']);
    expect(channelPublish).toHaveBeenCalledWith('action-item-deleted', { itemId: ITEM_ID });
  });

  it('an open POST carrying cardId and assigneeParticipantId runs the same statement and values', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([item]);
    await POST(req('POST', { description: 'Do it', assignee: 'Ann', dueDate: '2026-12-01' }), ctx);
    const plainText = callText(1);
    const plainValues = callValues(1);
    mocks.sql.mockClear();
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([item]);
    const res = await POST(
      req('POST', { description: 'Do it', assignee: 'Ann', dueDate: '2026-12-01', cardId: 'c1', assigneeParticipantId: 'p9' }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toBe(plainText);
    expect(callValues(1)).toEqual(plainValues);
  });

  it('an open POST with a bad cardId or owner is still accepted', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([item]);
    const res = await POST(req('POST', { description: 'Do it', cardId: 'bad id!', assigneeParticipantId: 5 }), ctx);
    expect(res.status).toBe(200);
  });

  it('an open PATCH with assignee_participant_id runs the pinned statement', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([{ ...item, status: 'done' }]);
    const res = await PATCH(
      req('PATCH', { itemId: ITEM_ID, updates: { status: 'done', assignee_participant_id: 'p9' } }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(callText(1)).toMatchInlineSnapshot(`
      "
          UPDATE action_items SET
            description = CASE WHEN ?::boolean THEN ?::text ELSE description END,
            assignee = CASE WHEN ?::boolean THEN ?::text ELSE assignee END,
            due_date = CASE WHEN ?::boolean THEN ?::date ELSE due_date END,
            status = CASE WHEN ?::boolean THEN ?::text ELSE status END
          WHERE id = ? AND board_id = ?
          RETURNING *
        "
    `);
    expect(callValues(1)).toEqual([false, null, false, null, false, null, true, 'done', ITEM_ID, 'b1']);
  });
});
