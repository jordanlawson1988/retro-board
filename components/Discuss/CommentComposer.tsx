'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Textarea } from '@/components/common';
import { cn } from '@/utils/cn';
import { useBoardStore } from '@/stores/boardStore';
import { clampComment, commentCounterText, commentEnterPosts, commentsWritable, sentTextUnchanged, showCommentCounter, textAfterSend } from '@/lib/comments';
import { COMMENT_ANONYMOUS_LABEL } from '@/lib/constants/comments';
import { editorStillOpen } from '@/lib/groups';

export type ComposerMode = 'comment' | 'reply' | 'edit';

const COPY: Record<ComposerMode, { label: string; placeholder: string; submit: string }> = {
  comment: { label: 'Comment', placeholder: 'Add a comment', submit: 'Comment' },
  reply: { label: 'Reply', placeholder: 'Write a reply', submit: 'Reply' },
  edit: { label: 'Edit comment', placeholder: '', submit: 'Save' },
};

/** Shared by the thread's action buttons: text buttons, 44px tall on phones. */
export const COMMENT_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';
const PRIMARY = cn(COMMENT_BUTTON, 'border-transparent bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]');

interface CommentComposerProps {
  mode: ComposerMode;
  /** The text an editor opens with; empty for a comment or reply. */
  initialText?: string;
  /** The checkbox's starting value. Unused in edit mode. */
  initialAnonymous: boolean;
  /** The value the checkbox returns to after a post; the board's setting. Defaults to `initialAnonymous`. */
  defaultAnonymous?: boolean;
  /** Reports the draft after each change and after a successful post (the thread keeps one per topic). */
  onDraftChange?: (text: string, anonymous: boolean) => void;
  /** Called after a reply or edit was written and nothing was typed since; the parent closes the box. */
  onDone?: () => void;
  /** Resolves when the write is done; a rejection keeps the text and shows its message under the box. */
  onSubmit: (text: string, anonymous: boolean) => Promise<void>;
  /** Escape and the Cancel button; absent for the thread's own composer. */
  onCancel?: () => void;
  autoFocus?: boolean;
}

/**
 * One textarea with its buttons. It keeps the draft itself, so typing never re-renders the thread.
 * It belongs to the phase it was mounted in and sends nothing once that phase is over or the
 * board stops being writable. Blur does nothing; Enter or the button posts.
 */
export function CommentComposer({ mode, initialText = '', initialAnonymous, defaultAnonymous = initialAnonymous, onDraftChange, onDone, onSubmit, onCancel, autoFocus }: CommentComposerProps) {
  const copy = COPY[mode];
  const clearWriteError = useBoardStore((s) => s.clearWriteError);
  const [openedIn] = useState(() => useBoardStore.getState().board?.phase ?? null);
  const [text, setText] = useState(initialText);
  const [anonymous, setAnonymous] = useState(initialAnonymous);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const textRef = useRef(initialText);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const uid = useId();
  const counterId = `${uid}-count`;
  const problemId = `${uid}-problem`;
  const checkId = `${uid}-anon`;

  useEffect(() => {
    if (!autoFocus) return;
    const area = areaRef.current;
    area?.focus();
    area?.setSelectionRange(area.value.length, area.value.length);
  }, [autoFocus]);

  const submit = () => {
    // A ref, not state: two Enter presses in one tick must send one request.
    if (busyRef.current || text.trim() === '') return;
    const live = useBoardStore.getState().board;
    if (openedIn === null || !editorStillOpen(openedIn, live?.phase ?? null, commentsWritable(live))) return;
    busyRef.current = true;
    setBusy(true);
    setProblem(null);
    const sent = text;
    onSubmit(text, anonymous)
      .then(() => {
        // Text typed while the write was in flight is the person's: never erased, never sent twice.
        if (mode === 'edit') return sentTextUnchanged(sent, textRef.current) ? onDone?.() : undefined;
        const rest = textAfterSend(sent, textRef.current);
        if (rest === '') {
          if (mode === 'reply') return onDone?.();
          textRef.current = '';
          setText('');
          setAnonymous(defaultAnonymous);
          onDraftChange?.('', defaultAnonymous);
        } else {
          textRef.current = rest;
          setText(rest);
          onDraftChange?.(rest, anonymous);
        }
        areaRef.current?.focus();
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        // Only this box's own error: another write's banner message stays.
        if (useBoardStore.getState().lastWriteError === message) clearWriteError();
        setProblem(message);
      })
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  };

  const describedBy = [showCommentCounter(text) ? counterId : null, problem ? problemId : null].filter(Boolean).join(' ');
  const empty = text.trim() === '';

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        ref={areaRef}
        aria-label={copy.label}
        placeholder={copy.placeholder || undefined}
        value={text}
        enterKeyHint="send"
        rows={2}
        aria-invalid={problem ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => {
          const next = clampComment(e.target.value);
          textRef.current = next;
          setText(next);
          onDraftChange?.(next, anonymous);
        }}
        onKeyDown={(e) => {
          if (commentEnterPosts(e.key, e.shiftKey, e.nativeEvent.isComposing || e.keyCode === 229)) {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape' && onCancel) {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        className={cn('min-h-[64px] scroll-mb-28 text-[16px] [overflow-wrap:anywhere]', problem && 'border-[var(--danger)]')}
      />
      {showCommentCounter(text) && (
        <span id={counterId} className="text-[11px] text-[var(--ink-3)]">
          {commentCounterText(text)}
        </span>
      )}
      {problem && (
        <p id={problemId} role="alert" className="text-sm text-[var(--danger)]">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {mode !== 'edit' && (
          <label htmlFor={checkId} className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink-2)] md:min-h-9">
            <input id={checkId} type="checkbox" checked={anonymous} onChange={(e) => {
                setAnonymous(e.target.checked);
                onDraftChange?.(text, e.target.checked);
              }} className="h-4 w-4" />
            {COMMENT_ANONYMOUS_LABEL}
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className={COMMENT_BUTTON}>
              Cancel
            </button>
          )}
          <button type="button" onClick={submit} disabled={empty || busy} aria-busy={busy || undefined} className={PRIMARY}>
            {copy.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
