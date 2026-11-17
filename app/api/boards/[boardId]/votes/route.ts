import { sqlTransaction } from '@/lib/db';
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

  const maxVotes = loaded.state.settings?.max_votes_per_participant;
  const limit = maxVotes && maxVotes > 0 ? maxVotes : null;
  const newVoteId = voteId || crypto.randomUUID();

  // One transaction, one round-trip. The advisory lock serializes a voter's toggles on this
  // board, so the limit count below always sees the votes of toggles that committed before
  // it (a plain statement counts from its own snapshot and concurrent clicks pass together).
  // The statement removes the caller's existing vote on the card; otherwise it inserts one
  // (client-provided id so Ably dedup works) when under the per-voter limit.
  // An unknown card, or one on another board, violates a votes foreign key (23503) -> 404;
  // the insert is attempted for such a card even at the limit so it still answers 404, not 422.
  // Empty result = neither happened = the limit was reached.
  let rows: Record<string, unknown>[];
  try {
    const [, toggled] = await sqlTransaction((txn) => [
      txn`SELECT pg_advisory_xact_lock(hashtext(${boardId + ':' + voterId}))`,
      txn`
        WITH removed AS (
          DELETE FROM votes
          WHERE card_id = ${cardId} AND voter_id = ${voterId} AND board_id = ${boardId}
          RETURNING *
        ), added AS (
          INSERT INTO votes (id, card_id, board_id, voter_id)
          SELECT ${newVoteId}, ${cardId}, ${boardId}, ${voterId}
          WHERE NOT EXISTS (SELECT 1 FROM removed)
            AND (${limit}::int IS NULL
                 OR (SELECT COUNT(*) FROM votes WHERE board_id = ${boardId} AND voter_id = ${voterId}) < ${limit}::int
                 OR NOT EXISTS (SELECT 1 FROM cards WHERE id = ${cardId} AND board_id = ${boardId}))
          RETURNING *
        )
        SELECT 'removed' AS outcome, r.* FROM removed r
        UNION ALL
        SELECT 'added' AS outcome, a.* FROM added a
      `,
    ]);
    rows = toggled as Record<string, unknown>[];
  } catch (err) {
    if (dbErrorCode(err) === '23503') {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    throw err;
  }

  const [result] = rows;
  if (!result) {
    return NextResponse.json({ error: 'Vote limit reached', maxVotes }, { status: 422 });
  }
  const { outcome, ...vote } = result;

  if (outcome === 'removed') {
    await publishVote(boardId, 'vote-removed', { voteId: vote.id, cardId, voterId }, loaded.board);
    return NextResponse.json({ action: 'removed' });
  }

  await publishVote(boardId, 'vote-cast', { vote }, loaded.board);
  return NextResponse.json({ action: 'added', vote });
}

function dbErrorCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
}
