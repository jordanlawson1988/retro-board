import type { Card } from '@/types';

/**
 * Merge a card that arrived over the wire into the card we already hold.
 *
 * Ably events are shaped for nobody (text may be withheld, author may be null,
 * is_mine is always false), so a naive replace would blank the viewer's own
 * card. Ownership is decided by the LOCAL card's is_mine, never the incoming
 * one. Pure; never mutates its inputs.
 */
export function mergeIncomingCard(local: Card | undefined, incoming: Card): Card {
  if (!local) return incoming;

  if (!local.is_mine) {
    return { ...incoming, is_mine: false };
  }

  const merged: Card = { ...incoming, is_mine: true };

  if (incoming.text_hidden) {
    merged.text = local.text;
    merged.text_hidden = false;
  }
  if (incoming.author_id === null || incoming.text_hidden) {
    merged.author_id = local.author_id;
    merged.author_name = local.author_name;
  }
  return merged;
}
