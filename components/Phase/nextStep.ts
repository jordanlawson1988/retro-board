import { PHASES, FINAL_PHASE, type PhaseId } from '@/lib/constants/phases';
import { resolvePhaseMove } from '@/lib/phases';

export type NextStep =
  | { kind: 'move'; label: string }
  /** The forward step would enter the final phase, which only Complete Retro can do. */
  | { kind: 'complete' }
  | null;

/** What the forward control should do from `phase`. Rules come from `resolvePhaseMove`. */
export function nextStep(phase: PhaseId): NextStep {
  if (phase === FINAL_PHASE) return null;
  const move = resolvePhaseMove(phase, 'next');
  return move.ok ? { kind: 'move', label: PHASES[move.phase].label } : { kind: 'complete' };
}
