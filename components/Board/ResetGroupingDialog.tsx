'use client';

import { createPortal } from 'react-dom';
import { Button, Modal } from '@/components/common';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ResetGroupingDialogProps {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asks the facilitator to confirm putting every card back on its own. */
export function ResetGroupingDialog({ open, busy, onCancel, onConfirm }: ResetGroupingDialogProps) {
  // The shared Modal neither moves focus in, keeps Tab inside, nor restores focus, so the
  // dialog's own content does: focus lands on Cancel and returns to the trigger on close.
  const contentRef = useFocusTrap<HTMLDivElement>(open);
  // Rendered on the body: the phase row and the More sheet both sit in boxes that would otherwise
  // become the containing block of the Modal's fixed overlay and clip it.
  if (!open) return null;
  return createPortal(
    <Modal open={open} onClose={onCancel} title="Reset grouping?" size="sm">
      <div ref={contentRef} className="flex flex-col gap-4">
        <p className="text-[var(--ink-2)]">
          Every group goes back to single cards and every group title is cleared. Votes stay as they are.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {/* Not disabled while it runs: a disabled button would drop keyboard focus out of the dialog. */}
          <Button
            variant="danger"
            aria-busy={busy}
            onClick={() => {
              if (!busy) onConfirm();
            }}
            className="aria-busy:cursor-wait aria-busy:opacity-60"
          >
            Reset grouping
          </Button>
        </div>
      </div>
    </Modal>,
    document.body
  );
}
