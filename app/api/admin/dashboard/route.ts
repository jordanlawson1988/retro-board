import { sql } from '@/lib/db';

export async function GET() {
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
