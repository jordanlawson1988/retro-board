'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  rectIntersection,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { Link2, Check } from 'lucide-react';
import { getCardTextColor, CARD_TEXT_CLASSES } from '@/utils/cardColors';
import { cn } from '@/utils/cn';
import { AppShell } from '@/components/Layout';
import { Button, Modal } from '@/components/common';
import { BoardColumn, FacilitatorToolbar, VoteStatus, ViewToggle, SwimlaneView, ListView, TimelineView, ParticipantPopover, ConnectionStatusBanner, AddColumnButton } from '@/components/Board';
import type { BoardView } from '@/types';
import { useBoardStore } from '@/stores/boardStore';
import { useFeatureFlagStore } from '@/stores/featureFlagStore';
import { useTimer } from '@/hooks/useTimer';
import { usePolling } from '@/hooks/usePolling';
import { TimerFloating } from '@/components/Timer';
import { ActionItemsPanel } from '@/components/ActionItems';
import { exportMarkdown, exportCsv } from '@/utils/export';

export function BoardPage({ boardId }: { boardId: string }) {
  const router = useRouter();
  const {
    board,
    columns,
    cards,
    votes,
    participants,
    currentParticipantId,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    toggleVote,
    updateSettings,
    actionItems,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    completeBoard,
    onlineParticipantIds,
    updateParticipant,
    removeParticipant,
    addColumn,
    updateColumn,
    deleteColumn,
    combineCards,
    uncombineCard,
  } = useBoardStore();

  const [showActionItems, setShowActionItems] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Custom collision detection: prioritize combine drop zones, fall back to sort collision
  const combineAwareCollision: CollisionDetection = useCallback((args) => {
    // Check if dragged card overlaps any combine:* droppable (rect intersection is more forgiving than pointer)
    const rectCollisions = rectIntersection(args);
    const combineHit = rectCollisions.find(
      (c) => typeof c.id === 'string' && (c.id as string).startsWith('combine:')
    );
    if (combineHit) return [combineHit];
    // Fall back to standard sorting collision
    return closestCorners(args);
  }, []);

  const searchParams = useSearchParams();
  const currentView = (searchParams.get('view') as BoardView) || 'grid';

  const handleChangeView = useCallback((view: BoardView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === 'grid') {
      params.delete('view');
    } else {
      params.set('view', view);
    }
    router.push(`?${params.toString()}`);
  }, [searchParams, router]);

  const liveEventsEnabled = useFeatureFlagStore((s) => s.isEnabled('live_events'));

  const { timer, start: timerStart, pause: timerPause, resume: timerResume, reset: timerReset } = useTimer({
    boardId: boardId || '',
    liveSync: liveEventsEnabled && !!currentParticipantId,
  });

  usePolling(boardId, 10_000, !liveEventsEnabled && !!currentParticipantId);

  // Board data is fetched by BoardPageWrapper before this component mounts

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);

      if (!over || active.id === over.id) return;

      const activeIdStr = active.id as string;
      const overIdStr = over.id as string;

      const boardLocked = board?.settings.board_locked;
      const isArchived = !!board?.archived_at;
      const canCombine = !boardLocked && !isArchived;

      // Handle child card drag (uncombine or re-parent)
      if (activeIdStr.startsWith('child:')) {
        const childCardId = activeIdStr.slice(6);

        // If dropped on a combine zone → re-parent to new card
        if (overIdStr.startsWith('combine:') && canCombine) {
          const newParentId = overIdStr.slice(8);
          const childCard = cards.find((c) => c.id === childCardId);
          // Skip if already parented here (no-op)
          if (newParentId === childCard?.merged_with) return;
          combineCards(newParentId, childCardId);
          return;
        }

        // Otherwise → uncombine (becomes independent card)
        if (canCombine) {
          uncombineCard(childCardId);
        }
        return;
      }

      // Handle root card drop on combine zone → combine
      if (overIdStr.startsWith('combine:') && canCombine) {
        const targetCardId = overIdStr.slice(8);
        // Prevent self-combine
        if (targetCardId === activeIdStr) return;
        combineCards(targetCardId, activeIdStr);
        return;
      }

      // Normal reorder / cross-column move
      const cardId = activeIdStr;
      const overCard = cards.find((c) => c.id === overIdStr);
      const targetColumnId = overCard
        ? overCard.column_id
        : columns.find((c) => c.id === overIdStr)?.id;

      if (!targetColumnId) return;

      const targetCards = cards
        .filter((c) => c.column_id === targetColumnId && c.id !== cardId)
        .sort((a, b) => a.position - b.position);

      const overIndex = overCard
        ? targetCards.findIndex((c) => c.id === overIdStr)
        : targetCards.length;

      const newPosition = overIndex >= 0 ? overIndex : targetCards.length;

      moveCard(cardId, targetColumnId, newPosition);
    },
    [cards, columns, moveCard, combineCards, uncombineCard, board]
  );

  const handleAddCard = useCallback(
    (columnId: string, text: string) => {
      addCard(columnId, text);
    },
    [addCard]
  );

  const handleExportMarkdown = useCallback(() => {
    if (!board) return;
    exportMarkdown({
      boardTitle: board.title,
      boardDescription: board.description,
      columns,
      cards,
      votes,
      actionItems,
    });
  }, [board, columns, cards, votes, actionItems]);

  const handleExportCsv = useCallback(() => {
    if (!board) return;
    exportCsv({
      boardTitle: board.title,
      boardDescription: board.description,
      columns,
      cards,
      votes,
      actionItems,
    });
  }, [board, columns, cards, votes, actionItems]);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, []);

  const handleCopyJoinCode = useCallback(async () => {
    if (!board?.join_code) return;
    const joinUrl = `${window.location.origin}/board/${boardId}`;
    await navigator.clipboard.writeText(joinUrl);
    setJoinCodeCopied(true);
    setTimeout(() => setJoinCodeCopied(false), 2000);
  }, [board?.join_code, boardId]);

  const handleCompleteRetro = useCallback(async () => {
    await completeBoard();
    setShowCompleteModal(false);
  }, [completeBoard]);

  // Card preview for DragOverlay
  const dragOverlayContent = useMemo(() => {
    if (!activeDragId) return null;
    const isChild = activeDragId.startsWith('child:');
    const cardId = isChild ? activeDragId.slice(6) : activeDragId;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return null;
    const contrast = CARD_TEXT_CLASSES[getCardTextColor(card.color)];
    return (
      <div
        className={cn(
          'rounded-[var(--radius-md)] border border-[var(--color-gray-1)] p-3 shadow-lg',
          isChild ? 'w-[260px] rotate-1' : 'w-[280px] rotate-2'
        )}
        style={{ backgroundColor: card.color || 'var(--color-surface)' }}
      >
        <p className={cn(
          'whitespace-pre-wrap',
          isChild ? 'text-xs' : 'text-sm',
          contrast.text
        )}>
          {card.text}
        </p>
        <span className={cn('mt-1 block text-xs', contrast.subtext)}>
          {card.author_name}
        </span>
      </div>
    );
  }, [activeDragId, cards]);

  // Loading/error/join states are handled by BoardPageWrapper
  // This component only renders when board is loaded and user has joined
  if (!board) return null;

  const isJoined = !!currentParticipantId;
  const isObscured = board.settings.card_visibility === 'hidden';
  const isCompleted = !!board.archived_at;
  const currentParticipant = participants.find((p) => p.id === currentParticipantId);
  const isAdmin = currentParticipant?.is_admin ?? false;

  return (
    <AppShell
      headerRight={
        isAdmin && !isCompleted ? (
          <FacilitatorToolbar
            settings={board.settings}
            onUpdateSettings={updateSettings}
            actionItemCount={actionItems.length}
            onToggleActionItems={() => setShowActionItems((v) => !v)}
            isCompleted={isCompleted}
            onCompleteRetro={() => setShowCompleteModal(true)}
          />
        ) : undefined
      }
    >
      {/* Board header — sticky below the main header */}
      <div className="sticky top-16 z-30 border-b border-[var(--color-gray-1)] bg-[var(--color-surface-translucent)] px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h2 className="truncate text-lg sm:text-xl text-[var(--color-gray-8)]">
                  {board.title}
                  {isCompleted && (
                    <span className="ml-2 inline-flex items-center rounded-[var(--radius-full)] bg-[var(--color-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                      Completed
                    </span>
                  )}
                </h2>
                {board.join_code && (
                  <button
                    onClick={handleCopyJoinCode}
                    className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-navy)]/10 px-2.5 py-1 text-xs font-mono font-semibold text-[var(--color-navy)] transition-colors hover:bg-[var(--color-navy)]/20"
                    title="Click to copy join link"
                  >
                    {joinCodeCopied ? <Check size={12} /> : <Link2 size={12} />}
                    {joinCodeCopied ? 'Link Copied!' : `Join: ${board.join_code}`}
                  </button>
                )}
              </div>
              {board.description && (
                <p className="mt-1 text-sm text-[var(--color-gray-5)] line-clamp-1">{board.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <ParticipantPopover
                participants={participants}
                onlineParticipantIds={onlineParticipantIds}
                currentParticipantId={currentParticipantId}
                isAdmin={isAdmin}
                boardCreatorId={board.created_by}
                onPromote={(id) => updateParticipant(id, { is_admin: true })}
                onDemote={(id) => updateParticipant(id, { is_admin: false })}
                onRemove={(id) => removeParticipant(id)}
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-2 text-sm text-[var(--color-gray-6)] transition-colors hover:border-[var(--color-gray-3)] hover:text-[var(--color-gray-8)]"
              >
                {linkCopied ? <Check size={14} /> : <Link2 size={14} />}
                {linkCopied ? 'Copied!' : 'Share'}
              </button>
              {isJoined && board.settings.voting_enabled && (
                <VoteStatus
                  votesUsed={votes.filter((v) => v.voter_id === currentParticipantId).length}
                  maxVotes={board.settings.max_votes_per_participant}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Connection status */}
      <ConnectionStatusBanner />

      {/* View toggle */}
      {isJoined && columns.length > 0 && (
        <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6">
          <ViewToggle currentView={currentView} onChangeView={handleChangeView} />
        </div>
      )}

      {/* Board content */}
      {isJoined ? (
        columns.length > 0 ? (
          <>
            {currentView === 'grid' && (
              <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
                <DndContext
                  sensors={sensors}
                  collisionDetection={combineAwareCollision}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <div
                    className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:grid sm:overflow-x-visible sm:pb-0 sm:snap-none"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(columns.length + (isAdmin && !isCompleted ? 1 : 0), 4)}, minmax(280px, 1fr))`,
                    }}
                  >
                    {[...columns]
                      .sort((a, b) => a.position - b.position)
                      .map((col) => (
                        <BoardColumn
                          key={col.id}
                          column={col}
                          cards={cards.filter((c) => c.column_id === col.id)}
                          votes={votes}
                          currentParticipantId={currentParticipantId}
                          isObscured={isObscured}
                          votingEnabled={board.settings.voting_enabled}
                          secretVoting={board.settings.secret_voting}
                          cardCreationDisabled={
                            board.settings.card_creation_disabled || board.settings.board_locked
                          }
                          maxVotesPerParticipant={board.settings.max_votes_per_participant}
                          onAddCard={handleAddCard}
                          onUpdateCard={updateCard}
                          onDeleteCard={deleteCard}
                          onToggleVote={toggleVote}
                          onCombineCards={combineCards}
                          onUncombineCard={uncombineCard}
                          isCompleted={isCompleted}
                          isAdmin={isAdmin}
                          boardLocked={board.settings.board_locked}
                          activeDragId={activeDragId}
                          onUpdateColumn={updateColumn}
                          onDeleteColumn={deleteColumn}
                          canDeleteColumn={columns.length > 1}
                        />
                      ))}
                    {isAdmin && !isCompleted && (
                      <AddColumnButton
                        columnCount={columns.length}
                        onAddColumn={addColumn}
                      />
                    )}
                  </div>

                  {/* Drag overlay — visual preview of card being dragged */}
                  <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                    {dragOverlayContent}
                  </DragOverlay>
                </DndContext>
              </div>
            )}

            {currentView === 'swimlane' && (
              <SwimlaneView
                columns={columns}
                cards={cards}
                votes={votes}
                currentParticipantId={currentParticipantId}
                isObscured={isObscured}
                isCompleted={isCompleted}
                votingEnabled={board.settings.voting_enabled}
                secretVoting={board.settings.secret_voting}
                maxVotesPerParticipant={board.settings.max_votes_per_participant}
                onUpdateCard={updateCard}
                onDeleteCard={deleteCard}
                onToggleVote={toggleVote}
              />
            )}

            {currentView === 'list' && (
              <ListView
                columns={columns}
                cards={cards}
                votes={votes}
                currentParticipantId={currentParticipantId}
                isObscured={isObscured}
                votingEnabled={board.settings.voting_enabled}
                maxVotesPerParticipant={board.settings.max_votes_per_participant}
                onToggleVote={toggleVote}
              />
            )}

            {currentView === 'timeline' && (
              <TimelineView
                columns={columns}
                cards={cards}
                votes={votes}
                currentParticipantId={currentParticipantId}
                isObscured={isObscured}
                votingEnabled={board.settings.voting_enabled}
                maxVotesPerParticipant={board.settings.max_votes_per_participant}
                onToggleVote={toggleVote}
              />
            )}
          </>
        ) : (
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
            {isAdmin && !isCompleted ? (
              <div className="flex justify-center">
                <AddColumnButton
                  columnCount={0}
                  onAddColumn={addColumn}
                />
              </div>
            ) : (
              <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-gray-2)] bg-[var(--color-surface-subtle)] p-12 text-center">
                <p className="text-lg font-medium text-[var(--color-gray-5)]">No columns yet</p>
                <p className="mt-2 text-sm text-[var(--color-gray-4)]">
                  The board admin can add columns to get started.
                </p>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          <div className="py-12 text-center">
            <p className="text-[var(--color-gray-5)]">Join the board to participate</p>
          </div>
        </div>
      )}

      {/* Complete Retro Modal */}
      <Modal
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Complete Retrospective"
      >
        <div className="flex flex-col gap-4">
          <p className="text-[var(--color-gray-5)]">
            The board will become read-only. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowCompleteModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteRetro}>
              Complete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Panel overlay */}
      {showActionItems && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={() => setShowActionItems(false)}
        />
      )}

      {/* Floating Timer */}
      {isJoined && !isCompleted && (
        <TimerFloating
          timer={timer}
          isAdmin={isAdmin}
          onStart={timerStart}
          onPause={timerPause}
          onResume={timerResume}
          onReset={timerReset}
        />
      )}

      {/* Action Items Panel */}
      {isJoined && (
        <ActionItemsPanel
          open={showActionItems}
          onClose={() => setShowActionItems(false)}
          actionItems={actionItems}
          participants={participants}
          onAddItem={addActionItem}
          onUpdateItem={updateActionItem}
          onDeleteItem={deleteActionItem}
          onExportMarkdown={handleExportMarkdown}
          onExportCsv={handleExportCsv}
          readOnly={isCompleted}
        />
      )}
    </AppShell>
  );
}
