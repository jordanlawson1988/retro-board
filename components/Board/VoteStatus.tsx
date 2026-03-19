'use client';

import { ThumbsUp } from 'lucide-react';
import { cn } from '@/utils/cn';

interface VoteStatusProps {
  votesUsed: number;
  maxVotes: number;
}

export function VoteStatus({ votesUsed, maxVotes }: VoteStatusProps) {
  const remaining = maxVotes - votesUsed;
  const isExhausted = remaining <= 0;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm',
        isExhausted
          ? 'bg-[var(--color-error)]/10 text-[var(--color-error)] font-medium'
          : 'bg-[var(--color-navy)]/10 text-[var(--color-navy)]'
      )}
    >
      <ThumbsUp size={14} />
      <span>
        {remaining} of {maxVotes} vote{maxVotes !== 1 ? 's' : ''} remaining
      </span>
    </div>
  );
}
