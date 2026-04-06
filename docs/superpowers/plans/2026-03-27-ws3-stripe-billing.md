# WS3: Stripe Subscription & Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add $4.99/mo Pro subscription with free tier (3 active boards). Better Auth Stripe plugin handles customer creation, checkout, webhooks, and billing portal.

**Architecture:** Better Auth's first-party `@better-auth/stripe` plugin auto-creates Stripe customers on signup, manages subscription lifecycle via webhooks, and provides client-side helpers for checkout and billing portal. Usage enforcement happens in the board creation API route.

**Tech Stack:** @better-auth/stripe, stripe SDK, Neon Postgres, Next.js 16 App Router

**Depends on:** WS1 (User Accounts) must be complete — users must exist before billing can attach.

---

## Prerequisites

Before starting this workstream:

1. **Stripe account created** at stripe.com
2. **Stripe API keys** available (publishable + secret)
3. **Stripe product + price created** in Stripe Dashboard:
   - Product: "RetroBoard Pro"
   - Price: $4.99/month recurring
   - Note the `price_id` (e.g., `price_1ABC...`)
4. **Stripe webhook endpoint** configured in Stripe Dashboard:
   - URL: `https://your-domain.com/api/auth/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Note the webhook signing secret

## Environment Variables

Add to `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRO_PRICE_ID=price_...
```

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `app/pricing/page.tsx` | Pricing page server component |
| `components/pages/PricingPage.tsx` | Plan comparison + upgrade CTA |
| `components/Billing/UpgradeModal.tsx` | Modal shown when free tier limit hit |
| `components/Billing/UsageMeter.tsx` | Visual progress bar: "2/3 boards used" |
| `components/Billing/index.ts` | Barrel export |
| `app/settings/page.tsx` | Settings page wrapper |
| `app/settings/billing/page.tsx` | Billing management page |
| `components/pages/SettingsPage.tsx` | User settings + billing section |
| `app/api/user/usage/route.ts` | Current usage stats (board count, plan limits) |
| `lib/subscription.ts` | Subscription status helper (getPlanTier, canCreateBoard) |

### Modified Files
| File | Changes |
|------|---------|
| `lib/auth.ts` | Add Stripe plugin to Better Auth config |
| `lib/auth-client.ts` | Add Stripe plugin to client config |
| `app/api/boards/route.ts` | Add usage enforcement before board creation |
| `stores/authStore.ts` | Load subscription status on initialize |
| `components/pages/DashboardPage.tsx` | Add UsageMeter component |
| `components/pages/HomePage.tsx` | Show upgrade prompt when limit hit |

---

### Task 1: Install Dependencies

- [ ] **Step 1: Install Stripe packages**

Run: `npm install @better-auth/stripe stripe`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @better-auth/stripe and stripe SDK"
```

---

### Task 2: Configure Better Auth Stripe Plugin (Server)

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Add Stripe plugin to auth config**

Replace the entire file:

```typescript
import { betterAuth } from 'better-auth';
import { Pool } from '@neondatabase/serverless';
import { stripe } from '@better-auth/stripe';
import Stripe from 'stripe';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any = null;

function getAuth() {
  if (!_auth) {
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);

    _auth = betterAuth({
      database: new Pool({ connectionString: process.env.DATABASE_URL }),
      emailAndPassword: {
        enabled: true,
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
      },
      plugins: [
        stripe({
          stripeClient,
          stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
          createCustomerOnSignUp: true,
          subscription: {
            enabled: true,
            plans: [
              {
                name: 'pro',
                priceId: process.env.STRIPE_PRO_PRICE_ID!,
                limits: {
                  maxActiveBoards: 'unlimited',
                  pdfExport: true,
                  imageExport: true,
                },
              },
            ],
          },
        }),
      ],
    });
  }
  return _auth;
}

// Lazy proxy to avoid crashing at build time when DATABASE_URL is not set
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth = new Proxy({} as any, {
  get(_target, prop) {
    return Reflect.get(getAuth(), prop);
  },
}) as ReturnType<typeof betterAuth>;
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: add Better Auth Stripe plugin with Pro plan config"
```

---

### Task 3: Configure Better Auth Stripe Plugin (Client)

**Files:**
- Modify: `lib/auth-client.ts`

- [ ] **Step 1: Add Stripe plugin to client config**

Replace the entire file:

```typescript
import { createAuthClient } from 'better-auth/react';
import { stripeClient } from '@better-auth/stripe/client';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  plugins: [stripeClient()],
});
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth-client.ts
git commit -m "feat: add Stripe client plugin to Better Auth client"
```

---

### Task 4: Subscription Helper

**Files:**
- Create: `lib/subscription.ts`

- [ ] **Step 1: Create subscription status utilities**

```typescript
import { sql } from '@/lib/db';
import type { PlanTier } from '@/types';
import { PLAN_LIMITS } from '@/types';

/**
 * Determine a user's plan tier based on their subscription status.
 * Returns 'free' if no active subscription exists.
 */
export async function getPlanTier(userId: string): Promise<PlanTier> {
  // The Better Auth Stripe plugin creates a 'subscription' table automatically.
  // Query it to check for active/trialing subscriptions.
  const [sub] = await sql`
    SELECT status, plan FROM subscription
    WHERE "userId" = ${userId}
      AND status IN ('active', 'trialing')
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;

  if (sub && sub.plan === 'pro') return 'pro';
  return 'free';
}

/**
 * Count a user's active (non-archived) boards.
 */
export async function getActiveBoardCount(userId: string): Promise<number> {
  const [result] = await sql`
    SELECT COUNT(*) AS count FROM boards
    WHERE owner_id = ${userId} AND archived_at IS NULL
  `;
  return parseInt(result.count, 10);
}

/**
 * Check if a user can create a new board based on their plan.
 */
export async function canCreateBoard(userId: string): Promise<{ allowed: boolean; tier: PlanTier; activeBoards: number; limit: number }> {
  const tier = await getPlanTier(userId);
  const activeBoards = await getActiveBoardCount(userId);
  const limit = PLAN_LIMITS[tier].maxActiveBoards;

  return {
    allowed: activeBoards < limit,
    tier,
    activeBoards,
    limit: limit === Infinity ? -1 : limit,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/subscription.ts
git commit -m "feat: add subscription helper utilities (getPlanTier, canCreateBoard)"
```

---

### Task 5: Usage Enforcement in Board Creation

**Files:**
- Modify: `app/api/boards/route.ts`

- [ ] **Step 1: Add usage check before board creation**

Update the POST handler. After getting the session, before inserting the board, add:

```typescript
import { canCreateBoard } from '@/lib/subscription';

// ... inside POST handler, after getting session:

// Usage enforcement: check board limit for authenticated users
if (ownerId) {
  const usage = await canCreateBoard(ownerId);
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: 'Board limit reached',
        code: 'BOARD_LIMIT_REACHED',
        tier: usage.tier,
        activeBoards: usage.activeBoards,
        limit: usage.limit,
      },
      { status: 402 }
    );
  }
}
```

Note: Anonymous board creation (no ownerId) is not gated — anonymous boards are ephemeral and don't count toward limits.

- [ ] **Step 2: Commit**

```bash
git add app/api/boards/route.ts
git commit -m "feat: enforce board creation limit based on subscription tier"
```

---

### Task 6: User Usage API

**Files:**
- Create: `app/api/user/usage/route.ts`

- [ ] **Step 1: Create the usage endpoint**

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { canCreateBoard, getPlanTier } from '@/lib/subscription';

export async function GET() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const tier = await getPlanTier(userId);
  const usage = await canCreateBoard(userId);

  return NextResponse.json({
    tier,
    activeBoards: usage.activeBoards,
    boardLimit: usage.limit,
    canCreateBoard: usage.allowed,
  });
}
```

- [ ] **Step 2: Create directory**

Run: `mkdir -p app/api/user/usage`

- [ ] **Step 3: Commit**

```bash
git add app/api/user/usage/route.ts
git commit -m "feat: add /api/user/usage endpoint for plan and usage info"
```

---

### Task 7: Upgrade Modal Component

**Files:**
- Create: `components/Billing/UpgradeModal.tsx`
- Create: `components/Billing/UsageMeter.tsx`
- Create: `components/Billing/index.ts`

- [ ] **Step 1: Create UpgradeModal**

```typescript
// components/Billing/UpgradeModal.tsx
'use client';

import { useState } from 'react';
import { Zap, Check } from 'lucide-react';
import { Modal, Button } from '@/components/common';
import { authClient } from '@/lib/auth-client';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  activeBoards: number;
  boardLimit: number;
}

export function UpgradeModal({ open, onClose, activeBoards, boardLimit }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // Better Auth Stripe plugin handles checkout redirect
      await (authClient as any).subscription.upgrade({
        plan: 'pro',
        successUrl: `${window.location.origin}/dashboard?upgraded=true`,
        cancelUrl: window.location.href,
      });
    } catch (err) {
      console.error('Upgrade failed:', err);
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Upgrade to Pro" size="md">
      <div className="flex flex-col gap-6">
        <div className="rounded-lg bg-[var(--color-navy)]/5 p-4 text-center">
          <p className="text-sm text-[var(--color-gray-5)]">
            You&apos;ve used <strong>{activeBoards}</strong> of <strong>{boardLimit}</strong> free boards.
          </p>
          <p className="mt-1 text-sm text-[var(--color-gray-5)]">
            Upgrade to Pro for unlimited boards and more.
          </p>
        </div>

        <div className="rounded-lg border border-[var(--color-navy)]/20 p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-bold text-[var(--color-navy)]">Pro</h3>
            <div>
              <span className="text-2xl font-bold text-[var(--color-gray-8)]">$4.99</span>
              <span className="text-sm text-[var(--color-gray-5)]">/month</span>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {[
              'Unlimited retro boards',
              'PDF & image export',
              'Full board history',
              'Priority support',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-[var(--color-gray-7)]">
                <Check size={16} className="text-[var(--color-success)]" /> {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
          <Button onClick={handleUpgrade} loading={loading}>
            <Zap size={16} /> Upgrade to Pro
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Create UsageMeter**

```typescript
// components/Billing/UsageMeter.tsx
'use client';

import { Zap } from 'lucide-react';
import Link from 'next/link';

interface UsageMeterProps {
  activeBoards: number;
  boardLimit: number;
  tier: string;
}

export function UsageMeter({ activeBoards, boardLimit, tier }: UsageMeterProps) {
  if (tier === 'pro') return null; // Pro users don't need a meter

  const percentage = boardLimit > 0 ? Math.min((activeBoards / boardLimit) * 100, 100) : 0;
  const isNearLimit = activeBoards >= boardLimit - 1;

  return (
    <div className="rounded-xl border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--color-gray-5)]">
          Free Plan: {activeBoards}/{boardLimit} boards
        </span>
        <Link
          href="/pricing"
          className="flex items-center gap-1 text-[var(--color-navy)] hover:underline"
        >
          <Zap size={14} /> Upgrade
        </Link>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-gray-1)]">
        <div
          className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-[var(--color-error)]' : 'bg-[var(--color-navy)]'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create barrel export**

```typescript
// components/Billing/index.ts
export { UpgradeModal } from './UpgradeModal';
export { UsageMeter } from './UsageMeter';
```

- [ ] **Step 4: Commit**

```bash
git add components/Billing/UpgradeModal.tsx components/Billing/UsageMeter.tsx components/Billing/index.ts
git commit -m "feat: add UpgradeModal and UsageMeter billing components"
```

---

### Task 8: Pricing Page

**Files:**
- Create: `app/pricing/page.tsx`
- Create: `components/pages/PricingPage.tsx`

- [ ] **Step 1: Create server component wrapper**

```typescript
// app/pricing/page.tsx
import { PricingPage } from '@/components/pages/PricingPage';

export default function Page() {
  return <PricingPage />;
}
```

- [ ] **Step 2: Create pricing page component**

```typescript
// components/pages/PricingPage.tsx
'use client';

import { useState } from 'react';
import { Check, X, Zap } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Button } from '@/components/common';
import { authClient } from '@/lib/auth-client';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      { text: '3 active boards', included: true },
      { text: 'Unlimited participants', included: true },
      { text: 'All templates', included: true },
      { text: 'Markdown & CSV export', included: true },
      { text: 'Real-time collaboration', included: true },
      { text: 'PDF & image export', included: false },
      { text: 'Unlimited boards', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$4.99',
    period: '/month',
    features: [
      { text: 'Unlimited boards', included: true },
      { text: 'Unlimited participants', included: true },
      { text: 'All templates', included: true },
      { text: 'Markdown & CSV export', included: true },
      { text: 'Real-time collaboration', included: true },
      { text: 'PDF & image export', included: true },
      { text: 'Full board history', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
];

export function PricingPage() {
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      router.push('/signup');
      return;
    }

    setLoading(true);
    try {
      await (authClient as any).subscription.upgrade({
        plan: 'pro',
        successUrl: `${window.location.origin}/dashboard?upgraded=true`,
        cancelUrl: window.location.href,
      });
    } catch (err) {
      console.error('Upgrade failed:', err);
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[var(--color-gray-8)]">Simple, Transparent Pricing</h1>
          <p className="mt-3 text-lg text-[var(--color-gray-5)]">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border-2 p-8 ${
                plan.highlighted
                  ? 'border-[var(--color-navy)] shadow-lg'
                  : 'border-[var(--color-gray-1)]'
              }`}
            >
              <h2 className="text-xl font-bold text-[var(--color-gray-8)]">{plan.name}</h2>
              <div className="mt-2 flex items-baseline">
                <span className="text-4xl font-bold text-[var(--color-gray-8)]">{plan.price}</span>
                <span className="ml-1 text-[var(--color-gray-5)]">{plan.period}</span>
              </div>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-2 text-sm">
                    {feature.included ? (
                      <Check size={16} className="text-[var(--color-success)]" />
                    ) : (
                      <X size={16} className="text-[var(--color-gray-3)]" />
                    )}
                    <span className={feature.included ? 'text-[var(--color-gray-7)]' : 'text-[var(--color-gray-4)]'}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {plan.highlighted ? (
                  <Button className="w-full" onClick={handleUpgrade} loading={loading}>
                    <Zap size={16} /> {plan.cta}
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" onClick={() => router.push(isAuthenticated ? '/dashboard' : '/signup')}>
                    {plan.cta}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/pricing/page.tsx components/pages/PricingPage.tsx
git commit -m "feat: add pricing page with Free and Pro plan comparison"
```

---

### Task 9: Settings & Billing Page

**Files:**
- Create: `app/settings/page.tsx`
- Create: `app/settings/billing/page.tsx`
- Create: `components/pages/SettingsPage.tsx`

- [ ] **Step 1: Create settings page wrapper**

```typescript
// app/settings/page.tsx
import { SettingsPage } from '@/components/pages/SettingsPage';

export default function Page() {
  return <SettingsPage />;
}
```

- [ ] **Step 2: Create billing page wrapper**

```typescript
// app/settings/billing/page.tsx
import { SettingsPage } from '@/components/pages/SettingsPage';

export default function Page() {
  return <SettingsPage section="billing" />;
}
```

- [ ] **Step 3: Create SettingsPage component**

```typescript
// components/pages/SettingsPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { CreditCard, User, ExternalLink } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Button } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { authClient } from '@/lib/auth-client';

interface SettingsPageProps {
  section?: 'billing';
}

export function SettingsPage({ section }: SettingsPageProps) {
  const { user } = useAuthStore();
  const [usage, setUsage] = useState<{ tier: string; activeBoards: number; boardLimit: number } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch('/api/user/usage')
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {});
  }, []);

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      await (authClient as any).subscription.billingPortal({
        returnUrl: window.location.href,
      });
    } catch (err) {
      console.error('Portal failed:', err);
      setPortalLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-[var(--color-gray-8)]">Settings</h1>

        {/* Profile Section */}
        <section className="mt-8 rounded-xl border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-gray-8)]">
            <User size={20} /> Profile
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <span className="text-[var(--color-gray-5)]">Name:</span>{' '}
              <span className="text-[var(--color-gray-8)]">{user?.name}</span>
            </div>
            <div>
              <span className="text-[var(--color-gray-5)]">Email:</span>{' '}
              <span className="text-[var(--color-gray-8)]">{user?.email}</span>
            </div>
          </div>
        </section>

        {/* Billing Section */}
        <section className="mt-6 rounded-xl border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-gray-8)]">
            <CreditCard size={20} /> Billing
          </h2>
          {usage && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-gray-0)] p-4">
                <div>
                  <p className="font-medium text-[var(--color-gray-8)]">
                    {usage.tier === 'pro' ? 'Pro Plan' : 'Free Plan'}
                  </p>
                  <p className="text-sm text-[var(--color-gray-5)]">
                    {usage.tier === 'pro'
                      ? '$4.99/month — Unlimited boards'
                      : `${usage.activeBoards}/${usage.boardLimit} boards used`}
                  </p>
                </div>
                {usage.tier === 'pro' ? (
                  <Button variant="secondary" size="sm" onClick={openBillingPortal} loading={portalLoading}>
                    <ExternalLink size={14} /> Manage
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => window.location.href = '/pricing'}>
                    Upgrade
                  </Button>
                )}
              </div>

              {usage.tier === 'pro' && (
                <p className="text-xs text-[var(--color-gray-4)]">
                  Manage your subscription, payment methods, and invoices through the Stripe billing portal.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/settings/page.tsx app/settings/billing/page.tsx components/pages/SettingsPage.tsx
git commit -m "feat: add settings page with billing management"
```

---

### Task 10: Handle Board Creation Limit in UI

**Files:**
- Modify: `stores/boardStore.ts`
- Modify: `components/pages/HomePage.tsx`

- [ ] **Step 1: Update boardStore.createBoard to handle 402 response**

In `stores/boardStore.ts`, update the error handling in `createBoard` (around line 118-121):

```typescript
    if (!res.ok) {
      const err = await res.json();
      if (res.status === 402) {
        throw new Error(JSON.stringify({ code: 'BOARD_LIMIT_REACHED', ...err }));
      }
      throw new Error(err.error || 'Failed to create board');
    }
```

- [ ] **Step 2: Update HomePage to show upgrade modal on limit**

In `components/pages/HomePage.tsx`, add state and import for the upgrade modal. In the `handleCreate` catch block, check for `BOARD_LIMIT_REACHED`:

```typescript
import { UpgradeModal } from '@/components/Billing';

// Add state:
const [showUpgradeModal, setShowUpgradeModal] = useState(false);
const [usageInfo, setUsageInfo] = useState({ activeBoards: 0, boardLimit: 3 });

// In handleCreate catch:
} catch (err) {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed.code === 'BOARD_LIMIT_REACHED') {
        setUsageInfo({ activeBoards: parsed.activeBoards, boardLimit: parsed.limit });
        setShowUpgradeModal(true);
        return;
      }
    } catch { /* not JSON, fall through */ }
  }
  console.error('Failed to create board:', err);
}

// Add modal before closing tag:
<UpgradeModal
  open={showUpgradeModal}
  onClose={() => setShowUpgradeModal(false)}
  activeBoards={usageInfo.activeBoards}
  boardLimit={usageInfo.boardLimit}
/>
```

- [ ] **Step 3: Commit**

```bash
git add stores/boardStore.ts components/pages/HomePage.tsx
git commit -m "feat: show upgrade modal when free tier board limit reached"
```

---

### Task 11: Add UsageMeter to Dashboard

**Files:**
- Modify: `components/pages/DashboardPage.tsx`

- [ ] **Step 1: Fetch usage data and render UsageMeter**

Add usage state and fetch in the DashboardPage component:

```typescript
import { UsageMeter } from '@/components/Billing';

// Add state:
const [usage, setUsage] = useState<{ tier: string; activeBoards: number; boardLimit: number } | null>(null);

// In the fetchBoards useEffect, also fetch usage:
const usageRes = await fetch('/api/user/usage');
if (usageRes.ok) {
  setUsage(await usageRes.json());
}

// Add UsageMeter after the board grid, before the closing </div>:
{usage && (
  <UsageMeter
    activeBoards={usage.activeBoards}
    boardLimit={usage.boardLimit}
    tier={usage.tier}
  />
)}
```

- [ ] **Step 2: Commit**

```bash
git add components/pages/DashboardPage.tsx
git commit -m "feat: add usage meter to dashboard"
```

---

### Task 12: Verify and Test

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual smoke test checklist**

1. Sign up new user → Stripe customer created (check Stripe Dashboard)
2. Create 3 boards → all succeed
3. Try to create 4th board → upgrade modal appears
4. Click "Upgrade to Pro" → redirects to Stripe Checkout
5. Complete test payment → redirected to /dashboard with `?upgraded=true`
6. Create boards beyond limit → now works
7. Visit /settings → billing section shows "Pro Plan" with "Manage" button
8. Click "Manage" → opens Stripe Customer Portal
9. Visit /pricing → see plan comparison

- [ ] **Step 4: Commit any fixes**
