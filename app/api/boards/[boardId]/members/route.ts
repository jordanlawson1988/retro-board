import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const members = await sql`
    SELECT bm.*, u.email AS user_email, u.name AS user_name
    FROM board_members bm
    JOIN "user" u ON bm.user_id = u.id
    WHERE bm.board_id = ${boardId}
    ORDER BY bm.joined_at ASC
  `;

  return NextResponse.json({ members });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify requester is board owner
  const [board] = await sql`SELECT owner_id FROM boards WHERE id = ${boardId}`;
  if (!board || board.owner_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the board owner can add members' }, { status: 403 });
  }

  const { userId, role } = await request.json();

  await sql`
    INSERT INTO board_members (board_id, user_id, role, invited_by)
    VALUES (${boardId}, ${userId}, ${role || 'participant'}, ${session.user.id})
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = ${role || 'participant'}
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify requester is board owner
  const [board] = await sql`SELECT owner_id FROM boards WHERE id = ${boardId}`;
  if (!board || board.owner_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the board owner can remove members' }, { status: 403 });
  }

  const { userId } = await request.json();

  // Can't remove the owner
  if (userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot remove board owner' }, { status: 400 });
  }

  await sql`DELETE FROM board_members WHERE board_id = ${boardId} AND user_id = ${userId}`;

  return NextResponse.json({ ok: true });
}
