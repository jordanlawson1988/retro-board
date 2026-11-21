import { sqlTransaction } from '@/lib/db';
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { loadBoardActor, guardResponse, requireParticipantOn, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { publishVote, publishVoteTally } from '@/lib/board-publish';
import { checkAction } from '@/lib/board-guards';
import { readJsonObject } from '@/lib/request-body';
import { INVALID_BODY } from '@/lib/board-validation';
import { CARD_NOT_FOUND_ERROR, VOTE_LIMIT_REACHED_ERROR, isVoteAction } from '@/lib/constants/votes';
import { GUIDED_MODE, NOT_GUIDED_ERROR, PHASE_CHANGED_ERROR } from '@/lib/constants/phases';
import { OPEN_MAX_VOTES_PER_CARD } from '@/lib/constants/board-settings';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import {
  GROUP_VOTE_ERROR,
  GUIDED_ACTION_REQUIRED_ERROR,
  NO_VOTE_TO_REMOVE_ERROR,
  teamUsedAfter,
  voteLockKey,
  votesPerCardError,
} from '@/lib/votes';


export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const limited = await rateLimitOr429(request, 'vote', 600, 60);
  if (limited) return limited;
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { cardId, voterId: claimedVoterId, voteId, action } = body;
  if (
    typeof cardId !== 'string' ||
    (voteId !== undefined && voteId !== null && typeof voteId !== 'string') ||
    (claimedVoterId !== undefined && claimedVoterId !== null && typeof claimedVoterId !== 'string') ||
    (action !== undefined && !isVoteAction(action))
  ) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }

  const loaded = await loadBoardActor(request, boardId, (claimedVoterId as string | null | undefined) ?? null);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('vote.toggle', loaded.actor, loaded.state));
  if (denied) return denied;

  if (loaded.board.mode === GUIDED_MODE) {
    return guidedVote(loaded, boardId, cardId, action, (voteId as string | null | undefined) || undefined);
  }
  if (action !== undefined) {
    return NextResponse.json({ error: NOT_GUIDED_ERROR }, { status: 409 });
  }

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
      return NextResponse.json({ error: CARD_NOT_FOUND_ERROR }, { status: 404 });
    }
    throw err;
  }

  const [result] = rows;
  if (!result) {
    return NextResponse.json({ error: VOTE_LIMIT_REACHED_ERROR, maxVotes }, { status: 422 });
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

type Loaded = NonNullable<Awaited<ReturnType<typeof loadBoardActor>>>;

/**
 * Guided boards: several votes per card inside a per-card and a per-person limit. One transaction
 * under a per-board lock, so both limits and the team tally see every committed vote. A CTE sees
 * one snapshot, so `mine`, `team` and `cur` read the state before the statement's own change.
 * Only the tally is published: guided votes are secret, so no vote row leaves this route except
 * the caller's own in the response.
 */
async function guidedVote(
  loaded: Loaded,
  boardId: string,
  cardId: string,
  action: unknown,
  voteId: string | undefined
) {
  if (!isVoteAction(action)) {
    return NextResponse.json({ error: GUIDED_ACTION_REQUIRED_ERROR }, { status: 400 });
  }
  const needsJoin = requireParticipantOn(loaded);
  if (needsJoin) return needsJoin;
  // Guided boards are always trust_version 2, so requireParticipantOn above already answered 401
  // when there is no participant.
  const voterId = loaded.actor.participantId as string;

  const lockKey = voteLockKey(boardId);
  // The phase the gate above checked; the statement below must still find the board in it.
  const phase = loaded.board.phase;

  if (action === 'remove') {
    const [, removedRows] = await sqlTransaction((txn) => [
      txn`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`,
      txn`
        WITH ok AS (
          SELECT 1 FROM boards
          WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
        ), cur AS (
          SELECT id, count FROM votes
          WHERE card_id = ${cardId} AND voter_id = ${voterId} AND board_id = ${boardId}
        ), decremented AS (
          UPDATE votes SET count = votes.count - 1 FROM cur
          WHERE votes.id = cur.id AND cur.count > 1 AND EXISTS (SELECT 1 FROM ok)
          RETURNING votes.id
        ), deleted AS (
          DELETE FROM votes USING cur
          WHERE votes.id = cur.id AND cur.count = 1 AND EXISTS (SELECT 1 FROM ok)
          RETURNING votes.id
        ), team AS (
          SELECT COALESCE(SUM(count), 0)::int AS used FROM votes WHERE board_id = ${boardId}
        )
        SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
               cur.id AS vote_id, cur.count AS count_before, team.used AS team_used_before,
               floor(extract(epoch from clock_timestamp()) * 1000)::float8 AS tally_at
        FROM team LEFT JOIN cur ON true
      `,
    ]);
    const row = (removedRows as Record<string, unknown>[])[0];
    if (row && row.board_ok === false) {
      return NextResponse.json({ error: PHASE_CHANGED_ERROR }, { status: 409 });
    }
    if (!row || row.vote_id === null) {
      return NextResponse.json({ error: NO_VOTE_TO_REMOVE_ERROR }, { status: 409 });
    }
    const tally = { used: teamUsedAfter(Number(row.team_used_before), -1), at: Number(row.tally_at) };
    await publishVoteTally(boardId, tally);
    return NextResponse.json({
      action: 'removed',
      voteId: row.vote_id,
      count: Number(row.count_before) - 1,
      tally,
    });
  }

  const newVoteId = voteId || crypto.randomUUID();
  const [, addedRows] = await sqlTransaction((txn) => [
    txn`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`,
    txn`
      WITH card AS (
        SELECT id, merged_with FROM cards WHERE id = ${cardId} AND board_id = ${boardId}
      ), mine AS (
        SELECT COALESCE(SUM(count), 0)::int AS spent,
               COALESCE(SUM(count) FILTER (WHERE card_id = ${cardId}), 0)::int AS on_card
        FROM votes WHERE board_id = ${boardId} AND voter_id = ${voterId}
      ), team AS (
        SELECT COALESCE(SUM(count), 0)::int AS used FROM votes WHERE board_id = ${boardId}
      ), lim AS (
        SELECT COALESCE((settings ->> 'max_votes_per_participant')::int, ${DEFAULT_BOARD_SETTINGS.max_votes_per_participant}::int) AS per_person,
               COALESCE((settings ->> 'max_votes_per_card')::int, ${OPEN_MAX_VOTES_PER_CARD}::int) AS per_card
        FROM boards
        WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
      ), upserted AS (
        INSERT INTO votes (id, card_id, board_id, voter_id, count)
        SELECT ${newVoteId}, ${cardId}, ${boardId}, ${voterId}, 1 FROM card, mine, lim
        WHERE card.merged_with IS NULL AND mine.spent < lim.per_person AND mine.on_card < lim.per_card
        ON CONFLICT (card_id, voter_id) DO UPDATE SET count = votes.count + 1
        RETURNING *
      )
      SELECT EXISTS (SELECT 1 FROM lim) AS board_ok,
             (SELECT COUNT(*) FROM card)::int AS card_found, (SELECT merged_with FROM card) AS card_parent,
             mine.spent, mine.on_card, lim.per_person, lim.per_card, team.used AS team_used_before,
             floor(extract(epoch from clock_timestamp()) * 1000)::float8 AS tally_at,
             u.id, u.card_id, u.board_id, u.voter_id, u.count, u.created_at
      FROM mine CROSS JOIN team LEFT JOIN lim ON true LEFT JOIN upserted u ON true
    `,
  ]);
  const row = (addedRows as Record<string, unknown>[])[0];
  if (row && row.board_ok === false) {
    return NextResponse.json({ error: PHASE_CHANGED_ERROR }, { status: 409 });
  }
  if (!row || Number(row.card_found) === 0) {
    return NextResponse.json({ error: CARD_NOT_FOUND_ERROR }, { status: 404 });
  }
  if (row.id === null) {
    if (row.card_parent) return NextResponse.json({ error: GROUP_VOTE_ERROR }, { status: 409 });
    // The limits come from the statement, read under the lock, not from the earlier load.
    const perPerson = Number(row.per_person);
    const perCard = Number(row.per_card);
    if (Number(row.spent) >= perPerson) {
      return NextResponse.json({ error: VOTE_LIMIT_REACHED_ERROR, maxVotes: perPerson }, { status: 422 });
    }
    return NextResponse.json({ error: votesPerCardError(perCard), maxVotesPerCard: perCard }, { status: 422 });
  }
  const tally = { used: teamUsedAfter(Number(row.team_used_before), 1), at: Number(row.tally_at) };
  await publishVoteTally(boardId, tally);
  return NextResponse.json({
    action: 'added',
    vote: {
      id: row.id,
      card_id: row.card_id,
      board_id: row.board_id,
      voter_id: row.voter_id,
      count: row.count,
      created_at: row.created_at,
    },
    tally,
  });
}
