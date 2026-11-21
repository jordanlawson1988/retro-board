import { describe, it, expect, vi, beforeEach } from 'vitest';
import { phaseSettings } from '@/lib/phases';
import { REOPEN_PHASE, FINAL_PHASE } from '@/lib/constants/phases';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  session: vi.fn(),
  fresh: vi.fn(),
  pid: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  sql: (...a: unknown[]) => mocks.sql(...a),
  sqlTransaction: vi.fn(),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => mocks.fresh(...a) } } }));
vi.mock('@/lib/ably-server', () => ({
  ablyServer: { channels: { get: () => ({ publish: (...a: unknown[]) => mocks.publish(...a) }) } },
}));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { PATCH, POST } from '@/app/api/boards/[boardId]/route';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const patchReq = (body: unknown) => new Request('http://x/api/boards/b1', { method: 'PATCH', body: JSON.stringify(body) });
const postReq = (body: unknown) => new Request('http://x/api/boards/b1', { method: 'POST', body: JSON.stringify(body) });

function ctxRow(over: Record<string, unknown> = {}) {
  return {
    id: 'b1', title: 'T', trust_version: 2, settings: { ...DEFAULT_BOARD_SETTINGS }, archived_at: null, deleted_at: null,
    owner_id: 'owner', created_by: null,
    cp_id: 'p1', cp_is_admin: true, cp_display_name: 'Ann', claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, session_live: true, user_participant_id: null,
    ...over,
  };
}
const guided = (phase: string, over: Record<string, unknown> = {}) =>
  ctxRow({ mode: 'guided', phase, phase_config: { deadline: null }, ...over });

const sqlText = (i: number) => (mocks.sql.mock.calls[i][0] as string[]).join('?').replace(/\s+/g, ' ');
const sqlValues = (i: number) => mocks.sql.mock.calls[i].slice(1);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.fresh.mockResolvedValue({ user: { id: 'owner' } });
  mocks.pid.mockReturnValue('p1');
});

describe('complete', () => {
  it('a guided board goes to done with the done settings, in the one UPDATE', async () => {
    const doneSettings = { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings(FINAL_PHASE) };
    mocks.sql.mockResolvedValueOnce([guided('discuss')]).mockResolvedValueOnce([{ settings: doneSettings }]);
    const res = await POST(postReq({ action: 'complete' }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(sqlText(1)).toContain('phase =');
    expect(sqlValues(1)).toContain(FINAL_PHASE);
    expect(sqlValues(1)).toContain(JSON.stringify(phaseSettings(FINAL_PHASE)));
    const [event, payload] = mocks.publish.mock.calls[0];
    expect(event).toBe('board-completed');
    expect(payload).toMatchObject({ phase: FINAL_PHASE, settings: doneSettings, refetch: true });
  });

  it('the guided statement clears the phase deadline; the open one never mentions phase_config', async () => {
    mocks.sql.mockResolvedValueOnce([guided('discuss')]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    await POST(postReq({ action: 'complete' }), ctx);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(sqlText(1)).toContain(`phase_config = phase_config || '{"deadline":null,"topic":null}'::jsonb`);
    mocks.sql.mockClear();
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    await POST(postReq({ action: 'complete' }), ctx);
    expect(sqlText(1)).not.toContain('phase_config');
  });

  it('an open board keeps its exact statement and publishes phase null', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    const res = await POST(postReq({ action: 'complete' }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(sqlText(1)).not.toContain('phase');
    expect(sqlText(1)).not.toContain('mode');
    expect(sqlText(1)).toContain(`'{"card_visibility":"visible","board_locked":true}'::jsonb`);
    expect(mocks.publish.mock.calls[0][1]).toMatchObject({ phase: null, refetch: true });
  });

  it('the open complete statement is pinned', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    await POST(postReq({ action: 'complete' }), ctx);
    expect((mocks.sql.mock.calls[1][0] as string[]).join('?')).toMatchInlineSnapshot(`
      "
            UPDATE boards SET archived_at = ?,
              settings = settings || '{"card_visibility":"visible","board_locked":true}'::jsonb
            WHERE id = ?
            RETURNING settings
          "
    `);
  });

  it('a row with no mode key (database without migration 015) is open', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    await POST(postReq({ action: 'complete' }), ctx);
    expect(sqlText(1)).not.toContain('phase');
  });
});

describe('reopen', () => {
  const authority = (over: Record<string, unknown> = {}) => ({ owner_id: 'owner', member_role: null, is_system_admin: false, board_mode: null, ...over });

  it('reopen returns a guided board to discuss with the discuss settings', async () => {
    const discuss = { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings(REOPEN_PHASE) };
    mocks.sql.mockResolvedValueOnce([authority({ board_mode: 'guided' })]).mockResolvedValueOnce([{ settings: discuss }]);
    const res = await POST(postReq({ action: 'reopen' }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(sqlText(1)).toContain('archived_at = NULL');
    expect(sqlText(1)).toContain('phase =');
    expect(sqlValues(1)).toContain(REOPEN_PHASE);
    expect(sqlValues(1)).toContain(JSON.stringify(phaseSettings(REOPEN_PHASE)));
    expect(mocks.publish).toHaveBeenCalledWith('board-reopened', { settings: discuss, phase: REOPEN_PHASE, refetch: true });
  });

  it('an open board keeps its exact statement and publishes phase null', async () => {
    mocks.sql.mockResolvedValueOnce([authority()]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    const res = await POST(postReq({ action: 'reopen' }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(sqlText(1)).not.toContain('phase');
    expect(sqlText(1)).not.toContain('mode');
    expect(sqlText(1)).toContain(`'{"board_locked":false}'::jsonb`);
    expect(mocks.publish).toHaveBeenCalledWith('board-reopened', { settings: DEFAULT_BOARD_SETTINGS, phase: null, refetch: true });
  });

  it('the open reopen statement is pinned', async () => {
    mocks.sql.mockResolvedValueOnce([authority()]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    await POST(postReq({ action: 'reopen' }), ctx);
    expect((mocks.sql.mock.calls[1][0] as string[]).join('?')).toMatchInlineSnapshot(`
      "
            UPDATE boards SET archived_at = NULL, settings = settings || '{"board_locked":false}'::jsonb
            WHERE id = ?
            RETURNING settings
          "
    `);
  });

  it('the guided reopen clears the phase deadline in the same statement; the open one never mentions phase_config', async () => {
    mocks.sql.mockResolvedValueOnce([authority({ board_mode: 'guided' })]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    await POST(postReq({ action: 'reopen' }), ctx);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(sqlText(1)).toContain(`phase_config = phase_config || '{"deadline":null}'::jsonb`);
    mocks.sql.mockClear();
    mocks.sql.mockResolvedValueOnce([authority()]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    await POST(postReq({ action: 'reopen' }), ctx);
    expect(sqlText(1)).not.toContain('phase_config');
  });

  it('a guided board that is not completed: the UPDATE returns no row, 409, nothing published', async () => {
    mocks.sql.mockResolvedValueOnce([authority({ board_mode: 'guided' })]).mockResolvedValueOnce([]);
    const res = await POST(postReq({ action: 'reopen' }), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Board is not completed' });
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('the guided reopen statement requires archived_at IS NOT NULL; the open one does not', async () => {
    mocks.sql.mockResolvedValueOnce([authority({ board_mode: 'guided' })]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    await POST(postReq({ action: 'reopen' }), ctx);
    expect(sqlText(1)).toContain('archived_at IS NOT NULL');
    mocks.sql.mockClear();
    mocks.sql.mockResolvedValueOnce([authority()]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
    await POST(postReq({ action: 'reopen' }), ctx);
    expect(sqlText(1)).not.toContain('archived_at IS NOT NULL');
    expect(sqlText(1)).toBe(
      ` UPDATE boards SET archived_at = NULL, settings = settings || '{"board_locked":false}'::jsonb WHERE id = ? RETURNING settings `
    );
  });

  it('a non-owner is still refused 403 before any UPDATE', async () => {
    mocks.fresh.mockResolvedValue({ user: { id: 'stranger' } });
    mocks.sql.mockResolvedValueOnce([authority({ board_mode: 'guided' })]);
    const res = await POST(postReq({ action: 'reopen' }), ctx);
    expect(res.status).toBe(403);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
});

describe('settings PATCH', () => {
  it('{ card_visibility } on a guided board is 409 and writes nothing', async () => {
    mocks.sql.mockResolvedValueOnce([guided('reflect')]);
    const res = await PATCH(patchReq({ settings: { card_visibility: 'visible' } }), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'This setting follows the phase on a guided board' });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('every phase-owned key is refused, and a mixed patch is refused whole', async () => {
    for (const patch of [
      { voting_enabled: true },
      { secret_voting: true },
      { card_creation_disabled: true },
      { board_locked: true },
      { timer: { duration: 60, remaining: 60, status: 'running', started_at: null }, card_visibility: 'visible' },
    ]) {
      mocks.sql.mockClear();
      mocks.sql.mockResolvedValueOnce([guided('vote')]);
      const res = await PATCH(patchReq({ settings: patch }), ctx);
      expect(res.status).toBe(409);
      expect(mocks.sql).toHaveBeenCalledTimes(1);
    }
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('{ timer } and { anonymous_cards } on a guided board still succeed', async () => {
    const timer = { duration: 60, remaining: 60, status: 'running', started_at: null };
    mocks.sql
      .mockResolvedValueOnce([guided('discuss')])
      .mockResolvedValueOnce([{ title: 'T', description: null, settings: { ...DEFAULT_BOARD_SETTINGS, timer } }]);
    expect((await PATCH(patchReq({ settings: { timer } }), ctx)).status).toBe(200);
    mocks.sql
      .mockResolvedValueOnce([guided('discuss')])
      .mockResolvedValueOnce([{ title: 'T', description: null, settings: { ...DEFAULT_BOARD_SETTINGS, anonymous_cards: true } }]);
    expect((await PATCH(patchReq({ settings: { anonymous_cards: true } }), ctx)).status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(4);
  });

  it('{ card_visibility } on an open board is unchanged (Review Focus 5)', async () => {
    mocks.sql
      .mockResolvedValueOnce([ctxRow()])
      .mockResolvedValueOnce([{ title: 'T', description: null, settings: { ...DEFAULT_BOARD_SETTINGS, card_visibility: 'visible' } }]);
    const res = await PATCH(patchReq({ settings: { card_visibility: 'visible' } }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
  });

  it('a title-only rename on a guided board is not affected', async () => {
    mocks.fresh.mockResolvedValue({ user: { id: 'owner' } });
    mocks.session.mockResolvedValue({ user: { id: 'owner' } });
    mocks.sql
      .mockResolvedValueOnce([guided('vote')])
      .mockResolvedValueOnce([{ title: 'New', description: null, settings: DEFAULT_BOARD_SETTINGS }]);
    expect((await PATCH(patchReq({ title: 'New' }), ctx)).status).toBe(200);
  });
});
