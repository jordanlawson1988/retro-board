'use client';

import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Column, Card, Vote } from '@/types';

interface ListViewProps {
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  currentParticipantId: string | null;
  isObscured: boolean;
  votingEnabled: boolean;
  maxVotesPerParticipant: number;
  onToggleVote: (cardId: string) => void;
}

type SortField = 'column' | 'card' | 'author' | 'votes';
type SortDir = 'asc' | 'desc';

export function ListView({
  columns,
  cards,
  votes,
  currentParticipantId,
  isObscured,
  votingEnabled,
  maxVotesPerParticipant,
  onToggleVote,
}: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('column');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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

  const sortedCards = useMemo(() => {
    const sorted = [...cards].filter((c) => !c.merged_with);
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'column': {
          const colA = columnMap.get(a.column_id);
          const colB = columnMap.get(b.column_id);
          cmp = (colA?.position ?? 0) - (colB?.position ?? 0);
          break;
        }
        case 'card':
          cmp = a.text.localeCompare(b.text);
          break;
        case 'author':
          cmp = a.author_name.localeCompare(b.author_name);
          break;
        case 'votes': {
          const va = voteCountMap.get(a.id) || 0;
          const vb = voteCountMap.get(b.id) || 0;
          cmp = va - vb;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [cards, sortField, sortDir, columnMap, voteCountMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ArrowUp size={12} className="shrink-0 text-[var(--accent)]" />
    ) : (
      <ArrowDown size={12} className="shrink-0 text-[var(--accent)]" />
    );
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--bg-elev)]">
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('column')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)] hover:text-[var(--ink)]"
                >
                  Column
                  {sortIcon('column')}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('card')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)] hover:text-[var(--ink)]"
                >
                  Card
                  {sortIcon('card')}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('author')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)] hover:text-[var(--ink)]"
                >
                  Author
                  {sortIcon('author')}
                </button>
              </th>
              {votingEnabled && (
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('votes')}
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)] hover:text-[var(--ink)]"
                  >
                    Votes
                    {sortIcon('votes')}
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedCards.map((card) => {
              const col = columnMap.get(card.column_id);
              const voteCount = voteCountMap.get(card.id) || 0;
              const hasVoted = votes.some(
                (v) => v.card_id === card.id && v.voter_id === currentParticipantId
              );
              const blurred = isObscured && card.author_id !== currentParticipantId;

              return (
                <tr
                  key={card.id}
                  className="border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--surface-hover)]"
                >
                  <td
                    className="px-4 py-3"
                    style={card.color ? { borderLeft: `3px solid ${card.color}` } : undefined}
                  >
                    {col && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: col.color }}
                      >
                        {col.title}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-sm text-[var(--ink)]',
                        blurred && 'select-none blur-sm'
                      )}
                    >
                      {card.text}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--ink-4)]">{card.author_name}</span>
                  </td>
                  {votingEnabled && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onToggleVote(card.id)}
                        disabled={!hasVoted && voteLimitReached}
                        className={cn(
                          'flex items-center gap-1 rounded-[var(--r-pill)] px-2 py-0.5 text-xs font-mono tabular-nums transition-colors',
                          hasVoted
                            ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                            : 'text-[var(--ink-4)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink-2)]'
                        )}
                      >
                        <ThumbsUp size={12} />
                        <span>{voteCount}</span>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {sortedCards.length === 0 && (
              <tr>
                <td
                  colSpan={votingEnabled ? 4 : 3}
                  className="px-4 py-12 text-center text-sm text-[var(--ink-4)]"
                >
                  No cards to display
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
