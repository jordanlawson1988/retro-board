import { ACTION_ITEM_STATUSES } from '@/types';
import type { BoardSettings } from '@/types';
import { isPlainObject } from '@/lib/request-body';
import { isBoardMode, OPEN_MODE, type BoardMode } from '@/lib/constants/phases';
import {
  CARD_VISIBILITIES,
  TIMER_STATUSES,
  MAX_VOTES_PER_PARTICIPANT_RANGE,
  MAX_VOTES_PER_CARD_RANGE,
  TIMER_MAX_SECONDS,
  HIGHLIGHTED_ID_MAX,
} from '@/lib/constants/board-settings';

export type Validation = { ok: true } | { ok: false; error: string };
const OK: Validation = { ok: true };
const bad = (error: string): Validation => ({ ok: false, error });

export const DISPLAY_NAME_MAX = 50;
export const TEXT_MAX = 2000;
const DISPLAY_NAME_ERROR = `Display name must be 1–${DISPLAY_NAME_MAX} characters`;
const CARD_TEXT_ERROR = `Card text must be 1–${TEXT_MAX} characters`;
export const INVALID_BODY = 'Invalid request body';
export const INVALID_ASSIGNEE = 'Invalid assignee';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_PATTERN.test(v);
}

/** Longest id accepted for boards and for client-generated card/column ids. */
export const ID_MAX_LENGTH = 64;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * A client-generated id (card, column): 1 to ID_MAX_LENGTH characters from the URL-safe set
 * that nanoid and uuid produce (A-Z a-z 0-9 _ -).
 */
export function validateClientId(v: unknown, label = 'id'): Validation {
  if (typeof v !== 'string' || v.length < 1 || v.length > ID_MAX_LENGTH || !CLIENT_ID_PATTERN.test(v)) {
    return bad(`Invalid ${label}`);
  }
  return OK;
}

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
  if (u.assignee !== undefined && !isStringOrNull(u.assignee)) return bad(INVALID_ASSIGNEE);
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

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isSecondsIn = (v: unknown): boolean => isFiniteNumber(v) && v >= 0 && v <= TIMER_MAX_SECONDS;

function validTimer(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  const allowed = ['duration', 'remaining', 'status', 'started_at'];
  return (
    keys.length === allowed.length &&
    keys.every((k) => allowed.includes(k)) &&
    isSecondsIn(v.duration) &&
    isSecondsIn(v.remaining) &&
    (TIMER_STATUSES as readonly unknown[]).includes(v.status) &&
    (v.started_at === null || (typeof v.started_at === 'string' && !Number.isNaN(Date.parse(v.started_at))))
  );
}

/**
 * One checker per key of BoardSettings. Typing the table by the interface means a new setting
 * fails to compile until it is listed here; the unit test then proves every default passes.
 */
const SETTING_CHECKS: { [K in keyof BoardSettings]-?: (v: unknown) => boolean } = {
  card_visibility: (v) => (CARD_VISIBILITIES as readonly unknown[]).includes(v),
  voting_enabled: isBool,
  max_votes_per_participant: (v) =>
    Number.isInteger(v) &&
    (v as number) >= MAX_VOTES_PER_PARTICIPANT_RANGE.min &&
    (v as number) <= MAX_VOTES_PER_PARTICIPANT_RANGE.max,
  max_votes_per_card: (v) =>
    Number.isInteger(v) &&
    (v as number) >= MAX_VOTES_PER_CARD_RANGE.min &&
    (v as number) <= MAX_VOTES_PER_CARD_RANGE.max,
  secret_voting: isBool,
  board_locked: isBool,
  card_creation_disabled: isBool,
  anonymous_cards: isBool,
  timer: validTimer,
  highlighted_card_id: (v) => v === null || (typeof v === 'string' && v.length > 0 && v.length <= HIGHLIGHTED_ID_MAX),
};

/** Validate a board settings PATCH: only known top-level keys, each with a valid value. */
export function validateSettingsPatch(
  p: Record<string, unknown>
): { ok: true; value: Partial<BoardSettings> } | { ok: false; error: string } {
  for (const key of Object.keys(p)) {
    if (!Object.prototype.hasOwnProperty.call(SETTING_CHECKS, key)) return { ok: false, error: `Unknown setting: ${key}` };
    if (!SETTING_CHECKS[key as keyof BoardSettings](p[key])) return { ok: false, error: `Invalid value for setting: ${key}` };
  }
  return { ok: true, value: p as Partial<BoardSettings> };
}

export interface NewBoardInput {
  id: string;
  title: string;
  description: string | null;
  template: string;
  settings: Record<string, unknown>;
  columns: { id: string; title: string; description: string | null; color: string; position: number }[];
  participant: { displayName: string } | null;
  mode: BoardMode;
}

const MAX_COLUMNS = 20;

/** Validate and normalise a board-creation body before anything is written. */
export function validateNewBoard(
  b: Record<string, unknown>
): { ok: true; value: NewBoardInput } | { ok: false; error: string } {
  if (!isString(b.id) || b.id.length < 1 || b.id.length > ID_MAX_LENGTH) return { ok: false, error: 'Invalid board id' };
  if (!isString(b.title) || b.title.trim().length === 0) return { ok: false, error: 'Title is required' };
  if (b.description !== undefined && !isStringOrNull(b.description)) return { ok: false, error: 'Invalid description' };
  if (!isString(b.template)) return { ok: false, error: 'Invalid template' };
  if (!isPlainObject(b.settings)) return { ok: false, error: 'Invalid settings' };
  if (!Array.isArray(b.columns) || b.columns.length > MAX_COLUMNS) return { ok: false, error: 'Invalid columns' };
  if (b.mode !== undefined && !isBoardMode(b.mode)) return { ok: false, error: 'Invalid mode' };
  const mode: BoardMode = b.mode === undefined ? OPEN_MODE : (b.mode as BoardMode);

  const columns: NewBoardInput['columns'] = [];
  for (const c of b.columns as unknown[]) {
    if (
      !isPlainObject(c) ||
      !isString(c.id) ||
      !validateClientId(c.id).ok ||
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
      mode,
    },
  };
}
