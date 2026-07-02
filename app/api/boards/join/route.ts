import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getSessionOrNull } from '@/lib/auth-helpers';
import { rateLimitOr429 } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const limited = await rateLimitOr429(request, 'join', 10, 60);
  if (limited) return limited;
  try {
    const { joinCode } = await request.json();

    if (!joinCode || typeof joinCode !== 'string' || joinCode.length !== 5) {
      return NextResponse.json({ error: 'Please enter a valid 5-digit code' }, { status: 400 });
    }

    const [board] = await sql`
      SELECT id, title, owner_id, archived_at FROM boards WHERE join_code = ${joinCode} AND deleted_at IS NULL
    `;

    if (!board) {
      return NextResponse.json({ error: 'No board found with that code' }, { status: 404 });
    }

    // If board is completed, only the owner can access it
    if (board.archived_at) {
      const session = await getSessionOrNull();
      if (!session?.user?.id || session.user.id !== board.owner_id) {
        return NextResponse.json(
          { error: 'This retro has been completed and is no longer accepting participants' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ boardId: board.id, title: board.title });
  } catch (err) {
    console.error('Failed to join board:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
