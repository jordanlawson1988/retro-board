import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { id, title, description, color, position } = await request.json();

  const [column] = await sql`
    INSERT INTO columns (id, board_id, title, description, color, position)
    VALUES (${id}, ${boardId}, ${title}, ${description ?? null}, ${color}, ${position})
    RETURNING *
  `;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('column-created', { column });

  return NextResponse.json({ column });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { columnId, updates } = await request.json();

  if (updates.title !== undefined) {
    await sql`UPDATE columns SET title = ${updates.title} WHERE id = ${columnId} AND board_id = ${boardId}`;
  }
  if (updates.color !== undefined) {
    await sql`UPDATE columns SET color = ${updates.color} WHERE id = ${columnId} AND board_id = ${boardId}`;
  }
  if (updates.description !== undefined) {
    await sql`UPDATE columns SET description = ${updates.description} WHERE id = ${columnId} AND board_id = ${boardId}`;
  }

  const [column] = await sql`SELECT * FROM columns WHERE id = ${columnId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('column-updated', { column });

  return NextResponse.json({ column });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { columnId } = await request.json();

  await sql`DELETE FROM columns WHERE id = ${columnId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('column-deleted', { columnId });

  return NextResponse.json({ ok: true });
}
