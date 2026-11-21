import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The Upstash client is replaced at the module boundary: no network, no env needed.
const h = vi.hoisted(() => ({
  limitMock: vi.fn(),
  constructed: [] as Array<{ prefix: string; limiter: unknown }>,
  slidingWindow: vi.fn((n: number, w: string) => ({ kind: 'sliding', n, w })),
  fromEnv: vi.fn(() => ({ fake: 'redis' })),
}));

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow = h.slidingWindow;
    constructor(opts: { prefix: string; limiter: unknown }) {
      h.constructed.push({ prefix: opts.prefix, limiter: opts.limiter });
    }
    limit = h.limitMock;
  }
  return { Ratelimit };
});
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: h.fromEnv } }));

type RateLimitModule = typeof import('@/lib/rate-limit');

/** Fresh module so the cached redis / limiter map / warn-once flag start clean. */
async function load(): Promise<RateLimitModule> {
  vi.resetModules();
  return import('@/lib/rate-limit');
}

const req = (ip?: string) =>
  new Request('http://x/api', { headers: ip ? { 'x-forwarded-for': ip } : {} });

beforeEach(() => {
  h.limitMock.mockReset();
  h.constructed.length = 0;
  h.slidingWindow.mockClear();
  h.fromEnv.mockClear();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('rateLimitOr429 with a configured limiter', () => {
  it('under the limit: returns null so the request proceeds', async () => {
    h.limitMock.mockResolvedValue({ success: true });
    const { rateLimitOr429 } = await load();
    expect(await rateLimitOr429(req('1.2.3.4'), 'vote', 60, 60)).toBeNull();
  });

  it('over the limit: 429 with the JSON error body', async () => {
    h.limitMock.mockResolvedValue({ success: false });
    const { rateLimitOr429 } = await load();
    const res = await rateLimitOr429(req('1.2.3.4'), 'vote', 60, 60);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get('content-type')).toContain('application/json');
    expect(await res!.json()).toEqual({
      error: 'Too many requests — please slow down and try again shortly',
    });
  });

  it('documents the current design: the 429 carries NO Retry-After / X-RateLimit-* headers', async () => {
    h.limitMock.mockResolvedValue({ success: false, reset: Date.now() + 5000, remaining: 0, limit: 5 });
    const { rateLimitOr429 } = await load();
    const res = (await rateLimitOr429(req('1.2.3.4'), 'vote', 60, 60))!;
    expect(res.headers.get('retry-after')).toBeNull();
    expect(res.headers.get('x-ratelimit-remaining')).toBeNull();
  });

  it('the bucket key is the client IP (first x-forwarded-for entry), nothing else', async () => {
    h.limitMock.mockResolvedValue({ success: true });
    const { rateLimitOr429 } = await load();
    await rateLimitOr429(req('9.9.9.9, 10.0.0.1'), 'card-create', 30, 60);
    expect(h.limitMock).toHaveBeenCalledWith('9.9.9.9');
    // No participant, cookie or board id is part of the key.
    const withCookie = new Request('http://x/api/boards/abc/cards', {
      headers: { 'x-forwarded-for': '9.9.9.9', cookie: 'rb_ps_abc=pid.1.sig' },
    });
    await rateLimitOr429(withCookie, 'card-create', 30, 60);
    expect(h.limitMock).toHaveBeenLastCalledWith('9.9.9.9');
  });

  it('requests with no x-forwarded-for all share the single "unknown" bucket (current design)', async () => {
    h.limitMock.mockResolvedValue({ success: true });
    const { rateLimitOr429 } = await load();
    await rateLimitOr429(req(), 'join', 10, 60);
    expect(h.limitMock).toHaveBeenCalledWith('unknown');
  });

  it('builds one limiter per (name, limit, window): sliding window, prefix rl:<env>:<name>, reused on later calls', async () => {
    h.limitMock.mockResolvedValue({ success: true });
    const { rateLimitOr429 } = await load();
    await rateLimitOr429(req('1.1.1.1'), 'board-create', 10, 3600);
    await rateLimitOr429(req('2.2.2.2'), 'board-create', 10, 3600);
    await rateLimitOr429(req('1.1.1.1'), 'vote', 60, 60);
    expect(h.constructed.map((c) => c.prefix)).toEqual(['rl:local:board-create', 'rl:local:vote']);
    expect(h.slidingWindow).toHaveBeenCalledWith(10, '3600 s');
    expect(h.slidingWindow).toHaveBeenCalledWith(60, '60 s');
    expect(h.fromEnv).toHaveBeenCalledTimes(1); // one shared Redis client
  });

  it('namespaces counters by VERCEL_ENV so production and preview never share a bucket', async () => {
    h.limitMock.mockResolvedValue({ success: true });
    vi.stubEnv('VERCEL_ENV', 'preview');
    const { rateLimitOr429 } = await load();
    await rateLimitOr429(req('1.1.1.1'), 'vote', 600, 60);
    expect(h.constructed.map((c) => c.prefix)).toEqual(['rl:preview:vote']);
  });

  it('different route names do not share a bucket (different prefixes)', async () => {
    h.limitMock.mockResolvedValue({ success: true });
    const { rateLimitOr429 } = await load();
    await rateLimitOr429(req('1.1.1.1'), 'join', 10, 60);
    await rateLimitOr429(req('1.1.1.1'), 'board-join', 30, 60);
    expect(new Set(h.constructed.map((c) => c.prefix)).size).toBe(2);
  });
});

describe('fail-open behaviour (current design)', () => {
  it.each([
    ['URL missing', 'UPSTASH_REDIS_REST_URL'],
    ['TOKEN missing', 'UPSTASH_REDIS_REST_TOKEN'],
  ])('%s: returns null and never touches Upstash', async (_label, name) => {
    vi.stubEnv(name, '');
    const { rateLimitOr429 } = await load();
    expect(await rateLimitOr429(req('1.2.3.4'), 'vote', 1, 60)).toBeNull();
    expect(h.fromEnv).not.toHaveBeenCalled();
    expect(h.limitMock).not.toHaveBeenCalled();
  });

  it('only UPSTASH_API_KEY set (what .env.local has) is still unconfigured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('UPSTASH_API_KEY', 'something');
    const { rateLimitOr429 } = await load();
    expect(await rateLimitOr429(req('1.2.3.4'), 'vote', 1, 60)).toBeNull();
    expect(h.limitMock).not.toHaveBeenCalled();
  });

  it('Upstash throwing fails open (returns null) instead of rejecting the request', async () => {
    h.limitMock.mockRejectedValue(new Error('ECONNRESET'));
    const { rateLimitOr429 } = await load();
    expect(await rateLimitOr429(req('1.2.3.4'), 'vote', 60, 60)).toBeNull();
  });
});

describe('unconfigured warning', () => {
  const unconfigure = () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  };

  it('production + unconfigured: warns exactly once per process, still fails open', async () => {
    unconfigure();
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rateLimitOr429 } = await load();
    expect(await rateLimitOr429(req('1.1.1.1'), 'vote', 60, 60)).toBeNull();
    expect(await rateLimitOr429(req('1.1.1.1'), 'join', 10, 60)).toBeNull();
    expect(await rateLimitOr429(req('1.1.1.1'), 'vote', 60, 60)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('UPSTASH_REDIS_REST_URL');
    expect(String(warn.mock.calls[0][0])).toContain('UPSTASH_REDIS_REST_TOKEN');
  });

  it('development / test + unconfigured: silent (local dev and CI stay quiet)', async () => {
    unconfigure();
    for (const env of ['development', 'test']) {
      vi.stubEnv('NODE_ENV', env);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rateLimitOr429 } = await load();
      await rateLimitOr429(req('1.1.1.1'), 'vote', 60, 60);
      expect(warn, env).not.toHaveBeenCalled();
      warn.mockRestore();
    }
  });

  it('production + configured: no warning', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    h.limitMock.mockResolvedValue({ success: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rateLimitOr429 } = await load();
    await rateLimitOr429(req('1.1.1.1'), 'vote', 60, 60);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('wiring: each guarded route calls the limiter first (static assertion)', () => {
  const root = join(__dirname, '..', '..');
  const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

  const routes: Array<{ file: string; name: string; limit: number; window: number }> = [
    { file: 'app/api/boards/join/route.ts', name: 'join', limit: 30, window: 60 },
    { file: 'app/api/boards/route.ts', name: 'board-create', limit: 10, window: 3600 },
    { file: 'app/api/boards/[boardId]/join/route.ts', name: 'board-join', limit: 120, window: 60 },
    { file: 'app/api/boards/[boardId]/cards/route.ts', name: 'card-create', limit: 240, window: 60 },
    { file: 'app/api/boards/[boardId]/votes/route.ts', name: 'vote', limit: 600, window: 60 },
    { file: 'app/api/boards/[boardId]/action-items/route.ts', name: 'action-item', limit: 120, window: 60 },
    { file: 'app/api/boards/[boardId]/phase/route.ts', name: 'phase', limit: 60, window: 60 },
    { file: 'app/api/boards/[boardId]/groups/route.ts', name: 'groups', limit: 120, window: 60 },
    { file: 'app/api/boards/[boardId]/comments/route.ts', name: 'comment', limit: 300, window: 60 },
  ];

  it.each(routes)('$file: POST limits "$name" at $limit / $window s, before any other work', ({ file, name, limit, window }) => {
    const src = read(file);
    expect(src).toContain("import { rateLimitOr429 } from '@/lib/rate-limit'");
    expect(src).toContain(`rateLimitOr429(request, '${name}', ${limit}, ${window})`);
    // It is the first statement of the POST handler: nothing (params, body, DB) runs before it.
    const post = src.slice(src.indexOf('export async function POST'));
    const body = post.slice(post.indexOf('{', post.indexOf(')')) );
    const firstStatement = body.slice(body.indexOf('\n') + 1).trimStart();
    expect(firstStatement.startsWith(`const limited = await rateLimitOr429(request, '${name}'`)).toBe(true);
    expect(post).toMatch(/if \(limited\) return limited;/);
  });

  it('every limiter name is unique, so no two routes share a bucket', () => {
    expect(new Set(routes.map((r) => r.name)).size).toBe(routes.length);
  });

  it('every route file under app/ that imports the limiter is in this list (a new limited route must be added here)', () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (e.name === 'route.ts' && read(rel).includes("@/lib/rate-limit")) found.push(rel);
      }
    };
    walk('app');
    expect(found.sort()).toEqual(routes.map((r) => r.file).sort());
  });

  it('documents the gap: only POST is limited; PATCH and DELETE on cards and action-items are not', () => {
    for (const file of ['app/api/boards/[boardId]/cards/route.ts', 'app/api/boards/[boardId]/action-items/route.ts']) {
      const src = read(file);
      expect((src.match(/rateLimitOr429\(/g) ?? []).length, file).toBe(1);
      expect(src).toMatch(/export async function PATCH/);
      expect(src).toMatch(/export async function DELETE/);
    }
  });
});
