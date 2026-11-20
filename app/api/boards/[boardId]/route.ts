import { sql, sqlTransaction } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextRequest, NextResponse } from 'next/server';
import { loadBoardActor, guardResponse, BOARD_NOT_FOUND, type LoadedBoard } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { shapeCard, shapeVotes, isRevealingChange, PUBLIC_VIEWER, type ViewBoard } from '@/lib/board-view';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import type { BoardSettings, Card, Vote } from '@/types';
import { readJsonObject, isPlainObject } from '@/lib/request-body';
import { INVALID_BODY, validateSettingsPatch } from '@/lib/board-validation';
import { patchNeedsSettingsGuard, resolveYouAre } from '@/lib/board-write-rules';
import { boardAccessFrom } from '@/lib/board-access-loader';
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

  // One round-trip: board row, caller standing, cookie participant, authority, membership.
  const claimedPid = request.nextUrl.searchParams.get('pid');
  const loadedAny = await loadBoardActor(request, boardId, null, {
    includeDeleted: true,
    claimedParticipantId: claimedPid ? claimedPid.slice(0, 200) : null,
  });
  if (!loadedAny) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }
  const board = loadedAny.row;
  const userId = loadedAny.userId;

  // Trashed boards are visible only to the owner / system admin (so the client
  // can offer Restore). Everyone else gets a 404.
  const trashed = !!loadedAny.board.deleted_at;
  if (trashed && !(loadedAny.authority?.isOwner || loadedAny.authority?.isSystemAdmin)) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  // A trashed board has no acting participant (only its owner/admin can open it).
  const loaded: LoadedBoard | null = trashed ? null : loadedAny;
  const viewBoard: ViewBoard = {
    trust_version: loadedAny.board.trust_version,
    settings: loadedAny.board.settings,
    archived_at: loadedAny.board.archived_at,
  };

  // Who may see this board's content and action items (Rules A and B). One shared decision,
  // computed from the row already loaded (no extra query).
  // v1 limitation: identity is the claimed `pid` query value, so on legacy boards anyone who
  // knows a participant id passes as that participant. v2 ignores `pid` entirely.
  const access = boardAccessFrom(trashed ? { ...loadedAny, participant: null } : loadedAny);

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

  // One read-only snapshot transaction: a single round-trip and a consistent view.
  const [columns, cards, votes, actionItems, participants] = await sqlTransaction(
    (txn) => [
      txn`SELECT * FROM columns WHERE board_id = ${boardId} ORDER BY position, created_at, id`,
      txn`SELECT * FROM cards WHERE board_id = ${boardId} ORDER BY position, created_at, id`,
      txn`SELECT * FROM votes WHERE board_id = ${boardId}`,
      txn`SELECT * FROM action_items WHERE board_id = ${boardId} ORDER BY created_at`,
      txn`SELECT * FROM participants WHERE board_id = ${boardId}`,
    ],
    { readOnly: true, isolationLevel: 'RepeatableRead' }
  );

  // Signed-in user's existing participant + facilitator authority (from the same loaded row).
  const yourParticipantId: string | null = loadedAny.userParticipantId;
  let youCanFacilitate = loadedAny.authority?.canFacilitate ?? false;

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
// Two statements in total: the context query (loadBoardActor) and one UPDATE ... RETURNING.
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

  // Validate everything before touching the database.
  const hasTitle = typeof body.title === 'string';
  const title = hasTitle ? (body.title as string).trim() : null;
  if (hasTitle && !title) {
    return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
  }
  const hasDescription = body.description !== undefined;
  const description = body.description === null || body.description === undefined ? null : String(body.description);
  let settingsPatch: Partial<BoardSettings> | null = null;
  if (body.settings !== undefined) {
    const valid = validateSettingsPatch(body.settings as Record<string, unknown>);
    if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
    settingsPatch = valid.value;
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
    // Rename / description only: signed-in facilitator authority (owner, facilitator member,
    // system admin), read from the same one-query context. Facilitators may still rename a
    // completed or trashed board. Not destructive, so the cached session is enough here.
    const loaded = await loadBoardActor(request, boardId, null, { includeDeleted: true });
    if (!loaded) return BOARD_NOT_FOUND();
    if (!loaded.userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (!loaded.authority?.canFacilitate) {
      return NextResponse.json({ error: 'Facilitator access required' }, { status: 403 });
    }
  }

  if (!hasTitle && !hasDescription && settingsPatch === null) {
    return NextResponse.json({ ok: true });
  }

  // One atomic statement. Settings merge key by key (nested values such as `timer` are replaced
  // whole per top-level key), so concurrent changes to different keys cannot undo each other.
  const [row] = await sql`
    UPDATE boards SET
      title = CASE WHEN ${hasTitle}::boolean THEN ${title}::text ELSE title END,
      description = CASE WHEN ${hasDescription}::boolean THEN ${description}::text ELSE description END,
      settings = CASE WHEN ${settingsPatch !== null}::boolean
        THEN settings || ${JSON.stringify(settingsPatch ?? {})}::jsonb ELSE settings END
    WHERE id = ${boardId}
      AND (NOT ${settingsPatch !== null}::boolean OR (archived_at IS NULL AND deleted_at IS NULL))
    RETURNING title, description, settings
  `;
  if (!row) {
    // A settings write re-checks board state in the statement. On a miss, say why. Title and
    // description edits carry no state condition, so for them a miss only means the board is gone.
    if (settingsPatch !== null) {
      const [now] = await sql`SELECT archived_at, deleted_at FROM boards WHERE id = ${boardId}`;
      if (now && !now.deleted_at && now.archived_at) {
        // Same response checkAction('board.settings') gives for a completed board.
        return NextResponse.json({ error: 'Board is completed' }, { status: 409 });
      }
    }
    return BOARD_NOT_FOUND();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changed: Record<string, any> = {};
  if (hasTitle) changed.title = row.title;
  if (hasDescription) changed.description = row.description;
  // Clients replace their settings with the event's, so publish the merged result, not the patch.
  if (settingsPatch !== null) changed.settings = row.settings;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  // Revealing hidden cards, votes or authors means clients must refetch shaped data. Compare the
  // loaded settings with the MERGED result, never with the partial patch.
  const nextSettings = { ...DEFAULT_BOARD_SETTINGS, ...(row.settings as Partial<BoardSettings>) } as BoardSettings;
  const refetch = prevSettings !== null && isRevealingChange(prevSettings, nextSettings);
  await channel.publish('board-updated', refetch ? { ...changed, refetch: true } : changed);

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
    // Merge in the database so a settings change committed since the load is not undone.
    const [done] = await sql`
      UPDATE boards SET archived_at = ${archivedAt},
        settings = settings || '{"card_visibility":"visible","board_locked":true}'::jsonb
      WHERE id = ${boardId}
      RETURNING settings
    `;
    if (!done) return BOARD_NOT_FOUND();
    const settings = { ...DEFAULT_BOARD_SETTINGS, ...(done.settings as Partial<BoardSettings>) };
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
    const [board] = await sql`
      UPDATE boards SET archived_at = NULL, settings = settings || '{"board_locked":false}'::jsonb
      WHERE id = ${boardId}
      RETURNING settings
    `;
    if (!board) return BOARD_NOT_FOUND();
    const settings = board.settings;
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
