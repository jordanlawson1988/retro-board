# Retro Board Commercialization — Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Retro Board from a free personal tool into a subscription SaaS product with user accounts, board ownership, $4.99/mo Pro tier, enhanced export, and a user dashboard.

**Architecture:** Authenticated users own boards and manage subscriptions. Anonymous participants still join via link (zero-friction). Better Auth Stripe plugin handles billing. New `/dashboard` page replaces localStorage-based board history for authenticated users.

**Tech Stack:** Next.js 16 (App Router), Better Auth + Stripe plugin, Neon Postgres, Ably, Zustand, @react-pdf/renderer, html-to-image, Stripe

---

## Workstream Dependency Graph

```
WS1: User Accounts ──────────┐
                              ├── WS3: Stripe Billing
WS2: Board Ownership ────────┤
                              ├── WS5: Dashboard & UX Polish
                              │
WS4: Enhanced Export ─────────┤ (gates behind WS3 for Pro tier)
                              │
WS6: Landing Page ────────────┘ (conversion flow references all above)

WS7: AI Assistant ──────────── (independent, future workstream)
```

## Workstreams

| # | Name | Plan File | Depends On | Status |
|---|------|-----------|------------|--------|
| 1 | User Accounts & Auth Expansion | [WS1-WS2](./2026-03-27-ws1-ws2-user-accounts-ownership.md) | None | Not started |
| 2 | Board Ownership & Access Control | [WS1-WS2](./2026-03-27-ws1-ws2-user-accounts-ownership.md) | None | Not started |
| 3 | Stripe Subscription & Billing | [WS3](./2026-03-27-ws3-stripe-billing.md) | WS1 | Not started |
| 4 | Enhanced Export | [WS4](./2026-03-27-ws4-enhanced-export.md) | WS1 (gated by WS3) | Not started |
| 5 | Dashboard & UX Polish | [WS5-WS6](./2026-03-27-ws5-ws6-dashboard-landing.md) | WS1, WS2, WS3 | Not started |
| 6 | Landing Page & Conversion | [WS5-WS6](./2026-03-27-ws5-ws6-dashboard-landing.md) | WS1, WS3 | Not started |
| 7 | AI Assistant Support | [WS7](./2026-03-27-ws7-ai-assistant.md) | None (independent) | Placeholder |

## Pricing Model (Locked)

| Tier | Price | Board Limit | Export | Key Features |
|------|-------|-------------|--------|-------------|
| **Free** | $0 | 3 active boards | Markdown, CSV | Unlimited participants, all templates, board history |
| **Pro** | $4.99/mo | Unlimited | + PDF, Image, Print | Everything free + enhanced export, priority features |

## Database Migration Sequence

Migrations are applied in order across workstreams. Each migration file is additive (no destructive changes to existing tables).

1. `scripts/migrations/002_user_accounts.sql` — WS1: Add `owner_id` to boards, `user_id` to participants
2. `scripts/migrations/003_board_access.sql` — WS2: `board_members`, `board_invites` tables
3. `scripts/migrations/004_stripe_billing.sql` — WS3: Better Auth Stripe plugin auto-creates subscription tables; this migration adds `subscription_tier` view

## New Dependencies

```bash
# WS1: No new deps (Better Auth already installed)
# WS3: Stripe billing
npm install @better-auth/stripe stripe
# WS4: Export
npm install @react-pdf/renderer html-to-image react-to-print
```

## Key Design Decisions

1. **$4.99/mo, not $9.99** — Jordan's call. Lower friction > higher margin.
2. **Participants stay anonymous** — Zero-friction joining is the differentiator. Only board *creators* need accounts.
3. **No organization/team model yet** — WS7 future. Keep it simple: user owns boards directly.
4. **Better Auth Stripe plugin** — First-party integration handles 80% of billing plumbing.
5. **No test framework yet** — Plans include setup guidance but don't enforce TDD until Vitest is configured.
6. **Feature flags gate rollout** — New commercial features can be gated behind existing feature_flags system.
