'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { RetroCard } from './RetroCard';
import type { Column, Card, Vote } from '@/types';

interface SwimlaneViewProps {
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  currentParticipantId: string | null;
  isObscured: boolean;
  isCompleted: boolean;
  votingEnabled: boolean;
  secretVoting: boolean;
  maxVotesPerParticipant: number;
  onUpdateCard: (cardId: string, updates: Partial<{ text: string; color: string | null }>) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleVote: (cardId: string) => void;
  onToggleReaction?: (cardId: string, emoji: string) => void;
}

export function SwimlaneView({
  columns,
  cards,
  votes,
  currentParticipantId,
  isObscured,
  isCompleted,
  votingEnabled,
  secretVoting,
  maxVotesPerParticipant,
  onUpdateCard,
  onDeleteCard,
  onToggleVote,
  onToggleReaction,
}: SwimlaneViewProps) {
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set());

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns]
  );

  const voteLimitReached = useMemo(() => {
    if (!currentParticipantId) return false;
    const myVoteCount = votes.filter((v) => v.voter_id === currentParticipantId).length;
    return myVoteCount >= maxVotesPerParticipant;
  }, [votes, currentParticipantId, maxVotesPerParticipant]);

  const toggleRow = (columnId: string) => {
    setCollapsedRows((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3">
        {sortedColumns.map((col) => {
          const colCards = cards
            .filter((c) => c.column_id === col.id && !c.merged_with)
            .sort((a, b) => {
              const aVotes = votes.filter((v) => v.card_id === a.id).length;
              const bVotes = votes.filter((v) => v.card_id === b.id).length;
              if (bVotes !== aVotes) return bVotes - aVotes;
              return a.position - b.position;
            });
          const isCollapsed = collapsedRows.has(col.id);
          const colVoteCount = votes.filter((v) =>
            colCards.some((c) => c.id === v.card_id)
          ).length;

          return (
            <div
              key={col.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface-dim)]"
            >
              {/* Column swimlane header */}
              <button
                onClick={() => toggleRow(col.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-gray-0)]"
              >
                {isCollapsed ? (
                  <ChevronRight size={16} className="shrink-0 text-[var(--color-gray-4)]" />
                ) : (
                  <ChevronDown size={16} className="shrink-0 text-[var(--color-gray-4)]" />
                )}
                <div
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="text-sm font-semibold text-[var(--color-gray-8)]">
                  {col.title}
                </span>
                <span className="rounded-[var(--radius-full)] bg-[var(--color-gray-1)] px-2 py-0.5 text-xs font-medium text-[var(--color-gray-5)]">
                  {colCards.length}
                </span>
                {votingEnabled && !secretVoting && colVoteCount > 0 && (
                  <span className="flex items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-navy)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-navy)]">
                    {colVoteCount} vote{colVoteCount === 1 ? '' : 's'}
                  </span>
                )}
              </button>

              {/* Column cards */}
              {!isCollapsed && (
                <div className="border-t border-[var(--color-gray-1)] p-3">
                  {colCards.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {colCards.map((card) => {
                        const cardVotes = votes.filter((v) => v.card_id === card.id);
                        const hasVoted = cardVotes.some((v) => v.voter_id === currentParticipantId);

                        return (
                          <RetroCard
                            key={card.id}
                            id={card.id}
                            text={card.text}
                            authorName={card.author_name}
                            authorId={card.author_id}
                            color={card.color}
                            voteCount={cardVotes.length}
                            hasVoted={hasVoted}
                            isAuthor={card.author_id === currentParticipantId}
                            isObscured={isObscured}
                            votingEnabled={votingEnabled}
                            secretVoting={secretVoting}
                            voteLimitReached={voteLimitReached}
                            onUpdate={onUpdateCard}
                            onDelete={onDeleteCard}
                            onToggleVote={onToggleVote}
                            reactions={card.reactions}
                            onToggleReaction={onToggleReaction}
                            isCompleted={isCompleted}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-gray-1)] p-6 text-center text-sm text-[var(--color-gray-3)]">
                      No cards in this column
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sortedColumns.length === 0 && (
          <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-gray-2)] bg-[var(--color-surface-subtle)] p-12 text-center">
            <p className="text-sm text-[var(--color-gray-4)]">No columns to display</p>
          </div>
        )}
      </div>
    </div>
  );
}
