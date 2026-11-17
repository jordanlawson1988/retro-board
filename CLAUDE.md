# RetroBoard

Next.js 16, React 19, Neon, Better Auth, Ably, Tailwind CSS 4. Real-time retro board.

## Critical Patterns

- **Ably channels:** `retro-board:{boardId}` (events/presence), `retro-board:{boardId}:timer` (timer ticks)
- **Echo dedup:** `useBoardChannel` checks for existing IDs before adding to state — do not bypass
- **Participant identity:** boards with `trust_version = 2` (all new boards) take identity only from the signed httpOnly cookie `rb_ps_{boardId}` (`lib/participant-session.ts`); never trust ids or admin flags from a request body. Legacy `trust_version = 1` boards still use the client-generated ID in `localStorage` under `retro-pid-{boardId}`
- **Authorization and visibility:** every write route goes through `loadBoardActor` + `checkAction` (`lib/board-actor.ts`, `lib/board-guards.ts`); every board read and Ably publish goes through the shaper in `lib/board-view.ts`. Do not return or publish raw card or vote rows
- **Environments:** local and Preview use the Neon `dev` branch and the Ably app `retro-board-dev` (`NEON_BRANCH=dev`); change `DATABASE_URL` and `ABLY_API_KEY` together, never one without the other
- **Admin auth:** cookie-presence check in middleware (Edge only), full `auth.api.getSession()` in API routes
- **Lazy init:** `lib/db.ts` and `lib/auth.ts` defer init to prevent Vercel build crashes — never eagerly import
- **IDs:** boards = 10-char nanoid; votes/action items = `gen_random_uuid()`
- **Vote uniqueness:** DB-enforced UNIQUE on `(card_id, voter_id)`
- **Board completion:** sets `archived_at`, locks board, reveals all cards

## Agent Discipline

**Before spawning any subagent, summarize to Jordan what each agent will do and wait for approval.**

## Branches

`develop` → `main`. Pre-push: `npx tsc --noEmit && npm run build && npm test`. E2E: `npm run test:e2e` (Playwright, refuses to run unless `NEON_BRANCH=dev`; dev server on port 3001).

## Context (read on demand)

- `.claude/context/architecture-notes.md` — tech debt inventory
- `.claude/context/feature-status.md` — feature tracker
- `AGENTS.md` — subagent guidelines
