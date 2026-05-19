'use client';

import { cn } from '@/utils/cn';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export function Chip({ active = false, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium',
        'transition-[background-color,color,border-color] duration-150',
        active
          ? 'bg-[var(--ink)] text-[var(--bg-elev)] border border-transparent'
          : 'bg-[var(--bg-elev)] text-[var(--ink-3)] border border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
