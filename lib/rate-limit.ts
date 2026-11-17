import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
let warnedUnconfigured = false;
const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, limit: number, windowSec: number): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Not configured (local dev / tests) — fail open. In production that means NO rate limiting,
    // so say so once per process instead of failing silently.
    if (process.env.NODE_ENV === 'production' && !warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set: rate limiting is DISABLED (failing open).'
      );
    }
    return null;
  }
  if (!redis) redis = Redis.fromEnv();
  const key = `${name}:${limit}:${windowSec}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      // Environments share one Upstash database (free tier allows one), so counters are
      // namespaced by environment: production and preview never count against each other.
      prefix: `rl:${process.env.VERCEL_ENV || 'local'}:${name}`,
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
 * else null. Fails open when Upstash is not configured (local dev and CI
 * never depend on the external service) and when Upstash itself errors.
 */
export async function rateLimitOr429(
  request: Request,
  name: string,
  limit: number,
  windowSec: number
): Promise<Response | null> {
  const limiter = getLimiter(name, limit, windowSec);
  if (!limiter) return null;
  let success: boolean;
  try {
    ({ success } = await limiter.limit(clientIp(request)));
  } catch (err) {
    // Upstash outage or network error: fail open so the limiter can never take the API down.
    console.error('[rate-limit] limiter error, failing open:', err instanceof Error ? err.message : err);
    return null;
  }
  if (success) return null;
  return Response.json(
    { error: 'Too many requests — please slow down and try again shortly' },
    { status: 429 }
  );
}
