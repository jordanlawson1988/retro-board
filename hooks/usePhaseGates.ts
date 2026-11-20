'use client';

import { useBoardStore } from '@/stores/boardStore';
import { uiGates } from '@/lib/phases';
import { GUIDED_MODE, OPEN_MODE, type PhaseId } from '@/lib/constants/phases';

export function usePhaseGates(): {
  guided: boolean;
  phase: PhaseId | null;
  addLocked: boolean;
  editLocked: boolean;
  moveLocked: boolean;
} {
  const mode = useBoardStore((s) => s.board?.mode ?? OPEN_MODE);
  const phase = useBoardStore((s) => s.board?.phase ?? null);
  return { guided: mode === GUIDED_MODE, phase, ...uiGates(mode, phase) };
}
