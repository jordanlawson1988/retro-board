import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { isCardSort } from '@/types';
import { loadBoardActor, guardResponse, requireParticipantOn, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { readJsonObject, isPlainObject } from '@/lib/request-body';
import { validateColumnFields, validateClientId, isFiniteNumber, INVALID_BODY } from '@/lib/board-validation';
import { isUniqueViolation } from '@/lib/pg-errors';


export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { id, title, description, color, position } = body;
  const idCheck = validateClientId(id, 'column id');
  if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });
  const fields = validateColumnFields({ title, description, color });
  if (
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


  let column;
  try {
    [column] = await sql`
      INSERT INTO columns (id, board_id, title, description, color, position)
      VALUES (${id}, ${boardId}, ${title}, ${description ?? null}, ${color}, ${position})
      RETURNING *
    `;
  } catch (err) {
    if (isUniqueViolation(err, ['columns_pkey'])) {
      return NextResponse.json({ error: 'Column id already exists' }, { status: 409 });
    }
    throw err;
  }

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


  if (updates.sort_by !== undefined && !isCardSort(updates.sort_by)) {
    return NextResponse.json({ error: 'Invalid sort_by' }, { status: 400 });
  }

  // One atomic statement: provided fields are written, the rest keep their value.
  const has = (k: string) => updates[k] !== undefined;
  const [column] = await sql`
    UPDATE columns SET
      title = CASE WHEN ${has('title')}::boolean THEN ${updates.title ?? null}::text ELSE title END,
      color = CASE WHEN ${has('color')}::boolean THEN ${updates.color ?? null}::text ELSE color END,
      description = CASE WHEN ${has('description')}::boolean THEN ${updates.description ?? null}::text ELSE description END,
      sort_by = CASE WHEN ${has('sort_by')}::boolean THEN ${updates.sort_by ?? null}::text ELSE sort_by END
    WHERE id = ${columnId} AND board_id = ${boardId}
    RETURNING *
  `;

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
