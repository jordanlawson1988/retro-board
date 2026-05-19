'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  children: ReactNode;
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-7 h-7 rounded-[var(--r-sm)]',
  md: 'w-8 h-8 rounded-[var(--r-sm)]',
  lg: 'w-10 h-10 rounded-[var(--r-md)]',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center justify-center bg-transparent border-transparent text-[var(--ink-3)]',
          'transition-[background-color,color] duration-150',
          'hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';
