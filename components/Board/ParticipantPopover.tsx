'use client';

import { useState, useRef, useEffect } from 'react';
import { Users } from 'lucide-react';
import { ParticipantList } from './ParticipantList';
import type { Participant } from '@/types';

interface ParticipantPopoverProps {
  participants: Participant[];
  onlineParticipantIds: string[];
  currentParticipantId: string | null;
  isAdmin: boolean;
  boardCreatorId: string;
  onPromote: (participantId: string) => void;
  onDemote: (participantId: string) => void;
  onRemove: (participantId: string) => void;
}

export function ParticipantPopover({
  participants,
  onlineParticipantIds,
  currentParticipantId,
  isAdmin,
  boardCreatorId,
  onPromote,
  onDemote,
  onRemove,
}: ParticipantPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const onlineCount = participants.filter((p) => onlineParticipantIds.includes(p.id)).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-[var(--ink-4)] hover:bg-[var(--surface-muted)] rounded-md transition-colors"
        title="View participants"
      >
        <Users size={14} />
        <span>{onlineCount}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-lg)] border border-[var(--line)] z-50 w-72 max-h-80 overflow-y-auto">
          <div className="p-3 border-b border-[var(--line)]">
            <p className="text-xs font-semibold text-[var(--ink-3)]">
              Participants ({participants.length})
            </p>
          </div>
          <div className="px-2">
            <ParticipantList
              participants={participants}
              onlineParticipantIds={onlineParticipantIds}
              currentParticipantId={currentParticipantId}
              isAdmin={isAdmin}
              boardCreatorId={boardCreatorId}
              onPromote={onPromote}
              onDemote={onDemote}
              onRemove={onRemove}
            />
          </div>
        </div>
      )}
    </div>
  );
}
