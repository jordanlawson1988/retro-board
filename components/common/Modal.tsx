'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[oklch(0.15_0.01_260/0.40)] backdrop-blur-[4px]"
      style={{ animation: 'fade-in 150ms ease-out' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          'relative flex w-full flex-col bg-[var(--bg-elev)] border border-[var(--line)]',
          'rounded-[var(--r-2xl)] shadow-[var(--shadow-pop)]',
          'max-h-[90vh] sm:max-h-[85vh]',
          sizeStyles[size]
        )}
        style={{ animation: 'scale-in 150ms ease-out' }}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-5 py-3 sm:px-6 sm:py-4">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--ink)]">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-[var(--r-md)] p-2 text-[var(--ink-4)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] transition-colors -mr-1"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain p-6">{children}</div>
      </div>
    </div>
  );
}
