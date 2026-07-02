# SaaS Readiness Review — Resume Document

> **Status: APPROVED-ON-RESUME, NOT YET DISPATCHED.** Jordan asked for this plan to be saved so he can start a fresh session and say **"Go ahead and resume."** That phrase counts as explicit approval of the dispatch table below (per agent-approval-gate's approval words). If Jordan modifies anything, re-brief and re-confirm before dispatching.
>
> Created: 2026-06-09 · Session context: Jordan ran `/effort ultracode` before requesting this review.

---

## 1. How to Resume (exact protocol for the new session)

1. Invoke skills: `solution-architecture`, `design-system` (both were explicitly requested by Jordan), then `agent-approval-gate` before dispatch.
2. Treat "Go ahead and resume" as approval of the dispatch table in §5 **as written**. Run `touch ~/.claude/.agent-approved` (5-min freshness window enforced by the PreToolUse(Agent) hook).
3. **Orchestration mode:** If ultracode/effort is on in the new session (Jordan runs `/effort ultracode`), run the Workflow orchestration in §6. If not, dispatch via the Agent tool in the 3 phased batches of §6 — each phase's agents in a single message. Either path is pre-approved by "Go ahead and resume."
4. Do NOT re-do the inline scouting — §3–§4 capture everything gathered. Agents do the deep reads.
5. Synthesize the final report yourself (main loop), per the deliverable spec in §7.

## 2. Jordan's Objective (2026-06-09, near-verbatim)

Make retro-board a **publicly available website** where:
- Users opt in to **unlimited retro boards for $3.99/month** (⚠️ supersedes the $4.99/mo in `project_commercialization.md` and `feedback_pricing_strategy.md` — Jordan stated $3.99 directly).
- Jordan can **maintain a list of no-pay users** (free allowlist) who access everything for free. **This is a NEW requirement** — it appears in none of the 2026-03-27 workstream plans.
- Users **create their own accounts**, **view their own boards**, **see boards they've contributed to in the past**, **download boards locally**, **save them for review later**.
- The product must be **state-of-the-art** — outshine all other retro tools on **capabilities, ease of use, and cost**.

The ask: **inspect what is required** to meet this objective. This is a REVIEW/gap-analysis deliverable — report findings; do not implement until Jordan asks.

## 3. Current State (gathered this session — trust, don't re-scout)

**Stack:** Next.js 16 App Router + React 19, TS 5.9, Neon serverless Postgres (tagged-template SQL, no ORM), Better Auth 1.5.5, Ably 2.21 (realtime + presence), Zustand 5, Tailwind 4, @dnd-kit. Root-level dirs (`app/`, `components/`, `lib/`, `stores/`, `hooks/`, `types/`, `utils/`, `styles/`). Migrations: `scripts/migrate.sql` + `scripts/migrations/` (manual, migration 008 = `boards.deleted_at`).

**Already shipped to prod (retroboard.live):**
- Full board experience: 5 templates, anonymous join via link, card CRUD/merge/obfuscation, voting (DB-unique per card+voter), 4 views (grid/swimlane/list/timeline), action items, facilitator controls, synced timer, presence, dark mode, Markdown+CSV export, reconnect handling.
- Admin console: login, dashboard, board management, feature flags (`live_events` flag = Ably vs polling), app settings.
- Accounts spine: Better Auth signup/login, `/settings`, `/dashboard` ("My Retros" + "Shared With Me", filters, search), `boards.owner_id`, `board_members`, logged-in participation linking (`participants.user_id`).
- Board Management v1 (main `2fd2cea`, 2026-05-22): rename, soft-delete/Trash with 30-day lazy purge, reopen, leave, members/roles, regenerate join code. ⚠️ Shipped on Jordan's override **without browser verification** — still needs a human eyeball.
- Anti-bot: Cloudflare Turnstile + honeypot (`lib/anti-bot/`, plan 2026-05-19).

**Known gaps (from `.claude/context/` + memory, to be validated by the review):**
- No billing/Stripe at all. No entitlement model. No free-allowlist concept anywhere.
- Account lifecycle: NO password reset, NO email verification, no email sender installed — hard blocker for public launch.
- Retroactive linking/claim of anonymous participation: not started (matters for "see boards contributed to in the past" for pre-account activity).
- Export = Markdown/CSV only; WS4 planned PDF (`@react-pdf/renderer`, no Puppeteer) + image + print.
- Tests: Vitest introduced 2026-05-22 but coverage thin; no E2E/Playwright. `stores/boardStore.ts` ~837 lines untested.
- Infra all free-tier: Vercel Hobby, Neon free (0.5 GB), Ably free (200 concurrent connections) — commercial terms/limits need checking for paid SaaS (Vercel Hobby prohibits commercial use).
- No CI/CD beyond Vercel auto-deploy; no monitoring/observability; no rate limiting confirmed on API routes.
- Stale docs: README is Vite boilerplate, CONTEXT_SNAPSHOT.md pre-migration, CLAUDE.md mixes old/new stack notes.

**Key architectural invariants (from repo CLAUDE.md — agents must respect):**
- Ably channels `retro-board:{boardId}` (+`:timer`); echo dedup in `useBoardChannel` — do not bypass.
- Participants are anonymous by design (sessionStorage `retro-pid-{boardId}`) — **zero-friction joining is the differentiator**; only board creators need accounts.
- Lazy init in `lib/db.ts`/`lib/auth.ts` (Vercel build crash prevention) — never eagerly import.
- Admin auth: cookie-presence in Edge middleware, full `auth.api.getSession()` in API routes.
- Boards = 10-char nanoid; votes/action-items = `gen_random_uuid()`.

**Existing commercialization plans (docs/superpowers/plans/):** `2026-03-27-commercialization-master.md` + WS1–WS7 (`ws1-ws2-user-accounts-ownership` — largely SHIPPED since; `ws3-stripe-billing` — uses `@better-auth/stripe`, planned $4.99 + free tier of 3 active boards (both now superseded: $3.99 + free-allowlist model); `ws4-enhanced-export`; `ws5-ws6-dashboard-landing`; `ws7-ai-assistant` placeholder). The plans-reader agent (#5) determines exactly what's shipped/stale/valid.

## 4. Decisions & Constraints for the Review

| Decision | Value | Source |
|---|---|---|
| Price | **$3.99/mo**, unlimited boards | Jordan 2026-06-09 (supersedes $4.99; same low-friction rationale) |
| Free tier | **Allowlist of no-pay users with full access**, maintained by Jordan (admin console is the natural home) | Jordan 2026-06-09, NEW |
| Free non-allowlisted users | UNDECIDED — old plan said "3 active boards free"; billing-gap-assessor should present options (hard paywall vs limited free tier vs trial) as genuine trade-offs | open question |
| Participants | Stay anonymous/zero-friction — don't paywall joining | repo CLAUDE.md + WS plans |
| Competitive bar | Outshine EasyRetro, Retrium, Parabol, Metro Retro, TeamRetro on capability, ease of use, cost | Jordan 2026-06-09 |
| Jordan's style | Honest trade-offs, no over-engineering, simplest workable solution | memory |

## 5. APPROVED Dispatch Table (11 agents, 3 phases, ~900k tokens)

| # | Name | Type | Purpose | Scope (files/dirs) | Est. tokens |
|---|------|------|---------|--------------------|-------------|
| 1 | schema-reader | Explore | Map full DB schema + what billing/allowlist/export need | `scripts/migrate.sql`, `scripts/migrations/`, `types/` | ~40k |
| 2 | api-reader | Explore | Inventory API routes: auth checks, validation, rate limiting | `app/api/**`, `middleware.ts` | ~50k |
| 3 | auth-reader | Explore | Account lifecycle state: signup/login/settings/dashboard, gaps (reset, verification) | `lib/auth*`, `app/login,signup,settings,dashboard` | ~40k |
| 4 | frontend-reader | Explore | Design-token + component inventory, views, mobile handling | `styles/`, `components/`, `app/board` | ~50k |
| 5 | plans-reader | Explore | What in WS1–WS7 plans is shipped / stale / still valid | `docs/superpowers/plans+specs` | ~40k |
| 6 | architecture-assessor | general-purpose | Solution-architecture checklist review (identity, infra, DB, API, coherence), severity-ranked | Outputs of #1–3 + targeted code reads | ~100k |
| 7 | security-assessor | security-reviewer | Public-launch threat review: anon participants, admin surface, abuse, OWASP | `app/api`, `middleware.ts`, `lib/anti-bot` | ~90k |
| 8 | design-assessor | general-purpose | Design-system audit vs skill checklist (tokens, a11y, mobile, polish) vs "best-in-class" bar | Output of #4 + targeted reads | ~90k |
| 9 | billing-gap-assessor | general-purpose | $3.99 Stripe via `@better-auth/stripe` + free-allowlist design options + entitlement enforcement points | Outputs #1,3 + WS3 plan | ~80k |
| 10 | competitive-scanner | general-purpose (web) | Feature/pricing matrix: EasyRetro, Retrium, Parabol, Metro Retro, TeamRetro — what "outshine" actually requires | Web research only | ~100k |
| 11 | verify-critics (×3) | general-purpose | Adversarially verify top findings against actual code + completeness check ("what did the review miss?") | Targeted code reads | ~120k |

**Leaner fallback** (if Jordan asks): drop verify-critics + competitive-scanner → saves ~220k → ~680k total. Keep the competitive scan if only one is kept — it's load-bearing for the "outshine everyone" goal.

## 6. Orchestration Structure (dependencies — pipeline, don't barrier)

- **Independent immediate start:** #10 competitive-scanner (web only); #5 plans-reader.
- **Design chain:** #4 frontend-reader → #8 design-assessor.
- **Architecture chain:** #1–#3 readers in parallel → barrier (their three maps are jointly needed) → #6, #7, #9 in parallel, each fed all three maps.
- **Verify:** #11 critics (×3) after #6–#9 complete — 2 adversarial verifiers on the top ~10 severity-ranked findings (prompted to REFUTE against actual code), 1 completeness critic ("what's missing — dimension not assessed, claim unverified?").
- **Synthesis:** main loop (me), not an agent.
- Reader prompts must include the architectural invariants from §3 and instruct: return raw structured data (file:line cites), not prose summaries.
- Assessor prompts must include: severity ranking (Critical/High/Medium/Low), exact component cites, Jordan's no-over-engineering preference, and §4 decisions.

## 7. Deliverable Spec (per solution-architecture skill output format)

One prioritized readiness report (write to `docs/superpowers/specs/2026-06-XX-saas-readiness-review.md`):
1. Executive summary (2–3 paragraphs)
2. Strengths → Areas of concern (by severity)
3. Detailed analysis by domain: Identity/Auth · Infrastructure (incl. free-tier→paid-tier viability + unit economics at $3.99) · Database · API · Design system/UX · Coherence/tech debt
4. The $3.99 + free-allowlist model: recommended entitlement design with genuine trade-off options
5. Competitive position: capability matrix + what "outshine" requires
6. Prioritized roadmap (launch-blockers vs fast-follows vs nice-to-haves), reconciled against the 2026-03-27 WS plans
7. Trade-offs & risk assessment

This is REVIEW ONLY — no implementation until Jordan reads the report and directs.

## 8. Memory/Housekeeping Done This Session (don't redo)

- This doc + pointers: `.claude/context/pending.md`, memory `project_saas_readiness_review.md`, MEMORY.md index line.
- `feedback_pricing_strategy.md` updated to $3.99 (flagged to Jordan — revert if $3.99 was a typo).
- Noticed: MEMORY.md links `feedback_subagent_driven.md` which does not exist on disk (broken link, low priority).
