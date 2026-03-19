'use client';

import { useState } from 'react';
import { Pencil, Trash2, ThumbsUp, Check, X, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { getCardTextColor, CARD_TEXT_CLASSES } from '../../utils/cardColors';
import { CardColorPicker } from './CardColorPicker';
import type { Card, Vote } from '@/types';

interface RetroCardProps {
  id: string;
  text: string;
  authorName: string;
  authorId: string;
  color: string | null;
  voteCount: number;
  hasVoted: boolean;
  isAuthor: boolean;
  isObscured: boolean;
  votingEnabled: boolean;
  secretVoting: boolean;
  voteLimitReached: boolean;
  onUpdate: (cardId: string, updates: Partial<{ text: string; color: string | null }>) => void;
  onDelete: (cardId: string) => void;
  onToggleVote: (cardId: string) => void;
  isCompleted?: boolean;
  // Merge props
  childCards?: Card[];
  votes?: Vote[];
  currentParticipantId?: string | null;
  canMerge?: boolean;
  isMergeSource?: boolean;
  isMergeTarget?: boolean;
  onStartMerge?: () => void;
  onAcceptMerge?: () => void;
  onCancelMerge?: () => void;
  onUncombineCard?: (childCardId: string) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function RetroCard({
  id,
  text,
  authorName,
  color,
  voteCount,
  hasVoted,
  isAuthor,
  isObscured,
  votingEnabled,
  secretVoting,
  voteLimitReached,
  onUpdate,
  onDelete,
  onToggleVote,
  isCompleted,
  childCards = [],
  canMerge,
  isMergeSource,
  isMergeTarget,
  onStartMerge,
  onAcceptMerge,
  onCancelMerge,
  expanded = false,
  onToggleExpand,
}: RetroCardProps) {
  const contrast = CARD_TEXT_CLASSES[getCardTextColor(color)];
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const hasChildren = childCards.length > 0;

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== text) {
      onUpdate(id, { text: trimmed });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditText(text);
      setIsEditing(false);
    }
  };

  const handleCardClick = () => {
    if (isMergeTarget && onAcceptMerge) {
      onAcceptMerge();
    }
  };

  return (
    <div>
      <div
        onClick={isMergeTarget ? handleCardClick : undefined}
        className={cn(
          'group relative rounded-[var(--radius-md)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-3 shadow-sm',
          'transition-all duration-200',
          isObscured && !isAuthor && 'select-none',
          colorPickerOpen && 'z-20',
          isMergeSource && 'ring-2 ring-[var(--color-navy)] opacity-60',
          isMergeTarget && 'cursor-pointer ring-2 ring-dashed ring-[var(--color-navy)]/50 hover:ring-[var(--color-navy)] hover:bg-[var(--color-navy)]/5',
          hasChildren && 'border-l-4 border-l-[var(--color-navy)]'
        )}
        style={{
          backgroundColor: isMergeTarget ? undefined : (color || undefined),
          filter: isObscured && !isAuthor ? 'blur(6px)' : 'blur(0px)',
        }}
      >
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              autoFocus
              className={cn(
                'w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-gray-2)]',
                'bg-[var(--color-surface)] px-2 py-1.5 text-base text-[var(--color-gray-8)]',
                'focus:border-[var(--color-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--color-navy)]'
              )}
            />
            <div className="flex justify-end gap-1">
              <button
                onClick={() => {
                  setEditText(text);
                  setIsEditing(false);
                }}
                className="rounded-[var(--radius-sm)] p-2 text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]"
                aria-label="Cancel edit"
              >
                <X size={16} />
              </button>
              <button
                onClick={handleSave}
                className="rounded-[var(--radius-sm)] p-2 text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
                aria-label="Save edit"
              >
                <Check size={16} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={cn('whitespace-pre-wrap text-sm', contrast.text)}>{text}</p>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn('text-xs', contrast.subtext)}>{authorName}</span>

                {/* Combined count badge */}
                {hasChildren && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
                    className="flex items-center gap-0.5 rounded-[var(--radius-full)] bg-[var(--color-navy)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-navy)] hover:bg-[var(--color-navy)]/20 transition-colors"
                    title={`${childCards.length} combined card${childCards.length === 1 ? '' : 's'}`}
                  >
                    <Layers size={10} />
                    <span>+{childCards.length}</span>
                    {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Vote button */}
                {votingEnabled && !isCompleted && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleVote(id); }}
                    disabled={!hasVoted && voteLimitReached}
                    className={cn(
                      'flex items-center gap-1 rounded-[var(--radius-full)] px-2 py-0.5 text-xs transition-colors',
                      hasVoted
                        ? `bg-[var(--color-navy)]/10 ${contrast.text} font-medium`
                        : voteLimitReached
                          ? `cursor-not-allowed ${contrast.icon}`
                          : `${contrast.subtext} hover:bg-[var(--color-gray-1)] ${contrast.iconHover}`
                    )}
                    aria-label={hasVoted ? 'Remove vote' : voteLimitReached ? 'Vote limit reached' : 'Vote for this card'}
                    title={voteLimitReached && !hasVoted ? 'No votes remaining' : undefined}
                  >
                    <ThumbsUp size={12} />
                    {secretVoting
                      ? (hasVoted && <span className="text-[10px]">Voted</span>)
                      : (voteCount > 0 && <span>{voteCount}</span>)
                    }
                  </button>
                )}

                {/* Author actions (visible on hover) */}
                {isAuthor && !isCompleted && !isMergeSource && !isMergeTarget && (
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    {canMerge && onStartMerge && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onStartMerge(); }}
                        className={cn('rounded-[var(--radius-sm)] p-2', contrast.icon, 'hover:bg-[var(--color-gray-1)]', contrast.iconHover)}
                        aria-label="Combine with another card"
                        title="Combine cards"
                      >
                        <Layers size={14} />
                      </button>
                    )}
                    <CardColorPicker
                      currentColor={color}
                      onSelectColor={(newColor) => onUpdate(id, { color: newColor })}
                      onOpenChange={setColorPickerOpen}
                      iconClassName={contrast.icon}
                      iconHoverClassName={contrast.iconHover}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditText(text);
                        setIsEditing(true);
                      }}
                      className={cn('rounded-[var(--radius-sm)] p-2', contrast.icon, 'hover:bg-[var(--color-gray-1)]', contrast.iconHover)}
                      aria-label="Edit card"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                      className={cn('rounded-[var(--radius-sm)] p-2', contrast.icon, 'hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]')}
                      aria-label="Delete card"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                {/* Non-author merge button */}
                {!isAuthor && !isCompleted && !isMergeSource && !isMergeTarget && canMerge && onStartMerge && (
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); onStartMerge(); }}
                      className={cn('rounded-[var(--radius-sm)] p-2', contrast.icon, 'hover:bg-[var(--color-gray-1)]', contrast.iconHover)}
                      aria-label="Combine with another card"
                      title="Combine cards"
                    >
                      <Layers size={14} />
                    </button>
                  </div>
                )}

                {/* Cancel merge source */}
                {isMergeSource && onCancelMerge && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCancelMerge(); }}
                    className="rounded-[var(--radius-sm)] p-2 text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)]"
                    aria-label="Cancel merge"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
