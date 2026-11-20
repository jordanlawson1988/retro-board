import type { BoardAction } from '@/lib/constants/board-actions';
import {
  DEADLINE_MAX_DAYS,
  DEFAULT_PHASE_CONFIG,
  FINAL_PHASE,
  PHASES,
  PHASE_IDS,
  isPhaseId,
  type BoardMode,
  type PhaseConfig,
  type PhaseId,
} from '@/lib/constants/phases';
import type { BoardSettings } from '@/types';

export type PhaseTarget = 'next' | 'back' | PhaseId;

const COMPLETE_ERROR = 'Complete the retro to finish';

export function resolvePhaseMove(
  current: PhaseId,
  to: PhaseTarget,
): { ok: true; phase: PhaseId } | { ok: false; error: string } {
  if (current === FINAL_PHASE) return { ok: false, error: 'The retro is completed' };
  const index = PHASE_IDS.indexOf(current);
  let target: PhaseId;
  if (to === 'next') {
    target = PHASE_IDS[index + 1];
  } else if (to === 'back') {
    if (index === 0) return { ok: false, error: 'Already at the first phase' };
    target = PHASE_IDS[index - 1];
  } else {
    if (to === current) return { ok: false, error: 'Already in that phase' };
    target = to;
  }
  if (target === FINAL_PHASE) return { ok: false, error: COMPLETE_ERROR };
  return { ok: true, phase: target };
}

export const PHASE_OWNED_SETTINGS = [
  'card_visibility',
  'voting_enabled',
  'secret_voting',
  'card_creation_disabled',
  'board_locked',
] as const;

export function phaseSettings(
  phase: PhaseId,
): Pick<BoardSettings, (typeof PHASE_OWNED_SETTINGS)[number] | 'timer'> {
  const { profile } = PHASES[phase];
  return {
    card_visibility: profile.canSeeOthersText ? 'visible' : 'hidden',
    voting_enabled: profile.canVote,
    secret_voting: !profile.canSeeTotals,
    card_creation_disabled: !profile.canWriteCards,
    board_locked: phase === FINAL_PHASE,
    timer: { duration: 0, remaining: 0, status: 'idle', started_at: null },
  };
}

/** Keys of a settings patch that a guided board's phase controls. */
export function phaseOwnedKeysIn(patch: Record<string, unknown>): string[] {
  return PHASE_OWNED_SETTINGS.filter((key) => key in patch);
}

export function phaseDenial(action: BoardAction, phase: PhaseId): string | null {
  const { profile, label } = PHASES[phase];
  let allowed = true;
  switch (action) {
    case 'card.create': allowed = profile.canWriteCards; break;
    case 'card.edit':
    case 'card.delete': allowed = profile.canEditCards; break;
    case 'card.move': allowed = profile.canGroup; break;
    case 'vote.toggle': allowed = profile.canVote; break;
    default: allowed = true;
  }
  return allowed ? null : `Not available during ${label}`;
}

export function validateDeadline(
  v: unknown,
  nowMs: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === null) return { ok: true, value: null };
  if (typeof v !== 'string' || v === '') return { ok: false, error: 'Deadline must be a date and time' };
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) return { ok: false, error: 'Deadline must be a date and time' };
  if (ms <= nowMs) return { ok: false, error: 'Deadline must be in the future' };
  if (ms > nowMs + DEADLINE_MAX_DAYS * 86_400_000) {
    return { ok: false, error: `Deadline must be within ${DEADLINE_MAX_DAYS} days` };
  }
  return { ok: true, value: new Date(ms).toISOString() };
}

export function deadlineState(deadline: string | null, nowMs: number): 'none' | 'open' | 'passed' {
  if (!deadline) return 'none';
  const ms = Date.parse(deadline);
  if (Number.isNaN(ms)) return 'none';
  return ms > nowMs ? 'open' : 'passed';
}

export function railSteps(
  current: PhaseId,
): { id: PhaseId; label: string; state: 'past' | 'current' | 'upcoming' }[] {
  const at = PHASE_IDS.indexOf(current);
  return PHASE_IDS.map((id, i) => ({
    id,
    label: PHASES[id].label,
    state: i < at ? 'past' : i === at ? 'current' : 'upcoming',
  }));
}

export type NextStep =
  | { kind: 'move'; label: string }
  /** The forward step would enter the final phase, which only Complete Retro can do. */
  | { kind: 'complete' }
  | null;

/** What the forward control does from `phase`: move on, complete the retro, or nothing (already final). */
export function nextStep(phase: PhaseId): NextStep {
  const index = PHASE_IDS.indexOf(phase);
  if (phase === FINAL_PHASE) return null;
  const target = PHASE_IDS[index + 1];
  if (target === FINAL_PHASE) return { kind: 'complete' };
  return { kind: 'move', label: PHASES[target].label };
}

// Some ICU versions put a narrow no-break space before AM/PM; show a plain space.
const plainSpaces = (text: string) => text.replace(/[\u202f\u00a0]/g, ' ');

/** `3:30 PM`, in the given locale and time zone (both default to the viewer's). */
export function formatDeadlineTime(ms: number, locale?: string, timeZone?: string): string {
  return plainSpaces(
    new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(ms),
  );
}

/** `Fri 3:30 PM`: weekday, a space, then the time, with no comma. */
export function formatDeadlineDay(ms: number, locale?: string, timeZone?: string): string {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone }).format(ms);
  return `${weekday} ${formatDeadlineTime(ms, locale, timeZone)}`;
}

function readyPhaseOf(data: unknown): unknown {
  return data && typeof data === 'object' ? (data as { readyPhase?: unknown }).readyPhase : undefined;
}

/** Presence members counted once per clientId; ready when any of their tabs is ready for this phase. */
export function readySummary(
  members: { clientId: string; data?: unknown }[],
  phase: PhaseId,
): { readyIds: string[]; total: number } {
  const seen = new Set<string>();
  const ready = new Set<string>();
  for (const m of members) {
    seen.add(m.clientId);
    if (readyPhaseOf(m.data) === phase) ready.add(m.clientId);
  }
  return { readyIds: [...ready], total: seen.size };
}

export function uiGates(
  mode: BoardMode,
  phase: PhaseId | null,
): { addLocked: boolean; editLocked: boolean; moveLocked: boolean } {
  if (mode !== 'guided' || !phase) return { addLocked: false, editLocked: false, moveLocked: false };
  const { profile } = PHASES[phase];
  return {
    addLocked: !profile.canWriteCards,
    editLocked: !profile.canEditCards,
    moveLocked: !profile.canGroup,
  };
}

export interface PhaseChangedPayload {
  phase: PhaseId;
  settings: BoardSettings;
  phaseConfig: PhaseConfig;
  refetch?: boolean;
}

/** Apply an Ably phase-changed payload; a malformed payload leaves the board untouched. */
export function applyPhaseChanged<
  B extends { phase: PhaseId | null; settings: BoardSettings; phase_config: PhaseConfig },
>(board: B, payload: unknown): B {
  if (!payload || typeof payload !== 'object') return board;
  const p = payload as Partial<PhaseChangedPayload>;
  if (!isPhaseId(p.phase)) return board;
  if (!p.settings || typeof p.settings !== 'object') return board;
  if (!p.phaseConfig || typeof p.phaseConfig !== 'object') return board;
  return { ...board, phase: p.phase, settings: p.settings, phase_config: p.phaseConfig };
}

/** Fill the guided-mode fields an older server may omit, so a board always reads as open by default. */
export function withPhaseDefaults<T extends object>(
  board: T,
): T & { mode: BoardMode; phase: PhaseId | null; phase_config: PhaseConfig } {
  const b = board as Partial<{ mode: BoardMode; phase: PhaseId | null; phase_config: PhaseConfig }>;
  return {
    ...board,
    mode: b.mode ?? 'open',
    phase: b.phase ?? null,
    phase_config: b.phase_config ?? { ...DEFAULT_PHASE_CONFIG },
  };
}
