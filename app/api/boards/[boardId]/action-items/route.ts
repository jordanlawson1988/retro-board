import { sql } from '@/lib/db';
import { dbErrorCode, FOREIGN_KEY_VIOLATION } from '@/lib/db-error';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { loadBoardActor, guardResponse, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { readJsonObject, isPlainObject } from '@/lib/request-body';
import {
  validateActionItemDescription,
  validateActionItemUpdates,
  validateClientId,
  isUuid,
  INVALID_BODY,
  INVALID_ASSIGNEE,
} from '@/lib/board-validation';
import { GUIDED_MODE, PHASE_CHANGED_ERROR } from '@/lib/constants/phases';
import { TOPIC_NOT_FOUND_ERROR, ASSIGNEE_NOT_FOUND_ERROR } from '@/lib/constants/agenda';
import { topicActionOutcome, assignOutcome } from '@/lib/agenda';

type Loaded = NonNullable<Awaited<ReturnType<typeof loadBoardActor>>>;

const ITEM_NOT_FOUND = () => NextResponse.json({ error: 'Action item not found' }, { status: 404 });


export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const limited = await rateLimitOr429(request, 'action-item', 120, 60);
  if (limited) return limited;
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { description, assignee, dueDate, createdBy } = body;
  const descOk = validateActionItemDescription(description);
  if (!descOk.ok) return NextResponse.json({ error: descOk.error }, { status: 400 });
  const optString = (v: unknown) => v === undefined || v === null || typeof v === 'string';
  if (!optString(assignee) || !optString(dueDate) || !optString(createdBy)) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }
  const loaded = await loadBoardActor(request, boardId, (createdBy as string | null | undefined) ?? null);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('action-item.write', loaded.actor, loaded.state));
  if (denied) return denied;
  if (loaded.board.mode === GUIDED_MODE) return guidedCreate(loaded, boardId, body);
  // v2: attribution comes from the signed session (may be null for an unjoined facilitator).
  let itemCreatedBy: string | null =
    loaded.board.trust_version === 2 ? loaded.actor.participantId : ((createdBy as string | null | undefined) ?? null);
  // Legacy boards take the id from the body; created_by references participants(id), so an id
  // with no participant row on this board is stored as null instead of failing the insert.
  if (loaded.board.trust_version !== 2 && itemCreatedBy !== null) {
    const [known] = await sql`SELECT 1 FROM participants WHERE id = ${itemCreatedBy} AND board_id = ${boardId}`;
    if (!known) itemCreatedBy = null;
  }

  const [item] = await sql`
    INSERT INTO action_items (board_id, description, assignee, due_date, created_by)
    VALUES (${boardId}, ${description}, ${assignee ?? null}, ${dueDate ?? null}, ${itemCreatedBy})
    RETURNING *
  `;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-created', { item });

  return NextResponse.json({ item });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { itemId, updates } = body;
  if (!isUuid(itemId) || !isPlainObject(updates)) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }
  const valid = validateActionItemUpdates(updates);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const loaded = await loadBoardActor(request, boardId, null);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('action-item.write', loaded.actor, loaded.state));
  if (denied) return denied;
  if (loaded.board.mode === GUIDED_MODE) return guidedPatch(loaded, boardId, itemId, updates);

  // One atomic statement: provided fields are written, the rest keep their value.
  const has = (k: string) => updates[k] !== undefined;
  const [item] = await sql`
    UPDATE action_items SET
      description = CASE WHEN ${has('description')}::boolean THEN ${updates.description ?? null}::text ELSE description END,
      assignee = CASE WHEN ${has('assignee')}::boolean THEN ${updates.assignee ?? null}::text ELSE assignee END,
      due_date = CASE WHEN ${has('due_date')}::boolean THEN ${updates.due_date ?? null}::date ELSE due_date END,
      status = CASE WHEN ${has('status')}::boolean THEN ${updates.status ?? null}::text ELSE status END
    WHERE id = ${itemId} AND board_id = ${boardId}
    RETURNING *
  `;
  if (!item) return ITEM_NOT_FOUND();

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-updated', { item });

  return NextResponse.json({ item });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { itemId } = body;
  if (!isUuid(itemId)) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }
  const loaded = await loadBoardActor(request, boardId, null);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('action-item.write', loaded.actor, loaded.state));
  if (denied) return denied;

  const deleted = await sql`DELETE FROM action_items WHERE id = ${itemId} AND board_id = ${boardId} RETURNING id`;
  if (deleted.length === 0) return ITEM_NOT_FOUND();

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-deleted', { itemId });

  return NextResponse.json({ ok: true });
}

/** The flag columns the guided statements add are decided on and then dropped: the response and the event carry an action item row only. */
function stripFlags(row: Record<string, unknown>): Record<string, unknown> {
  const item = { ...row };
  delete item.board_ok;
  delete item.topic_ok;
  delete item.owner_ok;
  return item;
}

/** A guided board's create: optional topic link and owner. Only a link to a topic needs the phase the request was checked against (Discuss); every phase allows action items. */
async function guidedCreate(loaded: Loaded, boardId: string, body: Record<string, unknown>) {
  const { description, assignee, dueDate, cardId, assigneeParticipantId } = body;
  if (cardId !== undefined && cardId !== null && !validateClientId(cardId).ok) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }
  if (
    assigneeParticipantId !== undefined &&
    assigneeParticipantId !== null &&
    !validateClientId(assigneeParticipantId).ok
  ) {
    return NextResponse.json({ error: INVALID_ASSIGNEE }, { status: 400 });
  }
  const topicId = typeof cardId === 'string' ? cardId : null;
  const ownerId = typeof assigneeParticipantId === 'string' ? assigneeParticipantId : null;
  if (topicId !== null) {
    const denied = guardResponse(checkAction('action-item.link', loaded.actor, loaded.state));
    if (denied) return denied;
  }
  const phase = loaded.board.phase;
  // Same as the open create on a v2 board: null for a signed-in facilitator who has not joined.
  const createdBy = loaded.actor.participantId;

  let row: Record<string, unknown>;
  try {
    [row] = await sql`
    WITH ok AS (
      SELECT 1 AS one FROM boards
      WHERE id = ${boardId} AND (${topicId}::text IS NULL OR phase = ${phase}) AND archived_at IS NULL AND deleted_at IS NULL
      FOR SHARE
    ), topic AS (
      SELECT id FROM cards WHERE id = ${topicId}::text AND board_id = ${boardId} AND merged_with IS NULL
    ), owner AS (
      SELECT id, display_name FROM participants WHERE id = ${ownerId}::text AND board_id = ${boardId}
    ), inserted AS (
      INSERT INTO action_items (board_id, description, assignee, due_date, created_by, card_id, assignee_participant_id)
      SELECT ${boardId}, ${description}, COALESCE((SELECT display_name FROM owner), ${(assignee as string | null | undefined) ?? null}::text),
             ${(dueDate as string | null | undefined) ?? null}::date, ${createdBy}, (SELECT id FROM topic), (SELECT id FROM owner)
      FROM ok
      WHERE (${topicId}::text IS NULL OR EXISTS (SELECT 1 FROM topic))
        AND (${ownerId}::text IS NULL OR EXISTS (SELECT 1 FROM owner))
      RETURNING *
    )
    SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
           (${topicId}::text IS NULL OR EXISTS (SELECT 1 FROM topic)) AS topic_ok,
           (${ownerId}::text IS NULL OR EXISTS (SELECT 1 FROM owner)) AS owner_ok,
           i.*
    FROM (SELECT 1) one LEFT JOIN inserted i ON true
  `;
  } catch (err) {
    // The owner or the topic's card was removed between the reads and the insert. Only the code is read.
    if (dbErrorCode(err) === FOREIGN_KEY_VIOLATION) {
      if (ownerId !== null) return NextResponse.json({ error: ASSIGNEE_NOT_FOUND_ERROR }, { status: 404 });
      if (topicId !== null) return NextResponse.json({ error: TOPIC_NOT_FOUND_ERROR }, { status: 404 });
    }
    throw err;
  }
  const outcome = topicActionOutcome(row as Parameters<typeof topicActionOutcome>[0]);
  if (outcome === 'phase-changed') return NextResponse.json({ error: PHASE_CHANGED_ERROR }, { status: 409 });
  if (outcome === 'topic-missing') return NextResponse.json({ error: TOPIC_NOT_FOUND_ERROR }, { status: 404 });
  if (outcome === 'owner-missing') return NextResponse.json({ error: ASSIGNEE_NOT_FOUND_ERROR }, { status: 404 });

  const item = stripFlags(row);
  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-created', { item });
  return NextResponse.json({ item });
}

/** A guided board's edit: the owner is picked from the board's people; free text clears the link. */
async function guidedPatch(
  loaded: Loaded,
  boardId: string,
  itemId: string,
  updates: Record<string, unknown>,
) {
  const owner = updates.assignee_participant_id;
  if (owner !== undefined && owner !== null && !validateClientId(owner).ok) {
    return NextResponse.json({ error: INVALID_ASSIGNEE }, { status: 400 });
  }
  const hasOwner = owner !== undefined;
  const ownerId = typeof owner === 'string' ? owner : null;
  const has = (k: string) => updates[k] !== undefined;

  const [row] = await sql`
    WITH ok AS (
      SELECT 1 AS one FROM boards
      WHERE id = ${boardId} AND archived_at IS NULL AND deleted_at IS NULL
      FOR SHARE
    ), owner AS (
      SELECT id, display_name FROM participants WHERE id = ${ownerId}::text AND board_id = ${boardId}
    ), updated AS (
      UPDATE action_items SET
        description = CASE WHEN ${has('description')}::boolean THEN ${updates.description ?? null}::text ELSE description END,
        assignee = CASE WHEN ${hasOwner}::boolean THEN (SELECT display_name FROM owner)
                        WHEN ${has('assignee')}::boolean THEN ${updates.assignee ?? null}::text ELSE assignee END,
        assignee_participant_id = CASE WHEN ${hasOwner}::boolean THEN (SELECT id FROM owner)
                        WHEN ${has('assignee')}::boolean THEN NULL ELSE assignee_participant_id END,
        due_date = CASE WHEN ${has('due_date')}::boolean THEN ${updates.due_date ?? null}::date ELSE due_date END,
        status = CASE WHEN ${has('status')}::boolean THEN ${updates.status ?? null}::text ELSE status END
      FROM ok
      WHERE action_items.id = ${itemId} AND action_items.board_id = ${boardId}
        AND (NOT ${hasOwner}::boolean OR ${ownerId}::text IS NULL OR EXISTS (SELECT 1 FROM owner))
      RETURNING action_items.*
    )
    SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
           (NOT ${hasOwner}::boolean OR ${ownerId}::text IS NULL OR EXISTS (SELECT 1 FROM owner)) AS owner_ok,
           u.*
    FROM (SELECT 1) one LEFT JOIN updated u ON true
  `;
  const outcome = assignOutcome(row as Parameters<typeof assignOutcome>[0]);
  if (outcome === 'phase-changed') return NextResponse.json({ error: PHASE_CHANGED_ERROR }, { status: 409 });
  if (outcome === 'owner-missing') return NextResponse.json({ error: ASSIGNEE_NOT_FOUND_ERROR }, { status: 404 });
  if (outcome === 'item-missing') return ITEM_NOT_FOUND();

  const item = stripFlags(row);
  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-updated', { item });
  return NextResponse.json({ item });
}
