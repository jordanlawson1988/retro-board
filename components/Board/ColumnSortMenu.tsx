// components/Board/ColumnSortMenu.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { IconButton } from '@/components/common/IconButton';
import type { CardSort } from '@/types';

interface ColumnSortMenuProps {
  value: CardSort;
  onChange: (next: CardSort) => void;
  /** Force-hide on mobile / non-admin contexts. */
  disabled?: boolean;
  /** True while vote sorting is held back (secret voting pending) — shows a hint. */
  voteSortSuppressed?: boolean;
}

const OPTIONS: { value: CardSort; label: string }[] = [
  { value: 'votes_desc', label: 'Most votes' },
  { value: 'votes_asc', label: 'Fewest votes' },
  { value: 'manual', label: 'Manual' },
];

export function ColumnSortMenu({ value, onChange, disabled, voteSortSuppressed }: ColumnSortMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (disabled) return null;

  return (
    <div className="relative" ref={ref}>
      <IconButton
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="Sort cards"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Sort cards"
      >
        <ArrowUpDown size={14} />
      </IconButton>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)]"
        >
          {OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors hover:bg-[var(--surface-muted)]',
                  active ? 'text-[var(--ink)] font-medium' : 'text-[var(--ink-3)]'
                )}
              >
                <Check size={14} className={cn(active ? 'opacity-100' : 'opacity-0')} />
                <span>{opt.label}</span>
              </button>
            );
          })}
          {voteSortSuppressed && (
            <p className="border-t border-[var(--line)] px-3 pb-1.5 pt-2 text-[11px] leading-snug text-[var(--ink-4)]">
              Secret voting: vote order applies when the retro is completed
            </p>
          )}
        </div>
      )}
    </div>
  );
}
