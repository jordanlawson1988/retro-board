'use client';

import { Button, Modal } from '@/components/common';

interface MoveOnDialogProps {
  open: boolean;
  readyCount: number;
  onlineTotal: number;
  onStay: () => void;
  onMoveOn: () => void;
}

/** Asks the facilitator to confirm moving on while some people are not ready. */
export function MoveOnDialog({ open, readyCount, onlineTotal, onStay, onMoveOn }: MoveOnDialogProps) {
  return (
    <Modal open={open} onClose={onStay} title="Move on?" size="sm">
      <div className="flex flex-col gap-4">
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
    </Modal>
  );
}
