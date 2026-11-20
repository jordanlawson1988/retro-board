import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
  publish: vi.fn(),
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
vi.mock('@/lib/board-publish', () => ({ publishCard: (...a: unknown[]) => mocks.publish(...a) }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { POST } from '@/app/api/boards/[boardId]/groups/route';
import { phaseSettings } from '@/lib/phases';
import { groupTitleOutcome, groupResetOutcome } from '@/lib/groups';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const req = (method: string, body: unknown) =>
  new Request('http://x/api/boards/b1/groups', {
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

/** Every bound value of one sql call, and its text. */
const callValues = (i: number) => mocks.sql.mock.calls[i].slice(1);
const callText = (i: number) => (mocks.sql.mock.calls[i][0] as string[]).join('?');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
});

const guidedRow = (over: Record<string, unknown> = {}) =>
  ctxRow({ mode: 'guided', phase: 'group', settings: { ...phaseSettings('group') }, ...over });
const card = { id: 'c1', board_id: 'b1', column_id: 'col1', text: 't', author_id: 'p2', author_name: 'Bo', position: 1, reactions: {}, merged_with: null, color: null, group_title: 'Deploys' };
const post = (body: unknown) => POST(req('POST', body), ctx);

describe('set-title', () => {
  it('sets the title on a lead card in two round-trips and publishes the card', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ target_is_lead: true, ...card }]);
    const res = await post({ action: 'set-title', cardId: 'c1', title: '  Deploys ' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.card.group_title).toBe('Deploys');
    expect(json.card).not.toHaveProperty('target_is_lead');
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callValues(1)).toEqual(expect.arrayContaining(['Deploys', 'c1', 'b1', 'group']));
    expect(callText(1)).toContain('merged_with = c.id');
    expect(mocks.publish).toHaveBeenCalledWith('b1', 'card-updated', expect.objectContaining({ id: 'c1' }), expect.anything());
    expect(mocks.publish.mock.calls[0][2]).not.toHaveProperty('target_is_lead');
  });
  it('an empty title is written as null', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ target_is_lead: true, ...card, group_title: null }]);
    const res = await post({ action: 'set-title', cardId: 'c1', title: '   ' });
    expect(res.status).toBe(200);
    expect(callValues(1)).toContain(null);
    expect(callValues(1)).not.toContain('   ');
  });
  it('a viewer who may not see the text does not get the title back', async () => {
    mocks.sql
      .mockResolvedValueOnce([guidedRow({ settings: { ...phaseSettings('group'), card_visibility: 'hidden' } })])
      .mockResolvedValueOnce([{ target_is_lead: true, ...card }]);
    const res = await post({ action: 'set-title', cardId: 'c1', title: 'Deploys' });
    const json = await res.json();
    expect(json.card.text).toBe('');
    expect(json.card.group_title).toBeNull();
  });
  it('404 for no card, 409 for a card that is not a lead, 409 when the phase moved', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([]);
    expect((await post({ action: 'set-title', cardId: 'zz', title: 'x' })).status).toBe(404);
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ target_is_lead: false, id: null }]);
    const notLead = await post({ action: 'set-title', cardId: 'c3', title: 'x' });
    expect(notLead.status).toBe(409);
    expect((await notLead.json()).error).toBe('Only a group can have a title');
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ target_is_lead: true, id: null }]);
    const moved = await post({ action: 'set-title', cardId: 'c1', title: 'x' });
    expect(moved.status).toBe(409);
    expect((await moved.json()).error).toBe('The phase already changed');
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it('400 for a title over 80 characters, before the database', async () => {
    const res = await post({ action: 'set-title', cardId: 'c1', title: 'x'.repeat(81) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Group title must be at most 80 characters');
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it('409 during Vote from the guard; 409 on an open board with no second statement', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ phase: 'vote', settings: phaseSettings('vote') })]);
    expect((await (await post({ action: 'set-title', cardId: 'c1', title: 'x' })).json()).error).toBe('Not available during Vote');
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    const open = await post({ action: 'set-title', cardId: 'c1', title: 'x' });
    expect(open.status).toBe(409);
    expect((await open.json()).error).toBe('This board is not in guided mode');
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it('401 for someone with no participant session', async () => {
    mocks.pid.mockReturnValue(null);
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_id: null })]);
    const res = await post({ action: 'set-title', cardId: 'c1', title: 'x' });
    expect(res.status).toBe(401);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
});

describe('reset', () => {
  it('a facilitator clears grouping in one statement that never names votes, then asks clients to refetch', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_is_admin: true })]).mockResolvedValueOnce([{ board_ok: true, cleared: 4 }]);
    const res = await post({ action: 'reset' });
    expect(await res.json()).toEqual({ ok: true, cleared: 4 });
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toContain('merged_with = NULL, group_title = NULL');
    expect(callText(1)).not.toMatch(/\bvotes\b/);
    expect(callValues(1)).toEqual(expect.arrayContaining(['b1', 'group']));
    expect(channelPublish).toHaveBeenCalledWith('grouping-reset', { phase: 'group', refetch: true });
  });
  it('nothing to clear publishes nothing', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_is_admin: true })]).mockResolvedValueOnce([{ board_ok: true, cleared: 0 }]);
    const res = await post({ action: 'reset' });
    expect(await res.json()).toEqual({ ok: true, cleared: 0 });
    expect(channelPublish).not.toHaveBeenCalled();
  });
  it('403 for a participant; 409 when the phase moved after the load', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    expect((await post({ action: 'reset' })).status).toBe(403);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_is_admin: true })]).mockResolvedValueOnce([{ board_ok: false, cleared: 0 }]);
    const moved = await post({ action: 'reset' });
    expect(moved.status).toBe(409);
    expect((await moved.json()).error).toBe('The phase already changed');
    expect(channelPublish).not.toHaveBeenCalled();
  });
  it('409 on an open board for a facilitator, with no second statement', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ cp_is_admin: true })]);
    const res = await post({ action: 'reset' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('This board is not in guided mode');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(channelPublish).not.toHaveBeenCalled();
  });
  it('409 on a completed guided board', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_is_admin: true, archived_at: '2026-01-01T00:00:00Z' })]);
    expect((await post({ action: 'reset' })).status).toBe(409);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
  it('400 for an unknown action or a missing cardId', async () => {
    expect((await post({ action: 'shuffle' })).status).toBe(400);
    expect((await post({ action: 'set-title', title: 'x' })).status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});

describe('outcome mapping', () => {
  it('groupTitleOutcome', () => {
    expect(groupTitleOutcome([])).toBe('card-missing');
    expect(groupTitleOutcome([{ target_is_lead: false, id: null }])).toBe('not-a-group');
    expect(groupTitleOutcome([{ target_is_lead: true, id: null }])).toBe('phase-changed');
    expect(groupTitleOutcome([{ target_is_lead: true, id: 'c1' }])).toBe('ok');
  });
  it('groupResetOutcome', () => {
    expect(groupResetOutcome({ board_ok: false, cleared: 0 })).toBe('phase-changed');
    expect(groupResetOutcome({ board_ok: true, cleared: 0 })).toBe('ok');
  });
});
