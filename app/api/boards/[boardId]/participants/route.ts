import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { loadBoardActor, guardResponse, requireParticipantOn, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { participantRemovalAction, checkCreatorProtection } from '@/lib/board-write-rules';
import { readJsonObject, isPlainObject } from '@/lib/request-body';
import { validateParticipantUpdates, INVALID_BODY } from '@/lib/board-validation';

/** The participant row, or null. */
async function loadTarget(boardId: string, participantId: string) {
  const [row] = await sql`SELECT id, user_id FROM participants WHERE id = ${participantId} AND board_id = ${boardId}`;
  return row ? { id: row.id as string, user_id: (row.user_id as string | null) ?? null } : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { participantId, updates } = body;
  if (typeof participantId !== 'string' || !isPlainObject(updates)) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }
  const valid = validateParticipantUpdates(updates);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('participant.manage', loaded.actor, loaded.state));
  if (denied) return denied;

  if (updates.is_admin === false) {
    const target = await loadTarget(boardId, participantId);
    if (!target) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    const protectedDenial = checkCreatorProtection({
      change: 'demote',
      target,
      board: loaded.board,
      actorParticipantId: loaded.actor.participantId,
    });
    if (!protectedDenial.ok) return guardResponse(protectedDenial)!;
  }

  // One atomic statement (a no-op write when nothing was provided, which still returns the row).
  const [participant] = await sql`
    UPDATE participants SET
      is_admin = CASE WHEN ${updates.is_admin !== undefined}::boolean THEN ${updates.is_admin ?? null}::boolean ELSE is_admin END
    WHERE id = ${participantId} AND board_id = ${boardId}
    RETURNING *
  `;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-updated', { participant });

  return NextResponse.json({ participant });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { participantId } = body;
  if (typeof participantId !== 'string') return NextResponse.json({ error: INVALID_BODY }, { status: 400 });

  // On v1 the body's participantId is also the claimed identity (state guards only there).
  const loaded = await loadBoardActor(request, boardId, participantId);
  if (!loaded) return BOARD_NOT_FOUND();
  const action = participantRemovalAction(loaded.actor.participantId, participantId ?? null);
  const denied = guardResponse(
    checkAction(action, loaded.actor, loaded.state, { participantId: participantId ?? null })
  );
  if (denied) return denied;

  const target = await loadTarget(boardId, participantId);
  if (target) {
    const protectedDenial = checkCreatorProtection({
      change: 'remove',
      target,
      board: loaded.board,
      // v1 ids come from the request body, so only a signed-in match proves "yourself" there.
      actorParticipantId:
        loaded.board.trust_version === 2
          ? loaded.actor.participantId
          : loaded.actor.userId !== null && loaded.actor.userId === target.user_id
            ? target.id
            : null,
    });
    if (!protectedDenial.ok) return guardResponse(protectedDenial)!;
  }

  await sql`DELETE FROM participants WHERE id = ${participantId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-removed', { participantId });

  return NextResponse.json({ ok: true });
}
