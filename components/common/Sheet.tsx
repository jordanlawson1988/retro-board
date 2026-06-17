'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDismissable } from '@/hooks/useDismissable';

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog (screen readers). */
  label: string;
  /** Optional visible header. When provided, renders a drag handle + title + 44px close button. */
  title?: ReactNode;
  /** Lift the sheet up by this many px (e.g. the on-screen keyboard inset). Default 0. */
  bottomOffset?: number;
  children: ReactNode;
}

/**
 * Accessible bottom-sheet primitive for mobile.
 *
 * - role=dialog / aria-modal, labelled by `label`
 * - focus moves in on open, traps Tab, restores on close (useFocusTrap)
 * - Escape and Android/gesture Back close it (useDismissable)
 * - slide-up + backdrop-fade (respects prefers-reduced-motion)
 * - scroll body is overscroll-contained; bottom padding clears the safe area
 * - unmounts when closed (leaves the AT/tab order entirely)
 */
export function MobileSheet({ open, onClose, label, title, bottomOffset = 0, children }: MobileSheetProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  useDismissable(open, onClose);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-[oklch(0.15_0.01_260/0.45)] motion-safe:animate-[fadeIn_150ms_ease]"
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-y-auto overscroll-contain rounded-t-2xl border-t border-[var(--line)] bg-[var(--surface)] px-4 pt-3 shadow-[var(--shadow-lg)] motion-safe:animate-[slideUp_300ms_cubic-bezier(0.32,0.72,0,1)]"
        style={{
          bottom: bottomOffset ? `${bottomOffset}px` : undefined,
          paddingBottom: bottomOffset ? '1rem' : 'calc(1rem + var(--safe-bottom))',
        }}
      >
        {/* Drag handle */}
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-[var(--line-strong)]" />

        {title !== undefined && (
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <h3 className="min-w-0 truncate text-base font-semibold text-[var(--ink)]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-[var(--r-md)] text-[var(--ink-3)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {children}
      </div>
    </>
  );
}
