# RetroBoard

Next.js 16, React 19, Neon, Better Auth, Ably, Tailwind CSS 4. Real-time retro board.

## Critical Patterns

- **Ably channels:** `retro-board:{boardId}` (events/presence), `retro-board:{boardId}:timer` (timer ticks)
- **Echo dedup:** `useBoardChannel` checks for existing IDs before adding to state — do not bypass
- **Participant identity:** client-generated ID in `localStorage` under `retro-pid-{boardId}` (no auth for participants; shared across tabs in one browser)
- **Admin auth:** cookie-presence check in middleware (Edge only), full `auth.api.getSession()` in API routes
- **Lazy init:** `lib/db.ts` and `lib/auth.ts` defer init to prevent Vercel build crashes — never eagerly import
- **IDs:** boards = 10-char nanoid; votes/action items = `gen_random_uuid()`
- **Vote uniqueness:** DB-enforced UNIQUE on `(card_id, voter_id)`
- **Board completion:** sets `archived_at`, locks board, reveals all cards

## Agent Discipline

**Before spawning any subagent, summarize to Jordan what each agent will do and wait for approval.**

## Branches

`develop` → `main`. Pre-push: `npx tsc --noEmit && npm run build`. No tests.

## Context (read on demand)

- `.claude/context/architecture-notes.md` — tech debt inventory
- `.claude/context/feature-status.md` — feature tracker
- `AGENTS.md` — subagent guidelines
