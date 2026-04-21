import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionOrNull } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const [board] = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const [columns, cards, votes, actionItems, participants] = await Promise.all([
    sql`SELECT * FROM columns WHERE board_id = ${boardId} ORDER BY position`,
    sql`SELECT * FROM cards WHERE board_id = ${boardId} ORDER BY position`,
    sql`SELECT * FROM votes WHERE board_id = ${boardId}`,
    sql`SELECT * FROM action_items WHERE board_id = ${boardId} ORDER BY created_at`,
    sql`SELECT * FROM participants WHERE board_id = ${boardId}`,
  ]);

  // If authenticated, resolve the user's existing participant on this board so
  // they regain their role (admin/participant) across devices. Prefer the admin
  // record when multiple exist (can happen if user joined from several devices
  // before this resolver existed).
  const session = await getSessionOrNull();
  const userId = session?.user?.id ?? null;
  let yourParticipantId: string | null = null;
  let youCanFacilitate = false;
  if (userId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userParticipants = (participants as any[]).filter((p) => p.user_id === userId);
    if (userParticipants.length > 0) {
      userParticipants.sort((a, b) => {
        if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1;
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
      });
      yourParticipantId = userParticipants[0].id;
    }

    // Facilitator authority comes from any of:
    //   - board.owner_id matches this user,
    //   - an entry in board_members with role owner/facilitator,
    //   - or membership in admin_users (system admin — covers legacy boards
    //     created before user_accounts migration where owner_id is NULL).
    const [authorityCheck] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM boards WHERE id = ${boardId} AND owner_id = ${userId}
        UNION ALL
        SELECT 1 FROM board_members
          WHERE board_id = ${boardId} AND user_id = ${userId}
            AND role IN ('owner', 'facilitator')
        UNION ALL
        SELECT 1 FROM admin_users WHERE id = ${userId}
      ) AS has_authority
    `;
    youCanFacilitate = !!authorityCheck?.has_authority;
  }

  return NextResponse.json({
    board,
    columns,
    cards,
    votes,
    actionItems,
    participants,
    yourParticipantId,
    youCanFacilitate,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { settings } = await request.json();

  await sql`UPDATE boards SET settings = ${JSON.stringify(settings)} WHERE id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('board-updated', { settings });

  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { action } = await request.json();

  if (action === 'complete') {
    const archivedAt = new Date().toISOString();

    // Get current settings, then update them
    const [board] = await sql`SELECT settings FROM boards WHERE id = ${boardId}`;
    const settings = {
      ...board.settings,
      card_visibility: 'visible',
      board_locked: true,
    };

    await sql`
      UPDATE boards
      SET archived_at = ${archivedAt}, settings = ${JSON.stringify(settings)}
      WHERE id = ${boardId}
    `;

    const channel = ablyServer.channels.get(`retro-board:${boardId}`);
    await channel.publish('board-completed', { archivedAt, settings });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
