'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type ButtonVariant = 'default' | 'primary' | 'accent' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  default:
    'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--surface-hover)] hover:border-[var(--line-strong)]',
  primary:
    'bg-[var(--ink)] text-[var(--bg-elev)] border border-transparent hover:bg-[var(--ink-2)]',
  accent:
    'bg-[var(--accent)] text-[var(--on-accent)] border border-transparent hover:bg-[var(--accent-hover)]',
  ghost:
    'bg-transparent text-[var(--ink-3)] border border-transparent hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]',
  danger:
    'bg-[var(--danger)] text-white border border-transparent hover:opacity-90',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-[7px] text-[11px] rounded-[var(--r-sm)] gap-1.5',
  md: 'px-3.5 py-2.5 text-[13px] rounded-[var(--r-md)] gap-2',
  lg: 'px-[22px] py-3.5 text-[15px] rounded-[var(--r-lg)] gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium leading-none whitespace-nowrap',
          'transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
