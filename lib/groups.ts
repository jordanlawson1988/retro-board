import { GROUP_TITLE_COUNTER_FROM, GROUP_TITLE_MAX } from '@/lib/constants/groups';
import type { PhaseId } from '@/lib/constants/phases';
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

export const NOT_A_GROUP_ERROR = 'Only a group can have a title';
export { CARD_NOT_FOUND_ERROR } from '@/lib/constants/votes';

export type GroupTitleOutcome = 'ok' | 'card-missing' | 'not-a-group' | 'phase-changed';

/**
 * Maps the rows of the set-title statement. The statement always returns the target row when
 * the card exists; the updated columns are null when the update matched nothing.
 */
export function groupTitleOutcome(
  rows: readonly { target_is_lead: boolean; id: string | null }[],
): GroupTitleOutcome {
  const row = rows[0];
  if (!row) return 'card-missing';
  if (!row.target_is_lead) return 'not-a-group';
  if (row.id === null) return 'phase-changed';
  return 'ok';
}

/** Maps the row of the reset statement: no board match means the phase moved (or the board closed). */
export function groupResetOutcome(row: { board_ok: boolean; cleared: number }): 'ok' | 'phase-changed' {
  return row.board_ok ? 'ok' : 'phase-changed';
}

export const SET_TITLE_FALLBACK = 'Failed to save the group title';
export const RESET_GROUPING_FALLBACK = 'Failed to reset grouping';

/** Length in code points, counted the way `validateGroupTitle` and the SQL CHECK count it. */
export function groupTitleLength(v: string): number {
  return [...v].length;
}

/** The first GROUP_TITLE_MAX code points; an emoji is never split. */
export function clampGroupTitle(v: string): string {
  const points = [...v];
  return points.length <= GROUP_TITLE_MAX ? v : points.slice(0, GROUP_TITLE_MAX).join('');
}

/** The counter appears only on long titles. */
export function showTitleCounter(v: string): boolean {
  return groupTitleLength(v) > GROUP_TITLE_COUNTER_FROM;
}

/** An open title editor belongs to the phase it was opened in and to a moment when editing is allowed. */
export function editorStillOpen(openedIn: PhaseId, current: PhaseId | null, editingAllowed: boolean): boolean {
  return editingAllowed && openedIn === current;
}

/**
 * Whether closing the title editor sends a write. Nothing goes out for text the person did not
 * change from what the editor opened with (whatever the store's title became meanwhile, so
 * another person's rename is never overwritten by an untouched editor), nor for a value the
 * store already holds. A different text is sent as typed: last write wins.
 */
export function titleSaveDecision(
  openedWith: string,
  current: string,
  storeTitle: string | null,
): { send: false } | { send: true; value: string | null } {
  const typed = current.trim();
  if (typed === openedWith.trim()) return { send: false };
  const value = typed === '' ? null : typed;
  if (value === storeTitle) return { send: false };
  return { send: true, value };
}
