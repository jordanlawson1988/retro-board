'use client';

import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-[var(--ink-2)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full px-3 py-2.5 rounded-[var(--r-md)] text-[15px]',
            'bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)]',
            'placeholder:text-[var(--ink-4)] outline-none',
            'focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]',
            'transition-[border-color,box-shadow] duration-150',
            error
              ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger)_20%,transparent)]'
              : '',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)]',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
