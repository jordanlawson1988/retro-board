// components/Board/ReactionPill.tsx
'use client';

import { Plus, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatReactorList } from '@/utils/formatReactorList';
import { PeoplePopover } from '@/components/common/PeoplePopover';
import type { Participant } from '@/types';

interface ReactionPillProps {
  emoji: string;
  reactorIds: string[];
  participants: Participant[];
  currentParticipantId: string | null;
  isMine: boolean;
  onToggle: () => void;
}

export function ReactionPill({
  emoji,
  reactorIds,
  participants,
  currentParticipantId,
  isMine,
  onToggle,
}: ReactionPillProps) {
  const { entries, overflow } = formatReactorList(
    reactorIds,
    participants,
    currentParticipantId
  );

  return (
    <PeoplePopover
      onClick={onToggle}
      heading={
        <>
          <span>{emoji}</span>
          <span>Reactions</span>
        </>
      }
      entries={entries}
      overflow={overflow}
      touchAction={{
        label: isMine ? 'Remove yours' : 'Add yours',
        icon: isMine ? <Minus size={10} /> : <Plus size={10} />,
        onClick: onToggle,
      }}
      renderTrigger={({ onTriggerClick, onTriggerPointerDown }) => (
        <button
          type="button"
          onClick={onTriggerClick}
          onPointerDown={onTriggerPointerDown}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono cursor-pointer border transition-[background-color,border-color] duration-150',
            isMine
              ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent'
              : 'bg-[var(--surface-muted)] text-[var(--ink-3)] border-transparent hover:bg-[var(--bg-elev)] hover:border-[var(--line)]'
          )}
        >
          <span>{emoji}</span>
          <span className="text-[10px]">{reactorIds.length}</span>
        </button>
      )}
    />
  );
}
