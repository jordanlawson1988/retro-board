'use client';

import { ThumbsUp } from 'lucide-react';
import { cn } from '@/utils/cn';
import { votePillPolicy } from '@/lib/votePillPolicy';
import { formatVoterList } from '@/utils/formatVoterList';
import { PeoplePopover } from '@/components/common/PeoplePopover';
import type { Participant, Vote } from '@/types';

export interface VotePillProps {
  voteCount: number;
  voters: Vote[];                  // full vote rows for THIS card
  participants: Participant[];
  currentParticipantId: string | null;
  votingEnabled: boolean;
  isCompleted: boolean;
  // Interactive-mode only:
  hasVoted?: boolean;
  voteLimitReached?: boolean;
  onToggleVote?: () => void;
  // Policy flag:
  secretVoting: boolean;
}

export function VotePill({
  voteCount,
  voters,
  participants,
  currentParticipantId,
  votingEnabled,
  isCompleted,
  hasVoted = false,
  voteLimitReached = false,
  onToggleVote,
  secretVoting,
}: VotePillProps) {
  const policy = votePillPolicy({
    voteCount,
    votingEnabled,
    isCompleted,
    hasVoted,
    secretVoting,
  });

  if (policy.render === 'none') return null;

  if (policy.render === 'voted-badge') {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleVote?.(); }}
        aria-pressed
        aria-label={policy.ariaLabel}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-transparent bg-[var(--accent-soft)] pl-2.5 pr-3 py-2 font-mono tabular-nums text-[11px] text-[var(--accent)] transition-[background-color,color,border-color] duration-150 sm:min-h-0 sm:pl-2 sm:pr-2.5 sm:py-1"
      >
        <ThumbsUp size={12} />
        <span className="text-[10px]">Voted</span>
      </button>
    );
  }

  // policy.render === 'pill'

  if (policy.popover === 'voters') {
    const voterIds = voters.map((v) => v.voter_id);
    const { entries, overflow } = formatVoterList(voterIds, participants, currentParticipantId);

    return (
      <PeoplePopover
        heading={
          <>
            <ThumbsUp size={12} />
            <span>Voters</span>
          </>
        }
        entries={entries}
        overflow={overflow}
        renderTrigger={({ onTriggerClick, onTriggerPointerDown }) => (
          <button
            type="button"
            onClick={onTriggerClick}
            onPointerDown={onTriggerPointerDown}
            aria-label={policy.ariaLabel}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-2 text-[11px] font-mono tabular-nums text-[var(--accent)] cursor-help transition-opacity hover:opacity-80 sm:min-h-0 sm:px-2 sm:py-0.5"
          >
            <ThumbsUp size={12} />
            <span className="text-[13px] font-semibold leading-none">{voteCount}</span>
          </button>
        )}
      />
    );
  }

  // Readonly + secret + count > 0 — static count badge, no popover
  if (!policy.interactive) {
    return (
      <span
        aria-label={policy.ariaLabel}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-mono tabular-nums text-[var(--accent)]"
      >
        <ThumbsUp size={12} />
        <span className="text-[13px] font-semibold leading-none">{voteCount}</span>
      </span>
    );
  }

  // Interactive (active board) — vote toggle button
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggleVote?.(); }}
      disabled={!hasVoted && voteLimitReached}
      aria-pressed={hasVoted}
      aria-label={policy.ariaLabel}
      title={voteLimitReached && !hasVoted ? 'No votes remaining' : undefined}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border pl-2.5 pr-3 py-2 font-mono tabular-nums text-[11px] transition-[background-color,color,border-color] duration-150 sm:min-h-0 sm:pl-2 sm:pr-2.5 sm:py-1',
        voteCount > 0
          ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent'
          : voteLimitReached
          ? 'cursor-not-allowed bg-[var(--bg-elev)] text-[var(--ink-5)] border-[var(--line)] opacity-50'
          : 'bg-[var(--bg-elev)] text-[var(--ink-3)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]',
        voteCount > 0 && !hasVoted && voteLimitReached && 'cursor-not-allowed'
      )}
    >
      <ThumbsUp size={12} className={cn(hasVoted && 'fill-current')} />
      {policy.showCount && <span className="text-[13px] font-semibold leading-none">{voteCount}</span>}
    </button>
  );
}
