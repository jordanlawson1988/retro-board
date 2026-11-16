import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionOrNull, loadBoardAuthorityFor } from '@/lib/auth-helpers';
import { readParticipantId } from '@/lib/participant-session';
import { buildActor } from '@/lib/board-write-rules';
import type { BoardActor, BoardState, GuardResult } from '@/lib/board-guards';
import type { BoardSettings } from '@/types';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';

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
  };
}

/**
 * Resolve who is acting on a board. Returns null when the board does not exist
 * or is in Trash. On v2 the participant comes only from the signed cookie.
 */
export async function loadBoardActor(
  request: Request,
  boardId: string,
  legacyParticipantId?: string | null
): Promise<LoadedBoard | null> {
  const [row] = await sql`
    SELECT id, trust_version, settings, archived_at, deleted_at, owner_id
    FROM boards WHERE id = ${boardId} AND deleted_at IS NULL
  `;
  if (!row) return null;

  const tv = Number(row.trust_version);
  if (tv !== 1 && tv !== 2) throw new Error(`Invalid trust_version for board ${boardId}`);
  const trustVersion: 1 | 2 = tv;

  const session = await getSessionOrNull();
  const userId = session?.user?.id ?? null;
  const hasAuthority = userId ? (await loadBoardAuthorityFor(boardId, userId)).canFacilitate : false;

  let cookieParticipantId: string | null = null;
  let cookieParticipant: { is_admin: boolean } | null = null;
  if (trustVersion === 2) {
    cookieParticipantId = readParticipantId(request, boardId);
    if (cookieParticipantId) {
      const [p] = await sql`
        SELECT is_admin FROM participants WHERE id = ${cookieParticipantId} AND board_id = ${boardId}
      `;
      cookieParticipant = p ? { is_admin: !!p.is_admin } : null;
    }
  }

  const actor = buildActor({
    boardId,
    trustVersion,
    cookieParticipantId,
    cookieParticipant,
    legacyParticipantId: legacyParticipantId ?? null,
    userId,
    hasAuthority,
  });

  // Missing keys take the defaults so they never read as "open".
  const settings: BoardSettings = { ...DEFAULT_BOARD_SETTINGS, ...((row.settings as Partial<BoardSettings> | null) ?? {}) };
  const archivedAt = (row.archived_at as string | null) ?? null;
  return {
    actor,
    state: { archived: !!archivedAt, settings },
    board: {
      id: row.id as string,
      trust_version: trustVersion,
      settings,
      archived_at: archivedAt,
      deleted_at: null,
      owner_id: (row.owner_id as string | null) ?? null,
    },
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
