'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { ActionItemRow } from '@/components/ActionItems/ActionItemRow';
import { cn } from '@/utils/cn';
import { useBoardStore } from '@/stores/boardStore';
import { useDiscussStore } from '@/stores/discussStore';
import { actionItemsForTopic, ownerChoice } from '@/lib/agenda';
import { commentEnterPosts, commentsWritable } from '@/lib/comments';
import {
  ACTION_ITEMS_HEADING, ADD_ACTION_TEXT, NEW_ACTION_LABEL, NEW_ACTION_PLACEHOLDER, NO_OWNER_LABEL, OWNER_LABEL,
  TOPIC_ACTIONS_EMPTY,
} from '@/lib/constants/agenda';
import { editorStillOpen } from '@/lib/groups';
import type { ActionItem } from '@/types';

const FIELD =
  'min-h-11 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg-sunken)] px-3 text-base text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] md:min-h-9';
const ADD_BUTTON =
  'inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--r-md)] border border-transparent bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

interface TopicActionsProps {
  /** The topic's lead card: new items are linked to it. */
  rootId: string;
  /** The cards of the topic; an item linked to any of them is listed. */
  cardIds: string[];
}

/**
 * The action items of one topic, and, while the board is in Discuss, a form to add one with an
 * owner picked from the board's people. Items are derived from the store on every render, never
 * copied, so another person's new item or owner change shows without a reload. Blur saves
 * nothing; Enter or the button creates.
 */
export function TopicActions({ rootId, cardIds }: TopicActionsProps) {
  const headingId = useId();
  const uid = useId();
  const problemId = `${uid}-problem`;
  const board = useBoardStore((s) => s.board);
  const actionItems = useBoardStore((s) => s.actionItems);
  const participants = useBoardStore((s) => s.participants);
  const joined = useBoardStore((s) => s.currentParticipantId) !== null;
  const updateActionItem = useBoardStore((s) => s.updateActionItem);
  const deleteActionItem = useBoardStore((s) => s.deleteActionItem);
  const clearWriteError = useBoardStore((s) => s.clearWriteError);
  const [openedIn] = useState(() => useBoardStore.getState().board?.phase ?? null);
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const idsKey = cardIds.join('|');
  const items: ActionItem[] = useMemo(() => actionItemsForTopic(actionItems, idsKey.split('|')), [actionItems, idsKey]);

  if (!board) return null;
  const writable = commentsWritable(board);
  // The same rule the board-level panel uses: a completed board is read-only.
  const readOnly = !!board.archived_at;
  const empty = text.trim() === '';

  const submit = () => {
    // A ref, not state: two Enter presses in one tick must send one request.
    if (busyRef.current || empty) return;
    const live = useBoardStore.getState().board;
    if (openedIn === null || !editorStillOpen(openedIn, live?.phase ?? null, commentsWritable(live))) return;
    const choice = ownerChoice(owner);
    busyRef.current = true;
    setBusy(true);
    setProblem(null);
    useDiscussStore
      .getState()
      .createTopicAction({
        cardId: rootId,
        description: text.trim(),
        assigneeParticipantId: choice.kind === 'assign' ? choice.participantId : null,
      })
      .then(() => {
        setText('');
        setOwner('');
        inputRef.current?.focus();
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        // Only this form's own error: another write's banner message stays.
        if (useBoardStore.getState().lastWriteError === message) clearWriteError();
        setProblem(message);
      })
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  };

  return (
    <section data-testid="topic-actions" aria-labelledby={headingId} className="mt-6 min-w-0 border-t border-[var(--line)] pt-4">
      <h4 id={headingId} className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
        {ACTION_ITEMS_HEADING}
      </h4>
      {writable && joined && (
        <div className="mb-3 flex flex-col gap-2">
          <input
            ref={inputRef}
            aria-label={NEW_ACTION_LABEL}
            placeholder={NEW_ACTION_PLACEHOLDER}
            value={text}
            enterKeyHint="send"
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? problemId : undefined}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (commentEnterPosts(e.key, false, e.nativeEvent.isComposing || e.keyCode === 229)) {
                e.preventDefault();
                submit();
              }
            }}
            className={cn(FIELD, 'w-full placeholder:text-[var(--ink-4)]', problem && 'border-[var(--danger)]')}
          />
          <div className="flex gap-2">
            <select
              aria-label={OWNER_LABEL}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={cn(FIELD, 'min-w-0 flex-1 truncate')}
            >
              <option value="">{NO_OWNER_LABEL}</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
            <button type="button" onClick={submit} disabled={empty || busy} aria-busy={busy || undefined} className={ADD_BUTTON}>
              {ADD_ACTION_TEXT}
            </button>
          </div>
          {problem && (
            <p id={problemId} role="alert" className="text-sm text-[var(--danger)]">
              {problem}
            </p>
          )}
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)]">{TOPIC_ACTIONS_EMPTY}</p>
      ) : (
        <div className="flex flex-col gap-2 [&_p]:[overflow-wrap:anywhere]">
          {items.map((item) => (
            <ActionItemRow
              key={item.id}
              item={item}
              participants={participants}
              onUpdate={(id, updates) => { updateActionItem(id, updates).catch(() => {}); }}
              onDelete={(id) => { deleteActionItem(id).catch(() => {}); }}
              readOnly={readOnly}
              assigneeMode="participant"
              onAssign={(id, participantId) => { useDiscussStore.getState().assignActionItem(id, participantId).catch(() => {}); }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
