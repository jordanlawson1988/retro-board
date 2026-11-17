import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { loadBoardActor, guardResponse, requireParticipantOn, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { publishCard } from '@/lib/board-publish';
import { shapeCard } from '@/lib/board-view';
import type { CardReactions } from '@/types';
import { cardPatchActions, firstDenial } from '@/lib/board-write-rules';

function isReactionsShape(v: unknown): boolean {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v).every(
    (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string')
  );
}
import { readJsonObject, isPlainObject } from '@/lib/request-body';
import { validateCardUpdates, isFiniteNumber, INVALID_BODY } from '@/lib/board-validation';

const REACTIONS_FOREIGN = 'You can only change your own reactions';
const AUTHOR_ONLY = 'Only the author can change this card';
const COLUMN_FKS = ['cards_column_id_board_id_fkey', 'cards_column_id_fkey'];
const MERGE_FKS = ['cards_merged_with_board_id_fkey', 'cards_merged_with_fkey'];

/** A Postgres foreign-key violation (23503) on one of the named constraints (NeonDbError.code / .constraint). */
function isFkViolation(err: unknown, constraints: string[]): boolean {
  const e = err as { code?: string; constraint?: string } | null;
  return !!e && e.code === '23503' && typeof e.constraint === 'string' && constraints.includes(e.constraint);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const limited = await rateLimitOr429(request, 'card-create', 240, 60);
  if (limited) return limited;
  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { id, columnId, text, authorName, authorId, position } = body;
  if (typeof id !== 'string' || typeof columnId !== 'string' || !isFiniteNumber(position)) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }
  if (
    (authorId !== undefined && authorId !== null && typeof authorId !== 'string') ||
    (authorName !== undefined && authorName !== null && typeof authorName !== 'string')
  ) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }

  const loaded = await loadBoardActor(request, boardId, authorId ?? null);
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
  // The column-on-this-board check is the composite FK cards_column_id_board_id_fkey (migration 012).
  let cardAuthorId: string | null = authorId ?? null;
  let cardAuthorName: string | null = authorName ?? null;
  if (loaded.board.trust_version === 2) {
    const needsJoin = requireParticipantOn(loaded);
    if (needsJoin) return needsJoin;
    cardAuthorId = loaded.actor.participantId;
    cardAuthorName = loaded.participant?.display_name ?? null;
  }

  let card;
  try {
    [card] = await sql`
      INSERT INTO cards (id, column_id, board_id, text, author_name, author_id, position)
      VALUES (${id}, ${columnId}, ${boardId}, ${text}, ${cardAuthorName}, ${cardAuthorId}, ${position})
      RETURNING *
    `;
  } catch (err) {
    if (isFkViolation(err, COLUMN_FKS)) return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    throw err;
  }

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
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { cardId, updates } = body;
  if (typeof cardId !== 'string' || !isPlainObject(updates)) {
    return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  }

  // Validate every field before any write so a bad field cannot leave a partial update.
  const valid = validateCardUpdates(updates);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });

  if (updates.reactions !== undefined && !isReactionsShape(updates.reactions)) {
    return NextResponse.json({ error: 'Invalid reactions' }, { status: 400 });
  }

  // No recognised field means nothing to write; without this no guard would run at all.
  const actions = cardPatchActions(updates);
  if (actions.length === 0) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();

  const { actor } = loaded;
  // The author rule needs the card's author, which the UPDATE checks itself (author_id = actor),
  // so the guards here assume the actor owns the card and the real check is in the statement.
  const denied = guardResponse(
    firstDenial(actions, actor, loaded.state, { authorId: actor.participantId })
  );
  if (denied) return denied;

  const isV2 = loaded.board.trust_version === 2;
  // v2 non-facilitators may only edit text/colour on cards they authored.
  const authorOnly: string | null =
    isV2 && actions.includes('card.edit') && !actor.isFacilitator ? actor.participantId : null;

  // Reactions: apply only the ACTOR's change to the row's current value, inside the UPDATE.
  // Other ids in the submitted map are ignored (never written), so a stale map is not an error.
  // v1 requests carry no actor id (the client sends none), so they keep the replace behaviour.
  let reactionsMode: 'none' | 'merge' | 'replace' = 'none';
  let wanted: string[] = [];
  const submitted: CardReactions = updates.reactions !== undefined ? (updates.reactions as CardReactions) : {};
  if (updates.reactions !== undefined) {
    if (isV2 && actions.includes('card.react')) {
      const needsJoin = requireParticipantOn(loaded);
      if (needsJoin) return needsJoin;
      // Duplicate ids in one emoji list are malformed.
      for (const ids of Object.values(submitted)) {
        if (new Set(ids).size !== ids.length) {
          return NextResponse.json({ error: REACTIONS_FOREIGN }, { status: 403 });
        }
      }
    }
    if (actor.participantId !== null) {
      reactionsMode = 'merge';
      wanted = Object.entries(submitted)
        .filter(([, ids]) => ids.includes(actor.participantId as string))
        .map(([emoji]) => emoji);
    } else {
      reactionsMode = 'replace';
    }
  }
  const actorId = actor.participantId;
  const wantedJson = JSON.stringify(wanted);
  const has = (k: string) => updates[k] !== undefined;

  let card;
  try {
    [card] = await sql`
      UPDATE cards SET
        text = CASE WHEN ${has('text')}::boolean THEN ${(updates.text as string | undefined) ?? null}::text ELSE text END,
        color = CASE WHEN ${has('color')}::boolean THEN ${(updates.color as string | null | undefined) ?? null}::text ELSE color END,
        column_id = CASE WHEN ${has('column_id')}::boolean THEN ${(updates.column_id as string | undefined) ?? null}::text ELSE column_id END,
        position = CASE WHEN ${has('position')}::boolean THEN ${(updates.position as number | undefined) ?? null}::integer ELSE position END,
        merged_with = CASE WHEN ${has('merged_with')}::boolean THEN ${(updates.merged_with as string | null | undefined) ?? null}::text ELSE merged_with END,
        reactions = CASE ${reactionsMode}::text
          WHEN 'replace' THEN ${JSON.stringify(submitted)}::jsonb
          WHEN 'merge' THEN COALESCE((
            SELECT jsonb_object_agg(k.emoji, k.ids) FROM (
              SELECT u.emoji, (
                SELECT COALESCE(jsonb_agg(x.id ORDER BY x.ord), '[]'::jsonb) FROM (
                  SELECT t.id, t.ord
                  FROM jsonb_array_elements_text(
                    CASE WHEN jsonb_typeof(cards.reactions -> u.emoji) = 'array' THEN cards.reactions -> u.emoji ELSE '[]'::jsonb END
                  ) WITH ORDINALITY AS t(id, ord)
                  WHERE t.id <> ${actorId}::text OR jsonb_exists(${wantedJson}::jsonb, u.emoji)
                  UNION ALL
                  SELECT ${actorId}::text, 9223372036854775807::bigint
                  WHERE jsonb_exists(${wantedJson}::jsonb, u.emoji)
                    AND NOT jsonb_exists(
                      CASE WHEN jsonb_typeof(cards.reactions -> u.emoji) = 'array' THEN cards.reactions -> u.emoji ELSE '[]'::jsonb END,
                      ${actorId}::text)
                ) x
              ) AS ids
              FROM (
                SELECT jsonb_object_keys(cards.reactions) AS emoji
                UNION
                SELECT jsonb_array_elements_text(${wantedJson}::jsonb)
              ) u
            ) k
            WHERE jsonb_array_length(k.ids) > 0
          ), '{}'::jsonb)
          ELSE reactions END
      WHERE id = ${cardId} AND board_id = ${boardId}
        AND (${authorOnly}::text IS NULL OR author_id = ${authorOnly}::text)
      RETURNING *
    `;
  } catch (err) {
    if (isFkViolation(err, COLUMN_FKS)) return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    if (isFkViolation(err, MERGE_FKS)) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    throw err;
  }

  if (!card) {
    // No row matched: the card is missing, or the author condition refused it.
    if (authorOnly === null) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    const [existing] = await sql`SELECT author_id FROM cards WHERE id = ${cardId} AND board_id = ${boardId}`;
    if (!existing) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    return NextResponse.json({ error: AUTHOR_ONLY }, { status: 403 });
  }

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
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: INVALID_BODY }, { status: 400 });
  const { cardId } = body;
  if (typeof cardId !== 'string') return NextResponse.json({ error: INVALID_BODY }, { status: 400 });

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const { actor } = loaded;
  // State and identity rules first, assuming the actor owns the card; the author rule is
  // enforced by the DELETE itself (author_id = actor) for v2 non-facilitators.
  const denied = guardResponse(checkAction('card.delete', actor, loaded.state, { authorId: actor.participantId }));
  if (denied) return denied;

  const authorOnly = loaded.board.trust_version === 2 && !actor.isFacilitator ? actor.participantId : null;
  const deleted = await sql`
    DELETE FROM cards
    WHERE id = ${cardId} AND board_id = ${boardId}
      AND (${authorOnly}::text IS NULL OR author_id = ${authorOnly}::text)
    RETURNING id
  `;
  if (authorOnly !== null && deleted.length === 0) {
    // A missing card and someone else's card both answered 403 before.
    return NextResponse.json({ error: AUTHOR_ONLY }, { status: 403 });
  }

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('card-deleted', { cardId });

  return NextResponse.json({ ok: true });
}
