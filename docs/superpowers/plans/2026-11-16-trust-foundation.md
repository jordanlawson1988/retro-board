# Trust Foundation (Parabol parity Step 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the server, not the browser, decide who a participant is and what they may read or change, so hidden cards, secret votes and locks are real on every new board.

**Architecture:** Joining or creating a board sets an HMAC-signed, httpOnly participant cookie. Every write route resolves a `BoardActor` from that cookie (plus the Better Auth session) and asks one pure guard, `checkAction`, whether the action is allowed. One pure shaper, `lib/board-view.ts`, decides what each viewer receives from the board GET and what goes onto Ably. Boards carry a `trust_version`: existing boards stay at 1 (state guards only), new boards get 2 (identity guards and shaped payloads).

**Tech Stack:** Next.js 16 route handlers, `@neondatabase/serverless`, Ably REST, Better Auth, Vitest, Playwright (new), Node `crypto`.

**Spec:** `docs/superpowers/specs/2026-11-12-parabol-parity-design.md` (sections "What stands in the way", "Design decisions", "Step 0").

## Global Constraints

- Branch: `feature/trust-foundation`, cut from `origin/develop`. PR targets `develop`. Never push to `develop` or `main` directly.
- Never use `git commit -a`. Stage files by name. The working tree holds unrelated WIP deletions (`.claude/hooks/supabase-env-guard.sh`, `CONTEXT_SNAPSHOT.md`, `AGENTS.md` type change); leave them alone.
- Migrations are additive and safe for the code already in production. This plan's migration is `scripts/migrations/011_trust_version.sql`. Number 010 belongs to the billing branch.
- All development and tests run against the Neon `dev` branch (`br-odd-block-amphtgnp`, project `delicate-firefly-59326681`) and the dev Ably app. Nothing in this plan runs against the production branch until the promotion step in Task 10.
- `lib/db.ts` and `lib/auth.ts` are lazy. Never import them at module top level in a way that runs a query at import. New modules read env vars inside functions, not at import.
- Do not run `npm run build` while `next dev` is running.
- Echo dedup in `useBoardChannel` (existing-id check before adding) must keep working.
- Participants never sign up. No route added here may require a Better Auth session from an ordinary participant.
- Trust version 1 boards keep today's identity model: ids from the request body are still accepted. Only state guards apply to them.
- HTTP status codes from guards: 401 no valid participant session on a v2 board, 403 identified but not allowed, 409 board state forbids it (completed, locked, voting off, card creation off).
- Pre-push check for the PR: `npx tsc --noEmit && npm run build && npm test`.

## Review Focus

1. A participant on a v2 board clears cookies or opens the link on a second device. Expected: they see the join modal and join as a new participant; nothing 500s and no data from their old identity is exposed.
2. An author edits their own card while cards are hidden, then the realtime echo arrives with the text withheld. Expected: their own text stays on screen. (Test in Task 8.)
3. A board created before the cutover (v1) is opened after deploy. Expected: it loads, cards can be added and voted on exactly as before, and a locked or completed v1 board rejects writes. (Test in Task 6 and Task 9.)
4. The facilitator reveals cards or turns secret voting off. Expected: every connected client shows full text and all votes within a moment, without a manual reload. (Test in Task 9.)
5. A request arrives with a participant cookie signed for a different board, or with a tampered signature. Expected: treated as no session, 401 on v2 writes. (Test in Task 2.)

---

## File structure

| File | Responsibility |
|---|---|
| `scripts/migrations/011_trust_version.sql` | Adds `boards.trust_version` |
| `scripts/run-one.mjs` (modify) | Refuses to run unless `NEON_BRANCH=dev` or `--prod` is passed |
| `lib/participant-session.ts` | Sign, verify, read and set the participant cookie |
| `lib/constants/board-actions.ts` | The one list of guarded actions |
| `lib/board-guards.ts` | Pure `checkAction` decision |
| `lib/board-actor.ts` | Loads the board row and resolves the `BoardActor` for a request |
| `lib/board-view.ts` | Pure payload shaping for a viewer, used by GET and by Ably publishes |
| `lib/board-publish.ts` | Thin wrapper: shape for `PUBLIC_VIEWER`, then publish |
| `app/api/boards/**` routes (modify) | Call actor, guard, shaper |
| `app/api/ably-token/route.ts` (modify) | Client id bound to the participant session |
| `stores/boardStore.ts`, `hooks/useBoardChannel.ts`, `types/index.ts`, card components (modify) | Use `is_mine` and `text_hidden`, refetch on reveal, drop the admin hint |
| `playwright.config.ts`, `e2e/*.spec.ts` | Two-browser leak test and API authorization tests |

---

### Task 1: Environments and migration

**Files:**
- Create: `scripts/migrations/011_trust_version.sql`
- Modify: `scripts/run-one.mjs`, `.env.example`, `.env.local` (not committed)

**Interfaces:**
- Produces: column `boards.trust_version SMALLINT NOT NULL DEFAULT 1`; env vars `PARTICIPANT_SESSION_SECRET`, `NEON_BRANCH`.

Needs from Jordan before this task: the API key of a second Ably app named `retro-board-dev` (see handoff message).

- [ ] **Step 1:** Create branch `feature/trust-foundation` from `origin/develop`.
- [ ] **Step 2:** In `.env.local`, switch `DATABASE_URL` to the Neon `dev` branch connection string and `ABLY_API_KEY` to the dev app key in the same edit (a dev database with the production Ably key would publish onto live board channels, because the branch copied production board ids). Add `NEON_BRANCH=dev` and `PARTICIPANT_SESSION_SECRET` (output of `openssl rand -base64 32`). Keep the production values out of the file.
- [ ] **Step 3:** Write the migration:

```sql
ALTER TABLE boards ADD COLUMN IF NOT EXISTS trust_version SMALLINT NOT NULL DEFAULT 1;
COMMENT ON COLUMN boards.trust_version IS '1 = legacy client-trusted identity; 2 = signed participant sessions and shaped payloads';
```

- [ ] **Step 4:** In `scripts/run-one.mjs`, before connecting: print the host part of `DATABASE_URL`; exit 1 with "Refusing to migrate a non-dev database without --prod" unless `process.env.NEON_BRANCH === 'dev'` or `process.argv.includes('--prod')`.
- [ ] **Step 5:** Run `node --env-file=.env.local scripts/run-one.mjs scripts/migrations/011_trust_version.sql`. Expected: prints the dev host, then `Applied scripts/migrations/011_trust_version.sql`.
- [ ] **Step 6:** Add `PARTICIPANT_SESSION_SECRET=` and `NEON_BRANCH=dev` with one-line comments to `.env.example`. Add `PARTICIPANT_SESSION_SECRET=ci-dummy-secret-at-least-32-characters-long` to `build-env` in `.github/workflows/ci.yml`.
- [ ] **Step 7:** Run `npm test`. Expected: all existing tests pass. Commit the migration, script, `.env.example` and workflow.

### Task 2: Participant session token

**Files:**
- Create: `lib/participant-session.ts`, `lib/__tests__/participant-session.test.ts`

**Interfaces:**
- Produces:

```ts
export const PARTICIPANT_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 90;
export function cookieNameFor(boardId: string): string;                 // `rb_ps_${boardId}`
export function signParticipantSession(boardId: string, participantId: string, nowSec?: number): string;
export function verifyParticipantSession(boardId: string, token: string | null | undefined, nowSec?: number): { participantId: string } | null;
export function readParticipantId(request: Request, boardId: string): string | null;   // parses the Cookie header
export function setParticipantCookie(response: NextResponse, boardId: string, participantId: string): void;
```

Token format: `${participantId}.${issuedAtSec}.${sig}` where `sig` is base64url HMAC-SHA256 of `${boardId}.${participantId}.${issuedAtSec}` keyed by `PARTICIPANT_SESSION_SECRET`. Cookie: `httpOnly`, `sameSite: 'lax'`, `secure` when `NODE_ENV === 'production'`, `path: '/'`, `maxAge` as above. The secret is read inside the functions; a missing or shorter-than-32-character secret throws `Error('PARTICIPANT_SESSION_SECRET is not set or too short')`.

- [ ] **Step 1:** Write failing tests (set `process.env.PARTICIPANT_SESSION_SECRET` in `beforeAll`):
  - `round-trips`: `verify('b1', sign('b1','p1'))` equals `{ participantId: 'p1' }`.
  - `rejects another board`: `verify('b2', sign('b1','p1'))` is `null`.
  - `rejects tampering`: flipping the last character of the token gives `null`; replacing the participant id segment gives `null`.
  - `rejects expiry`: `verify('b1', sign('b1','p1', 1000), 1000 + PARTICIPANT_SESSION_MAX_AGE_SEC + 1)` is `null`.
  - `rejects garbage`: `undefined`, `''`, `'a.b'`, `'a.notanumber.c'` all give `null`.
  - `reads the cookie header`: a `Request` with `Cookie: other=1; rb_ps_b1=<token>` returns `'p1'` from `readParticipantId(req,'b1')` and `null` for `'b2'`.
  - `throws without a secret`.
- [ ] **Step 2:** Run `npx vitest run lib/__tests__/participant-session.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement with `node:crypto` `createHmac` and `timingSafeEqual` (compare equal-length buffers only).
- [ ] **Step 4:** Run the test file. Expected: PASS. Commit.

### Task 3: Actions list and guard

**Files:**
- Create: `lib/constants/board-actions.ts`, `lib/board-guards.ts`, `lib/__tests__/board-guards.test.ts`
- Modify: `types/index.ts` (add `trust_version: 1 | 2` to `Board`)

**Interfaces:**
- Produces:

```ts
// lib/constants/board-actions.ts
export const BOARD_ACTIONS = [
  'card.create', 'card.edit', 'card.delete', 'card.move', 'card.react',
  'vote.toggle', 'column.write', 'participant.manage', 'participant.leave',
  'action-item.write', 'board.settings',
] as const;
export type BoardAction = (typeof BOARD_ACTIONS)[number];

// lib/board-guards.ts
export interface BoardActor {
  boardId: string;
  trustVersion: 1 | 2;
  participantId: string | null;   // v2: from the cookie. v1: whatever the body claimed.
  userId: string | null;
  isFacilitator: boolean;         // signed-in authority, or (v2 only) participants.is_admin
}
export interface BoardState { archived: boolean; settings: BoardSettings; }
export interface ActionTarget { authorId?: string | null; participantId?: string | null; }
export type GuardResult = { ok: true } | { ok: false; status: 401 | 403 | 409; error: string };
export function checkAction(action: BoardAction, actor: BoardActor, state: BoardState, target?: ActionTarget): GuardResult;
export function reactionsChangeOnlyTouches(prev: CardReactions, next: CardReactions, participantId: string): boolean;
```

Rules, applied in this order:

1. State, every board: if `state.archived`, every action is 409 "Board is completed". If `settings.board_locked` and the actor is not a facilitator, `card.*`, `vote.toggle` and `action-item.write` are 409 "Board is locked". If `!settings.voting_enabled`, `vote.toggle` is 409 "Voting is closed". If `settings.card_creation_disabled` and the actor is not a facilitator, `card.create` is 409 "Card creation is off".
2. Identity, v2 only: `participantId === null` and not a facilitator gives 401 "Join the board first". `card.edit` and `card.delete` need `target.authorId === actor.participantId` or facilitator, else 403. `column.write`, `participant.manage` and `board.settings` need facilitator, else 403. `participant.leave` needs `target.participantId === actor.participantId`, else 403.
3. v1 boards skip rule 2 except `board.settings`, which stays facilitator-only as it is today.

`reactionsChangeOnlyTouches` returns true when, for every emoji, the symmetric difference between the previous and next id lists is empty or exactly `[participantId]`.

- [ ] **Step 1:** Write failing tests. Use a `actor(overrides)` and `state(overrides)` helper with defaults v2, participant `p1`, not facilitator, board open with `voting_enabled: true`.
  - Contract: for every value in `BOARD_ACTIONS`, `checkAction(a, facilitatorActor, openState, {authorId:'p1', participantId:'p1'})` is `{ ok: true }`, and on an archived state is status 409. This fails the day someone adds an action without a rule.
  - One test per rule line above with the exact status and error string, including: author edits own card ok; other participant edits gives 403; facilitator edits another's card ok; v1 actor with `participantId: 'anything'` editing another's card ok; v1 locked board `card.create` 409; v2 `participantId: null` `card.create` 401; locked board facilitator `card.create` ok; `vote.toggle` with voting off is 409 even for a facilitator.
  - Reactions: adding own id ok; removing own id ok; adding someone else's id false; removing someone else's id false; adding a new emoji with only own id ok.
- [ ] **Step 2:** Run `npx vitest run lib/__tests__/board-guards.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. `checkAction` uses a `switch` over `BoardAction` with a `never` default so TypeScript rejects a missing case.
- [ ] **Step 4:** Run. Expected: PASS. Run `npx tsc --noEmit`. Commit.

### Task 4: Viewer payload shaping

**Files:**
- Create: `lib/board-view.ts`, `lib/__tests__/board-view.test.ts`
- Modify: `types/index.ts`

**Interfaces:**
- Consumes: `BoardSettings`, `Card`, `Vote` from `types`.
- Produces:

```ts
// types/index.ts: Card.author_id and Card.author_name become `string | null`; add
//   is_mine?: boolean; text_hidden?: boolean;
export interface Viewer { participantId: string | null; }
export const PUBLIC_VIEWER: Viewer = { participantId: null };
export interface ViewBoard { trust_version: 1 | 2; settings: BoardSettings; archived_at: string | null; }
export function shapeCard(card: Card, board: ViewBoard, viewer: Viewer): Card;
export function shapeVotes(votes: Vote[], board: ViewBoard, viewer: Viewer): Vote[];
export function votesAreSecret(board: ViewBoard): boolean;
export function isRevealingChange(prev: BoardSettings, next: BoardSettings): boolean;
```

Rules:
- v1 board: `shapeCard` returns the card with `is_mine` set and `text_hidden: false`, nothing removed. `shapeVotes` returns all votes.
- v2 board: `is_mine = card.author_id === viewer.participantId` (false when the viewer is null). If `settings.card_visibility === 'hidden'` and not mine and the board is not archived: `text: ''`, `text_hidden: true`. If `settings.anonymous_cards` and not mine: `author_id: null`, `author_name: null`. The facilitator gets no exception to either rule.
- `votesAreSecret` is true on a v2 board with `settings.secret_voting` and no `archived_at`. When secret, `shapeVotes` returns only votes whose `voter_id === viewer.participantId`.
- `isRevealingChange` is true when `card_visibility` goes hidden to visible, `secret_voting` goes true to false, or `anonymous_cards` goes true to false.

- [ ] **Step 1:** Write failing tests, one per rule, plus: a hidden card's shaped JSON for `PUBLIC_VIEWER` does not contain the original text or author name anywhere (`JSON.stringify(shaped)` does not include them) when both hidden and anonymous are on; an archived v2 board returns full text and all votes.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement as pure functions with no imports from `lib/db` or `lib/ably-server`.
- [ ] **Step 4:** Run tests and `npx tsc --noEmit`. Fix any compile errors the nullable author fields cause in components by rendering a fallback of `'Anonymous'` for a null name. Commit.

### Task 5: Actor loader, board creation and join

**Files:**
- Create: `lib/board-actor.ts`
- Modify: `app/api/boards/route.ts`, `app/api/boards/[boardId]/join/route.ts`, `stores/boardStore.ts` (`createBoard` near line 102, `joinBoard` near lines 264 to 298)
- Test: `e2e/api-authz.spec.ts` is written in Task 9; this task is verified by `tsc` and a manual curl.

**Interfaces:**
- Consumes: `readParticipantId`, `setParticipantCookie`, `resolveBoardAuthority`, `getSessionOrNull`, `BoardActor`, `BoardState`.
- Produces:

```ts
export interface LoadedBoard {
  actor: BoardActor;
  state: BoardState;
  board: { id: string; trust_version: 1 | 2; settings: BoardSettings; archived_at: string | null; deleted_at: string | null; owner_id: string | null };
}
/** Returns null when the board does not exist or is in Trash. */
export async function loadBoardActor(request: Request, boardId: string, legacyParticipantId?: string | null): Promise<LoadedBoard | null>;
export function guardResponse(result: GuardResult): NextResponse | null;   // null when ok
```

`loadBoardActor`: one query for the board row; session via `getSessionOrNull`; if a user is signed in, one query for owner, member role and system admin (same SQL as `loadBoardAuthority` in `lib/auth-helpers.ts`; export and reuse that query instead of copying it). On v2, the participant id comes from `readParticipantId` and must exist in `participants` for this board, otherwise it is null; `isFacilitator` is authority or that row's `is_admin`. On v1, `participantId` is `legacyParticipantId ?? null` and `isFacilitator` is authority only.

- [ ] **Step 1:** Implement `lib/board-actor.ts`.
- [ ] **Step 2:** `POST /api/boards`: insert `trust_version = 2`. Ignore `participant.isAdmin` from the body and always insert the creator participant with `is_admin = true`. Build the response with `NextResponse.json` and call `setParticipantCookie(res, id, participant.id)` when a participant was inserted.
- [ ] **Step 3:** `POST /api/boards/[boardId]/join`: return 404 when `loadBoardActor` is null. Stop reading `isAdmin` from the body; `isAdmin` is true only from the existing ownership query. On a v2 board: if the cookie already resolves to a participant on this board, update its display name and return it with `reused: true`; otherwise generate the participant id on the server with `nanoid()` and ignore the client's. Remove the `UPDATE boards SET created_by` statement. Set the cookie on every successful response, v1 included. The signed-in reuse path stays first and also sets the cookie.
- [ ] **Step 4:** In `stores/boardStore.ts`, remove `isAdmin` from both request bodies and delete the `hasAdmin` computation at line 281. Keep using the returned `participant.id` as `actualId`.
- [ ] **Step 5:** Run `npx tsc --noEmit && npm test`. Start `npm run dev`, then: `curl -i -X POST localhost:3000/api/boards/<v2 id>/join -H 'content-type: application/json' -d '{"participantId":"x","displayName":"T","isAdmin":true}'`. Expected: 200, `Set-Cookie: rb_ps_<id>=...; HttpOnly`, and `"is_admin":false` in the body. Commit.

### Task 6: Guard every write route

**Files:**
- Modify: `app/api/boards/[boardId]/cards/route.ts`, `votes/route.ts`, `columns/route.ts`, `participants/route.ts`, `action-items/route.ts`, `route.ts` (PATCH and `complete`)

**Interfaces:**
- Consumes: `loadBoardActor`, `guardResponse`, `checkAction`, `reactionsChangeOnlyTouches`.

Each handler starts the same way: `const loaded = await loadBoardActor(request, boardId, <id the body claims>)`; 404 if null; then `const denied = guardResponse(checkAction(action, loaded.actor, loaded.state, target)); if (denied) return denied;`. On v2, every identity written to the database comes from `loaded.actor.participantId`, never from the body.

- [ ] **Step 1: cards.** POST is `card.create`; on v2 `author_id` is the actor's participant id and `author_name` is that participant's `display_name` from the database. PATCH loads the card first (404 if missing) and maps fields to actions: `text` or `color` is `card.edit` with `target.authorId`; `column_id`, `position` or `merged_with` is `card.move`; `reactions` is `card.react`, and on v2 also requires `reactionsChangeOnlyTouches(card.reactions, updates.reactions, actor.participantId)` or 403. A request mixing fields must pass every guard it touches. Apply the same 1 to 2000 character check to `updates.text` that POST has. DELETE is `card.delete` with `target.authorId`.
- [ ] **Step 2: votes.** `vote.toggle`. On v2 the voter id is the actor's participant id. Guard runs before the existing-vote lookup, so removing a vote also respects archived, locked and voting-off.
- [ ] **Step 3: columns.** All three verbs are `column.write`.
- [ ] **Step 4: participants.** PATCH is `participant.manage`. DELETE is `participant.leave` when the body's `participantId` equals the actor's, otherwise `participant.manage`.
- [ ] **Step 5: action items.** All three verbs are `action-item.write`. On v2, `created_by` is the actor's participant id.
- [ ] **Step 6: board route.** PATCH and `complete` use `checkAction('board.settings', ...)` through the actor, replacing `assertCanFacilitate`, so a v2 creator without an account can change settings and complete. `reopen`, `restore`, `purge` and DELETE keep `assertBoardOwner`. `complete` must skip the archived state rule: call the guard with `state.archived` forced false only for a board that is not yet archived; an already archived board returns 409.
- [ ] **Step 7:** Run `npx tsc --noEmit && npm test`. With `npm run dev` running, on a v1 board from the dev database confirm `POST /cards` with body ids still returns 200, and after setting `board_locked` true it returns 409 "Board is locked". Commit.

### Task 7: Shaped reads, shaped publishes, bound Ably token

**Files:**
- Create: `lib/board-publish.ts`
- Modify: `app/api/boards/[boardId]/route.ts` (GET, PATCH), `cards/route.ts`, `votes/route.ts`, `app/api/ably-token/route.ts`

**Interfaces:**
- Consumes: `shapeCard`, `shapeVotes`, `votesAreSecret`, `isRevealingChange`, `PUBLIC_VIEWER`, `loadBoardActor`.
- Produces:

```ts
export async function publishCard(boardId: string, event: 'card-created' | 'card-updated', card: Card, board: ViewBoard): Promise<void>;
export async function publishVote(boardId: string, event: 'vote-cast' | 'vote-removed', payload: object, board: ViewBoard): Promise<void>;
```

`publishCard` publishes `{ card: shapeCard(card, board, PUBLIC_VIEWER) }`. `publishVote` publishes nothing when `votesAreSecret(board)`, otherwise the payload unchanged.

- [ ] **Step 1: GET.** Resolve the viewer with `loadBoardActor`. Return `cards.map(c => shapeCard(c, board, viewer))` and `shapeVotes(votes, board, viewer)`. Add `youAre: { participantId, isFacilitator }` to the response; on v2, `yourParticipantId` falls back to the cookie participant when no signed-in match exists, and `youCanFacilitate` is the actor's `isFacilitator`. A v2 viewer with no session still gets the board, shaped for `PUBLIC_VIEWER`, so the join modal can render.
- [ ] **Step 2: card and vote routes.** Replace direct `channel.publish` of card and vote events with `publishCard` and `publishVote`. The HTTP response to the caller is shaped for the caller (`shapeCard(card, board, { participantId: actor.participantId })`), so an author gets their own text back.
- [ ] **Step 3: board PATCH.** When `body.settings` is present, load the previous settings first and add `refetch: true` to the `board-updated` payload if `isRevealingChange(prev, next)`. `board-completed` always carries `refetch: true`.
- [ ] **Step 4: ably-token.** Load the actor. On a v2 board: 401 when there is no participant session; the token's `clientId` is the session participant id and the `clientId` query parameter is ignored. On a v1 board the query `clientId` is still used. On every board the capability for `retro-board:{boardId}` drops `publish` (first run `grep -rn "publish(" hooks components stores` and confirm the only client publishes are on the `:timer` channel in `hooks/useTimer.ts`; if anything publishes on the main channel, stop and report). The `:timer` channel keeps `subscribe`, `publish` and `presence`; storing the timer server-side is Step 1 of the spec.
- [ ] **Step 5:** `npx tsc --noEmit && npm test`. Commit.

### Task 8: Client follows the server

**Files:**
- Modify: `stores/boardStore.ts`, `hooks/useBoardChannel.ts`, `components/providers/AblyProvider.tsx`, `components/pages/BoardPageWrapper.tsx`, `components/Board/RetroCard.tsx` and any other component found by `grep -rn "author_id" components utils`
- Create: `lib/mergeIncomingCard.ts`, `lib/__tests__/mergeIncomingCard.test.ts`

**Interfaces:**
- Produces: `export function mergeIncomingCard(local: Card | undefined, incoming: Card): Card;`

`mergeIncomingCard`: when `incoming.text_hidden` and `local?.is_mine`, keep `local.text`, `local.author_id`, `local.author_name` and `is_mine: true`, and take every other field from `incoming`. When `local?.is_mine` and incoming has a null `author_id`, keep the local author fields and `is_mine`. Otherwise return `incoming`.

- [ ] **Step 1:** Failing tests for `mergeIncomingCard`: own hidden card keeps its text while position and reactions update; someone else's hidden card stays hidden; a revealed incoming card replaces local text; `local` undefined returns incoming.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.
- [ ] **Step 3:** `useBoardChannel`: `card-updated` uses `mergeIncomingCard(existing, data.card)`. `board-updated` and `board-completed` call `store.getState().fetchBoard(boardId)` when `data.refetch` is true (use the store's existing fetch action name). Leave the id-exists checks on the three `-created` cases untouched.
- [ ] **Step 4:** `boardStore`: optimistic cards are created with `is_mine: true`. Replace ownership checks of the form `card.author_id === currentParticipantId` across components with `card.is_mine`. Where a card has `text_hidden`, render the existing hidden-card placeholder instead of blurred text.
- [ ] **Step 5:** `AblyProvider` and `BoardPageWrapper`: the provider must not mount for a v2 board until a participant exists (after join resolves), because the token route now returns 401 without a session. Read `BoardPageWrapper.tsx` around line 32 and gate on the current participant id.
- [ ] **Step 6:** `npx tsc --noEmit && npm test`. Commit.

### Task 9: Playwright, two browsers, and browser verification

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/hidden-cards.spec.ts`, `e2e/api-authz.spec.ts`
- Modify: `package.json` (`"test:e2e": "playwright test"`, devDependency `@playwright/test`), `.gitignore` (`test-results/`, `playwright-report/`), `vitest.config.ts` only if it starts picking up `e2e/`

**Interfaces:**
- Produces: `e2e/helpers.ts` exports `createBoard(request, opts): Promise<{ boardId: string }>` and `joinAs(context, boardId, name): Promise<Page>`.

`playwright.config.ts`: `webServer` runs `npm run dev` on the port in `NEXT_PUBLIC_APP_URL` from `.env.local`, `reuseExistingServer: true`, chromium only, `workers: 1`. The config throws at load if `process.env.NEON_BRANCH !== 'dev'`.

- [ ] **Step 1: `hidden-cards.spec.ts`.** Two browser contexts, A and B, on one new board with cards hidden and `anonymous_cards` on. Before A writes, attach to B: `page.on('response')` collecting every response body from the app origin, and `page.on('websocket')` with `framereceived` collecting every frame payload. A adds a card with text `SECRET-<random>` and display name `Alice-<random>`. Wait until B shows one hidden card in that column. Assert neither random string appears in any collected body or frame, and not in `await pageB.content()`. Then the facilitator (A, the creator) reveals cards; assert B shows the text within 5 seconds without a reload.
- [ ] **Step 2: secret votes.** Same board with voting on and `secret_voting` on: A votes; assert B's collected bodies and frames never contain A's participant id in a vote payload and B's UI shows no vote on the card; turning secret voting off shows the vote to B.
- [ ] **Step 3: `api-authz.spec.ts`** using Playwright `request` contexts (one per identity). On a new v2 board: joining with `isAdmin: true` in the body yields `is_admin: false`; B editing A's card text is 403; B deleting A's card is 403; B setting `is_admin` on themselves is 403; B deleting participant A is 403; B posting a column is 403; a request with no cookie posting a card is 401; a cookie from another board is 401; a vote with a forged `voterId` in the body is recorded for the cookie's participant; adding another participant's id to a reaction is 403; after `complete`, a card POST is 409. On a v1 board (insert one in the dev database with `trust_version = 1` through the helper): a card POST with body ids is 200, and 409 once `board_locked` is true.
- [ ] **Step 4:** Run `npm run test:e2e`. Expected: all pass. If any assertion in Step 1 or 2 fails, that is a leak; fix the route or publish, do not loosen the test.
- [ ] **Step 5: browser check** (the `ui-feature-verify` gate). In two real browser profiles against the dev server: create a board, join from the second profile, add cards from both with cards hidden, edit your own card, confirm you cannot see the other's text, reveal, vote, lock the board and confirm the second profile cannot add a card, complete the board. Also open one v1 board from the dev database and confirm it loads and accepts a card. Record what was observed in the PR description.
- [ ] **Step 6:** Commit.

### Task 10: Preview environment, PR, promotion notes

**Files:**
- Modify: `.claude/context/session-handoff.md`, `.claude/context/architecture-notes.md`, `CLAUDE.md` (Critical Patterns: participant session cookie, `trust_version`, `checkAction`, `board-view`; Branches: `npm run test:e2e`)

- [ ] **Step 1:** In Vercel, for the Preview environment only, set `DATABASE_URL` (Neon `dev`), `ABLY_API_KEY` (dev app) and `PARTICIPANT_SESSION_SECRET` (new random value). For Production set only `PARTICIPANT_SESSION_SECRET` (a different random value). Production `DATABASE_URL` and `ABLY_API_KEY` are not touched.
- [ ] **Step 2:** `npx tsc --noEmit && npm run build && npm test && npm run test:e2e` (dev server stopped for the build). Open the PR to `develop` with the test output and the browser observations.
- [ ] **Step 3:** Promotion to `main` is Jordan's call. Before it: run migration 011 against production with `--prod` (additive, safe under the old code), confirm `PARTICIPANT_SESSION_SECRET` exists in Production, then merge. Note in the PR that `feature/phase0-billing` must rebase onto this work afterwards (both edit `app/api/boards/route.ts` and `app/api/boards/[boardId]/route.ts`).
- [ ] **Step 4:** Update the context files and commit.

## Out of scope here

Phases, guided mode, stored timer and facilitator-only timer publishing (Step 1). Join approval and invite-only enforcement (Step 10). Entitlements and the one-free-retro rule (billing branch). Migrating v1 boards to v2 (the spec rules it out: every client already knows every v1 participant id).
