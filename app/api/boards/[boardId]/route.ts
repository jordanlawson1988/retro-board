import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const [board] = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const [columns, cards, votes, actionItems, participants] = await Promise.all([
    sql`SELECT * FROM columns WHERE board_id = ${boardId} ORDER BY position`,
    sql`SELECT * FROM cards WHERE board_id = ${boardId} ORDER BY position`,
    sql`SELECT * FROM votes WHERE board_id = ${boardId}`,
    sql`SELECT * FROM action_items WHERE board_id = ${boardId} ORDER BY created_at`,
    sql`SELECT * FROM participants WHERE board_id = ${boardId}`,
  ]);

  return NextResponse.json({ board, columns, cards, votes, actionItems, participants });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { settings } = await request.json();

  await sql`UPDATE boards SET settings = ${JSON.stringify(settings)} WHERE id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('board-updated', { settings });

  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { action } = await request.json();

  if (action === 'complete') {
    const archivedAt = new Date().toISOString();

    // Get current settings, then update them
    const [board] = await sql`SELECT settings FROM boards WHERE id = ${boardId}`;
    const settings = {
      ...board.settings,
      card_visibility: 'visible',
      board_locked: true,
    };

    await sql`
      UPDATE boards
      SET archived_at = ${archivedAt}, settings = ${JSON.stringify(settings)}
      WHERE id = ${boardId}
    `;

    const channel = ablyServer.channels.get(`retro-board:${boardId}`);
    await channel.publish('board-completed', { archivedAt, settings });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
