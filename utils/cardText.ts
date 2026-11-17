import type { Card } from '@/types';

/** Card text for exports. Withheld text is never exported as a blank. */
export function exportCardText(card: Card): string {
  return card.text_hidden ? '[hidden]' : card.text;
}

/** Filler shown (blurred) in place of text the server withheld from this viewer. */
export const HIDDEN_CARD_PLACEHOLDER = 'Hidden until the facilitator reveals cards';

/** Text to render for a card: the real text, or the placeholder when withheld. */
export function displayCardText(card: Card): string {
  return card.text_hidden ? HIDDEN_CARD_PLACEHOLDER : card.text;
}
