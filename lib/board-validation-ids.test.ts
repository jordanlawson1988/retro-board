import { describe, it, expect } from 'vitest';
import { nanoid } from 'nanoid';
import { validateClientId, validateNewBoard, isUuid, ID_MAX_LENGTH } from './board-validation';
import { isUniqueViolation } from './pg-errors';

describe('validateClientId', () => {
  it('accepts nanoid and uuid output and the real id lengths', () => {
    for (let i = 0; i < 200; i++) expect(validateClientId(nanoid(10)).ok).toBe(true);
    expect(validateClientId(nanoid(6)).ok).toBe(true);
    expect(validateClientId(nanoid(19)).ok).toBe(true);
    expect(validateClientId(crypto.randomUUID()).ok).toBe(true);
    expect(validateClientId('a').ok).toBe(true);
    expect(validateClientId('a'.repeat(ID_MAX_LENGTH)).ok).toBe(true);
  });

  it('rejects empty, over-long, non-string and non-URL-safe ids', () => {
    expect(validateClientId('').ok).toBe(false);
    expect(validateClientId('a'.repeat(ID_MAX_LENGTH + 1)).ok).toBe(false);
    for (const v of [undefined, null, 5, {}, ['a']]) expect(validateClientId(v).ok).toBe(false);
    for (const v of ['a b', 'a/b', 'a.b', "a'b", 'a;b', 'é', 'a\nb', '<x>']) expect(validateClientId(v).ok).toBe(false);
  });

  it('names the field in the error', () => {
    expect(validateClientId('', 'card id')).toEqual({ ok: false, error: 'Invalid card id' });
  });
});

describe('validateNewBoard column ids', () => {
  const base = (colId: unknown) => ({
    id: 'board12345',
    title: 't',
    template: 'x',
    settings: {},
    columns: [{ id: colId, title: 'c', color: '#fff', position: 0 }],
  });
  it('accepts a normal column id', () => expect(validateNewBoard(base('col1234567')).ok).toBe(true));
  it('rejects an over-long or malformed column id', () => {
    expect(validateNewBoard(base('x'.repeat(ID_MAX_LENGTH + 1))).ok).toBe(false);
    expect(validateNewBoard(base('a b')).ok).toBe(false);
  });
});

describe('isUniqueViolation', () => {
  const e = (code: string, constraint?: string) => Object.assign(new Error('x'), { code, constraint });
  it('matches 23505 on a listed constraint only', () => {
    expect(isUniqueViolation(e('23505', 'cards_pkey'), ['cards_pkey'])).toBe(true);
    expect(isUniqueViolation(e('23505', 'columns_pkey'), ['cards_pkey'])).toBe(false);
    expect(isUniqueViolation(e('23503', 'cards_pkey'), ['cards_pkey'])).toBe(false);
    expect(isUniqueViolation(e('23505'), ['cards_pkey'])).toBe(false);
    expect(isUniqueViolation(null, ['cards_pkey'])).toBe(false);
  });
});

describe('isUuid', () => {
  it('accepts a uuid', () => {
    expect(isUuid('00000000-0000-4000-8000-000000000001')).toBe(true);
  });
  it('rejects text and non-strings', () => {
    expect(isUuid('x')).toBe(false);
    expect(isUuid(5)).toBe(false);
  });
});
