'use client';

import { useState } from 'react';
import { Check, Link2, Users, CheckCircle2 } from 'lucide-react';
import { MobileSheet } from '@/components/common/Sheet';
import { FacilitatorToolbar } from './FacilitatorToolbar';
import { ParticipantList } from './ParticipantList';
import type { BoardSettings, Participant } from '@/types';

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  boardTitle: string;
  joinCode: string | null;
  participants: Participant[];
  onlineParticipantIds: string[];
  currentParticipantId: string | null;
  boardCreatorId: string;
  onPromoteParticipant: (participantId: string) => void;
  onDemoteParticipant: (participantId: string) => void;
  onRemoveParticipant: (participantId: string) => void;
  isAdmin: boolean;
  isCompleted: boolean;
  settings: BoardSettings;
  onUpdateSettings: (settings: Partial<BoardSettings>) => void;
  actionItemCount: number;
  onToggleActionItems: () => void;
  onCompleteRetro: () => void;
}

export function MobileMoreSheet({
  open,
  onClose,
  boardTitle,
  joinCode,
  participants,
  onlineParticipantIds,
  currentParticipantId,
  boardCreatorId,
  onPromoteParticipant,
  onDemoteParticipant,
  onRemoveParticipant,
  isAdmin,
  isCompleted,
  settings,
  onUpdateSettings,
  actionItemCount,
  onToggleActionItems,
  onCompleteRetro,
}: MobileMoreSheetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href.split('?')[0]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      label="Board options"
      title={
        <>
          {boardTitle}
          {isCompleted && (
            <span className="ml-2 text-xs font-medium text-[var(--success)]">Completed</span>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Share */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-[var(--ink-2)]"
          >
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            {copied ? 'Link copied!' : 'Copy board link'}
          </button>
          {joinCode && (
            <p className="text-center text-[13px] text-[var(--ink-3)]">
              Join code: <span className="mono font-semibold text-[var(--ink)]">{joinCode}</span>
            </p>
          )}
        </div>

        {/* Participants */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--ink-2)]">
            <Users size={16} />
            {participants.length} participant{participants.length === 1 ? '' : 's'}
          </div>
          <div className="mt-1">
            <ParticipantList
              participants={participants}
              onlineParticipantIds={onlineParticipantIds}
              currentParticipantId={currentParticipantId}
              isAdmin={isAdmin}
              boardCreatorId={boardCreatorId}
              onPromote={onPromoteParticipant}
              onDemote={onDemoteParticipant}
              onRemove={onRemoveParticipant}
            />
          </div>
        </div>

        {/* Facilitator controls — same component as the desktop header */}
        {isAdmin && !isCompleted && (
          <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-4)]">
              Facilitator
            </span>
            <FacilitatorToolbar
              layout="stacked"
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              actionItemCount={actionItemCount}
              onToggleActionItems={() => {
                onClose();
                onToggleActionItems();
              }}
              isCompleted={isCompleted}
              onCompleteRetro={() => {
                onClose();
                onCompleteRetro();
              }}
            />
            <button
              type="button"
              onClick={() => {
                onClose();
                onCompleteRetro();
              }}
              className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]"
            >
              <CheckCircle2 size={16} />
              Complete retro
            </button>
          </div>
        )}
      </div>
    </MobileSheet>
  );
}
