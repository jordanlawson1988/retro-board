'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/common';
import { railSteps } from '@/lib/phases';
import { cn } from '@/utils/cn';
import { usePhaseAdvance } from './usePhaseAdvance';
import { MoveOnDialog } from './MoveOnDialog';

interface PhaseRailProps {
  isFacilitator: boolean;
  /** Opens the existing Complete Retro confirm dialog. */
  onCompleteRetro: () => void;
}

/** The five guided phases, with the facilitator's Back and Next controls. */
export function PhaseRail({ isFacilitator, onCompleteRetro }: PhaseRailProps) {
  const { phase, next, canBack, hasReady, moving, readyCount, onlineTotal, confirming, go, onNext, stay, moveOn } =
    usePhaseAdvance({ onCompleteRetro });

  if (!phase) return null;

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
          {canBack && (
            <Button variant="ghost" size="sm" disabled={moving} onClick={() => go('back')}>
              Back
            </Button>
          )}
          <Button variant="accent" size="sm" disabled={moving} onClick={onNext}>
            {next.kind === 'complete' ? 'Complete Retro' : `Next: ${next.label}`}
          </Button>
          {hasReady && (
            <span className="whitespace-nowrap text-[13px] text-[var(--ink-3)] tnum" aria-live="polite">
              {readyCount} of {onlineTotal} ready
            </span>
          )}
        </div>
      )}

      <MoveOnDialog open={confirming} readyCount={readyCount} onlineTotal={onlineTotal} onStay={stay} onMoveOn={moveOn} />
    </div>
  );
}
