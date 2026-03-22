# Architectural Decision Records — Retro Board

> Append-only log of significant technical and architectural decisions. New decisions go at the bottom. Never edit or remove past entries — they serve as historical context.

---

## How to Add a Decision

Copy the template below and append it to the end of this file:

```markdown
### ADR-[NNN]: [Title]
**Date:** YYYY-MM-DD
**Status:** Accepted / Superseded by ADR-NNN / Deprecated
**Context:** What situation prompted this decision?
**Decision:** What did we decide?
**Consequences:** What are the trade-offs? What does this enable or prevent?
```

---

## Decisions

### ADR-001: Zustand Single Store for Board State
**Date:** 2026-02 (retroactive)
**Status:** Accepted
**Context:** The board page requires managing many interdependent entities (board, columns, cards, votes, participants, action items) with optimistic updates and realtime sync. Needed to decide between multiple small stores, React Context, or a single store.
**Decision:** Use a single Zustand store (`boardStore.ts`) containing all board-related state and CRUD operations. Separate stores exist for orthogonal concerns: `authStore`, `featureFlagStore`, `appSettingsStore`.
**Consequences:** All board logic is co-located, making it easy to find and reason about. The store grew to 837 lines and is a candidate for splitting into domain slices. Optimistic update + rollback patterns are straightforward in a single store.

### ADR-002: No Authentication for Board Participants
**Date:** 2026-02 (retroactive)
**Status:** Accepted
**Context:** Wanted zero-friction joining — participants should be able to join a retro with just a link and a display name. Adding auth would create barriers and require account management.
**Decision:** Board participants are identified by client-generated IDs stored in `sessionStorage`. No login required. Auth is reserved for the admin console only (Better Auth with email/password).
**Consequences:** Anyone with the link can join. Participant identity is ephemeral — closing the tab loses the session. There is no way to prevent impersonation or restrict access to specific boards. This is acceptable for small-team retrospectives.

### ADR-003: Nanoid for Board/Column/Card IDs, UUID for Votes/Actions
**Date:** 2026-02 (retroactive)
**Status:** Accepted
**Context:** Board IDs appear in shareable URLs and should be short and URL-safe. Votes and action items are server-generated and need guaranteed uniqueness.
**Decision:** Use 10-character nanoid for boards, columns, cards, and participants (client-generated). Use `gen_random_uuid()` for votes and action items (server-generated).
**Consequences:** Short, readable URLs (`/board/V1StGXR8_Z`). Client-generated IDs enable optimistic updates before the server responds. UUID votes prevent duplicate voting via UNIQUE constraint on `(card_id, voter_id)`.

### ADR-004: JSONB Settings on Boards
**Date:** 2026-02 (retroactive)
**Status:** Accepted
**Context:** Board configuration has many optional flags (card visibility, voting enabled, max votes, secret voting, board locked, timer state, etc.). Adding a column for each would create wide tables and require migrations for every new setting.
**Decision:** Store board settings as a JSONB column (`boards.settings`) with a TypeScript `BoardSettings` interface defining the shape.
**Consequences:** Adding new settings requires no migration — just update the TypeScript interface and default values. JSONB can't enforce constraints at the database level (no CHECK on individual fields). The client must validate and provide defaults.

### ADR-005: Feature Flags Default to Enabled
**Date:** 2026-02 (retroactive)
**Status:** Accepted
**Context:** The `live_events` feature flag controls whether Ably realtime is active or whether the app falls back to polling. When the flag doesn't exist in the database (e.g., new deployment), the app should still work.
**Decision:** `featureFlagStore.isEnabled(key)` returns `true` if the flag is not found in the database.
**Consequences:** New features work by default without requiring a database seed. However, this means you cannot use "flag not found" as a signal to disable a feature — you must explicitly create the flag and set it to `false`.

### ADR-006: Migrate from Supabase to Neon + Better Auth + Ably
**Date:** 2026-03-19
**Status:** Accepted
**Context:** Supabase bundled database, auth, realtime, and presence into one service. However, the tight coupling created issues: Realtime silently dropped events without auth sessions, RLS added complexity, and the Supabase client was heavy. Wanted more control over each layer.
**Decision:** Replace Supabase with three purpose-built services: Neon (serverless Postgres), Better Auth (email/password auth), and Ably (pub/sub + presence). Simultaneously migrate from Vite SPA to Next.js App Router.
**Consequences:** Each layer is independently replaceable. API routes provide a clear boundary between client and database. The migration required 30+ commits and touched nearly every file. Lazy initialization patterns were needed to prevent build-time crashes. The migration branch (`feat/neon-betterauth-ably-migration`) has not been merged to main.

### ADR-007: API Routes as the Mutation Layer
**Date:** 2026-03-19
**Status:** Accepted
**Context:** In the Supabase era, the Zustand store called Supabase directly from the client. After the migration, the database is Neon (server-only) and Ably events need to be published server-side.
**Decision:** All mutations go through Next.js API routes (`app/api/`). The pattern is: client optimistic update -> API route writes to Neon -> API route publishes to Ably -> all clients receive the event.
**Consequences:** Clear separation of concerns. Server-side validation and auth checking. Ably API keys never exposed to the client. Slightly more latency than direct database calls, but acceptable for retro board usage patterns.

### ADR-008: Ably Echo Deduplication in useBoardChannel
**Date:** 2026-03-19
**Status:** Accepted
**Context:** Ably sends published messages back to the sender (echo). Combined with optimistic updates, this caused duplicate cards, votes, and participants appearing in the UI.
**Decision:** The `useBoardChannel` hook checks for existing entity IDs before adding to state: `if (state.cards.some(c => c.id === data.card.id)) return state`.
**Consequences:** Prevents all echo-caused duplicates. Every new entity type added to `useBoardChannel` must include this deduplication check. The pattern is simple but must be remembered — forgetting it will cause visible bugs.

### ADR-009: Lazy Initialization for Neon and Better Auth
**Date:** 2026-03-19
**Status:** Accepted
**Context:** Neon and Better Auth both require `DATABASE_URL` at initialization time. During `next build` on Vercel, environment variables are not available for server-side imports. The build crashed on import.
**Decision:** Use lazy initialization patterns: `lib/db.ts` wraps the Neon client in a function that initializes on first call. `lib/auth.ts` uses a Proxy to defer Better Auth initialization until a property is accessed.
**Consequences:** Build succeeds without DATABASE_URL. First request has a small cold-start penalty. The Proxy pattern in `auth.ts` is slightly unusual and may confuse future readers — the `eslint-disable` comments explain why.

### ADR-010: Singleton App Settings Table
**Date:** 2026-02 (retroactive)
**Status:** Accepted
**Context:** Global app configuration (default template, default board settings, app name, board retention) needs a single source of truth that can be edited via the admin console.
**Decision:** The `app_settings` table enforces a singleton row via a CHECK constraint on the primary key (`id = '00000000-...'`). Only one row can ever exist.
**Consequences:** Simple to query — always `SELECT * FROM app_settings LIMIT 1`. Cannot accidentally create duplicate configuration rows. The CHECK constraint is non-obvious and should be documented.
