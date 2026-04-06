# Agent Guidelines — Retro Board

> Subagent-specific instructions. Every agent dispatched in this project inherits these guidelines in addition to the project CLAUDE.md.

---

## All Agents

### Stack & Constraints
**Stack & constraints:** See CLAUDE.md for full stack table. Key constraints below apply to all agents.

### Return Shapes (Non-Negotiable)
- API routes return `NextResponse.json()` with consistent shape (`{ ok }` for mutations, full data objects for reads)
- All mutations follow: client optimistic update -> API route writes to Neon -> API route publishes Ably event -> all clients receive event
- Ably event names use `entity-action` pattern: `card-created`, `card-updated`, `card-deleted`, etc.

### Do NOT
- Add new npm dependencies without confirming with Jordan
- Overwrite `.env.local` — it contains secrets that can't be recovered
- Bypass the mutation pattern (optimistic + API + Ably publish) — all realtime data must flow through this pipeline

### Design System
**Design system:** See CLAUDE.md for design tokens and styling conventions. Use `cn()` from `utils/cn.ts`.

---

## Code Review Agent

When reviewing code in this project:

### Architecture Checks
- All API routes that mutate data must publish to the Ably channel after writing to Neon
- `useBoardChannel` hook handles all inbound Ably events — new event types must be added there
- Admin routes must be protected by middleware (cookie-presence check) + server-side `auth.api.getSession()`
- Admin API routes verify admin access via `/api/admin/verify` check
- Board participant IDs are client-generated (stored in `sessionStorage`) — no auth required for board participation

### Known Tech Debt to Flag
**Known tech debt:** See `.claude/context/architecture-notes.md` for the full tech debt inventory.

### Performance-Sensitive Areas
- Board page with many cards (Ably channel message handling + Zustand updates)
- Timer tick interval (250ms) — potential for stale closure bugs
- Presence listener re-renders on every presence change

---

## Test Writing Agent

### Framework & Location
- **No test framework currently configured** — framework must be added before writing tests
- **Recommended:** Vitest for unit tests, Playwright for E2E
- **Unit test targets:** `stores/boardStore.ts` (837 lines of business logic), `utils/` helpers, `hooks/` (timer, presence, polling)
- **E2E targets:** Board creation flow, card CRUD, voting, facilitator controls, admin login, board completion

### Mock Strategy
- Mock Neon `sql` tagged template literal for database tests
- Mock Ably channels for realtime event tests
- Mock `fetch` for API route integration tests
- Mock `sessionStorage` for participant ID tests
- Zustand stores: use `createStore` directly, not hook-based API

### What Must Be Tested (When Tests Are Added)
- Board CRUD operations and optimistic update / rollback logic
- Vote limiting (client-side check + DB UNIQUE constraint)
- Ably event deduplication (idempotent `card-created`, `vote-cast` handlers)
- Timer countdown accuracy and sync across clients
- Feature flag evaluation (default-to-enabled behavior)
- Admin auth flow (Better Auth session + admin_users verification)

### What NOT to Test
- React component rendering (unless testing specific conditional logic like card obfuscation)
- Ably/Better Auth/Neon library internals
- CSS/styling

---

## Architecture / Planning Agent

### Business Constraints That Shape Technical Decisions
- **Jordan Lawson is the sole developer and user.** This is a personal project used for team retrospectives.
- **No authentication for board participants** — anyone with the link can join. Auth is admin-only.
- **Real-time collaboration is core** — every mutation must propagate to all connected clients instantly.
- **Free-tier infrastructure** — Neon free tier, Ably free tier, Vercel Hobby. Do not design for enterprise scale.

### Explicit Scope Boundaries
**Scope boundaries:** See CLAUDE.md — no user accounts for participants, no persistent board history, no team/org features.

### Performance / Scale Requirements
- Current usage: small teams (2-10 participants per board)
- Ably free tier: 200 concurrent connections, 6M messages/month
- Neon free tier: 0.5 GB storage, 190 compute hours/month
- Serverless functions on Vercel Hobby plan

---

## Frontend / UI Agent

### Component Patterns
- **Common components:** `Button`, `Input`, `Textarea`, `Modal`, `Badge` in `components/common/`
- **Board components:** All board UI in `components/Board/` with barrel export
- **Admin components:** `components/Admin/` with its own barrel export
- **Pages as components:** `components/pages/` contains page-level client components imported by App Router pages
- **Barrel exports:** Every component directory has an `index.ts`

### Board Views
Four view modes via URL `?view=` param:
- `grid` (default) — standard column layout
- `swimlane` — grouped by participant
- `list` — flat list view
- `timeline` — chronological

### Dark Mode
- Theme stored in `localStorage` as `retro-theme`
- Inline script in `<head>` prevents flash of unstyled theme
- `data-theme` attribute on `<html>` element
- Values: `light`, `dark`, `system`

### Accessibility
- Card colors use WCAG contrast calculation (`utils/cardColors.ts`)
- `cn()` for conditional class merging
- Semantic HTML for board structure

---

## API / Backend Agent

### API Route Patterns
```typescript
// Standard read pattern
export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const [board] = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  return NextResponse.json({ board });
}

// Standard mutation pattern (optimistic update + Ably publish)
export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const body = await request.json();
  // 1. Write to Neon
  await sql`INSERT INTO ...`;
  // 2. Publish to Ably
  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('entity-action', { data });
  // 3. Return success
  return NextResponse.json({ ok: true });
}
```

### Admin Route Protection
All `/api/admin/*` routes must:
1. Call `auth.api.getSession({ headers: request.headers })` to verify Better Auth session
2. Verify admin role via `admin_users` table lookup
3. Return 401/403 for unauthorized access

### Ably Channel Naming
- Board events: `retro-board:{boardId}`
- Timer events: `retro-board:{boardId}:timer`
- Presence: Built into the board channel

### Token Auth
- Ably tokens issued via `/api/ably-token` with participant `clientId`
- No long-lived API keys exposed to the client

---

## Database / Schema Agent

### Conventions
- IDs: `TEXT PRIMARY KEY` for nanoid-based entities (boards, columns, cards, participants), `UUID PRIMARY KEY DEFAULT gen_random_uuid()` for votes, action items, feature flags
- Timestamps: `TIMESTAMPTZ DEFAULT now()` for `created_at`, nullable for `archived_at`, `updated_at`
- Settings: `JSONB` for flexible configuration (`boards.settings`, `app_settings.default_board_settings`)
- Status fields: `TEXT` with `CHECK` constraints — never PostgreSQL enums
- Soft deletes: `archived_at TIMESTAMPTZ` on boards
- Foreign keys: `ON DELETE CASCADE` from child tables to boards

### Schema
**Schema:** See CLAUDE.md for the 9-table data model. Conventions below are agent-specific.

### Migration File
- Single combined migration: `scripts/migrate.sql`
- Includes all 9 tables, indexes, triggers (`update_updated_at`), and seed data
- No Supabase-specific features (no RLS, no policies, no realtime publication)

### No RLS
Authorization is handled entirely by Next.js API routes + Better Auth sessions. The database has no RLS policies — all access control is application-level.
