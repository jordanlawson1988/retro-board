import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextRequest, NextResponse } from 'next/server';
import { loadBoardActor, guardResponse, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { shapeCard, shapeVotes, isRevealingChange, PUBLIC_VIEWER, type ViewBoard } from '@/lib/board-view';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import type { BoardSettings, Card, Vote } from '@/types';
import { readJsonObject, isPlainObject } from '@/lib/request-body';
import { INVALID_BODY } from '@/lib/board-validation';
import { patchNeedsSettingsGuard, resolveYouAre } from '@/lib/board-write-rules';
import { loadBoardAccess } from '@/lib/board-access-loader';
import { BOARD_ACCESS } from '@/lib/constants/board-access';
import {
  getSessionOrNull,
  assertCanFacilitate,
  assertBoardOwner,
  authzErrorResponse,
} from '@/lib/auth-helpers';

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

  // Resolve the viewer (null for a trashed board, which only its owner/admin can open).
  const loaded = await loadBoardActor(request, boardId);
  const viewBoard: ViewBoard = {
    trust_version: Number(board.trust_version) === 2 ? 2 : 1,
    settings: loaded?.board.settings ?? { ...DEFAULT_BOARD_SETTINGS, ...(board.settings ?? {}) },
    archived_at: board.archived_at ?? null,
  };

  // Who may see this board's content and action items (Rules A and B). One shared decision.
  // v1 limitation: identity is the claimed `pid` query value, so on legacy boards anyone who
  // knows a participant id passes as that participant. v2 ignores `pid` entirely.
  const claimedPid = request.nextUrl.searchParams.get('pid');
  const access = await loadBoardAccess({
    boardId,
    trustVersion: viewBoard.trust_version,
    archived: !!viewBoard.archived_at,
    userId,
    cookieParticipantId: viewBoard.trust_version === 2 ? (loaded?.actor.participantId ?? null) : null,
    claimedParticipantId: viewBoard.trust_version === 1 && claimedPid ? claimedPid.slice(0, 200) : null,
  });

  if (access.access === BOARD_ACCESS[1]) {
    return NextResponse.json({
      access: access.access,
      board: {
        id: board.id,
        title: board.title,
        archived_at: board.archived_at,
        trust_version: viewBoard.trust_version,
      },
      columns: [],
      cards: [],
      votes: [],
      actionItems: [],
      participants: [],
      yourParticipantId: null,
      youCanFacilitate: false,
      youAre: { participantId: null, isFacilitator: false, joined: false },
    });
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

  // v2: identity is the signed cookie only. yourParticipantId stays the signed-in user's
  // own participant row: a hint the client uses to join and obtain a cookie.
  const youAre = resolveYouAre({
    trustVersion: viewBoard.trust_version,
    actorParticipantId: loaded?.actor.participantId ?? null,
    actorIsFacilitator: loaded?.actor.isFacilitator ?? false,
    matchedParticipantId: yourParticipantId,
    authorityCanFacilitate: youCanFacilitate,
  });
  if (viewBoard.trust_version === 2) {
    youCanFacilitate = youAre.isFacilitator;
  }

  // Shape for what this viewer is allowed to see. v2 uses the cookie identity only.
  const viewer =
    viewBoard.trust_version === 2
      ? loaded
        ? { participantId: loaded.actor.participantId }
        : PUBLIC_VIEWER
      : { participantId: yourParticipantId };

  return NextResponse.json({
    board,
    columns,
    cards: (cards as unknown as Card[]).map((c) => shapeCard(c, viewBoard, viewer)),
    votes: shapeVotes(votes as unknown as Vote[], viewBoard, viewer),
    // Rule A: action items only for people who are part of the board.
    actionItems: access.canViewDetail ? actionItems : [],
    participants,
    access: access.access,
    yourParticipantId,
    youCanFacilitate,
    youAre,
  });
}

// Rename / settings update. Facilitator (owner/facilitator/admin) only.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  if (body.settings !== undefined && !isPlainObject(body.settings)) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }

  let prevSettings: BoardSettings | null = null;
  if (patchNeedsSettingsGuard(body)) {
    // Settings changes go through the actor so a v2 creator without an account can change them.
    const loaded = await loadBoardActor(request, boardId);
    if (!loaded) return BOARD_NOT_FOUND();
    const denied = guardResponse(checkAction('board.settings', loaded.actor, loaded.state));
    if (denied) return denied;
    prevSettings = loaded.state.settings;
  } else {
    // Rename / description only: facilitators may still rename a completed board.
    try {
      await assertCanFacilitate(boardId);
    } catch (e) {
      const r = authFail(e);
      if (r) return r;
      throw e;
    }
  }
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
    // Revealing hidden cards, votes or authors means clients must refetch shaped data.
    const nextSettings = { ...DEFAULT_BOARD_SETTINGS, ...(body.settings ?? {}) } as BoardSettings;
    const refetch = prevSettings !== null && isRevealingChange(prevSettings, nextSettings);
    await channel.publish('board-updated', refetch ? { ...changed, refetch: true } : changed);
  }

  return NextResponse.json({ ok: true });
}

// Lifecycle actions: complete (facilitator), reopen/restore/purge (owner).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { action } = body;
  const channel = ablyServer.channels.get(`retro-board:${boardId}`);

  if (action === 'complete') {
    // An already completed board returns 409 from the guard.
    const loaded = await loadBoardActor(request, boardId);
    if (!loaded) return BOARD_NOT_FOUND();
    const denied = guardResponse(checkAction('board.settings', loaded.actor, loaded.state));
    if (denied) return denied;
    const archivedAt = new Date().toISOString();
    const settings = { ...loaded.state.settings, card_visibility: 'visible', board_locked: true };
    await sql`
      UPDATE boards SET archived_at = ${archivedAt}, settings = ${JSON.stringify(settings)}
      WHERE id = ${boardId}
    `;
    await channel.publish('board-completed', { archivedAt, settings, refetch: true });
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
    // Clear archived_at and unlock; leave card_visibility as-is (facilitator can re-hide).
    const [board] = await sql`SELECT settings FROM boards WHERE id = ${boardId}`;
    const settings = { ...board.settings, board_locked: false };
    await sql`
      UPDATE boards SET archived_at = NULL, settings = ${JSON.stringify(settings)}
      WHERE id = ${boardId}
    `;
    await channel.publish('board-reopened', { settings, refetch: true });
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
