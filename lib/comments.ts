import {
  COMMENT_BODY_MAX,
  COMMENT_COUNTER_FROM,
  COMMENT_EMPTY_ERROR,
  COMMENTS_HEADING,
  COMMENTS_EMPTY_READONLY,
  COMMENTS_EMPTY_WRITABLE,
  COMMENT_TOO_LONG_ERROR,
} from '@/lib/constants/comments';
import { FINAL_PHASE, GUIDED_MODE, PHASES, type PhaseId } from '@/lib/constants/phases';
import { INVALID_BODY } from '@/lib/board-validation';
import { compareByCreated, editorStillOpen } from '@/lib/groups';
import type { Board, BoardSettings, Comment } from '@/types';

/** Length in code points, so an emoji counts as one. */
export function commentLength(v: string): number {
  return [...v].length;
}

/** The first COMMENT_BODY_MAX code points; a surrogate pair is never cut in half. */
export function clampComment(v: string): string {
  const points = [...v];
  return points.length <= COMMENT_BODY_MAX ? v : points.slice(0, COMMENT_BODY_MAX).join('');
}

/** The counter appears only on long comments. */
export function showCommentCounter(v: string): boolean {
  return commentLength(v) >= COMMENT_COUNTER_FROM;
}

export function validateCommentBody(v: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof v !== 'string') return { ok: false, error: INVALID_BODY };
  const value = v.trim();
  if (value === '') return { ok: false, error: COMMENT_EMPTY_ERROR };
  if (commentLength(value) > COMMENT_BODY_MAX) return { ok: false, error: COMMENT_TOO_LONG_ERROR };
  return { ok: true, value };
}

/** Comments are read in phases that allow them, and in the final phase. */
export function commentsReadable(board: Pick<Board, 'mode' | 'phase'> | null): boolean {
  if (!board || board.mode !== GUIDED_MODE || board.phase === null) return false;
  return PHASES[board.phase].profile.canComment || board.phase === FINAL_PHASE;
}

export function commentsWritable(board: Pick<Board, 'mode' | 'phase' | 'archived_at'> | null): boolean {
  if (!board || board.mode !== GUIDED_MODE || board.phase === null) return false;
  return PHASES[board.phase].profile.canComment && board.archived_at === null;
}

export interface CommentThread {
  top: Comment;
  replies: Comment[];
}

/**
 * Top-level comments on the given cards, oldest first, each with its replies oldest first.
 * A reply whose parent is not in the list is left out; a deleted parent stays only while it has replies.
 */
export function threadsFor(comments: readonly Comment[], cardIds: readonly string[]): CommentThread[] {
  const tops = comments
    .filter((c) => c.parent_id === null && cardIds.includes(c.card_id))
    .sort(compareByCreated);
  return tops
    .map((top) => ({
      top,
      replies: comments.filter((c) => c.parent_id === top.id).sort(compareByCreated),
    }))
    .filter((t) => t.top.deleted_at === null || t.replies.length > 0);
}

export function isMyComment(c: Comment, participantId: string | null): boolean {
  return c.is_mine === true || (c.author_participant_id !== null && c.author_participant_id === participantId);
}

export function canEditComment(c: Comment, participantId: string | null, writable: boolean): boolean {
  return writable && c.deleted_at === null && isMyComment(c, participantId);
}

export function canDeleteComment(
  c: Comment,
  participantId: string | null,
  isFacilitator: boolean,
  writable: boolean,
): boolean {
  return writable && c.deleted_at === null && (isMyComment(c, participantId) || isFacilitator);
}

export function canReplyTo(c: Comment, writable: boolean): boolean {
  return writable && c.parent_id === null && c.deleted_at === null;
}

export function commentAuthorLabel(c: Comment, participantId: string | null): string {
  if (c.deleted_at !== null) return '';
  const mine = isMyComment(c, participantId);
  if (mine) return c.is_anonymous ? 'You (anonymous)' : 'You';
  if (c.is_anonymous || !c.author_name) return 'Anonymous';
  return c.author_name;
}

const isStringOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';

/** A comment from untrusted JSON (an Ably message, a response), or null when it is not one. */
export function parseComment(v: unknown): Comment | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (
    typeof o.id !== 'string' ||
    typeof o.board_id !== 'string' ||
    typeof o.card_id !== 'string' ||
    !isStringOrNull(o.parent_id) ||
    !isStringOrNull(o.author_participant_id) ||
    !isStringOrNull(o.author_name) ||
    typeof o.is_anonymous !== 'boolean' ||
    typeof o.body !== 'string' ||
    typeof o.created_at !== 'string' ||
    !isStringOrNull(o.edited_at) ||
    !isStringOrNull(o.deleted_at)
  ) {
    return null;
  }
  const comment: Comment = {
    id: o.id,
    board_id: o.board_id,
    card_id: o.card_id,
    parent_id: o.parent_id,
    author_participant_id: o.author_participant_id,
    author_name: o.author_name,
    is_anonymous: o.is_anonymous,
    body: o.body,
    created_at: o.created_at,
    edited_at: o.edited_at,
    deleted_at: o.deleted_at,
  };
  if (typeof o.is_mine === 'boolean') comment.is_mine = o.is_mine;
  return comment;
}

/** The parsable comments of a list; anything that is not a comment is dropped. */
export function parseCommentList(v: unknown): Comment[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    const c = parseComment(item);
    return c ? [c] : [];
  });
}

/** A `comment-deleted` payload or a delete answer: the ids, and the tombstone or null. Null when malformed. */
export function parseCommentDeletion(v: unknown): { ids: string[]; tombstone: Comment | null } | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.ids) || !o.ids.every((id) => typeof id === 'string')) return null;
  if (o.tombstone === null || o.tombstone === undefined) return { ids: o.ids as string[], tombstone: null };
  const tombstone = parseComment(o.tombstone);
  return tombstone ? { ids: o.ids as string[], tombstone } : null;
}

/** The incoming row wins; ownership, which only this client knows, is never lost. */
export function mergeIncomingComment(local: Comment | undefined, incoming: Comment): Comment {
  return { ...incoming, is_mine: (local?.is_mine ?? false) || (incoming.is_mine ?? false) };
}

export function upsertComment(list: readonly Comment[], incoming: Comment): Comment[] {
  const at = list.findIndex((c) => c.id === incoming.id);
  if (at === -1) return [...list, mergeIncomingComment(undefined, incoming)];
  return list.map((c, i) => (i === at ? mergeIncomingComment(c, incoming) : c));
}

/**
 * Drops the ids; a tombstone (a deleted comment kept for its replies) replaces its own row, or is
 * appended when the row is not in the list, so its replies stay visible. Applying it twice changes nothing.
 */
export function removeComments(
  list: readonly Comment[],
  ids: readonly string[],
  tombstone: Comment | null,
): Comment[] {
  const kept = list
    .filter((c) => !ids.includes(c.id) || c.id === tombstone?.id)
    .map((c) => (tombstone && c.id === tombstone.id ? mergeIncomingComment(c, tombstone) : c));
  if (tombstone && !kept.some((c) => c.id === tombstone.id)) kept.push(mergeIncomingComment(undefined, tombstone));
  return kept;
}

export type CommentChange =
  | { boardId: string; kind: 'upsert'; comment: Comment }
  | { boardId: string; kind: 'remove'; ids: string[]; tombstone: Comment | null };

/** Applies, in order, the changes for `boardId` that arrived while a GET was in flight. */
export function replayComments(
  fromGet: readonly Comment[],
  changes: readonly CommentChange[],
  boardId: string,
): Comment[] {
  let list = [...fromGet];
  for (const change of changes) {
    if (change.boardId !== boardId) continue;
    list =
      change.kind === 'upsert'
        ? upsertComment(list, change.comment)
        : removeComments(list, change.ids, change.tombstone);
  }
  return list;
}

/** Maps the row of the create-comment statement; a missing row means the board check failed. */
export function createCommentOutcome(
  row:
    | {
        board_ok: boolean;
        card_found: number;
        card_parent: string | null;
        parent_ok: boolean;
        comment_count: number;
        id: unknown;
      }
    | undefined,
  isReply: boolean,
  max: number,
): 'ok' | 'phase-changed' | 'card-missing' | 'not-a-topic' | 'bad-parent' | 'limit' {
  if (!row || !row.board_ok) return 'phase-changed';
  if (row.card_found === 0) return 'card-missing';
  if (!isReply && row.card_parent !== null) return 'not-a-topic';
  if (isReply && !row.parent_ok) return 'bad-parent';
  if (row.comment_count >= max) return 'limit';
  return row.id === null || row.id === undefined ? 'phase-changed' : 'ok';
}

export function editCommentOutcome(
  row:
    | { board_ok: boolean; found: number; is_deleted: boolean | null; is_author: boolean | null; id: unknown }
    | undefined,
): 'ok' | 'phase-changed' | 'missing' | 'gone' | 'not-yours' {
  if (!row) return 'missing';
  if (!row.board_ok) return 'phase-changed';
  if (row.found === 0) return 'missing';
  if (row.is_deleted) return 'gone';
  if (!row.is_author) return 'not-yours';
  return row.id === null || row.id === undefined ? 'phase-changed' : 'ok';
}

export function deleteCommentOutcome(
  row: { board_ok: boolean; found: number; already_deleted: boolean | null; permitted: boolean } | undefined,
): 'ok' | 'phase-changed' | 'missing' | 'gone' | 'denied' {
  if (!row) return 'missing';
  if (!row.board_ok) return 'phase-changed';
  if (row.found === 0) return 'missing';
  if (row.already_deleted) return 'gone';
  return row.permitted ? 'ok' : 'denied';
}

/** Whether a key press in a comment textarea posts. Shift+Enter is a line break; a composition (IME) is never cut short. */
export function commentEnterPosts(key: string, shiftKey: boolean, isComposing: boolean): boolean {
  return key === 'Enter' && !shiftKey && !isComposing;
}

/** `Discussion`, with ` (n)` when there are live comments (tombstones are not counted). */
export function commentsHeading(threads: readonly CommentThread[]): string {
  const live = threads.reduce(
    (n, t) => n + (t.top.deleted_at === null ? 1 : 0) + t.replies.filter((r) => r.deleted_at === null).length,
    0,
  );
  return live > 0 ? `${COMMENTS_HEADING} (${live})` : COMMENTS_HEADING;
}

/** `canPost`: the board is writable and the viewer has joined (so a composer is shown). */
export function commentsEmptyText(canPost: boolean): string {
  return canPost ? COMMENTS_EMPTY_WRITABLE : COMMENTS_EMPTY_READONLY;
}

/** The anonymous checkbox starts (and returns to) the board's setting. */
export function initialAnonymous(board: { settings: Pick<BoardSettings, 'anonymous_cards'> } | null): boolean {
  return board?.settings.anonymous_cards === true;
}

export function commentCounterText(v: string): string {
  return `${commentLength(v)} of ${COMMENT_BODY_MAX}`;
}

/**
 * Whether a reply box, editor or delete confirmation stays open: it belongs to the phase it opened in,
 * to a writable board, and to a live comment that still allows that action for this person.
 */
export function commentFormOpen(
  kind: 'reply' | 'edit' | 'delete',
  openedIn: PhaseId,
  currentPhase: PhaseId | null,
  live: Comment | undefined,
  board: Pick<Board, 'mode' | 'phase' | 'archived_at'> | null,
  participantId: string | null,
  isFacilitator: boolean,
): boolean {
  if (!live) return false;
  const writable = commentsWritable(board);
  const allowed =
    kind === 'reply'
      ? canReplyTo(live, writable)
      : kind === 'edit'
        ? canEditComment(live, participantId, writable)
        : canDeleteComment(live, participantId, isFacilitator, writable);
  return editorStillOpen(openedIn, currentPhase, allowed);
}

/**
 * What saving an edit does: nothing for text equal to what the editor opened with, else the trimmed
 * text. The editor never calls it with blank text (it returns early and `Save` is disabled).
 */
export function commentEditDecision(
  openedWith: string,
  typed: string,
): { kind: 'unchanged' } | { kind: 'send'; value: string } {
  const value = typed.trim();
  return value === openedWith.trim() ? { kind: 'unchanged' } : { kind: 'send', value };
}

/** After a write answered: the box may clear or close only if nothing was typed since the send. */
export function sentTextUnchanged(sent: string, current: string): boolean {
  return sent === current;
}

/**
 * What a comment or reply box holds after its write answered: what was typed after the sent text.
 * Text that no longer starts with what was sent (it was edited meanwhile) is kept whole.
 */
export function textAfterSend(sent: string, current: string): string {
  if (current === '') return '';
  return current.startsWith(sent) ? current.slice(sent.length) : current;
}

export interface CommentDraft {
  text: string;
  anonymous: boolean;
}

/** A topic's draft; with none stored, empty text and the board's default checkbox value. */
export function draftFor(drafts: ReadonlyMap<string, CommentDraft>, topicId: string, defaultAnonymous: boolean): CommentDraft {
  return drafts.get(topicId) ?? { text: '', anonymous: defaultAnonymous };
}

/** The drafts after a change in one topic's composer; an untouched composer leaves no entry. */
export function withDraft(
  drafts: ReadonlyMap<string, CommentDraft>,
  topicId: string,
  draft: CommentDraft,
  defaultAnonymous: boolean,
): Map<string, CommentDraft> {
  const next = new Map(drafts);
  if (draft.text === '' && draft.anonymous === defaultAnonymous) next.delete(topicId);
  else next.set(topicId, draft);
  return next;
}

export function withoutDraft(drafts: ReadonlyMap<string, CommentDraft>, topicId: string): Map<string, CommentDraft> {
  const next = new Map(drafts);
  next.delete(topicId);
  return next;
}

export function draftsScope(boardId: string | null, phase: PhaseId | null): string {
  return `${boardId ?? ''}:${phase ?? ''}`;
}

/** The held drafts while the board and phase are the same; none at all once either changes. */
export function scopedDrafts(
  held: { scope: string; drafts: Map<string, CommentDraft> } | null,
  scope: string,
): { scope: string; drafts: Map<string, CommentDraft> } {
  return held && held.scope === scope ? held : { scope, drafts: new Map() };
}

/**
 * Holds the half-typed comments of one thread instance, one per topic, for one board and phase.
 * Asking for another scope (the phase or board changed) drops everything held.
 */
export function createDraftKeeper() {
  let held: { scope: string; drafts: Map<string, CommentDraft> } | null = null;
  return {
    drafts(scope: string): ReadonlyMap<string, CommentDraft> {
      held = scopedDrafts(held, scope);
      return held.drafts;
    },
    /** An empty draft at the default checkbox value is removed (a post cleared it). */
    put(scope: string, topicId: string, draft: CommentDraft, defaultAnonymous: boolean): void {
      held = { scope, drafts: withDraft(scopedDrafts(held, scope).drafts, topicId, draft, defaultAnonymous) };
    },
  };
}
