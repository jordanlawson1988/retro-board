import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { getSessionOrNull } from '@/lib/auth-helpers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { participantId, displayName, isAdmin } = await request.json();

  const session = await getSessionOrNull();
  const userId = session?.user?.id ?? null;

  // Insert participant
  const [participant] = await sql`
    INSERT INTO participants (id, board_id, display_name, is_admin, user_id)
    VALUES (${participantId}, ${boardId}, ${displayName}, ${isAdmin ?? false}, ${userId})
    RETURNING *
  `;

  // If this participant is admin, update board created_by
  if (isAdmin) {
    await sql`UPDATE boards SET created_by = ${participantId} WHERE id = ${boardId}`;
  }

  // If authenticated, add to board_members
  if (userId) {
    await sql`
      INSERT INTO board_members (board_id, user_id, role)
      VALUES (${boardId}, ${userId}, 'participant')
      ON CONFLICT (board_id, user_id) DO NOTHING
    `;
  }

  // Publish to Ably
  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-joined', { participant });

  return NextResponse.json({ participant });
}
