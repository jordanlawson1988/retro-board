import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: [] as unknown[], calls: [] as { text: string; values: unknown[] }[] }));

vi.mock('@/lib/db', () => ({
  sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    mocks.calls.push({ text: strings.join('?').replace(/\s+/g, ' ').trim(), values });
    return mocks.rows;
  }),
}));

import { guidedBoardExists } from '@/lib/summary-route';

describe('guidedBoardExists', () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.calls = [];
  });

  it('is false for a malformed id and runs no query', async () => {
    await expect(guidedBoardExists('bad id!')).resolves.toBe(false);
    await expect(guidedBoardExists('')).resolves.toBe(false);
    expect(mocks.calls).toHaveLength(0);
  });

  it('is false when no row comes back', async () => {
    mocks.rows = [];
    await expect(guidedBoardExists('abc123XYZ_')).resolves.toBe(false);
  });

  it('is false for an open board and for a row with no mode (a database without migration 015)', async () => {
    mocks.rows = [{ mode: 'open' }];
    await expect(guidedBoardExists('abc123XYZ_')).resolves.toBe(false);
    mocks.rows = [{ mode: null }];
    await expect(guidedBoardExists('abc123XYZ_')).resolves.toBe(false);
    mocks.rows = [{}];
    await expect(guidedBoardExists('abc123XYZ_')).resolves.toBe(false);
  });

  it('is true for a guided board', async () => {
    mocks.rows = [{ mode: 'guided' }];
    await expect(guidedBoardExists('abc123XYZ_')).resolves.toBe(true);
  });

  it('reads the mode through to_jsonb, never the column, and skips deleted boards', async () => {
    mocks.rows = [{ mode: 'guided' }];
    await guidedBoardExists('abc123XYZ_');
    expect(mocks.calls).toHaveLength(1);
    const { text, values } = mocks.calls[0];
    expect(values).toEqual(['abc123XYZ_']);
    expect(text).toContain("to_jsonb(b) ->> 'mode'");
    expect(text).toContain('b.deleted_at IS NULL');
    expect(text).not.toMatch(/\bb\.mode\b/);
    expect(text).toMatchInlineSnapshot(`"SELECT to_jsonb(b) ->> 'mode' AS mode FROM boards b WHERE b.id = ? AND b.deleted_at IS NULL"`);
  });
});
