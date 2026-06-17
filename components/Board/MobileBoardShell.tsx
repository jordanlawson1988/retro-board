'use client';

/**
 * MobileBoardShell — rendered below 768px in BoardPage.
 *
 * Design choice: this component receives all already-derived data and
 * handlers as props from BoardPage (approach a), rather than reading the
 * store directly. This guarantees the card-prop mapping is identical to the
 * desktop path (single source of truth in BoardPage), and avoids any
 * divergence in how votes, obscurity, and board state are computed.
 *
 * No new store fields, no new API calls — same data, different layout.
 */

import { useState, useMemo, useCallback } from 'react';
import { StickyNote } from 'lucide-react';
import { MobileColumnTabs } from './MobileColumnTabs';
import { MobileVoteTracker } from './MobileVoteTracker';
import { MobileFAB } from './MobileFAB';
import { MobileBottomNav } from './MobileBottomNav';
import { computeMobileNavActive } from '@/lib/mobileNav';
import { MobileCardComposerSheet } from './MobileCardComposerSheet';
import { MobileMoreSheet } from './MobileMoreSheet';
import { ConnectionStatusBanner } from './ConnectionStatusBanner';
import { RetroCard } from './RetroCard';
import { ColumnSortMenu } from './ColumnSortMenu';
import { sortCards } from '@/utils/sortCards';
import type { Column, Card, Vote, ActionItem, CardReactions, Participant, CardSort, BoardSettings } from '@/types';

interface MobileBoardShellProps {
  // Board state
  columns: Column[];
  cards: Card[];
  votes: Vote[];
  actionItems: ActionItem[];
  currentParticipantId: string | null;
  isObscured: boolean;
  isCompleted: boolean;
  isAdmin: boolean;
  votingEnabled: boolean;
  secretVoting: boolean;
  cardCreationDisabled: boolean;
  maxVotesPerParticipant: number;
  boardLocked: boolean;
  // Handlers (exact same signatures as desktop)
  onAddCard: (columnId: string, text: string) => void;
  onUpdateCard: (cardId: string, updates: Partial<{ text: string; color: string | null }>) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleVote: (cardId: string) => void;
  onToggleReaction: (cardId: string, emoji: string) => void;
  onCombineCards: (parentCardId: string, childCardId: string) => void;
  onUncombineCard: (childCardId: string) => void;
  participants: Participant[];
  onlineParticipantIds: string[];
  boardCreatorId: string;
  onPromoteParticipant: (participantId: string) => void;
  onDemoteParticipant: (participantId: string) => void;
  onRemoveParticipant: (participantId: string) => void;
  onUpdateColumn?: (columnId: string, updates: { sort_by: CardSort }) => void;
  // New props wired from BoardPage
  boardTitle: string;
  joinCode: string | null;
  settings: BoardSettings;
  onUpdateSettings: (settings: Partial<BoardSettings>) => void;
  actionsOpen: boolean;
  onOpenActionItems: () => void;
  onCloseActionItems: () => void;
  onCompleteRetro: () => void;
}

export function MobileBoardShell({
  columns,
  cards,
  votes,
  actionItems,
  currentParticipantId,
  isObscured,
  isCompleted,
  isAdmin,
  votingEnabled,
  secretVoting,
  cardCreationDisabled,
  maxVotesPerParticipant,
  boardLocked,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onToggleVote,
  onToggleReaction,
  onCombineCards,
  onUncombineCard,
  participants,
  onlineParticipantIds,
  boardCreatorId,
  onPromoteParticipant,
  onDemoteParticipant,
  onRemoveParticipant,
  onUpdateColumn,
  boardTitle,
  joinCode,
  settings,
  onUpdateSettings,
  actionsOpen,
  onOpenActionItems,
  onCloseActionItems,
  onCompleteRetro,
}: MobileBoardShellProps) {
  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns]
  );

  const [activeColumnId, setActiveColumnId] = useState<string>(
    () => sortedColumns[0]?.id ?? ''
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  // Keep activeColumnId valid when columns change (e.g., real-time add/delete)
  const safeActiveColumnId = useMemo(() => {
    const found = sortedColumns.find((c) => c.id === activeColumnId);
    return found ? activeColumnId : (sortedColumns[0]?.id ?? '');
  }, [sortedColumns, activeColumnId]);

  const activeColumn = useMemo(
    () => sortedColumns.find((c) => c.id === safeActiveColumnId) ?? sortedColumns[0],
    [sortedColumns, safeActiveColumnId]
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

  // Root cards for the active column (no merged-children in top-level list)
  const rootCards = useMemo(
    () => sortCards(
      cards.filter((c) => c.column_id === activeColumn?.id && !c.merged_with),
      activeColumn?.sort_by ?? 'votes_desc',
      voteCountFor
    ),
    [cards, activeColumn, voteCountFor]
  );

  // Votes used by the current participant (derived from store votes array)
  const votesUsed = useMemo(
    () => (currentParticipantId
      ? votes.filter((v) => v.voter_id === currentParticipantId).length
      : 0),
    [votes, currentParticipantId]
  );

  const voteLimitReached = votesUsed >= maxVotesPerParticipant;
  const canMerge = !isCompleted && !boardLocked;
  // Single source of truth for whether the add-card FAB is shown — reused by
  // the empty-state copy so it never says "tap +" when there is no +.
  const fabVisible = !cardCreationDisabled && !isCompleted && !!currentParticipantId;

  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);

  const handleMergeTarget = (targetCardId: string) => {
    if (mergeSourceId && mergeSourceId !== targetCardId) {
      onCombineCards(targetCardId, mergeSourceId);
      setMergeSourceId(null);
    }
  };

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-[var(--bg)]">
      {/* Connection status banner */}
      <ConnectionStatusBanner />

      {/* Vote tracker row — only shown when voting is enabled and user has joined */}
      {votingEnabled && !!currentParticipantId && (
        <MobileVoteTracker used={votesUsed} total={maxVotesPerParticipant} />
      )}

      {/* Column tab strip */}
      {sortedColumns.length > 0 && (
        <MobileColumnTabs
          columns={sortedColumns}
          activeColumnId={safeActiveColumnId}
          onSelect={(id) => {
            setActiveColumnId(id);
            setMergeSourceId(null);
          }}
        />
      )}

      {/* Merge mode banner */}
      {mergeSourceId && (
        <div className="shrink-0 flex items-center justify-between bg-[var(--accent-soft)] px-4 py-2 text-sm">
          <span className="text-[var(--accent)] font-medium text-[13px]">
            Select a card to merge into
          </span>
          <button
            type="button"
            onClick={() => setMergeSourceId(null)}
            className="rounded-[var(--r-sm)] px-3 py-1 text-xs text-[var(--ink-4)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Per-column sort control (admin only) */}
      {isAdmin && onUpdateColumn && activeColumn && (
        <div className="shrink-0 flex items-center justify-end px-4 pt-2">
          <ColumnSortMenu
            value={activeColumn.sort_by}
            onChange={(next) => onUpdateColumn(activeColumn.id, { sort_by: next })}
          />
        </div>
      )}

      {/* Card list for active column — the ONLY scroll region on mobile */}
      <div className="flex-1 min-h-0 px-4 pt-3 pb-[calc(84px+var(--safe-bottom))] flex flex-col gap-2 overflow-y-auto overscroll-contain">
        {rootCards.length > 0 ? (
          rootCards.map((card) => {
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
                votes={votes}
                hasVoted={hasVoted}
                isAuthor={card.author_id === currentParticipantId}
                isObscured={isObscured}
                votingEnabled={votingEnabled}
                secretVoting={secretVoting}
                voteLimitReached={voteLimitReached}
                onUpdate={onUpdateCard}
                onDelete={onDeleteCard}
                onToggleVote={onToggleVote}
                reactions={(card.reactions ?? {}) as CardReactions}
                onToggleReaction={onToggleReaction}
                isCompleted={isCompleted}
                currentParticipantId={currentParticipantId}
                canMerge={canMerge}
                isMergeSource={mergeSourceId === card.id}
                isMergeTarget={mergeSourceId !== null && mergeSourceId !== card.id}
                onStartMerge={() => setMergeSourceId(card.id)}
                onAcceptMerge={() => handleMergeTarget(card.id)}
                onCancelMerge={() => setMergeSourceId(null)}
                onUncombineCard={onUncombineCard}
                participants={participants}
              />
            );
          })
        ) : (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--surface-muted)] text-[var(--ink-4)]">
              <StickyNote size={22} />
            </div>
            <p className="text-[13px] text-[var(--ink-4)]">
              {cardCreationDisabled
                ? 'Card creation is disabled.'
                : isCompleted
                ? 'No cards in this column.'
                : fabVisible
                ? 'No cards yet — tap the + button to add the first one.'
                : 'No cards yet.'}
            </p>
          </div>
        )}
      </div>

      {/* FAB — only when card creation is allowed */}
      {fabVisible && (
        <MobileFAB onClick={() => setComposerOpen(true)} />
      )}

      {/* Bottom nav — honest toolbar: active reflects which sheet is open */}
      <MobileBottomNav
        active={computeMobileNavActive({ moreOpen, actionsOpen })}
        onSelect={(key) => {
          if (key === 'board') {
            setMoreOpen(false);
            onCloseActionItems();
          }
          if (key === 'actions') onOpenActionItems();
          if (key === 'more') setMoreOpen(true);
        }}
        actionBadgeCount={actionItems.filter((i) => i.status !== 'done').length}
      />

      {/* More sheet */}
      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        boardTitle={boardTitle}
        joinCode={joinCode}
        participants={participants}
        onlineParticipantIds={onlineParticipantIds}
        currentParticipantId={currentParticipantId}
        boardCreatorId={boardCreatorId}
        onPromoteParticipant={onPromoteParticipant}
        onDemoteParticipant={onDemoteParticipant}
        onRemoveParticipant={onRemoveParticipant}
        isAdmin={isAdmin}
        isCompleted={isCompleted}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        actionItemCount={actionItems.length}
        onToggleActionItems={onOpenActionItems}
        onCompleteRetro={onCompleteRetro}
      />

      {/* Card composer sheet */}
      {activeColumn && (
        <MobileCardComposerSheet
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          onSubmit={(text) => onAddCard(activeColumn.id, text)}
          columnTitle={activeColumn.title}
        />
      )}
    </div>
  );
}
