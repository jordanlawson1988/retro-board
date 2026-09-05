# Feature Status — Retro Board

> Living tracker of feature progress. Last updated: 2026-09-04

## Core Features

| Feature | Status | Notes |
|---------|--------|-------|
| Board Creation | Complete | 5 templates (Mad/Sad/Glad, Liked/Learned/Lacked, Start/Stop/Continue, Went Well/Didn't/Actions, Custom) |
| Board Joining | Complete | Join via shareable link, no auth required, display name prompt |
| Card CRUD | Complete | Create, edit, delete, color picker, author tracking |
| Card Drag & Drop | Complete | @dnd-kit, cross-column moves with position tracking |
| Card Merging | Complete | Combine/uncombine cards via `merged_with` FK |
| Card Obfuscation | Complete | `card_visibility: hidden` blurs non-author cards |
| Voting | Complete | Toggle on/off, max votes per participant, secret voting, UNIQUE constraint |
| Columns | Complete | Add, rename, delete, reorder, color customization (max 10) |
| Board Views | Complete | Grid (default), swimlane, list, timeline via URL `?view=` param |
| Action Items | Complete | CRUD with status workflow (open -> in_progress -> done), assignee, due date |
| Facilitator Controls | Complete | Reveal/hide cards, lock board, toggle voting, manage action items, complete retro |
| Board Completion | Complete | Archives board, locks editing, reveals all cards, shows "Completed" badge |
| Timer | Complete | Floating pop-out panel, 1/2/3/5/10 min presets, synced across clients via Ably broadcast |
| Participant Presence | Complete | Ably presence protocol, online indicator, facilitator badge |
| Board History | Complete | localStorage-based recent boards sidebar |
| Reconnect Handling | Complete | Auto-refetches data on reconnect, 3-second status indicator |
| Dark Mode | Complete | Light/dark/system toggle, inline script prevents flash |
| Export | Complete | Markdown + CSV export of board data |
| 404 Page | Complete | Custom not-found page |

## Admin Console

| Feature | Status | Notes |
|---------|--------|-------|
| Admin Login | Complete | Better Auth email/password, session cookie |
| Admin Dashboard | Complete | Active/completed board stats, recent boards list |
| Board Management | Complete | List all boards, view details, board metrics |
| Feature Flags | Complete | CRUD with optimistic updates, `live_events` flag controls Ably vs polling fallback |
| App Settings | Complete | Default template, default board settings, app name, board retention |
| Admin Auth Middleware | Complete | Cookie-presence check in Edge middleware, server-side session validation in API routes |

## User Accounts & Board Lifecycle

| Feature | Status | Notes |
|---------|--------|-------|
| User Accounts | Complete | Better Auth signup/login; `/settings` (profile, theme, change password, sessions, delete account). Shipped to prod. |
| User Dashboard | Complete | `/dashboard` — stat strip, All/Active/Completed filters, search, "My Retros" + "Shared With Me". Shipped to prod. |
| Logged-in Participation History | Complete | Joining a board while signed in links `participants.user_id` + a `board_members` row, so it appears on the dashboard. |
| Board Management | Complete | Shipped to prod 2026-05-22 (main `2fd2cea`). Rename, soft-delete→Trash (30-day lazy purge), reopen, leave, members/roles, regenerate join code. UI was never browser-verified by a human. |
| Retroactive Linking + claim | Planned (sub-project 2) | Claim anonymous participation/boards into an account. |
| Account Lifecycle (reset/verify) | Partial | Password reset SHIPPED via Resend (2026-07-02, noreply@retroboard.live). Email verification still OFF for every user; required before honoring the billing allowlist. |

## Shipped since May 2026 (previously untracked)

| Feature | Status | Notes |
|---------|--------|-------|
| Emoji reactions + per-column card sort | Complete | Plan `2026-05-25-emoji-tooltips-and-card-sort.md`. |
| Completed-board vote visibility | Complete | Plan `2026-05-28-completed-board-vote-visibility.md`; hotfix 2026-08-13 made vote sorting live during voting. |
| Mobile UX overhaul | Complete | Prod 2026-07-02 (main `59c1741`). Bottom nav, column tabs, composer sheet, FAB. Real-device pass still owed. |
| Phase 0A security hardening | Complete | Prod 2026-07-02: `requireSystemAdmin` on `/api/admin/*`, per-board Ably token capability, Upstash rate limits, security headers. |
| Phase 0C legal + design blockers | Complete | Prod 2026-07-02: `/terms`, `/privacy`, `/refunds` (copy says $3.99, must become $4.99), footer support/abuse links, Turnstile on signup. |
| Dashboard "New Retro" opens create modal in place | Complete | PR #11 + branch `fix/dashboard-create-modal-inline` (2026-08/09). |
| GitHub Actions CI + dependabot | Partial | Workflow on `develop` only; not yet on `main`. |

## Commercialization (in progress)

| Item | Status | Notes |
|------|--------|-------|
| Price | Decided 2026-09-04 | $4.99/mo flat, unlimited boards + members, one plan. Paddle MoR. |
| Entitlements + create/reopen/restore gate | On branch `feature/phase0-billing` | Tasks 1–4 of `docs/superpowers/plans/2026-06-10-phase0-billing-paddle.md`; 32 commits behind develop; never merge before checkout exists. |
| Paddle client, webhook, upgrade modal, pricing section, allowlist admin | Not started | Tasks 5–8, 10–13. Prereqs and flip checklist: `docs/superpowers/plans/2026-09-03-go-paid-checklist.md`. |
| Post-paywall roadmap | Planned | `docs/superpowers/specs/2026-09-04-competitive-gap-analysis.md` (Wave 1: AI summary, action carry-over, Jira, Slack/Teams, templates, PDF, social login). |

## Infrastructure Migration (March 2026)

| From | To | Status |
|------|-----|--------|
| Supabase (Postgres + Realtime + Auth) | Neon (serverless Postgres) | Complete |
| Supabase Auth | Better Auth | Complete |
| Supabase Realtime | Ably (pub/sub + presence) | Complete |
| React Router 7 (BrowserRouter) | Next.js 16 App Router | Complete |
| Vite 7 bundler | Next.js Turbopack | Complete |
| `src/` directory structure | Root-level (Next.js convention) | Complete |

## Known Gaps / Future Work

- **No E2E tests** — Vitest covers 13 files / 82 tests (2026-09-04); no Playwright
- **No export to external tools** — Board data stays in the app (except Markdown/CSV download)
- **No persistent user accounts for participants** — Session-based only
- **No board templates management in admin** — Templates are hardcoded in `utils/templates.ts`
- **boardStore.ts is 837 lines** — Candidate for splitting into domain modules
- **CONTEXT_SNAPSHOT.md** — deleted in the working tree (uncommitted as of 2026-09-04)
