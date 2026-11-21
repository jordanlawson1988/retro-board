import { create } from 'zustand';
import { useBoardStore } from '@/stores/boardStore';
import { failAction, noAnswer } from '@/stores/failAction';
import { NETWORK_ERROR } from '@/stores/phaseStore';
import { GUIDED_MODE } from '@/lib/constants/phases';
import {
  POST_COMMENT_FALLBACK, SAVE_COMMENT_FALLBACK, DELETE_COMMENT_FALLBACK,
} from '@/lib/constants/comments';
import { SET_TOPIC_FALLBACK, ADD_TOPIC_ACTION_FALLBACK, ASSIGN_FALLBACK } from '@/lib/constants/agenda';
import { applyPhaseChanged } from '@/lib/phases';
import { parseComment, parseCommentDeletion, removeComments, upsertComment, type CommentChange } from '@/lib/comments';
import { recordCommentChange } from '@/lib/commentJournal';
import type { ViewedTopic } from '@/lib/agenda';
import type { ActionItem, Board } from '@/types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface DiscussState {
  /** A participant looking at another topic; null means following the facilitator's. */
  viewed: ViewedTopic | null;
  settingTopic: boolean;
  viewTopic: (cardId: string | null) => void;
  setTopic: (cardId: string) => Promise<void>;
  createComment: (input: { cardId: string; body: string; anonymous: boolean; parentId: string | null }) => Promise<void>;
  editComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  createTopicAction: (input: { cardId: string; description: string; assigneeParticipantId: string | null }) => Promise<void>;
  assignActionItem: (itemId: string, participantId: string | null) => Promise<void>;
}

function guidedBoard(): Board | null {
  const { board } = useBoardStore.getState();
  return board && board.mode === GUIDED_MODE ? board : null;
}

const onBoard = (boardId: string) => useBoardStore.getState().board?.id === boardId;

/** Applies a comment change to the store and records it for a GET still in flight. */
function applyCommentChange(change: CommentChange): void {
  recordCommentChange(change);
  useBoardStore.setState((s) => ({
    comments:
      change.kind === 'upsert' ? upsertComment(s.comments, change.comment) : removeComments(s.comments, change.ids, change.tombstone),
  }));
}

/** A `comment-created` or `comment-updated` event: ignored unless it is for this guided board and parses. */
export function applyCommentUpsertEvent(boardId: string, data: unknown): void {
  const board = guidedBoard();
  if (!board || board.id !== boardId) return;
  const comment = parseComment((data as { comment?: unknown } | null | undefined)?.comment);
  if (!comment || comment.board_id !== boardId) return;
  applyCommentChange({ boardId, kind: 'upsert', comment });
}

/** A `comment-deleted` event: ignored unless it is for this guided board and parses. */
export function applyCommentDeletedEvent(boardId: string, data: unknown): void {
  const board = guidedBoard();
  if (!board || board.id !== boardId) return;
  const deletion = parseCommentDeletion(data);
  if (!deletion) return;
  applyCommentChange({ boardId, kind: 'remove', ids: deletion.ids, tombstone: deletion.tombstone });
}

/** Sends a JSON write for a board; rejects through failAction when it fails, else returns the parsed answer. */
async function send(
  boardId: string,
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body: unknown,
  fallback: string,
  beforeFail?: () => void,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`/api/boards/${boardId}/${path}`, { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
  } catch {
    beforeFail?.();
    throw await failAction(null, NETWORK_ERROR, boardId);
  }
  if (!res.ok) {
    beforeFail?.();
    throw await failAction(res, fallback, boardId);
  }
  return res.json().catch(() => null);
}

/** A 200 in a shape we do not understand leaves the server's state unknown: fail and pull the truth. */
async function unreadable(fallback: string, boardId: string, beforeFail?: () => void): Promise<never> {
  beforeFail?.();
  throw await failAction(noAnswer(), fallback, boardId);
}

export const useDiscussStore = create<DiscussState>((set, get) => ({
  viewed: null,
  settingTopic: false,

  viewTopic: (cardId) => {
    const board = guidedBoard();
    if (!board) return;
    if (cardId === null) {
      if (get().viewed !== null) set({ viewed: null });
      return;
    }
    if (!board.phase) return;
    set({ viewed: { boardId: board.id, phase: board.phase, cardId } });
  },

  setTopic: async (cardId) => {
    if (get().settingTopic) return;
    const board = guidedBoard();
    if (!board || !board.phase) return;
    const boardId = board.id;
    const sentIn = board.phase;
    const hadTopic = 'topic' in board.phase_config;
    const previous = board.phase_config.topic;

    const setTopicOn = (topic: string | null | undefined) =>
      useBoardStore.setState((s) => {
        if (!s.board) return {};
        const config = { ...s.board.phase_config };
        if (topic === undefined) delete config.topic;
        else config.topic = topic;
        return { board: { ...s.board, phase_config: config } };
      });
    setTopicOn(cardId);
    set({ settingTopic: true });

    // A failed change is reversed only while the board still shows this request's optimistic topic.
    const revert = () => {
      if (!onBoard(boardId)) return;
      const now = useBoardStore.getState().board;
      if (now && now.phase === sentIn && now.phase_config.topic === cardId) setTopicOn(hadTopic ? previous : undefined);
    };

    try {
      const data = await send(boardId, 'phase', 'POST', { action: 'set-topic', cardId }, SET_TOPIC_FALLBACK, revert);
      if (!onBoard(boardId)) return;
      const applies = useBoardStore.getState().board?.phase === sentIn;
      if (!applies) return;
      useBoardStore.setState((s) => ({ board: s.board && s.board.phase === sentIn ? applyPhaseChanged(s.board, data) : s.board }));
      if (get().viewed !== null) set({ viewed: null });
    } finally {
      set({ settingTopic: false });
    }
  },

  createComment: async ({ cardId, body, anonymous, parentId }) => {
    const board = guidedBoard();
    if (!board || !useBoardStore.getState().currentParticipantId) return;
    const boardId = board.id;
    const data = await send(boardId, 'comments', 'POST', { cardId, body, anonymous, parentId }, POST_COMMENT_FALLBACK);
    const comment = parseComment((data as { comment?: unknown } | null)?.comment);
    if (!comment) return unreadable(POST_COMMENT_FALLBACK, boardId);
    if (onBoard(boardId)) applyCommentChange({ boardId, kind: 'upsert', comment });
  },

  editComment: async (commentId, body) => {
    const board = guidedBoard();
    if (!board || !useBoardStore.getState().currentParticipantId) return;
    const boardId = board.id;
    const stored = useBoardStore.getState().comments.find((c) => c.id === commentId);
    if (!stored || body.trim() === stored.body) return;
    const data = await send(boardId, 'comments', 'PATCH', { commentId, body }, SAVE_COMMENT_FALLBACK);
    const comment = parseComment((data as { comment?: unknown } | null)?.comment);
    if (!comment) return unreadable(SAVE_COMMENT_FALLBACK, boardId);
    if (onBoard(boardId)) applyCommentChange({ boardId, kind: 'upsert', comment });
  },

  deleteComment: async (commentId) => {
    const board = guidedBoard();
    if (!board) return;
    const boardId = board.id;
    const data = await send(boardId, 'comments', 'DELETE', { commentId }, DELETE_COMMENT_FALLBACK);
    const deletion = parseCommentDeletion(data);
    if (!deletion) return unreadable(DELETE_COMMENT_FALLBACK, boardId);
    if (onBoard(boardId)) applyCommentChange({ boardId, kind: 'remove', ids: deletion.ids, tombstone: deletion.tombstone });
  },

  createTopicAction: async ({ cardId, description, assigneeParticipantId }) => {
    const board = guidedBoard();
    if (!board || !useBoardStore.getState().currentParticipantId) return;
    const boardId = board.id;
    const data = await send(
      boardId, 'action-items', 'POST', { description, cardId, assigneeParticipantId }, ADD_TOPIC_ACTION_FALLBACK,
    );
    const item = (data as { item?: ActionItem } | null)?.item;
    if (!item || typeof item.id !== 'string') return unreadable(ADD_TOPIC_ACTION_FALLBACK, boardId);
    if (!onBoard(boardId)) return;
    useBoardStore.setState((s) => (s.actionItems.some((a) => a.id === item.id) ? s : { actionItems: [...s.actionItems, item] }));
  },

  assignActionItem: async (itemId, participantId) => {
    const board = guidedBoard();
    if (!board || !useBoardStore.getState().currentParticipantId) return;
    const boardId = board.id;
    const { actionItems, participants } = useBoardStore.getState();
    const previous = actionItems.find((a) => a.id === itemId);
    if (!previous) return;
    const name = participantId === null ? null : participants.find((p) => p.id === participantId)?.display_name ?? null;

    const replaceItem = (fn: (a: ActionItem) => ActionItem) =>
      useBoardStore.setState((s) => ({ actionItems: s.actionItems.map((a) => (a.id === itemId ? fn(a) : a)) }));
    replaceItem((a) => ({ ...a, assignee: name, assignee_participant_id: participantId }));

    // Reversed only while the item still shows this request's optimistic owner.
    const revert = () => {
      if (!onBoard(boardId)) return;
      const now = useBoardStore.getState().actionItems.find((a) => a.id === itemId);
      if (now && (now.assignee_participant_id ?? null) === participantId) {
        replaceItem((a) => ({ ...a, assignee: previous.assignee, assignee_participant_id: previous.assignee_participant_id }));
      }
    };

    const data = await send(
      boardId, 'action-items', 'PATCH', { itemId, updates: { assignee_participant_id: participantId } }, ASSIGN_FALLBACK, revert,
    );
    const item = (data as { item?: ActionItem } | null)?.item;
    if (!item || typeof item.id !== 'string') return unreadable(ASSIGN_FALLBACK, boardId, revert);
    if (onBoard(boardId)) replaceItem(() => item);
  },
}));

