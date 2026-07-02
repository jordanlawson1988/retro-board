'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface PeoplePopoverEntry {
  id: string;
  name: string;
  isMine: boolean;
}

export interface PeoplePopoverTouchAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface RenderTriggerState {
  /** True if the most recent pointer interaction was touch (no hover). */
  isTouch: boolean;
  /** True if the popover is currently open. */
  isOpen: boolean;
  /** Click handler the trigger should ALSO invoke (e.g., to toggle the reaction). On touch, the popover suppresses this and just toggles open. */
  onTriggerClick: (e: React.MouseEvent) => void;
  /** Pointer-down handler for touch detection. The trigger MUST attach this. */
  onTriggerPointerDown: (e: React.PointerEvent) => void;
}

export interface PeoplePopoverProps {
  /** Render the trigger element with the provided handlers and state. */
  renderTrigger: (state: RenderTriggerState) => ReactNode;
  /** Optional underlying action when the trigger is clicked on desktop (e.g., toggle vote/reaction). On touch, click is suppressed in favor of opening the popover. */
  onClick?: () => void;
  /** Heading row inside the popover panel (e.g., emoji + "Reactions"). */
  heading: ReactNode;
  /** List of people to show. */
  entries: PeoplePopoverEntry[];
  /** Count of additional names beyond the cap. */
  overflow: number;
  /** Optional action button shown in the popover panel on touch devices only (e.g., "Add yours"). */
  touchAction?: PeoplePopoverTouchAction;
}

export function PeoplePopover({
  renderTrigger,
  onClick,
  heading,
  entries,
  overflow,
  touchAction,
}: PeoplePopoverProps) {
  const [open, setOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  // Outside-click + ESC close
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

  const handleTriggerPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      setIsTouch(true);
      e.preventDefault();
      setOpen((v) => !v);
    }
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTouch) return;
    onClick?.();
  };

  return (
    <div
      ref={wrapRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {renderTrigger({
        isTouch,
        isOpen: open,
        onTriggerClick: handleTriggerClick,
        onTriggerPointerDown: handleTriggerPointerDown,
      })}

      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[260px] min-w-[180px] -translate-x-1/2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-2 text-[12px] shadow-[var(--shadow-md)]"
        >
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-[var(--line)] pb-1">
            <span className="flex items-center gap-1 font-medium text-[var(--ink-2)]">
              {heading}
            </span>
            {isTouch && touchAction && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  touchAction.onClick();
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--ink-3)] hover:bg-[var(--bg-elev)]"
              >
                {touchAction.icon}
                <span>{touchAction.label}</span>
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
