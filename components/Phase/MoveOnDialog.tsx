'use client';

import { createPortal } from 'react-dom';
import { Button, Modal } from '@/components/common';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface MoveOnDialogProps {
  open: boolean;
  readyCount: number;
  onlineTotal: number;
  onStay: () => void;
  onMoveOn: () => void;
}

/** Asks the facilitator to confirm moving on while some people are not ready. */
export function MoveOnDialog({ open, readyCount, onlineTotal, onStay, onMoveOn }: MoveOnDialogProps) {
  // The shared Modal neither moves focus in, keeps Tab inside, nor restores focus, so the
  // dialog's own content does: focus lands on Stay, Tab wraps between the two buttons, and
  // focus returns to the Next button on close.
  const contentRef = useFocusTrap<HTMLDivElement>(open);
  // Rendered on the body: the rail sits in the sticky, blurred header, which would otherwise become
  // the containing block of the Modal's fixed overlay and clip it. Open only after a click, so the
  // server never renders it.
  if (!open) return null;
  return createPortal(
    <Modal open={open} onClose={onStay} title="Move on?" size="sm">
      <div ref={contentRef} className="flex flex-col gap-4">
        <p className="text-[var(--ink-2)]">
          {readyCount} of {onlineTotal} people are ready.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onStay}>
            Stay
          </Button>
          <Button variant="accent" onClick={onMoveOn}>
            Move on
          </Button>
        </div>
      </div>
    </Modal>,
    document.body
  );
}
