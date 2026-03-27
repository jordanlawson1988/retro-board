import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const filter = request.nextUrl.searchParams.get('filter') || 'all';

  let boards;
  if (filter === 'active') {
    boards = await sql`
      SELECT DISTINCT b.*,
        (SELECT COUNT(*) FROM cards WHERE board_id = b.id) AS card_count,
        (SELECT COUNT(*) FROM participants WHERE board_id = b.id) AS participant_count,
        (SELECT COUNT(*) FROM action_items WHERE board_id = b.id) AS action_count,
        CASE WHEN b.owner_id = ${userId} THEN 'owner' ELSE bm.role END AS user_role
      FROM boards b
      LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = ${userId}
      WHERE (b.owner_id = ${userId} OR bm.user_id = ${userId})
        AND b.archived_at IS NULL
      ORDER BY b.created_at DESC
    `;
  } else if (filter === 'completed') {
    boards = await sql`
      SELECT DISTINCT b.*,
        (SELECT COUNT(*) FROM cards WHERE board_id = b.id) AS card_count,
        (SELECT COUNT(*) FROM participants WHERE board_id = b.id) AS participant_count,
        (SELECT COUNT(*) FROM action_items WHERE board_id = b.id) AS action_count,
        CASE WHEN b.owner_id = ${userId} THEN 'owner' ELSE bm.role END AS user_role
      FROM boards b
      LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = ${userId}
      WHERE (b.owner_id = ${userId} OR bm.user_id = ${userId})
        AND b.archived_at IS NOT NULL
      ORDER BY b.archived_at DESC
    `;
  } else {
    boards = await sql`
      SELECT DISTINCT b.*,
        (SELECT COUNT(*) FROM cards WHERE board_id = b.id) AS card_count,
        (SELECT COUNT(*) FROM participants WHERE board_id = b.id) AS participant_count,
        (SELECT COUNT(*) FROM action_items WHERE board_id = b.id) AS action_count,
        CASE WHEN b.owner_id = ${userId} THEN 'owner' ELSE bm.role END AS user_role
      FROM boards b
      LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = ${userId}
      WHERE b.owner_id = ${userId} OR bm.user_id = ${userId}
      ORDER BY b.created_at DESC
    `;
  }

  return NextResponse.json({ boards });
}
