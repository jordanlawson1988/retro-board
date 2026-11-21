import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  tx: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  sql: (...a: unknown[]) => mocks.sql(...a),
  sqlTransaction: (...a: unknown[]) => mocks.tx(...a),
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
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import { phaseSettings } from '@/lib/phases';
import { voteLockKey } from '@/lib/votes';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const req = (body: unknown) =>
  new Request('http://x/api/boards/b1', { method: 'PATCH', body: JSON.stringify(body) });

function ctxRow(over: Record<string, unknown> = {}) {
  return {
    id: 'b1', title: 'T', trust_version: 2, settings: { ...DEFAULT_BOARD_SETTINGS }, archived_at: null, deleted_at: null,
    owner_id: 'owner', created_by: null,
    cp_id: 'p1', cp_is_admin: true, cp_display_name: 'Ann', claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, session_live: true, user_participant_id: null,
    ...over,
  };
}

const guided = (settings: Record<string, unknown> = {}, over: Record<string, unknown> = {}) =>
  ctxRow({
    mode: 'guided', phase: 'vote',
    settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings('vote'), max_votes_per_participant: 5, max_votes_per_card: 3, ...settings },
    ...over,
  });
const patch = (settings: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  boardPatch(req({ settings, ...extra }), ctx);
const txStatements = () => {
  const calls: { text: string; values: unknown[] }[] = [];
  mocks.tx.mock.calls[0][0]((s: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: s.join('?'), values });
    return {};
  });
  return calls;
};
const guardedResult = (row: Record<string, unknown>) => [[], [row]];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
  mocks.publish.mockResolvedValue(undefined);
});

describe('guided limit PATCH', () => {
  it('lowering votes per person below what someone spent is 409 and publishes nothing', async () => {
    mocks.sql.mockResolvedValueOnce([guided()]);
    mocks.tx.mockResolvedValueOnce(guardedResult({ title: null, description: null, settings: null, max_spent: 4, max_on_card: 2 }));
    const res = await patch({ max_votes_per_participant: 3 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Votes per person cannot go below what someone has already used.' });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
    const [lock, stmt] = txStatements();
    expect(lock.values).toEqual([voteLockKey('b1')]);
    expect(lock.values).toEqual(['b1:votes']);
    expect(lock.text).toContain('pg_advisory_xact_lock');
    expect(stmt.text).toContain('GROUP BY voter_id');
    expect(stmt.text).toContain('MAX(count)');
  });

  it('lowering votes per card below the highest count is 409', async () => {
    mocks.sql.mockResolvedValueOnce([guided()]);
    mocks.tx.mockResolvedValueOnce(guardedResult({ title: null, description: null, settings: null, max_spent: 2, max_on_card: 2 }));
    const res = await patch({ max_votes_per_card: 1 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Votes per card cannot go below what someone already has on one card.' });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('a refusal no limit explains is The board changed', async () => {
    mocks.sql.mockResolvedValueOnce([guided()]);
    mocks.tx.mockResolvedValueOnce(guardedResult({ title: null, description: null, settings: null, max_spent: 0, max_on_card: 0 }));
    const res = await patch({ max_votes_per_card: 2 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'The board changed. Try again.' });
  });

  it('raising both is saved and published like any settings change', async () => {
    const merged = { ...guided().settings, max_votes_per_participant: 8, max_votes_per_card: 4 };
    mocks.sql.mockResolvedValueOnce([guided()]);
    mocks.tx.mockResolvedValueOnce(guardedResult({ title: 'T', description: null, settings: merged, max_spent: 2, max_on_card: 1 }));
    const res = await patch({ max_votes_per_participant: 8, max_votes_per_card: 4 });
    expect(res.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith('board-updated', { settings: merged });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
    const stmt = txStatements()[1];
    expect(stmt.values).toContain(JSON.stringify({ max_votes_per_participant: 8, max_votes_per_card: 4 }));
  });

  it('a limit change together with a title keeps the title handling and publishes both', async () => {
    const merged = { ...guided().settings, max_votes_per_participant: 6 };
    mocks.session.mockResolvedValue({ user: { id: 'owner' } });
    mocks.sql.mockResolvedValueOnce([guided()]);
    mocks.tx.mockResolvedValueOnce(guardedResult({ title: 'New', description: null, settings: merged, max_spent: 0, max_on_card: 0 }));
    const res = await patch({ max_votes_per_participant: 6 }, { title: ' New ' });
    expect(res.status).toBe(200);
    const stmt = txStatements()[1];
    expect(stmt.text).toContain('CASE WHEN ?::boolean THEN ?::text ELSE title END');
    expect(stmt.text).toContain('CASE WHEN ?::boolean THEN ?::text ELSE description END');
    expect(stmt.values.slice(2, 6)).toEqual([true, 'New', false, null]);
    expect(mocks.publish).toHaveBeenCalledWith('board-updated', { title: 'New', settings: merged });
  });

  it('per card above per person is 400 after the context query only', async () => {
    mocks.sql.mockResolvedValueOnce([guided()]);
    const res = await patch({ max_votes_per_card: 6 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Votes per card cannot be more than votes per person');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).not.toHaveBeenCalled();
  });

  it('an open board refuses max_votes_per_card with 409 after the context query only', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    const res = await patch({ max_votes_per_card: 2 });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Votes per card is only available on guided boards');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).not.toHaveBeenCalled();
  });

  it('an open board lowering votes per person uses the plain statement, no lock, no transaction', async () => {
    mocks.sql
      .mockResolvedValueOnce([ctxRow()])
      .mockResolvedValueOnce([{ title: 'T', description: null, settings: DEFAULT_BOARD_SETTINGS }]);
    const res = await patch({ max_votes_per_participant: 2 });
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(mocks.tx).not.toHaveBeenCalled();
    expect((mocks.sql.mock.calls[1][0] as string[]).join('?')).not.toContain('max_spent');
  });

  it('a guided PATCH without a limit key uses the ordinary statement and takes no lock', async () => {
    mocks.sql
      .mockResolvedValueOnce([guided()])
      .mockResolvedValueOnce([{ title: 'T', description: null, settings: DEFAULT_BOARD_SETTINGS }]);
    const res = await patch({ anonymous_cards: true });
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(mocks.tx).not.toHaveBeenCalled();
    expect((mocks.sql.mock.calls[1][0] as string[]).join('?')).not.toContain('max_spent');
  });

  it('a limit key sent with other keys is still guarded', async () => {
    mocks.sql.mockResolvedValueOnce([guided()]);
    mocks.tx.mockResolvedValueOnce(guardedResult({ title: null, description: null, settings: null, max_spent: 4, max_on_card: 1 }));
    const res = await patch({ anonymous_cards: true, max_votes_per_participant: 3 });
    expect(res.status).toBe(409);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('a completed guided board answers 409 Board is completed from the guard, before any statement', async () => {
    mocks.sql.mockResolvedValueOnce([guided({}, { archived_at: '2026-01-01' })]);
    const res = await patch({ max_votes_per_participant: 8 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Board is completed' });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).not.toHaveBeenCalled();
  });

  it('a non-facilitator is refused after the context query only', async () => {
    mocks.sql.mockResolvedValueOnce([guided({}, { cp_is_admin: false })]);
    const res = await patch({ max_votes_per_participant: 8 });
    expect(res.status).toBe(403);
    expect(mocks.tx).not.toHaveBeenCalled();
  });
});
