import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { loadBoardActor, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { setParticipantCookie } from '@/lib/participant-session';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  // `isAdmin` in the body is deliberately ignored: admin status is decided by the server.
  const { participantId, displayName } = await request.json();

  const loaded = await loadBoardActor(request, boardId, participantId);
  if (!loaded) return BOARD_NOT_FOUND();
  const isV2 = loaded.board.trust_version === 2;
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
      const res = NextResponse.json({ participant: reused, reused: true });
      setParticipantCookie(res, boardId, reused.id);
      return res;
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
      const res = NextResponse.json({ participant: reused, reused: true });
      setParticipantCookie(res, boardId, reused.id);
      return res;
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

  // v2 ids are generated here; the client's suggestion is ignored.
  const newId: string = isV2 ? nanoid() : participantId;

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

  const res = NextResponse.json({ participant, reused: false });
  setParticipantCookie(res, boardId, participant.id);
  return res;
}
