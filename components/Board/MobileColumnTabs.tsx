'use client';

import { cn } from '@/utils/cn';
import type { Column } from '@/types';

interface MobileColumnTabsProps {
  columns: Column[];
  activeColumnId: string;
  onSelect: (columnId: string) => void;
}

export function MobileColumnTabs({ columns, activeColumnId, onSelect }: MobileColumnTabsProps) {
  return (
    <div
      className="shrink-0 flex gap-2 px-4 py-3 overflow-x-auto scroll-hide"
      style={{ scrollSnapType: 'x mandatory' }}
      role="tablist"
      aria-label="Board columns"
    >
      {[...columns].sort((a, b) => a.position - b.position).map((c) => {
        const active = c.id === activeColumnId;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(c.id)}
            className={cn(
              'shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-[13px] font-medium',
              'transition-[background-color,color,border-color] duration-150',
              active
                ? 'border-transparent text-[var(--ink)]'
                : 'bg-[var(--bg-elev)] border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--line-strong)]'
            )}
            style={
              active
                ? { background: `color-mix(in oklab, ${c.color || 'var(--accent)'} 22%, var(--bg-elev))` }
                : undefined
            }
          >
            <span
              aria-hidden
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: c.color || 'var(--accent)' }}
            />
            {c.title}
          </button>
        );
      })}
    </div>
  );
}
