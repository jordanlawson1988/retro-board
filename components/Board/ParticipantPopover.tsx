'use client';

import { useState, useRef, useEffect } from 'react';
import { Users, Shield, ShieldOff, UserMinus } from 'lucide-react';
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

  // Sort: online first, then alphabetical
  const sorted = [...participants].sort((a, b) => {
    const aOnline = onlineParticipantIds.includes(a.id) ? 0 : 1;
    const bOnline = onlineParticipantIds.includes(b.id) ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    return a.display_name.localeCompare(b.display_name);
  });

  const onlineCount = participants.filter((p) => onlineParticipantIds.includes(p.id)).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] rounded-md transition-colors"
        title="View participants"
      >
        <Users size={14} />
        <span>{onlineCount}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-[var(--color-surface)] rounded-lg shadow-lg border border-[var(--color-gray-2)] z-50 w-72 max-h-80 overflow-y-auto">
          <div className="p-3 border-b border-[var(--color-gray-1)]">
            <p className="text-xs font-semibold text-[var(--color-gray-6)]">
              Participants ({participants.length})
            </p>
          </div>
          <ul className="py-1">
            {sorted.map((p) => {
              const isOnline = onlineParticipantIds.includes(p.id);
              const isCreator = p.id === boardCreatorId;
              const isSelf = p.id === currentParticipantId;

              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-[var(--color-gray-0)]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isOnline ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm text-[var(--color-gray-7)] truncate">
                      {p.display_name}
                      {isSelf && <span className="text-[var(--color-gray-4)]"> (you)</span>}
                    </span>
                    {p.is_admin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-navy)] text-white flex-shrink-0">
                        Facilitator
                      </span>
                    )}
                  </div>

                  {isAdmin && !isSelf && !isCreator && (
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {p.is_admin ? (
                        <button
                          onClick={() => onDemote(p.id)}
                          className="p-2 text-[var(--color-gray-3)] hover:text-[var(--color-gray-6)] rounded"
                          title="Demote to participant"
                        >
                          <ShieldOff size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => onPromote(p.id)}
                          className="p-2 text-[var(--color-gray-3)] hover:text-[var(--color-navy)] rounded"
                          title="Promote to facilitator"
                        >
                          <Shield size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => onRemove(p.id)}
                        className="p-2 text-[var(--color-gray-3)] hover:text-red-500 rounded"
                        title="Remove participant"
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
