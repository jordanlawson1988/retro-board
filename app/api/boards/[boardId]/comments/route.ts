import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { loadBoardActor, guardResponse, requireParticipantOn, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { readJsonObject } from '@/lib/request-body';
import { INVALID_BODY, isUuid, validateClientId } from '@/lib/board-validation';
import { publishComment, publishCommentDeleted } from '@/lib/board-publish';
import { PUBLIC_VIEWER, shapeComment } from '@/lib/board-view';
import {
  createCommentOutcome,
  deleteCommentOutcome,
  editCommentOutcome,
  validateCommentBody,
} from '@/lib/comments';
import {
  COMMENTS_PER_BOARD_MAX,
  COMMENT_CREATED,
  COMMENT_DELETE_DENIED_ERROR,
  COMMENT_GONE_ERROR,
  COMMENT_LIMIT_ERROR,
  COMMENT_NOT_FOUND_ERROR,
  COMMENT_NOT_YOURS_ERROR,
  COMMENT_TARGET_ERROR,
  COMMENT_UPDATED,
  REPLY_PARENT_ERROR,
} from '@/lib/constants/comments';
import { CARD_NOT_FOUND_ERROR } from '@/lib/constants/votes';
import { GUIDED_MODE, NOT_GUIDED_ERROR, PHASE_CHANGED_ERROR } from '@/lib/constants/phases';
import type { Comment } from '@/types';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** The columns the statements add beside the comment row. They are decided on and then dropped. */
const FLAG_COLUMNS = [
  'board_ok',
  'card_found',
  'card_parent',
  'parent_ok',
  'comment_count',
  'found',
  'is_deleted',
  'is_author',
  'already_deleted',
  'permitted',
  'removed_ids',
] as const;

/** The stored comment row, without the flag columns. Never sent as is: it goes through shapeComment or the publish helpers. */
function storedComment(row: Record<string, unknown>): Comment {
  const copy = { ...row };
  for (const key of FLAG_COLUMNS) delete copy[key];
  return copy as unknown as Comment;
}

type RouteContext = { params: Promise<{ boardId: string }> };

// Comments on a guided board's topics, written in Discuss. Identity comes from the signed
// participant cookie only. Two statements each: the actor load and one conditional write that
// reads the board row FOR SHARE, so a write cannot commit after a phase move or completion.
// A raw comment row never leaves this file: the caller gets shapeComment for their own view and
// the channel gets the publish helpers, which shape for the public.

export async function POST(request: Request, { params }: RouteContext) {
  const limited = await rateLimitOr429(request, 'comment', 300, 60);
  if (limited) return limited;

  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return fail(INVALID_BODY, 400);

  // Validate everything before touching the database.
  if (!validateClientId(body.cardId).ok) return fail(INVALID_BODY, 400);
  const cardId = body.cardId as string;
  if (body.parentId !== undefined && body.parentId !== null && !isUuid(body.parentId)) return fail(INVALID_BODY, 400);
  const parentId = typeof body.parentId === 'string' ? body.parentId : null;
  if (body.anonymous !== undefined && typeof body.anonymous !== 'boolean') return fail(INVALID_BODY, 400);
  const anonymous = body.anonymous === true;
  const text = validateCommentBody(body.body);
  if (!text.ok) return fail(text.error, 400);

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('comment.create', loaded.actor, loaded.state));
  if (denied) return denied;
  if (loaded.board.mode !== GUIDED_MODE) return fail(NOT_GUIDED_ERROR, 409);
  const needsJoin = requireParticipantOn(loaded);
  if (needsJoin) return needsJoin;
  const phase = loaded.board.phase;
  const actorId = loaded.actor.participantId;

  const [row] = await sql`
    WITH ok AS (
      SELECT 1 AS one FROM boards
      WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
      FOR SHARE
    ), target AS (
      SELECT id, merged_with FROM cards WHERE id = ${cardId} AND board_id = ${boardId}
    ), parent AS (
      SELECT id, card_id, parent_id, deleted_at FROM comments WHERE id = ${parentId}::uuid AND board_id = ${boardId}
    ), room AS (
      SELECT COUNT(*)::int AS n FROM comments WHERE board_id = ${boardId}
    ), author AS (
      SELECT display_name FROM participants WHERE id = ${actorId} AND board_id = ${boardId}
    ), inserted AS (
      INSERT INTO comments (board_id, card_id, parent_id, author_participant_id, author_name, is_anonymous, body)
      SELECT ${boardId}, target.id, ${parentId}::uuid, ${actorId}, author.display_name, ${anonymous}, ${text.value}
      FROM ok, target, room, author
      WHERE room.n < ${COMMENTS_PER_BOARD_MAX}
        AND CASE WHEN ${parentId}::uuid IS NULL THEN target.merged_with IS NULL
                 ELSE EXISTS (SELECT 1 FROM parent WHERE parent.card_id = target.id
                              AND parent.parent_id IS NULL AND parent.deleted_at IS NULL) END
      RETURNING *
    )
    SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
           (SELECT COUNT(*) FROM target)::int AS card_found,
           (SELECT merged_with FROM target) AS card_parent,
           (${parentId}::uuid IS NULL OR EXISTS (SELECT 1 FROM parent WHERE parent.card_id = ${cardId}
              AND parent.parent_id IS NULL AND parent.deleted_at IS NULL)) AS parent_ok,
           (SELECT n FROM room) AS comment_count,
           i.*
    FROM (SELECT 1) one LEFT JOIN inserted i ON true
  `;
  const outcome = createCommentOutcome(row as Parameters<typeof createCommentOutcome>[0], parentId !== null, COMMENTS_PER_BOARD_MAX);
  if (outcome === 'phase-changed') return fail(PHASE_CHANGED_ERROR, 409);
  if (outcome === 'card-missing') return fail(CARD_NOT_FOUND_ERROR, 404);
  if (outcome === 'not-a-topic') return fail(COMMENT_TARGET_ERROR, 409);
  if (outcome === 'bad-parent') return fail(REPLY_PARENT_ERROR, 409);
  if (outcome === 'limit') return fail(COMMENT_LIMIT_ERROR, 409);

  const stored = storedComment(row);
  await publishComment(boardId, COMMENT_CREATED, stored);
  return NextResponse.json({ comment: shapeComment(stored, { participantId: actorId }) });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const limited = await rateLimitOr429(request, 'comment', 300, 60);
  if (limited) return limited;

  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return fail(INVALID_BODY, 400);
  if (!isUuid(body.commentId)) return fail(INVALID_BODY, 400);
  const commentId = body.commentId;
  const text = validateCommentBody(body.body);
  if (!text.ok) return fail(text.error, 400);

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('comment.edit', loaded.actor, loaded.state));
  if (denied) return denied;
  if (loaded.board.mode !== GUIDED_MODE) return fail(NOT_GUIDED_ERROR, 409);
  const needsJoin = requireParticipantOn(loaded);
  if (needsJoin) return needsJoin;
  const phase = loaded.board.phase;
  const actorId = loaded.actor.participantId;

  // Only the author edits; the anonymous flag is never touched.
  const [row] = await sql`
    WITH ok AS (
      SELECT 1 AS one FROM boards
      WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
      FOR SHARE
    ), cur AS (
      SELECT id, author_participant_id, deleted_at FROM comments WHERE id = ${commentId} AND board_id = ${boardId}
    ), updated AS (
      UPDATE comments SET body = ${text.value}, edited_at = now()
      FROM cur, ok
      WHERE comments.id = cur.id AND cur.deleted_at IS NULL AND cur.author_participant_id = ${actorId}
      RETURNING comments.*
    )
    SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
           (SELECT COUNT(*) FROM cur)::int AS found,
           (SELECT deleted_at IS NOT NULL FROM cur) AS is_deleted,
           (SELECT author_participant_id = ${actorId} FROM cur) AS is_author,
           u.*
    FROM (SELECT 1) one LEFT JOIN updated u ON true
  `;
  const outcome = editCommentOutcome(row as Parameters<typeof editCommentOutcome>[0]);
  if (outcome === 'phase-changed') return fail(PHASE_CHANGED_ERROR, 409);
  if (outcome === 'missing') return fail(COMMENT_NOT_FOUND_ERROR, 404);
  if (outcome === 'gone') return fail(COMMENT_GONE_ERROR, 409);
  if (outcome === 'not-yours') return fail(COMMENT_NOT_YOURS_ERROR, 403);

  const stored = storedComment(row);
  await publishComment(boardId, COMMENT_UPDATED, stored);
  return NextResponse.json({ comment: shapeComment(stored, { participantId: actorId }) });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const limited = await rateLimitOr429(request, 'comment', 300, 60);
  if (limited) return limited;

  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return fail(INVALID_BODY, 400);
  if (!isUuid(body.commentId)) return fail(INVALID_BODY, 400);
  const commentId = body.commentId;

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  // A facilitator without a participant row may delete, so there is no requireParticipantOn here.
  const denied = guardResponse(checkAction('comment.delete', loaded.actor, loaded.state));
  if (denied) return denied;
  if (loaded.board.mode !== GUIDED_MODE) return fail(NOT_GUIDED_ERROR, 409);
  const phase = loaded.board.phase;
  const actorId = loaded.actor.participantId;
  const isFacilitator = loaded.actor.isFacilitator;

  // A top-level comment with replies becomes a tombstone; anything else is deleted, and the last
  // reply under a tombstone takes the tombstone with it. Every sub-statement sees the snapshot from
  // before the statement, so `orphan` excludes the reply `removed` is deleting.
  const [row] = await sql`
    WITH ok AS (
      SELECT 1 AS one FROM boards
      WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
      FOR SHARE
    ), cur AS (
      SELECT id, parent_id, author_participant_id, deleted_at FROM comments WHERE id = ${commentId} AND board_id = ${boardId}
    ), allowed AS (
      SELECT cur.* FROM cur, ok
      WHERE cur.deleted_at IS NULL AND (${isFacilitator}::boolean OR cur.author_participant_id = ${actorId}::text)
    ), has_replies AS (
      SELECT EXISTS (SELECT 1 FROM comments r JOIN allowed a ON r.parent_id = a.id) AS yes
    ), tombstoned AS (
      UPDATE comments SET body = '', deleted_at = now()
      FROM allowed, has_replies
      WHERE comments.id = allowed.id AND has_replies.yes
      RETURNING comments.*
    ), removed AS (
      DELETE FROM comments USING allowed, has_replies
      WHERE comments.id = allowed.id AND NOT has_replies.yes
      RETURNING comments.id, comments.parent_id
    ), orphan AS (
      DELETE FROM comments p USING removed
      WHERE p.id = removed.parent_id AND p.deleted_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM comments r WHERE r.parent_id = p.id AND r.id <> removed.id)
      RETURNING p.id
    )
    SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
           (SELECT COUNT(*) FROM cur)::int AS found,
           (SELECT deleted_at IS NOT NULL FROM cur) AS already_deleted,
           EXISTS (SELECT 1 FROM allowed) AS permitted,
           COALESCE((SELECT array_agg(x.id::text) FROM (SELECT id FROM removed UNION ALL SELECT id FROM orphan) x), '{}') AS removed_ids,
           t.*
    FROM (SELECT 1) one LEFT JOIN tombstoned t ON true
  `;
  const outcome = deleteCommentOutcome(row as Parameters<typeof deleteCommentOutcome>[0]);
  if (outcome === 'phase-changed') return fail(PHASE_CHANGED_ERROR, 409);
  if (outcome === 'missing') return fail(COMMENT_NOT_FOUND_ERROR, 404);
  if (outcome === 'gone') return fail(COMMENT_GONE_ERROR, 409);
  if (outcome === 'denied') return fail(COMMENT_DELETE_DENIED_ERROR, 403);

  const ids = ((row as { removed_ids: string[] | null }).removed_ids ?? []).map(String);
  const stored = row.id === null || row.id === undefined ? null : storedComment(row);
  await publishCommentDeleted(boardId, ids, stored);
  // The tombstone goes out shaped for the public: a deleted comment carries no body and no author.
  return NextResponse.json({ ids, tombstone: stored === null ? null : shapeComment(stored, PUBLIC_VIEWER) });
}
