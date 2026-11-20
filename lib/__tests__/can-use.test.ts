import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ sqlRows: [] as unknown[] }));

vi.mock('@/lib/db', () => ({
  sql: vi.fn(async () => mocks.sqlRows),
}));

import { canUse } from '@/lib/can-use';

describe('canUse', () => {
  beforeEach(() => {
    mocks.sqlRows = [];
  });

  it('is true when the flag row is enabled', async () => {
    mocks.sqlRows = [{ is_enabled: true }];
    await expect(canUse('guided_mode', 'u1')).resolves.toBe(true);
  });
  it('is false when the flag row is off', async () => {
    mocks.sqlRows = [{ is_enabled: false }];
    await expect(canUse('guided_mode', 'u1')).resolves.toBe(false);
  });
  it('is false when there is no row', async () => {
    mocks.sqlRows = [];
    await expect(canUse('guided_mode', null)).resolves.toBe(false);
  });
});
