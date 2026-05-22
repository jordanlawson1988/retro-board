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
  if (filter === 'trash') {
    // Lazy purge: hard-delete boards that have been in Trash longer than 30 days.
    // Runs only here (when the owner opens Trash) — no cron needed.
    await sql`
      DELETE FROM boards
      WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'
    `;
    // Trash is owner-scoped (only owners can soft-delete a board).
    boards = await sql`
      SELECT b.*,
        (SELECT COUNT(*)::int FROM cards WHERE board_id = b.id) AS card_count,
        (SELECT COUNT(*)::int FROM participants WHERE board_id = b.id) AS participant_count,
        (SELECT COUNT(*)::int FROM action_items WHERE board_id = b.id) AS action_count,
        'owner' AS user_role
      FROM boards b
      WHERE b.owner_id = ${userId} AND b.deleted_at IS NOT NULL
      ORDER BY b.deleted_at DESC
    `;
  } else if (filter === 'active') {
    boards = await sql`
      SELECT DISTINCT b.*,
        (SELECT COUNT(*)::int FROM cards WHERE board_id = b.id) AS card_count,
        (SELECT COUNT(*)::int FROM participants WHERE board_id = b.id) AS participant_count,
        (SELECT COUNT(*)::int FROM action_items WHERE board_id = b.id) AS action_count,
        CASE WHEN b.owner_id = ${userId} THEN 'owner' ELSE bm.role END AS user_role
      FROM boards b
      LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = ${userId}
      WHERE (b.owner_id = ${userId} OR bm.user_id = ${userId})
        AND b.archived_at IS NULL
        AND b.deleted_at IS NULL
      ORDER BY b.created_at DESC
    `;
  } else if (filter === 'completed') {
    boards = await sql`
      SELECT DISTINCT b.*,
        (SELECT COUNT(*)::int FROM cards WHERE board_id = b.id) AS card_count,
        (SELECT COUNT(*)::int FROM participants WHERE board_id = b.id) AS participant_count,
        (SELECT COUNT(*)::int FROM action_items WHERE board_id = b.id) AS action_count,
        CASE WHEN b.owner_id = ${userId} THEN 'owner' ELSE bm.role END AS user_role
      FROM boards b
      LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = ${userId}
      WHERE (b.owner_id = ${userId} OR bm.user_id = ${userId})
        AND b.archived_at IS NOT NULL
        AND b.deleted_at IS NULL
      ORDER BY b.archived_at DESC
    `;
  } else {
    boards = await sql`
      SELECT DISTINCT b.*,
        (SELECT COUNT(*)::int FROM cards WHERE board_id = b.id) AS card_count,
        (SELECT COUNT(*)::int FROM participants WHERE board_id = b.id) AS participant_count,
        (SELECT COUNT(*)::int FROM action_items WHERE board_id = b.id) AS action_count,
        CASE WHEN b.owner_id = ${userId} THEN 'owner' ELSE bm.role END AS user_role
      FROM boards b
      LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = ${userId}
      WHERE (b.owner_id = ${userId} OR bm.user_id = ${userId})
        AND b.deleted_at IS NULL
      ORDER BY b.created_at DESC
    `;
  }

  return NextResponse.json({ boards });
}
