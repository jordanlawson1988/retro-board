import { ACTION_ITEM_STATUSES } from '@/types';
import { isPlainObject } from '@/lib/request-body';

export type Validation = { ok: true } | { ok: false; error: string };
const OK: Validation = { ok: true };
const bad = (error: string): Validation => ({ ok: false, error });

export const DISPLAY_NAME_MAX = 50;
export const TEXT_MAX = 2000;
const DISPLAY_NAME_ERROR = `Display name must be 1–${DISPLAY_NAME_MAX} characters`;
const CARD_TEXT_ERROR = `Card text must be 1–${TEXT_MAX} characters`;
export const INVALID_BODY = 'Invalid request body';

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isStringOrNull = (v: unknown): boolean => v === null || typeof v === 'string';

export function validateDisplayName(
  v: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof v !== 'string') return { ok: false, error: DISPLAY_NAME_ERROR };
  const value = v.trim();
  if (value.length < 1 || value.length > DISPLAY_NAME_MAX) return { ok: false, error: DISPLAY_NAME_ERROR };
  return { ok: true, value };
}

function validText(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= TEXT_MAX;
}

/** Field types of a card PATCH `updates` object. Reactions are validated separately. */
export function validateCardUpdates(u: Record<string, unknown>): Validation {
  if (u.text !== undefined && !validText(u.text)) return bad(CARD_TEXT_ERROR);
  if (u.color !== undefined && !isStringOrNull(u.color)) return bad('Invalid color');
  if (u.column_id !== undefined && !isString(u.column_id)) return bad('Invalid column_id');
  if (u.position !== undefined && !isFiniteNumber(u.position)) return bad('Invalid position');
  if (u.merged_with !== undefined && !isStringOrNull(u.merged_with)) return bad('Invalid merged_with');
  return OK;
}

export function validateParticipantUpdates(u: Record<string, unknown>): Validation {
  if (u.is_admin !== undefined && typeof u.is_admin !== 'boolean') return bad('Invalid is_admin');
  return OK;
}

export function validateActionItemDescription(v: unknown): Validation {
  return validText(v) ? OK : bad(`Description must be 1–${TEXT_MAX} characters`);
}

export function validateActionItemUpdates(u: Record<string, unknown>): Validation {
  if (u.description !== undefined) {
    const d = validateActionItemDescription(u.description);
    if (!d.ok) return d;
  }
  if (u.assignee !== undefined && !isStringOrNull(u.assignee)) return bad('Invalid assignee');
  if (u.due_date !== undefined && !isStringOrNull(u.due_date)) return bad('Invalid due_date');
  if (
    u.status !== undefined &&
    !(ACTION_ITEM_STATUSES as readonly unknown[]).includes(u.status)
  ) {
    return bad('Invalid status');
  }
  return OK;
}

export function validateColumnFields(u: Record<string, unknown>): Validation {
  if (u.title !== undefined && !(isString(u.title) && u.title.trim().length > 0)) return bad('Invalid title');
  if (u.color !== undefined && !isString(u.color)) return bad('Invalid color');
  if (u.description !== undefined && !isStringOrNull(u.description)) return bad('Invalid description');
  return OK;
}

export interface NewBoardInput {
  id: string;
  title: string;
  description: string | null;
  template: string;
  settings: Record<string, unknown>;
  columns: { id: string; title: string; description: string | null; color: string; position: number }[];
  participant: { displayName: string } | null;
}

const MAX_COLUMNS = 20;

/** Validate and normalise a board-creation body before anything is written. */
export function validateNewBoard(
  b: Record<string, unknown>
): { ok: true; value: NewBoardInput } | { ok: false; error: string } {
  if (!isString(b.id) || b.id.length < 1 || b.id.length > 64) return { ok: false, error: 'Invalid board id' };
  if (!isString(b.title) || b.title.trim().length === 0) return { ok: false, error: 'Title is required' };
  if (b.description !== undefined && !isStringOrNull(b.description)) return { ok: false, error: 'Invalid description' };
  if (!isString(b.template)) return { ok: false, error: 'Invalid template' };
  if (!isPlainObject(b.settings)) return { ok: false, error: 'Invalid settings' };
  if (!Array.isArray(b.columns) || b.columns.length > MAX_COLUMNS) return { ok: false, error: 'Invalid columns' };

  const columns: NewBoardInput['columns'] = [];
  for (const c of b.columns as unknown[]) {
    if (
      !isPlainObject(c) ||
      !isString(c.id) ||
      !isString(c.title) ||
      !isString(c.color) ||
      !isFiniteNumber(c.position) ||
      (c.description !== undefined && !isStringOrNull(c.description))
    ) {
      return { ok: false, error: 'Invalid columns' };
    }
    columns.push({
      id: c.id,
      title: c.title,
      description: (c.description as string | null | undefined) ?? null,
      color: c.color,
      position: c.position,
    });
  }

  let participant: NewBoardInput['participant'] = null;
  if (b.participant !== undefined && b.participant !== null) {
    if (!isPlainObject(b.participant)) return { ok: false, error: DISPLAY_NAME_ERROR };
    const name = validateDisplayName(b.participant.displayName);
    if (!name.ok) return name;
    participant = { displayName: name.value };
  }

  return {
    ok: true,
    value: {
      id: b.id,
      title: b.title.trim(),
      description: (b.description as string | null | undefined) ?? null,
      template: b.template,
      settings: b.settings,
      columns,
      participant,
    },
  };
}
