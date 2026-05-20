'use client';

import { useState, useRef, useEffect } from 'react';
import { Users, Shield, ShieldOff, UserMinus } from 'lucide-react';
import { avatarBackground } from '@/utils/avatarHue';
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
          <ul className="py-1">
            {sorted.map((p) => {
              const isOnline = onlineParticipantIds.includes(p.id);
              const isCreator = p.id === boardCreatorId;
              const isSelf = p.id === currentParticipantId;

              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-[var(--surface-muted)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Per-user hue avatar */}
                    <div
                      className="w-7 h-7 rounded-full grid place-items-center text-[12px] font-medium text-[var(--bg-elev)] shrink-0"
                      style={{ background: avatarBackground(p.id) }}
                    >
                      {p.display_name.charAt(0).toUpperCase()}
                    </div>
                    {/* Online indicator dot */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 -ml-1 ${
                        isOnline ? 'bg-[var(--success)]' : 'bg-[var(--line-strong)]'
                      }`}
                    />
                    <span className="text-sm text-[var(--ink-2)] truncate">
                      {p.display_name}
                      {isSelf && <span className="text-[var(--ink-4)]"> (you)</span>}
                    </span>
                    {p.is_admin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex-shrink-0">
                        Facilitator
                      </span>
                    )}
                  </div>

                  {isAdmin && !isSelf && !isCreator && (
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {p.is_admin ? (
                        <button
                          onClick={() => onDemote(p.id)}
                          className="p-2 text-[var(--ink-4)] hover:text-[var(--ink-2)] rounded"
                          title="Demote to participant"
                        >
                          <ShieldOff size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => onPromote(p.id)}
                          className="p-2 text-[var(--ink-4)] hover:text-[var(--accent)] rounded"
                          title="Promote to facilitator"
                        >
                          <Shield size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => onRemove(p.id)}
                        className="p-2 text-[var(--ink-4)] hover:text-[var(--danger)] rounded"
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
