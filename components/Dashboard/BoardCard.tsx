'use client';

import Link from 'next/link';
import { LayoutGrid, MessageSquare, Users, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';

interface BoardCardProps {
  board: {
    id: string;
    title: string;
    description: string | null;
    template: string;
    created_at: string;
    archived_at: string | null;
    card_count: number;
    participant_count: number;
    action_count: number;
    user_role: string;
  };
}

export function BoardCard({ board }: BoardCardProps) {
  const isCompleted = !!board.archived_at;
  const date = new Date(board.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link
      href={`/board/${board.id}`}
      className={cn(
        'group flex flex-col rounded-xl border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-5 transition-all hover:border-[var(--color-gray-2)] hover:shadow-md',
        isCompleted && 'opacity-75'
      )}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-gray-8)] group-hover:text-[var(--color-navy)]">
          {board.title}
        </h3>
        {isCompleted ? (
          <span className="flex items-center gap-1 rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
            <CheckCircle2 size={12} /> Done
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-[var(--color-navy)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-navy)]">
            <Clock size={12} /> Active
          </span>
        )}
      </div>

      {board.description && (
        <p className="mt-1 line-clamp-2 text-sm text-[var(--color-gray-5)]">{board.description}</p>
      )}

      <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-[var(--color-gray-4)]">
        <span className="flex items-center gap-1"><MessageSquare size={12} /> {board.card_count}</span>
        <span className="flex items-center gap-1"><Users size={12} /> {board.participant_count}</span>
        <span className="flex items-center gap-1"><LayoutGrid size={12} /> {board.action_count}</span>
        <span className="ml-auto">{date}</span>
      </div>

      {board.user_role !== 'owner' && (
        <p className="mt-2 text-xs text-[var(--color-gray-4)]">
          Shared with you as {board.user_role}
        </p>
      )}
    </Link>
  );
}
