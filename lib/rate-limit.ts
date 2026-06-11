import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, limit: number, windowSec: number): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null; // not configured (local dev / tests) — fail open
  }
  if (!redis) redis = Redis.fromEnv();
  const key = `${name}:${limit}:${windowSec}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: `rl:${name}`,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Per-IP sliding-window limit. Returns a 429 Response when over the limit,
 * else null. Fails open when Upstash is not configured so local dev and CI
 * never depend on the external service.
 */
export async function rateLimitOr429(
  request: Request,
  name: string,
  limit: number,
  windowSec: number
): Promise<Response | null> {
  const limiter = getLimiter(name, limit, windowSec);
  if (!limiter) return null;
  const { success } = await limiter.limit(clientIp(request));
  if (success) return null;
  return Response.json(
    { error: 'Too many requests — please slow down and try again shortly' },
    { status: 429 }
  );
}
