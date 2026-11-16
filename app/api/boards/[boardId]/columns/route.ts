import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { isCardSort } from '@/types';
import { loadBoardActor, guardResponse, requireParticipantOn, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { readJsonObject, isPlainObject } from '@/lib/request-body';
import { validateColumnFields, isFiniteNumber, INVALID_BODY } from '@/lib/board-validation';


export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { id, title, description, color, position } = body;
  const fields = validateColumnFields({ title, description, color });
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof color !== 'string' ||
    !isFiniteNumber(position) ||
    !fields.ok
  ) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }
  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('column.write', loaded.actor, loaded.state));
  if (denied) return denied;


  const [column] = await sql`
    INSERT INTO columns (id, board_id, title, description, color, position)
    VALUES (${id}, ${boardId}, ${title}, ${description ?? null}, ${color}, ${position})
    RETURNING *
  `;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('column-created', { column });

  return NextResponse.json({ column });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { columnId, updates } = body;
  if (typeof columnId !== 'string' || !isPlainObject(updates)) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }
  const fields = validateColumnFields(updates);
  if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 });
  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('column.write', loaded.actor, loaded.state));
  if (denied) return denied;


  if (updates.title !== undefined) {
    await sql`UPDATE columns SET title = ${updates.title} WHERE id = ${columnId} AND board_id = ${boardId}`;
  }
  if (updates.color !== undefined) {
    await sql`UPDATE columns SET color = ${updates.color} WHERE id = ${columnId} AND board_id = ${boardId}`;
  }
  if (updates.description !== undefined) {
    await sql`UPDATE columns SET description = ${updates.description} WHERE id = ${columnId} AND board_id = ${boardId}`;
  }
  if (updates.sort_by !== undefined) {
    if (!isCardSort(updates.sort_by)) {
      return NextResponse.json({ error: 'Invalid sort_by' }, { status: 400 });
    }
    await sql`UPDATE columns SET sort_by = ${updates.sort_by} WHERE id = ${columnId} AND board_id = ${boardId}`;
  }

  const [column] = await sql`SELECT * FROM columns WHERE id = ${columnId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('column-updated', { column });

  return NextResponse.json({ column });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { columnId } = body;
  if (typeof columnId !== 'string') return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('column.write', loaded.actor, loaded.state));
  if (denied) return denied;


  await sql`DELETE FROM columns WHERE id = ${columnId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('column-deleted', { columnId });

  return NextResponse.json({ ok: true });
}
