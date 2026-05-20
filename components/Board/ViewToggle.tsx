'use client';

import { cn } from '@/utils/cn';
import { LayoutGrid, Rows3, List, Clock } from 'lucide-react';
import type { BoardView } from '@/types';

interface ViewToggleProps {
  currentView: BoardView;
  onChangeView: (view: BoardView) => void;
}

const OPTIONS: Array<{ value: BoardView; icon: typeof LayoutGrid; label: string }> = [
  { value: 'grid', icon: LayoutGrid, label: 'Grid' },
  { value: 'swimlane', icon: Rows3, label: 'Swimlane' },
  { value: 'list', icon: List, label: 'List' },
  { value: 'timeline', icon: Clock, label: 'Timeline' },
];

export function ViewToggle({ currentView, onChangeView }: ViewToggleProps) {
  return (
    <div
      className="inline-flex p-[3px] gap-0.5 rounded-[10px] bg-[var(--surface-muted)] border border-[var(--line)]"
      role="tablist"
      aria-label="Board view"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = value === currentView;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChangeView(value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[12px] font-medium transition-[background-color,color,box-shadow] duration-150',
              active
                ? 'bg-[var(--bg-elev)] text-[var(--ink)] shadow-[var(--shadow-xs)]'
                : 'bg-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
            )}
          >
            <Icon size={12} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
