'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, ThumbsUp, Check, X, Merge, ChevronDown, ChevronRight, SmilePlus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { CardColorPicker } from './CardColorPicker';
import { IconButton } from '@/components/common/IconButton';
import { Pill } from '@/components/common/Pill';
import { ReactionPill } from './ReactionPill';
import type { Card, CardReactions, Participant, Vote } from '@/types';

const EMOJI_PALETTE = ['👍', '👎', '❤️', '😂', '🎉', '🤔', '🔥', '👏'];

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
  reactions?: CardReactions;
  onToggleReaction?: (cardId: string, emoji: string) => void;
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
  participants?: Participant[];
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
  reactions = {},
  onToggleReaction,
  isCompleted,
  currentParticipantId,
  childCards = [],
  canMerge,
  isMergeSource,
  isMergeTarget,
  onStartMerge,
  onAcceptMerge,
  onCancelMerge,
  expanded = false,
  onToggleExpand,
  participants = [],
}: RetroCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiPickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setEmojiPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [emojiPickerOpen]);

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

  // Determine left border style
  const borderLeftStyle: React.CSSProperties = hasChildren
    ? { borderLeftWidth: 3, borderLeftColor: 'var(--accent)' }
    : color
    ? { borderLeftWidth: 3, borderLeftColor: color }
    : {};

  return (
    <div>
      <div
        onClick={isMergeTarget ? handleCardClick : undefined}
        className={cn(
          'group relative rounded-[var(--r-lg)] border border-[var(--line)]',
          'bg-[var(--surface)] p-3',
          'shadow-[var(--shadow-xs)] hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-sm)]',
          'transition-[border-color,box-shadow] duration-150',
          isObscured && !isAuthor && 'select-none',
          colorPickerOpen && 'z-20',
          isMergeSource && 'ring-2 ring-[var(--ink)] opacity-60',
          isMergeTarget && 'cursor-pointer ring-2 ring-dashed ring-[var(--accent)]/50 hover:ring-[var(--accent)] hover:bg-[var(--accent-soft)]'
        )}
        style={{
          ...borderLeftStyle,
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
                'w-full resize-none rounded-[var(--r-sm)] border border-[var(--line)]',
                'bg-[var(--surface)] px-2 py-1.5 text-[var(--ink)]',
                'focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]'
              )}
            />
            <div className="flex justify-end gap-1">
              <button
                onClick={() => {
                  setEditText(text);
                  setIsEditing(false);
                }}
                className="rounded-[var(--r-sm)] p-2 text-[var(--ink-4)] hover:bg-[var(--surface-muted)]"
                aria-label="Cancel edit"
              >
                <X size={16} />
              </button>
              <button
                onClick={handleSave}
                className="rounded-[var(--r-sm)] p-2 text-[var(--success)] hover:bg-[color-mix(in_oklab,var(--success)_12%,transparent)]"
                aria-label="Save edit"
              >
                <Check size={16} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-[15px] leading-[1.45] text-[var(--ink)]">{text}</p>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--ink-4)]">{authorName}</span>

                {/* Combined count badge */}
                {hasChildren && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
                    className="flex items-center"
                    title={`${childCards.length} combined card${childCards.length === 1 ? '' : 's'}`}
                  >
                    <Pill variant="tinted">
                      <Merge size={10} />
                      merged · +{childCards.length}
                      {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </Pill>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Vote button (interactive — only when voting enabled and board active) */}
                {votingEnabled && !isCompleted && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleVote(id); }}
                    disabled={!hasVoted && voteLimitReached}
                    aria-pressed={hasVoted}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 font-mono tabular-nums text-[11px] border transition-[background-color,color,border-color] duration-150',
                      hasVoted
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent'
                        : voteLimitReached
                        ? 'cursor-not-allowed bg-[var(--bg-elev)] text-[var(--ink-5)] border-[var(--line)] opacity-50'
                        : 'bg-[var(--bg-elev)] text-[var(--ink-3)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
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
                {/* Vote count (read-only — voting disabled or board completed) */}
                {(!votingEnabled || isCompleted) && !secretVoting && voteCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-mono tabular-nums text-[var(--ink-4)]">
                    <ThumbsUp size={12} />
                    <span>{voteCount}</span>
                  </span>
                )}

                {/* Author actions (visible on hover) */}
                {isAuthor && !isCompleted && !isMergeSource && !isMergeTarget && (
                  <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    {canMerge && onStartMerge && (
                      <IconButton
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onStartMerge(); }}
                        aria-label="Combine with another card"
                        title="Combine cards"
                      >
                        <Merge size={14} />
                      </IconButton>
                    )}
                    <CardColorPicker
                      currentColor={color}
                      onSelectColor={(newColor) => onUpdate(id, { color: newColor })}
                      onOpenChange={setColorPickerOpen}
                    />
                    <IconButton
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditText(text);
                        setIsEditing(true);
                      }}
                      aria-label="Edit card"
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                      aria-label="Delete card"
                      className="hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] hover:text-[var(--danger)]"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                )}

                {/* Non-author merge button */}
                {!isAuthor && !isCompleted && !isMergeSource && !isMergeTarget && canMerge && onStartMerge && (
                  <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <IconButton
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onStartMerge(); }}
                      aria-label="Combine with another card"
                      title="Combine cards"
                    >
                      <Merge size={14} />
                    </IconButton>
                  </div>
                )}

                {/* Cancel merge source */}
                {isMergeSource && onCancelMerge && (
                  <IconButton
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onCancelMerge(); }}
                    aria-label="Cancel merge"
                  >
                    <X size={14} />
                  </IconButton>
                )}
              </div>
            </div>

            {/* Emoji reactions */}
            {onToggleReaction && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {Object.entries(reactions).map(([emoji, users]) => users.length > 0 && (
                  <ReactionPill
                    key={emoji}
                    emoji={emoji}
                    reactorIds={users}
                    participants={participants}
                    currentParticipantId={currentParticipantId ?? null}
                    isMine={users.includes(String(currentParticipantId || ''))}
                    onToggle={() => onToggleReaction(id, emoji)}
                  />
                ))}
                {!isCompleted && (
                  <div className="relative" ref={emojiPickerRef}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEmojiPickerOpen(!emojiPickerOpen); }}
                      className="rounded-full p-1 text-[var(--ink-4)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--ink-3)]"
                      title="Add reaction"
                    >
                      <SmilePlus size={14} />
                    </button>
                    {emojiPickerOpen && (
                      <div className="absolute bottom-full left-0 z-30 mb-1 flex gap-0.5 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-md">
                        {EMOJI_PALETTE.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleReaction(id, emoji);
                              setEmojiPickerOpen(false);
                            }}
                            className="rounded p-1 text-sm hover:bg-[var(--surface-muted)] transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
