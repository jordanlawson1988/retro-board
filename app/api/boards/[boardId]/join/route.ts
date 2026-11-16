import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { loadBoardActor, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { setParticipantCookie, readParticipantId } from '@/lib/participant-session';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { readJsonObject } from '@/lib/request-body';
import { validateDisplayName, INVALID_BODY } from '@/lib/board-validation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const limited = await rateLimitOr429(request, 'board-join', 30, 60);
  if (limited) return limited;
  const { boardId } = await params;
  // `isAdmin` in the body is deliberately ignored: admin status is decided by the server.
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const name = validateDisplayName(body.displayName);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  const displayName = name.value;
  const claimedId = body.participantId;

  const loaded = await loadBoardActor(request, boardId, typeof claimedId === 'string' ? claimedId : null);
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

  // If authenticated, reuse any existing participant this user has on the board.
  // Prefer admin record when multiple exist (handles pre-resolver multi-device joins).
  if (userId) {
    const existing = await sql`
      SELECT * FROM participants
      WHERE board_id = ${boardId} AND user_id = ${userId}
      ORDER BY is_admin DESC, joined_at ASC
      LIMIT 1
    `;
    if (existing.length > 0) {
      const [reused] = await sql`
        UPDATE participants
        SET display_name = ${displayName}, last_seen = now()
        WHERE id = ${existing[0].id}
        RETURNING *
      `;
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

  // Owner/facilitator auto-promotion: only from the server-side ownership
  // standing of a signed-in user, never from the request body.
  let isAdmin = false;
  if (userId) {
    const ownershipCheck = await sql`
      SELECT 1 FROM boards WHERE id = ${boardId} AND owner_id = ${userId}
      UNION ALL
      SELECT 1 FROM board_members
      WHERE board_id = ${boardId} AND user_id = ${userId}
        AND role IN ('owner', 'facilitator')
      LIMIT 1
    `;
    if (ownershipCheck.length > 0) isAdmin = true;
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

  const [participant] = await sql`
    INSERT INTO participants (id, board_id, display_name, is_admin, user_id)
    VALUES (${newId}, ${boardId}, ${displayName}, ${isAdmin}, ${userId})
    RETURNING *
  `;

  if (userId) {
    await sql`
      INSERT INTO board_members (board_id, user_id, role)
      VALUES (${boardId}, ${userId}, ${isAdmin ? 'facilitator' : 'participant'})
      ON CONFLICT (board_id, user_id) DO NOTHING
    `;
  }

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-joined', { participant });

  return withCookie(NextResponse.json({ participant, reused: false }), participant.id);
}
