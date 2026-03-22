# Agent Guidelines — Retro Board

> Subagent-specific instructions. Every agent dispatched in this project inherits these guidelines in addition to the project CLAUDE.md.

---

## All Agents

### Stack & Constraints
- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript 5.9 (strict)**, **Tailwind CSS 4**
- **Database:** PostgreSQL via Neon serverless (`@neondatabase/serverless`)
- **Auth:** Better Auth (email/password, sessions stored in Neon)
- **Realtime:** Ably (pub/sub channels + presence)
- **State:** Zustand 5 (single `boardStore` for board state, plus `authStore`, `featureFlagStore`, `appSettingsStore`)
- **DnD:** `@dnd-kit/core` + `@dnd-kit/sortable` for card drag-and-drop
- **IDs:** nanoid (10-char, URL-safe) for boards/columns/cards; UUID for votes/action items
- **Path alias:** `@/*` maps to project root

### Return Shapes (Non-Negotiable)
- API routes return `NextResponse.json()` with consistent shape (`{ ok }` for mutations, full data objects for reads)
- All mutations follow: client optimistic update -> API route writes to Neon -> API route publishes Ably event -> all clients receive event
- Ably event names use `entity-action` pattern: `card-created`, `card-updated`, `card-deleted`, etc.

### Do NOT
- Add new npm dependencies without confirming with Jordan
- Re-introduce Supabase or `react-router-dom` — these were fully removed in the March 2026 migration
- Use `supabase` anything — no imports, no references, no environment variables
- Overwrite `.env.local` — it contains secrets that can't be recovered
- Push to `main` or merge without going through `develop` first
- Bypass the mutation pattern (optimistic + API + Ably publish) — all realtime data must flow through this pipeline

### Design System
- Background: `#F4F1EC` (warm white) / dark mode via `data-theme` attribute
- Primary: `#DD0031` (CFA red), Secondary: `#004F71` (navy)
- Typography: Apercu Std / Rooney with Inter fallback
- Icons: Lucide React only
- Class utility: `cn()` from `utils/cn.ts` (clsx + tailwind-merge)
- Design tokens in `styles/index.css` as CSS custom properties + `@theme` Tailwind block
- 8pt spacing grid

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
- `boardStore.ts` at 837 lines — candidate for splitting into domain modules
- `CLAUDE.md` still contains outdated Supabase/Vite/react-router references in some sections
- No test framework configured — no unit tests, no E2E tests
- `.npmrc` exists to bypass corporate JFrog registry
- `CONTEXT_SNAPSHOT.md` is stale (references pre-migration Supabase stack)

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
- Do NOT plan for user accounts for board participants
- Do NOT plan for persistent board history across sessions (boards are ephemeral)
- Do NOT plan for team/organization features
- If a feature could "prepare" for these, stop and ask Jordan first

### Performance / Scale Requirements
- Current usage: small teams (2-10 participants per board)
- Ably free tier: 200 concurrent connections, 6M messages/month
- Neon free tier: 0.5 GB storage, 190 compute hours/month
- Serverless functions on Vercel Hobby plan

---

## Frontend / UI Agent

### Design Tokens
| Token | Value |
|-------|-------|
| `--color-primary` | `#DD0031` (CFA red) |
| `--color-navy` | `#004F71` (navy) |
| `--color-warm-white` | `#F4F1EC` |
| `--color-error` | `#B8072F` |
| `--color-success` | `#077E4C` |

### Typography
- Primary: Apercu Std with Inter fallback
- Secondary: Rooney with Inter fallback
- Scale: H1 (48px) through H4 (20px), subtitles, body, caption

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

### Schema (9 tables)
1. `boards` — retrospective boards with nanoid IDs and JSONB settings
2. `columns` — board columns with position ordering
3. `participants` — board participants (client-generated IDs, no auth)
4. `cards` — sticky note cards with author tracking and optional merge
5. `votes` — card votes with UNIQUE(card_id, voter_id) constraint
6. `action_items` — action items with status workflow (open -> in_progress -> done)
7. `admin_users` — admin users linked to Better Auth accounts
8. `feature_flags` — application feature flags with key/enabled toggle
9. `app_settings` — singleton row for global app configuration

### Migration File
- Single combined migration: `scripts/migrate.sql`
- Includes all 9 tables, indexes, triggers (`update_updated_at`), and seed data
- No Supabase-specific features (no RLS, no policies, no realtime publication)

### No RLS
Authorization is handled entirely by Next.js API routes + Better Auth sessions. The database has no RLS policies — all access control is application-level.
