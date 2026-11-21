'use client';

import { useId, useMemo, useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useDiscussStore } from '@/stores/discussStore';
import {
  commentsEmptyText, commentsHeading, commentsReadable, commentsWritable, createDraftKeeper, draftFor, draftsScope, initialAnonymous, threadsFor,
} from '@/lib/comments';
import { CommentComposer } from './CommentComposer';
import { CommentItem, type CommentGate } from './CommentItem';

interface CommentThreadProps {
  /** The topic's lead card: new comments go on it. */
  rootId: string;
  /** The cards of the topic; comments on any of them are listed. */
  cardIds: string[];
  isFacilitator: boolean;
}

/** The discussion under a topic's cards. Read-only once the board is done. */
export function CommentThread({ rootId, cardIds, isFacilitator }: CommentThreadProps) {
  const headingId = useId();
  const comments = useBoardStore((s) => s.comments);
  const mode = useBoardStore((s) => s.board?.mode ?? null);
  const phase = useBoardStore((s) => s.board?.phase ?? null);
  const archivedAt = useBoardStore((s) => s.board?.archived_at ?? null);
  const anonymousCards = useBoardStore((s) => s.board?.settings.anonymous_cards === true);
  const boardId = useBoardStore((s) => s.board?.id ?? null);
  // Half-typed comments, one per topic, kept while the board stays in the same phase.
  const [keeper] = useState(createDraftKeeper);
  const participantId = useBoardStore((s) => s.currentParticipantId);
  const joined = participantId !== null;
  const gate = useMemo(() => (mode === null ? null : ({ mode, phase, archived_at: archivedAt } as CommentGate)), [mode, phase, archivedAt]);
  const idsKey = cardIds.join('|');
  const threads = useMemo(() => threadsFor(comments, idsKey.split('|')), [comments, idsKey]);

  if (!gate || !commentsReadable(gate)) return null;
  const writable = commentsWritable(gate);
  const anonymousDefault = initialAnonymous({ settings: { anonymous_cards: anonymousCards } });
  const canPost = writable && joined;
  const scope = draftsScope(boardId, phase);
  const draft = draftFor(keeper.drafts(scope), rootId, anonymousDefault);
  // The change handler belongs to the topic and phase this composer was mounted for.
  const topic = rootId;
  const report = (text: string, anonymous: boolean) => keeper.put(scope, topic, { text, anonymous }, anonymousDefault);

  return (
    <section data-testid="comment-thread" aria-labelledby={headingId} className="mt-6 min-w-0 border-t border-[var(--line)] pt-4">
      <h4 id={headingId} className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
        {commentsHeading(threads)}
      </h4>
      {canPost && (
        <div className="mb-3">
          <CommentComposer
            key={`${rootId}:${scope}`}
            mode="comment"
            initialText={draft.text}
            initialAnonymous={draft.anonymous}
            defaultAnonymous={anonymousDefault}
            onDraftChange={report}
            onSubmit={(text, anonymous) =>
              useDiscussStore.getState().createComment({ cardId: rootId, body: text.trim(), anonymous, parentId: null })
            }
          />
        </div>
      )}
      {threads.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)]">{commentsEmptyText(writable)}</p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--line)]">
          {threads.map((t) => (
            <CommentItem
              key={t.top.id}
              comment={t.top}
              replies={t.replies}
              participantId={participantId}
              isFacilitator={isFacilitator}
              gate={gate}
              writable={canPost}
              anonymousDefault={anonymousDefault}
            />
          ))}
        </div>
      )}
    </section>
  );
}
