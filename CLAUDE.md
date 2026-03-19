## MIGRATION COMPLETE (2026-03-19): Moved from Supabase to Neon + Better Auth + Ably.

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

## Architecture

### Stack
- **UI:** React 19 + TypeScript 5.9 + Vite 7.3
- **State:** Zustand 5 (single store, no Context providers)
- **Backend:** Supabase (PostgreSQL + Realtime + Presence + Broadcast)
- **Styling:** Tailwind CSS 4 with CSS custom property design tokens
- **Routing:** React Router 7.13 (BrowserRouter)
- **DnD:** @dnd-kit for card drag-and-drop
- **Icons:** lucide-react
- **IDs:** nanoid (10-char, URL-safe for boards)

### Routes
| Path | Page | Purpose |
|------|------|---------|
| `/` | HomePage | Create/join boards, template selection |
| `/board/:boardId` | BoardPage | Main collaboration UI |
| `*` | NotFoundPage | 404 |

### State Management
Single Zustand store at `src/stores/boardStore.ts` (~780 lines). Contains all CRUD operations, optimistic updates, and Supabase realtime subscriptions. State shape:

```
board, columns, cards, votes, actionItems, participants,
connectionStatus, loading, error, currentParticipantId, onlineParticipantIds
```

### Realtime (3 channels per board)
1. **`board:{boardId}`** — `postgres_changes` for all persistent data (cards, columns, votes, participants, action_items, boards)
2. **`presence:{boardId}`** — Presence protocol for online participant tracking
3. **`timer:{boardId}`** — Broadcast for ephemeral timer state sync

### Session Model
No authentication in current phase. Participant ID stored in `sessionStorage` under `retro-pid-{boardId}`. First joiner without existing admins becomes facilitator.

## Project Structure

```
src/
├── components/
│   ├── ActionItems/     # ActionItemsPanel, ActionItemRow
│   ├── Board/           # BoardColumn, RetroCard, SortableCard, AddCardForm,
│   │                    # CardColorPicker, ViewToggle, FacilitatorToolbar,
│   │                    # SwimlaneView, ListView, TimelineView, VoteStatus,
│   │                    # ParticipantPopover, ConnectionStatusBanner
│   ├── Layout/          # AppShell, Header
│   ├── Timer/           # TimerDisplay, TimerControls
│   └── common/          # Button, Input, Textarea, Modal, Badge
├── hooks/
│   ├── usePresence.ts   # Supabase presence channel
│   └── useTimer.ts      # Countdown + broadcast sync
├── lib/
│   ├── supabase.ts      # Supabase client init
│   └── audio.ts         # Timer ding sound
├── pages/               # HomePage, BoardPage, NotFoundPage
├── stores/
│   └── boardStore.ts    # All business logic + realtime subscriptions
├── styles/
│   └── index.css        # Design tokens (CSS custom properties + @theme)
├── types/
│   └── index.ts         # All TypeScript interfaces
└── utils/
    ├── constants.ts     # Settings defaults, color palettes, timer presets
    ├── templates.ts     # 5 board templates
    ├── cardColors.ts    # WCAG contrast text color selection
    ├── export.ts        # Markdown + CSV export
    └── cn.ts            # clsx + tailwind-merge
```

**Database:** `supabase/migrations/001_initial_schema.sql` — 6 tables (boards, columns, cards, votes, participants, action_items) with RLS enabled, all added to realtime publication.

**Docs:** `docs/plans/` — Design and implementation documents for features and bugfixes.

## Data Model

**Core entities:** Board → Columns → Cards → Votes. Boards also have Participants and ActionItems.

- **Board IDs:** 10-char nanoid (URL-safe)
- **Vote/ActionItem IDs:** UUID (server-generated)
- **`Board.settings`:** JSONB with card_visibility, voting_enabled, max_votes, secret_voting, board_locked, timer state, etc.
- **`Board.archived_at`:** NULL = active, timestamp = completed/read-only
- **`Card.color`:** `string | null` — null uses column default, string is hex color
- **Board views:** `'grid' | 'swimlane' | 'list' | 'timeline'` via URL `?view=` param

## Key Patterns

- **Optimistic updates:** Card moves, votes, and creation update UI immediately; revert on DB error
- **Facilitator controls:** Reveal/hide cards, lock board, toggle voting, manage action items, complete retro
- **Card obfuscation:** `card_visibility: 'hidden'` blurs non-author cards; authors always see their own
- **Board completion:** Sets `archived_at`, locks board, hides editing controls, shows "Completed" badge
- **Vote limiting:** Client-side check + DB UNIQUE constraint on (card_id, voter_id)
- **Reconnect handling:** Auto-refetches all data on realtime reconnect with 3-second status indicator

## Styling

Design tokens defined as CSS custom properties in `src/styles/index.css`, mapped to Tailwind via `@theme` block. 8pt spacing grid. Brand colors: primary red (#DD0031), secondary navy (#004F71), plus tertiary palette. Typography: Apercu Std / Rooney with Inter fallback.

Path alias: `@/` → `./src/` (configured in both Vite and tsconfig).

## Conventions

- **Commits:** Conventional commits (`feat:`, `fix:`, `docs:`) with co-author footer
- **TypeScript:** Strict mode, no unused locals/parameters
- **Components:** Barrel exports via `index.ts` files
- **Class merging:** Use `cn()` utility (clsx + tailwind-merge) for conditional classes
- **No tests yet:** No test framework configured

## Known Issues

- Lint warning: `setShowJoinModal(true)` in useEffect (BoardPage.tsx) — `set-state-in-effect` rule
- Build chunk size may exceed 500KB — consider dynamic imports
- Supabase realtime may need manual toggle per-table in Dashboard
- `boardStore.ts` at ~780 lines — candidate for splitting into modules



## MIGRATION AS OF MARCH 19 2026 VERY IMPORTANT!
## Architecture (migrated March 2026)

- **Database**: Neon (serverless Postgres, free tier)
- **Auth**: Better Auth (open source, sessions in Neon)
- **Realtime**: Ably (pub/sub + presence, free tier)
- **Hosting**: Vercel (Next.js App Router)
- **Previous stack**: Supabase (fully removed)

### Realtime pattern

All realtime events flow through Ably channels.
- Channel naming: `retro-board:{boardId}` for card/vote/state events
- Timer channel: `retro-board:{boardId}:timer` for high-frequency ticks
- Presence: Ably's built-in presence on the board channel

Every mutation follows this pattern:
1. Client calls API route (optimistic update on client)
2. API route writes to Neon
3. API route publishes event to Ably channel
4. All subscribed clients receive the event via useChannel hook

### Auth pattern

Better Auth handles sessions. All API routes verify session via:
```typescript
const session = await auth.api.getSession({ headers: request.headers });
```

### Key files

- `lib/auth.ts` - Better Auth server config
- `lib/auth-client.ts` - Better Auth client
- `app/api/auth/[...all]/route.ts` - Auth API routes
- `app/api/ably-token/route.ts` - Ably token auth
- `components/providers/AblyProvider.tsx` - Ably React provider