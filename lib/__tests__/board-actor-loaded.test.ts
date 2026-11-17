import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  session: vi.fn(),
  pid: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => mocks.sql(...a) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/auth-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers');
  return { ...actual, getSessionOrNull: () => mocks.session() };
});
vi.mock('@/lib/participant-session', () => ({ readParticipantId: () => mocks.pid() }));

import { loadBoardActor } from '@/lib/board-actor';
import { boardAccessFrom } from '@/lib/board-access-loader';
import { decideBoardAccess, type BoardAccessInput } from '@/lib/board-access';

const req = new Request('http://x/api');

function ctxRow(over: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    trust_version: 2,
    settings: {},
    archived_at: null,
    deleted_at: null,
    owner_id: 'owner',
    created_by: null,
    cp_id: null,
    cp_is_admin: null,
    cp_display_name: null,
    claimed_exists: false,
    member_role: null,
    is_member: false,
    is_system_admin: false,
    session_live: true,
    user_participant_id: null,
    ...over,
  };
}

beforeEach(() => {
  mocks.sql.mockReset();
  mocks.session.mockReset();
  mocks.pid.mockReset();
  mocks.session.mockResolvedValue(null);
  mocks.pid.mockReturnValue(null);
});

describe('loadBoardActor single query', () => {
  it('uses exactly one sql call for a signed-in v2 viewer with a cookie participant', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'u1' } });
    mocks.pid.mockReturnValue('p1');
    mocks.sql.mockResolvedValue([
      ctxRow({ cp_id: 'p1', cp_is_admin: false, cp_display_name: 'Ann', is_member: true, member_role: 'participant', user_participant_id: 'p1' }),
    ]);
    const l = await loadBoardActor(req, 'b1');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(l?.actor).toMatchObject({ participantId: 'p1', userId: 'u1', isFacilitator: false, trustVersion: 2 });
    expect(l?.participant).toEqual({ id: 'p1', is_admin: false, display_name: 'Ann' });
    expect(l?.userId).toBe('u1');
    expect(l?.userParticipantId).toBe('p1');
    expect(l?.userIsMember).toBe(true);
    expect(l?.authority).toEqual({ isOwner: false, canFacilitate: false, isSystemAdmin: false });
    expect(l?.row.id).toBe('b1');
  });

  it('anonymous: authority null, no user fields', async () => {
    mocks.sql.mockResolvedValue([ctxRow()]);
    const l = await loadBoardActor(req, 'b1');
    expect(l?.authority).toBeNull();
    expect(l?.userId).toBeNull();
    expect(l?.participant).toBeNull();
    expect(l?.userParticipantId).toBeNull();
    expect(l?.userIsMember).toBe(false);
  });

  it('owner / facilitator member / system admin get authority', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'owner' } });
    mocks.sql.mockResolvedValue([ctxRow()]);
    expect((await loadBoardActor(req, 'b1'))?.authority).toEqual({ isOwner: true, canFacilitate: true, isSystemAdmin: false });
    mocks.session.mockResolvedValue({ user: { id: 'u2' } });
    mocks.sql.mockResolvedValue([ctxRow({ member_role: 'facilitator', is_member: true })]);
    expect((await loadBoardActor(req, 'b1'))?.actor.isFacilitator).toBe(true);
    mocks.sql.mockResolvedValue([ctxRow({ is_system_admin: true })]);
    expect((await loadBoardActor(req, 'b1'))?.authority?.isSystemAdmin).toBe(true);
  });

  it('v2 cookie participant that is_admin makes the actor a facilitator', async () => {
    mocks.pid.mockReturnValue('p1');
    mocks.sql.mockResolvedValue([ctxRow({ cp_id: 'p1', cp_is_admin: true, cp_display_name: 'F' })]);
    const l = await loadBoardActor(req, 'b1');
    expect(l?.actor.isFacilitator).toBe(true);
    expect(l?.actor.participantId).toBe('p1');
  });

  it('v1 ignores the cookie participant and keeps the claimed id', async () => {
    mocks.pid.mockReturnValue('p1');
    mocks.sql.mockResolvedValue([
      ctxRow({ trust_version: 1, cp_id: 'p1', cp_is_admin: true, cp_display_name: 'X', claimed_exists: true }),
    ]);
    const l = await loadBoardActor(req, 'b1', 'claimed', { claimedParticipantId: 'claimed' });
    expect(l?.actor).toMatchObject({ participantId: 'claimed', isFacilitator: false });
    expect(l?.participant).toBeNull();
    expect(l?.claimedParticipantExists).toBe(true);
  });

  it('v2 never trusts a claimed id', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ claimed_exists: true })]);
    const l = await loadBoardActor(req, 'b1', 'claimed', { claimedParticipantId: 'claimed' });
    expect(l?.actor.participantId).toBeNull();
    expect(l?.claimedParticipantExists).toBe(false);
  });

  it('v2 cookie pointing at a missing participant row yields no participant', async () => {
    mocks.pid.mockReturnValue('ghost');
    mocks.sql.mockResolvedValue([ctxRow()]);
    const l = await loadBoardActor(req, 'b1');
    expect(l?.actor.participantId).toBeNull();
    expect(l?.participant).toBeNull();
  });

  it('a missing board returns null', async () => {
    mocks.sql.mockResolvedValue([]);
    expect(await loadBoardActor(req, 'nope')).toBeNull();
  });

  it('includeDeleted returns a trashed row; the default query excludes it', async () => {
    mocks.sql.mockResolvedValue([ctxRow({ deleted_at: '2026-01-01' })]);
    const l = await loadBoardActor(req, 'b1', null, { includeDeleted: true });
    expect(l?.row.deleted_at).toBe('2026-01-01');
    await loadBoardActor(req, 'b1');
    // Both calls pass the flag as a bound parameter; the filter is part of one fixed query.
    expect(mocks.sql.mock.calls[0].slice(1)).toContain(true);
    expect(mocks.sql.mock.calls[1].slice(1)).toContain(false);
  });
});

describe('loadBoardActor revoked sessions (cookie cache must not outlive the session row)', () => {
  const fullRow = () =>
    ctxRow({
      owner_id: 'u1', cp_id: 'p1', cp_is_admin: true, cp_display_name: 'Ann',
      member_role: 'owner', is_member: true, is_system_admin: true, user_participant_id: 'pu',
    });

  it('live session keeps authority, member and participant data; token and user id are bound parameters', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'u1' }, session: { token: 'tok' } });
    mocks.sql.mockResolvedValue([fullRow()]);
    const l = await loadBoardActor(req, 'b1');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(l?.userId).toBe('u1');
    expect(l?.authority).toEqual({ isOwner: true, canFacilitate: true, isSystemAdmin: true });
    expect(l?.userParticipantId).toBe('pu');
    expect(l?.userIsMember).toBe(true);
    const text = (mocks.sql.mock.calls[0][0] as string[]).join('?');
    expect(text).toMatch(/FROM session\s+WHERE token = \?/);
    expect(text).toContain('"userId"');
    expect(text).toContain('"expiresAt" > now()');
    expect(mocks.sql.mock.calls[0].slice(1)).toContain('tok');
  });

  it('session row missing or expired: treated exactly as anonymous, still one query', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'u1' }, session: { token: 'tok' } });
    mocks.pid.mockReturnValue('p1');
    mocks.sql.mockResolvedValue([{ ...fullRow(), session_live: false }]);
    const l = await loadBoardActor(req, 'b1');
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(l?.userId).toBeNull();
    expect(l?.authority).toBeNull();
    expect(l?.memberRole).toBeNull();
    expect(l?.userParticipantId).toBeNull();
    expect(l?.userIsMember).toBe(false);
    expect(l?.actor).toMatchObject({ userId: null, isFacilitator: true /* cookie participant is_admin, unaffected */ });
  });

  it('revoked session does not strip the v2 signed participant cookie', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'u1' }, session: { token: 'tok' } });
    mocks.pid.mockReturnValue('p1');
    mocks.sql.mockResolvedValue([{ ...ctxRow({ cp_id: 'p1', cp_is_admin: false, cp_display_name: 'Ann' }), session_live: false }]);
    const l = await loadBoardActor(req, 'b1');
    expect(l?.participant).toEqual({ id: 'p1', is_admin: false, display_name: 'Ann' });
    expect(l?.actor).toMatchObject({ participantId: 'p1', userId: null, isFacilitator: false });
  });

  it('signed-in user whose cached session carries no token fails closed (null token parameter)', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'u1' } });
    mocks.sql.mockResolvedValue([{ ...fullRow(), session_live: false }]);
    const l = await loadBoardActor(req, 'b1');
    expect(l?.userId).toBeNull();
    expect(mocks.sql.mock.calls[0].slice(1)).toContain(null);
  });

  it('anonymous caller: null token and user parameters, no error, session check ignored', async () => {
    mocks.sql.mockResolvedValue([{ ...ctxRow(), session_live: false }]);
    const l = await loadBoardActor(req, 'b1');
    expect(l?.userId).toBeNull();
    expect(l?.authority).toBeNull();
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
});

describe('boardAccessFrom mirrors decideBoardAccess for every truth-table row', () => {
  const none: BoardAccessInput = {
    archived: false,
    hasParticipantRow: false,
    userMatchedParticipant: false,
    userIsOwner: false,
    userIsMember: false,
    userIsSystemAdmin: false,
  };
  async function loadedFor(i: BoardAccessInput, tv: 1 | 2) {
    mocks.session.mockResolvedValue({ user: { id: 'u1' } });
    mocks.pid.mockReturnValue(tv === 2 && i.hasParticipantRow ? 'p1' : null);
    mocks.sql.mockResolvedValue([
      ctxRow({
        trust_version: tv,
        archived_at: i.archived ? '2026-01-01' : null,
        owner_id: i.userIsOwner ? 'u1' : 'other',
        cp_id: tv === 2 && i.hasParticipantRow ? 'p1' : null,
        cp_is_admin: tv === 2 && i.hasParticipantRow ? false : null,
        cp_display_name: tv === 2 && i.hasParticipantRow ? 'n' : null,
        claimed_exists: tv === 1 && i.hasParticipantRow,
        is_member: i.userIsMember,
        member_role: i.userIsMember ? 'participant' : null,
        is_system_admin: i.userIsSystemAdmin,
        session_live: true,
        user_participant_id: i.userMatchedParticipant ? 'pu' : null,
      }),
    ]);
    return loadBoardActor(req, 'b1', null, { claimedParticipantId: 'c' });
  }
  const keys = ['hasParticipantRow', 'userMatchedParticipant', 'userIsOwner', 'userIsMember', 'userIsSystemAdmin'] as const;
  const cases: BoardAccessInput[] = [];
  for (const archived of [false, true]) {
    cases.push({ ...none, archived });
    for (const k of keys) cases.push({ ...none, archived, [k]: true });
  }
  it.each(cases.map((c, i) => [i, c] as const))('case %i (v1 and v2)', async (_i, c) => {
    for (const tv of [1, 2] as const) {
      const l = await loadedFor(c, tv);
      expect(boardAccessFrom(l!)).toEqual(decideBoardAccess(c));
    }
  });

  it('a v2 claimed id never counts, a v1 cookie never counts', async () => {
    mocks.pid.mockReturnValue('p1');
    mocks.sql.mockResolvedValue([ctxRow({ trust_version: 1, archived_at: 'x', cp_id: 'p1', cp_is_admin: false, cp_display_name: 'n' })]);
    expect(boardAccessFrom((await loadBoardActor(req, 'b1'))!).access).toBe('completed-closed');
    mocks.sql.mockResolvedValue([ctxRow({ archived_at: 'x', claimed_exists: true })]);
    expect(boardAccessFrom((await loadBoardActor(req, 'b1', null, { claimedParticipantId: 'c' }))!).access).toBe('completed-closed');
  });
});
