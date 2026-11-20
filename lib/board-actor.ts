import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionOrNull, resolveBoardAuthority, type BoardAuthority } from '@/lib/auth-helpers';
import { readParticipantId } from '@/lib/participant-session';
import { buildActor } from '@/lib/board-write-rules';
import type { BoardActor, BoardState, GuardResult } from '@/lib/board-guards';
import type { BoardSettings } from '@/types';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import {
  DEFAULT_PHASE_CONFIG,
  GUIDED_MODE,
  OPEN_MODE,
  isBoardMode,
  isPhaseId,
  type BoardMode,
  type PhaseConfig,
  type PhaseId,
} from '@/lib/constants/phases';

export interface LoadedBoard {
  actor: BoardActor;
  state: BoardState;
  board: {
    id: string;
    trust_version: 1 | 2;
    settings: BoardSettings;
    archived_at: string | null;
    deleted_at: string | null;
    owner_id: string | null;
    created_by: string | null;
    mode: BoardMode;
    phase: PhaseId | null;
    phase_config: PhaseConfig;
  };
  /** The full boards row (`SELECT *` shape), for routes that return it as-is. */
  row: Record<string, unknown>;
  /** Signed-in user id, or null. */
  userId: string | null;
  /** The signed-in user's standing; null when anonymous. */
  authority: BoardAuthority | null;
  /** v2 only: the participant resolved from the signed cookie (row exists on this board). */
  participant: { id: string; is_admin: boolean; display_name: string } | null;
  /** The signed-in user's own participant on this board (admin first, then oldest), or null. */
  userParticipantId: string | null;
  /** The signed-in user has any board_members row on this board. */
  userIsMember: boolean;
  /** The signed-in user's board_members role on this board, or null. */
  memberRole?: string | null;
  /** v1 only: the claimed participant id exists on this board. Always false on v2. */
  claimedParticipantExists: boolean;
}

export interface LoadBoardActorOptions {
  /** Return a trashed board instead of null. Callers must apply their own visibility rule. */
  includeDeleted?: boolean;
  /** v1 only: a participant id the client claims, checked for existence in the same query. */
  claimedParticipantId?: string | null;
}

/**
 * Resolve who is acting on a board in ONE database round-trip (plus the cookie-cached
 * session read). The same query confirms the session row is still live, so a revoked session
 * is anonymous at once even though the cached cookie is still valid. Returns null when the
 * board does not exist, or is in Trash unless `includeDeleted`. On v2 the participant comes only from the signed cookie; on v1 the
 * cookie is ignored and the claimed id is never trusted on v2.
 */
export async function loadBoardActor(
  request: Request,
  boardId: string,
  legacyParticipantId?: string | null,
  options: LoadBoardActorOptions = {}
): Promise<LoadedBoard | null> {
  const session = await getSessionOrNull();
  // From the signed, cached session cookie: NOT proof the session still exists. The query below
  // checks the session row; until it says live, this id carries no authority (see `userId`).
  const cachedUserId: string | null = session?.user?.id ?? null;
  const sessionToken: string | null = session?.session?.token ?? null;
  // Read before the query whatever the trust version; ignored below unless the board is v2.
  const cookieId = readParticipantId(request, boardId);
  const claimedId = options.claimedParticipantId ?? null;
  const includeDeleted = options.includeDeleted === true;

  const [row] = await sql`
    SELECT b.*,
      cp.id AS cp_id, cp.is_admin AS cp_is_admin, cp.display_name AS cp_display_name,
      EXISTS (SELECT 1 FROM participants WHERE id = ${claimedId} AND board_id = b.id) AS claimed_exists,
      (SELECT role FROM board_members WHERE board_id = b.id AND user_id = ${cachedUserId}) AS member_role,
      EXISTS (SELECT 1 FROM board_members WHERE board_id = b.id AND user_id = ${cachedUserId}) AS is_member,
      EXISTS (SELECT 1 FROM admin_users WHERE id = ${cachedUserId}) AS is_system_admin,
      EXISTS (SELECT 1 FROM session WHERE token = ${sessionToken} AND "userId" = ${cachedUserId}
        AND "expiresAt" > now()) AS session_live,
      (SELECT id FROM participants WHERE board_id = b.id AND user_id = ${cachedUserId}
        ORDER BY is_admin DESC, joined_at ASC LIMIT 1) AS user_participant_id
    FROM boards b
    LEFT JOIN participants cp ON cp.id = ${cookieId} AND cp.board_id = b.id
    WHERE b.id = ${boardId} AND (${includeDeleted}::boolean OR b.deleted_at IS NULL)
  `;
  if (!row) return null;

  // The cookie cache can outlive a revoked or expired session by up to its maxAge. Without a live
  // session row the caller is anonymous: no user id, authority, membership or user participant.
  // The v2 participant cookie is independent of the account session and is left alone.
  const sessionLive = cachedUserId !== null && row.session_live === true;
  const userId: string | null = sessionLive ? cachedUserId : null;

  const tv = Number(row.trust_version);
  if (tv !== 1 && tv !== 2) throw new Error(`Invalid trust_version for board ${boardId}`);
  const trustVersion: 1 | 2 = tv;

  const authority = userId
    ? resolveBoardAuthority({
        userId,
        ownerId: (row.owner_id as string | null) ?? null,
        memberRole: (row.member_role as string | null) ?? null,
        isSystemAdmin: !!row.is_system_admin,
      })
    : null;

  const participant =
    trustVersion === 2 && row.cp_id
      ? {
          id: row.cp_id as string,
          is_admin: !!row.cp_is_admin,
          display_name: (row.cp_display_name as string) ?? '',
        }
      : null;

  const actor = buildActor({
    boardId,
    trustVersion,
    cookieParticipantId: trustVersion === 2 ? cookieId : null,
    cookieParticipant: participant ? { is_admin: participant.is_admin } : null,
    legacyParticipantId: legacyParticipantId ?? null,
    userId,
    hasAuthority: authority?.canFacilitate ?? false,
  });

  const { cp_id, cp_is_admin, cp_display_name, claimed_exists, member_role, is_member, is_system_admin, session_live, user_participant_id, ...boardRow } = row;
  void cp_id; void cp_is_admin; void cp_display_name; void member_role; void is_system_admin; void session_live;

  // Missing keys take the defaults so they never read as "open".
  const settings: BoardSettings = { ...DEFAULT_BOARD_SETTINGS, ...((row.settings as Partial<BoardSettings> | null) ?? {}) };
  const archivedAt = (row.archived_at as string | null) ?? null;

  // A row from before migration 015 has no mode key: it is an open board.
  const rawMode = row.mode === undefined ? OPEN_MODE : row.mode;
  if (!isBoardMode(rawMode)) throw new Error(`Invalid mode for board ${boardId}`);
  const mode: BoardMode = rawMode;
  let phase: PhaseId | null = null;
  if (mode === GUIDED_MODE) {
    if (!isPhaseId(row.phase)) throw new Error(`Invalid phase for board ${boardId}`);
    phase = row.phase;
  }
  const phaseConfig: PhaseConfig = {
    ...DEFAULT_PHASE_CONFIG,
    ...((row.phase_config as Partial<PhaseConfig> | null | undefined) ?? {}),
  };
  return {
    actor,
    state: { archived: !!archivedAt, settings, phase },
    board: {
      id: row.id as string,
      trust_version: trustVersion,
      settings,
      archived_at: archivedAt,
      deleted_at: (row.deleted_at as string | null) ?? null,
      owner_id: (row.owner_id as string | null) ?? null,
      created_by: (row.created_by as string | null) ?? null,
      mode,
      phase,
      phase_config: phaseConfig,
    },
    row: boardRow,
    userId,
    authority,
    participant,
    userParticipantId: sessionLive ? ((user_participant_id as string | null) ?? null) : null,
    userIsMember: sessionLive && !!is_member,
    memberRole: sessionLive ? ((row.member_role as string | null) ?? null) : null,
    claimedParticipantExists: trustVersion === 1 && !!claimed_exists,
  };
}

/** Convert a guard denial to a response; null when the action is allowed. */
export function guardResponse(result: GuardResult | null): NextResponse | null {
  if (!result || result.ok) return null;
  return NextResponse.json({ error: result.error }, { status: result.status });
}

export const BOARD_NOT_FOUND = () =>
  NextResponse.json({ error: 'Board not found' }, { status: 404 });

/** v2 writes that must be attributed need a participant, even for a signed-in facilitator. */
export function requireParticipantOn(loaded: LoadedBoard): NextResponse | null {
  if (loaded.actor.trustVersion === 2 && loaded.actor.participantId === null) {
    return NextResponse.json({ error: 'Join the board first' }, { status: 401 });
  }
  return null;
}
