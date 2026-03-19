import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { participantId, displayName, isAdmin } = await request.json();

  // Insert participant
  const [participant] = await sql`
    INSERT INTO participants (id, board_id, display_name, is_admin)
    VALUES (${participantId}, ${boardId}, ${displayName}, ${isAdmin ?? false})
    RETURNING *
  `;

  // If this participant is admin, update board created_by
  if (isAdmin) {
    await sql`UPDATE boards SET created_by = ${participantId} WHERE id = ${boardId}`;
  }

  // Publish to Ably
  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-joined', { participant });

  return NextResponse.json({ participant });
}
