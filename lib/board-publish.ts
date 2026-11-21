import type { Card } from '@/types';
import type { VoteTally } from '@/lib/votes';
import { PUBLIC_VIEWER, shapeCard, votesAreSecret, type ViewBoard } from '@/lib/board-view';

export type CardEvent = 'card-created' | 'card-updated';
export type VoteEvent = 'vote-cast' | 'vote-removed';

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
