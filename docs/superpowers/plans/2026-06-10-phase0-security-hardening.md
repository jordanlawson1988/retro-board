# Phase 0A: Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the launch-blocking security holes from the 2026-06-09 SaaS readiness review (C1 admin auth, C2 Ably scoping, member-PII exposure, rate limiting, Next.js advisories, security headers) before any billing work ships.

**Architecture:** Every fix lands inside existing patterns: a `requireSystemAdmin()` helper mirroring `requireSession()`/`AuthzError` in `lib/auth-helpers.ts`, Ably capability scoping in the existing token route, and a small Upstash sliding-window limiter applied to the five hot public endpoints. No new frameworks.

**Tech Stack:** Next.js 16 App Router, Neon tagged-template SQL, Better Auth 1.5.5, Ably 2.21, Vitest, @upstash/ratelimit + @upstash/redis.

**Branch:** `feature/phase0-security` off `develop`. Pre-push gate applies (`/deploy-check` before pushing to develop).

**Prerequisites (Jordan, manual):**
- Create a free Upstash Redis database (https://console.upstash.com) → set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in `.env.local` and Vercel (Preview + Production). The limiter fails open when unset, so dev works without it.
- Review §5.4 of `docs/superpowers/specs/2026-06-09-saas-readiness-review.md` — this plan implements its security launch blockers.

**Review reference:** findings C1, C2, "Board enumeration + member-email exposure", "No rate limiting", "Vulnerable Next.js", "No security headers" in `docs/superpowers/specs/2026-06-09-saas-readiness-review.md`.

---

### Task 1: `requireSystemAdmin()` helper

**Files:**
- Modify: `lib/auth-helpers.ts` (append after `assertBoardOwner`, before `authzErrorResponse`)
- Test: `lib/__tests__/require-system-admin.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/require-system-admin.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/require-system-admin.test.ts`
Expected: FAIL — `requireSystemAdmin` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `lib/auth-helpers.ts` (after `assertBoardOwner`):

```ts
/**
 * Throw unless the caller is a system admin (present in admin_users).
 * The real authority gate for /api/admin/* — the Edge middleware cookie
 * check is UX-only and does not cover /api routes.
 */
export async function requireSystemAdmin(): Promise<{ userId: string }> {
  const session = await getSessionOrNull();
  const userId = session?.user?.id ?? null;
  if (!userId) throw new AuthzError(401, 'Sign in required');

  const [row] = await sql`SELECT 1 AS ok FROM admin_users WHERE id = ${userId}`;
  if (!row) throw new AuthzError(403, 'Admin access required');

  return { userId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/require-system-admin.test.ts`
Expected: 4 passed. Then run the whole suite: `npm test` → all green.

- [ ] **Step 5: Commit**

```bash
git add lib/auth-helpers.ts lib/__tests__/require-system-admin.test.ts
git commit -m "feat(security): add requireSystemAdmin helper for admin API gating"
```

---

### Task 2: Gate every `/api/admin/*` handler (fixes C1)

**Files:**
- Modify: `app/api/admin/boards/route.ts` (GET, DELETE, POST)
- Modify: `app/api/admin/feature-flags/route.ts` (GET, PATCH)
- Modify: `app/api/admin/app-settings/route.ts` (GET, PATCH)
- Modify: `app/api/admin/dashboard/route.ts` (GET)
- Modify: `app/api/admin/verify/route.ts` (GET — also switch from `?userId=` to session)
- Modify: `stores/authStore.ts:54` and `stores/authStore.ts:86` (drop the query param)

- [ ] **Step 1: Add the guard to every handler**

In each of the four route files above (`boards`, `feature-flags`, `app-settings`, `dashboard`), add the import and put this guard as the FIRST statement of EVERY exported handler (GET, POST, PATCH, DELETE):

```ts
import { requireSystemAdmin, authzErrorResponse } from '@/lib/auth-helpers';

// First lines inside each handler:
try {
  await requireSystemAdmin();
} catch (e) {
  const r = authzErrorResponse(e);
  if (r) return Response.json(r.body, { status: r.status });
  throw e;
}
```

Example — `app/api/admin/feature-flags/route.ts` becomes:

```ts
import { sql } from '@/lib/db';
import { requireSystemAdmin, authzErrorResponse } from '@/lib/auth-helpers';

export async function GET() {
  try {
    await requireSystemAdmin();
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return Response.json(r.body, { status: r.status });
    throw e;
  }
  const flags = await sql`SELECT * FROM feature_flags ORDER BY created_at`;
  return Response.json({ flags });
}

export async function PATCH(request: Request) {
  try {
    await requireSystemAdmin();
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return Response.json(r.body, { status: r.status });
    throw e;
  }
  const { id, is_enabled } = await request.json();
  await sql`UPDATE feature_flags SET is_enabled = ${is_enabled}, updated_at = NOW() WHERE id = ${id}`;
  return Response.json({ ok: true });
}
```

Apply the identical pattern to all handlers in `boards/route.ts` (3 handlers), `app-settings/route.ts` (2), `dashboard/route.ts` (1).

⚠️ One behavioral check: the public board page reads feature flags to decide Ably-vs-polling. Run `grep -rn "feature-flags" app components stores hooks lib --include="*.ts*" | grep -v admin` — if any non-admin code fetches `/api/admin/feature-flags`, create a read-only public endpoint `app/api/feature-flags/route.ts` that returns only `{key, is_enabled}` pairs and point the client there. Do NOT leave the admin route open for it.

- [ ] **Step 2: Rewrite the verify route to be session-based**

Replace the full contents of `app/api/admin/verify/route.ts`:

```ts
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireSystemAdmin, authzErrorResponse } from '@/lib/auth-helpers';

// Returns the CALLER's admin_users row (or 401/403). Never accepts a userId
// param — the old form let anyone enumerate admin accounts.
export async function GET() {
  try {
    const { userId } = await requireSystemAdmin();
    const [adminUser] = await sql`SELECT * FROM admin_users WHERE id = ${userId}`;
    return NextResponse.json(adminUser);
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(null, { status: r.status });
    throw e;
  }
}
```

In `stores/authStore.ts` lines 54 and 86, change both calls:

```ts
// before
const adminRes = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
// after
const adminRes = await fetch('/api/admin/verify');
```

(The store already treats non-OK responses as "not an admin" — 401/403 now flow through that path.)

- [ ] **Step 3: Verify by hand — unauthenticated requests must bounce**

Run the dev server (check port vs `.env.local` first), then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/boards          # expect 401
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/admin/boards -H 'content-type: application/json' -d '{"boardId":"x"}'   # expect 401
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH http://localhost:3000/api/admin/feature-flags -H 'content-type: application/json' -d '{"id":"x","is_enabled":false}'  # expect 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/verify           # expect 401
```

Then log in as the admin user in the browser and confirm `/admin` dashboard, boards list, feature flags, and settings pages still load and mutate.

- [ ] **Step 4: Run checks and commit**

Run: `npx tsc --noEmit && npm test`
Expected: clean.

```bash
git add app/api/admin stores/authStore.ts app/api/feature-flags 2>/dev/null
git commit -m "fix(security): require system admin on every /api/admin handler (C1)"
```

---

### Task 3: Scope Ably tokens per board (fixes C2)

**Files:**
- Modify: `app/api/ably-token/route.ts` (full rewrite below)
- Modify: `components/providers/AblyProvider.tsx` (add `boardId` prop)
- Modify: the single `<AblyProvider` call site — find with `grep -rn "<AblyProvider" components app` (expected: the board page wrapper) and pass `boardId`

- [ ] **Step 1: Rewrite the token route with capability scoping**

Replace the full contents of `app/api/ably-token/route.ts`:

```ts
import { ablyServer } from '@/lib/ably-server';
import { sql } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mints a token usable ONLY on the requested board's two channels.
// Anonymous access is by design (participants have no accounts); the
// scoping is what prevents cross-board realtime snooping/forgery.
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  const boardId = request.nextUrl.searchParams.get('boardId');
  if (!clientId || !boardId) {
    return new Response('Missing clientId or boardId', { status: 400 });
  }

  const [board] = await sql`
    SELECT 1 AS ok FROM boards WHERE id = ${boardId} AND deleted_at IS NULL
  `;
  if (!board) {
    return new Response('Unknown board', { status: 404 });
  }

  const tokenRequest = await ablyServer.auth.createTokenRequest({
    clientId,
    capability: JSON.stringify({
      [`retro-board:${boardId}`]: ['subscribe', 'publish', 'presence'],
      [`retro-board:${boardId}:timer`]: ['subscribe', 'publish', 'presence'],
    }),
  });

  return Response.json(tokenRequest);
}
```

- [ ] **Step 2: Thread boardId through the client provider**

Replace the full contents of `components/providers/AblyProvider.tsx`:

```tsx
'use client';

import { AblyProvider as AblyReactProvider } from 'ably/react';
import * as Ably from 'ably';
import { useRef } from 'react';

export function AblyProvider({
  clientId,
  boardId,
  children,
}: {
  clientId: string;
  boardId: string;
  children: React.ReactNode;
}) {
  const clientRef = useRef<Ably.Realtime | null>(null);

  if (!clientRef.current) {
    clientRef.current = new Ably.Realtime({
      authUrl: `/api/ably-token?clientId=${clientId}&boardId=${boardId}`,
      authMethod: 'GET',
      clientId,
    });
  }

  return (
    <AblyReactProvider client={clientRef.current}>
      {children}
    </AblyReactProvider>
  );
}
```

Then run `grep -rn "<AblyProvider" components app` and add `boardId={boardId}` at the call site (the board page wrapper already has `boardId` in scope; `npx tsc --noEmit` will fail until the prop is passed, which confirms you found every call site).

- [ ] **Step 3: Verify scoping by hand**

1. Open board A in one tab — realtime works (add a card in a second tab of the same board, it appears).
2. Confirm cross-board denial: in DevTools on board A, run

```js
fetch(`/api/ably-token?clientId=evil&boardId=${location.pathname.split('/')[2]}`).then(r => r.json()).then(t => console.log(JSON.parse(t.capability)))
```

Expected: capability lists ONLY board A's two channels (not `"*"`).
3. Timer still syncs (start timer as facilitator, second tab sees it).
4. Reconnect banner still behaves (kill network briefly).

- [ ] **Step 4: Run checks and commit**

Run: `npx tsc --noEmit && npm test && npm run build` (stop dev server before building)

```bash
git add app/api/ably-token components/providers/AblyProvider.tsx components/pages
git commit -m "fix(security): scope Ably tokens to the requesting board's channels (C2)"
```

---

### Task 4: Stop member-email exposure on the members endpoint

**Files:**
- Modify: `app/api/boards/[boardId]/members/route.ts` (GET handler only — POST/DELETE are already session-gated)

- [ ] **Step 1: Replace the GET handler**

```ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const session = await getSessionOrNull();
  const requesterId = session?.user?.id ?? null;
  if (!requesterId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const members = await sql`
    SELECT bm.*, u.email AS user_email, u.name AS user_name
    FROM board_members bm
    JOIN "user" u ON bm.user_id = u.id
    WHERE bm.board_id = ${boardId}
    ORDER BY bm.joined_at ASC
  `;

  // Facilitators/owners see emails; plain members see names only;
  // non-members see nothing. Member emails are PII, not public data.
  let canSeeEmails = false;
  try {
    await assertCanFacilitate(boardId);
    canSeeEmails = true;
  } catch {
    canSeeEmails = false;
  }

  const isMember = members.some((m) => m.user_id === requesterId);
  if (!isMember && !canSeeEmails) {
    return NextResponse.json({ error: 'Not a member of this board' }, { status: 403 });
  }

  return NextResponse.json({
    members: members.map((m) => (canSeeEmails ? m : { ...m, user_email: null })),
  });
}
```

Add `assertCanFacilitate` to the existing import from `@/lib/auth-helpers`.

- [ ] **Step 2: Verify by hand**

- Logged out: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/boards/<realBoardId>/members` → 401.
- Logged in as the board owner: members modal still shows emails and role management works.
- Logged in as a non-member account: 403.

- [ ] **Step 3: Run checks and commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add "app/api/boards/[boardId]/members/route.ts"
git commit -m "fix(security): gate member list behind session; emails facilitator-only"
```

---

### Task 5: Rate limiting on the five hot public endpoints

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `lib/__tests__/rate-limit.test.ts`
- Modify: `app/api/boards/join/route.ts`, `app/api/boards/route.ts`, `app/api/boards/[boardId]/cards/route.ts`, `app/api/boards/[boardId]/votes/route.ts`, `app/api/boards/[boardId]/action-items/route.ts`

- [ ] **Step 1: Install deps**

```bash
npm install @upstash/ratelimit @upstash/redis
```

- [ ] **Step 2: Write the failing test**

```ts
// lib/__tests__/rate-limit.test.ts
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
```

Run: `npx vitest run lib/__tests__/rate-limit.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/rate-limit.ts`**

```ts
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
```

Run: `npx vitest run lib/__tests__/rate-limit.test.ts` → PASS.

- [ ] **Step 4: Apply to the five endpoints**

Add as the FIRST statement inside each handler (before the `try` block where one exists), with these budgets:

| File | Handler | Call |
|---|---|---|
| `app/api/boards/join/route.ts` | POST | `const limited = await rateLimitOr429(request, 'join', 10, 60); if (limited) return limited;` |
| `app/api/boards/route.ts` | POST | `const limited = await rateLimitOr429(request, 'board-create', 10, 3600); if (limited) return limited;` |
| `app/api/boards/[boardId]/cards/route.ts` | POST | `const limited = await rateLimitOr429(request, 'card-create', 30, 60); if (limited) return limited;` |
| `app/api/boards/[boardId]/votes/route.ts` | POST | `const limited = await rateLimitOr429(request, 'vote', 60, 60); if (limited) return limited;` |
| `app/api/boards/[boardId]/action-items/route.ts` | POST | `const limited = await rateLimitOr429(request, 'action-item', 30, 60); if (limited) return limited;` |

Import in each: `import { rateLimitOr429 } from '@/lib/rate-limit';`

- [ ] **Step 5: Cap card text length while in the cards route**

In `app/api/boards/[boardId]/cards/route.ts` POST, immediately after the body is parsed, add:

```ts
if (typeof text !== 'string' || text.trim().length === 0 || text.length > 2000) {
  return NextResponse.json(
    { error: 'Card text must be 1–2000 characters' },
    { status: 400 }
  );
}
```

(Adjust the destructured variable name to match the existing handler — the card body field is `text`.)

- [ ] **Step 6: Verify**

With Upstash env set in `.env.local`, hammer the join endpoint:

```bash
for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:3000/api/boards/join -H 'content-type: application/json' -d '{"joinCode":"00000"}'; done; echo
```

Expected: ten 404s (unknown code) then 429s. Normal board usage (cards/votes at human speed) unaffected.

- [ ] **Step 7: Run checks and commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add lib/rate-limit.ts lib/__tests__/rate-limit.test.ts app/api/boards package.json package-lock.json
git commit -m "feat(security): per-IP rate limits on hot public endpoints + card length cap"
```

---

### Task 6: Next.js upgrade + dependency audit

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Upgrade and audit**

```bash
npm install next@^16 eslint-config-next@^16   # pulls latest patched 16.x
npm audit fix
npm audit                                      # review what remains
```

Expected: the 3 High Next.js advisories (middleware bypass, SSRF, DoS) and the kysely/postcss/ws transitive advisories resolve. If `npm audit fix` wants a semver-major on anything, STOP and list it for Jordan instead of forcing it.

- [ ] **Step 2: Verify nothing broke**

```bash
npx tsc --noEmit && npm test && npm run build
```

Then a manual smoke: login → dashboard → open a board → add a card → admin pages load. Pay attention to middleware redirects (`/admin` logged out → `/login`) since the advisories touched middleware.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix(security): bump Next.js to patched 16.x and audit-fix transitive deps"
```

---

### Task 7: Security headers

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add a headers() block**

Replace the contents of `next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

(CSP is deliberately deferred to Phase 1 as a report-only rollout — it needs allowances for Ably websockets, Turnstile, and Paddle's checkout iframe, and getting it wrong breaks the product. X-Frame-Options closes the clickjacking gap now. Note: Paddle's inline checkout in Phase 0B is an iframe FROM paddle.com INTO our page — X-Frame-Options on our responses does not affect it.)

- [ ] **Step 2: Verify**

```bash
npm run build && npm run start &
curl -sI http://localhost:3000 | grep -iE 'x-frame|x-content|referrer|permissions'
```

Expected: all four headers present. Board page still loads; Turnstile widget on /login still renders.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): baseline security headers (XFO, nosniff, referrer, permissions)"
```

---

### Task 8: Ship the branch

- [ ] Run the full gate locally: `npx tsc --noEmit && npm run build && npm test` (never under a live `next dev`).
- [ ] Push `feature/phase0-security`, open a PR to `develop` (`gh pr create`), summary = this plan's task list.
- [ ] After Jordan reviews: `/deploy-check`, then merge to `develop`, verify on the preview deployment (repeat Task 2 Step 3 + Task 3 Step 3 curls against the preview URL).

**Definition of done:** all curls in Tasks 2–5 return the expected status codes against the preview deployment, admin UI works logged-in, realtime works on two boards simultaneously without cross-talk.
