import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => mocks.sql(...a) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/ably-server', () => ({ ablyServer: { channels: { get: () => ({ publish: vi.fn() }) } } }));
vi.mock('@/lib/rate-limit', () => ({ rateLimitOr429: async () => null }));
vi.mock('@/lib/board-publish', () => ({ publishCard: (...a: unknown[]) => mocks.publish(...a) }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { POST, PATCH, DELETE } from '@/app/api/boards/[boardId]/cards/route';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const req = (method: string, body: unknown) =>
  new Request('http://x/api/boards/b1/cards', {
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

const cardRow = { id: 'c1', board_id: 'b1', column_id: 'col1', text: 't', author_id: 'p1', author_name: 'Ann', position: 1, reactions: {}, merged_with: null, color: null };

/** Flatten every bound value of every sql call. */
const callValues = (i: number) => mocks.sql.mock.calls[i].slice(1);
const callText = (i: number) => (mocks.sql.mock.calls[i][0] as string[]).join('?');

function fkError(constraint: string) {
  return Object.assign(new Error('fk'), { code: '23503', constraint });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
});

describe('card POST', () => {
  it('v2: context query + one INSERT, name from the cookie participant', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([cardRow]);
    const res = await POST(req('POST', { id: 'c1', columnId: 'col1', text: 'hi', position: 1 }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callValues(1)).toEqual(expect.arrayContaining(['Ann', 'p1', 'col1']));
  });

  it('v1: context query + one INSERT with the body-claimed author', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ trust_version: 1, cp_id: null })]).mockResolvedValueOnce([cardRow]);
    const res = await POST(req('POST', { id: 'c1', columnId: 'col1', text: 'hi', position: 1, authorId: 'x', authorName: 'Bob' }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callValues(1)).toEqual(expect.arrayContaining(['Bob', 'x']));
  });

  it('unknown column: FK violation on the composite key is the same 404', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockRejectedValueOnce(fkError('cards_column_id_board_id_fkey'));
    const res = await POST(req('POST', { id: 'c1', columnId: 'nope', text: 'hi', position: 1 }), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Column not found');
  });

  it('other database errors still throw', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockRejectedValueOnce(Object.assign(new Error('boom'), { code: '23505' }));
    await expect(POST(req('POST', { id: 'c1', columnId: 'col1', text: 'hi', position: 1 }), ctx)).rejects.toThrow('boom');
  });
});

describe('card PATCH', () => {
  it('position-only move: context query + one UPDATE (2 calls, no pre-read, no re-select)', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([cardRow]);
    const res = await PATCH(req('PATCH', { cardId: 'c1', updates: { position: 3 } }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toMatch(/UPDATE cards/);
  });

  it('full PATCH (text, color, column, position, merge): still 2 calls', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([cardRow]);
    const res = await PATCH(
      req('PATCH', { cardId: 'c1', updates: { text: 'n', color: '#fff', column_id: 'col2', position: 2, merged_with: 'c2' } }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
  });

  it('unknown card: 404', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([]);
    const res = await PATCH(req('PATCH', { cardId: 'nope', updates: { position: 3 } }), ctx);
    expect(res.status).toBe(404);
  });

  it('unknown target column and unknown merge target map FK violations to 404', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockRejectedValueOnce(fkError('cards_column_id_board_id_fkey'));
    let res = await PATCH(req('PATCH', { cardId: 'c1', updates: { column_id: 'nope' } }), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Column not found');
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockRejectedValueOnce(fkError('cards_merged_with_board_id_fkey'));
    res = await PATCH(req('PATCH', { cardId: 'c1', updates: { merged_with: 'nope' } }), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Card not found');
  });

  it('v2 non-author text edit: author check is in the UPDATE; a miss on an existing card is 403', async () => {
    mocks.pid.mockReturnValue('p2');
    mocks.sql
      .mockResolvedValueOnce([ctxRow({ cp_id: 'p2' })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ author_id: 'p1' }]);
    const res = await PATCH(req('PATCH', { cardId: 'c1', updates: { text: 'x' } }), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Only the author can change this card');
    expect(callValues(1)).toContain('p2');
  });

  it('v2 author text edit: 2 calls', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([cardRow]);
    const res = await PATCH(req('PATCH', { cardId: 'c1', updates: { text: 'x' } }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
  });

  it('v2 reaction: atomic merge for the cookie participant only, 2 calls', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([cardRow]);
    const res = await PATCH(req('PATCH', { cardId: 'c1', updates: { reactions: { '👍': ['p1', 'p9'], '🎉': ['p9'] } } }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    const values = callValues(1);
    expect(values).toContain('merge');
    expect(values).toContain('p1');
    expect(values).toContain(JSON.stringify(['👍']));
  });

  it('v2 reaction naming a duplicate id is 403 without touching the database again', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    const res = await PATCH(req('PATCH', { cardId: 'c1', updates: { reactions: { '👍': ['p1', 'p1'] } } }), ctx);
    expect(res.status).toBe(403);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it('v2 reaction map listing someone else: not refused; only the actor is merged, foreign ids are never bound as the actor', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([cardRow]);
    const res = await PATCH(req('PATCH', { cardId: 'c1', updates: { reactions: { '👍': ['p1', 'p7'], '🎉': ['p7'] } } }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    const values = callValues(1);
    expect(values).toContain(JSON.stringify(['👍']));
    expect(callText(1)).not.toMatch(/sid\.id <> /);
  });

  it('v2 stale map (still lists a reactor who just left) is a 200 even when zero rows would have matched the old guard', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([{ ...cardRow, reactions: { '👍': ['p1'] } }]);
    const res = await PATCH(req('PATCH', { cardId: 'c1', updates: { reactions: { '👍': ['p2', 'p1'] } } }), ctx);
    expect(res.status).toBe(200);
  });

  it('v2 reaction on a missing card is 404 (no 403 follow-up read)', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([]);
    const res = await PATCH(req('PATCH', { cardId: 'nope', updates: { reactions: { '👍': ['p1'] } } }), ctx);
    expect(res.status).toBe(404);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
  });

  it('empty updates: 400 with zero database calls (no write, no publish)', async () => {
    for (const updates of [{}, { unknown_field: 1 }, { text: undefined }]) {
      const res = await PATCH(req('PATCH', { cardId: 'c1', updates }), ctx);
      expect(res.status).toBe(400);
      expect(typeof (await res.json()).error).toBe('string');
    }
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('v1 reaction (no actor id): keeps replace behaviour', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ trust_version: 1, cp_id: null })]).mockResolvedValueOnce([cardRow]);
    const res = await PATCH(req('PATCH', { cardId: 'c1', updates: { reactions: { '👍': ['x'] } } }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callValues(1)).toContain('replace');
  });
});

describe('card DELETE', () => {
  it('v2 author: context query + one DELETE', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([{ id: 'c1' }]);
    const res = await DELETE(req('DELETE', { cardId: 'c1' }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
  });

  it('v2 non-author or missing card: 403, as before', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([]);
    const res = await DELETE(req('DELETE', { cardId: 'c1' }), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Only the author can change this card');
  });
});
