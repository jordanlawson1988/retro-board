import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { participantId, updates } = await request.json();

  if (updates.is_admin !== undefined) {
    await sql`UPDATE participants SET is_admin = ${updates.is_admin} WHERE id = ${participantId} AND board_id = ${boardId}`;
  }

  const [participant] = await sql`SELECT * FROM participants WHERE id = ${participantId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-updated', { participant });

  return NextResponse.json({ participant });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { participantId } = await request.json();

  await sql`DELETE FROM participants WHERE id = ${participantId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-removed', { participantId });

  return NextResponse.json({ ok: true });
}
