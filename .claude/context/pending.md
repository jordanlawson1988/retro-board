# Pending Work — Retro Board

> Read by session-quickstart-protocol Step 3. Last updated: 2026-09-04

**Start here:** `.claude/context/session-handoff.md` (full state, decisions, next actions as of 2026-09-04).

## Go paid — checklist written 2026-09-03

**Source of truth: `docs/superpowers/plans/2026-09-03-go-paid-checklist.md`** (supersedes the prereq block in the June billing plan where they disagree).

Verified 2026-09-03: Vercel team is on **Pro** (C6 done). Phase 0A security + 0C legal/footer/password-reset are live in prod. `feature/phase0-billing` has Tasks 1–4 (4 commits, 32 behind develop, rebase first). Migration 010 applied to prod (0 rows). Still open in prod: anonymous board creation (C4), no Paddle, no allowlist UI, email verification off for all 8 users.

**Three decisions Jordan must confirm before build resumes:**
1. Price: **CONFIRMED 2026-09-04: $4.99/mo flat, unlimited boards and unlimited team members** (one plan, no per-seat). Update app/terms + app/refunds copy ($3.99 today) when the billing branch resumes.
2. Free tier: 1 active board (built) vs 1 lifetime board (Aug 21 ask, needs `boards_created` counter, ~half day). Recommended lifetime.
3. Comp the 4 existing owners into `free_access` (June D2) or not. Recommended not.

**Jordan manual prereqs (none done):** Paddle sandbox + LIVE verification (long pole, start immediately), product/price/client token/webhook secret, env vars in Vercel + .env.local, confirm support@retroboard.live delivers.

**Code remaining:** rebase; optional lifetime-counter migration; billing plan Tasks 5–8, 10–13 (Task 9 already live); email verification before honoring allowlist. ≈ 2–3 focused dev days.

Older decisions (2026-06-10): D0 Paddle MoR, D3 lapse = read-only after 14-day grace. Review report: `docs/superpowers/specs/2026-06-09-saas-readiness-review.md`.

## Post-paywall build plan (2026-09-04 competitive gap analysis)

Spec: `docs/superpowers/specs/2026-09-04-competitive-gap-analysis.md`; evidence `docs/research/2026-09-04-competitive/`. Wave 1 (~13 dev days, same month as the flip): AI summary/groups/actions, action carry-over + tracker, Jira push, Slack/Teams share, 25-30 templates + save-as-template, PDF export, Google/Microsoft sign-in. Wave 2 (~20 dev days): guided facilitation, icebreakers + pulse, team spaces/history, async mode, comments/mentions/images, email summary, localization (ES/PT first). Deferred until a buyer asks: SSO/SCIM/audit/SOC 2, API/Zapier, canvas/poker/standups, native apps.

## Other open items (pre-existing)

- Board Management v1 shipped to prod WITHOUT browser verification — needs a human eyeball (2026-05-22).
- Retroactive linking + claim anonymous participation — not started.
- Post-flip fast-follows: Sentry + uptime ping, funnel analytics, better-auth bump + dependabot PRs, annual price.
