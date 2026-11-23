import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
  publish: vi.fn(),
  publishDeleted: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => mocks.sql(...a) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/ably-server', () => ({ ablyServer: { channels: { get: () => ({ publish: vi.fn() }) } } }));
vi.mock('@/lib/rate-limit', () => ({ rateLimitOr429: async () => null }));
vi.mock('@/lib/board-publish', () => ({
  publishComment: (...a: unknown[]) => mocks.publish(...a),
  publishCommentDeleted: (...a: unknown[]) => mocks.publishDeleted(...a),
}));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { POST, PATCH, DELETE } from '@/app/api/boards/[boardId]/comments/route';
import { phaseSettings } from '@/lib/phases';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const req = (method: string, body: unknown) =>
  new Request('http://x/api/boards/b1/comments', {
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

const guidedRow = (over: Record<string, unknown> = {}) =>
  ctxRow({ mode: 'guided', phase: 'discuss', settings: phaseSettings('discuss'), ...over });

const ID = '00000000-0000-4000-8000-0000000000a1';
const REPLY_ID = '00000000-0000-4000-8000-0000000000a2';
const row = (over: Record<string, unknown> = {}) => ({
  id: ID, board_id: 'b1', card_id: 'L', parent_id: null, author_participant_id: 'p1', author_name: 'Ann',
  is_anonymous: false, body: 'hi', created_at: '2026-11-20T10:00:00.000Z', edited_at: null, deleted_at: null,
  ...over,
});
const createFlags = { board_ok: true, card_found: 1, card_parent: null, parent_ok: true, comment_count: 3 };
const editFlags = { board_ok: true, found: 1, is_deleted: false, is_author: true };
const deleteFlags = { board_ok: true, found: 1, already_deleted: false, permitted: true, removed_ids: [ID] };
const FLAG_KEYS = [
  'board_ok', 'card_found', 'card_parent', 'parent_ok', 'comment_count', 'found', 'is_deleted',
  'is_author', 'already_deleted', 'permitted', 'removed_ids',
];

const post = (body: unknown) => POST(req('POST', body), ctx);
const patch = (body: unknown) => PATCH(req('PATCH', body), ctx);
const del = (body: unknown) => DELETE(req('DELETE', body), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
});

describe('create', () => {
  it('creates a comment in two round-trips, shaped for the author, and publishes the stored row', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ ...createFlags, ...row() }]);
    const res = await post({ cardId: 'L', body: '  hi ' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.comment).toMatchObject({ id: ID, body: 'hi', author_participant_id: 'p1', author_name: 'Ann', is_mine: true });
    for (const k of FLAG_KEYS) expect(json.comment).not.toHaveProperty(k);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toContain('FOR SHARE');
    expect(callText(1)).toContain('room.n < ?');
    expect(callText(1)).toContain('target.merged_with IS NULL');
    expect(callText(1)).toContain('parent.parent_id IS NULL AND parent.deleted_at IS NULL');
    expect(callValues(1)).toEqual(expect.arrayContaining(['L', 'hi', false, 500, 'discuss']));
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledWith('b1', 'comment-created', row());
  });

  it('what is published is the stored row, never the caller-shaped one, and carries no flag column', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow()])
      .mockResolvedValueOnce([{ ...createFlags, ...row({ is_anonymous: true }) }]);
    await post({ cardId: 'L', body: 'hi', anonymous: true });
    const published = mocks.publish.mock.calls[0][2];
    expect(published).toEqual(row({ is_anonymous: true }));
    expect(published).not.toHaveProperty('is_mine');
    for (const k of FLAG_KEYS) expect(published).not.toHaveProperty(k);
  });

  it('an anonymous create answers with both author fields null and is_mine true', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow()])
      .mockResolvedValueOnce([{ ...createFlags, ...row({ is_anonymous: true }) }]);
    const json = await (await post({ cardId: 'L', body: 'hi', anonymous: true })).json();
    expect(json.comment).toMatchObject({ author_participant_id: null, author_name: null, is_anonymous: true, is_mine: true });
    expect(callValues(1)).toContain(true);
  });

  it('a reply passes the parent id to the statement', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow()])
      .mockResolvedValueOnce([{ ...createFlags, ...row({ id: REPLY_ID, parent_id: ID }) }]);
    const res = await post({ cardId: 'L', body: 'yes', parentId: ID });
    expect(res.status).toBe(200);
    expect(callValues(1)).toContain(ID);
    expect((await res.json()).comment.parent_id).toBe(ID);
  });

  it.each([
    ['phase-changed', { board_ok: false }, 409, 'The phase already changed'],
    ['no row at all', null, 409, 'The phase already changed'],
    ['card-missing', { card_found: 0 }, 404, 'Card not found'],
    ['not-a-topic', { card_parent: 'root' }, 409, 'Comments go on a topic, not on a card inside it'],
    ['limit', { comment_count: 500 }, 409, 'This board has reached its limit of 500 comments'],
    ['inserted nothing', { id: null }, 409, 'The phase already changed'],
  ])('refuses: %s', async (_name, over, status, message) => {
    const result = over === null ? [] : [{ ...createFlags, ...row(), ...over }];
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce(result);
    const res = await post({ cardId: 'L', body: 'hi' });
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(message);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it.each([
    ['a reply', { cardId: 'L', body: 'hi', parentId: ID }, 'You can only reply to a comment that starts a thread'],
    ['a top-level comment', { cardId: 'L', body: 'hi' }, 'The phase already changed'],
  ])('a foreign-key violation (23503) on %s answers 409 and publishes nothing', async (_n, body, message) => {
    const err = Object.assign(new Error('Failing row contains (p1, Ann, secret)'), { code: '23503', detail: 'Failing row contains (p1, Ann)' });
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockRejectedValueOnce(err);
    const res = await post(body);
    expect(res.status).toBe(409);
    const text = JSON.stringify(await res.json());
    expect(text).toBe(JSON.stringify({ error: message }));
    expect(text).not.toContain('Ann');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('any other database error on create still propagates', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockRejectedValueOnce(Object.assign(new Error('boom'), { code: '40001' }));
    await expect(post({ cardId: 'L', body: 'hi' })).rejects.toThrow('boom');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('refuses a reply to something that is not a thread starter', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ ...createFlags, ...row(), parent_ok: false }]);
    const res = await post({ cardId: 'L', body: 'hi', parentId: ID });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('You can only reply to a comment that starts a thread');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it.each([
    ['empty text', { cardId: 'L', body: '   ' }, 'Write a comment first'],
    ['too long', { cardId: 'L', body: 'x'.repeat(1001) }, 'Comments can be at most 1000 characters'],
    ['anonymous not boolean', { cardId: 'L', body: 'hi', anonymous: 'yes' }, 'Invalid request body'],
    ['parentId malformed', { cardId: 'L', body: 'hi', parentId: 'nope' }, 'Invalid request body'],
    ['no cardId', { body: 'hi' }, 'Invalid request body'],
    ['cardId not a string', { cardId: 5, body: 'hi' }, 'Invalid request body'],
    ['body not a string', { cardId: 'L', body: 5 }, 'Invalid request body'],
  ])('400 before any query: %s', async (_name, body, message) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(message);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('409 during Vote after one round-trip', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ phase: 'vote', settings: phaseSettings('vote') })]);
    const res = await post({ cardId: 'L', body: 'hi' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Not available during Vote');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it('409 on an open board after one round-trip', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    const res = await post({ cardId: 'L', body: 'hi' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('This board is not in guided mode');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('401 for a signed-in facilitator with no participant row', async () => {
    mocks.pid.mockReturnValue(null);
    mocks.session.mockResolvedValue({ user: { id: 'u1' } });
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_id: null, is_member: true, member_role: 'facilitator' })]);
    const res = await post({ cardId: 'L', body: 'hi' });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Join the board first');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
});

describe('edit', () => {
  it('edits in two round-trips, shaped for the author, and publishes the stored row', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow()])
      .mockResolvedValueOnce([{ ...editFlags, ...row({ body: 'new', edited_at: '2026-11-20T10:05:00.000Z' }) }]);
    const res = await patch({ commentId: ID, body: ' new ' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.comment).toMatchObject({ body: 'new', is_mine: true });
    for (const k of FLAG_KEYS) expect(json.comment).not.toHaveProperty(k);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toContain('edited_at = now()');
    expect(callText(1)).toContain('cur.author_participant_id = ?');
    expect(callText(1)).toContain('FOR SHARE');
    expect(callText(1)).toContain('AND comments.deleted_at IS NULL AND comments.author_participant_id = ?');
    expect(callValues(1)).toEqual(expect.arrayContaining([ID, 'new', 'p1', 'discuss']));
    expect(mocks.publish).toHaveBeenCalledWith('b1', 'comment-updated', row({ body: 'new', edited_at: '2026-11-20T10:05:00.000Z' }));
  });

  it('an anonymous comment edit answers with both author fields null and is_mine true', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow()])
      .mockResolvedValueOnce([{ ...editFlags, ...row({ is_anonymous: true }) }]);
    const json = await (await patch({ commentId: ID, body: 'x' })).json();
    expect(json.comment).toMatchObject({ author_participant_id: null, author_name: null, is_mine: true });
  });

  it.each([
    ['not the author', { is_author: false }, 403, 'Only the author can edit this comment'],
    ['deleted', { is_deleted: true }, 409, 'This comment was deleted'],
    ['missing', { found: 0, is_deleted: null, is_author: null }, 404, 'Comment not found'],
    ['phase moved', { board_ok: false }, 409, 'The phase already changed'],
  ])('refuses: %s', async (_name, over, status, message) => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ ...editFlags, ...row(), ...over }]);
    const res = await patch({ commentId: ID, body: 'x' });
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(message);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('a row that was not updated although the snapshot was fine answers 409 This comment was deleted', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ ...editFlags, ...row(), id: null }]);
    const res = await patch({ commentId: ID, body: 'x' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('This comment was deleted');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('a facilitator who is not the author is refused', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow({ cp_is_admin: true })])
      .mockResolvedValueOnce([{ ...editFlags, ...row({ author_participant_id: 'p2' }), is_author: false, id: null }]);
    const res = await patch({ commentId: ID, body: 'x' });
    expect(res.status).toBe(403);
  });

  it.each([
    ['commentId malformed', { commentId: 'nope', body: 'x' }, 'Invalid request body'],
    ['empty text', { commentId: ID, body: ' ' }, 'Write a comment first'],
    ['too long', { commentId: ID, body: 'x'.repeat(1001) }, 'Comments can be at most 1000 characters'],
  ])('400 before any query: %s', async (_name, body, message) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(message);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('a facilitator without a participant row cannot edit (401)', async () => {
    mocks.pid.mockReturnValue(null);
    mocks.session.mockResolvedValue({ user: { id: 'u1' } });
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_id: null, is_member: true, member_role: 'facilitator' })]);
    expect((await patch({ commentId: ID, body: 'x' })).status).toBe(401);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it('409 on an open board after one round-trip', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    const res = await patch({ commentId: ID, body: 'x' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('This board is not in guided mode');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
});

describe('delete', () => {
  it('a top-level comment with replies answers a tombstone with body empty and no ids', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow()])
      .mockResolvedValueOnce([{ ...deleteFlags, removed_ids: [], ...row({ body: '', deleted_at: '2026-11-20T10:09:00.000Z' }) }]);
    const res = await del({ commentId: ID });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ids).toEqual([]);
    expect(json.tombstone).toMatchObject({ id: ID, body: '', author_participant_id: null, author_name: null, is_mine: false });
    for (const k of FLAG_KEYS) expect(json.tombstone).not.toHaveProperty(k);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toContain("SET body = '', deleted_at = now()");
    expect(callText(1)).toContain('p.deleted_at IS NOT NULL');
    expect(callText(1)).toContain("WHERE comments.id = allowed.id AND has_replies.yes AND comments.deleted_at IS NULL");
    expect(callText(1)).toContain('FOR SHARE');
    expect(mocks.publishDeleted).toHaveBeenCalledWith('b1', [], expect.objectContaining({ id: ID, deleted_at: '2026-11-20T10:09:00.000Z' }));
    expect(mocks.publishDeleted.mock.calls[0][2]).not.toHaveProperty('removed_ids');
  });

  it('the last reply under a tombstone answers both ids and no tombstone', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow()])
      .mockResolvedValueOnce([{ ...deleteFlags, removed_ids: [REPLY_ID, ID], id: null }]);
    const json = await (await del({ commentId: REPLY_ID })).json();
    expect(json).toEqual({ ids: [REPLY_ID, ID], tombstone: null });
    expect(mocks.publishDeleted).toHaveBeenCalledWith('b1', [REPLY_ID, ID], null);
  });

  it('a facilitator deleting someone else anonymous comment that becomes a tombstone gets both author fields null', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow({ cp_id: 'pf', cp_is_admin: true })])
      .mockResolvedValueOnce([
        {
          ...deleteFlags, removed_ids: [],
          ...row({ author_participant_id: 'p2', author_name: 'Bo', is_anonymous: true, body: '', deleted_at: '2026-11-20T10:09:00.000Z' }),
        },
      ]);
    const res = await del({ commentId: ID });
    const json = await res.json();
    expect(json.tombstone).toMatchObject({ author_participant_id: null, author_name: null, body: '', is_mine: false });
    expect(callValues(1)).toEqual(expect.arrayContaining([true]));
    const text = JSON.stringify(json);
    expect(text).not.toContain('p2');
    expect(text).not.toContain('Bo');
  });

  it('a facilitator passes true as the facilitator value; a participant passes false', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_is_admin: true })]).mockResolvedValueOnce([{ ...deleteFlags, id: null }]);
    await del({ commentId: ID });
    expect(callValues(1)).toEqual(expect.arrayContaining([true, 'p1']));
    mocks.sql.mockReset();
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ ...deleteFlags, id: null }]);
    await del({ commentId: ID });
    expect(callValues(1)).toEqual(expect.arrayContaining([false, 'p1']));
  });

  it('a signed-in facilitator with no participant row may delete: facilitator true, actor id null', async () => {
    mocks.pid.mockReturnValue(null);
    mocks.session.mockResolvedValue({ user: { id: 'u1' } });
    mocks.sql
      .mockResolvedValueOnce([guidedRow({ cp_id: null, is_member: true, member_role: 'facilitator' })])
      .mockResolvedValueOnce([{ ...deleteFlags, removed_ids: [ID], id: null }]);
    const res = await del({ commentId: ID });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ids: [ID], tombstone: null });
    const values = callValues(1);
    expect(values).toContain(true);
    expect(values).toContain(null);
    expect(callText(1)).toContain('?::boolean OR cur.author_participant_id = ?::text');
  });

  it.each([
    ['not permitted', { permitted: false }, 403, 'Only the author or a facilitator can delete this comment'],
    ['already deleted', { already_deleted: true }, 409, 'This comment was deleted'],
    ['missing', { found: 0, already_deleted: null, permitted: false }, 404, 'Comment not found'],
    ['phase moved', { board_ok: false }, 409, 'The phase already changed'],
  ])('refuses: %s', async (_name, over, status, message) => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ ...deleteFlags, id: null, ...over }]);
    const res = await del({ commentId: ID });
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(message);
    expect(mocks.publishDeleted).not.toHaveBeenCalled();
  });

  it('permitted but nothing changed (the row changed underneath) answers 409 and publishes nothing', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ ...deleteFlags, removed_ids: [], id: null }]);
    const res = await del({ commentId: ID });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('This comment was deleted');
    expect(mocks.publishDeleted).not.toHaveBeenCalled();
  });

  it('400 for a malformed commentId before any query', async () => {
    const res = await del({ commentId: 'nope' });
    expect(res.status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('409 during Vote and on an open board after one round-trip', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ phase: 'vote', settings: phaseSettings('vote') })]);
    expect((await (await del({ commentId: ID })).json()).error).toBe('Not available during Vote');
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    expect((await (await del({ commentId: ID })).json()).error).toBe('This board is not in guided mode');
    expect(mocks.sql).toHaveBeenCalledTimes(2);
  });
});
