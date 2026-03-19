'use client';

import { cn } from '@/utils/cn';
import { Clock } from 'lucide-react';
import type { TimerState } from '@/types';

interface TimerDisplayProps {
  timer: TimerState;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TimerDisplay({ timer }: TimerDisplayProps) {
  if (timer.status === 'idle') return null;

  const isExpired = timer.status === 'expired';
  const isRunning = timer.status === 'running';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium tabular-nums',
        isExpired && 'animate-pulse bg-[var(--color-error)]/10 text-[var(--color-error)]',
        isRunning && 'bg-[var(--color-navy)]/10 text-[var(--color-navy)]',
        timer.status === 'paused' && 'bg-[var(--color-gray-1)] text-[var(--color-gray-6)]'
      )}
    >
      <Clock size={14} />
      {isExpired ? (
        <span>Time&apos;s up!</span>
      ) : (
        <span>{formatTime(timer.remaining)}</span>
      )}
    </div>
  );
}
