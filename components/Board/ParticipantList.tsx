'use client';

import { Shield, ShieldOff, UserMinus } from 'lucide-react';
import { avatarBackground } from '@/utils/avatarHue';
import type { Participant } from '@/types';

export interface ParticipantListProps {
  participants: Participant[];
  onlineParticipantIds: string[];
  currentParticipantId: string | null;
  isAdmin: boolean;
  boardCreatorId: string;
  onPromote: (participantId: string) => void;
  onDemote: (participantId: string) => void;
  onRemove: (participantId: string) => void;
}

/**
 * Shared interactive participant list — single source of truth for the desktop
 * ParticipantPopover and the mobile More sheet. Sorts online-first; admins get
 * promote/demote/remove (44px touch hit areas); creator and self are protected.
 */
export function ParticipantList({
  participants,
  onlineParticipantIds,
  currentParticipantId,
  isAdmin,
  boardCreatorId,
  onPromote,
  onDemote,
  onRemove,
}: ParticipantListProps) {
  // Sort: online first, then alphabetical
  const sorted = [...participants].sort((a, b) => {
    const aOnline = onlineParticipantIds.includes(a.id) ? 0 : 1;
    const bOnline = onlineParticipantIds.includes(b.id) ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    return a.display_name.localeCompare(b.display_name);
  });

  return (
    <ul className="py-1">
      {sorted.map((p) => {
        const isOnline = onlineParticipantIds.includes(p.id);
        const isCreator = p.id === boardCreatorId;
        const isSelf = p.id === currentParticipantId;

        return (
          <li
            key={p.id}
            className="flex items-center justify-between px-1 py-1.5 hover:bg-[var(--surface-muted)] rounded-[var(--r-sm)]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Per-user hue avatar */}
              <div
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-medium text-[var(--bg-elev)]"
                style={{ background: avatarBackground(p.id) }}
              >
                {p.display_name.charAt(0).toUpperCase()}
              </div>
              {/* Online indicator dot */}
              <span
                className={`-ml-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                  isOnline ? 'bg-[var(--success)]' : 'bg-[var(--line-strong)]'
                }`}
              />
              <span className="truncate text-sm text-[var(--ink-2)]">
                {p.display_name}
                {isSelf && <span className="text-[var(--ink-4)]"> (you)</span>}
              </span>
              {p.is_admin && (
                <span className="flex-shrink-0 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                  Facilitator
                </span>
              )}
            </div>

            {isAdmin && !isSelf && !isCreator && (
              <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                {p.is_admin ? (
                  <button
                    onClick={() => onDemote(p.id)}
                    className="grid min-h-11 min-w-11 place-items-center rounded text-[var(--ink-4)] hover:text-[var(--ink-2)] sm:min-h-0 sm:min-w-0 sm:p-2"
                    title="Demote to participant"
                    aria-label={`Demote ${p.display_name} to participant`}
                  >
                    <ShieldOff size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => onPromote(p.id)}
                    className="grid min-h-11 min-w-11 place-items-center rounded text-[var(--ink-4)] hover:text-[var(--accent)] sm:min-h-0 sm:min-w-0 sm:p-2"
                    title="Promote to facilitator"
                    aria-label={`Promote ${p.display_name} to facilitator`}
                  >
                    <Shield size={16} />
                  </button>
                )}
                <button
                  onClick={() => onRemove(p.id)}
                  className="grid min-h-11 min-w-11 place-items-center rounded text-[var(--ink-4)] hover:text-[var(--danger)] sm:min-h-0 sm:min-w-0 sm:p-2"
                  title="Remove participant"
                  aria-label={`Remove ${p.display_name}`}
                >
                  <UserMinus size={16} />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
