# RetroBoard SaaS Readiness Review

**Date:** 2026-06-09 · **Status:** REVIEW ONLY — no implementation until Jordan directs
**Objective reviewed against:** Public SaaS at **$3.99/mo unlimited boards**, **free-allowlist of no-pay users** (new requirement), self-service accounts, board history, local export, anonymous zero-friction participants, and a bar of outshining EasyRetro, Retrium, Parabol, Metro Retro (Ludi), and TeamRetro on capability, ease of use, and cost.

**Method:** 11-agent orchestrated review (workflow `wf_7d621ed6-126`, ~1.04M tokens): 5 code/doc readers, 4 domain assessors (architecture, security, design, billing), 1 web competitive scanner, 3 verify critics. All 10 Critical findings were adversarially re-verified against actual code: **9 confirmed, 1 downgraded as a duplicate, 0 refuted.** A completeness critic added 7 dimensions the structured review missed.

> ⚠️ **Provenance caveat:** the plans-reader agent reported WS3 (Stripe), WS4 (PDF export), and the pricing page as "shipped" — all three claims were refuted by direct code verification (no `stripe`/`@better-auth/stripe` dependency, no `/pricing` route, no PDF code). It mistook plan-doc content for reality. Everything in this report uses **code-verified** status; plan-doc reconciliation in §9 reflects the corrected picture.

---

## 1. Executive Summary

RetroBoard's product core is genuinely strong: the realtime board experience, zero-friction anonymous joining (2 interactions from link to participating), four board views no competitor offers, a correctly-built OKLCH token system with the only real dark mode in the category, and clean server-side board-lifecycle authorization. At $3.99/mo flat it would be **5–16× cheaper than every paid competitor** for a typical 8-person team, and the unit economics work: ~$25/mo fixed infrastructure cost means break-even at **~7 paying subscribers**.

It is not, however, safe or able to take money today. The review found **7 distinct Critical findings**, all confirmed against code: the **entire `/api/admin/*` surface is unauthenticated** (anyone on the internet can hard-delete every board and rewrite app config with one curl), the **Ably token endpoint mints full-capability tokens** (any visitor can read and forge realtime events on every board), and the **billing stack simply does not exist** — no Stripe, no entitlement check, no pricing page, and board creation works anonymously, which makes "$3.99 for unlimited boards" free via an incognito tab. Add Vercel Hobby's prohibition on commercial use and missing ToS/Privacy pages (which Stripe requires), and the gap between "free app in prod" and "paid SaaS" is well-defined but real.

The good news is the gap is mostly **days, not months**: the security fixes are hours each, the billing build is roughly one focused week (the 2026-03-27 WS3 plan is ~80% reusable after correcting four staleness bugs), and the conversion/mobile/contrast design work is 2–3 weeks total. Competitive position is the strategic watch-item: price wins every "value" row, but AI summaries, PDF export, Jira push, and template count are the four table-stakes rows the product currently loses on comparison sites — "outshine" requires closing those after launch, and newer entrant **Kollabe** is already contesting the "no signup" differentiator. One decision must be made *before* any billing code is written: **merchant-of-record (Paddle/Lemon Squeezy) vs Stripe + Stripe Tax**, because global VAT/sales-tax obligations start at the first $3.99 sale and the choice changes the billing architecture.

---

## 2. Strengths (keep these; several are marketable)

| Strength | Evidence |
|---|---|
| Board-lifecycle authorization is correct & tested | `resolveBoardAuthority()` pure + unit-tested (`lib/auth-helpers.ts:55-60`); `assertBoardOwner`/`assertCanFacilitate` on every owner/facilitator board route |
| Zero-friction join — the differentiator — works | 2 interactions from link to board; revisit skips the modal entirely (`components/pages/BoardPageWrapper.tsx:30-47,91-119`) |
| Token/design system is excellent | OKLCH light/dark/system, elevated dark surfaces, no-FOUC theme script (`styles/index.css:49-216`, `app/layout.tsx:36-40`). Only dark mode in the competitive set |
| Four board views (grid/swimlane/list/timeline) | **No competitor offers view switching** — a genuine, existing differentiator |
| Secrets handling & lazy init are right | Nothing hardcoded, env-only, prod hard-fails without Turnstile secret; lazy `lib/db.ts`/`lib/auth.ts` solves the Vercel build problem cleanly |
| SQL injection & XSS surface ~zero | Tagged-template SQL everywhere; card text renders as escaped React text; the only `dangerouslySetInnerHTML` is a static theme script |
| Anti-bot above average for solo product | Turnstile + time-gated honeypot on signup/signin via Better Auth hooks |
| Schema well-indexed for its query patterns | 26 indexes incl. partials for archived/deleted/owner; DB-enforced vote uniqueness; FK cascades |
| Billing is architecturally cheap to add | Single board-creation choke point (`POST /api/boards`); ownership spine (`owner_id`, `board_members`) already written at creation; admin console CRUD pattern ready to clone for the allowlist |
| Optimistic updates + mobile composer details | Voting feels instant; mobile sheet got 16px/52px/bottom-sheet right |

---

## 3. Areas of Concern — severity-ranked

53 findings total → after dedup across domains: **7 Critical, 14 High, 18 Medium, 12 Low.** Full per-domain detail in §4. (One billing finding, "allowlist would ship on unauthenticated admin APIs," was downgraded Critical→Low by adversarial verification as a duplicate of the admin-auth finding — same fix.)

### Critical (all verified against code; all launch blockers)

| # | Finding | Domain | Effort |
|---|---|---|---|
| C1 | **Entire `/api/admin/*` API is unauthenticated** — unauthenticated DELETE hard-deletes any board (cascades); PATCH rewrites app settings/feature flags; GET enumerates all boards & admins. Middleware matcher explicitly excludes `/api/*` (`middleware.ts:23`); zero session checks in any handler | security + architecture | hours |
| C2 | **Ably token endpoint mints unscoped tokens** — no session, no `capability`, defaults to `{"*":["*"]}`; any visitor can subscribe to and publish forged events on every board's channel (`app/api/ably-token/route.ts:5-14`). Cross-tenant break | security | hours |
| C3 | **No billing exists** — no Stripe dep, no subscription table, no checkout, no webhook; `Subscription`/`PLAN_LIMITS` are dead types; `authStore.subscription` always null | billing + architecture | days |
| C4 | **Anonymous board creation = total paywall bypass** — `POST /api/boards` proceeds with `ownerId = null` (`app/api/boards/route.ts:12-13`); incognito tab defeats the product | billing | hours |
| C5 | **No entitlement check anywhere** — `PLAN_LIMITS` imported by nothing; no `lib/entitlements.ts`; nothing distinguishes free/comped/paid even once Stripe lands | billing | ~1 day |
| C6 | **Vercel Hobby prohibits commercial use** — payment processing is explicitly commercial; removal can be without notice. Upgrade to Pro ($20/mo) before the first dollar | architecture | minutes |
| C7 | **No conversion surface** — no pricing page/section (middleware comment references a `/pricing` that was never built), no upgrade path, "Sign up free" copy, no plan state on dashboard. Nowhere to learn it's the cheapest tool in the category | design | days–week |

### High (14 after dedup)

| Finding | Domain | Blocker? | Effort |
|---|---|---|---|
| Board enumeration via 5-digit join code (100k space, no rate limit) **+ `/members` endpoint returns member emails with zero auth** — scriptable PII harvest | security | YES | days |
| No authz on content mutations — anyone with a boardId can edit/delete others' cards, wipe columns (cascade), kick participants, self-promote `is_admin` | security | YES | days |
| Vulnerable Next.js (3 High advisories incl. middleware bypass — the only guard on /admin UI) | security | YES | hours |
| No rate limiting anywhere — denial-of-wallet (each write burns Neon + Ably), join brute-force, login attempts | security | YES | days |
| Free-allowlist (locked requirement) has no schema, no admin UI, no check | billing | YES | ~1 day |
| No grandfathering decision for existing prod boards/owners | billing | YES (decision) | hours |
| WS3 plan staleness will break naive implementation (unpinned plugin peer-dep mismatch w/ better-auth 1.5.5; `userId` vs `referenceId` column bug that silently reads everyone as free; $4.99/3-board copy) | billing | no | hours |
| Mobile bottom nav is dead UI; phone users have no timer/actions/share/title/facilitation/connection status | design | YES | days |
| WCAG AA contrast failures — white-on-tint tabs at 1.7–2.8:1; `--ink-4/5` ramp at 1.9–3.2:1 across ~140 call sites (fixable at token level) | design | YES | hours |
| Failures are silent everywhere — no toast channel; optimistic reverts/create/join errors go to `console.error` | design | no | days |
| No error tracking/observability — first signal of broken checkout would be a customer email | architecture | no | hours |
| No password reset + no email sender — every forgotten password is a lost subscriber or manual ticket | architecture | no | days |
| No ToS/Privacy pages; `board_retention_days` stored but never enforced — Stripe requires the pages; GDPR/CCPA exposure (retro cards contain PII about coworkers) | architecture | YES | ~1 day |
| *(downgraded)* Allowlist-on-unauthenticated-admin — fold into C1; same fix | billing | — | — |

### Medium (18) — condensed

Vote forgery via rotated `voter_id` (accepted residual of anonymity; rate-limit it) · no security headers (CSP/XFO/nosniff) · Turnstile not on content paths (cover via rate limiting, not per-card challenges) · join-code generator has no collision retry (creation starts failing as namespace fills) · no input validation framework (no card-text length cap → Neon bloat vector) · no CI gate (Vercel deploys commits whose tests fail) · migrations have no applied-state tracking · `boardStore.ts` 898 lines untested, no E2E of the realtime spine · account deletion orphans owned boards (UI even promises they remain) · client has no 402/paywall handling · billing emails depend on missing sender (Stripe built-ins cover launch) · mobile touch targets 22–28px + instant card delete with no undo · iOS auto-zoom on join/card inputs (15px font) · no focus trap/restore in modals; offscreen panel tabbable; no aria-live for realtime · three divergent color palettes for the same concept + dead `CARD_COLORS` (the single-source-of-truth pattern again) · false affordances (⌘N hint with no handler; "drag a card here" with no drop target) · no first-run invite moment; dashboard "New Retro" bounces to marketing page · no OG/social metadata (board links into Slack render bare — the viral loop)

### Low (12) — condensed

Neon free-tier DR (~6h PITR, no runbook) · stale README/docs · `ActionItem` type missing `created_by` · transitive dep vulns (kysely/postcss/ws) · `boards.visibility='invite_only'` stored but never enforced (latent false-privacy-promise) · no audit trail for admin/auth events + `ignoreBuildErrors: true` in next.config · stale `PLAN_LIMITS` vocabulary (will mis-enforce the old model if ever imported) · legacy `--color-*` shim debt (~300 usages; migrate opportunistically, no big-bang) · no `prefers-reduced-motion` (10-minute fix) · blur-submit posts half-typed cards · avatar button lacks menu semantics · hex-string aria-labels

---

## 4. Detailed Analysis by Domain

### 4.1 Identity & Auth

What exists is half-excellent, half-missing. The board authority model (`resolveBoardAuthority` + assert helpers) is the best code in the repo — pure, tested, default-deny, and correctly applied to every owner/facilitator board operation. Better Auth signup/login with Turnstile + honeypot, settings (incl. delete-account with type-to-confirm), and the dashboard all ship.

Missing for a paid public product: **password reset** (none — and email is read-only in settings, so a forgotten password permanently strands a paying customer), **email verification** (anyone can sign up with someone else's address), and **any email sender** (`RESEND_API_KEY` is anticipated in `.env.example` but nothing consumes it). Account deletion works but **orphans owned boards** (dangling `owner_id`, un-manageable forever) and — per the completeness critic — **does not erase personal data**: `SettingsPage.tsx:285-300` promises boards remain accessible, meaning author names/cards/votes persist after deletion, which a privacy policy cannot lawfully paper over. Fix is one `afterDelete` hook that anonymizes the footprint.

### 4.2 Infrastructure & Unit Economics at $3.99

Everything is free-tier today, and one of those tiers is contractually disqualifying: **Vercel Hobby prohibits commercial use** (payment processing is explicitly listed; removal can be without notice). Verified: the project lives on Jordan's personal team with no Pro team present.

**Required paid floor:**

| Component | Tier | Cost |
|---|---|---|
| Vercel | Pro (mandatory) | $20/mo |
| Neon | Launch (recommended: SLA, longer PITR, removes 100 CU-hr cap) | $5/mo+ |
| Ably | Free is fine at launch — 200 concurrent connections ≈ ~33 simultaneous 6-person live retros; Standard $29/mo when approached | $0 |
| Resend / Sentry | Free tiers | $0 |
| **Fixed total** | | **≈ $25/mo** |

Per-subscriber net after Stripe fees (2.9% + $0.30): **~$3.57**. Break-even ≈ **7 subscribers**; ≈ 15 if/when Ably Standard is needed. If a merchant-of-record is chosen instead (§8, decision D0), net drops to roughly $3.25–3.30 and break-even ≈ 8 — still trivial. **The economics are a non-issue; the engineering gaps are the risk.**

Also missing: error tracking (Sentry free tier, ~30 min), uptime ping, CI gate (the local pre-push hook doesn't run in the cloud; Vercel happily deploys failing code), backup/DR runbook (6h PITR on free Neon), and a customer-facing status page (free Instatus/BetterStack aggregating Vercel/Neon/Ably — the product is a thin shell over those three).

### 4.3 Database

The schema is in good shape for what it does: well-indexed (26 indexes, partials where they matter), DB-enforced vote uniqueness, additive migration history 001–009, soft-delete with lazy purge. Gaps: **migration tooling has no applied-state tracking** (no `schema_migrations` table, no transactions — a 2am double-apply footgun; fix is a tiny tracking table, not an ORM), **join-code generator has no collision retry** on a 100k namespace (creation starts throwing in the low hundreds of active boards via birthday paradox), `board_retention_days` is a stored intention never enforced, `boards.visibility` is dead schema, and one type drift (`ActionItem` missing `created_by`). Billing needs migration 010: the `@better-auth/stripe` `subscription` table + `user.stripeCustomerId` + the `free_access` allowlist table.

### 4.4 API & Security

The split personality of this codebase: session-gated board *lifecycle* routes are properly authorized, while the *admin API and the anonymous participant surface have effectively no authorization at all*.

- **C1 (admin):** five admin route files, zero auth checks, middleware explicitly excludes `/api/*`. Unauthenticated platform-wide data destruction. Fix: one `requireSystemAdmin()` helper (session + `admin_users` EXISTS) first-line in every handler — hours, and it's the precondition for the allowlist ever existing safely.
- **C2 (Ably):** unscoped tokens = cross-tenant realtime read/write. Fix preserves anonymity: accept `boardId`, mint capability scoped to that board's two channels.
- **Enumeration chain (High):** 5-digit join code + no rate limit → walk all 100k codes in minutes → `GET /members` then leaks **member emails with no auth**. Member PII must be session-gated; join needs a per-IP throttle.
- **Content mutations (High):** any participant can edit/delete anyone's cards, cascade-delete columns, kick participants, and self-promote `is_admin`. Right-sized fix per the assessors: gate destructive/identity ops behind the existing facilitator authority; match `author_id` for card edit/delete; **do not** add accounts for participants or build a permission system.
- **Rate limiting (High):** none anywhere; every anonymous write burns a Neon write + an Ably message — denial-of-wallet. Upstash/Vercel KV sliding window on the 4–5 hot endpoints; no bespoke limiter.
- **Framework (High):** installed Next.js is in range for 3 High advisories including middleware bypass — directly relevant since middleware is the only guard on the admin UI. `npm audit fix` + bump.
- Hygiene: no security headers (add a `headers()` block), CSRF posture acceptable (SameSite + JSON preflight), no secrets in client bundle (verified), XSS surface minimal (verified), hidden-cards mode is CSS-blur only (full text reaches every client pre-reveal — acceptable now, but never market "private brainstorming" without server-side withholding).

### 4.5 Design System & UX

The foundation is better than the competition's (OKLCH tokens, real dark mode, no-FOUC, tested VotePill policy, touch-aware popovers) — and the gap to "paid product" is concentrated in four places:

1. **No conversion surface (C7).** The landing page sells a free tool; pricing, plan state, and upgrade path don't exist anywhere. Right-sized fix: one pricing section on the existing HomePage with explicit competitor anchoring, not a marketing site.
2. **Mobile participant flow — the most important flow in the product — is partly broken.** The bottom nav's tabs do nothing (verified: state set, never consumed); timer, action items, share, board title, facilitation controls, and the connection banner are all desktop-only divs. A facilitator cannot run a retro from a phone. Fix by wiring existing components into the existing tabs as bottom sheets — not a parallel mobile build.
3. **Contrast failures are real and measured** (OKLCH→sRGB computed): white-on-tint active tabs at 1.7–2.8:1, `--ink-4/5` text at 1.9–3.2:1 across ~140 call sites. Fixable at the **token level** in hours.
4. **Silent failures.** No toast channel; reverted optimistic updates read as "the app ate my card" mid-meeting. One ~60-line toast primitive + catches in ~6 places.

Plus the Medium polish set (44px touch targets via invisible hit-area expansion, 16px inputs to kill iOS zoom, focus traps, invite-moment modal after create, OG metadata for the Slack share loop, palette consolidation). Design assessor's calibration: **"2–3 focused weeks, not a redesign."** Two inventory claims were checked and excluded as wrong (SwimlaneView cap, Badge contrast) — the verify layer working as intended.

### 4.6 Coherence & Tech Debt

`boardStore.ts` (898 lines) is untested and there's no E2E of the multi-client realtime flow that *is* the product — right-sized answer is **one Playwright smoke test with two browser contexts** (card created in A appears in B), not store coverage chasing. No CI in the cloud; `ignoreBuildErrors: true` means the local tsc gate is the only type check anywhere. README is still Vite boilerplate. Three color palettes encode the same concept in three files (+ dead `CARD_COLORS`), and stale `PLAN_LIMITS` encodes the abandoned $4.99 model — both are exactly the single-source-of-truth divergence pattern the quality gates exist for; consolidate when touched, delete the dead vocabulary during billing work.

---

## 5. The $3.99 + Free-Allowlist Model — Recommended Entitlement Design

### 5.1 Stripe integration shape — **recommend `@better-auth/stripe` plugin**

Verified against npm: plugin is first-party, actively maintained, version-locked to better-auth core. Two viable installs; **prefer upgrading better-auth 1.5.5 → 1.6.15 first** (own PR, smoke-test signup/login/Turnstile/session), then plugin @1.6.15 — 1.6.x fixes known plugin bugs (e.g. duplicate-customer #2440). Fallback: pin both at 1.5.5.
Hand-rolling checkout+webhook was evaluated and rejected: ~300 lines you least want to own at 11pm when a charge fails. ("The over-engineering trap wearing a simplicity costume.")

Config: one `pro` plan at $3.99 inside the existing lazy `getAuth()` (respects the lazy-init invariant); `createCustomerOnSignUp: false`; webhook rides the existing Better Auth catch-all at `/api/auth/stripe/webhook` (middleware doesn't touch `/api` — verified reachable, no change needed). Schema via `npx @better-auth/cli generate`, hand-translated to `scripts/migrations/010_stripe_billing.sql` per repo convention. **Cardinal rule: entitlement reads come only from the subscription table; the `?upgraded=true` redirect is decoration, never authorization.**

⚠️ Four WS3-plan staleness bugs must be corrected before anyone executes it: unpinned install (peer-dep mismatch), the `lib/subscription.ts` query keying on `userId` instead of `referenceId` (**ships green, silently reads everyone as free**), $4.99 price, 3-board tier copy.

### 5.2 Free allowlist — **recommend Option A: `free_access` table + admin console page**

```sql
CREATE TABLE free_access (email TEXT PRIMARY KEY, note TEXT, created_at TIMESTAMPTZ DEFAULT now())
```
Lowercase emails; checked via `EXISTS` in the entitlement helper; admin page cloned from the feature-flags vertical (page → store → API → sidebar entry — all patterns exist). Email-keyed so Jordan can comp people **before** they sign up; `note` column gives auditability ("F3 guys", "beta tester"). ~1 day.

Rejected with reasons: **Better Auth role/field** (auth-schema churn, can't pre-comp emails, conflates authn role with billing entitlement — the exact 2-files-same-concept pattern); **Stripe 100%-off coupons** (comped friends traverse checkout, codes leak, management lives in Stripe instead of Jordan's console).

**Hard precondition: C1.** An allowlist CRUD on today's admin API is a self-serve free-beer tap.

### 5.3 Entitlement enforcement points (exact, code-verified)

- **Always gate:** `POST /api/boards` (`app/api/boards/route.ts:6`, check after session resolution at :12-13) — the *only* creation path. Two stages: (1) `requireSession` (kills C4), (2) `getEntitlement` → `402 {code:'BOARD_LIMIT_REACHED'}`.
- **Gate only if limited free tier:** `reopen` (`[boardId]/route.ts:170-187`) and `restore` (:189-199) — otherwise they're free-slot laundering. Never gate `complete`/`DELETE` (that's how free users make room — healthy behavior).
- **Exempt:** admin unarchive (Jordan-only, once C1 is fixed).
- **Never gate (locked invariant):** both join routes, all cards/votes/action-items/participants/columns routes, board GET, Ably token.
- **Shape:** `lib/entitlements.ts`, server-only, lazy `sql` import like `auth-helpers.ts` — `getEntitlement(userId, email) → {plan: 'paid'|'comped'|'free', canCreateBoard, activeBoards?, limit?}`. Pure decision function, Vitest-covered. **No caching** — one indexed query per creation; caching here is the over-engineering to refuse.

### 5.4 The undecided question: free non-allowlisted users

Competitive reality: every competitor offers free entry or a trial; the three with no free tier are criticized for it; Parabol's free plan and Kollabe's no-signup retros are *better than retro-board's paid plan* for a team's first retro.

| Option | For | Against |
|---|---|---|
| **1. Hard paywall** | Least code; zero freeloader cost; least abusable (security's preference) | Kills the participant→creator funnel — the product's only organic growth loop — at a card-before-value wall, in a category bought after trying |
| **2. Limited free tier, N active boards** ✅ | Matches category norms; preserves the funnel; counting already exists (`/api/user/stats`); natural upgrade trigger (402 + modal); completing boards to free slots is desired behavior | Modest extra code; bounded multi-account abuse (Turnstile already on signup; a determined $3.99-evader was never a customer) |
| **3. Time-boxed trial** | Full-capability taste | Worst fit: retro cadence is bi-weekly so 14 days ≈ 1 retro; needs expiry emails and **there is no email sender**; most billing state. Rejected |

**Panel recommendation: Option 2.** The assessors split on N — billing argued **N=1** (at $3.99, three concurrent boards *is* the product for a small team; "next retro while last is still open" is exactly the recurring-use signal worth $3.99), design argued **N=3** ("3 free vs EasyRetro's 1, at 1/10 their price" is devastating marketing). **The code is identical either way — store N as a constant or `app_settings` value and tune it.** Synthesis lean: launch at **1**, loosen later if conversion data says so (loosening delights; tightening enrages). Security's rider either way: creation must require a session for any countable tier to be enforceable.

### 5.5 Migration / grandfathering (day-one stance)

1. Existing boards are **never retroactively locked or counted punitively** — the gate evaluates only at next create/reopen/restore; a user with 4 active boards keeps all 4.
2. Anonymous boards (`owner_id IS NULL`) keep working for participants; only **future** anonymous creation ends.
3. Existing registered owners: **seed `free_access` manually from the user table via the admin page** — at current user counts, manual seeding *is* the migration tool; grandfather-date code would be over-engineering.
4. Dashboard banner 1–2 weeks pre-flip (no email sender needed).
Day-one flips: migration 010 · require-session-to-create · entitlement gate · pricing/upgrade UI.

### 5.6 Lifecycle emails — launch on Stripe's built-ins

Enable in the Stripe dashboard: receipt emails, Smart Retries + failed-payment emails, hosted billing portal for cancel/payment-method/invoices. $0 code. Add only an in-app `past_due` banner. Fold app-branded billing email in when Resend lands for password reset — don't block billing on it.

### 5.7 Subscription-lapse data policy (decide with the entitlement schema)

Recommended: over-limit boards go **read-only (never deleted) after a 14-day grace period** on cancel/payment failure — cheap to enforce, churn-friendly, easy ToS language. Encode as explicit subscription states now; retrofitting `past_due`/grace into the schema later forces rework.

---

## 6. Competitive Position

### 6.1 Pricing position

$3.99/mo flat is **an order of magnitude below the field** for an 8-person team: TeamRetro $20.83–25, Kollabe $29, Metro Retro/Ludi $32–40, EasyRetro $38 (and board-capped), Retrium $39, Parabol $64. "Only creators pay; participants always free and anonymous" is the same structural trick that lets EasyRetro/Retrium advertise unlimited participants — but at $3.99 it makes the pricing page a non-decision: below a coffee, below expense thresholds, no per-seat procurement math.

Three strategic cautions from the scan: **(1)** price is a wedge, not a moat — comparison sites score on AI/integrations/templates/exports, and retro-board currently loses those four rows; the winning frame is *"all the table stakes at 1/10th the price,"* which requires closing them. **(2)** Free tiers are the real low-end competition (Parabol free > retro-board paid for a first retro) — reinforces the §5.4 free-tier recommendation. **(3)** $3.99 signals "indie" — pair with trust signals (status page, security page, testimonials) and consider an annual plan (~$39/yr) for retention.

**Kollabe** (newer entrant) is the one to watch: AI-first, "no signup required" — directly contesting the anonymity differentiator — $29/mo flat, aggressive comparison-page SEO. The durable position is the *combination*: anonymity + $3.99 flat + unlimited boards + table-stakes capabilities — no single element alone. Metro Retro's 2024 free-plan removal left a cohort of orphaned free users that a $3.99 flat product could plausibly capture.

### 6.2 Capability matrix (June 2026, web-verified)

| Capability | retro-board ($3.99 flat) | EasyRetro | Retrium | Parabol | Metro Retro (Ludi) | TeamRetro |
|---|---|---|---|---|---|---|
| Entry paid price (8-person team) | **$3.99/mo flat** | $38/mo flat | $39/mo per room | $64/mo (8×$8/active) | $32–40/mo (per-member) | $20.83–25/mo per team |
| Free tier | TBD (§5.4) | 1 public board/mo | No (trial) | 2 teams, 10 mtgs/mo | No (removed 2024) | No (trial) |
| Participants join w/o account | **Yes — core design** | Yes | Yes | Partial | Partial | Yes |
| Templates | 5 | 200+ | 11+ techniques | 40+ | 115+ | Large + AI |
| AI (grouping/summaries) | No | Summaries | **None** | Prompts+groups+summaries | **None** | Full suite |
| Multiple board views | **Yes — 4 views** | No | No | No | Canvas | No |
| Hide cards until reveal | Yes | Yes | Yes | Yes | Yes | Yes |
| Action items | Yes | Export-only | Tracked | Tasks+integrations | Tracked | Tracked+AI |
| Jira integration | **No** | Yes | Yes | Deep | Yes (paid) | Yes |
| Slack integration | **No** | No | Yes | Yes | No | Yes |
| Export formats | MD, CSV (**no PDF**) | PDF/CSV/PNG/XLS/DOCX | CSV/print | CSV+email | Limited | XLS/PDF/Confluence |
| Dark mode | **Yes** | No | No | No | No | No |
| SSO/enterprise | No | Ent. only | Business+ | Enterprise | Business+ | All plans |

### 6.3 What "outshine" actually requires

**Table-stakes (lose shortlists without these):** ① AI meeting summary + suggest-grouping (the axis every 2026 comparison scores; cheapest highest-perceived-value: summaries) · ② PDF export (managers don't open the tool; MD/CSV serves engineers only) · ③ one-way Jira push for action items (the universal filter checkbox) · ④ ~20–30 curated templates + custom template builder (5 reads as "side project"; a builder neutralizes the count war) · ⑤ a real creator free tier (§5.4).

**Differentiators (have or nearly have — market them):** anonymity + $3.99 flat (headline) · 4 board views (unique — demo prominently) · optional guided-facilitation mode (compose existing obfuscation/reveal/timer/facilitator primitives into one-click stages = Retrium's $39 headline at 1/10 price without TeamRetro's rigidity) · action-item carry-over into the next retro (primitives exist; drives retention) · dark mode (alone in the category).

**Nice-to-have (post-traction):** Slack webhook share · async affordances (needs email) · health checks/sentiment · trust page/status page/testimonials (cheap "not a toy" counter-signals).

---

## 7. What the Structured Review Missed (completeness critic — all but one repo-verified)

| Gap | Action |
|---|---|
| **Sales tax/VAT & merchant-of-record** — EU VAT from first sale; MoR (Paddle/Lemon Squeezy, ~5% fee, they're the seller of record) vs Stripe+Stripe Tax+self-registration **changes the billing architecture** | **Decide before writing billing code** — explicit gate on the billing workstream. For a solo operator at this price, MoR is usually the right trade |
| **Support channel, refund policy, chargebacks** — zero contact path in the app; Stripe/MoR onboarding requires both | `support@retroboard.live` (Gmail alias fine), footer/settings link, one-page refund policy. Stance: $3.99 = refund-on-request, never fight a dispute |
| **Product analytics** — zero instrumentation; pricing/allowlist/limit tuning would be blind | Plausible or Vercel Analytics (cookie-banner-free) + 5 server events: signup, board_created, limit_hit, checkout_started, subscribed |
| **GDPR erasure mechanics** — `deleteUser` has no cleanup hook; cards/names/votes persist after account deletion while the UI promises boards remain | One `afterDelete` hook anonymizing the user's footprint; export already covers portability — keep it that small |
| **Subscription-lapse data policy** | §5.7 — decide with the entitlement schema, not after |
| **Abuse reporting + AUP** — anonymous UGC on brute-forceable codes with no report channel or removal rights | Report-abuse link → support email; AUP/removal clauses in the ToS; admin board-delete already covers takedown — no moderation tooling needed |
| **Status page** — paying teams mid-retro can't tell "us vs them" when Ably degrades | Free hosted status page aggregating Vercel/Neon/Ably; link from footer + connection banner |

---

## 8. Prioritized Roadmap

### Decisions first (no code until these are made)

- **D0 — Merchant of record vs Stripe + Stripe Tax.** Gates the entire billing approach (§7). The §5 design assumes Stripe; if MoR wins, §5.1 is re-planned (allowlist/entitlement/enforcement designs survive unchanged).
- **D1 — Free non-allowlisted tier:** Option 2 recommended; pick N (1 vs 3 — code identical, store as config).
- **D2 — Grandfathering stance:** adopt §5.5 as written.
- **D3 — Lapse policy:** adopt §5.7 (read-only after 14-day grace).

### Phase 0 — Launch blockers (before the first dollar; ~1.5–2.5 focused weeks)

| Order | Work | Effort |
|---|---|---|
| 1 | **C1:** `requireSystemAdmin()` first-line in every `/api/admin/*` handler | half day |
| 2 | **C2:** Ably token scoping (accept boardId, per-board capability) | hours |
| 3 | Next.js bump + `npm audit fix` (incl. kysely/postcss/ws) + smoke test | hours |
| 4 | **C6:** Vercel Pro upgrade | minutes |
| 5 | Member-email exposure fix + per-IP rate limit on join (+ hot write paths, Upstash/KV) | days |
| 6 | better-auth 1.5.5→1.6.15 PR + auth smoke test | hours |
| 7 | **C3:** `@better-auth/stripe` + migration 010 + Stripe dashboard config + `stripe listen` E2E | ~1 day |
| 8 | **C4+C5:** require-session-to-create + `lib/entitlements.ts` (+ reopen/restore gates if Option 2) + 402 handling + UpgradeModal + pricing section on HomePage (part of C7) | 1–2 days |
| 9 | Allowlist: `free_access` + admin page + seed existing owners + dashboard banner | ~1 day |
| 10 | `/terms` + `/privacy` + refund/AUP clauses + `support@` + report-abuse link | ~1 day |
| 11 | **Design blockers:** wire or remove mobile nav tabs (sheet-based, reuse existing components) · token-level contrast fixes · 'Sign up free' copy | days |
| 12 | Password reset via Resend (arch panel: do before first dollar) | ~1 day |

### Phase 1 — Fast-follows (first 1–2 weeks after going paid)

Sentry + uptime ping (hours) · GitHub Actions CI gate (~1 hr, highest leverage per cost) · `schema_migrations` tracking table (hours) · security headers (hours) · toast primitive + the ~6 silent-failure catches (days) · in-board participant guards (`is_admin` promotion, destructive ops → facilitator authority; author-match on card edit/delete) (days) · join-code collision retry (hours) · card-text length cap + Zod on hot public routes (~1 day) · account-deletion `afterDelete` erasure hook + orphaned-board policy (hours) · analytics + 5 funnel events (hours) · 44px touch hit-areas + delete-undo toast + 16px inputs (days) · focus traps + aria-live region (days) · invite-moment modal + dashboard create fix (half day) · OG metadata + per-board titles (~2 hrs) · one Playwright two-context realtime smoke test (~1 day) · status page (hours) · delete stale `PLAN_LIMITS`, consolidate the color palette fork, fix `ActionItem.created_by` (hours)

### Phase 2 — "Outshine" capability gaps (table-stakes for the marketing claim)

AI summary then suggest-grouping (WS7 placeholder → real plan; biggest comparison-site lever) · PDF export (revise WS4: `@react-pdf/renderer` approach still valid) · one-way Jira push for action items · template expansion + custom template builder · guided-facilitation mode (compose existing primitives) · action-item carry-over · annual plan (~$39/yr)

### Plan-doc reconciliation (corrected, code-verified)

| Plan | Real status | Action |
|---|---|---|
| WS1–WS2 accounts/ownership | ✅ Shipped | — |
| WS3 Stripe billing | ❌ **Not built** (plans-reader wrong) | Revise, don't discard: ~80% reusable after fixing price, tier, unpinned install, `referenceId` bug |
| WS4 enhanced export | ❌ Not built | Phase 2; approach still valid |
| WS5–WS6 dashboard/landing | Partial: dashboard ✅, landing ✅ but **no pricing section** | Pricing section lands in Phase 0 #8 |
| WS7 AI assistant | Placeholder only | Phase 2 lead item |
| Visual refresh (Quiet Modern) | ✅ Mostly shipped (OKLCH tokens + primitives live; legacy shim debt remains) | Opportunistic migration only |
| Board management (2026-05-22) | ✅ Shipped (still needs the human browser eyeball) | Verify alongside Phase 0 design work |
| 2026-03-27 master pricing ($4.99, 3-board free) | Superseded: **$3.99 + allowlist + §5.4 tier** | Update master doc when implementing |
| Board invites / visibility enum | Schema exists, no UI/enforcement | Backlog; don't ship visibility UI without enforcement (false privacy promise) |

---

## 9. Trade-offs & Risk Assessment

**Accepted residual risks (right-sized calls, documented):** vote forgery under anonymity (rate-limit, don't account-gate — votes aren't money) · hidden cards as CSS blur (acceptable until marketed as private brainstorming) · no store unit coverage (one E2E smoke instead) · legacy token shim debt (opportunistic migration) · manual migration runner + tracking table (no ORM) · no audit log until allowlist/admin hardening lands (then minimal append table, no SIEM).

**Deliberate non-goals (over-engineering refused):** hand-rolled Stripe · entitlement caching · per-row permission system for participants · API versioning · APM/tracing dashboards · big-bang token migration · code-splitting the board bundle (revisit only on bad LCP data) · moderation tooling beyond admin delete · trial billing states.

**Top risks:**
1. **Sequencing risk — billing before security.** If Stripe ships before C1/C2, the product takes money while any visitor can delete all customer data and snoop all realtime. Phase 0 order is load-bearing.
2. **D0 made late.** Choosing MoR after building Stripe = rewrite of the money path. It's a one-day decision; make it first.
3. **WS3 executed as written.** The `referenceId` bug ships green and silently entitles nobody; the unpinned install fails on peer-deps. Plan must be revised first.
4. **Competitive window.** Kollabe is absorbing the free-tier vacuum Metro Retro left and contests "no signup." The price+anonymity wedge is strongest *now*; table-stakes gaps (AI/PDF/Jira/templates) decay it the longer launch slips.
5. **Solo-operator blast radius.** Until Sentry + CI + status page exist, every incident is discovered by a paying customer and debugged blind. Phase 1's first three items are cheap insurance.
6. **Trust deficit at $3.99.** "Cheap = toy" is the buyer's default objection; ToS/Privacy/support/status/testimonials are the counter-signals and three of them are launch blockers anyway.

**Bottom line:** the product core is differentiated and the economics are trivial (break-even ≈ 7 subscribers). The work between here and charging money is well-bounded: ~2 weeks of launch blockers dominated by security hardening and the billing build, then 2–3 weeks of design polish and fast-follows, with the "outshine" capability roadmap (AI, PDF, Jira, templates) as the post-launch campaign. Nothing found suggests architectural rework — every fix lands inside the existing patterns.

---

*Review artifacts: workflow `wf_7d621ed6-126` (13 agents, 1,040,886 tokens, 453 tool uses, ~18 min). Full agent outputs preserved in the session transcript directory. Verification: 9/10 Criticals confirmed, 1 deduplicated, 0 refuted; 2 reader-inventory errors caught and excluded by assessors; 1 reader (plans) materially wrong and corrected by cross-verification.*
