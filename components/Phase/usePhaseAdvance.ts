'use client';

import { useCallback, useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { usePhaseStore } from '@/stores/phaseStore';
import { GUIDED_MODE, PHASES, type PhaseId } from '@/lib/constants/phases';
import { canGoBack, nextStep, needsMoveOnConfirm } from '@/lib/phases';

/**
 * The facilitator's Back and Next logic, shared by the desktop rail and the mobile stepper:
 * the forward step, the ready count, and the Move on confirm, which is bound to the phase it
 * was opened in so it cannot act in any other phase.
 */
export function usePhaseAdvance({ onCompleteRetro }: { onCompleteRetro: () => void }) {
  const board = useBoardStore((s) => s.board);
  const moving = usePhaseStore((s) => s.moving);
  const movePhase = usePhaseStore((s) => s.movePhase);
  const readyCount = usePhaseStore((s) => s.readyIds.length);
  const onlineTotal = usePhaseStore((s) => s.onlineTotal);
  const [confirmPhase, setConfirmPhase] = useState<PhaseId | null>(null);

  // Failures are shown by the connection banner from lastWriteError; nothing more to do here.
  const go = useCallback(
    (to: 'next' | 'back') => {
      movePhase(to).catch(() => {});
    },
    [movePhase]
  );
  const stay = useCallback(() => setConfirmPhase(null), []);

  const phase = board && board.mode === GUIDED_MODE ? board.phase : null;
  const next = phase ? nextStep(phase) : null;
  const canBack = phase ? canGoBack(phase) : false;
  const confirming = !!phase && confirmPhase === phase;
  const hasReady = phase ? PHASES[phase].hasReady : false;

  const onNext = () => {
    if (!phase) return;
    if (next?.kind === 'complete') {
      onCompleteRetro();
    } else if (needsMoveOnConfirm(phase, onlineTotal, readyCount)) {
      setConfirmPhase(phase);
    } else {
      go('next');
    }
  };

  const moveOn = () => {
    setConfirmPhase(null);
    if (confirming) go('next');
  };

  return { phase, next, canBack, hasReady, moving, readyCount, onlineTotal, confirming, go, onNext, stay, moveOn };
}
