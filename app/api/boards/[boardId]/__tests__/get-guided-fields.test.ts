import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ sql: vi.fn(), tx: vi.fn(), session: vi.fn(), pid: vi.fn() }));

vi.mock('@/lib/db', () => ({
  sql: (...a: unknown[]) => mocks.sql(...a),
  sqlTransaction: (...a: unknown[]) => mocks.tx(...a),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/ably-server', () => ({ ablyServer: {} }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { GET } from '@/app/api/boards/[boardId]/route';
import { NextRequest } from 'next/server';

const ctx = { params: Promise.resolve({ boardId: 'b1' }) };
const call = () => GET(new NextRequest('http://x/api/boards/b1'), ctx);

function ctxRow(over: Record<string, unknown> = {}) {
  return {
    id: 'b1', title: 'T', trust_version: 2, settings: {}, archived_at: null, deleted_at: null,
    owner_id: 'owner', created_by: null,
    cp_id: 'p1', cp_is_admin: false, cp_display_name: 'Ann', claimed_exists: false,
    member_role: null, is_member: false, is_system_admin: false, session_live: true, user_participant_id: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue('p1');
  mocks.tx.mockResolvedValue([[], [], [], [], []]);
});

describe('board GET mode and phase', () => {
  it('a guided board in group returns its mode, phase and phase_config', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ mode: 'guided', phase: 'group', phase_config: { deadline: '2026-12-01T00:00:00.000Z' } })]);
    const json = await (await call()).json();
    expect(json.board).toMatchObject({ mode: 'guided', phase: 'group', phase_config: { deadline: '2026-12-01T00:00:00.000Z' } });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
  });

  it('an open board returns mode open and phase null', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ mode: 'open', phase: null, phase_config: {} })]);
    const json = await (await call()).json();
    expect(json.board).toMatchObject({ mode: 'open', phase: null, phase_config: { deadline: null } });
  });

  it('a row with no mode key returns the open defaults', async () => {
    mocks.sql.mockResolvedValue([ctxRow()]);
    const json = await (await call()).json();
    expect(json.board.mode).toBe('open');
    expect(json.board.phase).toBeNull();
    expect(json.board.phase_config).toEqual({ deadline: null });
  });

  it('the minimal no-access payload keeps its exact four board keys, even for a guided board', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ archived_at: '2026-01-01', cp_id: null, mode: 'guided', phase: 'done', phase_config: { deadline: null } })]);
    const json = await (await call()).json();
    expect(json.access).toBe('completed-closed');
    expect(Object.keys(json.board).sort()).toEqual(['archived_at', 'id', 'title', 'trust_version']);
    expect(mocks.tx).not.toHaveBeenCalled();
    expect('voteTally' in json).toBe(false);
  });
});

describe('board GET vote tally', () => {
  it('a guided board GET carries the team tally summed from every vote, even while votes are secret', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ mode: 'guided', phase: 'vote', settings: { secret_voting: true, voting_enabled: true } })]);
    mocks.tx.mockResolvedValue([[], [], [
      { id: 'v1', card_id: 'c1', board_id: 'b1', voter_id: 'p1', count: 2, created_at: 'x' },
      { id: 'v2', card_id: 'c1', board_id: 'b1', voter_id: 'p2', count: 3, created_at: 'x' },
    ], [], []]);
    const json = await (await call()).json();
    expect(json.voteTally).toEqual({ used: 5, at: 0 });
    expect(json.votes).toEqual([expect.objectContaining({ voter_id: 'p1', count: 2 })]);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
  });

  it('an open board GET has no voteTally', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ mode: 'open', phase: null })]);
    expect('voteTally' in (await (await call()).json())).toBe(false);
  });
});
