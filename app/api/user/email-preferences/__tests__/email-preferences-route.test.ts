import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ sql: vi.fn(), flag: vi.fn(), session: vi.fn(), fresh: vi.fn() }));

vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => mocks.sql(...a) }));
vi.mock('@/lib/can-use', () => ({ canUse: (...a: unknown[]) => mocks.flag(...a) }));
vi.mock('@/lib/auth-helpers', () => ({
  getSessionOrNull: () => mocks.session(),
  getFreshSession: () => mocks.fresh(),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimitOr429: async () => null }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import * as route from '@/app/api/user/email-preferences/route';
import { GET, POST } from '@/app/api/user/email-preferences/route';

const post = (body: unknown) =>
  new Request('http://x/api/user/email-preferences', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const sqlTexts = () => mocks.sql.mock.calls.map((c) => (c[0] as string[]).join('?'));
const namesTable = () => sqlTexts().some((t) => t.includes('email_preferences'));
const user = { user: { id: 'u1' } };

beforeEach(() => {
  mocks.sql.mockReset().mockResolvedValue([]);
  mocks.flag.mockReset().mockResolvedValue(true);
  mocks.session.mockReset().mockResolvedValue(user);
  mocks.fresh.mockReset().mockResolvedValue(user);
});

describe('exports', () => {
  it('exports only the handlers Next expects', () => {
    expect(Object.keys(route).sort()).toEqual(['GET', 'POST']);
  });
});

describe('GET', () => {
  it('without a session is 401 with no database call', async () => {
    mocks.session.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sign in required' });
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.flag).not.toHaveBeenCalled();
  });

  it('with the flag off is 404 and no statement names email_preferences', async () => {
    mocks.flag.mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
    expect(namesTable()).toBe(false);
    expect(mocks.flag).toHaveBeenCalledWith('summary_email', 'u1');
  });

  it('on, with no row, is 200 and summaryEmail true', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summaryEmail: true });
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual(['u1']);
  });

  it('on, with a stored false, answers false', async () => {
    mocks.sql.mockResolvedValue([{ summary_email: false }]);
    expect(await (await GET()).json()).toEqual({ summaryEmail: false });
  });
});

describe('POST', () => {
  it('a non-boolean summaryEmail is 400 before any session or database call', async () => {
    const res = await POST(post({ summaryEmail: 'no' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request body' });
    expect(mocks.fresh).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.flag).not.toHaveBeenCalled();
  });

  it('a body that is not JSON is 400 before any session or database call', async () => {
    const res = await POST(post('not json'));
    expect(res.status).toBe(400);
    expect(mocks.fresh).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('without a fresh session is 401 and writes nothing', async () => {
    mocks.fresh.mockResolvedValue(null);
    const res = await POST(post({ summaryEmail: false }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sign in required' });
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('with the flag off is 404, no write, and no statement names email_preferences', async () => {
    mocks.flag.mockResolvedValue(false);
    const res = await POST(post({ summaryEmail: false }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(namesTable()).toBe(false);
  });

  it('ignores a userId in the body and writes the session user', async () => {
    const res = await POST(post({ summaryEmail: false, userId: 'other', user_id: 'other2' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summaryEmail: false });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual(['u1', false, 'u1']);
    expect(JSON.stringify(mocks.sql.mock.calls)).not.toContain('other');
  });

  it('turning it back on writes true', async () => {
    const res = await POST(post({ summaryEmail: true }));
    expect(await res.json()).toEqual({ summaryEmail: true });
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual(['u1', true, 'u1']);
  });
});
