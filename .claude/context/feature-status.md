# Feature Status — Retro Board

> Living tracker of feature progress. Last updated: 2026-03-22

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

- **No tests** — No unit or E2E test framework configured
- **No export to external tools** — Board data stays in the app (except Markdown/CSV download)
- **No persistent user accounts for participants** — Session-based only
- **No board templates management in admin** — Templates are hardcoded in `utils/templates.ts`
- **boardStore.ts is 837 lines** — Candidate for splitting into domain modules
- **CONTEXT_SNAPSHOT.md is stale** — References pre-migration Supabase stack
