import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { assertBoardOwner, authzErrorResponse } from '@/lib/auth-helpers';
import { generateJoinCode } from '@/lib/join-code';

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

  // Generate a unique code (retry on the rare collision).
  let joinCode = generateJoinCode();
  for (let attempts = 0; attempts < 10; attempts++) {
    const [existing] = await sql`SELECT 1 FROM boards WHERE join_code = ${joinCode}`;
    if (!existing) break;
    joinCode = generateJoinCode();
  }

  await sql`UPDATE boards SET join_code = ${joinCode} WHERE id = ${boardId}`;
  return NextResponse.json({ joinCode });
}
