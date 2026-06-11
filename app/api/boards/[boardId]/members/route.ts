import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionOrNull, assertBoardOwner, assertCanFacilitate, authzErrorResponse } from '@/lib/auth-helpers';
import { isBoardMemberRole } from '@/types';

function authFail(e: unknown): NextResponse | null {
  const r = authzErrorResponse(e);
  return r ? NextResponse.json(r.body, { status: r.status }) : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const session = await getSessionOrNull();
  const requesterId = session?.user?.id ?? null;
  if (!requesterId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const members = await sql`
    SELECT bm.*, u.email AS user_email, u.name AS user_name
    FROM board_members bm
    JOIN "user" u ON bm.user_id = u.id
    WHERE bm.board_id = ${boardId}
    ORDER BY bm.joined_at ASC
  `;

  // Facilitators/owners see emails; plain members see names only;
  // non-members see nothing. Member emails are PII, not public data.
  let canSeeEmails = false;
  try {
    await assertCanFacilitate(boardId);
    canSeeEmails = true;
  } catch {
    canSeeEmails = false;
  }

  const isMember = members.some((m) => m.user_id === requesterId);
  if (!isMember && !canSeeEmails) {
    return NextResponse.json({ error: 'Not a member of this board' }, { status: 403 });
  }

  return NextResponse.json({
    members: members.map((m) => (canSeeEmails ? m : { ...m, user_email: null })),
  });
}

// Add a member or change a member's role. Owner only.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  let requesterId: string;
  try {
    ({ userId: requesterId } = await assertBoardOwner(boardId));
  } catch (e) {
    const r = authFail(e);
    if (r) return r;
    throw e;
  }

  const { userId, role } = await request.json();
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  const finalRole = role ?? 'participant';
  if (!isBoardMemberRole(finalRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  await sql`
    INSERT INTO board_members (board_id, user_id, role, invited_by)
    VALUES (${boardId}, ${userId}, ${finalRole}, ${requesterId})
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = ${finalRole}
  `;

  return NextResponse.json({ ok: true });
}

// Remove a member. The board owner may remove anyone (except the owner); any
// member may remove themselves (Leave). The owner cannot leave.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { userId } = await request.json();
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const session = await getSessionOrNull();
  const requesterId = session?.user?.id ?? null;
  if (!requesterId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  // Removing someone else requires board ownership; removing yourself is always allowed.
  if (userId !== requesterId) {
    try {
      await assertBoardOwner(boardId);
    } catch (e) {
      const r = authFail(e);
      if (r) return r;
      throw e;
    }
  }

  // The owner cannot be removed / cannot leave (must delete or transfer the board).
  const [board] = await sql`SELECT owner_id FROM boards WHERE id = ${boardId}`;
  if (board?.owner_id === userId) {
    return NextResponse.json(
      { error: 'The board owner cannot leave; delete or transfer the board instead.' },
      { status: 400 }
    );
  }

  await sql`DELETE FROM board_members WHERE board_id = ${boardId} AND user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}
