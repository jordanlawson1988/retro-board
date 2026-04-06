# Retro Board Commercialization Evaluation

> Comprehensive assessment of modifications needed to transform Retro Board from a free personal tool into a subscription SaaS product.
> Date: 2026-03-27

---

## Bottom Line Up Front

Commercializing Retro Board is a **significant architectural expansion** — not a bolt-on. The core board collaboration engine (cards, votes, columns, drag-and-drop, real-time sync) is solid and reusable. But the product currently has **no concept of user identity for participants, no board ownership model, and no access control**. These three gaps must be filled before payments make sense. The good news: Better Auth has a first-party Stripe plugin that handles 80% of the billing plumbing, and Neon + Ably scale well beyond free-tier limits.

**Estimated scope:** 6 major workstreams, ~15-20 new database tables/modifications, ~30-40 new or modified API routes, and significant frontend additions (auth flows, dashboard, billing pages, access control UI).

---

## 1. Competitive Landscape & Pricing Strategy

### What Competitors Charge

| Tool | Free Tier | Paid Price | Model | Paywall Gates |
|------|-----------|-----------|-------|---------------|
| **EasyRetro** | 3 public boards | $25/mo | Per team | Private boards, unlimited boards, templates |
| **RetroTool** | Unlimited participants, 3 templates | $10-20/mo | Per account | Unlimited teams, encryption, image cards |
| **Parabol** | 2 teams, unlimited meetings | $8/active user/mo | Per user | Unlimited teams, priority support |
| **TeamRetro** | 30-day trial only | $25/mo | Per team | No free tier at all |
| **Neatro** | 1 team, 10 members | ~$23/team/mo | Per team | Multiple teams, SSO |
| **Retrium** | 30-day trial only | $39-59/team/mo | Per team | Enterprise features |
| **Metro Retro** | 30-day trial only | $5-8/user/mo | Per user | Multiple spaces, Jira integration |

### Your Proposed Model: $4.99/mo After 5 Free Retros

**Honest assessment:** This is aggressively cheap — potentially *too* cheap. The market charges $10-40/month. At $4.99/mo with a 2-5% freemium conversion rate, you'd need 200-500 free users to generate $50-125/mo in revenue. That said, there's a strategic argument for undercutting if your goal is portfolio evidence and modest revenue rather than venture-scale growth.

**Recommendation:** Consider these pricing tiers instead:

| Tier | Price | Limits | Target |
|------|-------|--------|--------|
| **Free** | $0 | 3 active boards, 10 participants/board, Markdown/CSV export only | Individual facilitators trying it out |
| **Pro** | $9.99/mo ($99/yr) | Unlimited boards, unlimited participants, PDF export, board history, custom branding | Regular facilitators, small teams |
| **Team** | $24.99/mo ($249/yr) | Everything in Pro + 5 team members, shared board library, admin dashboard, priority support | Agile teams, departments |

**Why 3 active boards, not 5 retros:** Usage-based limits (boards) convert better than time-based limits (retros). Users hit the wall naturally as they succeed with the product, not because an arbitrary counter ticked down. This aligns with what EasyRetro, Miro, and Metro Retro do.

---

## 2. Architecture Modifications Required

### 2.1 User Identity System (Priority: CRITICAL)

**Current state:** Participants are anonymous — client-generated UUIDs stored in `sessionStorage`. Board creators are participants, not authenticated users. Auth exists only for the admin console.

**What must change:**

Board *creators* need authenticated accounts. Board *participants* should remain frictionless (this is your differentiator). The model becomes:

- **Authenticated creators** — Sign up with email/password or OAuth (Google, GitHub). Own boards, manage subscriptions, see "My Boards" dashboard.
- **Anonymous participants** — Still join via link with a display name. No account required. But optionally, authenticated users who join a board get their participation linked to their user account.

**Database changes:**
```
-- Better Auth already creates: user, session, account, verification tables
-- You need to add:

ALTER TABLE boards ADD COLUMN owner_id TEXT REFERENCES "user"(id);
-- owner_id = the authenticated user who created the board
-- created_by remains for the participant ID (backwards compat)

CREATE TABLE board_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'participant' CHECK (role IN ('facilitator', 'participant', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**UX flow — Board Creation (authenticated):**
1. User lands on `/` — sees "Create a Retro" CTA and "Sign In" in header
2. Clicking "Create" prompts sign-in if not authenticated (or allows anonymous creation on free tier)
3. After auth, board is created with `owner_id = user.id`
4. Creator is auto-joined as facilitator participant
5. Share link works exactly as today for other participants

**UX flow — Participant Joining (stays frictionless):**
1. Participant clicks board link → enters display name → joins immediately
2. No account required, no sign-up prompt
3. If participant happens to be logged in, their user_id is linked to the participant record (for "My Boards" history)

### 2.2 Board Ownership & Access Control (Priority: CRITICAL)

**Current state:** Anyone with the URL can join any board. The first joiner becomes admin. No concept of "my boards" vs "someone else's boards."

**What must change:**

```
-- Board access control
ALTER TABLE boards ADD COLUMN visibility TEXT DEFAULT 'link'
  CHECK (visibility IN ('link', 'invite_only', 'public'));

-- Track which authenticated users have access
CREATE TABLE board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'participant' CHECK (role IN ('owner', 'facilitator', 'participant', 'viewer')),
  invited_by TEXT REFERENCES "user"(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, user_id)
);
```

**Access model:**
- **`link` (default):** Anyone with the URL can join — same as today. Board appears in owner's dashboard.
- **`invite_only`:** Only users with explicit board_members entries or valid invite tokens can join.
- **`public`:** Listed in a public directory (future feature).

**"My Boards" dashboard query:**
```sql
SELECT b.* FROM boards b
LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = $1
WHERE b.owner_id = $1 OR bm.user_id = $1
ORDER BY b.created_at DESC;
```

### 2.3 Subscription & Billing (Priority: HIGH)

**Key finding: Better Auth has a first-party Stripe plugin** (`@better-auth/stripe`) that handles:
- Automatic Stripe customer creation on signup
- Subscription plan definitions with price IDs
- Checkout session creation via `authClient.subscription.upgrade()`
- Billing portal via `authClient.subscription.billingPortal()`
- Webhook handling at `/api/auth/stripe/webhook`
- Trial management with abuse prevention

**Installation:**
```bash
npm install @better-auth/stripe stripe@^20.0.0
```

**Database additions (auto-created by the plugin):**
- `stripeCustomerId` field on user table
- `subscription` table with: plan, status, period dates, cancel flags

**Usage enforcement — where to gate:**

| Check Point | Logic |
|-------------|-------|
| Board creation (`POST /api/boards`) | Count user's active boards. If >= free limit (3) and no active subscription → return 402 with upgrade prompt |
| Export PDF (`POST /api/boards/:id/export/pdf`) | Check subscription status. Free tier gets Markdown/CSV only |
| Team features (future) | Check plan tier. Free = no teams |

**UX — Upgrade prompts (progressive, not blocking):**
1. **Soft nudge** — After creating 2nd free board: "You have 1 free board remaining"
2. **Upgrade wall** — At board creation when limit hit: modal with plan comparison, "Upgrade" CTA routes to Stripe Checkout
3. **Feature gate** — PDF export button shows lock icon on free tier, click reveals upgrade modal
4. **Settings page** — `/settings/billing` with current plan, usage, and Stripe Customer Portal link

**Stripe Customer Portal** handles all self-service billing (payment methods, invoices, cancellation) — no custom billing UI needed.

### 2.4 "My Boards" Dashboard (Priority: HIGH)

**New route:** `/dashboard`

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  [Logo]  Dashboard  Templates  Settings  [Avatar ▾] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  My Retros                          [+ New Retro]   │
│                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Sprint 24   │ │ Sprint 23   │ │ Q1 Review   │   │
│  │ Mar 25      │ │ Mar 18      │ │ Mar 15      │   │
│  │ 8 cards     │ │ 12 cards    │ │ 6 cards     │   │
│  │ 3 actions   │ │ 5 actions   │ │ 2 actions   │   │
│  │ ● Active    │ │ ✓ Complete  │ │ ✓ Complete  │   │
│  │ [Open]      │ │ [View] [⬇]  │ │ [View] [⬇]  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                     │
│  Shared With Me                                     │
│                                                     │
│  ┌─────────────┐ ┌─────────────┐                    │
│  │ Team Alpha  │ │ Design Sync │                    │
│  │ by Sarah    │ │ by Mike     │                    │
│  │ Participant │ │ Facilitator │                    │
│  └─────────────┘ └─────────────┘                    │
│                                                     │
│  ┌─────────────────────────────────────┐            │
│  │ Free Plan: 2/3 boards used          │            │
│  │ [████████░░░░] Upgrade to Pro →     │            │
│  └─────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
```

**Sections:**
1. **My Retros** — Boards where `owner_id = currentUser.id`, sorted by created_at DESC
2. **Shared With Me** — Boards where user is in `board_members` but not owner
3. **Usage meter** — Visual indicator of free tier consumption with upgrade CTA

**Filters:** Active / Completed / All
**Search:** By board title
**Bulk actions:** Export, Archive, Delete (owner only)

### 2.5 Enhanced Export (Priority: MEDIUM)

**Current state:** Client-side Markdown and CSV export via `utils/export.ts`. Works well for structured data.

**Additions for commercialization:**

| Format | Approach | Tier |
|--------|----------|------|
| Markdown | Already built | Free |
| CSV | Already built | Free |
| PDF (structured) | `@react-pdf/renderer` — server-side in API route, React component syntax, no headless browser | Pro |
| Image/screenshot | `html-to-image` — client-side capture of board visual | Pro |
| Print | `@media print` CSS + `react-to-print` hook | Free |

**Why `@react-pdf/renderer` over Puppeteer:**
- No 50MB Chromium binary
- Works within Vercel's 10-second function timeout
- React 19 compatible (since v4.1)
- Renders structured data (which board content is) cleanly
- No headless browser = no serverless cold start penalty

**PDF content structure:**
- Header: Board title, template, date, facilitator
- Per-column section: Cards with author, votes, color indicator
- Action items table: Item, assignee, due date, status
- Footer: Export date, participant count, vote summary

**New API route:** `POST /api/boards/:id/export/pdf`
- Auth check: Must be board owner or member
- Subscription check: Must be Pro tier
- Returns PDF as `application/pdf` response

### 2.6 Auth UX Flows (Priority: CRITICAL)

**Sign Up / Sign In (new — currently only admin login exists):**

The current `/login` page is admin-only. For commercialization, this becomes the general sign-in page with the admin console as a section within the authenticated dashboard.

**Registration flow:**
1. `/signup` — Email + password (Better Auth handles this)
2. Email verification (Better Auth plugin)
3. Redirect to `/dashboard` (new "My Boards" page)
4. Optional: OAuth with Google/GitHub (Better Auth plugins)

**Key UX principle:** Sign-up gates board *creation*, not board *participation*. The homepage should still allow creating a quick anonymous board for first-time visitors — but that board is ephemeral (not saved to any account). The moment they want to save/manage boards, they hit the auth wall.

**Suggested homepage flow:**
```
Landing Page
├── "Start a Free Retro" → Anonymous board (no account, ephemeral, limited)
│   └── After retro: "Want to save this? Sign up free →"
├── "Sign In" → /login → /dashboard (My Boards)
└── "Sign Up" → /signup → /dashboard
```

This preserves the zero-friction entry while funneling engaged users toward accounts.

---

## 3. Data Model Changes Summary

### New Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `board_members` | Explicit access control | board_id, user_id, role (owner/facilitator/participant/viewer) |
| `board_invites` | Email-based invitations | board_id, email, token, role, expires_at |
| `subscription` | Auto-created by Better Auth Stripe plugin | user_id, plan, status, stripe IDs, period dates |

### Modified Tables

| Table | Change | Reason |
|-------|--------|--------|
| `boards` | Add `owner_id TEXT REFERENCES user(id)` | Board ownership by authenticated user |
| `boards` | Add `visibility TEXT DEFAULT 'link'` | Access control model |
| `participants` | Add `user_id TEXT REFERENCES user(id)` (nullable) | Link anonymous participants to accounts when logged in |
| `user` (Better Auth) | Add `stripeCustomerId` (auto by Stripe plugin) | Billing |

### Unchanged Tables
- `columns`, `cards`, `votes`, `action_items` — Core board logic stays the same
- `feature_flags`, `app_settings` — Admin tooling stays the same
- `admin_users` — Could be merged into a role system later, but works for now

---

## 4. New Routes

### Pages
| Route | Purpose |
|-------|---------|
| `/signup` | Registration (email/password + OAuth) |
| `/dashboard` | My Boards — owned and shared boards |
| `/settings` | User profile settings |
| `/settings/billing` | Subscription management (links to Stripe Portal) |
| `/pricing` | Plan comparison page |

### API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/boards/:id/export/pdf` | POST | Server-side PDF generation (Pro tier) |
| `/api/boards/:id/members` | GET/POST/DELETE | Board member management |
| `/api/boards/:id/invite` | POST | Send email invite |
| `/api/boards/:id/invite/:token` | GET | Accept invite |
| `/api/user/boards` | GET | Fetch boards for authenticated user |
| `/api/user/usage` | GET | Current usage stats (board count, plan limits) |
| `/api/auth/stripe/webhook` | POST | Auto-handled by Better Auth Stripe plugin |

---

## 5. What's Already Good (Keep As-Is)

| Component | Why It Works |
|-----------|-------------|
| Core board engine (cards, votes, columns, DnD) | Battle-tested, optimistic updates work well |
| Ably realtime | Scales to paid tiers; presence and pub/sub are solid |
| Better Auth | First-party Stripe plugin eliminates custom billing code |
| Neon serverless Postgres | Scales beyond free tier with usage-based pricing |
| Feature flags system | Can gate new commercial features behind flags |
| Zustand stores | Clean separation; boardStore needs splitting but logic is sound |
| Export (Markdown/CSV) | Already built; becomes free-tier export |
| Design system + dark mode | Professional look, ready for commercial use |
| Admin console | Foundation for expanded admin/billing dashboard |

---

## 6. Risks & Considerations

### Technical Risks
1. **Vercel Hobby plan limits** — Serverless function timeout (10s), bandwidth limits. PDF generation must stay fast. May need to upgrade to Vercel Pro ($20/mo) which would need to be factored into unit economics.
2. **Neon free tier limits** — 0.5 GB storage, 190 compute hours. With users storing boards long-term (not ephemeral), storage grows. Neon's paid tier starts at $19/mo.
3. **Ably free tier** — 200 concurrent connections, 6M messages/mo. A popular product could exceed this quickly. Ably paid starts at $29/mo.

### Business Risks
1. **Infrastructure cost at scale** — At $4.99-9.99/mo per user with 2-5% conversion, you need significant free-user volume to cover Vercel Pro + Neon paid + Ably paid (~$68/mo minimum). Break-even requires ~7-14 paying users at $9.99/mo.
2. **Support burden** — Paying users expect support. As a solo developer with a full-time job, this is a real constraint.
3. **Competitive moat** — The retro tool market is crowded. Your differentiator (zero-friction joining) is real but could be replicated. Consider what else makes this sticky.

### UX Risks
1. **Auth friction killing adoption** — The biggest risk is that requiring sign-up for board creation reduces the "just try it" conversion. The ephemeral anonymous board flow mitigates this but adds complexity.
2. **Free-to-paid cliff** — If the free tier is too generous, nobody upgrades. If too restrictive, nobody stays. 3 active boards is the competitive norm and a reasonable starting point.

---

## 7. Recommended Implementation Order

| Phase | Scope | Depends On |
|-------|-------|------------|
| **Phase 1: User Accounts** | Sign up/in for board creators, board ownership (`owner_id`), `/dashboard` with "My Boards" | Nothing — start here |
| **Phase 2: Access Control** | Board visibility settings, `board_members` table, invite system | Phase 1 |
| **Phase 3: Stripe Integration** | Better Auth Stripe plugin, subscription plans, usage enforcement, `/pricing` page | Phase 1 |
| **Phase 4: Enhanced Export** | PDF export via `@react-pdf/renderer`, print CSS, image export | Phase 1 (gate behind subscription in Phase 3) |
| **Phase 5: Dashboard Polish** | Usage meters, upgrade prompts, billing management page, onboarding flow | Phases 1-3 |
| **Phase 6: Team Features** | Team/org model, shared board libraries, team billing | Phases 1-3 (future — don't build until validated) |

**Phase 1 is the foundation.** Nothing else works without authenticated board creators and a "My Boards" dashboard. Start there and validate that users actually want accounts before building billing.

---

## 8. Key Dependencies to Install

```bash
# Stripe (via Better Auth plugin)
npm install @better-auth/stripe stripe@^20.0.0

# PDF Export
npm install @react-pdf/renderer

# Image Export
npm install html-to-image

# Print
npm install react-to-print

# Email (for invites — optional, could use Resend)
npm install resend
```

---

## Sources Consulted

- EasyRetro, RetroTool, Parabol, TeamRetro, Neatro, Retrium, Metro Retro pricing pages
- Better Auth Stripe plugin documentation (better-auth.com/docs/plugins/stripe)
- First Page Sage 2026 SaaS Freemium Conversion Report
- Stripe documentation (Checkout, Customer Portal, Webhooks)
- @react-pdf/renderer, html-to-image, react-to-print documentation
- Full codebase analysis of current Retro Board architecture
