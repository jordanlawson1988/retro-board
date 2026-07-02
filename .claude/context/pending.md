# Pending Work — Retro Board

> Read by session-quickstart-protocol Step 3. Last updated: 2026-06-09

## SaaS Readiness Review — ✅ COMPLETED 2026-06-09

The 11-agent review ran (workflow `wf_7d621ed6-126`, ~1.04M tokens; 9/10 Criticals adversarially confirmed, 0 refuted). **Report: `docs/superpowers/specs/2026-06-09-saas-readiness-review.md`** — Jordan has NOT yet read/acted on it.

**Decisions LOCKED 2026-06-10 (Jordan, via AskUserQuestion):**
- **D0:** Paddle MoR (Lemon Squeezy rejected — mid-absorption into invite-only Stripe Managed Payments). @better-auth/stripe path obsolete; no better-auth upgrade needed.
- **D1:** Free tier = 1 active board (`FREE_ACTIVE_BOARD_LIMIT` constant in `lib/entitlements.ts`).
- **D2:** Grandfather per report §5.5 (nothing retroactively locked; seed existing owners into allowlist manually).
- **D3:** Lapse = read-only after 14-day grace (encoded in entitlement states; board-locking enforcement deferred — zero subscribers at launch).

**Phase 0 plans written 2026-06-10 (awaiting execution):**
- `docs/superpowers/plans/2026-06-10-phase0-security-hardening.md` (Plan A — first; no prereqs but Upstash account)
- `docs/superpowers/plans/2026-06-10-phase0-billing-paddle.md` (Plan B — depends on A Task 1; Jordan prereqs: Vercel Pro, Paddle sandbox+live accounts, env vars — START PADDLE VERIFICATION EARLY)
- `docs/superpowers/plans/2026-06-10-phase0-design-blockers.md` (Plan C — independent; Jordan prereq: Resend domain verification)

Headline: 7 distinct Criticals, all launch blockers — unauthenticated `/api/admin/*`, unscoped Ably tokens, no billing/entitlement/conversion surface, anonymous-creation paywall bypass, Vercel Hobby commercial prohibition. ~1.5–2.5 weeks of Phase-0 work. Break-even ≈ 7 subscribers.

Note: the plans-reader agent's "WS3/WS4 shipped" claims were wrong (refuted by code verification) — trust the report's reconciliation table, not older plan-status notes.

## Other open items (pre-existing)

- Board Management v1 shipped to prod WITHOUT browser verification — needs a human eyeball (2026-05-22).
- Password reset / email verification — needs an email sender, none installed.
- Retroactive linking + claim anonymous participation — not started.
