'use client';

import { cn } from '@/utils/cn';
import type { HTMLAttributes, ReactNode } from 'react';

type PillVariant = 'default' | 'tinted' | 'bare';

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  children: ReactNode;
}

const variantStyles: Record<PillVariant, string> = {
  default:
    'bg-[var(--surface-muted)] text-[var(--ink-2)] border border-[var(--line)]',
  tinted:
    'bg-[var(--accent-soft)] text-[var(--accent)] border border-transparent',
  bare:
    'bg-transparent text-[var(--ink-3)] border-transparent px-1.5',
};

export function Pill({ variant = 'default', className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
