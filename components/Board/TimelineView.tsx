'use client';

import { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { VotePill } from './VotePill';
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
  const columnMap = useMemo(() => {
    const map = new Map<string, Column>();
    for (const col of columns) {
      map.set(col.id, col);
    }
    return map;
  }, [columns]);

  const voteCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const vote of votes) {
      map.set(vote.card_id, (map.get(vote.card_id) || 0) + 1);
    }
    return map;
  }, [votes]);

  const voteLimitReached = useMemo(() => {
    if (!currentParticipantId) return false;
    return votes.filter((v) => v.voter_id === currentParticipantId).length >= maxVotesPerParticipant;
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
                  const voteCount = voteCountMap.get(card.id) || 0;
                  const hasVoted = votes.some(
                    (v) => v.card_id === card.id && v.voter_id === currentParticipantId
                  );
                  const blurred = isObscured && card.author_id !== currentParticipantId;

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
                          {card.author_name}
                        </span>
                      </div>

                      {/* Card text */}
                      <p
                        className={cn(
                          'whitespace-pre-wrap text-sm text-[var(--ink)]',
                          blurred && 'select-none blur-sm'
                        )}
                      >
                        {card.text}
                      </p>

                      {/* Vote count */}
                      {votingEnabled && (
                        <div className="mt-2 flex items-center">
                          <VotePill
                            voteCount={voteCount}
                            voters={votes.filter((v) => v.card_id === card.id)}
                            participants={participants}
                            currentParticipantId={currentParticipantId}
                            mode={isCompleted ? 'readonly' : 'interactive'}
                            hasVoted={hasVoted}
                            voteLimitReached={voteLimitReached}
                            onToggleVote={() => onToggleVote(card.id)}
                            secretVoting={secretVoting}
                          />
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
