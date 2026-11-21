'use client';

import { useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { Button } from '@/components/common';
import { cn } from '@/utils/cn';
import { usePhaseGates } from '@/hooks/usePhaseGates';
import { useBoardStore } from '@/stores/boardStore';
import { useGroupVoteStore } from '@/stores/groupVoteStore';
import { GUIDED_MODE, type PhaseId } from '@/lib/constants/phases';
import { hasGrouping } from '@/lib/groups';
import { ResetGroupingDialog } from './ResetGroupingDialog';

interface ResetGroupingProps {
  /** 'inline' sits in the desktop phase row; 'stacked' fills the width of the mobile More sheet. */
  layout?: 'inline' | 'stacked';
}

/**
 * The facilitator's "put every card back on its own" action. Mounted for facilitators only, and
 * shown only while grouping is allowed. The open dialog belongs to the phase it was opened in.
 */
export function ResetGrouping({ layout = 'inline' }: ResetGroupingProps) {
  const { guided, phase, moveLocked } = usePhaseGates();
  const completed = useBoardStore((s) => !!s.board?.archived_at);
  // Answers before it reads `cards` when the board is not guided: the More sheet mounts this on open boards too.
  const nothingToReset = useBoardStore((s) => (s.board?.mode === GUIDED_MODE ? !hasGrouping(s.cards) : true));
  const resetting = useGroupVoteStore((s) => s.resetting);
  const resetGrouping = useGroupVoteStore((s) => s.resetGrouping);
  const [openIn, setOpenIn] = useState<PhaseId | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const stacked = layout === 'stacked';

  const available = guided && !completed && !moveLocked && phase !== null;
  const open = openIn !== null && openIn === phase && available;

  // A dialog left behind by a phase change must not come back when that phase is reached again.
  if (openIn !== null && !open) setOpenIn(null);

  if (!available) return null;

  const confirm = () => {
    // Judge by the live store, so a confirm that races a phase change does nothing.
    if (!open || resetting || useBoardStore.getState().board?.phase !== openIn) return;
    // A rejection leaves the dialog open; the connection banner shows the reason.
    resetGrouping()
      .then(() => setOpenIn(null))
      .catch(() => {});
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant={stacked ? 'default' : 'ghost'}
        size={stacked ? 'md' : 'sm'}
        disabled={nothingToReset}
        title={nothingToReset ? 'Nothing to reset' : undefined}
        onClick={() => setOpenIn(phase)}
        className={cn(stacked && 'min-h-11 w-full justify-start')}
      >
        <Layers size={stacked ? 16 : 12} aria-hidden />
        Reset grouping
      </Button>
      <ResetGroupingDialog open={open} busy={resetting} onCancel={() => setOpenIn(null)} onConfirm={confirm} />
    </>
  );
}
