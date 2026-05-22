'use client';

import Link from 'next/link';
import {
  LayoutGrid,
  MessageSquare,
  Users,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/common';
import { BoardCardMenu } from './BoardCardMenu';
import type { DashboardBoard } from '@/types';

interface BoardCardProps {
  board: DashboardBoard;
  onRename?: (b: DashboardBoard) => void;
  onTrash?: (b: DashboardBoard) => void;
  onReopen?: (b: DashboardBoard) => void;
  onManageMembers?: (b: DashboardBoard) => void;
  onRegenerateCode?: (b: DashboardBoard) => void;
  onLeave?: (b: DashboardBoard) => void;
  onRestore?: (b: DashboardBoard) => void;
  onDeleteForever?: (b: DashboardBoard) => void;
}

export function BoardCard({
  board,
  onRename,
  onTrash,
  onReopen,
  onManageMembers,
  onRegenerateCode,
  onLeave,
  onRestore,
  onDeleteForever,
}: BoardCardProps) {
  const isCompleted = !!board.archived_at;
  const isTrashed = !!board.deleted_at;
  const isOwner = board.user_role === 'owner';
  const date = new Date(
    isTrashed && board.deleted_at ? board.deleted_at : board.created_at
  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const stats = (
    <div className="mt-auto flex items-center gap-3.5 pt-4 text-xs text-[var(--ink-4)]">
      {!isTrashed &&
        (isCompleted ? (
          <span className="inline-flex items-center gap-1 text-[var(--success)]">
            <CheckCircle2 size={12} /> Done
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[var(--accent)]">
            <Clock size={12} /> Active
          </span>
        ))}
      <span className="inline-flex items-center gap-1">
        <MessageSquare size={12} /> {board.card_count}
      </span>
      <span className="inline-flex items-center gap-1">
        <Users size={12} /> {board.participant_count}
      </span>
      <span className="inline-flex items-center gap-1">
        <LayoutGrid size={12} /> {board.action_count}
      </span>
      <span className="ml-auto">{date}</span>
    </div>
  );

  if (isTrashed) {
    return (
      <div className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 opacity-90">
        <h3 className="text-lg font-semibold text-[var(--ink)]">{board.title}</h3>
        {board.description && (
          <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-4)]">{board.description}</p>
        )}
        {stats}
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => onRestore?.(board)}>
            <RotateCcw size={14} /> Restore
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDeleteForever?.(board)}>
            <Trash2 size={14} /> Delete forever
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] transition-all hover:border-[var(--line-strong)] hover:shadow-md">
      <Link
        href={`/board/${board.id}`}
        className={cn('flex flex-1 flex-col p-5', isCompleted && 'opacity-75')}
      >
        <h3 className="pr-9 text-lg font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">
          {board.title}
        </h3>
        {board.description && (
          <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-4)]">{board.description}</p>
        )}
        {stats}
        {!isOwner && (
          <p className="mt-2 text-xs text-[var(--ink-4)]">Shared with you as {board.user_role}</p>
        )}
      </Link>
      <div className="absolute right-2 top-2">
        <BoardCardMenu
          board={board}
          onRename={() => onRename?.(board)}
          onTrash={() => onTrash?.(board)}
          onReopen={() => onReopen?.(board)}
          onManageMembers={() => onManageMembers?.(board)}
          onRegenerateCode={() => onRegenerateCode?.(board)}
          onLeave={() => onLeave?.(board)}
        />
      </div>
    </div>
  );
}
