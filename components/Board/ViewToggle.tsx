'use client';

import { LayoutGrid, Rows3, List, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { BoardView } from '@/types';

interface ViewToggleProps {
  currentView: BoardView;
  onChangeView: (view: BoardView) => void;
}

const views: { id: BoardView; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { id: 'grid', icon: LayoutGrid, label: 'Grid' },
  { id: 'swimlane', icon: Rows3, label: 'Swimlane' },
  { id: 'list', icon: List, label: 'List' },
  { id: 'timeline', icon: Clock, label: 'Timeline' },
];

export function ViewToggle({ currentView, onChangeView }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] p-0.5">
      {views.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onChangeView(id)}
          className={cn(
            'flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm transition-colors',
            currentView === id
              ? 'bg-[var(--color-navy)] text-white'
              : 'text-[var(--color-gray-5)] hover:text-[var(--color-gray-7)]'
          )}
          title={label}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
