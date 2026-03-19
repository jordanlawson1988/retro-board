import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { id, columnId, text, authorName, authorId, position } = await request.json();

  const [card] = await sql`
    INSERT INTO cards (id, column_id, board_id, text, author_name, author_id, position)
    VALUES (${id}, ${columnId}, ${boardId}, ${text}, ${authorName}, ${authorId}, ${position})
    RETURNING *
  `;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('card-created', { card });

  return NextResponse.json({ card });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { cardId, updates } = await request.json();

  if (updates.text !== undefined) {
    await sql`UPDATE cards SET text = ${updates.text} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }
  if (updates.color !== undefined) {
    await sql`UPDATE cards SET color = ${updates.color} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }
  if (updates.column_id !== undefined) {
    await sql`UPDATE cards SET column_id = ${updates.column_id} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }
  if (updates.position !== undefined) {
    await sql`UPDATE cards SET position = ${updates.position} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }
  if (updates.merged_with !== undefined) {
    await sql`UPDATE cards SET merged_with = ${updates.merged_with} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }

  const [card] = await sql`SELECT * FROM cards WHERE id = ${cardId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('card-updated', { card });

  return NextResponse.json({ card });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { cardId } = await request.json();

  await sql`DELETE FROM cards WHERE id = ${cardId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('card-deleted', { cardId });

  return NextResponse.json({ ok: true });
}
