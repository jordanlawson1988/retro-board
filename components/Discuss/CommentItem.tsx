'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useDiscussStore } from '@/stores/discussStore';
import type { PhaseId } from '@/lib/constants/phases';
import {
  canDeleteComment, canEditComment, canReplyTo, commentAuthorLabel, commentEditDecision, commentFormOpen,
} from '@/lib/comments';
import {
  COMMENT_DELETE_PROMPT, COMMENT_DELETE_PROMPT_WITH_REPLIES, COMMENT_EDITED_MARK, DELETED_COMMENT_TEXT,
} from '@/lib/constants/comments';
import { formatDeadlineTime } from '@/lib/phases';
import type { Board, Comment } from '@/types';
import { COMMENT_BUTTON, CommentComposer } from './CommentComposer';

export type CommentGate = Pick<Board, 'mode' | 'phase' | 'archived_at'>;

type PanelKind = 'reply' | 'edit' | 'delete';

interface CommentItemProps {
  comment: Comment;
  /** The replies of a top-level comment, oldest first. Absent on a reply: nothing nests deeper. */
  replies?: Comment[];
  participantId: string | null;
  isFacilitator: boolean;
  /** The board's phase and state, as primitives from the thread. */
  gate: CommentGate;
  writable: boolean;
  anonymousDefault: boolean;
}

/**
 * One comment, its action buttons and the one form open on it. It takes plain props and does not
 * subscribe to the store. The open form is judged from the live comment on every render.
 */
function CommentItemView({ comment, replies, participantId, isFacilitator, gate, writable, anonymousDefault }: CommentItemProps) {
  const [panel, setPanel] = useState<{ kind: PanelKind; phase: PhaseId } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const replyRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef<PanelKind | null>(null);
  const deletingRef = useRef(false);

  const open = panel !== null && commentFormOpen(panel.kind, panel.phase, gate.phase, comment, gate, participantId, isFacilitator);
  // A form left behind by a phase change, a deletion or a lost right must not come back.
  if (panel !== null && !open) {
    setPanel(null);
    setProblem(null);
  }
  const kind = open ? panel.kind : null;

  useEffect(() => {
    if (kind === 'delete') cancelDeleteRef.current?.focus();
    else if (kind === null && refocus.current) {
      const target = { reply: replyRef, edit: editRef, delete: deleteRef }[refocus.current];
      refocus.current = null;
      target.current?.focus();
    }
  }, [kind]);

  const begin = (next: PanelKind) => {
    if (!gate.phase) return;
    deletingRef.current = false;
    setProblem(null);
    // One form at a time on a comment: opening one replaces another.
    setPanel({ kind: next, phase: gate.phase });
  };
  const close = (returnFocus: PanelKind | null) => {
    refocus.current = returnFocus;
    setPanel(null);
    setProblem(null);
  };

  const deleted = comment.deleted_at !== null;
  const canReply = canReplyTo(comment, writable);
  const canEdit = canEditComment(comment, participantId, writable);
  const canDelete = canDeleteComment(comment, participantId, isFacilitator, writable);
  const hasReplies = (replies ?? []).some((r) => r.deleted_at === null);

  const confirmDelete = () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setProblem(null);
    useDiscussStore
      .getState()
      .deleteComment(comment.id)
      .then(() => close(null))
      .catch((e: unknown) => {
        deletingRef.current = false;
        const message = e instanceof Error ? e.message : String(e);
        if (useBoardStore.getState().lastWriteError === message) useBoardStore.getState().clearWriteError();
        setProblem(message);
      });
  };

  return (
    <article className="min-w-0 py-2">
      {deleted ? (
        <p className="text-sm italic text-[var(--ink-3)]">{DELETED_COMMENT_TEXT}</p>
      ) : (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
            <span className="font-semibold text-[var(--ink)] [overflow-wrap:anywhere]">{commentAuthorLabel(comment, participantId)}</span>
            <time dateTime={comment.created_at} className="text-[var(--ink-3)]">
              {formatDeadlineTime(Date.parse(comment.created_at))}
            </time>
            {comment.edited_at !== null && <span className="text-[var(--ink-3)]">{COMMENT_EDITED_MARK}</span>}
          </p>
          {kind === 'edit' ? (
            <div className="mt-1">
              <CommentComposer
                mode="edit"
                initialText={comment.body}
                initialAnonymous={false}
                autoFocus
                onCancel={() => close('edit')}
                onDone={() => close('edit')}
                onSubmit={async (typed) => {
                  const decision = commentEditDecision(comment.body, typed);
                  if (decision.kind === 'send') await useDiscussStore.getState().editComment(comment.id, decision.value);
                }}
              />
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--ink)] [overflow-wrap:anywhere]">{comment.body}</p>
          )}
        </>
      )}

      {!deleted && kind !== 'edit' && kind !== 'delete' && (canReply || canEdit || canDelete) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {canReply && (
            <button ref={replyRef} type="button" aria-expanded={kind === 'reply'} onClick={() => (kind === 'reply' ? close('reply') : begin('reply'))} className={COMMENT_BUTTON}>
              Reply
            </button>
          )}
          {canEdit && (
            <button ref={editRef} type="button" onClick={() => begin('edit')} className={COMMENT_BUTTON}>
              Edit
            </button>
          )}
          {canDelete && (
            <button ref={deleteRef} type="button" onClick={() => begin('delete')} className={COMMENT_BUTTON}>
              Delete
            </button>
          )}
        </div>
      )}

      {kind === 'delete' && (
        <div className="mt-1 flex flex-col gap-2">
          <p className="text-sm text-[var(--ink)]">{hasReplies ? COMMENT_DELETE_PROMPT_WITH_REPLIES : COMMENT_DELETE_PROMPT}</p>
          {problem && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {problem}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={confirmDelete} className={COMMENT_BUTTON}>
              Delete
            </button>
            <button ref={cancelDeleteRef} type="button" onClick={() => close('delete')} className={COMMENT_BUTTON}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {kind === 'reply' && (
        <div className="mt-2">
          <CommentComposer
            mode="reply"
            initialAnonymous={anonymousDefault}
            autoFocus
            onCancel={() => close('reply')}
            onDone={() => close('reply')}
            onSubmit={(typed, anonymous) =>
              useDiscussStore.getState().createComment({ cardId: comment.card_id, body: typed.trim(), anonymous, parentId: comment.id })
            }
          />
        </div>
      )}

      {replies && replies.length > 0 && (
        <div className="ml-6 mt-1 border-l border-[var(--line)] pl-3">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              participantId={participantId}
              isFacilitator={isFacilitator}
              gate={gate}
              writable={writable}
              anonymousDefault={anonymousDefault}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export const CommentItem = memo(CommentItemView);
