import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { assertBoardOwner, authzErrorResponse } from '@/lib/auth-helpers';
import { withJoinCodeRetry } from '@/lib/join-code-retry';

// Rotate the board's 5-digit join code, invalidating previously shared codes. Owner only.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  try {
    await assertBoardOwner(boardId);
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(r.body, { status: r.status });
    throw e;
  }

  // Write a fresh code; retry on the rare collision with uq_boards_join_code (no pre-check round-trip).
  const joinCode = await withJoinCodeRetry(
    (code) => sql`UPDATE boards SET join_code = ${code} WHERE id = ${boardId}`
  );
  return NextResponse.json({ joinCode });
}
