import { sql } from '@/lib/db';
import { requireSystemAdmin, authzErrorResponse } from '@/lib/auth-helpers';

export async function GET() {
  try {
    await requireSystemAdmin();
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return Response.json(r.body, { status: r.status });
    throw e;
  }

  const [activeBoards, completedBoards, flags, recentBoards] = await Promise.all([
    sql`SELECT count(*) as count FROM boards WHERE archived_at IS NULL`,
    sql`SELECT count(*) as count FROM boards WHERE archived_at IS NOT NULL`,
    sql`SELECT count(*) as count FROM feature_flags`,
    sql`SELECT id, title, created_at, archived_at FROM boards ORDER BY created_at DESC LIMIT 5`,
  ]);

  // Get participant counts for recent boards
  const boardIds = recentBoards.map((b: any) => b.id);
  let participantCounts: any[] = [];
  if (boardIds.length > 0) {
    participantCounts = await sql`
      SELECT board_id, count(*) as count FROM participants
      WHERE board_id = ANY(${boardIds}) GROUP BY board_id
    `;
  }

  return Response.json({
    stats: {
      activeBoards: Number(activeBoards[0].count),
      completedBoards: Number(completedBoards[0].count),
      totalFlags: Number(flags[0].count),
    },
    recentBoards: recentBoards.map((b: any) => ({
      ...b,
      participantCount: Number(
        participantCounts.find((p: any) => p.board_id === b.id)?.count ?? 0
      ),
    })),
  });
}
