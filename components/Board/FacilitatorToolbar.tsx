'use client';

import { Eye, EyeOff, Lock, Unlock, Vote, ClipboardList, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { BoardSettings } from '@/types';

interface FacilitatorToolbarProps {
  settings: BoardSettings;
  onUpdateSettings: (settings: Partial<BoardSettings>) => void;
  actionItemCount: number;
  onToggleActionItems: () => void;
  isCompleted: boolean;
  onCompleteRetro: () => void;
}

export function FacilitatorToolbar({
  settings,
  onUpdateSettings,
  actionItemCount,
  onToggleActionItems,
  isCompleted,
  onCompleteRetro,
}: FacilitatorToolbarProps) {
  const isRevealed = settings.card_visibility === 'visible';
  const isLocked = settings.board_locked;
  const votingOn = settings.voting_enabled;

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto">
      {!isCompleted && (
        <>
          {/* Reveal / Hide cards */}
          <ToolbarButton
            icon={isRevealed ? Eye : EyeOff}
            label={isRevealed ? 'Cards visible' : 'Cards hidden'}
            active={isRevealed}
            onClick={() =>
              onUpdateSettings({
                card_visibility: isRevealed ? 'hidden' : 'visible',
              })
            }
          />

          {/* Lock / Unlock board */}
          <ToolbarButton
            icon={isLocked ? Lock : Unlock}
            label={isLocked ? 'Board locked' : 'Board open'}
            active={isLocked}
            onClick={() => onUpdateSettings({ board_locked: !isLocked })}
          />

          {/* Toggle voting */}
          <ToolbarButton
            icon={Vote}
            label={votingOn ? 'Voting on' : 'Voting off'}
            active={votingOn}
            onClick={() => onUpdateSettings({ voting_enabled: !votingOn })}
          />

          {/* Secret voting toggle — only show when voting is enabled */}
          {votingOn && (
            <ToolbarButton
              icon={settings.secret_voting ? EyeOff : Eye}
              label={settings.secret_voting ? 'Secret voting' : 'Open voting'}
              active={settings.secret_voting}
              onClick={() => onUpdateSettings({ secret_voting: !settings.secret_voting })}
            />
          )}

          {/* Action Items */}
          <ToolbarButton
            icon={ClipboardList}
            label={`Actions${actionItemCount > 0 ? ` (${actionItemCount})` : ''}`}
            onClick={onToggleActionItems}
          />

          {/* 1px × 22px divider */}
          <span aria-hidden className="w-px h-[22px] bg-[var(--line)] mx-1 shrink-0" />

          {/* Complete Retro — accent CTA */}
          <button
            onClick={onCompleteRetro}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--r-md)] px-2.5 py-1.5 text-sm font-medium transition-colors',
              'bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]'
            )}
            aria-label="Complete Retro"
          >
            <CheckCircle2 size={14} />
            <span className="hidden sm:inline">Complete Retro</span>
          </button>
        </>
      )}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap rounded-[var(--r-md)] px-2.5 py-1.5 text-sm transition-colors',
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
          : 'text-[var(--ink-3)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]'
      )}
      title={label}
      aria-label={label}
    >
      <Icon size={16} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
