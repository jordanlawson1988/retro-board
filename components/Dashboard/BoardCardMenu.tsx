'use client';

import { useState, useRef, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { MoreHorizontal, Pencil, Trash2, RotateCcw, Users, KeyRound, LogOut } from 'lucide-react';
import { IconButton } from '@/components/common';
import type { DashboardBoard } from '@/types';

interface BoardCardMenuProps {
  board: DashboardBoard;
  onRename: () => void;
  onTrash: () => void;
  onReopen: () => void;
  onManageMembers: () => void;
  onRegenerateCode: () => void;
  onLeave: () => void;
}

export function BoardCardMenu({
  board,
  onRename,
  onTrash,
  onReopen,
  onManageMembers,
  onRegenerateCode,
  onLeave,
}: BoardCardMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isOwner = board.user_role === 'owner';
  const isCompleted = !!board.archived_at;

  useEffect(() => {
    function onDocClick(e: globalThis.MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [open]);

  // Menu buttons live inside a card-level <Link>; stop nav + bubbling.
  function run(fn: () => void) {
    return (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      fn();
    };
  }
  function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  }

  const itemBase =
    'flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--surface-muted)]';

  return (
    <div className="relative" ref={ref}>
      <IconButton
        size="sm"
        onClick={toggle}
        aria-label="Board actions"
        className="opacity-60 group-hover:opacity-100"
      >
        <MoreHorizontal size={18} />
      </IconButton>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]">
          {isOwner ? (
            <>
              <button className={`${itemBase} text-[var(--ink-2)]`} onClick={run(onRename)}>
                <Pencil size={15} /> Rename
              </button>
              {isCompleted && (
                <button className={`${itemBase} text-[var(--ink-2)]`} onClick={run(onReopen)}>
                  <RotateCcw size={15} /> Reopen
                </button>
              )}
              <button className={`${itemBase} text-[var(--ink-2)]`} onClick={run(onManageMembers)}>
                <Users size={15} /> Manage members
              </button>
              <button className={`${itemBase} text-[var(--ink-2)]`} onClick={run(onRegenerateCode)}>
                <KeyRound size={15} /> Regenerate code
              </button>
              <div className="my-1 border-t border-[var(--line)]" />
              <button className={`${itemBase} text-[var(--danger)]`} onClick={run(onTrash)}>
                <Trash2 size={15} /> Delete
              </button>
            </>
          ) : (
            <button className={`${itemBase} text-[var(--ink-2)]`} onClick={run(onLeave)}>
              <LogOut size={15} /> Leave board
            </button>
          )}
        </div>
      )}
    </div>
  );
}
