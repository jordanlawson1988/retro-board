import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { getSessionOrNull } from '@/lib/auth-helpers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { participantId, displayName, isAdmin: clientIsAdmin } = await request.json();

  const session = await getSessionOrNull();
  const userId = session?.user?.id ?? null;

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
      return NextResponse.json({ participant: reused, reused: true });
    }
  }

  // Owner/facilitator auto-promotion: if this authenticated user already has
  // owner/facilitator standing on the board, they join as an admin regardless
  // of the client's hint.
  let isAdmin = clientIsAdmin ?? false;
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

  // Insert new participant
  const [participant] = await sql`
    INSERT INTO participants (id, board_id, display_name, is_admin, user_id)
    VALUES (${participantId}, ${boardId}, ${displayName}, ${isAdmin}, ${userId})
    RETURNING *
  `;

  if (isAdmin) {
    await sql`UPDATE boards SET created_by = ${participantId} WHERE id = ${boardId}`;
  }

  if (userId) {
    await sql`
      INSERT INTO board_members (board_id, user_id, role)
      VALUES (${boardId}, ${userId}, ${isAdmin ? 'facilitator' : 'participant'})
      ON CONFLICT (board_id, user_id) DO NOTHING
    `;
  }

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-joined', { participant });

  return NextResponse.json({ participant, reused: false });
}
