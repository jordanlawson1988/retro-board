import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { description, assignee, dueDate } = await request.json();

  const [item] = await sql`
    INSERT INTO action_items (board_id, description, assignee, due_date)
    VALUES (${boardId}, ${description}, ${assignee ?? null}, ${dueDate ?? null})
    RETURNING *
  `;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-created', { item });

  return NextResponse.json({ item });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { itemId, updates } = await request.json();

  if (updates.description !== undefined) {
    await sql`UPDATE action_items SET description = ${updates.description} WHERE id = ${itemId} AND board_id = ${boardId}`;
  }
  if (updates.assignee !== undefined) {
    await sql`UPDATE action_items SET assignee = ${updates.assignee} WHERE id = ${itemId} AND board_id = ${boardId}`;
  }
  if (updates.due_date !== undefined) {
    await sql`UPDATE action_items SET due_date = ${updates.due_date} WHERE id = ${itemId} AND board_id = ${boardId}`;
  }
  if (updates.status !== undefined) {
    await sql`UPDATE action_items SET status = ${updates.status} WHERE id = ${itemId} AND board_id = ${boardId}`;
  }

  const [item] = await sql`SELECT * FROM action_items WHERE id = ${itemId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-updated', { item });

  return NextResponse.json({ item });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { itemId } = await request.json();

  await sql`DELETE FROM action_items WHERE id = ${itemId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-deleted', { itemId });

  return NextResponse.json({ ok: true });
}
