'use client';

import { useCallback, useState } from 'react';
import { Check } from 'lucide-react';
import { Button, Modal } from '@/components/common';
import { useBoardStore } from '@/stores/boardStore';
import { usePhaseStore } from '@/stores/phaseStore';
import { PHASES } from '@/lib/constants/phases';
import { railSteps } from '@/lib/phases';
import { cn } from '@/utils/cn';
import { nextStep } from './nextStep';

interface PhaseRailProps {
  isFacilitator: boolean;
  /** Opens the existing Complete Retro confirm dialog. */
  onCompleteRetro: () => void;
}

/** The five guided phases, with the facilitator's Back and Next controls. */
export function PhaseRail({ isFacilitator, onCompleteRetro }: PhaseRailProps) {
  const board = useBoardStore((s) => s.board);
  const moving = usePhaseStore((s) => s.moving);
  const movePhase = usePhaseStore((s) => s.movePhase);
  const readyCount = usePhaseStore((s) => s.readyIds.length);
  const onlineTotal = usePhaseStore((s) => s.onlineTotal);
  const [confirming, setConfirming] = useState(false);

  // Failures are shown by the connection banner from lastWriteError; nothing more to do here.
  const go = useCallback(
    (to: 'next' | 'back') => {
      movePhase(to).catch(() => {});
    },
    [movePhase]
  );
  const stay = useCallback(() => setConfirming(false), []);

  if (!board || board.mode !== 'guided' || !board.phase) return null;
  const phase = board.phase;
  const def = PHASES[phase];
  const next = nextStep(phase);

  const onNext = () => {
    if (next?.kind === 'complete') {
      onCompleteRetro();
    } else if (def.hasReady && onlineTotal > 0 && readyCount < onlineTotal) {
      setConfirming(true);
    } else {
      go('next');
    }
  };

  return (
    <div data-testid="phase-rail" data-phase={phase} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ol aria-label="Retro phases" className="flex items-center gap-1">
        {railSteps(phase).map((step, i) => (
          <li
            key={step.id}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className="flex items-center gap-1"
          >
            {i > 0 && <span aria-hidden className="h-px w-3 bg-[var(--line-strong)]" />}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-1.5 pr-2.5 text-[13px]',
                step.state === 'current' && 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]',
                step.state === 'past' && 'text-[var(--ink-2)]',
                step.state === 'upcoming' && 'text-[var(--ink-3)]'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-semibold',
                  step.state === 'current' && 'bg-[var(--accent)] text-[var(--on-accent)]',
                  step.state === 'past' && 'bg-[var(--surface-muted)] text-[var(--ink-2)] border border-[var(--line-strong)]',
                  step.state === 'upcoming' && 'border border-[var(--line-strong)] text-[var(--ink-3)]'
                )}
              >
                {step.state === 'past' ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>
              {step.label}
              {step.state === 'past' && <span className="sr-only"> (finished)</span>}
            </span>
          </li>
        ))}
      </ol>

      {isFacilitator && next && (
        <div className="flex items-center gap-2">
          {phase !== 'reflect' && (
            <Button variant="ghost" size="sm" disabled={moving} onClick={() => go('back')}>
              Back
            </Button>
          )}
          <Button variant="accent" size="sm" disabled={moving} onClick={onNext}>
            {next.kind === 'complete' ? 'Complete Retro' : `Next: ${next.label}`}
          </Button>
          {def.hasReady && (
            <span className="whitespace-nowrap text-[13px] text-[var(--ink-3)] tnum" aria-live="polite">
              {readyCount} of {onlineTotal} ready
            </span>
          )}
        </div>
      )}

      <Modal open={confirming} onClose={stay} title="Move on?" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-[var(--ink-2)]">
            {readyCount} of {onlineTotal} people are ready.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={stay}>
              Stay
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                setConfirming(false);
                go('next');
              }}
            >
              Move on
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
