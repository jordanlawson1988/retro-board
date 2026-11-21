'use client';

import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useBoardStore } from '@/stores/boardStore';
import { useGroupVoteStore } from '@/stores/groupVoteStore';
import { GUIDED_MODE } from '@/lib/constants/phases';
import { maxVotesPerCard, myGroupVotesOn, myVotesOn, voteControlState, votesUsedBy } from '@/lib/votes';

interface GuidedVoteControlProps {
  cardId: string;
  /** A card inside a group: it shows only the person's own votes on it, never an add button. */
  childCard: boolean;
}

const BUTTON =
  'grid min-h-11 min-w-11 place-items-center rounded-full transition-colors sm:min-h-0 sm:min-w-0 sm:p-1.5 ' +
  'enabled:hover:bg-[var(--surface-muted)] enabled:hover:text-[var(--ink)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] ' +
  'disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Add or remove a vote on a card of a guided board. Every number comes from the store through
 * `voteControlState`; clicks are optimistic, so the buttons are disabled only by the limits.
 * Mounted only on a guided board (RetroCard decides), and each selector returns a number.
 */
export function GuidedVoteControl({ cardId, childCard }: GuidedVoteControlProps) {
  const addVote = useGroupVoteStore((s) => s.addVote);
  const removeVote = useGroupVoteStore((s) => s.removeVote);
  const onCard = useBoardStore((s) =>
    s.board?.mode !== GUIDED_MODE
      ? 0
      : childCard
        ? myVotesOn(s.votes, cardId, s.currentParticipantId)
        : myGroupVotesOn(s.votes, s.cards, cardId, s.currentParticipantId),
  );
  const spent = useBoardStore((s) =>
    s.board?.mode === GUIDED_MODE ? votesUsedBy(s.votes, s.currentParticipantId) : 0,
  );
  const perCard = useBoardStore((s) => (s.board?.mode === GUIDED_MODE ? maxVotesPerCard(s.board.settings) : 0));
  const perPerson = useBoardStore((s) =>
    s.board?.mode === GUIDED_MODE ? s.board.settings.max_votes_per_participant : 0,
  );
  const reasonId = useId();

  if (childCard && onCard === 0) return null;

  const { canAdd, canRemove, addBlockedReason } = voteControlState({ onCard, spent, perCard, perPerson, childCard });

  return (
    <div
      role="group"
      aria-label="Your votes on this card"
      data-testid="vote-stepper"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-center rounded-full border font-mono tabular-nums',
        onCard > 0
          ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-hover)]'
          : 'border-[var(--line)] bg-[var(--bg-elev)] text-[var(--ink-3)]',
      )}
    >
      <button
        type="button"
        aria-label="Remove a vote"
        disabled={!canRemove}
        onClick={() => removeVote(cardId).catch(() => {})}
        className={BUTTON}
      >
        <Minus size={14} aria-hidden />
      </button>
      <span aria-live="polite" className="min-w-5 text-center text-[13px] font-semibold leading-none">
        {onCard}
      </span>
      {!childCard && (
        <>
          <button
            type="button"
            aria-label="Add a vote"
            disabled={!canAdd}
            title={addBlockedReason ?? undefined}
            aria-describedby={addBlockedReason ? reasonId : undefined}
            onClick={() => addVote(cardId).catch(() => {})}
            className={BUTTON}
          >
            <Plus size={14} aria-hidden />
          </button>
          {addBlockedReason && (
            <span id={reasonId} className="sr-only">
              {addBlockedReason}
            </span>
          )}
        </>
      )}
    </div>
  );
}
