import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionOrNull,
  assertCanFacilitate,
  assertBoardOwner,
  authzErrorResponse,
} from '@/lib/auth-helpers';
import { getEntitlement } from '@/lib/entitlements';

/** Convert a thrown AuthzError into a NextResponse, or null for other errors. */
function authFail(e: unknown): NextResponse | null {
  const r = authzErrorResponse(e);
  return r ? NextResponse.json(r.body, { status: r.status }) : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const [board] = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const session = await getSessionOrNull();
  const userId = session?.user?.id ?? null;

  // Trashed boards are visible only to the owner / system admin (so the client
  // can offer Restore). Everyone else gets a 404.
  if (board.deleted_at) {
    let allowed = false;
    if (userId) {
      if (board.owner_id === userId) {
        allowed = true;
      } else {
        const [a] = await sql`SELECT EXISTS(SELECT 1 FROM admin_users WHERE id = ${userId}) AS is_admin`;
        allowed = !!a?.is_admin;
      }
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }
  }

  const [columns, cards, votes, actionItems, participants] = await Promise.all([
    sql`SELECT * FROM columns WHERE board_id = ${boardId} ORDER BY position`,
    sql`SELECT * FROM cards WHERE board_id = ${boardId} ORDER BY position`,
    sql`SELECT * FROM votes WHERE board_id = ${boardId}`,
    sql`SELECT * FROM action_items WHERE board_id = ${boardId} ORDER BY created_at`,
    sql`SELECT * FROM participants WHERE board_id = ${boardId}`,
  ]);

  // If authenticated, resolve the user's existing participant + facilitator authority.
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

// Rename / settings update. Facilitator (owner/facilitator/admin) only.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  try {
    await assertCanFacilitate(boardId);
  } catch (e) {
    const r = authFail(e);
    if (r) return r;
    throw e;
  }

  const body = await request.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changed: Record<string, any> = {};

  if (typeof body.title === 'string') {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    await sql`UPDATE boards SET title = ${title} WHERE id = ${boardId}`;
    changed.title = title;
  }

  if (body.description !== undefined) {
    const description = body.description === null ? null : String(body.description);
    await sql`UPDATE boards SET description = ${description} WHERE id = ${boardId}`;
    changed.description = description;
  }

  if (body.settings !== undefined) {
    await sql`UPDATE boards SET settings = ${JSON.stringify(body.settings)} WHERE id = ${boardId}`;
    changed.settings = body.settings;
  }

  if (Object.keys(changed).length > 0) {
    const channel = ablyServer.channels.get(`retro-board:${boardId}`);
    await channel.publish('board-updated', changed);
  }

  return NextResponse.json({ ok: true });
}

// Lifecycle actions: complete (facilitator), reopen/restore/purge (owner).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { action } = await request.json();
  const channel = ablyServer.channels.get(`retro-board:${boardId}`);

  if (action === 'complete') {
    try {
      await assertCanFacilitate(boardId);
    } catch (e) {
      const r = authFail(e);
      if (r) return r;
      throw e;
    }
    const archivedAt = new Date().toISOString();
    const [board] = await sql`SELECT settings FROM boards WHERE id = ${boardId}`;
    const settings = { ...board.settings, card_visibility: 'visible', board_locked: true };
    await sql`
      UPDATE boards SET archived_at = ${archivedAt}, settings = ${JSON.stringify(settings)}
      WHERE id = ${boardId}
    `;
    await channel.publish('board-completed', { archivedAt, settings });
    return NextResponse.json({ ok: true });
  }

  if (action === 'reopen') {
    try {
      await assertBoardOwner(boardId);
    } catch (e) {
      const r = authFail(e);
      if (r) return r;
      throw e;
    }
    const session = await getSessionOrNull();
    if (session?.user) {
      const ent = await getEntitlement(session.user.id, session.user.email);
      if (!ent.canCreateBoard) {
        return NextResponse.json(
          {
            error: `Reactivating this board would exceed the free plan's ${ent.limit} active board. Upgrade for unlimited boards.`,
            code: 'BOARD_LIMIT_REACHED',
          },
          { status: 402 }
        );
      }
    }
    // Clear archived_at and unlock; leave card_visibility as-is (facilitator can re-hide).
    const [board] = await sql`SELECT settings FROM boards WHERE id = ${boardId}`;
    const settings = { ...board.settings, board_locked: false };
    await sql`
      UPDATE boards SET archived_at = NULL, settings = ${JSON.stringify(settings)}
      WHERE id = ${boardId}
    `;
    await channel.publish('board-reopened', { settings });
    return NextResponse.json({ ok: true });
  }

  if (action === 'restore') {
    try {
      await assertBoardOwner(boardId);
    } catch (e) {
      const r = authFail(e);
      if (r) return r;
      throw e;
    }
    const session = await getSessionOrNull();
    if (session?.user) {
      const ent = await getEntitlement(session.user.id, session.user.email);
      if (!ent.canCreateBoard) {
        return NextResponse.json(
          {
            error: `Reactivating this board would exceed the free plan's ${ent.limit} active board. Upgrade for unlimited boards.`,
            code: 'BOARD_LIMIT_REACHED',
          },
          { status: 402 }
        );
      }
    }
    await sql`UPDATE boards SET deleted_at = NULL WHERE id = ${boardId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'purge') {
    try {
      await assertBoardOwner(boardId);
    } catch (e) {
      const r = authFail(e);
      if (r) return r;
      throw e;
    }
    // Hard delete — only permitted from Trash (cascades remove children).
    await sql`DELETE FROM boards WHERE id = ${boardId} AND deleted_at IS NOT NULL`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// Soft delete → Trash. Owner only.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  try {
    await assertBoardOwner(boardId);
  } catch (e) {
    const r = authFail(e);
    if (r) return r;
    throw e;
  }
  await sql`UPDATE boards SET deleted_at = now() WHERE id = ${boardId}`;
  return NextResponse.json({ ok: true });
}
