# Architecture Notes — Retro Board

> Living record of tech debt, architectural decisions, and system health. Last updated: 2026-03-22

## Active Tech Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| No test framework configured | **High** | No Vitest, Jest, Playwright, or any test tooling. Zero test coverage on 837-line boardStore. |
| `boardStore.ts` at 837 lines | **Medium** | Single file contains all board CRUD, optimistic updates, realtime event handling, and state management. Should be split into domain modules (cards, columns, votes, participants, actions). |
| `CLAUDE.md` contains stale pre-migration content | **Medium** | Architecture section lists both old Supabase stack AND new Neon/Better Auth/Ably stack. Old references should be removed. |
| `CONTEXT_SNAPSHOT.md` is entirely stale | **Low** | Dated 2026-02-25, references Vite 7.3, Supabase, react-router-dom. Could be deleted or replaced. |
| `README.md` is Vite template boilerplate | **Low** | Default "React + TypeScript + Vite" readme. Should be replaced with actual project README. |
| `supabase-env-guard.sh` hook still active | **Low** | Pre-tool-use hook in `.claude/settings.local.json` guards against Supabase env mismatches. No longer relevant since Supabase was removed. |
| `.npmrc` bypasses corporate registry | **Low** | `registry=https://registry.npmjs.org/` — exists because Jordan's CFA machine defaults to JFrog Artifactory. |

## Recent Migration (March 2026)

The project underwent a major infrastructure migration across 30+ commits on the `feat/neon-betterauth-ably-migration` branch:

**Before:**
- Vite 7.3 SPA with react-router-dom
- Supabase (Postgres + Realtime + Auth + Presence + Broadcast)
- All business logic in Zustand store with direct Supabase client calls
- `src/` directory structure

**After:**
- Next.js 16 App Router with Turbopack
- Neon serverless Postgres (tagged template SQL)
- Better Auth (email/password, sessions in Neon)
- Ably (pub/sub channels + presence)
- API routes as the mutation layer between client and database
- Root-level directory structure (Next.js convention)

**Migration patterns worth noting:**
- Lazy initialization of DB and auth to prevent Vercel build crashes (Neon/Better Auth require DATABASE_URL at import time)
- Ably echo deduplication: `useBoardChannel` checks for existing IDs before adding to state
- Theme hydration: inline `<script>` in `<head>` prevents flash of wrong theme

## Known Footguns

1. **Ably echo duplication** — Ably sends messages back to the sender. The `useBoardChannel` hook must deduplicate by checking `state.cards.some(c => c.id === data.card.id)` before adding.
2. **Lazy DB/Auth init** — `lib/db.ts` and `lib/auth.ts` use lazy proxy patterns to avoid crashing during `next build` when `DATABASE_URL` isn't available.
3. **Vote ID mismatch** — Votes use server-generated UUIDs (`gen_random_uuid()`), but optimistic updates on the client use temporary IDs. The `useBoardChannel` handler overwrites with the server-generated ID.
4. **Timer tick interval at 250ms** — High-frequency updates. Stale closures in `useCallback` can cause timer drift if dependencies aren't correct.
5. **Theme hydration** — The inline `<script>` in `app/layout.tsx` reads `localStorage` synchronously before React hydrates. Removing it will cause flash of unstyled theme.
6. **Feature flag default-to-enabled** — `isEnabled(key)` returns `true` if the flag doesn't exist in the database. This is intentional (backwards compat) but can be surprising.

## Dependency Health

### Core
- Next.js 16.2.0, React 19.2.0, TypeScript 5.9.3
- @neondatabase/serverless 1.0.2
- better-auth 1.5.5
- ably 2.21.0
- zustand 5.0.11

### UI
- @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0
- lucide-react 0.575.0
- tailwindcss 4.2.1, @tailwindcss/postcss 4.2.2
- clsx 2.1.1, tailwind-merge 3.5.0

### Build & Lint
- eslint 9.39.1, eslint-config-next 16.2.0
- typescript-eslint 8.48.0

### Testing
- None installed

## Infrastructure

| Component | Details |
|-----------|---------|
| Hosting | Vercel (Hobby plan) |
| Database | Neon serverless Postgres (free tier, 0.5 GB storage) |
| Auth | Better Auth (email/password, 7-day sessions) |
| Realtime | Ably (free tier, 200 concurrent connections) |
| DNS | Default Vercel domain (retro-board-six.vercel.app) |
| Migration | `scripts/migrate.sql` (manual execution against Neon) |
| CI/CD | None configured — Vercel auto-deploys from Git |

## File Size Inventory (Large Files)

| File | Lines | Notes |
|------|-------|-------|
| `stores/boardStore.ts` | 837 | All board CRUD + state — candidate for splitting |
| `scripts/migrate.sql` | 289 | Combined migration — expected to be large |
| `CONTEXT_SNAPSHOT.md` | ~400 | Stale — pre-migration snapshot |
| `CLAUDE.md` | 170 | Contains both old and new architecture sections |
