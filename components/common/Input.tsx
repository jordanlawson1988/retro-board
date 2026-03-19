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
            className="text-sm font-medium text-[var(--color-gray-7)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-[var(--radius-md)] border px-3 py-2 text-base',
            'bg-[var(--color-surface)] text-[var(--color-gray-8)]',
            'placeholder:text-[var(--color-gray-3)]',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-offset-1',
            error
              ? 'border-[var(--color-error)] focus:ring-[var(--color-error)]'
              : 'border-[var(--color-gray-2)] focus:border-[var(--color-navy)] focus:ring-[var(--color-navy)]',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-gray-1)]',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
