import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { loadBoardActor, guardResponse, requireParticipantOn, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { readJsonObject, isPlainObject } from '@/lib/request-body';
import { validateActionItemDescription, validateActionItemUpdates, INVALID_BODY } from '@/lib/board-validation';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  if (typeof itemId !== 'string' || !UUID_RE.test(itemId) || !isPlainObject(updates)) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }
  const valid = validateActionItemUpdates(updates);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const loaded = await loadBoardActor(request, boardId, null);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('action-item.write', loaded.actor, loaded.state));
  if (denied) return denied;

  if (updates.description !== undefined) {
    await sql`UPDATE action_items SET description = ${updates.description} WHERE id = ${itemId} AND board_id = ${boardId}`;
  }
  if (updates.assignee !== undefined) {
    await sql`UPDATE action_items SET assignee = ${updates.assignee} WHERE id = ${itemId} AND board_id = ${boardId}`;
  }
  if (updates.due_date !== undefined) {
    await sql`UPDATE action_items SET due_date = ${updates.due_date} WHERE id = ${itemId} AND board_id = ${boardId}`;
  }
  if (updates.status !== undefined) {
    await sql`UPDATE action_items SET status = ${updates.status} WHERE id = ${itemId} AND board_id = ${boardId}`;
  }

  const [item] = await sql`SELECT * FROM action_items WHERE id = ${itemId} AND board_id = ${boardId}`;
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
  if (typeof itemId !== 'string' || !UUID_RE.test(itemId)) {
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
