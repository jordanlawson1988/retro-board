'use client';

import Link from 'next/link';
import { useBoardStore } from '@/stores/boardStore';
import { SUMMARY_COMPLETED_BAR, VIEW_SUMMARY } from '@/lib/constants/summary';
import { summaryAvailable, summaryPath } from '@/lib/summary';

const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

/**
 * The way from a completed guided board to its summary. Shown at the top of the Done view
 * (desktop and phone). Renders nothing unless the board is a completed guided board, so an
 * open board or a board still in progress renders exactly what it did before.
 */
export function SummaryLinkBar({ layout }: { layout: 'desktop' | 'phone' }) {
  // Two primitives, never an object: a selector returning a fresh object would re-render on every store change.
  const boardId = useBoardStore((s) => s.board?.id);
  const available = useBoardStore((s) => summaryAvailable(s.board));
  if (!available || !boardId) return null;
  return (
    <div
      data-testid="summary-link-bar"
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 ${layout === 'desktop' ? 'mb-4' : ''}`}
    >
      <p className="min-w-0 text-sm font-medium text-[var(--ink)]">{SUMMARY_COMPLETED_BAR}</p>
      <Link href={summaryPath(boardId)} data-testid="summary-link" className={BUTTON}>
        {VIEW_SUMMARY}
      </Link>
    </div>
  );
}
