import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  tx: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
  publish: vi.fn(),
  channel: vi.fn(),
  rate: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  sql: (...a: unknown[]) => mocks.sql(...a),
  sqlTransaction: (...a: unknown[]) => mocks.tx(...a),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/ably-server', () => ({
  ablyServer: {
    channels: {
      get: (name: string) => {
        mocks.channel(name);
        return { publish: (...a: unknown[]) => mocks.publish(...a) };
      },
    },
  },
}));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));
vi.mock('@/lib/rate-limit', () => ({ rateLimitOr429: (...a: unknown[]) => mocks.rate(...a) }));

import { POST } from '@/app/api/boards/[boardId]/phase/route';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import { phaseSettings } from '@/lib/phases';
import { voteLockKey } from '@/lib/votes';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const req = (body: unknown) =>
  new Request('http://x/api/boards/b1/phase', { method: 'POST', body: JSON.stringify(body) });
const rawReq = (raw: string) => new Request('http://x/api/boards/b1/phase', { method: 'POST', body: raw });

function ctxRow(over: Record<string, unknown> = {}) {
  return {
    id: 'b1', title: 'T', trust_version: 2, settings: { ...DEFAULT_BOARD_SETTINGS }, archived_at: null, deleted_at: null,
    owner_id: 'owner', created_by: null,
    cp_id: 'p1', cp_is_admin: true, cp_display_name: 'Ann', claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, session_live: true, user_participant_id: null,
    mode: 'guided', phase: 'reflect', phase_config: {},
    ...over,
  };
}
const guidedIn = (phase: string, over: Record<string, unknown> = {}) => ctxRow({ phase, ...over });

const updateRow = (phase: string, deadline: string | null = null) => ({
  phase,
  settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings(phase as 'group') },
  phase_config: { deadline },
});

const txCalls = () => {
  const calls: { text: string; values: unknown[] }[] = [];
  mocks.tx.mock.calls.at(-1)![0]((s: TemplateStringsArray, ...values: unknown[]) => { calls.push({ text: s.join('?'), values }); return {}; });
  return calls;
};

const FUTURE = new Date(Date.now() + 2 * 86_400_000).toISOString();
const PAST = '2020-01-01T00:00:00.000Z';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
  mocks.rate.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

describe('POST /phase move', () => {
  it('moves reflect to group in two round-trips and publishes phase-changed with refetch', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('reflect')]);
    mocks.tx.mockResolvedValueOnce([[], [updateRow('group')]]);
    const res = await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, phase: 'group', phaseConfig: { deadline: null } });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
    expect(mocks.channel).toHaveBeenCalledWith('retro-board:b1');
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledWith(
      'phase-changed',
      expect.objectContaining({ phase: 'group', refetch: true, phaseConfig: { deadline: null } }),
    );
  });

  it('the UPDATE merges phaseSettings and clears the deadline', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('reflect')]);
    mocks.tx.mockResolvedValueOnce([[], [updateRow('group')]]);
    await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctx);
    const [, update] = txCalls();
    const text = update.text;
    const values = update.values;
    expect(values).toContain('group');
    expect(values).toContain(JSON.stringify(phaseSettings('group')));
    expect(values).toContain('b1');
    expect(values).toContain('reflect');
    expect(text).toContain(`'{"deadline":null}'::jsonb`);
    expect(text).toContain("mode = 'guided'");
    expect(text).toContain('archived_at IS NULL AND deleted_at IS NULL');
  });

  it('takes the per-board vote lock first, in the same transaction, and the UPDATE text is unchanged', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('vote')]);
    mocks.tx.mockResolvedValueOnce([[], [updateRow('discuss')]]);
    await POST(req({ action: 'move', from: 'vote', to: 'next' }), ctx);
    const [lock, update] = txCalls();
    expect(lock.text).toBe('SELECT pg_advisory_xact_lock(hashtext(?))');
    expect(lock.values).toEqual([voteLockKey('b1')]);
    expect(update.text).toBe(`
      UPDATE boards SET phase = ?,
        settings = settings || ?::jsonb,
        phase_config = phase_config || '{"deadline":null}'::jsonb
      WHERE id = ? AND mode = 'guided' AND phase = ?
        AND archived_at IS NULL AND deleted_at IS NULL
      RETURNING phase, settings, phase_config
    `);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it('supports back and an explicit target', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('vote')]);
    mocks.tx.mockResolvedValueOnce([[], [updateRow('group')]]);
    expect((await POST(req({ action: 'move', from: 'vote', to: 'back' }), ctx)).status).toBe(200);
    expect(txCalls()[1].values).toContain('group');
    mocks.sql.mockClear();
    mocks.sql.mockResolvedValueOnce([guidedIn('reflect')]);
    mocks.tx.mockResolvedValueOnce([[], [updateRow('vote')]]);
    expect((await POST(req({ action: 'move', from: 'reflect', to: 'vote' }), ctx)).status).toBe(200);
    expect(txCalls()[1].values).toContain('vote');
  });

  it('409 when `from` is not the current phase, nothing written or published', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('group')]);
    const res = await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('The phase already changed');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('409 when the UPDATE matches no row (lost the race after the load)', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('reflect')]);
    mocks.tx.mockResolvedValueOnce([[], []]);
    const res = await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('The phase already changed');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('409 on an open board, and nothing is written', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ mode: 'open', phase: null })]);
    const res = await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('This board is not in guided mode');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('409 for set-deadline on an open board, and nothing is written', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ mode: 'open', phase: null })]);
    const res = await POST(req({ action: 'set-deadline', deadline: FUTURE }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('This board is not in guided mode');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('403 for a participant who is not a facilitator', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('reflect', { cp_is_admin: false })]);
    const res = await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctx);
    expect(res.status).toBe(403);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('401 with no participant cookie', async () => {
    mocks.pid.mockReturnValue(null);
    mocks.sql.mockResolvedValueOnce([guidedIn('reflect', { cp_id: null, cp_is_admin: false })]);
    const res = await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctx);
    expect(res.status).toBe(401);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('409 Board is completed on an archived board', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('discuss', { archived_at: '2026-01-01' })]);
    const res = await POST(req({ action: 'move', from: 'discuss', to: 'back' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Board is completed');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it('404 when the board does not exist', async () => {
    mocks.sql.mockResolvedValueOnce([]);
    const res = await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctx);
    expect(res.status).toBe(404);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('never moves to done', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('discuss')]);
    const res = await POST(req({ action: 'move', from: 'discuss', to: 'next' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Complete the retro to finish');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    mocks.sql.mockResolvedValueOnce([guidedIn('discuss')]);
    const res2 = await POST(req({ action: 'move', from: 'discuss', to: 'done' }), ctx);
    expect(res2.status).toBe(409);
    expect((await res2.json()).error).toBe('Complete the retro to finish');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('409 with the resolvePhaseMove error for a no-op move', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('reflect')]);
    const res = await POST(req({ action: 'move', from: 'reflect', to: 'back' }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Already at the first phase');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
});

describe('POST /phase set-deadline', () => {
  it('stores a future time in two round-trips and publishes without refetch', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('vote')]).mockResolvedValueOnce([updateRow('vote', FUTURE)]);
    const res = await POST(req({ action: 'set-deadline', deadline: FUTURE }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, phase: 'vote', phaseConfig: { deadline: FUTURE } });
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    const values = mocks.sql.mock.calls[1].slice(1);
    expect(values).toContain(JSON.stringify({ deadline: FUTURE }));
    const text = (mocks.sql.mock.calls[1][0] as string[]).join('?');
    expect(text).toContain("mode = 'guided'");
    expect(text).toContain('archived_at IS NULL AND deleted_at IS NULL');
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    const [event, payload] = mocks.publish.mock.calls[0];
    expect(event).toBe('phase-changed');
    expect(payload).toMatchObject({ phase: 'vote', phaseConfig: { deadline: FUTURE } });
    expect(payload).not.toHaveProperty('refetch');
  });

  it('null clears the deadline', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('vote', { phase_config: { deadline: FUTURE } })]).mockResolvedValueOnce([updateRow('vote', null)]);
    const res = await POST(req({ action: 'set-deadline', deadline: null }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.sql.mock.calls[1].slice(1)).toContain(JSON.stringify({ deadline: null }));
    expect(mocks.publish.mock.calls[0][1]).toMatchObject({ phaseConfig: { deadline: null } });
  });

  it('rejects a past deadline with 400 before any query', async () => {
    const res = await POST(req({ action: 'set-deadline', deadline: PAST }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Deadline must be in the future');
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('rejects a deadline beyond the maximum, and a non-date, with 400', async () => {
    const far = new Date(Date.now() + 90 * 86_400_000).toISOString();
    const res = await POST(req({ action: 'set-deadline', deadline: far }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Deadline must be within 30 days');
    const res2 = await POST(req({ action: 'set-deadline', deadline: 'soon' }), ctx);
    expect(res2.status).toBe(400);
    const res3 = await POST(req({ action: 'set-deadline' }), ctx);
    expect(res3.status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('uses the current time: a deadline valid now is rejected once the clock passes it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    const res = await POST(req({ action: 'set-deadline', deadline: '2029-12-31T00:00:00Z' }), ctx);
    expect(res.status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('409 when the UPDATE matches no row', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('vote')]).mockResolvedValueOnce([]);
    const res = await POST(req({ action: 'set-deadline', deadline: FUTURE }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('The phase already changed');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('403 for a non-facilitator', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('vote', { cp_is_admin: false })]);
    const res = await POST(req({ action: 'set-deadline', deadline: FUTURE }), ctx);
    expect(res.status).toBe(403);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it('merges a stored empty phase_config over the default in the response', async () => {
    mocks.sql.mockResolvedValueOnce([guidedIn('vote')]).mockResolvedValueOnce([{ ...updateRow('vote'), phase_config: {} }]);
    const res = await POST(req({ action: 'set-deadline', deadline: null }), ctx);
    expect((await res.json()).phaseConfig).toEqual({ deadline: null });
    expect(mocks.publish.mock.calls[0][1].phaseConfig).toEqual({ deadline: null });
  });
});

describe('POST /phase validation and limits', () => {
  it('400 Invalid request body for a non-object body, an unknown action or a missing action, with zero queries', async () => {
    for (const r of [rawReq('not json'), req([1]), req({ action: 'explode' }), req({}), req({ action: 7 })]) {
      const res = await POST(r, ctx);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid request body');
    }
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('400 Invalid phase for a missing or unknown `from`, or an unknown `to`, with zero queries', async () => {
    for (const body of [
      { action: 'move', to: 'next' },
      { action: 'move', from: 'nope', to: 'next' },
      { action: 'move', from: 'reflect' },
      { action: 'move', from: 'reflect', to: 'sideways' },
      { action: 'move', from: 'reflect', to: 3 },
    ]) {
      const res = await POST(req(body), ctx);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid phase');
    }
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('rate limits with name phase, 60 per 60 seconds, and returns the 429 untouched', async () => {
    mocks.rate.mockResolvedValueOnce(Response.json({ error: 'slow down' }, { status: 429 }));
    const res = await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctx);
    expect(res.status).toBe(429);
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.rate).toHaveBeenCalledWith(expect.any(Request), 'phase', 60, 60);
  });
});
