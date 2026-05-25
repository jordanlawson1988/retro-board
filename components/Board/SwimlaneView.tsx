'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { RetroCard } from './RetroCard';
import { ColumnSortMenu } from './ColumnSortMenu';
import { sortCards } from '@/utils/sortCards';
import type { Column, Card, Vote, Participant, CardSort } from '@/types';

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
  participants?: Participant[];
  isAdmin?: boolean;
  onUpdateColumn?: (columnId: string, updates: { sort_by: CardSort }) => void;
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
  participants = [],
  isAdmin,
  onUpdateColumn,
}: SwimlaneViewProps) {
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set());

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns]
  );

  const voteCountByCard = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of votes) map.set(v.card_id, (map.get(v.card_id) || 0) + 1);
    return map;
  }, [votes]);

  const voteCountFor = useCallback(
    (id: string) => voteCountByCard.get(id) || 0,
    [voteCountByCard]
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
          const colCards = sortCards(
            cards.filter((c) => c.column_id === col.id && !c.merged_with),
            col.sort_by,
            voteCountFor
          );
          const isCollapsed = collapsedRows.has(col.id);
          const colVoteCount = votes.filter((v) =>
            colCards.some((c) => c.id === v.card_id)
          ).length;

          return (
            <div
              key={col.id}
              className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface-muted)]"
            >
              {/* Column swimlane header */}
              <div className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]">
                <button
                  onClick={() => toggleRow(col.id)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight size={16} className="shrink-0 text-[var(--ink-4)]" />
                  ) : (
                    <ChevronDown size={16} className="shrink-0 text-[var(--ink-4)]" />
                  )}
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    {col.title}
                  </span>
                  <span className="rounded-[var(--r-pill)] bg-[var(--bg-elev)] px-2 py-0.5 text-xs font-medium text-[var(--ink-4)]">
                    {colCards.length}
                  </span>
                  {votingEnabled && !secretVoting && colVoteCount > 0 && (
                    <span className="flex items-center gap-1 rounded-[var(--r-pill)] bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                      {colVoteCount} vote{colVoteCount === 1 ? '' : 's'}
                    </span>
                  )}
                </button>
                {isAdmin && onUpdateColumn && (
                  <ColumnSortMenu
                    value={col.sort_by}
                    onChange={(next) => onUpdateColumn(col.id, { sort_by: next })}
                  />
                )}
              </div>

              {/* Column cards */}
              {!isCollapsed && (
                <div className="border-t border-[var(--line)] p-3">
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
                            participants={participants}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[var(--r-sm)] border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--ink-3)]">
                      No cards in this column
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sortedColumns.length === 0 && (
          <div className="rounded-[var(--r-lg)] border-2 border-dashed border-[var(--line)] bg-[var(--surface-muted)] p-12 text-center">
            <p className="text-sm text-[var(--ink-4)]">No columns to display</p>
          </div>
        )}
      </div>
    </div>
  );
}
