import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { loadBoardActor, guardResponse, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { readJsonObject } from '@/lib/request-body';
import { INVALID_BODY } from '@/lib/board-validation';
import { publishCard } from '@/lib/board-publish';
import { shapeCard } from '@/lib/board-view';
import { isGroupAction } from '@/lib/constants/groups';
import { GUIDED_MODE, NOT_GUIDED_ERROR, PHASE_CHANGED_ERROR } from '@/lib/constants/phases';
import {
  CARD_NOT_FOUND_ERROR,
  NOT_A_GROUP_ERROR,
  groupResetOutcome,
  groupTitleOutcome,
  validateGroupTitle,
} from '@/lib/groups';
import type { Card } from '@/types';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// Titles a group or resets all grouping on a guided board. Identity comes from the signed
// participant cookie only. Two statements each: the actor load and one conditional write.
// Votes are never read or written here.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const limited = await rateLimitOr429(request, 'groups', 120, 60);
  if (limited) return limited;

  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return fail(INVALID_BODY, 400);
  const { action } = body;
  if (!isGroupAction(action)) return fail(INVALID_BODY, 400);

  // Validate everything before touching the database.
  let cardId = '';
  let title: string | null = null;
  if (action === 'set-title') {
    if (typeof body.cardId !== 'string' || body.cardId === '') return fail(INVALID_BODY, 400);
    cardId = body.cardId;
    const valid = validateGroupTitle(body.title);
    if (!valid.ok) return fail(valid.error, 400);
    title = valid.value;
  }

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(
    checkAction(action === 'set-title' ? 'group.title' : 'group.reset', loaded.actor, loaded.state)
  );
  if (denied) return denied;
  // The guard allows these actions on an open board (its phase is null); this keeps open boards unchanged.
  if (loaded.board.mode !== GUIDED_MODE) return fail(NOT_GUIDED_ERROR, 409);
  const phase = loaded.board.phase;

  if (action === 'set-title') {
    // Conditional on the phase the load saw, and on the target being a lead card.
    const rows = await sql`
      WITH target AS (
        SELECT c.id,
          (c.merged_with IS NULL AND EXISTS (
            SELECT 1 FROM cards ch WHERE ch.board_id = c.board_id AND ch.merged_with = c.id
          )) AS is_lead
        FROM cards c WHERE c.id = ${cardId} AND c.board_id = ${boardId}
      ), updated AS (
        UPDATE cards SET group_title = ${title} FROM target
        WHERE cards.id = target.id AND target.is_lead
          AND EXISTS (
            SELECT 1 FROM boards
            WHERE id = ${boardId} AND phase = ${phase}
              AND archived_at IS NULL AND deleted_at IS NULL
          )
        RETURNING cards.*
      )
      SELECT t.is_lead AS target_is_lead, u.* FROM target t LEFT JOIN updated u ON u.id = t.id
    `;
    const outcome = groupTitleOutcome(rows as { target_is_lead: boolean; id: string | null }[]);
    if (outcome === 'card-missing') return fail(CARD_NOT_FOUND_ERROR, 404);
    if (outcome === 'not-a-group') return fail(NOT_A_GROUP_ERROR, 409);
    if (outcome === 'phase-changed') return fail(PHASE_CHANGED_ERROR, 409);

    // Drop the join flag; what remains is the card row.
    const { target_is_lead: _lead, ...row } = rows[0];
    void _lead;
    const updatedCard = row as unknown as Card;
    // The channel gets the public view (publishCard shapes it); the caller gets their own view.
    await publishCard(boardId, 'card-updated', updatedCard, loaded.board);
    return NextResponse.json({
      card: shapeCard(updatedCard, loaded.board, { participantId: loaded.actor.participantId }),
    });
  }

  // reset: one statement, conditional on the phase the load saw.
  const [result] = await sql`
    WITH ok AS (
      SELECT 1 FROM boards
      WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
    ), cleared AS (
      UPDATE cards SET merged_with = NULL, group_title = NULL
      WHERE board_id = ${boardId} AND (merged_with IS NOT NULL OR group_title IS NOT NULL)
        AND EXISTS (SELECT 1 FROM ok)
      RETURNING id
    )
    SELECT EXISTS (SELECT 1 FROM ok) AS board_ok, (SELECT COUNT(*) FROM cleared)::int AS cleared
  `;
  const stats = result as { board_ok: boolean; cleared: number };
  if (groupResetOutcome(stats) === 'phase-changed') return fail(PHASE_CHANGED_ERROR, 409);

  if (stats.cleared > 0) {
    const { ablyServer } = await import('@/lib/ably-server');
    await ablyServer.channels
      .get(`retro-board:${boardId}`)
      .publish('grouping-reset', { phase, refetch: true });
  }
  return NextResponse.json({ ok: true, cleared: stats.cleared });
}
