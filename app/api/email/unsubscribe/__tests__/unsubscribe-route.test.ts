import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({ sql: vi.fn(), flag: vi.fn() }));

vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => mocks.sql(...a) }));
vi.mock('@/lib/can-use', () => ({ canUse: (...a: unknown[]) => mocks.flag(...a) }));
vi.mock('@/lib/rate-limit', () => ({ rateLimitOr429: async () => null }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import * as route from '@/app/api/email/unsubscribe/route';
import { GET, POST } from '@/app/api/email/unsubscribe/route';
import { signUnsubscribeToken } from '@/lib/email-unsubscribe';

const SECRET = 'unsubscribe-route-test-secret-0123456789abcdef';
const url = (token?: string) =>
  `http://app.test/api/email/unsubscribe${token === undefined ? '' : `?token=${encodeURIComponent(token)}`}`;
const valid = () => signUnsubscribeToken('u1', SECRET);
const sqlTexts = () => mocks.sql.mock.calls.map((c) => (c[0] as string[]).join('?'));

beforeEach(() => {
  vi.stubEnv('PARTICIPANT_SESSION_SECRET', SECRET);
  mocks.sql.mockReset().mockResolvedValue([]);
  mocks.flag.mockReset().mockResolvedValue(false);
});
afterEach(() => vi.unstubAllEnvs());

describe('exports', () => {
  it('exports only the handlers Next expects', () => {
    expect(Object.keys(route).sort()).toEqual(['GET', 'POST']);
  });
});

describe('POST with a token that does not verify', () => {
  const tampered = () => {
    const t = valid();
    return `${t.slice(0, -2)}${t.endsWith('AA') ? 'BB' : 'AA'}`;
  };
  it.each([
    ['no token', () => undefined],
    ['garbage', () => 'garbage'],
    ['a tampered signature', tampered],
    ['another account with this signature', () => `u2.${valid().split('.')[1]}`],
    ['an empty token', () => ''],
  ])('%s is 400 with no database call', async (_l, make) => {
    const res = await POST(new Request(url(make()), { method: 'POST' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This link is not valid.' });
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(sqlTexts().some((t) => t.includes('email_preferences'))).toBe(false);
  });
});

describe('POST with a valid token', () => {
  it('writes (u1, false) and answers { ok: true }', async () => {
    const res = await POST(new Request(url(valid()), { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual(['u1', false, 'u1']);
  });

  it('is idempotent: the same request again answers the same', async () => {
    const a = await POST(new Request(url(valid()), { method: 'POST' }));
    const b = await POST(new Request(url(valid()), { method: 'POST' }));
    expect(b.status).toBe(a.status);
    expect(await b.json()).toEqual(await a.clone().json());
  });

  it('answers identically when the account no longer exists (the write returns no row)', async () => {
    mocks.sql.mockResolvedValue([]);
    const missing = await POST(new Request(url(signUnsubscribeToken('gone-user', SECRET)), { method: 'POST' }));
    mocks.sql.mockResolvedValue([{ user_id: 'u1' }]);
    const live = await POST(new Request(url(valid()), { method: 'POST' }));
    expect(missing.status).toBe(live.status);
    const missingText = await missing.text();
    expect(missingText).toBe(await live.text());
    expect(JSON.parse(missingText)).toEqual({ ok: true });
  });

  it('does not check the feature flag', async () => {
    await POST(new Request(url(valid()), { method: 'POST' }));
    expect(mocks.flag).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty body', undefined, undefined],
    ['a JSON body', JSON.stringify({ userId: 'other', token: 'x' }), 'application/json'],
    ['a one-click form body', 'List-Unsubscribe=One-Click', 'application/x-www-form-urlencoded'],
  ])('works with %s and never reads it', async (_l, body, type) => {
    const req = new Request(url(valid()), {
      method: 'POST',
      body,
      headers: type ? { 'content-type': type } : {},
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(req.bodyUsed).toBe(false);
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual(['u1', false, 'u1']);
  });

  it('takes the user only from the token, never from the body', async () => {
    await POST(new Request(url(valid()), { method: 'POST', body: JSON.stringify({ userId: 'other' }) }));
    expect(JSON.stringify(mocks.sql.mock.calls)).not.toContain('other');
  });
});

describe('GET', () => {
  it('redirects 303 to the page with the token encoded and makes no database call', async () => {
    const token = valid();
    const res = await GET(new Request(url(token)));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.flag).not.toHaveBeenCalled();
  });

  it('with no token redirects to the page with no query', async () => {
    const res = await GET(new Request(url()));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/email/unsubscribe');
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('a hostile token value stays an encoded query value on the same origin', async () => {
    const res = await GET(new Request(url('//evil.test/x?y=1&token=z')));
    const location = res.headers.get('location')!;
    expect(location.startsWith('/email/unsubscribe?token=')).toBe(true);
    expect(location.startsWith('//')).toBe(false);
    const parsed = new URL(location, 'http://app.test');
    expect(parsed.origin).toBe('http://app.test');
    expect(parsed.pathname).toBe('/email/unsubscribe');
    expect(parsed.searchParams.get('token')).toBe('//evil.test/x?y=1&token=z');
    expect([...parsed.searchParams.keys()]).toEqual(['token']);
  });

  it('hostile Host and forwarded headers do not change the redirect', async () => {
    const res = await GET(
      new Request(url('abc'), {
        headers: { host: 'evil.test', 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'https', origin: 'http://evil.test' },
      }),
    );
    const location = res.headers.get('location')!;
    expect(location).toBe('/email/unsubscribe?token=abc');
    expect(location).not.toContain('evil');
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
