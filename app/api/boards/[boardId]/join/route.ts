import { sql, sqlTransaction } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { loadBoardActor, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { setParticipantCookie, readParticipantId } from '@/lib/participant-session';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { readJsonObject } from '@/lib/request-body';
import { validateDisplayName, INVALID_BODY } from '@/lib/board-validation';
import { boardAccessFrom } from '@/lib/board-access-loader';
import { BOARD_COMPLETED_ERROR } from '@/lib/constants/board-access';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const limited = await rateLimitOr429(request, 'board-join', 120, 60);
  if (limited) return limited;
  const { boardId } = await params;
  // `isAdmin` in the body is deliberately ignored: admin status is decided by the server.
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const name = validateDisplayName(body.displayName);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  const displayName = name.value;
  const claimedId = body.participantId;

  const loaded = await loadBoardActor(request, boardId, typeof claimedId === 'string' ? claimedId : null, {
    claimedParticipantId: typeof claimedId === 'string' && claimedId.length > 0 ? claimedId : null,
  });
  if (!loaded) return BOARD_NOT_FOUND();
  const isV2 = loaded.board.trust_version === 2;
  // v1 still takes the participant id from the client; v2 generates it below.
  if (!isV2 && (typeof claimedId !== 'string' || claimedId.length === 0)) {
    return NextResponse.json({ error: 'Invalid participantId' }, { status: 400 });
  }
  const participantId = claimedId as string;
  // The cookie only exists on v2 boards; v1 never touches participant-session.
  const withCookie = (res: NextResponse, id: string) => {
    if (isV2) setParticipantCookie(res, boardId, id);
    return res;
  };
  const userId = loaded.actor.userId;

  // A completed board takes no new participants. Existing ones (cookie row, a claimed v1 id
  // that exists, or a signed-in user matched to a row) may still re-establish their session.
  if (loaded.board.archived_at) {
    const decision = boardAccessFrom(loaded);
    if (!decision.canJoin) {
      return NextResponse.json({ error: BOARD_COMPLETED_ERROR }, { status: 409 });
    }
  }

  // A signed-in user reuses the participant they already have on this board (admin first,
  // then oldest), resolved by loadBoardActor in its single query. One UPDATE, no re-query.
  if (userId && loaded.userParticipantId) {
    const [reused] = await sql`
      UPDATE participants
      SET display_name = ${displayName}, last_seen = now()
      WHERE id = ${loaded.userParticipantId} AND board_id = ${boardId}
      RETURNING *
    `;
    if (reused) {
      return withCookie(NextResponse.json({ participant: reused, reused: true }), reused.id);
    }
  }

  // v2: a valid cookie that resolves to a participant on this board is reused.
  if (isV2 && loaded.actor.participantId) {
    const [reused] = await sql`
      UPDATE participants
      SET display_name = ${displayName}, last_seen = now()
      WHERE id = ${loaded.actor.participantId} AND board_id = ${boardId}
      RETURNING *
    `;
    if (reused) {
      return withCookie(NextResponse.json({ participant: reused, reused: true }), reused.id);
    }
  }

  // Completed v1 board: re-establishing with an id that already exists is a reuse, not an insert.
  if (!isV2 && loaded.board.archived_at) {
    const [reused] = await sql`
      UPDATE participants SET display_name = ${displayName}, last_seen = now()
      WHERE id = ${participantId} AND board_id = ${boardId} RETURNING *
    `;
    if (reused) return NextResponse.json({ participant: reused, reused: true });
  }

  // Owner/facilitator auto-promotion: only from the server-side standing of a signed-in
  // user (computed by loadBoardActor), never from the request body. A system admin who is
  // neither owner nor owner/facilitator member is not promoted.
  let isAdmin = false;
  if (userId) {
    isAdmin =
      loaded.authority?.isOwner === true ||
      loaded.memberRole === 'owner' ||
      loaded.memberRole === 'facilitator';
  }

  // v2 creator claim: board creation issues a signed cookie for boards.created_by.
  // If that cookie is presented and no participant row exists for it yet (the
  // loader found none, or we would have returned above), this caller is the
  // creator and becomes the facilitator under that id.
  const cookieId = isV2 ? readParticipantId(request, boardId) : null;
  const isCreatorClaim =
    isV2 && cookieId !== null && cookieId === loaded.board.created_by && !loaded.actor.participantId;
  if (isCreatorClaim) isAdmin = true;

  // v2 ids are generated here; the client's suggestion is ignored.
  const newId: string = isCreatorClaim ? (cookieId as string) : isV2 ? nanoid() : participantId;

  let participant: Record<string, unknown> & { id: string };
  if (userId) {
    // Participant and membership are one atomic transaction. The upsert targets the partial
    // unique index uq_participants_board_user (013), so two simultaneous joins by the same
    // account produce one participant; the loser gets the winner's row back.
    const [upserted] = (await sqlTransaction((txn) => [
      txn`
        INSERT INTO participants (id, board_id, display_name, is_admin, user_id)
        VALUES (${newId}, ${boardId}, ${displayName}, ${isAdmin}, ${userId})
        ON CONFLICT (board_id, user_id) WHERE user_id IS NOT NULL
        DO UPDATE SET display_name = EXCLUDED.display_name, last_seen = now()
        RETURNING *
      `,
      txn`
        INSERT INTO board_members (board_id, user_id, role)
        VALUES (${boardId}, ${userId}, ${isAdmin ? 'facilitator' : 'participant'})
        ON CONFLICT (board_id, user_id) DO NOTHING
      `,
    ])) as unknown as Record<string, unknown>[][];
    participant = upserted[0] as typeof participant;
    if (participant.id !== newId) {
      return withCookie(NextResponse.json({ participant, reused: true }), participant.id);
    }
  } else {
    [participant] = (await sql`
      INSERT INTO participants (id, board_id, display_name, is_admin, user_id)
      VALUES (${newId}, ${boardId}, ${displayName}, ${isAdmin}, ${null})
      RETURNING *
    `) as unknown as (typeof participant)[];
  }

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-joined', { participant });

  return withCookie(NextResponse.json({ participant, reused: false }), participant.id);
}
