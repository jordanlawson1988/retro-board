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

import { POST, PATCH } from '@/app/api/boards/[boardId]/action-items/route';
import { phaseSettings } from '@/lib/phases';

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

const guidedRow = (over: Record<string, unknown> = {}) =>
  ctxRow({ mode: 'guided', phase: 'discuss', settings: phaseSettings('discuss'), ...over });

const ITEM_ID = '123e4567-e89b-12d3-a456-426614174000';
const row = {
  id: ITEM_ID, board_id: 'b1', description: 'Do it', assignee: 'Bo', due_date: null, status: 'open',
  created_by: 'p1', card_id: 'c1', assignee_participant_id: 'p9',
};
const flags = { board_ok: true, topic_ok: true, owner_ok: true };
const FLAG_KEYS = ['board_ok', 'topic_ok', 'owner_ok'];

const post = (body: unknown) => POST(req('POST', body), ctx);
const patch = (updates: unknown) => PATCH(req('PATCH', { itemId: ITEM_ID, updates }), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
});

describe('guided create', () => {
  it('a topic action with an owner: 200, two round-trips, flags stripped from body and event', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ ...flags, ...row }]);
    const res = await post({ description: 'Do it', cardId: 'c1', assigneeParticipantId: 'p9', assignee: 'ignored' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ item: row });
    for (const k of FLAG_KEYS) expect(json.item).not.toHaveProperty(k);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    const text = callText(1);
    expect(text).toContain('FOR SHARE');
    expect(text).toContain('merged_with IS NULL');
    expect(text).toContain('COALESCE((SELECT display_name FROM owner)');
    expect(callValues(1)).toEqual(expect.arrayContaining(['c1', 'p9', 'discuss']));
    expect(channelPublish).toHaveBeenCalledWith('action-item-created', { item: row });
    const published = channelPublish.mock.calls[0][1].item;
    for (const k of FLAG_KEYS) expect(published).not.toHaveProperty(k);
  });

  it('a guided create without topic or owner in Reflect runs the guided statement and is 200', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow({ phase: 'reflect', settings: phaseSettings('reflect') })])
      .mockResolvedValueOnce([{ ...flags, ...row, card_id: null, assignee_participant_id: null }]);
    const res = await post({ description: 'Do it', assignee: 'Bo' });
    expect(res.status).toBe(200);
    expect(callText(1)).toContain('FOR SHARE');
    expect(callValues(1)).toContain('reflect');
  });

  it('a facilitator without a participant row can create: created_by is null', async () => {
    mocks.pid.mockReturnValue(null);
    mocks.session.mockResolvedValue({ user: { id: 'owner' } });
    mocks.sql
      .mockResolvedValueOnce([
        guidedRow({ cp_id: null, cp_display_name: null, user_participant_id: null, member_role: null }),
      ])
      .mockResolvedValueOnce([{ ...flags, ...row, created_by: null, card_id: 'c1' }]);
    const res = await post({ description: 'Do it', cardId: 'c1' });
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callValues(1)).not.toContain('p1');
    expect(callValues(1)).toContain(null);
    // board, description, phase and the nulls: created_by is one of the null values
    expect(callValues(1).filter((v: unknown) => v === null).length).toBeGreaterThanOrEqual(2);
  });

  it('a guided create with cardId in Vote is 409 and costs one round-trip', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ phase: 'vote', settings: phaseSettings('vote') })]);
    const res = await post({ description: 'Do it', cardId: 'c1' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Not available during Vote');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['board_ok false', { board_ok: false, topic_ok: true, owner_ok: true, id: null }, 409, 'The phase already changed'],
    ['topic_ok false', { board_ok: true, topic_ok: false, owner_ok: true, id: null }, 404, 'That topic is not on the agenda'],
    ['owner_ok false', { board_ok: true, topic_ok: true, owner_ok: false, id: null }, 404, 'That person is not on this board'],
  ])('%s', async (_n, outcome, status, message) => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([outcome]);
    const res = await post({ description: 'Do it', cardId: 'c1', assigneeParticipantId: 'p9' });
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(message);
    expect(channelPublish).not.toHaveBeenCalled();
  });

  it('a bad owner is 400 Invalid assignee and a bad cardId is 400 Invalid request body, after one round-trip', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    const a = await post({ description: 'Do it', assigneeParticipantId: 5 });
    expect(a.status).toBe(400);
    expect((await a.json()).error).toBe('Invalid assignee');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    mocks.sql.mockClear();
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    const b = await post({ description: 'Do it', cardId: 'bad id!' });
    expect(b.status).toBe(400);
    expect((await b.json()).error).toBe('Invalid request body');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(channelPublish).not.toHaveBeenCalled();
  });
});

describe('guided patch', () => {
  it('assignee_participant_id sets the owner: guided statement, 200, flags stripped', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow()])
      .mockResolvedValueOnce([{ board_ok: true, owner_ok: true, ...row }]);
    const res = await patch({ assignee_participant_id: 'p9' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ item: row });
    for (const k of FLAG_KEYS) expect(json.item).not.toHaveProperty(k);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toContain('WHEN ?::boolean THEN (SELECT display_name FROM owner)');
    expect(callText(1)).toContain('FOR SHARE');
    expect(callValues(1)).toEqual(expect.arrayContaining(['p9', 'discuss']));
    expect(channelPublish).toHaveBeenCalledWith('action-item-updated', { item: row });
    for (const k of FLAG_KEYS) expect(channelPublish.mock.calls[0][1].item).not.toHaveProperty(k);
  });

  it('owner_ok false is 404, a null id is 404 Action item not found, board_ok false is 409', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ board_ok: true, owner_ok: false, id: null }]);
    const a = await patch({ assignee_participant_id: 'p9' });
    expect(a.status).toBe(404);
    expect((await a.json()).error).toBe('That person is not on this board');
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ board_ok: true, owner_ok: true, id: null }]);
    const b = await patch({ status: 'done' });
    expect(b.status).toBe(404);
    expect((await b.json()).error).toBe('Action item not found');
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ board_ok: false, owner_ok: true, id: null }]);
    const c = await patch({ status: 'done' });
    expect(c.status).toBe(409);
    expect((await c.json()).error).toBe('The phase already changed');
    expect(channelPublish).not.toHaveBeenCalled();
  });

  it('a free-text assignee on a guided board runs the guided statement', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow()])
      .mockResolvedValueOnce([{ board_ok: true, owner_ok: true, ...row, assignee: 'Someone', assignee_participant_id: null }]);
    const res = await patch({ assignee: 'Someone' });
    expect(res.status).toBe(200);
    expect(callText(1)).toContain('FOR SHARE');
    expect(callValues(1)).toContain('Someone');
  });

  it('assignee_participant_id: 7 is 400 Invalid assignee', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    const res = await patch({ assignee_participant_id: 7 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid assignee');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
});
