import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  sqlRows: [] as unknown[],
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mocks.getSession(...args) } },
}));
vi.mock('@/lib/db', () => ({
  sql: vi.fn(async () => mocks.sqlRows),
}));

import { requireSystemAdmin, AuthzError } from '@/lib/auth-helpers';

describe('requireSystemAdmin', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.sqlRows = [];
  });

  it('throws 401 when there is no session', async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireSystemAdmin()).rejects.toMatchObject({ status: 401 });
  });

  it('throws 403 when the user is not in admin_users', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.sqlRows = []; // EXISTS query returns no row
    await expect(requireSystemAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it('returns the userId for a system admin', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.sqlRows = [{ ok: 1 }];
    await expect(requireSystemAdmin()).resolves.toEqual({ userId: 'u1' });
  });

  it('throws AuthzError instances (so authzErrorResponse maps them)', async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireSystemAdmin()).rejects.toBeInstanceOf(AuthzError);
  });
});
