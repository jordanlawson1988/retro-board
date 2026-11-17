import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getSessionOrNull } from '@/lib/auth-helpers';
import { readParticipantId } from '@/lib/participant-session';
import { loadBoardAccess } from '@/lib/board-access-loader';
import { BOARD_ACCESS, BOARD_COMPLETED_ERROR } from '@/lib/constants/board-access';
import { rateLimitOr429 } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const limited = await rateLimitOr429(request, 'join', 30, 60);
  if (limited) return limited;
  try {
    const { joinCode } = await request.json();

    if (!joinCode || typeof joinCode !== 'string' || joinCode.length !== 5) {
      return NextResponse.json({ error: 'Please enter a valid 5-digit code' }, { status: 400 });
    }

    const [board] = await sql`
      SELECT id, title, trust_version, archived_at FROM boards WHERE join_code = ${joinCode} AND deleted_at IS NULL
    `;

    if (!board) {
      return NextResponse.json({ error: 'No board found with that code' }, { status: 404 });
    }

    // A completed board is reachable only by people who were already part of it. The code
    // sends no participant id, so v1 participants are recognised by their account only;
    // they can still open the board link directly.
    if (board.archived_at) {
      const session = await getSessionOrNull();
      const isV2 = Number(board.trust_version) === 2;
      let cookieParticipantId: string | null = null;
      if (isV2) {
        const cookieId = readParticipantId(request, board.id);
        if (cookieId) {
          const [p] = await sql`SELECT 1 AS ok FROM participants WHERE id = ${cookieId} AND board_id = ${board.id}`;
          if (p) cookieParticipantId = cookieId;
        }
      }
      const decision = await loadBoardAccess({
        boardId: board.id,
        trustVersion: isV2 ? 2 : 1,
        archived: true,
        userId: session?.user?.id ?? null,
        cookieParticipantId,
        claimedParticipantId: null,
      });
      if (decision.access === BOARD_ACCESS[1]) {
        return NextResponse.json({ error: BOARD_COMPLETED_ERROR }, { status: 409 });
      }
    }

    return NextResponse.json({ boardId: board.id, title: board.title });
  } catch (err) {
    console.error('Failed to join board:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
