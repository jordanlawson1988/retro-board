'use client';

import { useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import { BOARD_MODES, type BoardMode } from '@/lib/constants/phases';
import { cn } from '@/utils/cn';

interface ModeChoiceProps {
  mode: BoardMode;
  anonymous: boolean;
  onChange: (next: { mode: BoardMode; anonymous: boolean }) => void;
}

const MODE_COPY: Record<BoardMode, { title: string; description: string }> = {
  open: {
    title: 'Open board',
    description: 'Everyone works on the board freely. You control reveal, voting and lock.',
  },
  guided: {
    title: 'Guided retro',
    description: 'Step through Reflect, Group, Vote and Discuss together.',
  },
};

/** Choose between an open board and a guided retro when creating a board. */
export function ModeChoice({ mode, anonymous, onChange }: ModeChoiceProps) {
  const labelId = useId();
  const refs = useRef<Partial<Record<BoardMode, HTMLButtonElement | null>>>({});

  const select = (next: BoardMode) => {
    onChange({ mode: next, anonymous });
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = (index + 1) % BOARD_MODES.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = (index - 1 + BOARD_MODES.length) % BOARD_MODES.length;
    if (target === null) return;
    e.preventDefault();
    select(BOARD_MODES[target]);
  };

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium text-[var(--ink-2)]">
        How will you run it?
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BOARD_MODES.map((m, i) => {
          const selected = mode === m;
          return (
            <button
              key={m}
              ref={(el) => {
                refs.current[m] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange({ mode: m, anonymous })}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'relative text-left p-4 rounded-[var(--r-lg)] border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
                selected
                  ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]'
                  : 'border-[var(--line)] hover:border-[var(--line-strong)]'
              )}
            >
              <h4 className="text-[14px] font-semibold mb-1 pr-6">{MODE_COPY[m].title}</h4>
              <p className="text-[12px] text-[var(--ink-4)] leading-snug">{MODE_COPY[m].description}</p>
              {selected && (
                <span
                  aria-hidden
                  className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {mode === 'guided' && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] text-[var(--ink-2)]">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => onChange({ mode, anonymous: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Hide who wrote each card
        </label>
      )}
    </div>
  );
}
