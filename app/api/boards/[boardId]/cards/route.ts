import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { loadBoardActor, guardResponse, requireParticipantOn, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction, reactionsChangeOnlyTouches } from '@/lib/board-guards';
import { publishCard } from '@/lib/board-publish';
import { shapeCard } from '@/lib/board-view';
import { cardPatchActions, firstDenial } from '@/lib/board-write-rules';

function isReactionsShape(v: unknown): boolean {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v).every(
    (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string')
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const limited = await rateLimitOr429(request, 'card-create', 30, 60);
  if (limited) return limited;
  const { boardId } = await params;
  const { id, columnId, text, authorName, authorId, position } = await request.json();

  const loaded = await loadBoardActor(request, boardId, authorId);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('card.create', loaded.actor, loaded.state));
  if (denied) return denied;

  if (typeof text !== 'string' || text.trim().length === 0 || text.length > 2000) {
    return NextResponse.json(
      { error: 'Card text must be 1–2000 characters' },
      { status: 400 }
    );
  }

  // v1 boards keep the client-claimed identity; v2 identity comes from the signed session.
  let cardAuthorId: string | null = authorId ?? null;
  let cardAuthorName: string | null = authorName ?? null;
  if (loaded.board.trust_version === 2) {
    const needsJoin = requireParticipantOn(loaded);
    if (needsJoin) return needsJoin;
    const [p] = await sql`
      SELECT display_name FROM participants
      WHERE id = ${loaded.actor.participantId} AND board_id = ${boardId}
    `;
    cardAuthorId = loaded.actor.participantId;
    cardAuthorName = (p?.display_name as string | undefined) ?? null;
  }

  const [card] = await sql`
    INSERT INTO cards (id, column_id, board_id, text, author_name, author_id, position)
    VALUES (${id}, ${columnId}, ${boardId}, ${text}, ${cardAuthorName}, ${cardAuthorId}, ${position})
    RETURNING *
  `;

  await publishCard(boardId, 'card-created', card as never, loaded.board);

  // The caller gets their own view back (an author sees their own text).
  return NextResponse.json({
    card: shapeCard(card as never, loaded.board, { participantId: loaded.actor.participantId }),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { cardId, updates } = await request.json();
  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Missing updates' }, { status: 400 });
  }

  if (updates.reactions !== undefined && !isReactionsShape(updates.reactions)) {
    return NextResponse.json({ error: 'Invalid reactions' }, { status: 400 });
  }

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();

  const [existing] = await sql`SELECT * FROM cards WHERE id = ${cardId} AND board_id = ${boardId}`;
  if (!existing) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const actions = cardPatchActions(updates);
  const denied = guardResponse(
    firstDenial(actions, loaded.actor, loaded.state, { authorId: existing.author_id })
  );
  if (denied) return denied;

  if (loaded.board.trust_version === 2 && actions.includes('card.react')) {
    const needsJoin = requireParticipantOn(loaded);
    if (needsJoin) return needsJoin;
    if (
      !reactionsChangeOnlyTouches(existing.reactions, updates.reactions, loaded.actor.participantId as string)
    ) {
      return NextResponse.json({ error: 'You can only change your own reactions' }, { status: 403 });
    }
  }

  if (updates.text !== undefined) {
    if (
      typeof updates.text !== 'string' ||
      updates.text.trim().length === 0 ||
      updates.text.length > 2000
    ) {
      return NextResponse.json(
        { error: 'Card text must be 1–2000 characters' },
        { status: 400 }
      );
    }
    await sql`UPDATE cards SET text = ${updates.text} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }
  if (updates.color !== undefined) {
    await sql`UPDATE cards SET color = ${updates.color} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }
  if (updates.column_id !== undefined) {
    await sql`UPDATE cards SET column_id = ${updates.column_id} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }
  if (updates.position !== undefined) {
    await sql`UPDATE cards SET position = ${updates.position} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }
  if (updates.merged_with !== undefined) {
    await sql`UPDATE cards SET merged_with = ${updates.merged_with} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }
  if (updates.reactions !== undefined) {
    await sql`UPDATE cards SET reactions = ${JSON.stringify(updates.reactions)} WHERE id = ${cardId} AND board_id = ${boardId}`;
  }

  const [card] = await sql`SELECT * FROM cards WHERE id = ${cardId} AND board_id = ${boardId}`;

  await publishCard(boardId, 'card-updated', card as never, loaded.board);

  return NextResponse.json({
    card: shapeCard(card as never, loaded.board, { participantId: loaded.actor.participantId }),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { cardId } = await request.json();

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const [existing] = await sql`SELECT author_id FROM cards WHERE id = ${cardId} AND board_id = ${boardId}`;
  const denied = guardResponse(
    checkAction('card.delete', loaded.actor, loaded.state, { authorId: existing?.author_id ?? null })
  );
  if (denied) return denied;

  await sql`DELETE FROM cards WHERE id = ${cardId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('card-deleted', { cardId });

  return NextResponse.json({ ok: true });
}
