'use client';

import { useLayoutEffect, useState } from 'react';
import { ChevronLeft, Clock } from 'lucide-react';
import { MobileSheet } from '@/components/common/Sheet';
import { PHASES, PHASE_IDS } from '@/lib/constants/phases';
import { railSteps, readyLabel, stepperAreaHeight, stepperInfoLines, STEPPER_LINE_PX } from '@/lib/phases';
import { useBoardStore } from '@/stores/boardStore';
import { cn } from '@/utils/cn';
import { usePhaseAdvance } from './usePhaseAdvance';
import { usePhaseDeadline } from './usePhaseDeadline';
import { MoveOnDialog } from './MoveOnDialog';
import { ReadyButton } from './ReadyButton';
import { PhaseTipList } from './PhaseTips';

/**
 * The stepper area's height is published as the CSS custom property `--phase-stepper-h` on the
 * root element while the stepper is mounted (0px otherwise, see styles/index.css). The add-card
 * button and the floating timer add it to their offset, so they clear the stepper in every state.
 */
const STEPPER_HEIGHT_VAR = '--phase-stepper-h';

interface PhaseStepperProps {
  isFacilitator: boolean;
  /** Opens the existing Complete Retro confirm dialog. */
  onCompleteRetro: () => void;
}

/** The phone version of the phase rail: one row above the bottom nav. */
export function PhaseStepper({ isFacilitator, onCompleteRetro }: PhaseStepperProps) {
  const joined = useBoardStore((s) => !!s.currentParticipantId);
  const [tipsOpen, setTipsOpen] = useState(false);
  const { phase, next, canBack, hasReady, moving, readyCount, onlineTotal, confirming, go, onNext, stay, moveOn } =
    usePhaseAdvance({ onCompleteRetro });
  const notice = usePhaseDeadline();

  // Only the facilitator sees the count, and only in a phase that has a Ready step.
  const showReady = isFacilitator && !!next && hasReady;
  const lines = phase ? stepperInfoLines(notice?.state ?? 'none', showReady) : 0;
  const area = stepperAreaHeight(lines);
  const present = !!phase;

  useLayoutEffect(() => {
    if (!present) return;
    const root = document.documentElement;
    root.style.setProperty(STEPPER_HEIGHT_VAR, `${area}px`);
    return () => {
      root.style.removeProperty(STEPPER_HEIGHT_VAR);
    };
  }, [present, area]);

  if (!phase) return null;
  const def = PHASES[phase];
  const position = PHASE_IDS.indexOf(phase) + 1;

  return (
    <div
      data-testid="phase-stepper"
      data-phase={phase}
      className="shrink-0 flex flex-col border-t border-[var(--line)] bg-[var(--bg)]"
      style={{ height: area }}
    >
      {lines > 0 && (
        <div className="shrink-0 flex flex-col pl-4 pr-3 text-[12px]" style={{ height: lines * STEPPER_LINE_PX }}>
          {notice && (
            <p
              data-testid="phase-stepper-deadline"
              role={notice.state === 'passed' ? 'status' : undefined}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap leading-none',
                notice.state === 'passed' ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'
              )}
              style={{ height: STEPPER_LINE_PX }}
            >
              {notice.state === 'open' && <Clock size={12} aria-hidden />}
              {notice.text}
              {notice.state === 'open' && showReady && (
                <ReadyCount className="ml-auto" label={readyLabel(readyCount, onlineTotal)} />
              )}
            </p>
          )}
          {showReady && !(notice?.state === 'open') && (
            <ReadyCount
              className="justify-end"
              label={readyLabel(readyCount, onlineTotal)}
              height={STEPPER_LINE_PX}
            />
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1 items-center gap-2 px-3">
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

        <div aria-hidden className="hidden min-[380px]:flex flex-1 items-center justify-center gap-1">
          {railSteps(phase).map((step) => (
            <span
              key={step.id}
              className={cn(
                'h-1.5 rounded-full',
                step.state === 'current' && 'w-4 bg-[var(--accent)]',
                step.state === 'past' && 'w-1.5 bg-[var(--ink-3)]',
                step.state === 'upcoming' && 'w-1.5 border border-[var(--ink-3)]'
              )}
            />
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
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

function ReadyCount({ label, className, height }: { label: string; className?: string; height?: number }) {
  return (
    <span
      aria-live="polite"
      className={cn('flex items-center whitespace-nowrap leading-none text-[var(--ink-3)] tnum', className)}
      style={height ? { height } : undefined}
    >
      {label}
    </span>
  );
}
