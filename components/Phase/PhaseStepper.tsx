'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { MobileSheet } from '@/components/common/Sheet';
import { PHASES, PHASE_IDS } from '@/lib/constants/phases';
import { railSteps } from '@/lib/phases';
import { useBoardStore } from '@/stores/boardStore';
import { cn } from '@/utils/cn';
import { usePhaseAdvance } from './usePhaseAdvance';
import { MoveOnDialog } from './MoveOnDialog';
import { ReadyButton } from './ReadyButton';
import { PhaseTipList } from './PhaseTips';

/** Height of the stepper row in px; the add-card button lifts by this much to stay clear of it. */
export const PHASE_STEPPER_HEIGHT = 56;

interface PhaseStepperProps {
  isFacilitator: boolean;
  /** Opens the existing Complete Retro confirm dialog. */
  onCompleteRetro: () => void;
}

/** The phone version of the phase rail: one row above the bottom nav. */
export function PhaseStepper({ isFacilitator, onCompleteRetro }: PhaseStepperProps) {
  const joined = useBoardStore((s) => !!s.currentParticipantId);
  const [tipsOpen, setTipsOpen] = useState(false);
  const { phase, next, canBack, moving, readyCount, onlineTotal, confirming, go, onNext, stay, moveOn } =
    usePhaseAdvance({ onCompleteRetro });

  if (!phase) return null;
  const def = PHASES[phase];
  const position = PHASE_IDS.indexOf(phase) + 1;

  return (
    <div
      data-testid="phase-stepper"
      data-phase={phase}
      className="shrink-0 flex items-center gap-2 border-t border-[var(--line)] bg-[var(--bg)] px-3"
      style={{ height: PHASE_STEPPER_HEIGHT }}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${def.label}, step ${position} of ${PHASE_IDS.length}. Show tips`}
        onClick={() => setTipsOpen(true)}
        className="flex min-h-11 min-w-11 shrink-0 flex-col items-start justify-center rounded-[var(--r-md)] px-1 text-left hover:bg-[var(--surface-muted)]"
      >
        <span className="text-[14px] font-semibold leading-tight text-[var(--ink)]">{def.label}</span>
        <span className="text-[12px] leading-tight text-[var(--ink-3)] tnum">
          {position} of {PHASE_IDS.length}
        </span>
      </button>

      <div aria-hidden className="flex flex-1 items-center justify-center gap-1">
        {railSteps(phase).map((step) => (
          <span
            key={step.id}
            className={cn(
              'h-1.5 rounded-full',
              step.state === 'current' && 'w-4 bg-[var(--accent)]',
              step.state === 'past' && 'w-1.5 bg-[var(--ink-3)]',
              step.state === 'upcoming' && 'w-1.5 border border-[var(--line-strong)]'
            )}
          />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {joined && <ReadyButton className="min-h-11 px-3" />}
        {isFacilitator && next && (
          <>
            {canBack && (
              <button
                type="button"
                aria-label="Back"
                disabled={moving}
                onClick={() => go('back')}
                className="grid min-h-11 min-w-11 place-items-center rounded-[var(--r-md)] text-[var(--ink-3)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
            )}
            <button
              type="button"
              disabled={moving}
              onClick={onNext}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-[var(--r-md)] bg-[var(--accent)] px-3 text-[13px] font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {next.kind === 'complete' ? 'Complete Retro' : `Next: ${next.label}`}
            </button>
          </>
        )}
      </div>

      <MoveOnDialog open={confirming} readyCount={readyCount} onlineTotal={onlineTotal} onStay={stay} onMoveOn={moveOn} />

      <MobileSheet open={tipsOpen} onClose={() => setTipsOpen(false)} label={`${def.label} tips`} title={`${def.label} tips`}>
        <div className="text-[14px]">
          <PhaseTipList phase={phase} />
        </div>
      </MobileSheet>
    </div>
  );
}
