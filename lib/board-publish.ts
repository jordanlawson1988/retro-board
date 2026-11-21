import type { Card, Comment } from '@/types';
import { COMMENT_DELETED, type COMMENT_EVENTS } from '@/lib/constants/comments';
import type { VoteTally } from '@/lib/votes';
import { PUBLIC_VIEWER, shapeCard, shapeComment, votesAreSecret, type ViewBoard } from '@/lib/board-view';

export type CardEvent = 'card-created' | 'card-updated';
export type VoteEvent = 'vote-cast' | 'vote-removed';
/** The two comment events that carry a whole comment (the deleted event carries ids). */
export type CommentWriteEvent = (typeof COMMENT_EVENTS)[0 | 1];

/** Pure: the Ably payload for a card event. Everyone on the channel gets the public view. */
export function cardEventPayload(card: Card, board: ViewBoard): { card: Card } {
  return { card: shapeCard(card, board, PUBLIC_VIEWER) };
}

/** Pure: the Ably payload for a vote event, or null when secret voting means nothing is published. */
export function voteEventPayload<T extends object>(payload: T, board: ViewBoard): T | null {
  return votesAreSecret(board) ? null : payload;
}

/** Pure: the team vote tally payload. An aggregate only; nothing else is ever copied across. */
export function voteTallyPayload(t: VoteTally): VoteTally {
  return { used: t.used, at: t.at };
}

/**
 * Pure: the Ably payload for a created or updated comment. Shaped for nobody, so is_mine is
 * always false on the wire (the client keeps its own is_mine) and an anonymous comment carries
 * no author.
 */
export function commentEventPayload(c: Comment): { comment: Comment } {
  return { comment: shapeComment(c, PUBLIC_VIEWER) };
}

/** Pure: the payload for a deleted comment: the ids removed and, when it keeps replies, its tombstone. */
export function commentDeletedPayload(
  ids: readonly string[],
  tombstone: Comment | null,
): { ids: string[]; tombstone: Comment | null } {
  return { ids: [...ids], tombstone: tombstone === null ? null : shapeComment(tombstone, PUBLIC_VIEWER) };
}

// ably-server throws at import without ABLY_API_KEY, so load it only when publishing.
async function channelFor(boardId: string) {
  const { ablyServer } = await import('@/lib/ably-server');
  return ablyServer.channels.get(`retro-board:${boardId}`);
}

export async function publishCard(
  boardId: string,
  event: CardEvent,
  card: Card,
  board: ViewBoard
): Promise<void> {
  const channel = await channelFor(boardId);
  await channel.publish(event, cardEventPayload(card, board));
}

export async function publishVote(
  boardId: string,
  event: VoteEvent,
  payload: object,
  board: ViewBoard
): Promise<void> {
  const out = voteEventPayload(payload, board);
  if (out === null) return;
  const channel = await channelFor(boardId);
  await channel.publish(event, out);
}

export async function publishVoteTally(boardId: string, t: VoteTally): Promise<void> {
  const channel = await channelFor(boardId);
  await channel.publish('vote-tally', voteTallyPayload(t));
}

export async function publishComment(boardId: string, event: CommentWriteEvent, c: Comment): Promise<void> {
  const channel = await channelFor(boardId);
  await channel.publish(event, commentEventPayload(c));
}

export async function publishCommentDeleted(
  boardId: string,
  ids: readonly string[],
  tombstone: Comment | null,
): Promise<void> {
  const channel = await channelFor(boardId);
  await channel.publish(COMMENT_DELETED, commentDeletedPayload(ids, tombstone));
}
