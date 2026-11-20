'use client';

import { useBoardStore } from '@/stores/boardStore';
import { uiGates } from '@/lib/phases';
import type { PhaseId } from '@/lib/constants/phases';

export function usePhaseGates(): {
  guided: boolean;
  phase: PhaseId | null;
  addLocked: boolean;
  editLocked: boolean;
  moveLocked: boolean;
} {
  const mode = useBoardStore((s) => s.board?.mode ?? 'open');
  const phase = useBoardStore((s) => s.board?.phase ?? null);
  return { guided: mode === 'guided', phase, ...uiGates(mode, phase) };
}
