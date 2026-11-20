import { GROUP_TITLE_MAX } from '@/lib/constants/groups';
import type { Card } from '@/types';

type Parented = Pick<Card, 'id' | 'merged_with'>;

/** A lead card exists, has no parent, and has at least one child. */
export function isLeadCard(cardId: string, cards: readonly Parented[]): boolean {
  const card = cards.find((c) => c.id === cardId);
  if (!card || card.merged_with !== null) return false;
  return cards.some((c) => c.merged_with === cardId);
}

/** A title shows only on a lead card; one on a card that is not a lead stays stored but hidden. */
export function visibleGroupTitle(
  cardId: string,
  cards: readonly Pick<Card, 'id' | 'merged_with' | 'group_title'>[],
): string | null {
  if (!isLeadCard(cardId, cards)) return null;
  return cards.find((c) => c.id === cardId)?.group_title ?? null;
}

/** Trims; empty clears; counts code points, as the SQL char_length CHECK does. */
export function validateGroupTitle(
  v: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === null) return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false, error: 'Invalid group title' };
  const value = v.trim();
  if (value === '') return { ok: true, value: null };
  if ([...value].length > GROUP_TITLE_MAX) {
    return { ok: false, error: `Group title must be at most ${GROUP_TITLE_MAX} characters` };
  }
  return { ok: true, value };
}

/** Every card loses its parent and its title. */
export function ungroupAll<C extends { merged_with: string | null; group_title?: string | null }>(
  cards: readonly C[],
): C[] {
  return cards.map((c) => ({ ...c, merged_with: null, group_title: null }));
}

export function hasGrouping(cards: readonly Pick<Card, 'merged_with' | 'group_title'>[]): boolean {
  return cards.some((c) => c.merged_with !== null || (c.group_title ?? null) !== null);
}
