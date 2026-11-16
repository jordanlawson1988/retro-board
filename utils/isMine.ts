import type { Card } from '@/types';

/**
 * Does the current viewer own this card? The server's is_mine flag wins; cards
 * without it (v1 boards, locally built cards) fall back to the author id.
 */
export function isMine(card: Card, currentParticipantId: string | null): boolean {
  return card.is_mine ?? (card.author_id !== null && card.author_id === currentParticipantId);
}
