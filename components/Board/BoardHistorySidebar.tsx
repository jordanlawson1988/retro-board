'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Trash2 } from 'lucide-react';
import { getBoardHistory, clearBoardHistory } from '@/utils/boardHistory';
import type { BoardHistoryEntry } from '@/types';

function formatRelativeDate(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(isoDate).toLocaleDateString();
}

export function BoardHistorySidebar() {
  const [entries, setEntries] = useState<BoardHistoryEntry[]>(() => getBoardHistory());
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  if (entries.length === 0) return null;

  const handleClear = () => {
    clearBoardHistory();
    setEntries([]);
    setOpen(false);
  };

  const handleNavigate = (boardId: string) => {
    setOpen(false);
    router.push(`/board/${boardId}`);
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger badge */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-1.5 text-sm text-[var(--color-gray-6)] transition-colors hover:border-[var(--color-gray-3)] hover:text-[var(--color-gray-8)]"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Clock size={14} />
        Recent retros
      </button>

      {/* Popover panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Recent retro boards"
          className="absolute right-0 top-full mt-2 w-72 rounded-[var(--radius-lg)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] p-4 shadow-lg z-50"
        >
          {/* Header */}
          <div className="flex items-center gap-2 text-[var(--color-gray-6)]">
            <Clock size={16} />
            <h3 className="text-sm font-semibold">Recent Boards</h3>
          </div>

          {/* List */}
          <div className="mt-3 flex max-h-80 flex-col gap-1 overflow-y-auto">
            {entries.map((entry) => (
              <button
                key={entry.boardId}
                onClick={() => handleNavigate(entry.boardId)}
                className="flex flex-col gap-1 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-gray-1)]"
              >
                <span className="text-sm font-medium text-[var(--color-gray-8)] truncate">
                  {entry.title}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-gray-4)]">
                    {formatRelativeDate(entry.lastVisited)}
                  </span>
                  <span
                    className={`inline-flex rounded-[var(--radius-full)] px-1.5 py-0.5 text-[10px] font-medium ${
                      entry.isCompleted
                        ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                        : 'bg-[var(--color-gray-1)] text-[var(--color-gray-5)]'
                    }`}
                  >
                    {entry.isCompleted ? 'Completed' : 'Active'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-3 border-t border-[var(--color-gray-1)] pt-2">
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-[var(--color-gray-4)] transition-colors hover:text-[var(--color-gray-6)]"
            >
              <Trash2 size={12} />
              Clear history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
