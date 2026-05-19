'use client';

import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';
import { Pill } from './Pill';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantAccent: Record<BadgeVariant, string | undefined> = {
  default: undefined,
  success: 'bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)] border-transparent',
  warning: 'bg-[color-mix(in_oklab,var(--warning)_22%,transparent)] text-[var(--ink-2)] border-transparent',
  error:   'bg-[color-mix(in_oklab,var(--danger)_18%,transparent)] text-[var(--danger)] border-transparent',
  info:    'bg-[color-mix(in_oklab,var(--info)_18%,transparent)] text-[var(--info)] border-transparent',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const accent = variantAccent[variant];
  return (
    <Pill
      variant={variant === 'default' ? 'default' : 'tinted'}
      className={cn(accent, className)}
    >
      {children}
    </Pill>
  );
}
