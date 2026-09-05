# Session Handoff — read this first in a new session

> Written 2026-09-04 at the end of the commercialization + competitive-analysis session. Replaces nothing; it is the shortest path back to where we left off. Also read `pending.md`. Everything listed under "Files" was committed on branch `fix/dashboard-create-modal-inline` on 2026-09-04 (not pushed; docs ride along with the next code push per the no-docs-only-pushes rule).

## One-paragraph state

RetroBoard (retroboard.live, Next.js 16 + Neon + Better Auth + Ably, Vercel Pro) is being turned into a paid product. Price is CONFIRMED at **$4.99/mo flat, unlimited boards and unlimited members, one plan, participants never pay or sign up**. The security and legal groundwork is live in prod; the billing branch has the entitlement logic but no checkout yet; a Paddle account does not exist. Two paywall decisions are still open. A go-paid checklist and a competitive gap analysis were written and are the two documents to execute from. Real usage exists (8 accounts, ~15 boards/month, 73 participants in the last 30 days, users in Argentina, Germany, Spain, Russia) and 0 subscribers.

## Decisions

Confirmed:
- 2026-06-10: Paddle as merchant of record (D0); lapse = read-only after 14-day grace (D3).
- 2026-09-04: **$4.99/mo flat, unlimited boards + members.** No per-seat pricing. Never raise above $4.99.

Open (ask Jordan before the billing build resumes):
1. Free tier: 1 ACTIVE board (built, `FREE_ACTIVE_BOARD_LIMIT` in `lib/entitlements.ts`) vs 1 LIFETIME board (Jordan's Aug 21 ask; needs a `boards_created` counter, ~half day). Claude recommended lifetime: under 1-active, a team that completes each retro never pays.
2. Comp the 4 existing registered owners into `free_access` (June plan D2) or not. Claude recommended not: they are the only creators with demonstrated intent; their existing boards stay untouched either way.

## Verified facts (2026-09-03/04, do not re-derive)

- Vercel team is on **Pro** (checked via API). C6 from the June review is DONE; older notes saying otherwise are stale.
- Live in prod: `requireSystemAdmin` on all 5 admin routes, per-board Ably token capability, Upstash rate limits on join/create/cards/votes/action-items, `/terms` `/privacy` `/refunds` (they say **$3.99**, must change to $4.99), footer support@/abuse links, Resend password reset from noreply@retroboard.live, Turnstile on signup.
- GitHub Actions CI workflow exists on `develop` only, not yet on `main`. Vercel project framework preset still says "vite" (harmless, deploys fine).
- `feature/phase0-billing`: 4 commits (Tasks 1–4 of the June plan), last commit 2026-06-10, **32 commits behind develop**. Rebase first. No Paddle deps. **Never merge before checkout exists** (it locks out board creation).
- Migration 010 already applied to the prod DB (`subscriptions`, `free_access`, 0 rows).
- Anonymous board creation is STILL live on `main` (paywall bypass); the fix is only on the billing branch.
- `emailVerified=false` for all 8 users; Better Auth email verification is not configured. Enable via Resend and only honor `free_access` for verified accounts before the flip.
- Tests: Vitest, 13 files / 82 passing (2026-09-04). No Playwright.
- Paddle: no account, no env vars, support@retroboard.live delivery unconfirmed.

## Files produced this session (uncommitted)

| File | What it is |
|---|---|
| `docs/superpowers/plans/2026-09-03-go-paid-checklist.md` | What must be true to charge: decisions, Jordan-manual prereqs, remaining code (billing plan Tasks 5–13 minus Task 9), flip-day checklist, expectations. Supersedes the prereq block in `2026-06-10-phase0-billing-paddle.md` where they disagree. |
| `docs/superpowers/specs/2026-09-04-competitive-gap-analysis.md` | Synthesis vs 30 retro tools: price position, buyer drivers, gap table, the ten capabilities, two-wave build plan. |
| `docs/research/2026-09-04-competitive/` | Four raw research reports (tier-1 tools, tier-2 + new entrants, whiteboards/suites, voice of customer) plus the HTML walkthrough. |
| Artifact | https://claude.ai/code/artifact/06463def-08f6-4efd-981a-f8169be0f924 (same content as the HTML file). |
| `.claude/context/pending.md`, `feature-status.md`, `business-context.md`, `architecture-notes.md`, `test-health.md`, `session-handoff.md` | Refreshed / added 2026-09-04. |
| Memory | `project_commercialization.md`, `feedback_pricing_strategy.md`, `project_competitive_gap_analysis.md`, `MEMORY.md` index updated. |

Pre-existing working-tree changes NOT made by Claude (Jordan's WIP, leave alone): `D .claude/hooks/supabase-env-guard.sh`, `D CONTEXT_SNAPSHOT.md`, `T AGENTS.md`.

## Competitive analysis, the conclusions that drive the roadmap

- 8-person team, cheapest paid plan, per month: RetroBoard $4.99; RetroTool and Reetro $10; TeamRetro $20.83; Neatro $23.20; GoRetro and Kollabe $29; EasyRetro $38; Retrium $39; Parabol $64. Mural is free for voting/timer/private mode; FigJam never hides card authorship; Miro $8–64.
- Below $10 the competition is free tiers that expire history in 7–30 days. Above $10 the benchmark is TeamRetro (AI, Jira two-way, Slack/Teams, health checks, 8 languages, monthly releases). Retrium and GoRetro have not shipped since 2023.
- Buyers choose on: ease, no participant signup, flat price, anonymity, history, integrations, templates, support. AI is a vendor bet more than a stated buyer reason but is now table stakes. Enterprise security is a deal gate for large orgs only.
- **The ten capabilities** (scope boundary for post-paywall work): AI summary + suggested groups + suggested actions; action carry-over + dashboard tracker; Jira push (then Linear/GitHub); Slack/Teams share; 25–30 templates + save-as-template; PDF export; guided phases; icebreakers + mood pulse; team spaces/history/themes; async mode. Plus cheap conversion items (Google/Microsoft sign-in, comparison pages, trust page, support promise) and localization (ES/PT first, backed by our own users).
- **Do not build yet:** SSO/SAML/SCIM/audit/SOC 2/residency, public API/webhooks/Zapier, whiteboard canvas, planning poker/standups, native apps, AI-run facilitation.
- Wave 1 ≈ 13 dev days (AI summary 3, carry-over 2, Jira 3, Slack/Teams 1, templates 2, PDF 1, social login 0.5). Wave 2 ≈ 20 dev days (guided phases 3, icebreakers/pulse 2, team spaces 5, async 3, comments/mentions/images 3, email summary 1, i18n 4).

## Next actions, in order

Jordan (manual):
1. Answer the two open decisions above.
2. Create the Paddle account: sandbox now, submit LIVE verification the same day (the long pole; terms/privacy/refund URLs are live). Create product "RetroBoard Pro", $4.99/month recurring price, client token, webhook secret. Put the env vars (names in the prereq block of `2026-06-10-phase0-billing-paddle.md`) in `.env.local` and Vercel (sandbox → Preview, live → Production). Confirm support@retroboard.live delivers. Turn on Paddle receipt/failed-payment emails.
3. The docs from this session are committed on this branch; push them with the next code change (never docs-only to develop/main).

Claude (executable now, subagent-driven, sonnet workers):
4. Rebase `feature/phase0-billing` onto `develop`, rerun `npm test`.
5. Billing plan Tasks 5–8 and 10–13 (Task 9 is already live), plus: lifetime-counter migration if decision 1 = lifetime; email verification before honoring the allowlist; change $3.99 → $4.99 in `app/terms/page.tsx`, `app/refunds/page.tsx`, PricingSection copy, and the Paddle price. Sandbox E2E on a preview deploy. PR to develop. Flip via the checklist in the go-paid doc.
6. In parallel with Paddle verification: `superpowers:brainstorming` → `writing-plans` for Wave 1 item 1 (AI summary). It does not depend on billing.

## Gotchas carried forward

- Check dev server port vs `.env.local` on every launch; never `npm run build` under a live `next dev`.
- Never `git commit -a` / `-am`; stage explicitly. Jordan keeps WIP in the working tree.
- `main` and `develop` are protected; `gh pr merge` needs `--auto` or `--admin`.
- Pre-push gate: run `/deploy-check` then `touch ~/.claude/.deploy-approved` before pushing to develop/main.
- Agent dispatch: post the table, route sonnet/haiku explicitly, never fable; wait only for prod-touching scope.
- The shared Neon DB is prod. Read-only queries are fine (a counts script pattern is in memory `project_multiuser_local_testing.md` and this session used a `.env.local`-loading node script that prints only counts).

## Session cost note

Four sonnet research agents ≈ 545k tokens total; everything else ran in the main loop. The research files are ~155 KB and are the evidence base; do not re-run the campaign, extend it only for specific gaps (Reddit, G2, TrustRadius blocked automated reads).
