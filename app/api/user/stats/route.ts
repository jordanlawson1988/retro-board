import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Per-user profile stats, account-wide (independent of the dashboard filter).
// Cards/votes are attributed via the user's participant records:
// content.author_id / voter_id reference participants.id, and
// participants.user_id links a participant to this authenticated user.
export async function GET() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const [stats] = await sql`
    SELECT
      (
        SELECT COUNT(*)::int FROM boards b
        WHERE b.archived_at IS NULL
          AND b.deleted_at IS NULL
          AND (
            b.owner_id = ${userId}
            OR EXISTS (SELECT 1 FROM participants p WHERE p.board_id = b.id AND p.user_id = ${userId})
            OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.user_id = ${userId})
          )
      ) AS active_boards,
      (
        SELECT COUNT(*)::int FROM cards
        WHERE author_id IN (SELECT id FROM participants WHERE user_id = ${userId})
      ) AS cards_created,
      (
        SELECT COUNT(*)::int FROM votes
        WHERE voter_id IN (SELECT id FROM participants WHERE user_id = ${userId})
      ) AS votes_cast,
      (
        SELECT COUNT(*)::int FROM action_items
        WHERE created_by IN (SELECT id FROM participants WHERE user_id = ${userId})
      ) AS action_items_created
  `;

  return NextResponse.json({
    activeBoards: stats?.active_boards ?? 0,
    cardsCreated: stats?.cards_created ?? 0,
    votesCast: stats?.votes_cast ?? 0,
    // Counts only action items created after migration 006 (created_by);
    // pre-migration rows have NULL created_by and are not attributed.
    actionItemsCreated: stats?.action_items_created ?? 0,
  });
}
