@AGENTS.md
@.claude/context/test-health.md
@.claude/context/feature-status.md
@.claude/context/architecture-notes.md
@.claude/context/business-context.md

---

# RetroBoard

Real-time retrospective board for team collaboration. Built with Next.js 16 (App Router), React 19, TypeScript, Zustand, Neon, Better Auth, Ably, and Tailwind CSS 4.

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Start Next.js dev server (Turbopack)
npm run build        # Next.js production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

**Environment:** Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `ABLY_API_KEY`.

---

## Stack & Infrastructure

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 16.2 (App Router, Turbopack) | React 19, TypeScript 5.9 (strict), Tailwind CSS 4 |
| Database | Neon serverless Postgres | `@neondatabase/serverless`, tagged template SQL |
| Auth | Better Auth | Email/password, sessions stored in Neon, 7-day expiry |
| Realtime | Ably | Pub/sub channels + presence, token auth via API route |
| State | Zustand 5 | `boardStore` (board data), `authStore`, `featureFlagStore`, `appSettingsStore` |
| DnD | @dnd-kit/core + sortable | Card drag-and-drop, cross-column moves |
| Hosting | Vercel (Hobby plan) | Auto-deploy from Git |
| Icons | Lucide React | Consistent icon library |
| IDs | nanoid | 10-char URL-safe for boards/columns/cards |

**Path alias:** `@/*` maps to project root (configured in `tsconfig.json`).

---

## Architecture (Migrated March 2026)

**Previous stack (fully removed):** Supabase (Postgres + Realtime + Auth), Vite 7, React Router 7, `src/` directory structure.

### Realtime Pattern

All realtime events flow through Ably channels:
- **Board channel:** `retro-board:{boardId}` — card/vote/column/participant/board state events
- **Timer channel:** `retro-board:{boardId}:timer` — high-frequency timer ticks
- **Presence:** Built into the board channel via Ably's presence protocol

Every mutation follows this pipeline:
1. Client calls API route (optimistic update applied immediately)
2. API route writes to Neon
3. API route publishes event to Ably channel
4. All subscribed clients receive the event via `useBoardChannel` hook

### Auth Pattern

Better Auth handles admin sessions. Board participants join without auth.
- Admin routes protected by Edge middleware (cookie check) + server-side `auth.api.getSession()`
- Participant identity: client-generated ID in `sessionStorage` under `retro-pid-{boardId}`

### Key Files

| File | Purpose |
|------|---------|
| `lib/db.ts` | Neon database client (lazy-init to prevent build crashes) |
| `lib/auth.ts` | Better Auth server config (lazy Proxy pattern) |
| `lib/auth-client.ts` | Better Auth client |
| `lib/ably-server.ts` | Ably server-side REST client |
| `app/api/auth/[...all]/route.ts` | Better Auth API routes |
| `app/api/ably-token/route.ts` | Ably token auth endpoint |
| `components/providers/AblyProvider.tsx` | Ably React provider |
| `hooks/useBoardChannel.ts` | Ably event handler with echo deduplication |
| `hooks/usePresence.ts` | Ably presence tracking |
| `hooks/useTimer.ts` | Timer countdown + Ably broadcast sync |
| `stores/boardStore.ts` | All board CRUD + state (837 lines) |
| `middleware.ts` | Admin route protection (cookie-presence check) |
| `scripts/migrate.sql` | Combined Neon migration (9 tables) |

---

## Routes

| Path | Page | Purpose |
|------|------|---------|
| `/` | HomePage | Create/join boards, template selection |
| `/board/[boardId]` | BoardPage | Main collaboration UI (wrapped in AblyProvider) |
| `/login` | LoginPage | Admin login (Better Auth email/password) |
| `/admin` | AdminDashboardPage | Admin dashboard with board stats |
| `/admin/boards` | AdminBoardsPage | Board management |
| `/admin/features` | AdminFeaturesPage | Feature flag management |
| `/admin/settings` | AdminSettingsPage | App settings |

---

## Data Model

**9 tables** defined in `scripts/migrate.sql`:

**Core:** `boards` -> `columns` -> `cards` -> `votes`. Boards also have `participants` and `action_items`.
**Admin:** `admin_users`, `feature_flags`, `app_settings` (singleton).

- **Board IDs:** 10-char nanoid (URL-safe)
- **Vote/ActionItem IDs:** UUID (server-generated via `gen_random_uuid()`)
- **`Board.settings`:** JSONB with card_visibility, voting_enabled, max_votes, secret_voting, board_locked, timer state, highlighted_card_id
- **`Board.archived_at`:** NULL = active, timestamp = completed/read-only
- **Vote uniqueness:** UNIQUE constraint on `(card_id, voter_id)`

---

## Key Patterns

- **Optimistic updates:** Card moves, votes, and creation update UI immediately; revert on API error
- **Ably echo deduplication:** `useBoardChannel` checks for existing IDs before adding entities to state
- **Lazy initialization:** `lib/db.ts` and `lib/auth.ts` defer initialization to prevent Vercel build crashes
- **Facilitator controls:** Reveal/hide cards, lock board, toggle voting, manage action items, complete retro
- **Card obfuscation:** `card_visibility: 'hidden'` blurs non-author cards; authors always see their own
- **Board completion:** Sets `archived_at`, locks board, reveals all cards, shows "Completed" badge
- **Feature flag fallback:** `isEnabled(key)` returns `true` if flag not found (backwards compat)
- **Theme persistence:** Inline `<script>` in layout prevents flash of wrong theme

---

## Project Structure

```
app/
├── api/
│   ├── ably-token/              # Ably token auth
│   ├── admin/                   # Admin API routes (dashboard, boards, features, settings, verify)
│   ├── auth/[...all]/           # Better Auth catch-all
│   ├── boards/                  # Board CRUD + nested entity routes
│   └── feature-flags/           # Public feature flag endpoint
├── admin/                       # Admin pages (dashboard, boards, features, settings)
├── board/[boardId]/             # Board page
├── login/                       # Admin login
├── layout.tsx                   # Root layout with theme script
├── page.tsx                     # HomePage
└── not-found.tsx                # 404
components/
├── ActionItems/                 # ActionItemsPanel, ActionItemRow
├── Admin/                       # AdminShell, Sidebar, ProtectedRoute, FeatureFlagCard
├── Board/                       # BoardColumn, RetroCard, SortableCard, AddCardForm, views, controls
├── Layout/                      # AppShell, Header, ThemeToggle
├── Timer/                       # TimerDisplay, TimerControls, TimerFloating
├── common/                      # Button, Input, Textarea, Modal, Badge
├── pages/                       # Page-level client components (HomePage, BoardPage, admin pages)
└── providers/                   # AblyProvider
hooks/                           # useBoardChannel, usePresence, useTimer, usePolling, useTheme
lib/                             # db.ts, auth.ts, auth-client.ts, ably-server.ts, audio.ts
stores/                          # boardStore, authStore, featureFlagStore, appSettingsStore
styles/                          # index.css (design tokens + Tailwind @theme)
types/                           # index.ts (all TypeScript interfaces)
utils/                           # constants, templates, cardColors, export, cn, boardHistory
```

---

## Styling

Design tokens defined as CSS custom properties in `styles/index.css`, mapped to Tailwind via `@theme` block:
- 8pt spacing grid (`--space-1` through `--space-24`)
- Primary: `#DD0031` (CFA red), Secondary: `#004F71` (navy)
- Grayscale ramp: `--color-gray-1` through `--color-gray-8`
- Typography: Apercu Std / Rooney with Inter fallback
- Dark mode: `data-theme` attribute on `<html>`, CSS custom properties swap per theme

---

## Conventions

- **Commits:** Conventional commits (`feat:`, `fix:`, `docs:`) with co-author footer
- **TypeScript:** Strict mode, no unused locals/parameters
- **Components:** Barrel exports via `index.ts` files
- **Class merging:** Use `cn()` utility (clsx + tailwind-merge) for conditional classes
- **No tests yet:** No test framework configured
- **Branching:** `develop` -> `main`. Never push directly to `main`.

---

## Known Issues & Tech Debt

- No test framework configured — zero test coverage
- `boardStore.ts` at 837 lines — candidate for splitting into domain modules
- `CONTEXT_SNAPSHOT.md` is stale (references pre-migration Supabase stack)
- `README.md` is Vite boilerplate
- `supabase-env-guard.sh` hook in `.claude/settings.local.json` is no longer relevant
- See `.claude/context/architecture-notes.md` for full tech debt inventory

---

## Session Quickstart

> When starting a new Claude Code session, begin here:

1. This file auto-loads `AGENTS.md` and all `.claude/context/*.md` files via `@imports` above — review them for current project state.
2. Check the feature tracker in `.claude/context/feature-status.md` for what's built and what's missing.
3. Review known footguns in `.claude/context/architecture-notes.md` before making changes.
4. Run `/status-check` for a quick project dashboard, or `/project-health` for a comprehensive audit.
5. Run `/context-refresh` if context files are stale (check timestamps at the top of each).
6. Ask Jordan what to focus on in this session.

### Available Commands

| Command | Purpose |
|---------|---------|
| `/test-report` | Run tests (if configured), update test-health.md, report status |
| `/status-check` | Quick dashboard: git state, build, tests, context freshness |
| `/context-refresh` | Refresh all 4 context files with live project data |
| `/project-health` | Comprehensive audit: deps, lint, TODOs, tech debt |
| `/session-end` | Capture session work, suggest memory updates, output summary |