'use client';

import { useBoardStore } from '@/stores/boardStore';
import { usePhaseStore, currentReadyPhase } from '@/stores/phaseStore';
import { PHASES } from '@/lib/constants/phases';
import { cn } from '@/utils/cn';

/** Lets a joined participant say they are done with the current phase. Press again to undo. */
export function ReadyButton() {
  const board = useBoardStore((s) => s.board);
  const iAmReadyFor = usePhaseStore((s) => s.iAmReadyFor);
  const readyBoardId = usePhaseStore((s) => s.readyBoardId);
  const setReady = usePhaseStore((s) => s.setReady);

  if (!board || board.mode !== 'guided' || !board.phase || !PHASES[board.phase].hasReady) return null;
  const pressed = currentReadyPhase({ iAmReadyFor, readyBoardId }, board) === board.phase;

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => setReady(!pressed)}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-[var(--r-md)] border px-3 py-1.5 text-[13px] font-medium transition-colors',
        pressed
          ? 'border-transparent bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]'
          : 'border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
      )}
    >
      {pressed ? 'Ready ✓' : 'Ready'}
    </button>
  );
}
