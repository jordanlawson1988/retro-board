'use client';

import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ThumbsUp, Trash2, Palette, Unlink, Merge, MoreHorizontal } from 'lucide-react';
import { cn } from '@/utils/cn';
import { COLUMN_COLORS } from '@/utils/constants';
import { RetroCard } from './RetroCard';
import { SortableCard } from './SortableCard';
import { AddCardForm } from './AddCardForm';
import { ColumnSortMenu } from './ColumnSortMenu';
import { IconButton } from '@/components/common/IconButton';
import { sortCards } from '@/utils/sortCards';
import type { Column, Card, Vote, Participant } from '@/types';

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
  onUpdateColumn?: (columnId: string, updates: Partial<Pick<Column, 'title' | 'color' | 'description' | 'sort_by'>>) => void;
  onDeleteColumn?: (columnId: string) => void;
  canDeleteColumn?: boolean;
  participants?: Participant[];
}

/** Drop zone overlay that appears on cards during drag for combining */
function CombineDropZone({ cardId }: { cardId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `combine:${cardId}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute inset-0 z-10 rounded-[var(--r-lg)] border-2 border-dashed transition-all duration-200',
        isOver
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
          : 'border-[var(--accent)]/40 bg-[var(--accent-soft)]/40'
      )}
    >
      <div className={cn(
        'flex h-full items-center justify-center transition-opacity duration-150',
        isOver ? 'opacity-100' : 'opacity-60'
      )}>
        <span className={cn(
          'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium shadow-sm',
          isOver
            ? 'bg-[var(--accent)] text-[var(--on-accent)]'
            : 'bg-[var(--accent-soft)] text-[var(--accent)]'
        )}>
          <Merge size={10} />
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
  participants = [],
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
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
  const overflowMenuRef = useRef<HTMLDivElement>(null);

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

  // Close overflow menu on outside click
  useEffect(() => {
    if (!showOverflowMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOverflowMenu]);

  const handleColorSelect = (color: string) => {
    if (onUpdateColumn) {
      onUpdateColumn(column.id, { color });
    }
    setShowColorPicker(false);
    setShowOverflowMenu(false);
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

  // Vote counts per card
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
    // Children always sorted by raw vote count desc (unchanged from prior behavior)
    for (const [key, list] of map) {
      list.sort((a, b) => (voteCountByCard.get(b.id) || 0) - (voteCountByCard.get(a.id) || 0));
      map.set(key, list);
    }
    return map;
  }, [cards, voteCountByCard]);

  const aggregateVotesFor = useCallback(
    (cardId: string) => {
      const own = voteCountByCard.get(cardId) || 0;
      const kids = childrenByParent.get(cardId) || [];
      return own + kids.reduce((s, c) => s + (voteCountByCard.get(c.id) || 0), 0);
    },
    [voteCountByCard, childrenByParent]
  );

  const sortedCards = useMemo(
    () => sortCards(rootCards, column.sort_by, aggregateVotesFor),
    [rootCards, column.sort_by, aggregateVotesFor]
  );

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
      className={cn(
        'flex min-h-[300px] w-[85vw] shrink-0 snap-start flex-col sm:w-auto sm:shrink',
        'bg-[var(--bg-elev)] border rounded-[var(--r-2xl)] overflow-hidden',
        'transition-[border-color] duration-150',
        isOver ? 'border-[var(--accent)]' : 'border-[var(--line)]'
      )}
    >
      {/* 3px top tint stripe */}
      <div
        aria-hidden
        className="h-[3px] opacity-85 shrink-0"
        style={{ background: column.color || 'var(--accent)' }}
      />

      {/* Column header */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2.5 px-[18px] pt-4 pb-3">
          {/* 8×8 tint dot */}
          <span
            aria-hidden
            className="w-2 h-2 rounded-[3px] shrink-0"
            style={{ background: column.color || 'var(--accent)' }}
          />

          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleSaveTitle}
              maxLength={40}
              className="flex-1 rounded-[var(--r-sm)] border border-[var(--line)] bg-transparent px-1.5 py-0.5 text-[15px] font-semibold tracking-tight text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          ) : (
            <h3
              className={cn(
                'flex-1 text-[15px] font-semibold tracking-tight text-[var(--ink)]',
                isAdmin && !isCompleted && 'cursor-text rounded-[var(--r-sm)] px-1.5 py-0.5 hover:bg-[var(--surface-muted)] transition-colors'
              )}
              onClick={isAdmin && !isCompleted ? () => {
                setEditTitle(column.title);
                setIsEditingTitle(true);
              } : undefined}
            >
              {column.title}
            </h3>
          )}

          <span className="font-mono tabular-nums text-[12px] text-[var(--ink-4)]">
            {cards.length}
          </span>
          {votingEnabled && !secretVoting && columnVoteCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-mono tabular-nums text-[var(--accent)]">
              <ThumbsUp size={10} />
              {columnVoteCount}
            </span>
          )}

          {isAdmin && !isCompleted && !isEditingTitle && (
            <ColumnSortMenu
              value={column.sort_by}
              onChange={(next) => onUpdateColumn?.(column.id, { sort_by: next })}
            />
          )}

          {/* Admin overflow menu */}
          {isAdmin && !isCompleted && !isEditingTitle && (
            <div className="relative" ref={overflowMenuRef}>
              <IconButton
                size="sm"
                onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                aria-label="Column actions"
              >
                <MoreHorizontal size={16} />
              </IconButton>

              {showOverflowMenu && (
                <div className="absolute right-0 top-full z-30 mt-1 min-w-[140px] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--shadow-md)]">
                  <button
                    onClick={() => {
                      setShowColorPicker(!showColorPicker);
                      setShowOverflowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[var(--ink-3)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] transition-colors"
                  >
                    <Palette size={14} />
                    <span>Column color</span>
                  </button>
                  {canDeleteColumn && (
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowOverflowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] transition-colors"
                    >
                      <Trash2 size={14} />
                      <span>Delete column</span>
                    </button>
                  )}
                </div>
              )}

              {/* Color picker popover (shown after clicking Color in menu) */}
              {showColorPicker && (
                <div
                  ref={colorPickerRef}
                  className="absolute right-0 top-full z-30 mt-1 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)]"
                >
                  <div className="grid grid-cols-6 gap-1.5">
                    {COLUMN_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleColorSelect(color)}
                        className={cn(
                          'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                          column.color === color
                            ? 'border-[var(--ink)] ring-2 ring-[var(--ink)]/20'
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

        {/* Column description */}
        {column.description && (
          <p className="px-[18px] pb-1 text-[13px] text-[var(--ink-4)]">
            {column.description}
          </p>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="flex items-center justify-between bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] px-4 py-2.5 text-sm">
          <span className="text-[var(--danger)]">
            Delete column{cards.length > 0 ? ` and ${cards.length} card${cards.length === 1 ? '' : 's'}` : ''}?
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-[var(--r-sm)] px-3 py-1.5 text-xs text-[var(--ink-4)] hover:bg-[var(--surface-muted)]"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteColumn}
              className="rounded-[var(--r-sm)] bg-[var(--danger)] px-3 py-1.5 text-xs text-[var(--on-accent)] hover:opacity-90"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Merge mode cancel overlay (button-based merge fallback) */}
      {mergeSourceId && (
        <div className="flex items-center justify-between bg-[var(--accent-soft)] px-4 py-2 text-sm">
          <span className="text-[var(--accent)] font-medium">Select a card to merge into</span>
          <button
            onClick={() => setMergeSourceId(null)}
            className="rounded-[var(--r-sm)] px-3 py-1 text-xs text-[var(--ink-4)] hover:bg-[var(--surface-muted)]"
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
                      participants={participants}
                    />
                    {/* Combine drop zone overlay (shown during drag) */}
                    {showCombineZone && <CombineDropZone cardId={card.id} />}
                  </div>
                </SortableCard>

                {/* Expanded child cards (outside SortableCard for independent drag) */}
                {isExpanded && children.length > 0 && (
                  <div className="ml-3 mt-1 flex flex-col gap-1.5 border-l-2 border-[var(--accent)]/20 pl-2">
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
                                className="flex items-center gap-0.5 rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--ink-4)] shadow-sm border border-[var(--line)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-colors"
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
                              participants={participants}
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
