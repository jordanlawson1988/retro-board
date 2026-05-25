// components/Board/ReactionPill.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatReactorList } from '@/utils/formatReactorList';
import type { Participant } from '@/types';

interface ReactionPillProps {
  emoji: string;
  reactorIds: string[];
  participants: Participant[];
  currentParticipantId: string | null;
  isMine: boolean;
  onToggle: () => void;
}

export function ReactionPill({
  emoji,
  reactorIds,
  participants,
  currentParticipantId,
  isMine,
  onToggle,
}: ReactionPillProps) {
  const [open, setOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  const { entries, overflow } = formatReactorList(
    reactorIds,
    participants,
    currentParticipantId
  );

  // Outside-click + ESC close (touch + after-open desktop)
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const clearTimers = () => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  };

  const handleMouseEnter = () => {
    if (isTouch) return;
    clearTimers();
    showTimer.current = window.setTimeout(() => setOpen(true), 200);
  };

  const handleMouseLeave = () => {
    if (isTouch) return;
    clearTimers();
    hideTimer.current = window.setTimeout(() => setOpen(false), 100);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      setIsTouch(true);
      // touch: tap shows tooltip, suppress toggle
      e.preventDefault();
      setOpen((v) => !v);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTouch) return; // touch path handled by pointerdown
    onToggle();
  };

  return (
    <div
      ref={wrapRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono cursor-pointer border transition-[background-color,border-color] duration-150',
          isMine
            ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent'
            : 'bg-[var(--surface-muted)] text-[var(--ink-3)] border-transparent hover:bg-[var(--bg-elev)] hover:border-[var(--line)]'
        )}
      >
        <span>{emoji}</span>
        <span className="text-[10px]">{reactorIds.length}</span>
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[260px] min-w-[180px] -translate-x-1/2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-2 text-[12px] shadow-[var(--shadow-md)]"
        >
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-[var(--line)] pb-1">
            <span className="flex items-center gap-1 font-medium text-[var(--ink-2)]">
              <span>{emoji}</span>
              <span>Reactions</span>
            </span>
            {isTouch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--ink-3)] hover:bg-[var(--bg-elev)]"
              >
                {isMine ? <Minus size={10} /> : <Plus size={10} />}
                <span>{isMine ? 'Remove yours' : 'Add yours'}</span>
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-0.5">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  'truncate',
                  entry.isMine
                    ? 'font-semibold text-[var(--accent)]'
                    : 'text-[var(--ink-3)]'
                )}
              >
                {entry.name}
                {entry.isMine ? ' (You)' : ''}
              </li>
            ))}
            {overflow > 0 && (
              <li className="text-[var(--ink-4)]">+ {overflow} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
