import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { loadBoardActor, guardResponse, requireParticipantOn, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { participantRemovalAction } from '@/lib/board-write-rules';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { participantId, updates } = await request.json();

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('participant.manage', loaded.actor, loaded.state));
  if (denied) return denied;

  if (updates.is_admin !== undefined) {
    await sql`UPDATE participants SET is_admin = ${updates.is_admin} WHERE id = ${participantId} AND board_id = ${boardId}`;
  }

  const [participant] = await sql`SELECT * FROM participants WHERE id = ${participantId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-updated', { participant });

  return NextResponse.json({ participant });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { participantId } = await request.json();

  // On v1 the body's participantId is also the claimed identity (state guards only there).
  const loaded = await loadBoardActor(request, boardId, participantId);
  if (!loaded) return BOARD_NOT_FOUND();
  const action = participantRemovalAction(loaded.actor.participantId, participantId ?? null);
  const denied = guardResponse(
    checkAction(action, loaded.actor, loaded.state, { participantId: participantId ?? null })
  );
  if (denied) return denied;

  await sql`DELETE FROM participants WHERE id = ${participantId} AND board_id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-removed', { participantId });

  return NextResponse.json({ ok: true });
}
