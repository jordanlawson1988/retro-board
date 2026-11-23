import { FIRST_PHASE, GUIDED_MODE, PHASES, type BoardMode } from '@/lib/constants/phases';
import type { Card } from '@/types';

/** Card text for exports. Withheld text is never exported as a blank. */
export function exportCardText(card: Card): string {
  return card.text_hidden ? '[hidden]' : card.text;
}

/** Filler shown (blurred) in place of text the server withheld from this viewer. */
export const HIDDEN_CARD_PLACEHOLDER = 'Hidden until the facilitator reveals cards';

/**
 * The placeholder for a board's mode. A guided board has no reveal switch: cards show when its
 * first phase ends. An open board, or a mode that is not known, keeps the facilitator wording.
 */
export function hiddenCardPlaceholder(mode?: BoardMode | null): string {
  return mode === GUIDED_MODE ? `Hidden until ${PHASES[FIRST_PHASE].label} ends` : HIDDEN_CARD_PLACEHOLDER;
}

/** Text to render for a card: the real text, or the placeholder when withheld. */
export function displayCardText(card: Card, mode?: BoardMode | null): string {
  return card.text_hidden ? hiddenCardPlaceholder(mode) : card.text;
}
