import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => mocks.sql(...a) }));

import { readSummaryPreference, setSummaryPreference } from '@/lib/email-preferences';

const text = (i: number) => (mocks.sql.mock.calls[i][0] as string[]).join('?');
const values = (i: number) => mocks.sql.mock.calls[i].slice(1);

beforeEach(() => mocks.sql.mockReset());

describe('readSummaryPreference', () => {
  it('no row means on (the default)', async () => {
    mocks.sql.mockResolvedValue([]);
    expect(await readSummaryPreference('u1')).toBe(true);
    expect(text(0)).toContain('SELECT summary_email FROM email_preferences WHERE user_id = ?');
    expect(values(0)).toEqual(['u1']);
  });

  it('a stored false is off', async () => {
    mocks.sql.mockResolvedValue([{ summary_email: false }]);
    expect(await readSummaryPreference('u1')).toBe(false);
  });

  it('a stored true is on', async () => {
    mocks.sql.mockResolvedValue([{ summary_email: true }]);
    expect(await readSummaryPreference('u1')).toBe(true);
  });
});

describe('setSummaryPreference', () => {
  it('sends one guarded upsert, writing nothing for a missing account', async () => {
    mocks.sql.mockResolvedValue([]);
    await setSummaryPreference('u1', false);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    const t = text(0);
    expect(t).toContain('INSERT INTO email_preferences');
    expect(t).toContain('WHERE EXISTS (SELECT 1 FROM "user" WHERE id = ?)');
    expect(t).toContain('ON CONFLICT (user_id) DO UPDATE SET summary_email = EXCLUDED.summary_email');
    expect(values(0)).toEqual(['u1', false, 'u1']);
  });

  it('passes true through', async () => {
    mocks.sql.mockResolvedValue([]);
    await setSummaryPreference('u2', true);
    expect(values(0)).toEqual(['u2', true, 'u2']);
  });
});
