import { describe, it, expect } from 'vitest';
import { clientIp, rateLimitOr429 } from '@/lib/rate-limit';

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    const req = new Request('http://x', {
      headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' },
    });
    expect(clientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to "unknown" without the header', () => {
    expect(clientIp(new Request('http://x'))).toBe('unknown');
  });
});

describe('rateLimitOr429', () => {
  it('fails open (returns null) when Upstash env is not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const res = await rateLimitOr429(new Request('http://x'), 'test', 5, 60);
    expect(res).toBeNull();
  });
});
