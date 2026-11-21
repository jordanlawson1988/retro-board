'use client';

import { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { isMine } from '@/utils/isMine';
import { useCardText } from '@/hooks/useCardText';
import { VotePill } from './VotePill';
import { GuidedVoteControl } from './GuidedVoteControl';
import { useBoardStore } from '@/stores/boardStore';
import { GUIDED_MODE } from '@/lib/constants/phases';
import { voteTotalsRevealed } from '@/lib/votePillPolicy';
import { hasVotedOn, leadCardVotes, voteSurface, voteTotalsByCard, votesUsedBy } from '@/lib/votes';
import type { Column, Card, Vote, Participant } from '@/types';

interface TimelineViewProps {
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  currentParticipantId: string | null;
  isObscured: boolean;
  votingEnabled: boolean;
  maxVotesPerParticipant: number;
  onToggleVote: (cardId: string) => void;
  isCompleted: boolean;
  secretVoting: boolean;
  participants: Participant[];
}

interface TimelineGroup {
  timestamp: string; // HH:MM
  cards: Card[];
}

export function TimelineView({
  columns,
  cards,
  votes,
  currentParticipantId,
  isObscured,
  votingEnabled,
  maxVotesPerParticipant,
  onToggleVote,
  isCompleted,
  secretVoting,
  participants,
}: TimelineViewProps) {
  const cardText = useCardText();
  // Two primitives read once for the whole view (not per row): an open board answers false and 'pill'.
  const guided = useBoardStore((s) => s.board?.mode === GUIDED_MODE);
  const surface = useBoardStore((s) =>
    s.board ? voteSurface(s.board.mode, s.board.settings, votingEnabled && !isCompleted, false) : 'pill'
  );
  const columnMap = useMemo(() => {
    const map = new Map<string, Column>();
    for (const col of columns) {
      map.set(col.id, col);
    }
    return map;
  }, [columns]);

  const voteCountMap = useMemo(() => voteTotalsByCard(votes), [votes]);

  const voteLimitReached = useMemo(() => {
    if (!currentParticipantId) return false;
    return votesUsedBy(votes, currentParticipantId) >= maxVotesPerParticipant;
  }, [votes, currentParticipantId, maxVotesPerParticipant]);

  const groups = useMemo((): TimelineGroup[] => {
    const sorted = [...cards].filter((c) => !c.merged_with).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const result: TimelineGroup[] = [];

    for (const card of sorted) {
      const cardDate = new Date(card.created_at);
      const hh = String(cardDate.getHours()).padStart(2, '0');
      const mm = String(cardDate.getMinutes()).padStart(2, '0');
      const timestamp = `${hh}:${mm}`;

      // Group cards within ~1 minute (same HH:MM)
      const lastGroup = result[result.length - 1];
      if (lastGroup && lastGroup.timestamp === timestamp) {
        lastGroup.cards.push(card);
      } else {
        result.push({ timestamp, cards: [card] });
      }
    }

    return result;
  }, [cards]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      {groups.length === 0 ? (
        <div className="rounded-[var(--r-lg)] border-2 border-dashed border-[var(--line)] bg-[var(--surface-muted)] p-12 text-center">
          <p className="text-sm text-[var(--ink-4)]">No cards to display</p>
        </div>
      ) : (
        <div className="relative ml-4">
          {/* Vertical timeline connector line */}
          <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-[var(--line)]" />

          {groups.map((group, gi) => (
            <div key={gi} className="relative mb-6 pl-8">
              {/* Timeline dot — outer ring uses surface bg + line-strong border */}
              <div className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--line-strong)] bg-[var(--surface)]" />

              {/* Timestamp */}
              <div className="mb-2 text-[11px] font-medium font-mono tabular-nums text-[var(--ink-4)]">
                {group.timestamp}
              </div>

              {/* Cards in this group */}
              <div className="flex flex-col gap-2">
                {group.cards.map((card) => {
                  const col = columnMap.get(card.column_id);
                  const voteCount = leadCardVotes(guided, card.id, cards, voteCountMap);
                  const hasVoted = hasVotedOn(guided, votes, cards, card.id, currentParticipantId);
                  const blurred = (isObscured && !isMine(card, currentParticipantId)) || !!card.text_hidden;

                  return (
                    <div
                      key={card.id}
                      className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm"
                      style={card.color ? { borderLeftWidth: 3, borderLeftColor: card.color } : undefined}
                    >
                      {/* Column tag + author */}
                      <div className="mb-1.5 flex items-center gap-2">
                        {col && (
                          <span
                            className="inline-flex items-center rounded-[var(--r-pill)] px-2 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: col.color }}
                          >
                            {col.title}
                          </span>
                        )}
                        <span className="text-xs text-[var(--ink-4)]">
                          {card.author_name ?? 'Anonymous'}
                        </span>
                      </div>

                      {/* Card text */}
                      <p
                        className={cn(
                          'whitespace-pre-wrap text-sm text-[var(--ink)]',
                          blurred && 'select-none blur-sm'
                        )}
                      >
                        {cardText(card)}
                      </p>

                      {/* Vote count — also shown as totals once voting is off */}
                      {(votingEnabled || (voteCount > 0 && voteTotalsRevealed(secretVoting, isCompleted))) && (
                        <div className="mt-2 flex items-center">
                          {surface === 'stepper' ? (
                            <GuidedVoteControl cardId={card.id} childCard={false} />
                          ) : (
                            <VotePill
                              voteCount={voteCount}
                              voters={votes.filter((v) => v.card_id === card.id)}
                              participants={participants}
                              currentParticipantId={currentParticipantId}
                              votingEnabled={votingEnabled}
                              isCompleted={isCompleted}
                              hasVoted={hasVoted}
                              voteLimitReached={voteLimitReached}
                              onToggleVote={() => onToggleVote(card.id)}
                              secretVoting={secretVoting}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
