'use client';

import { cn } from '@/utils/cn';
import { Columns3, ListChecks, MoreHorizontal } from 'lucide-react';

export type MobileNavKey = 'board' | 'actions' | 'more';

interface MobileBottomNavProps {
  active: MobileNavKey;
  onSelect: (key: MobileNavKey) => void;
  actionBadgeCount?: number;
}

const ITEMS: Array<{ key: MobileNavKey; icon: typeof Columns3; label: string }> = [
  { key: 'board',   icon: Columns3,       label: 'Board' },
  { key: 'actions', icon: ListChecks,     label: 'Actions' },
  { key: 'more',    icon: MoreHorizontal, label: 'More' },
];

export function MobileBottomNav({
  active,
  onSelect,
  actionBadgeCount = 0,
}: MobileBottomNavProps) {
  return (
    <nav
      className="shrink-0 grid grid-cols-3 gap-1 px-2 pt-2 border-t border-[var(--line)] z-30"
      style={{
        paddingBottom: 'calc(8px + var(--safe-bottom))',
        background: 'color-mix(in oklab, var(--bg) 85%, transparent)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      aria-label="Mobile board navigation"
    >
      {ITEMS.map(({ key, icon: Icon, label }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'relative flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-[10px] font-medium border-none bg-transparent cursor-pointer transition-colors duration-120',
              isActive
                ? 'text-[var(--accent)]'
                : 'text-[var(--ink-4)] hover:bg-[var(--surface-muted)]'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
            {key === 'actions' && actionBadgeCount > 0 && (
              <span
                aria-label={`${actionBadgeCount} action items`}
                className="absolute top-1.5 right-1/2 translate-x-3 w-2 h-2 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
