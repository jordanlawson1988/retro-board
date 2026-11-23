'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { PHASES, type PhaseId } from '@/lib/constants/phases';
import { cn } from '@/utils/cn';

/** The tips for a phase as a bulleted list; shared by the desktop popover and the mobile sheet. */
export function PhaseTipList({ phase }: { phase: PhaseId }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-4 text-[var(--ink-2)]">
      {PHASES[phase].tips.map((tip) => (
        <li key={tip}>{tip}</li>
      ))}
    </ul>
  );
}

/** A small popover of tips for the current phase. */
export function PhaseTips({ phase }: { phase: PhaseId }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const def = PHASES[phase];

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--r-md)] px-2.5 py-1.5 text-[13px] transition-colors',
          open
            ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent-hover)]'
            : 'text-[var(--ink-3)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]'
        )}
      >
        <Lightbulb size={14} aria-hidden />
        Tips
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={`${def.label} tips`}
          className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3 text-[13px] shadow-[var(--shadow-md)]"
        >
          <p className="mb-1.5 font-medium text-[var(--ink)]">{def.label}</p>
          <PhaseTipList phase={phase} />
        </div>
      )}
    </div>
  );
}
