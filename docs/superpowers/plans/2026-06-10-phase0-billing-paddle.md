# Phase 0B: Billing & Entitlements (Paddle MoR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RetroBoard chargeable: $3.99/mo unlimited boards via Paddle (merchant of record), a free tier of 1 active board, Jordan's free-access allowlist managed from the admin console, and the legal/conversion surface (pricing section, terms, privacy, support) required to sell.

**Architecture:** Paddle Billing is the seller of record (handles all global VAT/sales tax — decision D0 2026-06-10; Lemon Squeezy rejected because it is mid-absorption into invite-only Stripe Managed Payments). One overlay checkout client-side, one webhook server-side upserting a single `subscriptions` row per user, one server-only `lib/entitlements.ts` with a pure, unit-tested decision function. Enforcement at the single board-creation choke point plus reopen/restore. Participants are NEVER gated (locked invariant).

**Locked decisions (2026-06-10):** D0 Paddle MoR · D1 free tier = 1 active board (config constant) · D2 grandfathering per review §5.5 (nothing retroactively locked; existing owners seeded into allowlist manually) · D3 lapse = read-only after 14-day grace (encoded in entitlement states now; active board-locking enforcement deferred — there are zero subscribers at launch, the create/reopen/restore gate already prevents free-slot abuse, and the ToS states the policy).

**Tech Stack:** `@paddle/paddle-node-sdk` (server), `@paddle/paddle-js` (overlay checkout), Neon tagged-template SQL, Better Auth 1.5.5 (NO upgrade needed — the @better-auth/stripe path is obsolete under D0), Vitest.

**Branch:** `feature/phase0-billing` off `develop`. **Depends on Phase 0A Task 1 (`requireSystemAdmin`) being merged** — the allowlist admin API must not ship on unauthenticated admin routes.

**Prerequisites (Jordan, manual — start the Paddle one NOW, business verification takes days):**
1. **Vercel Pro upgrade** ($20/mo) — required before taking the first dollar (review C6). Billing portal action.
2. **Paddle account** (https://paddle.com): create a **sandbox** account immediately (instant) and submit the **live** account for verification (needs the retroboard.live domain, a terms+privacy+refund page URL — Task 9 provides them, so live approval happens late in this plan). In the sandbox dashboard:
   - Create product "RetroBoard Pro" → recurring price **$3.99/month** → note the `pri_...` id.
   - Create a client-side token (Developer Tools → Authentication) → `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
   - Create an API key → `PADDLE_API_KEY`.
   - Notifications → add a webhook destination (the Vercel **preview** URL `https://<preview>/api/webhooks/paddle`, events: `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.past_due`, `subscription.resumed`) → note the secret → `PADDLE_WEBHOOK_SECRET`.
3. Env vars in `.env.local` + Vercel (sandbox values in Preview, live values in Production when flipping):

```bash
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
NEXT_PUBLIC_PADDLE_ENV=sandbox          # 'production' at flip
NEXT_PUBLIC_PADDLE_PRICE_ID=pri_...
```

Also append these five to `.env.example` with placeholder values.

**Review reference:** §5 of `docs/superpowers/specs/2026-06-09-saas-readiness-review.md` (entitlement design, enforcement points, grandfathering), adjusted for D0 = Paddle instead of Stripe.

---

### Task 1: Migration 010 — `subscriptions` + `free_access`

**Files:**
- Create: `scripts/migrations/010_billing_paddle.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 010_billing_paddle.sql
-- Billing (Paddle MoR) + free-access allowlist. One subscription per user.

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  paddle_subscription_id TEXT NOT NULL UNIQUE,
  paddle_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,              -- active | trialing | past_due | paused | canceled
  price_id TEXT,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS free_access (
  email TEXT PRIMARY KEY,            -- always stored lowercase
  note TEXT,                         -- e.g. 'F3 guys', 'beta tester'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Apply to the dev branch DB and verify**

```bash
node scripts/run-one.mjs scripts/migrations/010_billing_paddle.sql
```

Verify: `SELECT * FROM subscriptions; SELECT * FROM free_access;` both return empty result sets (tables exist). (Apply to prod alongside the merge of this branch, same as migrations 002–009.)

- [ ] **Step 3: Commit**

```bash
git add scripts/migrations/010_billing_paddle.sql
git commit -m "feat(billing): migration 010 — subscriptions (paddle) + free_access allowlist"
```

---

### Task 2: Delete the stale billing vocabulary (single-source-of-truth gate)

**Files:**
- Modify: `types/index.ts` (remove `SubscriptionStatus`, `Subscription`, `PLAN_LIMITS`, `PlanTier` — the dead $4.99-era model)
- Modify: `stores/authStore.ts` (remove the always-null `subscription` field)

- [ ] **Step 1: Confirm the old vocabulary is dead, then delete it**

```bash
grep -rn "PLAN_LIMITS\|PlanTier\|SubscriptionStatus" app components stores lib hooks utils --include="*.ts*" | grep -v "types/index.ts"
grep -rn "\.subscription" app components stores lib hooks --include="*.ts*"
```

Expected (per review verification): no consumers outside `types/index.ts`, and `.subscription` only inside `stores/authStore.ts` (set to null, never read). Delete the four declarations from `types/index.ts` and the `subscription` state field + its `null` assignments from `stores/authStore.ts`. If the grep shows a real consumer, stop and reconcile before deleting.

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit && npm test` → clean.

```bash
git add types/index.ts stores/authStore.ts
git commit -m "refactor(billing): delete dead $4.99-era PLAN_LIMITS/Subscription vocabulary"
```

---

### Task 3: `lib/entitlements.ts` — pure decision + DB wrapper

**Files:**
- Create: `lib/entitlements.ts`
- Test: `lib/__tests__/entitlements.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/__tests__/entitlements.test.ts
import { describe, it, expect } from 'vitest';
import {
  resolveEntitlement,
  isSubscriptionEntitled,
  FREE_ACTIVE_BOARD_LIMIT,
  LAPSE_GRACE_DAYS,
} from '@/lib/entitlements';

const NOW = new Date('2026-06-10T12:00:00Z');
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

describe('isSubscriptionEntitled', () => {
  it('null subscription is not entitled', () => {
    expect(isSubscriptionEntitled(null, NOW)).toBe(false);
  });
  it('active and trialing are entitled', () => {
    expect(isSubscriptionEntitled({ status: 'active', current_period_end: null, canceled_at: null }, NOW)).toBe(true);
    expect(isSubscriptionEntitled({ status: 'trialing', current_period_end: null, canceled_at: null }, NOW)).toBe(true);
  });
  it('past_due stays entitled through the 14-day grace window (D3)', () => {
    const sub = { status: 'past_due', current_period_end: daysFromNow(-13), canceled_at: null };
    expect(isSubscriptionEntitled(sub, NOW)).toBe(true);
  });
  it('past_due loses entitlement after grace', () => {
    const sub = { status: 'past_due', current_period_end: daysFromNow(-(LAPSE_GRACE_DAYS + 1)), canceled_at: null };
    expect(isSubscriptionEntitled(sub, NOW)).toBe(false);
  });
  it('canceled uses canceled_at when period end is missing', () => {
    const inGrace = { status: 'canceled', current_period_end: null, canceled_at: daysFromNow(-2) };
    const pastGrace = { status: 'canceled', current_period_end: null, canceled_at: daysFromNow(-20) };
    expect(isSubscriptionEntitled(inGrace, NOW)).toBe(true);
    expect(isSubscriptionEntitled(pastGrace, NOW)).toBe(false);
  });
  it('paused and unknown statuses are not entitled', () => {
    expect(isSubscriptionEntitled({ status: 'paused', current_period_end: daysFromNow(30), canceled_at: null }, NOW)).toBe(false);
    expect(isSubscriptionEntitled({ status: 'garbage', current_period_end: daysFromNow(30), canceled_at: null }, NOW)).toBe(false);
  });
});

describe('resolveEntitlement', () => {
  it('allowlisted user is comped with no limit regardless of boards', () => {
    const e = resolveEntitlement({ isAllowlisted: true, subscription: null, activeBoards: 99, now: NOW });
    expect(e).toEqual({ plan: 'comped', canCreateBoard: true, activeBoards: 99, limit: null });
  });
  it('entitled subscriber is paid with no limit', () => {
    const e = resolveEntitlement({
      isAllowlisted: false,
      subscription: { status: 'active', current_period_end: null, canceled_at: null },
      activeBoards: 99,
      now: NOW,
    });
    expect(e.plan).toBe('paid');
    expect(e.canCreateBoard).toBe(true);
  });
  it('free user under the limit can create', () => {
    const e = resolveEntitlement({ isAllowlisted: false, subscription: null, activeBoards: 0, now: NOW });
    expect(e).toEqual({ plan: 'free', canCreateBoard: true, activeBoards: 0, limit: FREE_ACTIVE_BOARD_LIMIT });
  });
  it('free user at the limit cannot create (D1: limit = 1)', () => {
    const e = resolveEntitlement({ isAllowlisted: false, subscription: null, activeBoards: 1, now: NOW });
    expect(e.canCreateBoard).toBe(false);
  });
  it('lapsed-past-grace subscriber falls back to the free tier (D3)', () => {
    const e = resolveEntitlement({
      isAllowlisted: false,
      subscription: { status: 'canceled', current_period_end: daysFromNow(-30), canceled_at: daysFromNow(-30) },
      activeBoards: 4,
      now: NOW,
    });
    expect(e.plan).toBe('free');
    expect(e.canCreateBoard).toBe(false); // 4 actives > limit; existing boards stay untouched (D2)
  });
});
```

Run: `npx vitest run lib/__tests__/entitlements.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement**

```ts
// lib/entitlements.ts
// Single source of truth for plan vocabulary and entitlement decisions.
// Server-only (imports the lazy sql). Decision logic is pure for testability.
import { sql } from '@/lib/db';

export const FREE_ACTIVE_BOARD_LIMIT = 1; // D1 2026-06-10. Tune here; code is N-agnostic.
export const LAPSE_GRACE_DAYS = 14; // D3 2026-06-10.

export type Plan = 'paid' | 'comped' | 'free';

export interface SubscriptionRow {
  status: string;
  current_period_end: string | null;
  canceled_at: string | null;
}

export interface Entitlement {
  plan: Plan;
  canCreateBoard: boolean;
  activeBoards: number;
  limit: number | null; // null = unlimited
}

/** Pure: is this subscription still entitled, including the 14-day grace window? */
export function isSubscriptionEntitled(sub: SubscriptionRow | null, now: Date): boolean {
  if (!sub) return false;
  if (sub.status === 'active' || sub.status === 'trialing') return true;
  if (sub.status === 'past_due' || sub.status === 'canceled') {
    const anchor = sub.current_period_end ?? sub.canceled_at;
    if (!anchor) return false;
    const graceEnd = new Date(new Date(anchor).getTime() + LAPSE_GRACE_DAYS * 86_400_000);
    return now < graceEnd;
  }
  return false; // paused / unknown
}

/** Pure decision over already-loaded facts. */
export function resolveEntitlement(input: {
  isAllowlisted: boolean;
  subscription: SubscriptionRow | null;
  activeBoards: number;
  now: Date;
}): Entitlement {
  const { isAllowlisted, subscription, activeBoards, now } = input;
  if (isAllowlisted) {
    return { plan: 'comped', canCreateBoard: true, activeBoards, limit: null };
  }
  if (isSubscriptionEntitled(subscription, now)) {
    return { plan: 'paid', canCreateBoard: true, activeBoards, limit: null };
  }
  return {
    plan: 'free',
    canCreateBoard: activeBoards < FREE_ACTIVE_BOARD_LIMIT,
    activeBoards,
    limit: FREE_ACTIVE_BOARD_LIMIT,
  };
}

/** Load facts and decide. One indexed query — no caching at this scale (deliberate). */
export async function getEntitlement(userId: string, email: string): Promise<Entitlement> {
  const [row] = await sql`
    SELECT
      EXISTS (SELECT 1 FROM free_access WHERE email = ${email.toLowerCase()}) AS is_allowlisted,
      (SELECT row_to_json(s) FROM (
         SELECT status, current_period_end, canceled_at
         FROM subscriptions WHERE user_id = ${userId}
       ) s) AS subscription,
      (SELECT COUNT(*)::int FROM boards
        WHERE owner_id = ${userId} AND archived_at IS NULL AND deleted_at IS NULL) AS active_boards
  `;
  return resolveEntitlement({
    isAllowlisted: !!row?.is_allowlisted,
    subscription: (row?.subscription as SubscriptionRow | null) ?? null,
    activeBoards: Number(row?.active_boards ?? 0),
    now: new Date(),
  });
}
```

- [ ] **Step 3: Run tests, then commit**

Run: `npx vitest run lib/__tests__/entitlements.test.ts` → all pass. `npm test` → suite green.

```bash
git add lib/entitlements.ts lib/__tests__/entitlements.test.ts
git commit -m "feat(billing): entitlement vocabulary + pure decision function with grace window"
```

---

### Task 4: Gate board creation, reopen, and restore (fixes C4 + C5)

**Files:**
- Modify: `app/api/boards/route.ts` (POST — require session + entitlement)
- Modify: `app/api/boards/[boardId]/route.ts` (the `reopen` and `restore` action branches)

- [ ] **Step 1: Require a session and entitlement in POST /api/boards**

In `app/api/boards/route.ts`, replace these two lines inside the POST handler:

```ts
const session = await getSessionOrNull();
const ownerId = session?.user?.id ?? null;
```

with:

```ts
// Creators must have an account (locked decision 2026-06-09). Participants
// joining boards are untouched — never gate the join routes.
const session = await getSessionOrNull();
if (!session?.user) {
  return NextResponse.json(
    { error: 'Sign in to create a board', code: 'AUTH_REQUIRED' },
    { status: 401 }
  );
}
const ownerId = session.user.id;

const entitlement = await getEntitlement(ownerId, session.user.email);
if (!entitlement.canCreateBoard) {
  return NextResponse.json(
    {
      error: `The free plan includes ${entitlement.limit} active board. Complete or delete a board to free a slot, or upgrade for unlimited boards.`,
      code: 'BOARD_LIMIT_REACHED',
    },
    { status: 402 }
  );
}
```

Add the import: `import { getEntitlement } from '@/lib/entitlements';`

- [ ] **Step 2: Gate reopen and restore (free-slot laundering)**

In `app/api/boards/[boardId]/route.ts`, locate the `reopen` and `restore` action branches (each already calls `assertBoardOwner(boardId)` — the review cites them at ~lines 170–199). Immediately AFTER the `assertBoardOwner` call in BOTH branches, insert:

```ts
const session = await getSessionOrNull();
if (session?.user) {
  const ent = await getEntitlement(session.user.id, session.user.email);
  if (!ent.canCreateBoard) {
    return NextResponse.json(
      {
        error: `Reactivating this board would exceed the free plan's ${ent.limit} active board. Upgrade for unlimited boards.`,
        code: 'BOARD_LIMIT_REACHED',
      },
      { status: 402 }
    );
  }
}
```

(System admins reopening someone's board via the admin console use `/api/admin/boards` unarchive, which is exempt by design. `complete` and `DELETE` are never gated — they free slots, which is healthy behavior.)

- [ ] **Step 3: Verify by hand**

- Logged out: HomePage create → POST returns 401 `AUTH_REQUIRED` (client UX for this lands in Task 7; a console error is acceptable until then).
- Logged in, 0 active boards: create works.
- Logged in, 1 active board: create returns 402 `BOARD_LIMIT_REACHED` (`curl` or DevTools).
- Add your email to `free_access` directly in SQL (`INSERT INTO free_access (email) VALUES ('you@example.com');`): create works again with 1+ actives.
- Complete the extra board → free creation works again.

- [ ] **Step 4: Run checks and commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add app/api/boards/route.ts "app/api/boards/[boardId]/route.ts"
git commit -m "feat(billing): require account + entitlement for board create/reopen/restore"
```

---

### Task 5: Paddle server client + webhook

**Files:**
- Create: `lib/paddle.ts`
- Create: `lib/paddle-webhook.ts` (pure event→row mapper)
- Create: `app/api/webhooks/paddle/route.ts`
- Test: `lib/__tests__/paddle-webhook.test.ts`

- [ ] **Step 1: Install the SDK**

```bash
npm install @paddle/paddle-node-sdk
```

- [ ] **Step 2: Write the failing mapper test**

```ts
// lib/__tests__/paddle-webhook.test.ts
import { describe, it, expect } from 'vitest';
import { subscriptionRowFromEvent } from '@/lib/paddle-webhook';

const baseEvent = {
  eventType: 'subscription.created',
  data: {
    id: 'sub_123',
    customerId: 'ctm_456',
    status: 'active',
    customData: { userId: 'user_789' },
    items: [{ price: { id: 'pri_abc' } }],
    currentBillingPeriod: { endsAt: '2026-07-10T12:00:00Z' },
    canceledAt: null,
  },
};

describe('subscriptionRowFromEvent', () => {
  it('maps a subscription event to an upsert row', () => {
    expect(subscriptionRowFromEvent(baseEvent)).toEqual({
      userId: 'user_789',
      paddleSubscriptionId: 'sub_123',
      paddleCustomerId: 'ctm_456',
      status: 'active',
      priceId: 'pri_abc',
      currentPeriodEnd: '2026-07-10T12:00:00Z',
      canceledAt: null,
    });
  });

  it('uses the event OBJECT status, not the event type (cardinal rule)', () => {
    const evt = { ...baseEvent, eventType: 'subscription.updated', data: { ...baseEvent.data, status: 'past_due' } };
    expect(subscriptionRowFromEvent(evt)?.status).toBe('past_due');
  });

  it('returns null for non-subscription events', () => {
    expect(subscriptionRowFromEvent({ eventType: 'transaction.completed', data: {} })).toBeNull();
  });

  it('returns null when customData.userId is missing (cannot attribute)', () => {
    const evt = { ...baseEvent, data: { ...baseEvent.data, customData: {} } };
    expect(subscriptionRowFromEvent(evt)).toBeNull();
  });
});
```

Run: `npx vitest run lib/__tests__/paddle-webhook.test.ts` → FAIL.

- [ ] **Step 3: Implement the pure mapper**

```ts
// lib/paddle-webhook.ts
// Pure mapping from a Paddle webhook event to our subscriptions upsert row.
// Status truth comes from the event OBJECT, never the event type.

export interface SubscriptionUpsertRow {
  userId: string;
  paddleSubscriptionId: string;
  paddleCustomerId: string;
  status: string;
  priceId: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
}

// Loose input type: the SDK's unmarshal returns a typed event, but we only
// rely on these fields so replays/new event versions degrade safely.
export interface PaddleEventLike {
  eventType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export function subscriptionRowFromEvent(event: PaddleEventLike): SubscriptionUpsertRow | null {
  if (!event.eventType?.startsWith('subscription.')) return null;
  const d = event.data;
  const userId = d?.customData?.userId;
  if (!userId || !d?.id) return null; // checkout must pass customData.userId (Task 6)
  return {
    userId,
    paddleSubscriptionId: d.id,
    paddleCustomerId: d.customerId ?? '',
    status: d.status ?? 'unknown',
    priceId: d.items?.[0]?.price?.id ?? null,
    currentPeriodEnd: d.currentBillingPeriod?.endsAt ?? null,
    canceledAt: d.canceledAt ?? null,
  };
}
```

Run: `npx vitest run lib/__tests__/paddle-webhook.test.ts` → PASS.

- [ ] **Step 4: Lazy Paddle client + webhook route**

```ts
// lib/paddle.ts
// Lazy init, same pattern as lib/db.ts / lib/auth.ts — never crash the build.
import { Paddle, Environment } from '@paddle/paddle-node-sdk';

let _paddle: Paddle | null = null;

export function getPaddle(): Paddle {
  if (!_paddle) {
    const key = process.env.PADDLE_API_KEY;
    if (!key) throw new Error('PADDLE_API_KEY environment variable is not set');
    _paddle = new Paddle(key, {
      environment:
        process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
          ? Environment.production
          : Environment.sandbox,
    });
  }
  return _paddle;
}
```

```ts
// app/api/webhooks/paddle/route.ts
import { getPaddle } from '@/lib/paddle';
import { sql } from '@/lib/db';
import { subscriptionRowFromEvent } from '@/lib/paddle-webhook';

// Paddle signs with the 'paddle-signature' header; unmarshal verifies HMAC
// and parses in one step. Replays converge via the upsert (idempotent).
export async function POST(request: Request) {
  const signature = request.headers.get('paddle-signature');
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return new Response('Missing signature', { status: 400 });
  }

  const raw = await request.text();
  let event;
  try {
    event = await getPaddle().webhooks.unmarshal(raw, secret, signature);
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }

  const row = subscriptionRowFromEvent(event as { eventType: string; data: unknown });
  if (row) {
    await sql`
      INSERT INTO subscriptions
        (user_id, paddle_subscription_id, paddle_customer_id, status, price_id, current_period_end, canceled_at, updated_at)
      VALUES
        (${row.userId}, ${row.paddleSubscriptionId}, ${row.paddleCustomerId}, ${row.status},
         ${row.priceId}, ${row.currentPeriodEnd}, ${row.canceledAt}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        paddle_subscription_id = EXCLUDED.paddle_subscription_id,
        paddle_customer_id = EXCLUDED.paddle_customer_id,
        status = EXCLUDED.status,
        price_id = EXCLUDED.price_id,
        current_period_end = EXCLUDED.current_period_end,
        canceled_at = EXCLUDED.canceled_at,
        updated_at = now()
    `;
  }

  return Response.json({ ok: true });
}
```

Note: middleware matcher does not touch `/api/*`, so the webhook is reachable without changes (verified in the review).

- [ ] **Step 5: Verify signature rejection locally**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhooks/paddle -d '{}'                       # 400 (no signature)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhooks/paddle -H 'paddle-signature: ts=1;h1=bad' -d '{}'  # 401 (bad signature)
```

(End-to-end webhook delivery is verified on the preview deployment in Task 11 — Paddle cannot reach localhost.)

- [ ] **Step 6: Run checks and commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add lib/paddle.ts lib/paddle-webhook.ts app/api/webhooks lib/__tests__/paddle-webhook.test.ts package.json package-lock.json
git commit -m "feat(billing): Paddle webhook with signature verification and idempotent upsert"
```

---

### Task 6: `/api/user/entitlement` + billing portal endpoint

**Files:**
- Create: `app/api/user/entitlement/route.ts`
- Create: `app/api/billing/portal/route.ts`

- [ ] **Step 1: Entitlement read endpoint (dashboard + modal use it)**

```ts
// app/api/user/entitlement/route.ts
import { NextResponse } from 'next/server';
import { requireSession, authzErrorResponse } from '@/lib/auth-helpers';
import { getEntitlement } from '@/lib/entitlements';

export async function GET() {
  try {
    const session = await requireSession();
    const entitlement = await getEntitlement(session.user.id, session.user.email);
    return NextResponse.json(entitlement);
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(r.body, { status: r.status });
    if (e instanceof Response) return e; // requireSession throws a Response
    throw e;
  }
}
```

- [ ] **Step 2: Customer portal session (cancel / payment method / invoices — all Paddle-hosted)**

```ts
// app/api/billing/portal/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-helpers';
import { getPaddle } from '@/lib/paddle';
import { sql } from '@/lib/db';

export async function POST() {
  let session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const [sub] = await sql`
    SELECT paddle_customer_id, paddle_subscription_id
    FROM subscriptions WHERE user_id = ${session.user.id}
  `;
  if (!sub) {
    return NextResponse.json({ error: 'No subscription on file' }, { status: 404 });
  }

  const portal = await getPaddle().customerPortalSessions.create(
    sub.paddle_customer_id as string,
    [sub.paddle_subscription_id as string]
  );
  return NextResponse.json({ url: portal.urls.general.overview });
}
```

- [ ] **Step 3: Verify**

Logged in without a subscription: `POST /api/billing/portal` → 404. `GET /api/user/entitlement` → `{plan:'free', canCreateBoard:..., limit:1}`. (Portal happy path is covered in the Task 11 sandbox E2E.)

- [ ] **Step 4: Commit**

```bash
git add app/api/user/entitlement app/api/billing
git commit -m "feat(billing): entitlement read endpoint + Paddle customer portal session"
```

---

### Task 7: Client — typed 402, UpgradeModal with Paddle overlay checkout

**Files:**
- Create: `components/billing/UpgradeModal.tsx`
- Modify: `stores/boardStore.ts` (createBoard error handling — throw a typed error carrying the API `code`)
- Modify: `components/pages/HomePage.tsx` (create flow: route logged-out users to signup; open UpgradeModal on 402)

- [ ] **Step 1: Install paddle-js**

```bash
npm install @paddle/paddle-js
```

- [ ] **Step 2: Typed API error in the store**

In `stores/boardStore.ts`, add near the top:

```ts
export class ApiCodeError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiCodeError';
  }
}
```

In `createBoard` (the `fetch('/api/boards', ...)` call, ~line 105), replace the generic non-OK throw with:

```ts
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  throw new ApiCodeError(
    body.error ?? 'Failed to create board',
    body.code ?? 'UNKNOWN',
    res.status
  );
}
```

- [ ] **Step 3: UpgradeModal**

```tsx
// components/billing/UpgradeModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** The 402 message from the server, shown verbatim for context. */
  reason?: string;
}

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const { user } = useAuthStore();
  const [paddle, setPaddle] = useState<Paddle | null>(null);

  useEffect(() => {
    if (!open || paddle) return;
    initializePaddle({
      environment:
        process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
    }).then((p) => setPaddle(p ?? null));
  }, [open, paddle]);

  const handleUpgrade = () => {
    if (!paddle || !user) return;
    paddle.Checkout.open({
      items: [{ priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID!, quantity: 1 }],
      customer: { email: user.email },
      customData: { userId: user.id }, // REQUIRED — the webhook attributes by this
      settings: { successUrl: `${window.location.origin}/dashboard?upgraded=true` },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Upgrade to RetroBoard Pro">
      <div className="flex flex-col gap-4">
        {reason && <p className="text-sm text-[var(--ink-3)]">{reason}</p>}
        <div className="rounded-[var(--r-lg)] border border-[var(--line)] p-4">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[var(--ink)]">$3.99</span>
            <span className="text-sm text-[var(--ink-3)]">/month</span>
          </div>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-[var(--ink-2)]">
            <li>Unlimited active boards</li>
            <li>Unlimited participants — they never pay or sign up</li>
            <li>All views, facilitation tools, and exports</li>
            <li>Cancel anytime</li>
          </ul>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Not now</Button>
          <Button onClick={handleUpgrade} disabled={!paddle}>Upgrade — $3.99/mo</Button>
        </div>
      </div>
    </Modal>
  );
}
```

(If `Modal`'s prop is `isOpen` rather than `open`, match the existing component's API — check `components/common/Modal.tsx` and keep this file consistent with its siblings.)

- [ ] **Step 4: HomePage create flow**

In `components/pages/HomePage.tsx`:
1. Add state: `const [upgradeOpen, setUpgradeOpen] = useState(false);` and `const [upgradeReason, setUpgradeReason] = useState<string | undefined>();`
2. In the create handler's `catch` (currently `console.error` around line 66):

```ts
catch (err) {
  if (err instanceof ApiCodeError && err.code === 'BOARD_LIMIT_REACHED') {
    setUpgradeReason(err.message);
    setUpgradeOpen(true);
    return;
  }
  if (err instanceof ApiCodeError && err.code === 'AUTH_REQUIRED') {
    router.push('/signup?redirect=create');
    return;
  }
  console.error('Failed to create board:', err);
}
```

3. Render `<UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason} />` at the end of the page component.
4. Imports: `import { ApiCodeError } from '@/stores/boardStore';` and `import { UpgradeModal } from '@/components/billing/UpgradeModal';`

Optional fast-path: if the auth store already knows the user is logged out, send them to `/signup?redirect=create` on CTA click instead of letting the POST 401.

- [ ] **Step 5: Verify in the browser (sandbox)**

- Logged out → create CTA → lands on signup.
- Logged in at the 1-board limit → create → UpgradeModal opens → "Upgrade" opens the Paddle sandbox overlay → pay with Paddle's test card `4242 4242 4242 4242` (any future expiry, any CVC) → redirected to `/dashboard?upgraded=true`. (Webhook→entitlement flip completes on the preview deployment in Task 11.)

- [ ] **Step 6: Run checks and commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add components/billing stores/boardStore.ts components/pages/HomePage.tsx package.json package-lock.json
git commit -m "feat(billing): UpgradeModal with Paddle overlay checkout + typed 402 handling"
```

---

### Task 8: Pricing section on the homepage + plan badge on dashboard (fixes C7, right-sized)

**Files:**
- Create: `components/pages/PricingSection.tsx`
- Modify: `components/pages/HomePage.tsx` (render it after the feature blurbs)
- Modify: `components/pages/DashboardPage.tsx` (plan badge + Manage billing / Upgrade)
- Modify: `app/login/page.tsx:164-165` ("Sign up free" → "Sign up")

- [ ] **Step 1: PricingSection**

```tsx
// components/pages/PricingSection.tsx
'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';

const FREE_FEATURES = [
  '1 active board — run a full retro cycle, free forever',
  'Unlimited anonymous participants',
  'All 4 views, voting, timer, action items',
  'Markdown & CSV export',
];

const PRO_FEATURES = [
  'Unlimited active boards',
  'Everything in Free',
  'Support a one-person indie tool',
  'Cancel anytime',
];

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-4xl px-4 py-16">
      <h2 className="text-center text-2xl font-bold text-[var(--ink)]">
        Simple pricing. Participants never pay.
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-[var(--ink-3)]">
        Joining a retro never requires an account or a dime. Creators get one free
        active board, and unlimited boards cost less than a coffee — most retro
        tools charge $25–64/month for a team this size.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          { name: 'Free', price: '$0', features: FREE_FEATURES, cta: 'Start free', highlight: false },
          { name: 'Pro', price: '$3.99', features: PRO_FEATURES, cta: 'Go unlimited', highlight: true },
        ].map((tier) => (
          <div
            key={tier.name}
            className={
              tier.highlight
                ? 'rounded-[var(--r-xl)] border-2 border-[var(--accent)] bg-[var(--bg-elev)] p-6'
                : 'rounded-[var(--r-xl)] border border-[var(--line)] bg-[var(--bg-elev)] p-6'
            }
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-3)]">
              {tier.name}
            </h3>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-[var(--ink)]">{tier.price}</span>
              <span className="text-sm text-[var(--ink-3)]">/month</span>
            </div>
            <ul className="mt-4 flex flex-col gap-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--ink-2)]">
                  <Check size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={
                tier.highlight
                  ? 'mt-6 block rounded-[var(--r-md)] bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)] transition-colors'
                  : 'mt-6 block rounded-[var(--r-md)] border border-[var(--line)] px-4 py-2.5 text-center text-sm font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)] transition-colors'
              }
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
```

Render in `HomePage.tsx` after the existing feature blurbs: `<PricingSection />` (import it). Add a "Pricing" anchor link wherever the page nav/CTA area is.

- [ ] **Step 2: Dashboard plan state**

In `components/pages/DashboardPage.tsx`:
1. Fetch `/api/user/entitlement` in a `useEffect`, store in local state.
2. Next to the dashboard heading render a badge: `Pro` (plan==='paid'), `Comped` (plan==='comped'), or `Free — {activeBoards}/{limit} active` (plan==='free').
3. Free: an "Upgrade" button opening `UpgradeModal` (already built). Paid: "Manage billing" button:

```ts
const openPortal = async () => {
  const res = await fetch('/api/billing/portal', { method: 'POST' });
  if (res.ok) {
    const { url } = await res.json();
    window.open(url, '_blank', 'noopener');
  }
};
```

4. Keep it small — a badge and one button, not a billing page.

- [ ] **Step 3: Copy fix**

`app/login/page.tsx` lines 164–165: change the link text `Sign up free` → `Sign up`.

- [ ] **Step 4: Verify in the browser**

Homepage shows the pricing section at 375px and 1280px without layout breakage; dashboard badge reflects free/comped/paid states (toggle by inserting/removing your email in `free_access`); login copy updated.

- [ ] **Step 5: Run checks and commit**

```bash
git add components/pages/PricingSection.tsx components/pages/HomePage.tsx components/pages/DashboardPage.tsx app/login/page.tsx
git commit -m "feat(billing): pricing section, dashboard plan badge, accurate signup copy"
```

---

### Task 9: Terms, Privacy, Refund/AUP pages + site footer with support & abuse links

**Files:**
- Create: `app/terms/page.tsx`, `app/privacy/page.tsx`
- Create: `components/Layout/SiteFooter.tsx`
- Modify: `components/pages/HomePage.tsx` (render footer)

- [ ] **Step 1: Legal pages**

Both pages are static server components, same shell:

```tsx
// app/terms/page.tsx
export const metadata = { title: 'Terms of Service — RetroBoard' };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-[var(--ink-2)]">
      <h1 className="text-2xl font-bold text-[var(--ink)]">Terms of Service</h1>
      <p className="mt-1 text-sm text-[var(--ink-3)]">Last updated: June 2026</p>

      <h2 className="mt-8 text-lg font-semibold text-[var(--ink)]">The service</h2>
      <p className="mt-2 text-sm leading-6">
        RetroBoard (retroboard.live) is a real-time retrospective board operated by a
        single developer. Participants may join boards anonymously without an account.
        Creating boards requires an account; unlimited boards require a paid
        subscription ($3.99/month) processed by Paddle.com, our merchant of record.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Subscriptions & refunds</h2>
      <p className="mt-2 text-sm leading-6">
        Subscriptions renew monthly and can be cancelled anytime from the billing
        portal; access continues to the end of the paid period. If a subscription
        lapses, boards beyond the free plan's limit become read-only after a 14-day
        grace period — board content is never deleted because of a lapse. Unhappy?
        Email us within 14 days of any charge for a full refund, no questions asked.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Acceptable use</h2>
      <p className="mt-2 text-sm leading-6">
        Don't use RetroBoard to post unlawful, harassing, or malicious content, to
        spam, or to probe or disrupt the service. Boards are user-generated content;
        we may remove content or boards that violate these terms and may suspend
        accounts used for abuse. Report abusive content to{' '}
        <a href="mailto:support@retroboard.live" className="text-[var(--accent)]">
          support@retroboard.live
        </a>.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Your data</h2>
      <p className="mt-2 text-sm leading-6">
        You own your board content. You can export boards (Markdown/CSV) and delete
        boards at any time; deleted boards are purged within 30 days. See the{' '}
        <a href="/privacy" className="text-[var(--accent)]">Privacy Policy</a> for
        what we store and how to erase it.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Liability</h2>
      <p className="mt-2 text-sm leading-6">
        The service is provided "as is" without warranties. To the maximum extent
        permitted by law, our total liability for any claim is limited to the amount
        you paid in the three months before the claim.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Contact</h2>
      <p className="mt-2 text-sm leading-6">
        <a href="mailto:support@retroboard.live" className="text-[var(--accent)]">
          support@retroboard.live
        </a>
      </p>
    </main>
  );
}
```

```tsx
// app/privacy/page.tsx
export const metadata = { title: 'Privacy Policy — RetroBoard' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-[var(--ink-2)]">
      <h1 className="text-2xl font-bold text-[var(--ink)]">Privacy Policy</h1>
      <p className="mt-1 text-sm text-[var(--ink-3)]">Last updated: June 2026</p>

      <h2 className="mt-8 text-lg font-semibold text-[var(--ink)]">What we store</h2>
      <p className="mt-2 text-sm leading-6">
        Account holders: email, display name, and a hashed password (via Better
        Auth). Participants: the display name you type when joining a board and the
        cards, votes, and reactions you create. Board content is free text — don't
        post anything you wouldn't want the rest of your board to see. We do not
        sell data or run third-party advertising.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Payments</h2>
      <p className="mt-2 text-sm leading-6">
        Payments are processed by Paddle.com as merchant of record. We never see or
        store card numbers; Paddle shares your email and subscription status with us.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Processors</h2>
      <p className="mt-2 text-sm leading-6">
        Vercel (hosting), Neon (database), Ably (realtime messaging), Cloudflare
        Turnstile (anti-bot), Paddle (payments), Resend (transactional email).
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Retention & deletion</h2>
      <p className="mt-2 text-sm leading-6">
        Boards you delete go to Trash and are permanently purged after 30 days.
        Deleting your account removes your login; to also erase board content you
        authored, email{' '}
        <a href="mailto:support@retroboard.live" className="text-[var(--accent)]">
          support@retroboard.live
        </a>{' '}
        and we will scrub it within 30 days. You can export your boards (Markdown/CSV)
        at any time.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Cookies</h2>
      <p className="mt-2 text-sm leading-6">
        We use a session cookie for signed-in accounts and browser storage for
        anonymous participant identity. No tracking cookies.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-[var(--ink)]">Contact</h2>
      <p className="mt-2 text-sm leading-6">
        Data questions or erasure requests:{' '}
        <a href="mailto:support@retroboard.live" className="text-[var(--accent)]">
          support@retroboard.live
        </a>
      </p>
    </main>
  );
}
```

⚠️ Note for Jordan in the PR description: template language, not legal advice — read both pages before flipping live. The manual-erasure promise in Privacy is honest about today's behavior; the automated `afterDelete` scrub is a Phase 1 item.

- [ ] **Step 2: Footer**

```tsx
// components/Layout/SiteFooter.tsx
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] px-4 py-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--ink-4)]">
        <span>© {new Date().getFullYear()} RetroBoard</span>
        <Link href="/#pricing" className="hover:text-[var(--ink-2)]">Pricing</Link>
        <Link href="/terms" className="hover:text-[var(--ink-2)]">Terms</Link>
        <Link href="/privacy" className="hover:text-[var(--ink-2)]">Privacy</Link>
        <a href="mailto:support@retroboard.live" className="hover:text-[var(--ink-2)]">Support</a>
        <a href="mailto:support@retroboard.live?subject=Abuse%20report" className="hover:text-[var(--ink-2)]">Report abuse</a>
      </div>
    </footer>
  );
}
```

Render at the bottom of `HomePage.tsx`. (Board pages stay footer-free — no chrome in the working surface.)

- [ ] **Step 3: Stand up the support address (Jordan, manual)**

Create `support@retroboard.live` as an alias/forward to Gmail (domain DNS). Refund stance per review: $3.99 = refund-on-request, never fight a dispute.

- [ ] **Step 4: Verify, commit**

Both pages render at `/terms` and `/privacy` (light + dark). Footer links work.

```bash
git add app/terms app/privacy components/Layout/SiteFooter.tsx components/pages/HomePage.tsx
git commit -m "feat(launch): terms, privacy, refund/AUP, footer with support + abuse contacts"
```

---

### Task 10: Allowlist admin vertical (`/admin/free-access`)

**Files:**
- Create: `app/api/admin/free-access/route.ts`
- Create: `app/admin/free-access/page.tsx`
- Create: `components/pages/admin/AdminFreeAccessPage.tsx`
- Modify: `components/Admin/AdminSidebar.tsx` (nav item)

**Precondition:** Phase 0A Task 1/2 merged (`requireSystemAdmin` exists and admin APIs are gated).

- [ ] **Step 1: API**

```ts
// app/api/admin/free-access/route.ts
import { sql } from '@/lib/db';
import { requireSystemAdmin, authzErrorResponse } from '@/lib/auth-helpers';

async function guard(): Promise<Response | null> {
  try {
    await requireSystemAdmin();
    return null;
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return Response.json(r.body, { status: r.status });
    throw e;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const entries = await sql`SELECT * FROM free_access ORDER BY created_at DESC`;
  return Response.json({ entries });
}

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const { email, note } = await request.json();
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return Response.json({ error: 'Valid email required' }, { status: 400 });
  }
  await sql`
    INSERT INTO free_access (email, note)
    VALUES (${email.toLowerCase().trim()}, ${note ?? null})
    ON CONFLICT (email) DO UPDATE SET note = EXCLUDED.note
  `;
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const { email } = await request.json();
  if (typeof email !== 'string') {
    return Response.json({ error: 'email required' }, { status: 400 });
  }
  await sql`DELETE FROM free_access WHERE email = ${email.toLowerCase().trim()}`;
  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Page (clone of the feature-flags vertical, local state — no new store)**

```tsx
// app/admin/free-access/page.tsx
import { AdminFreeAccessPage } from '@/components/pages/admin/AdminFreeAccessPage';

export const dynamic = 'force-dynamic';

export default function AdminFreeAccess() {
  return <AdminFreeAccessPage />;
}
```

```tsx
// components/pages/admin/AdminFreeAccessPage.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trash2, Info } from 'lucide-react';

interface Entry {
  email: string;
  note: string | null;
  created_at: string;
}

export function AdminFreeAccessPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/free-access');
    if (res.ok) setEntries((await res.json()).entries);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/free-access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, note }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Failed to add');
      return;
    }
    setEmail('');
    setNote('');
    refresh();
  };

  const handleRemove = async (target: string) => {
    await fetch('/api/admin/free-access', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: target }),
    });
    refresh();
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--color-gray-8)]">Free Access</h1>
      <p className="mt-1 text-sm text-[var(--color-gray-5)]">
        Emails on this list get full Pro access, free, forever. Works before they sign up.
      </p>

      <form onSubmit={handleAdd} className="mt-6 flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@example.com"
          className="w-64 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (e.g. F3 guys)"
          className="w-48 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <button
          type="submit"
          className="rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Add
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-[var(--color-dark-red)]">{error}</p>}

      {loading ? (
        <div className="mt-6 text-sm text-[var(--color-gray-5)]">Loading…</div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {entries.length === 0 && (
            <p className="text-sm text-[var(--color-gray-5)]">No one on the list yet.</p>
          )}
          {entries.map((entry) => (
            <div
              key={entry.email}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-[var(--color-gray-8)]">{entry.email}</div>
                {entry.note && <div className="text-xs text-[var(--color-gray-5)]">{entry.note}</div>}
              </div>
              <button
                onClick={() => handleRemove(entry.email)}
                aria-label={`Remove ${entry.email}`}
                className="rounded-[var(--radius-md)] p-2 text-[var(--color-gray-5)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-dark-red)] transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-info)]/10 px-4 py-3 text-sm text-[var(--color-info)]">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Entries are matched against the account email at board creation. Adding an
          email before that person signs up works — they get Pro the moment they register.
        </span>
      </div>
    </div>
  );
}
```

Sidebar — in `components/Admin/AdminSidebar.tsx`, extend `navItems` and the lucide import:

```ts
import { LayoutDashboard, Flag, Kanban, Settings, ArrowLeft, LogOut, Gift } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/features', label: 'Feature Flags', icon: Flag },
  { href: '/admin/boards', label: 'Boards', icon: Kanban },
  { href: '/admin/free-access', label: 'Free Access', icon: Gift },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];
```

- [ ] **Step 3: Verify**

As admin: add an email → appears in list → that account can create unlimited boards (dashboard badge reads "Comped") → remove → reverts to free. Logged out: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/free-access` → 401.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/free-access app/admin/free-access components/pages/admin/AdminFreeAccessPage.tsx components/Admin/AdminSidebar.tsx
git commit -m "feat(billing): free-access allowlist with admin console management"
```

---

### Task 11: Sandbox end-to-end on the preview deployment

- [ ] **Step 1: Deploy the branch** (Vercel preview builds automatically on push; feature branches don't auto-deploy to develop/prod). Set the sandbox Paddle env vars in Vercel Preview scope. Point the Paddle sandbox webhook destination at `https://<preview-url>/api/webhooks/paddle`.
- [ ] **Step 2: Full money-path E2E on the preview:**
  1. Fresh account → create board #1 (free) → attempt board #2 → UpgradeModal.
  2. Upgrade with test card `4242 4242 4242 4242` → overlay success → redirected to dashboard.
  3. Within ~seconds the webhook lands: `SELECT * FROM subscriptions;` shows the row with `status='active'` and your `user_id`.
  4. Create board #2 → succeeds. Dashboard badge = Pro. "Manage billing" opens the Paddle portal.
  5. Cancel in the portal → webhook updates status → (entitlement remains through period end + grace, per D3 — confirm `canceled_at`/`current_period_end` populated).
  6. Paddle dashboard → resend a webhook event → row unchanged (idempotent upsert).
- [ ] **Step 3: Record results in the PR description** (this is the verification evidence — include the SQL output and screenshots of the modal/overlay/badge).

---

### Task 12: Pre-flip dashboard banner + the flip checklist

**Files:**
- Modify: `components/pages/DashboardPage.tsx` (banner)

- [ ] **Step 1: Banner (temporary by design — delete after the flip window)**

Add above the dashboard board grid:

```tsx
<div className="mb-4 rounded-[var(--r-md)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink-2)]">
  <strong>Heads up:</strong> RetroBoard is becoming a paid product. From{' '}
  <strong>July&nbsp;1, 2026</strong>, creating boards requires an account, with 1 free
  active board and unlimited boards for $3.99/mo. Nothing you've already created is
  affected — existing boards stay exactly as they are.{' '}
  <a href="/#pricing" className="text-[var(--accent)] underline">See pricing</a>
</div>
```

(Adjust the date to the real flip date — 1–2 weeks after this branch reaches prod, per D2.)

- [ ] **Step 2: THE FLIP CHECKLIST (Jordan, manual, on flip day)**

1. Vercel project on **Pro** (done in prereqs — verify).
2. Paddle **live** account approved; live product+price created; live env vars set in Vercel Production (`NEXT_PUBLIC_PADDLE_ENV=production`); live webhook destination → `https://retroboard.live/api/webhooks/paddle`.
3. Seed the allowlist: `/admin/free-access` → add every existing registered owner's email (D2 — manual seeding IS the migration; pull the list with `SELECT email FROM "user";`).
4. Verify `/terms` + `/privacy` live; support@ alias receiving.
5. Merge develop → main per the deploy pipeline (`/deploy-check` first).
6. Post-flip smoke on prod: anonymous join still frictionless on an existing board; logged-out create → signup; live checkout with a real card ($3.99, then refund yourself from the Paddle dashboard to test the refund path).
7. Remove the banner in a follow-up commit.

- [ ] **Step 3: Commit**

```bash
git add components/pages/DashboardPage.tsx
git commit -m "feat(billing): pre-flip announcement banner on dashboard"
```

---

### Task 13: Ship the branch

- [ ] `npx tsc --noEmit && npm run build && npm test` (not under a live dev server).
- [ ] Push, `gh pr create` → develop. PR description: Task 11 E2E evidence + the ⚠️ legal-copy review note from Task 9.
- [ ] Jordan reviews → `/deploy-check` → merge. Flip to prod only via the Task 12 checklist.

**Definition of done:** the full sandbox money path (free limit → modal → checkout → webhook → entitled → portal cancel) verified on the preview deployment with evidence in the PR; allowlist grants/revokes Pro in the browser; terms/privacy/footer live; zero participant-facing routes gated.
