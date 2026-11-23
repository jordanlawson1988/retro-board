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
import { phaseSettings } from '@/lib/phases';

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
    expect('comments' in json).toBe(false);
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

describe('board GET comments', () => {
  const anon = {
    id: 'm1', board_id: 'b1', card_id: 'L', parent_id: null, author_participant_id: 'p2', author_name: 'Bo',
    is_anonymous: true, body: 'hi', created_at: 'x', edited_at: null, deleted_at: null,
  };

  it('a guided board in Discuss reads comments in the same snapshot and shapes them for the viewer', async () => {
    mocks.pid.mockReturnValue('p2');
    mocks.sql.mockResolvedValue([ctxRow({ mode: 'guided', phase: 'discuss', cp_id: 'p2', settings: phaseSettings('discuss') })]);
    mocks.tx.mockResolvedValue([[], [], [], [], [], [anon]]);
    const json = await (await call()).json();
    expect(json.comments).toEqual([expect.objectContaining({ id: 'm1', author_participant_id: null, author_name: null, is_mine: true })]);
    const texts: string[] = [];
    mocks.tx.mock.calls[0][0]((s: TemplateStringsArray) => { texts.push(s.join('?')); return {}; });
    expect(texts).toHaveLength(6);
    expect(texts[5]).toBe('SELECT * FROM comments WHERE board_id = ? ORDER BY created_at, id');
  });

  it('a facilitator and another participant never receive the author of an anonymous comment; only the author is_mine', async () => {
    mocks.tx.mockResolvedValue([[], [], [], [], [], [anon]]);
    mocks.sql.mockResolvedValue([ctxRow({ mode: 'guided', phase: 'discuss', cp_id: 'pf', cp_is_admin: true, settings: phaseSettings('discuss') })]);
    const asFacilitator = await (await call()).json();
    mocks.sql.mockResolvedValue([ctxRow({ mode: 'guided', phase: 'discuss', cp_id: 'p3', settings: phaseSettings('discuss') })]);
    const asOther = await (await call()).json();
    for (const json of [asFacilitator, asOther]) {
      expect(json.comments).toEqual([
        expect.objectContaining({ id: 'm1', author_participant_id: null, author_name: null, is_anonymous: true, is_mine: false }),
      ]);
      expect(JSON.stringify(json.comments)).not.toContain('p2');
      expect(JSON.stringify(json.comments)).not.toContain('Bo');
    }
  });

  it('a guided board in Done reads comments too', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ mode: 'guided', phase: 'done', archived_at: '2026-01-01', settings: phaseSettings('done') })]);
    mocks.tx.mockResolvedValue([[], [], [], [], [], [anon]]);
    const json = await (await call()).json();
    expect(json.comments).toHaveLength(1);
  });

  it('a guided board before Discuss runs five statements and answers comments: []', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ mode: 'guided', phase: 'vote', settings: phaseSettings('vote') })]);
    mocks.tx.mockResolvedValue([[], [], [], [], []]);
    const json = await (await call()).json();
    expect(json.comments).toEqual([]);
    const texts: string[] = [];
    mocks.tx.mock.calls[0][0]((s: TemplateStringsArray) => { texts.push(s.join('?')); return {}; });
    expect(texts).toHaveLength(5);
  });

  it('an open board GET has no comments key and runs five statements', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ mode: 'open', phase: null })]);
    mocks.tx.mockResolvedValue([[], [], [], [], []]);
    expect('comments' in (await (await call()).json())).toBe(false);
    const texts: string[] = [];
    mocks.tx.mock.calls[0][0]((s: TemplateStringsArray) => { texts.push(s.join('?')); return {}; });
    expect(texts).toHaveLength(5);
    expect(texts.join(' ')).not.toContain('comments');
  });
});
