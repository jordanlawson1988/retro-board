import { sql } from '@/lib/db';
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
