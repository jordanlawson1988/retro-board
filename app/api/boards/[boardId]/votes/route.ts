import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { loadBoardActor, guardResponse, requireParticipantOn, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { publishVote } from '@/lib/board-publish';
import { checkAction } from '@/lib/board-guards';
import { readJsonObject, isPlainObject } from '@/lib/request-body';
import { INVALID_BODY } from '@/lib/board-validation';


export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const limited = await rateLimitOr429(request, 'vote', 600, 60);
  if (limited) return limited;
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { cardId, voterId: claimedVoterId, voteId } = body;
  if (
    typeof cardId !== 'string' ||
    (voteId !== undefined && voteId !== null && typeof voteId !== 'string') ||
    (claimedVoterId !== undefined && claimedVoterId !== null && typeof claimedVoterId !== 'string')
  ) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }

  const loaded = await loadBoardActor(request, boardId, (claimedVoterId as string | null | undefined) ?? null);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('vote.toggle', loaded.actor, loaded.state));
  if (denied) return denied;

  // v2: the voter is the signed-in participant, never the body's claim.
  let voterId = claimedVoterId as string;
  if (loaded.board.trust_version !== 2 && !voterId) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }
  if (loaded.board.trust_version === 2) {
    const needsJoin = requireParticipantOn(loaded);
    if (needsJoin) return needsJoin;
    voterId = loaded.actor.participantId as string;
  }

  // The card must exist on this board before a vote can reference it.
  const [cardOnBoard] = await sql`SELECT 1 FROM cards WHERE id = ${cardId} AND board_id = ${boardId}`;
  if (!cardOnBoard) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  // Check if vote already exists
  const [existingVote] = await sql`
    SELECT * FROM votes WHERE card_id = ${cardId} AND voter_id = ${voterId} AND board_id = ${boardId}
  `;

  if (existingVote) {
    // Remove existing vote
    await sql`DELETE FROM votes WHERE id = ${existingVote.id}`;
    await publishVote(boardId, 'vote-removed', { voteId: existingVote.id, cardId, voterId }, loaded.board);
    return NextResponse.json({ action: 'removed' });
  }

  // Check vote limit
  const settings = loaded.state.settings;
  const maxVotes = settings?.max_votes_per_participant;

  if (maxVotes && maxVotes > 0) {
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM votes WHERE board_id = ${boardId} AND voter_id = ${voterId}
    `;
    if (count >= maxVotes) {
      return NextResponse.json(
        { error: 'Vote limit reached', maxVotes },
        { status: 422 }
      );
    }
  }

  // Insert new vote (use client-provided ID so Ably dedup works)
  const [vote] = await sql`
    INSERT INTO votes (id, card_id, board_id, voter_id)
    VALUES (${voteId || crypto.randomUUID()}, ${cardId}, ${boardId}, ${voterId})
    RETURNING *
  `;

  await publishVote(boardId, 'vote-cast', { vote }, loaded.board);

  return NextResponse.json({ action: 'added', vote });
}
