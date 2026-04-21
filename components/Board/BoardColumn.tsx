'use client';

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ThumbsUp, Trash2, Palette, Unlink, Layers } from 'lucide-react';
import { cn } from '@/utils/cn';
import { COLUMN_COLORS } from '@/utils/constants';
import { RetroCard } from './RetroCard';
import { SortableCard } from './SortableCard';
import { AddCardForm } from './AddCardForm';
import type { Column, Card, Vote } from '@/types';

interface BoardColumnProps {
  column: Column;
  cards: Card[];
  votes: Vote[];
  currentParticipantId: string | null;
  isObscured: boolean;
  votingEnabled: boolean;
  secretVoting: boolean;
  cardCreationDisabled: boolean;
  maxVotesPerParticipant: number;
  onAddCard: (columnId: string, text: string) => void;
  onUpdateCard: (cardId: string, updates: Partial<{ text: string; color: string | null }>) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleVote: (cardId: string) => void;
  onCombineCards: (parentCardId: string, childCardId: string) => void;
  onUncombineCard: (childCardId: string) => void;
  onToggleReaction?: (cardId: string, emoji: string) => void;
  isCompleted?: boolean;
  isAdmin?: boolean;
  boardLocked?: boolean;
  activeDragId: string | null;
  onUpdateColumn?: (columnId: string, updates: Partial<Pick<Column, 'title' | 'color' | 'description'>>) => void;
  onDeleteColumn?: (columnId: string) => void;
  canDeleteColumn?: boolean;
}

/** Drop zone overlay that appears on cards during drag for combining */
function CombineDropZone({ cardId }: { cardId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `combine:${cardId}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute inset-0 z-10 rounded-[var(--radius-md)] border-2 border-dashed transition-all duration-200',
        isOver
          ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/10'
          : 'border-[var(--color-navy)]/30 bg-[var(--color-navy)]/3'
      )}
    >
      <div className={cn(
        'flex h-full items-center justify-center transition-opacity duration-150',
        isOver ? 'opacity-100' : 'opacity-60'
      )}>
        <span className={cn(
          'flex items-center gap-1 rounded-[var(--radius-full)] px-2.5 py-0.5 text-[10px] font-medium shadow-sm',
          isOver
            ? 'bg-[var(--color-navy)] text-white'
            : 'bg-[var(--color-navy)]/10 text-[var(--color-navy)]'
        )}>
          <Layers size={10} />
          {isOver ? 'Drop to combine' : 'Combine'}
        </span>
      </div>
    </div>
  );
}

/** Draggable wrapper for child cards (for uncombine via drag-out) */
function DraggableChildCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab' }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function BoardColumn({
  column,
  cards,
  votes,
  currentParticipantId,
  isObscured,
  votingEnabled,
  secretVoting,
  cardCreationDisabled,
  maxVotesPerParticipant,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onToggleVote,
  onCombineCards,
  onUncombineCard,
  onToggleReaction,
  isCompleted,
  isAdmin,
  boardLocked,
  activeDragId,
  onUpdateColumn,
  onDeleteColumn,
  canDeleteColumn,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const card of cards) {
      if (card.merged_with) ids.add(card.merged_with);
    }
    return ids;
  }, [cards]);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Auto-expand newly combined parent cards
  useEffect(() => {
    if (parentIds.size === 0) return;
    setExpandedCards((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of parentIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [parentIds]);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  const handleColorSelect = (color: string) => {
    if (onUpdateColumn) {
      onUpdateColumn(column.id, { color });
    }
    setShowColorPicker(false);
  };

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== column.title && onUpdateColumn) {
      onUpdateColumn(column.id, { title: trimmed });
    }
    setIsEditingTitle(false);
    setEditTitle(trimmed || column.title);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') {
      setEditTitle(column.title);
      setIsEditingTitle(false);
    }
  };

  const handleDeleteColumn = () => {
    if (onDeleteColumn) {
      onDeleteColumn(column.id);
    }
    setShowDeleteConfirm(false);
  };

  const toggleCardExpanded = (cardId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  // Separate root cards from children
  const rootCards = useMemo(
    () => cards.filter((c) => !c.merged_with),
    [cards]
  );

  // Vote counts per card for sorting
  const voteCountByCard = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of votes) {
      map.set(v.card_id, (map.get(v.card_id) || 0) + 1);
    }
    return map;
  }, [votes]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const card of cards) {
      if (card.merged_with) {
        const list = map.get(card.merged_with) || [];
        list.push(card);
        map.set(card.merged_with, list);
      }
    }
    // Sort children by vote count descending
    for (const [key, list] of map) {
      list.sort((a, b) => (voteCountByCard.get(b.id) || 0) - (voteCountByCard.get(a.id) || 0));
      map.set(key, list);
    }
    return map;
  }, [cards, voteCountByCard]);

  // Sort root cards: group votes desc → group size desc → position asc
  const sortedCards = useMemo(() => {
    return [...rootCards].sort((a, b) => {
      const aChildren = childrenByParent.get(a.id) || [];
      const bChildren = childrenByParent.get(b.id) || [];
      const aVotes = (voteCountByCard.get(a.id) || 0) + aChildren.reduce((s, c) => s + (voteCountByCard.get(c.id) || 0), 0);
      const bVotes = (voteCountByCard.get(b.id) || 0) + bChildren.reduce((s, c) => s + (voteCountByCard.get(c.id) || 0), 0);
      if (bVotes !== aVotes) return bVotes - aVotes;
      const aSize = 1 + aChildren.length;
      const bSize = 1 + bChildren.length;
      if (bSize !== aSize) return bSize - aSize;
      return a.position - b.position;
    });
  }, [rootCards, childrenByParent, voteCountByCard]);

  const cardIds = useMemo(() => sortedCards.map((c) => c.id), [sortedCards]);

  const columnVoteCount = useMemo(
    () => votes.filter((v) => cards.some((c) => c.id === v.card_id)).length,
    [votes, cards]
  );

  const voteLimitReached = useMemo(() => {
    if (!currentParticipantId) return false;
    const myVoteCount = votes.filter((v) => v.voter_id === currentParticipantId).length;
    return myVoteCount >= maxVotesPerParticipant;
  }, [votes, currentParticipantId, maxVotesPerParticipant]);

  const canMerge = !isCompleted && !boardLocked;

  // Determine if a drag is active (root card or child card)
  const isDragActive = activeDragId !== null;
  const activeDragRootId = activeDragId
    ? (activeDragId.startsWith('child:') ? null : activeDragId)
    : null;

  const handleMergeTarget = (targetCardId: string) => {
    if (mergeSourceId && mergeSourceId !== targetCardId) {
      onCombineCards(targetCardId, mergeSourceId);
      setMergeSourceId(null);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[300px] w-[85vw] shrink-0 snap-start flex-col rounded-[var(--radius-lg)] border bg-[var(--color-surface-dim)] sm:w-auto sm:shrink ${
        isOver ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/5' : 'border-[var(--color-gray-1)]'
      }`}
    >
      {/* Column header */}
      <div className="flex flex-col border-b border-[var(--color-gray-1)]">
        <div className="flex items-center gap-2 px-4 py-3">
          <div
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: column.color }}
          />

          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleSaveTitle}
              maxLength={40}
              className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-gray-2)] bg-transparent px-1.5 py-0.5 text-base font-semibold text-[var(--color-gray-8)] focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]"
            />
          ) : (
            <h3
              className={cn(
                'flex-1 text-base font-semibold text-[var(--color-gray-8)]',
                isAdmin && !isCompleted && 'cursor-text rounded-[var(--radius-sm)] px-1.5 py-0.5 hover:bg-[var(--color-gray-1)] transition-colors'
              )}
              onClick={isAdmin && !isCompleted ? () => {
                setEditTitle(column.title);
                setIsEditingTitle(true);
              } : undefined}
            >
              {column.title}
            </h3>
          )}

          <span className="rounded-[var(--radius-full)] bg-[var(--color-gray-1)] px-2 py-0.5 text-xs font-medium text-[var(--color-gray-5)]">
            {cards.length}
          </span>
          {votingEnabled && !secretVoting && columnVoteCount > 0 && (
            <span className="flex items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-navy)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-navy)]">
              <ThumbsUp size={10} />
              {columnVoteCount}
            </span>
          )}
        </div>

        {/* Admin action bar */}
        {isAdmin && !isCompleted && !isEditingTitle && (
          <div className="relative flex items-center gap-1 border-t border-[var(--color-gray-1)] px-3 py-1.5">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-7)] transition-colors"
              aria-label="Change column color"
            >
              <Palette size={14} />
              <span>Color</span>
            </button>
            {canDeleteColumn && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs text-[var(--color-gray-5)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)] transition-colors"
                aria-label="Delete column"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}

            {/* Color picker popover */}
            {showColorPicker && (
              <div
                ref={colorPickerRef}
                className="absolute left-2 top-full z-30 mt-1 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] p-2 shadow-lg"
              >
                <div className="grid grid-cols-6 gap-1.5">
                  {COLUMN_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                        column.color === color
                          ? 'border-[var(--color-gray-8)] ring-2 ring-[var(--color-gray-8)]/20'
                          : 'border-transparent'
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="flex items-center justify-between bg-[var(--color-error)]/5 px-4 py-2.5 text-sm">
          <span className="text-[var(--color-error)]">
            Delete column{cards.length > 0 ? ` and ${cards.length} card${cards.length === 1 ? '' : 's'}` : ''}?
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-[var(--radius-sm)] px-3 py-1.5 text-xs text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteColumn}
              className="rounded-[var(--radius-sm)] bg-[var(--color-error)] px-3 py-1.5 text-xs text-white hover:opacity-90"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Column description */}
      {column.description && (
        <p className="border-b border-[var(--color-gray-1)] px-4 py-2 text-sm text-[var(--color-gray-4)]">
          {column.description}
        </p>
      )}

      {/* Merge mode cancel overlay (button-based merge fallback) */}
      {mergeSourceId && (
        <div className="flex items-center justify-between bg-[var(--color-navy)]/5 px-4 py-2 text-sm">
          <span className="text-[var(--color-navy)] font-medium">Select a card to merge into</span>
          <button
            onClick={() => setMergeSourceId(null)}
            className="rounded-[var(--radius-sm)] px-3 py-1 text-xs text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Add card — at top for easy access */}
      <div className="px-3 pt-3">
        <AddCardForm
          onSubmit={(text) => onAddCard(column.id, text)}
          disabled={cardCreationDisabled}
        />
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {sortedCards.map((card) => {
            const children = childrenByParent.get(card.id) || [];
            const cardVotes = votes.filter((v) => v.card_id === card.id);
            const childVotes = children.reduce(
              (sum, c) => sum + (voteCountByCard.get(c.id) || 0), 0
            );
            const hasVoted = cardVotes.some((v) => v.voter_id === currentParticipantId);
            const isExpanded = expandedCards.has(card.id);
            const showCombineZone = isDragActive && activeDragRootId !== card.id && canMerge
              && (activeDragId?.startsWith('child:') ? `child:${card.id}` !== activeDragId : true);

            return (
              <div key={card.id}>
                {/* Root card (sortable) */}
                <SortableCard id={card.id}>
                  <div className="relative">
                    <RetroCard
                      id={card.id}
                      text={card.text}
                      authorName={card.author_name}
                      authorId={card.author_id}
                      color={card.color}
                      voteCount={cardVotes.length + childVotes}
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
                      childCards={children}
                      votes={votes}
                      currentParticipantId={currentParticipantId}
                      canMerge={canMerge}
                      isMergeSource={mergeSourceId === card.id}
                      isMergeTarget={mergeSourceId !== null && mergeSourceId !== card.id}
                      onStartMerge={() => setMergeSourceId(card.id)}
                      onAcceptMerge={() => handleMergeTarget(card.id)}
                      onCancelMerge={() => setMergeSourceId(null)}
                      onUncombineCard={onUncombineCard}
                      expanded={isExpanded}
                      onToggleExpand={() => toggleCardExpanded(card.id)}
                    />
                    {/* Combine drop zone overlay (shown during drag) */}
                    {showCombineZone && <CombineDropZone cardId={card.id} />}
                  </div>
                </SortableCard>

                {/* Expanded child cards (outside SortableCard for independent drag) */}
                {isExpanded && children.length > 0 && (
                  <div className="ml-3 mt-1 flex flex-col gap-1.5 border-l-2 border-[var(--color-navy)]/20 pl-2">
                    {children.map((child) => {
                      const childVoteCount = voteCountByCard.get(child.id) || 0;
                      const childHasVoted = votes.some(
                        (v) => v.card_id === child.id && v.voter_id === currentParticipantId
                      );
                      const isChildAuthor = child.author_id === currentParticipantId;

                      const childContent = (
                        <div className="relative">
                          {/* Uncombine button above child card */}
                          {canMerge && (
                            <div className="absolute -top-1 right-1 z-10 opacity-0 transition-opacity [div:hover>&]:opacity-100">
                              <button
                                onClick={(e) => { e.stopPropagation(); onUncombineCard(child.id); }}
                                className="flex items-center gap-0.5 rounded-[var(--radius-full)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-gray-5)] shadow-sm border border-[var(--color-gray-2)] hover:text-[var(--color-navy)] hover:border-[var(--color-navy)]/30 transition-colors"
                                title="Uncombine card"
                                aria-label="Uncombine card"
                              >
                                <Unlink size={10} />
                              </button>
                            </div>
                          )}
                          <div className="[&_>_div]:p-2 [&_>_div]:text-xs [&_p]:text-xs">
                            <RetroCard
                              id={child.id}
                              text={child.text}
                              authorName={child.author_name}
                              authorId={child.author_id}
                              color={child.color}
                              voteCount={childVoteCount}
                              hasVoted={childHasVoted}
                              isAuthor={isChildAuthor}
                              isObscured={isObscured}
                              votingEnabled={votingEnabled}
                              secretVoting={secretVoting}
                              voteLimitReached={voteLimitReached}
                              onUpdate={onUpdateCard}
                              onDelete={onDeleteCard}
                              onToggleVote={onToggleVote}
                              isCompleted={isCompleted}
                              canMerge={false}
                            />
                          </div>
                        </div>
                      );

                      // Wrap in DraggableChildCard when merge is possible
                      if (canMerge) {
                        return (
                          <DraggableChildCard key={child.id} id={`child:${child.id}`}>
                            {childContent}
                          </DraggableChildCard>
                        );
                      }

                      return <div key={child.id}>{childContent}</div>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </SortableContext>

      </div>
    </div>
  );
}
