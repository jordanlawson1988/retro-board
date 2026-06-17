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
  /**
   * 'inline' (default) — compact horizontal strip for the desktop header.
   * 'stacked' — full-width labeled rows for the mobile More sheet; omits the
   * Actions button and Complete Retro (the More sheet owns those).
   */
  layout?: 'inline' | 'stacked';
}

export function FacilitatorToolbar({
  settings,
  onUpdateSettings,
  actionItemCount,
  onToggleActionItems,
  isCompleted,
  onCompleteRetro,
  layout = 'inline',
}: FacilitatorToolbarProps) {
  const isRevealed = settings.card_visibility === 'visible';
  const isLocked = settings.board_locked;
  const votingOn = settings.voting_enabled;
  const stacked = layout === 'stacked';

  return (
    <div className={cn(stacked ? 'flex flex-col gap-1.5' : 'flex items-center gap-1 sm:gap-1.5 overflow-x-auto')}>
      {!isCompleted && (
        <>
          {/* Reveal / Hide cards */}
          <ToolbarButton
            icon={isRevealed ? Eye : EyeOff}
            label={isRevealed ? 'Cards visible' : 'Cards hidden'}
            active={isRevealed}
            stacked={stacked}
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
            stacked={stacked}
            onClick={() => onUpdateSettings({ board_locked: !isLocked })}
          />

          {/* Toggle voting */}
          <ToolbarButton
            icon={Vote}
            label={votingOn ? 'Voting on' : 'Voting off'}
            active={votingOn}
            stacked={stacked}
            onClick={() => onUpdateSettings({ voting_enabled: !votingOn })}
          />

          {/* Secret voting toggle — only show when voting is enabled */}
          {votingOn && (
            <ToolbarButton
              icon={settings.secret_voting ? EyeOff : Eye}
              label={settings.secret_voting ? 'Secret voting' : 'Open voting'}
              active={settings.secret_voting}
              stacked={stacked}
              onClick={() => onUpdateSettings({ secret_voting: !settings.secret_voting })}
            />
          )}

          {/* Actions + Complete Retro live in the More sheet on mobile (stacked) */}
          {!stacked && (
            <>
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
        </>
      )}
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  stacked,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active?: boolean;
  stacked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap rounded-[var(--r-md)] text-sm transition-colors',
        stacked ? 'min-h-11 w-full justify-start px-3' : 'px-2.5 py-1.5',
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
          : 'text-[var(--ink-3)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]'
      )}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon size={16} />
      <span className={cn(stacked ? 'inline' : 'hidden sm:inline')}>{label}</span>
    </button>
  );
}
