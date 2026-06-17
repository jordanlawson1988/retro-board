'use client';

import { ThumbsUp } from 'lucide-react';

interface MobileVoteTrackerProps {
  used: number;
  total: number;
}

export function MobileVoteTracker({ used, total }: MobileVoteTrackerProps) {
  // Cap dot display at a reasonable max to avoid layout overflow
  const displayTotal = Math.min(total, 10);
  const displayUsed = Math.min(used, displayTotal);

  return (
    <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-[var(--accent-soft)] grid place-items-center shrink-0">
          <ThumbsUp size={14} className="text-[var(--accent)]" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--ink-4)]">Your votes</p>
          <p className="text-[13px] text-[var(--ink-2)]">
            <span className="font-mono tabular-nums">{used}</span>
            {' '}of{' '}
            <span className="font-mono tabular-nums">{total}</span> used
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: displayTotal }).map((_, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: i < displayUsed ? 'var(--accent)' : 'var(--surface-muted)',
              border: i < displayUsed ? 'none' : '1px solid var(--line)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
