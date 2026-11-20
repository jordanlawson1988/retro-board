import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/rate-limit';
import { loadBoardActor, guardResponse, BOARD_NOT_FOUND } from '@/lib/board-actor';
import { checkAction } from '@/lib/board-guards';
import { readJsonObject } from '@/lib/request-body';
import { INVALID_BODY } from '@/lib/board-validation';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import { DEFAULT_PHASE_CONFIG, isPhaseId, type PhaseConfig, type PhaseId } from '@/lib/constants/phases';
import {
  phaseSettings,
  resolvePhaseMove,
  validateDeadline,
  type PhaseChangedPayload,
  type PhaseTarget,
} from '@/lib/phases';
import type { BoardSettings } from '@/types';

const PHASE_CHANGED = 'The phase already changed';

function isPhaseTarget(v: unknown): v is PhaseTarget {
  return v === 'next' || v === 'back' || isPhaseId(v);
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// Moves a guided board between phases, or sets/clears its deadline. Facilitator only.
// Two statements in total: the context query (loadBoardActor) and one UPDATE ... RETURNING.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const limited = await rateLimitOr429(request, 'phase', 60, 60);
  if (limited) return limited;

  const { boardId } = await params;
  const body = await readJsonObject(request);
  if (!body) return fail(INVALID_BODY, 400);
  const { action } = body;
  if (action !== 'move' && action !== 'set-deadline') return fail(INVALID_BODY, 400);

  // Validate everything before touching the database.
  let from: PhaseId | null = null;
  let to: PhaseTarget | null = null;
  let deadline: string | null = null;
  if (action === 'move') {
    if (!isPhaseId(body.from) || !isPhaseTarget(body.to)) return fail('Invalid phase', 400);
    from = body.from;
    to = body.to;
  } else {
    const valid = validateDeadline(body.deadline, Date.now());
    if (!valid.ok) return fail(valid.error, 400);
    deadline = valid.value;
  }

  const loaded = await loadBoardActor(request, boardId);
  if (!loaded) return BOARD_NOT_FOUND();
  const denied = guardResponse(checkAction('board.settings', loaded.actor, loaded.state));
  if (denied) return denied;
  if (loaded.board.mode !== 'guided') return fail('This board is not in guided mode', 409);

  let row;
  if (action === 'move') {
    if (from !== loaded.board.phase) return fail(PHASE_CHANGED, 409);
    const move = resolvePhaseMove(from as PhaseId, to as PhaseTarget);
    if (!move.ok) return fail(move.error, 409);
    // Conditional on the phase the request named, so two facilitators cannot both win.
    [row] = await sql`
      UPDATE boards SET phase = ${move.phase},
        settings = settings || ${JSON.stringify(phaseSettings(move.phase))}::jsonb,
        phase_config = phase_config || '{"deadline":null}'::jsonb
      WHERE id = ${boardId} AND mode = 'guided' AND phase = ${from}
        AND archived_at IS NULL AND deleted_at IS NULL
      RETURNING phase, settings, phase_config
    `;
  } else {
    [row] = await sql`
      UPDATE boards SET phase_config = phase_config || ${JSON.stringify({ deadline })}::jsonb
      WHERE id = ${boardId} AND mode = 'guided'
        AND archived_at IS NULL AND deleted_at IS NULL
      RETURNING phase, settings, phase_config
    `;
  }
  if (!row) return fail(PHASE_CHANGED, 409);

  const phase = row.phase as PhaseId;
  const settings = { ...DEFAULT_BOARD_SETTINGS, ...(row.settings as Partial<BoardSettings>) } as BoardSettings;
  const phaseConfig: PhaseConfig = { ...DEFAULT_PHASE_CONFIG, ...(row.phase_config as Partial<PhaseConfig>) };

  const payload: PhaseChangedPayload = action === 'move'
    ? { phase, settings, phaseConfig, refetch: true }
    : { phase, settings, phaseConfig };
  const { ablyServer } = await import('@/lib/ably-server');
  await ablyServer.channels.get(`retro-board:${boardId}`).publish('phase-changed', payload);

  return NextResponse.json({ ok: true, phase, settings, phaseConfig });
}
