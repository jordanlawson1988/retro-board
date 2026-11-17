import { describe, it, expect } from 'vitest';
import { readJsonObject, isPlainObject } from '@/lib/request-body';
import {
  validateDisplayName,
  validateCardUpdates,
  validateParticipantUpdates,
  validateActionItemDescription,
  validateActionItemUpdates,
  isFiniteNumber,
  DISPLAY_NAME_MAX,
} from '@/lib/board-validation';
import { ACTION_ITEM_STATUSES } from '@/types';

const req = (body: string) => new Request('http://x/', { method: 'POST', body });

describe('readJsonObject', () => {
  it('returns the object for a valid JSON object', async () => {
    expect(await readJsonObject(req('{"a":1}'))).toEqual({ a: 1 });
  });
  it.each(['', '{bad', 'null', '[]', '"str"', '5', 'true'])('returns null for %j', async (b) => {
    expect(await readJsonObject(req(b))).toBeNull();
  });
});

describe('isPlainObject', () => {
  it('accepts objects only', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject('x')).toBe(false);
  });
});

describe('validateDisplayName', () => {
  it('trims and returns the value', () => {
    expect(validateDisplayName('  Jo  ')).toEqual({ ok: true, value: 'Jo' });
  });
  it('accepts exactly the max length', () => {
    expect(validateDisplayName('a'.repeat(DISPLAY_NAME_MAX))).toMatchObject({ ok: true });
  });
  it.each([undefined, null, 5, {}, '', '   ', 'a'.repeat(DISPLAY_NAME_MAX + 1)])('rejects %j', (v) => {
    expect(validateDisplayName(v)).toEqual({ ok: false, error: 'Display name must be 1–50 characters' });
  });
  it('measures length after trimming', () => {
    expect(validateDisplayName(' ' + 'a'.repeat(50) + ' ')).toMatchObject({ ok: true });
  });
});

describe('validateCardUpdates', () => {
  it('accepts valid fields', () => {
    expect(
      validateCardUpdates({ text: 'hi', color: null, column_id: 'c', position: 1.5, merged_with: null })
    ).toEqual({ ok: true });
    expect(validateCardUpdates({ color: '#fff', merged_with: 'c2' })).toEqual({ ok: true });
    expect(validateCardUpdates({})).toEqual({ ok: true });
  });
  it.each([
    [{ color: 5 }],
    [{ column_id: 5 }],
    [{ column_id: null }],
    [{ position: '1' }],
    [{ position: NaN }],
    [{ position: Infinity }],
    [{ merged_with: 5 }],
    [{ text: 5 }],
    [{ text: '   ' }],
    [{ text: 'a'.repeat(2001) }],
  ])('rejects %j', (u) => {
    expect(validateCardUpdates(u)).toMatchObject({ ok: false });
  });
  it('uses the card text message for text errors', () => {
    expect(validateCardUpdates({ text: '' })).toEqual({ ok: false, error: 'Card text must be 1–2000 characters' });
  });
});

describe('validateParticipantUpdates', () => {
  it('requires is_admin to be boolean', () => {
    expect(validateParticipantUpdates({ is_admin: true })).toEqual({ ok: true });
    expect(validateParticipantUpdates({})).toEqual({ ok: true });
    expect(validateParticipantUpdates({ is_admin: 'true' })).toMatchObject({ ok: false });
    expect(validateParticipantUpdates({ is_admin: 1 })).toMatchObject({ ok: false });
  });
});

describe('action item validation', () => {
  it('description must be a non-empty string up to 2000', () => {
    expect(validateActionItemDescription('x')).toEqual({ ok: true });
    expect(validateActionItemDescription('')).toMatchObject({ ok: false });
    expect(validateActionItemDescription('  ')).toMatchObject({ ok: false });
    expect(validateActionItemDescription(3)).toMatchObject({ ok: false });
    expect(validateActionItemDescription('a'.repeat(2001))).toMatchObject({ ok: false });
    expect(validateActionItemDescription('a'.repeat(2000))).toEqual({ ok: true });
  });
  it('status must be one of the known statuses', () => {
    for (const s of ACTION_ITEM_STATUSES) expect(validateActionItemUpdates({ status: s })).toEqual({ ok: true });
    expect(validateActionItemUpdates({ status: 'bogus' })).toMatchObject({ ok: false });
    expect(validateActionItemUpdates({ status: 1 })).toMatchObject({ ok: false });
  });
  it('assignee and due_date are string or null', () => {
    expect(validateActionItemUpdates({ assignee: null, due_date: '2026-01-01' })).toEqual({ ok: true });
    expect(validateActionItemUpdates({ assignee: 5 })).toMatchObject({ ok: false });
    expect(validateActionItemUpdates({ due_date: {} })).toMatchObject({ ok: false });
  });
  it('description in updates is validated', () => {
    expect(validateActionItemUpdates({ description: '' })).toMatchObject({ ok: false });
  });
});

describe('isFiniteNumber', () => {
  it('rejects NaN, Infinity and non-numbers', () => {
    expect(isFiniteNumber(1)).toBe(true);
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber('1')).toBe(false);
  });
});

import { validateNewBoard, validateColumnFields } from '@/lib/board-validation';

describe('validateNewBoard', () => {
  const good = {
    id: 'abc1234567',
    title: ' T ',
    description: null,
    template: 't',
    settings: {},
    columns: [{ id: 'c1', title: 'A', color: '#fff', position: 0 }],
    participant: { displayName: ' Jo ' },
  };
  it('normalises a valid body', () => {
    const r = validateNewBoard(good);
    expect(r).toMatchObject({
      ok: true,
      value: { title: 'T', participant: { displayName: 'Jo' }, columns: [{ description: null }] },
    });
  });
  it('allows no participant', () => {
    expect(validateNewBoard({ ...good, participant: undefined })).toMatchObject({ ok: true, value: { participant: null } });
  });
  it.each([
    [{ id: 5 }],
    [{ title: '  ' }],
    [{ settings: [] }],
    [{ columns: 'x' }],
    [{ columns: [{ id: 'c' }] }],
    [{ participant: { displayName: '' } }],
    [{ participant: 'x' }],
  ])('rejects %j', (o) => {
    expect(validateNewBoard({ ...good, ...o })).toMatchObject({ ok: false });
  });
});

describe('validateColumnFields', () => {
  it('checks types', () => {
    expect(validateColumnFields({ title: 'x', color: 'c', description: null })).toEqual({ ok: true });
    expect(validateColumnFields({ title: 5 })).toMatchObject({ ok: false });
    expect(validateColumnFields({ color: 5 })).toMatchObject({ ok: false });
  });
});
