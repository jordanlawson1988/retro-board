import { sql } from '@/lib/db';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const filter = url.searchParams.get('filter') || 'all';
  const page = Number(url.searchParams.get('page') || '0');
  const pageSize = Number(url.searchParams.get('pageSize') || '10');
  const offset = page * pageSize;

  // Get counts for filter tabs
  const [allCount, activeCount, completedCount] = await Promise.all([
    sql`SELECT count(*) as count FROM boards`,
    sql`SELECT count(*) as count FROM boards WHERE archived_at IS NULL`,
    sql`SELECT count(*) as count FROM boards WHERE archived_at IS NOT NULL`,
  ]);

  // Build main query based on filter and search
  let boards;
  let totalCount;

  if (search && filter === 'active') {
    boards = await sql`SELECT * FROM boards WHERE title ILIKE ${'%' + search + '%'} AND archived_at IS NULL ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const [tc] = await sql`SELECT count(*) as count FROM boards WHERE title ILIKE ${'%' + search + '%'} AND archived_at IS NULL`;
    totalCount = Number(tc.count);
  } else if (search && filter === 'completed') {
    boards = await sql`SELECT * FROM boards WHERE title ILIKE ${'%' + search + '%'} AND archived_at IS NOT NULL ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const [tc] = await sql`SELECT count(*) as count FROM boards WHERE title ILIKE ${'%' + search + '%'} AND archived_at IS NOT NULL`;
    totalCount = Number(tc.count);
  } else if (search) {
    boards = await sql`SELECT * FROM boards WHERE title ILIKE ${'%' + search + '%'} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const [tc] = await sql`SELECT count(*) as count FROM boards WHERE title ILIKE ${'%' + search + '%'}`;
    totalCount = Number(tc.count);
  } else if (filter === 'active') {
    boards = await sql`SELECT * FROM boards WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    totalCount = Number(activeCount[0].count);
  } else if (filter === 'completed') {
    boards = await sql`SELECT * FROM boards WHERE archived_at IS NOT NULL ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    totalCount = Number(completedCount[0].count);
  } else {
    boards = await sql`SELECT * FROM boards ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    totalCount = Number(allCount[0].count);
  }

  // Get participant and card counts
  const boardIds = boards.map((b: any) => b.id);
  let participantCounts: any[] = [];
  let cardCounts: any[] = [];
  if (boardIds.length > 0) {
    [participantCounts, cardCounts] = await Promise.all([
      sql`SELECT board_id, count(*) as count FROM participants WHERE board_id = ANY(${boardIds}) GROUP BY board_id`,
      sql`SELECT board_id, count(*) as count FROM cards WHERE board_id = ANY(${boardIds}) GROUP BY board_id`,
    ]);
  }

  return Response.json({
    boards: boards.map((b: any) => ({
      ...b,
      participant_count: Number(participantCounts.find((p: any) => p.board_id === b.id)?.count ?? 0),
      card_count: Number(cardCounts.find((c: any) => c.board_id === b.id)?.count ?? 0),
    })),
    totalCount,
    counts: {
      all: Number(allCount[0].count),
      active: Number(activeCount[0].count),
      completed: Number(completedCount[0].count),
    },
  });
}

export async function DELETE(request: Request) {
  const { boardId } = await request.json();
  await sql`DELETE FROM boards WHERE id = ${boardId}`;
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  const { boardId, action } = await request.json();
  if (action === 'archive') {
    // Fetch current settings to merge board_locked
    const [board] = await sql`SELECT settings FROM boards WHERE id = ${boardId}`;
    const mergedSettings = { ...(board?.settings ?? {}), board_locked: true };
    await sql`UPDATE boards SET archived_at = NOW(), settings = ${JSON.stringify(mergedSettings)} WHERE id = ${boardId}`;
  } else if (action === 'unarchive') {
    await sql`UPDATE boards SET archived_at = NULL WHERE id = ${boardId}`;
  }
  return Response.json({ ok: true });
}
