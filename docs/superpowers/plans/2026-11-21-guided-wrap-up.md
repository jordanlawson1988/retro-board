# Wrap-up (Parabol parity Step 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A completed guided retro has a read-only summary page at `/board/[boardId]/summary` (headline numbers, topics in agenda order with their cards, comment threads and action items, other action items, participants) that prints to a clean black-on-white PDF from the browser, a `View summary` link on the completed board, and, behind its own `summary_email` flag that stays off, a short summary email to the account holders connected to the board with a one-click unsubscribe and an account setting. Open boards stay exactly as they are, and no step of this plan can send a real email.

**Architecture:** One pure function, `buildRetroSummary` in `lib/summary.ts`, turns shaped board data into the summary's sections; the page and the email both use it. The page is a thin server component that answers a real 404 unless the board exists, is not in Trash and is guided (read defensively with `to_jsonb(b) ->> 'mode'`, so it runs safely on a database without migration 015), and then a client component that calls the EXISTING board GET and renders from its shaped payload, so the access rule, every shaper and the "closed to you" payload stay in exactly one place. Print is a stylesheet block in `styles/index.css` scoped to `[data-summary-root]` plus `window.print()`. Email goes through one function, `sendMail` in `lib/mail/send.ts`, whose transport is `resend` only when `SUMMARY_EMAIL_TRANSPORT` is exactly `resend` (set nowhere by this plan); otherwise it records each message in a new `email_outbox` table, and the Resend client module is loaded only on the `resend` branch. The guided complete statement becomes conditional on `archived_at IS NULL` and, after it succeeds, schedules `dispatchSummaryEmail` with `after()` from `next/server`: that function checks the `summary_email` flag first, reads a snapshot, claims one `summary_email_sends` row per eligible recipient (the idempotency key is board, completion time and user) in the same statement that selects the recipients, sends, and records each row's outcome. Migration 018 adds `email_preferences`, `summary_email_sends`, `email_outbox` and the `summary_email` flag row (off). Unsubscribe is a signed token (HMAC, key derived from `PARTICIPANT_SESSION_SECRET`) checked before any database call.

**Tech Stack:** Next.js 16 App Router (server and client components, route handlers, `after()`), `@neondatabase/serverless`, Resend SDK 6 (batch send, only on the `resend` branch), Better Auth sessions, Zustand 5 (read only), Tailwind CSS 4 with CSS custom-property tokens, Vitest (node), Playwright (Chromium, `page.emulateMedia`, `page.pdf`).

**Spec:** `docs/superpowers/specs/2026-11-12-parabol-parity-design.md` (sections "After the retro and across retros", "Design decisions" ("People without accounts stay inside the board", "The summary is a board view", "One function shapes what each viewer may see", "Done means completed", "Entitlements go through one helper"), "Step 4: wrap-up", "Step 5: AI", "Step 6: continuity", "Not building", "Risks"). Step 3 plan (format model and the code this builds on): `docs/superpowers/plans/2026-11-20-guided-discuss.md`. Ledgers with rulings: `.superpowers/sdd/2026-11-20-guided-discuss/progress.md` (R1 to R19), `.superpowers/sdd/2026-11-20-guided-group-vote/progress.md` (R1 to R19).

## Global Constraints

- Work in `/Users/jordan.lawson/Projects/retro-board/.worktrees/guided-mode-core` on branch `feature/guided-wrap-up` (starts at 8d0a676, the finished Step 3). Do not switch branches and do not `cd` to the parent repository. The PR targets `feature/guided-discuss` (PR #31) until that PR merges; the controller decides. Never push to `develop` or `main`. No task pushes or opens a pull request.
- Commits: conventional commit subjects; never `git commit -a`, `-am` or `git add -A`; stage files by name. Every commit message ends with a blank line and then exactly the line `Claude-Session: https://claude.ai/code/session_01Y4KwMbz98PW3K8YxSqvEY9`. `next-env.d.ts` is restored if a build or dev run changes it and is never committed.
- **THE EMAIL RULES (D6). No command in any task sends a real email. If a step seems to require one, stop and report.**
  - `.env.local` holds a real `RESEND_API_KEY`, and the dev database is a copy of production with real people's addresses. Nothing in this plan may cause a message to reach Resend or any mail server.
  - There is ONE send function, `sendMail` in `lib/mail/send.ts`. It uses the Resend transport only when `process.env.SUMMARY_EMAIL_TRANSPORT === 'resend'` (exact string). In every other case it records the message in the `email_outbox` table (refusing, with a recorded failure, when `VERCEL_ENV === 'production'`).
  - No task, script, test or command sets `SUMMARY_EMAIL_TRANSPORT` anywhere (not in `.env.local`, not in a shell, not in Vercel, not in a test). Before starting a dev server or any e2e run, check `grep -c '^SUMMARY_EMAIL_TRANSPORT' .env.local` prints `0` and `printenv SUMMARY_EMAIL_TRANSPORT` prints nothing; if either is not so, stop and report.
  - Second, independent guard: the feature is behind the `summary_email` feature flag, OFF by default everywhere (migration 018 inserts it off). With the flag off, completion sends nothing and records nothing. The flag is turned on only by `setFlagDirect('summary_email', true)` against the dev database inside the e2e spec's `beforeAll` (turned off in its `afterAll`, and forced off by e2e global teardown) and inside the Task 6 observation script (turned off at its end). Never anywhere else.
  - Third guard: when the transport is not `resend`, the Resend client is never constructed. `lib/mail/send.ts` loads `lib/mail/resend-transport.ts` only through `await import(...)` on the `resend` branch, and `new Resend(...)` appears only inside a function in that file. A unit test proves both.
  - Every account an e2e test or observation creates has an address ending in `@example.com` (a reserved domain). No step requests a password reset.
  - Turning on the flag or the transport in production is the owner's action, listed under "Before this is turned on". No task step does it.
- Migration: `scripts/migrations/018_wrap_up.sql`, additive, guarded, re-runnable, one transaction, in the style of 015 to 017. Applied to the Neon `dev` branch only, by Task 2, with the 017 safety steps: the runner prints the target host and it must be the dev host (`ep-calm-breeze...`); never pass `--prod`; never set `NEON_BRANCH` on the command line; prove every constraint inside a transaction that is rolled back; read the result back. Production has migrations up to 014; applying 015 to 018 there belongs to a later promotion.
- Production safety (D2): no SQL statement on a path an open board can take, or on a path every user hits (sign-in, account settings, dashboard, the public flags route), may name a column or table added by 015 to 018 (`mode`, `phase`, `phase_config`, `votes.count`, `cards.group_title`, `comments`, `action_items.card_id`, `action_items.assignee_participant_id`, `email_preferences`, `summary_email_sends`, `email_outbox`). Each new statement is kept off shared paths as follows, and each task's tests pin it:

| Statement | Runs only | Why it is safe without 015 to 018 |
|---|---|---|
| Summary route lookup (Task 8) | on `/board/[id]/summary` | reads `to_jsonb(b) ->> 'mode'`, never the column; a row without `mode` is not guided, so 404 |
| Preference read and write (Task 5) | inside `/api/user/email-preferences`, after `canUse('summary_email')` is true | the flag row does not exist before 018, so `canUse` is false and the route answers 404 before naming the table; the settings page calls the route only when the public flags response says the flag is on |
| Unsubscribe write (Task 5) | inside `POST /api/email/unsubscribe`, after the token verifies | a valid token exists only in an email this feature sent, which needs 018 |
| Dispatch snapshot, claim, status update, outbox insert (Tasks 3, 7) | inside `after()` scheduled by the GUIDED complete branch, after `canUse('summary_email')` is true | no guided board can exist before 015; the flag is false before 018; every error is caught and logged by code only |
| Guided complete with `AND archived_at IS NULL` (Task 7) | the guided branch of the complete handler, chosen in TypeScript after the mode check | names only `phase`, `phase_config`, `archived_at` on a guided board (as today) |

- Pins before editing shared files: the open complete and open reopen statements are pinned in `guided-lifecycle.test.ts` and must pass unchanged; the open GET's five statements are pinned in `get-round-trips.test.ts` and the board GET is NOT edited by this plan; `sendPasswordResetEmail` is pinned by a new test BEFORE `lib/email.ts` changes (Task 3); `guidedModeEnabled` and `canUse` keep their existing tests unchanged (Task 1).
- Known open-board difference: none. No open-board request, response, event, statement text, rendering or store subscription changes. Completing an open board runs exactly today's statement, publishes exactly today's event and schedules nothing.
- All development and tests use the Neon `dev` branch and the Ably app `retro-board-dev` (`NEON_BRANCH=dev`). Dev server port 3001. `lib/db.ts` and `lib/auth.ts` stay lazy; import `ably-server` inside functions; the summary-email modules import nothing at module level that connects to anything.
- Identity only from the signed participant cookie or the Better Auth session; never from a request body. The preference routes take the user id from the session; the unsubscribe route takes it from the verified token. Every board-scoped read goes through the board GET (and so `loadBoardActor`, `boardAccessFrom` and the shapers); the email's snapshot is shaped with `PUBLIC_VIEWER` before anything reads it. Nothing is returned, rendered or mailed unshaped.
- No board action is added; the exhaustive `BOARD_ACTIONS` vocabulary does not change (`complete` already exists and keeps its guard `board.settings`).
- Messages, limits, labels, statuses, kinds, transport names, rate limits and the flag key are declared once in `lib/constants/` and imported. Before adding a vocabulary, grep for its values. Components and routes do not spell out copy, limits or flag keys.
- Any client write rejects to a visible message and handlers catch; this plan adds no store write (the summary page and the settings section keep their state locally). No hook mounted in `BoardPage` updates React state on a timer; this plan adds no timers anywhere.
- Any dialog opened from the sticky board header renders through a portal; this plan opens none.
- Unit tests run in Vitest's node environment; components cannot be rendered, so decisions live in tested pure functions and components stay thin. No new dependencies, no DOM test environment.
- `npm run lint` is broken on Next 16: run `npx eslint <the files you changed>`.
- Run one e2e spec with `npx playwright test e2e/<file>`; `npm run test:e2e` runs everything.
- A dev server started for observation: check the email rules' two checks first, check port 3001 (`lsof -ti tcp:3001` must print nothing), start with `npm run dev -- -p 3001 &`, note the PID, stop it with `kill <PID>`. Never kill by name. Never run `npm run build` while it runs.
- A UI task is done only after it was seen in a real browser at 1280px, 390px and 360px, in light and dark themes, with open-board readings taken before and after the change (the same readings, listed in the report) and screenshots saved under `.superpowers/sdd/2026-11-21-guided-wrap-up/observe-<task number>/` for the controller to open. Switch themes in scripts through the app's own control (the header theme toggle, `ThemeToggle`), then wait 1500 ms before reading or capturing. If the dev server cannot run, say so; do not claim success.
- The board page keeps both a desktop and a phone shell in the DOM: every locator on the board page targets the visible instance.
- Print is checked in Chromium with `page.emulateMedia({ media: 'print' })` (chrome hidden, content present, black on white) and `page.pdf()`, with one saved PDF the controller will open.
- Tests: logic is pure functions with unit tests written first. Every new SQL statement is EXPLAINed on the dev database by the task that adds it (plain `EXPLAIN`, never `ANALYZE`, through a throwaway script outside the repo carrying the same two guards as `e2e/e2e-run.ts` `devDb`), and executed for real by Task 11, except the preference read, which needs a signed-in session and is executed for real in Task 6's browser run. Every e2e assertion that something is ABSENT is paired with a control proving the capture or the query holds that kind of data. A guard test is shown able to fail once by a temporary mutation that is then reverted.
- UI copy is plain words with no em dashes. Every user-facing string and every email line in this plan is exact.
- Parabol is AGPL: copy behaviour only, no code or copy text.
- Baselines at the start (controller-run on 8d0a676): `npx tsc --noEmit` clean; `npm test` 1354 passing in 68 files; `npm run test:e2e` 104 passed, 0 failed, 1 skipped; `npm run build` passes.

## Review Focus

1. A facilitator completes, and either a second facilitator completes in the same instant or the owner reopens within seconds. Expected: one completion wins (the other gets 409 `Board is completed`), at most one email per eligible person per completion, and a completion undone before its `after()` work runs sends nothing (the claim requires the board to still carry that completion's `archived_at`). (Tasks 7, 11.)
2. A participant wrote an anonymous comment and the facilitator prints the summary. Expected: the comment reads `Anonymous` on every summary, its author's included; no summary says `You`; no card author appears; no HTTP body the summary page receives carries the author's id or name; the email carries no comment text at all. (Tasks 1, 4, 8, 11.)
3. One person is the owner, a member and a linked participant of the same board; another opted out; a third has an unverified address. Expected: exactly one email to the first, none to the other two, and the e2e board's outbox holds only `@example.com` addresses. (Tasks 7, 11.)
4. A mail scanner fetches every link in the email. Expected: `GET /email/unsubscribe` and `GET /api/email/unsubscribe` change nothing; only a POST opts out; a repeated POST answers the same; a forged token is refused before any database call; a valid token for a deleted account answers exactly like a live one. (Tasks 5, 6, 11.)
5. Someone in dark theme on a phone presses `Print or save as PDF`. Expected: black text on white, no header, no buttons, no `Back to the board`, topic headings kept with their first lines, the board's link printed in the footer. (Tasks 9, 11.)
6. The `summary_email` flag is off, or migration 018 is missing. Expected: completion answers 200 as today, nothing is recorded, nothing is sent, nothing throws into the response, and the settings page shows no Email section. (Tasks 5, 6, 7, 11.)
7. An open board after this ships. Expected: complete runs the pinned statement and schedules nothing, `/board/<id>/summary` is a real 404 identical to an unknown page, no `View summary` link appears, and no outbox or send row is written. (Tasks 7, 8, 10, 11.)

---

## File structure

| File | Responsibility |
|---|---|
| `lib/constants/summary.ts`, `lib/constants/email.ts`, `lib/constants/features.ts` (new) | Summary and email copy, statuses, kinds, transports, limits, rate limits, the flag keys |
| `lib/feature-flags.ts` (new); `lib/can-use.ts`, `lib/phases.ts` (modify) | Strict client reading of the public flags response; `FEATURES` moved to constants and re-exported |
| `lib/summary.ts` (new) | The pure summary model, labels and the page's view state |
| `scripts/migrations/018_wrap_up.sql` (new) | `email_preferences`, `summary_email_sends`, `email_outbox`, the `summary_email` flag row |
| `lib/mail/transport.ts`, `lib/mail/outbox-transport.ts`, `lib/mail/resend-transport.ts`, `lib/mail/send.ts` (new); `lib/email.ts` (modify) | The one send function, its transport seam and the outbox; the shared from-address |
| `lib/summary-email/render.ts`, `lib/email-unsubscribe.ts` (new) | Email subject, text, HTML and headers; the signed unsubscribe token |
| `lib/email-preferences.ts`, `app/api/user/email-preferences/route.ts`, `app/api/email/unsubscribe/route.ts` (new) | Opt-out store and its two authenticated writers |
| `app/email/unsubscribe/page.tsx`, `components/Email/UnsubscribeConfirm.tsx`, `lib/email-ui.ts` (new); `components/pages/SettingsPage.tsx` (modify) | Unsubscribe confirmation page; the Email section in account settings |
| `lib/summary-email/dispatch.ts`, `lib/summary-email/schedule.ts` (new); `app/api/boards/[boardId]/route.ts` (modify, guided complete only) | Recipients, claim, send and record; the completion hook |
| `app/board/[boardId]/summary/page.tsx`, `lib/summary-route.ts`, `components/Summary/*` (new) | The summary page |
| `styles/index.css` (modify) | The scoped print block |
| `components/Discuss/DiscussView.tsx`, `components/Discuss/MobileDiscuss.tsx` (modify) | The `View summary` link on a completed guided board |
| `e2e/guided-wrap-up.spec.ts` (new); `e2e/helpers.ts`, `e2e/e2e-run.ts`, `e2e/global-teardown.ts` (modify) | Two-browser run of everything above, with dev-only direct helpers |

---

### Task 1: Vocabulary and the summary model

**Files:**
- Create: `lib/constants/summary.ts`, `lib/constants/email.ts`, `lib/constants/features.ts`, `lib/feature-flags.ts`, `lib/summary.ts`
- Modify: `lib/can-use.ts`, `lib/phases.ts` (`guidedModeEnabled` only)
- Test: new `lib/__tests__/summary.test.ts`, `lib/__tests__/feature-flags.test.ts`; `lib/__tests__/can-use.test.ts` and `lib/__tests__/phases.test.ts` stay unchanged and green

- [ ] **Step 0: Grep before declaring.** Run `grep -rn "summary_email\|email_preferences\|email_outbox\|List-Unsubscribe\|SUMMARY_EMAIL\|In progress\|Print or save\|View summary" app lib stores hooks components types utils e2e scripts`. Expected: nothing. If anything appears, reuse it and report.

**Interfaces:**
- Produces (`lib/constants/features.ts`, client-safe, no imports): `FEATURES = ['guided_mode', 'summary_email'] as const`, `type Feature`, `GUIDED_MODE_FEATURE = FEATURES[0]`, `SUMMARY_EMAIL_FEATURE = FEATURES[1]` (literal types kept, the Step 3 Task 4 lesson). `lib/can-use.ts` deletes its own `FEATURES`/`Feature` and re-exports them: `export { FEATURES, type Feature } from '@/lib/constants/features';` (`canUse` itself is unchanged).
- Produces (`lib/feature-flags.ts`): `flagEnabled(response: unknown, key: Feature): boolean`: true only when `response.flags` is an array holding an object with that `key` and `is_enabled === true`; a missing flag, a failed or malformed response is false. `lib/phases.ts` `guidedModeEnabled(response)` becomes `return flagEnabled(response, GUIDED_MODE_FEATURE);` (behaviour identical; its tests in `phases.test.ts` pass unchanged).
- Produces (`lib/constants/email.ts`):
  - `EMAIL_FROM = 'RetroBoard <noreply@retroboard.live>'` (the value `lib/email.ts` spells today; Task 3 makes it import this).
  - `SUMMARY_EMAIL_TRANSPORT_ENV = 'SUMMARY_EMAIL_TRANSPORT'`; `MAIL_TRANSPORTS = ['outbox', 'resend'] as const`, `type MailTransportName`, `OUTBOX_TRANSPORT = MAIL_TRANSPORTS[0]`, `RESEND_TRANSPORT = MAIL_TRANSPORTS[1]`.
  - `EMAIL_KINDS = ['summary'] as const`, `type EmailKind`, `SUMMARY_EMAIL_KIND = EMAIL_KINDS[0]`.
  - `SUMMARY_SEND_STATUSES = ['pending', 'sent', 'recorded', 'failed'] as const`, `type SummarySendStatus`, `SEND_PENDING`, `SEND_SENT`, `SEND_RECORDED`, `SEND_FAILED` (each `SUMMARY_SEND_STATUSES[i]`).
  - `SUMMARY_EMAIL_MAX_RECIPIENTS = 100`, `SEND_ERROR_MAX = 500`, `SUMMARY_EMAIL_HEADING_MAX = 120`.
  - `OUTBOX_DISABLED_ERROR = 'The outbox transport does not run in production'`, `RESEND_KEY_MISSING_ERROR = 'RESEND_API_KEY is not set'`, `BASE_URL_MISSING_ERROR = 'No base URL is configured'`.
  - `EMAIL_PREFS_RATE_LIMIT = { key: 'email-prefs', limit: 30, window: 60 } as const`, `UNSUBSCRIBE_RATE_LIMIT = { key: 'unsubscribe', limit: 300, window: 60 } as const` (mail providers send one-click POSTs from shared addresses).
  - `UNSUBSCRIBE_PAGE_PATH = '/email/unsubscribe'`, `UNSUBSCRIBE_API_PATH = '/api/email/unsubscribe'`, `UNSUBSCRIBE_TOKEN_PURPOSE = 'summary_email'`.
  - Route messages: `SIGN_IN_REQUIRED_ERROR = 'Sign in required'`, `NOT_FOUND_ERROR = 'Not found'`.
  - Settings copy: `EMAIL_SECTION_TITLE = 'Email'`, `EMAIL_SECTION_DESCRIPTION = 'Choose which emails RetroBoard sends you.'`, `SUMMARY_EMAIL_SETTING_LABEL = 'Email me a summary when a retro I took part in is completed'`, `PREFERENCE_SAVED = 'Saved.'`, `PREFERENCE_SAVE_FAILED = 'Could not save. Try again.'`.
  - Unsubscribe copy: `UNSUBSCRIBE_TITLE = 'Stop summary emails'`, `UNSUBSCRIBE_BODY = 'You will no longer get an email when a retro you took part in is completed.'`, `UNSUBSCRIBE_BUTTON = 'Unsubscribe'`, `UNSUBSCRIBE_DONE = 'You are unsubscribed. You can turn summary emails back on in your account settings.'`, `ACCOUNT_SETTINGS_LINK = 'Account settings'`, `UNSUBSCRIBE_INVALID = 'This link is not valid.'`, `UNSUBSCRIBE_FAILED = 'Something went wrong. Try again.'`.
  - Email copy: `SUMMARY_EMAIL_INTRO = 'Your retro is complete. Here is a short summary.'`, `SUMMARY_EMAIL_TOPICS = 'Topics'`, `SUMMARY_EMAIL_ACTIONS = 'Action items'`, `SUMMARY_EMAIL_NO_ACTIONS = 'No action items.'`, `SUMMARY_EMAIL_FULL = 'See the full summary'`, `SUMMARY_EMAIL_WHY = 'You got this email because you took part in this retro on RetroBoard.'`, `SUMMARY_EMAIL_STOP = 'Stop getting summary emails'`, `NO_DUE_DATE = 'No due date'`.
- Produces (`lib/constants/summary.ts`): `SUMMARY_PAGE_TITLE = 'Retro summary'`, `BACK_TO_BOARD = 'Back to the board'`, `PRINT_BUTTON = 'Print or save as PDF'`, `AT_A_GLANCE = 'At a glance'`, `SUMMARY_TOPICS = 'Topics'`, `NO_TOPICS_DISCUSSED = 'No topics were discussed.'`, `SUMMARY_CARDS = 'Cards'`, `SUMMARY_DISCUSSION = 'Discussion'`, `NO_COMMENTS = 'No comments.'`, `SUMMARY_TOPIC_ACTIONS = 'Action items'`, `NO_TOPIC_ACTIONS = 'No action items for this topic.'`, `OTHER_ACTIONS = 'Other action items'`, `SUMMARY_PARTICIPANTS = 'Participants'`, `OWNER_PREFIX = 'Owner: '`, `DUE_PREFIX = 'Due: '`, `SUMMARY_NOT_READY = 'This summary will be ready when the retro is completed.'`, `SUMMARY_SIGN_IN_PROMPT = 'Took part with an account?'`, `SUMMARY_SIGN_IN_LINK = 'Sign in to see the summary'`, `SUMMARY_LOADING = 'Loading summary...'`, `SUMMARY_LOAD_FAILED = 'Could not load the summary.'`, `SUMMARY_RETRY = 'Try again'`, `SUMMARY_COMPLETED_BAR = 'This retro is completed.'`, `VIEW_SUMMARY = 'View summary'`, `SUMMARY_PRINT_FOOTER_PREFIX = 'From RetroBoard: '`, `GO_HOME = 'Go Home'`, `BOARD_NOT_FOUND_TITLE = 'Board not found'`, and `ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string> = { open: 'Open', in_progress: 'In progress', done: 'Done' }` (the `Record` type makes it exhaustive over `ACTION_ITEM_STATUSES`). The anonymous label reuses the string `'Anonymous'` through `SUMMARY_ANONYMOUS = 'Anonymous'`; the tombstone reuses `DELETED_COMMENT_TEXT`; the no-owner label reuses `NO_OWNER_LABEL` (`lib/constants/agenda.ts`).
- Produces (`lib/summary.ts`):

```ts
export interface SummaryInput {
  board: Pick<Board, 'id' | 'title' | 'archived_at'>;
  cards: readonly Card[];        // shaped
  votes: readonly Vote[];        // shaped (a completed board's votes are never secret)
  comments: readonly Comment[];  // shaped
  actionItems: readonly ActionItem[];
  participants: readonly Pick<Participant, 'id' | 'display_name' | 'joined_at'>[];
}
export interface SummaryCard { id: string; text: string; isChild: boolean }
export interface SummaryTopic {
  cardId: string; rank: number; heading: string; score: number;
  cards: SummaryCard[];          // root first, then children in creation order (AgendaItem.cardIds)
  threads: CommentThread[];      // threadsFor(comments, cardIds)
  actionItems: ActionItem[];     // actionItemsForTopic(actionItems, cardIds)
}
export interface SummaryHeadline { participants: number; cards: number; votes: number; topics: number; comments: number; actionItems: number }
export interface RetroSummary {
  boardId: string; title: string; completedAt: string | null;
  headline: SummaryHeadline; topics: SummaryTopic[];
  otherActionItems: ActionItem[];   // card_id null, absent, or not a card of any topic; compareByCreated order
  participantNames: string[];
}
export type SummaryViewState =
  | { kind: 'not-found' } | { kind: 'failed' }
  | { kind: 'closed'; boardId: string; title: string }
  | { kind: 'not-completed'; boardId: string; title: string }
  | { kind: 'ready'; summary: RetroSummary };
```

  - `buildRetroSummary(input: SummaryInput): RetroSummary`: `topics` from `buildAgenda(cards, votes)`, `heading` = `topicHeading(item, cards)`, card `text` = `exportCardText(card)`. Headline: `participants` = participant count; `cards` = every card, children included; `votes` = `sumVoteCounts(votes)`; `topics` = agenda length; `comments` = comments with `deleted_at === null`; `actionItems` = all items. `participantNames` sorted by `compareParticipants`.
  - `compareParticipants(a, b)`: lowercased `display_name` in code-unit order, then `Date.parse(joined_at)`, then `id` in code-unit order (no locale dependence).
  - `headlineItems(h: SummaryHeadline): { key: keyof SummaryHeadline; value: number; label: string }[]`: always six, in the order participants, cards, votes, topics, comments, action items, labels `participant`/`participants`, `card`/`cards`, `vote`/`votes`, `topic`/`topics`, `comment`/`comments`, `action item`/`action items` (singular only when the value is 1).
  - `headlineSentence(h): string`: the six as `${value} ${label}` joined by `, `.
  - `summaryCommentAuthor(c: Comment): string`: deleted is `''`; anonymous or no `author_name` is `SUMMARY_ANONYMOUS`; else `author_name`. Never `You`, whatever `is_mine` says.
  - `completedOnLabel(iso: string, timeZone?: string): string`: `Completed on ${new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone }).format(new Date(iso))}`.
  - `dueDateLabel(v: string | null | undefined): string | null`: the first 10 characters must match `YYYY-MM-DD`; formatted from `Date.UTC(y, m - 1, d)` with the same formatter and `timeZone: 'UTC'`; anything else is null.
  - `ownerLabel(item: Pick<ActionItem, 'assignee'>): string | null`: the trimmed `assignee`, or null when empty.
  - `statusLabel(s: ActionItemStatus): string` from `ACTION_ITEM_STATUS_LABELS`.
  - `allActionItems(s: RetroSummary): ActionItem[]`: each topic's items in agenda order, then `otherActionItems`.
  - `summaryAvailable(board: Pick<Board, 'mode' | 'archived_at'> | null): boolean`: guided and `archived_at !== null`.
  - `summaryPath(boardId: string): string` (`/board/${boardId}/summary`), `summaryDocumentTitle(title: string): string` (`Retro summary: ${title}`).
  - `summaryViewState(status: number, body: unknown): SummaryViewState`: 404 is `not-found`; any other non-200 or a body without a `board` object is `failed`; `access === 'completed-closed'` is `closed` (title from the stub); a board whose `mode` is not `'guided'` is `not-found`; `archived_at` null is `not-completed`; otherwise `ready` with `buildRetroSummary` over `cards`, `votes`, `comments ?? []`, `actionItems`, `participants` (missing arrays read as `[]`).

- [ ] **Step 1: Write the failing tests.** `lib/__tests__/summary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  buildRetroSummary, headlineItems, headlineSentence, summaryCommentAuthor, completedOnLabel, dueDateLabel,
  ownerLabel, statusLabel, allActionItems, summaryAvailable, summaryViewState, summaryPath, summaryDocumentTitle,
} from '@/lib/summary';

const at = (ms: number) => new Date(Date.UTC(2026, 10, 21, 10, 0, 0, ms)).toISOString();
const card = (id: string, ms: number, merged_with: string | null = null, group_title: string | null = null) => ({
  id, column_id: 'col', board_id: 'b1', text: `text ${id}`, author_name: 'Ann', author_id: 'p1', color: null,
  position: 0, merged_with, group_title, reactions: {}, created_at: at(ms), updated_at: at(ms),
});
const vote = (card_id: string, voter_id: string, count = 1) =>
  ({ id: `${card_id}-${voter_id}`, card_id, board_id: 'b1', voter_id, count, created_at: at(0) });
const comment = (over: Record<string, unknown>) => ({ id: 'm', board_id: 'b1', card_id: 'L', parent_id: null,
  author_participant_id: 'p1', author_name: 'Ann', is_anonymous: false, body: 'hi', created_at: at(0),
  edited_at: null, deleted_at: null, is_mine: false, ...over });
const item = (id: string, ms: number, card_id: string | null, over: Record<string, unknown> = {}) => ({
  id, board_id: 'b1', description: `do ${id}`, assignee: null, due_date: null, status: 'open', created_at: at(ms), card_id, ...over,
});

const input = {
  board: { id: 'b1', title: 'Sprint 12', archived_at: at(999) },
  cards: [card('L', 1, null, 'Deploys'), card('k', 2, 'L'), card('S', 3), card('Z', 4)],
  votes: [vote('L', 'p1', 2), vote('k', 'p2'), vote('S', 'p1')],
  comments: [
    comment({ id: 'c1', created_at: at(1) }),
    comment({ id: 'c2', parent_id: 'c1', is_anonymous: true, author_participant_id: null, author_name: null, is_mine: true, created_at: at(2) }),
    comment({ id: 'c3', card_id: 'S', deleted_at: at(3), body: '', author_name: null, author_participant_id: null }),
  ],
  actionItems: [item('i2', 2, 'k'), item('i1', 1, 'L'), item('i3', 3, null), item('i4', 4, 'gone')],
  participants: [
    { id: 'p2', display_name: 'bo', joined_at: at(2) }, { id: 'p1', display_name: 'Ann', joined_at: at(1) },
    { id: 'p3', display_name: 'cy', joined_at: at(3) },
  ],
};

describe('buildRetroSummary', () => {
  const s = buildRetroSummary(input as never);
  it('topics follow the agenda: group score, then creation order', () => {
    expect(s.topics.map((t) => [t.cardId, t.rank, t.score, t.heading])).toEqual([
      ['L', 1, 3, 'Deploys'], ['S', 2, 1, 'text S'], ['Z', 3, 0, 'text Z'],
    ]);
    expect(s.topics[0].cards).toEqual([{ id: 'L', text: 'text L', isChild: false }, { id: 'k', text: 'text k', isChild: true }]);
  });
  it('a topic carries its threads (a lone deleted comment is left out) and its items, children included', () => {
    expect(s.topics[0].threads.map((t) => [t.top.id, t.replies.map((r) => r.id)])).toEqual([['c1', ['c2']]]);
    expect(s.topics[1].threads).toEqual([]);
    expect(s.topics[0].actionItems.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(s.otherActionItems.map((i) => i.id)).toEqual(['i3', 'i4']);
    expect(allActionItems(s).map((i) => i.id)).toEqual(['i1', 'i2', 'i3', 'i4']);
  });
  it('headline numbers', () => {
    expect(s.headline).toEqual({ participants: 3, cards: 4, votes: 4, topics: 3, comments: 2, actionItems: 4 });
    expect(headlineSentence({ participants: 1, cards: 1, votes: 0, topics: 1, comments: 0, actionItems: 0 }))
      .toBe('1 participant, 1 card, 0 votes, 1 topic, 0 comments, 0 action items');
    expect(headlineItems(s.headline).map((h) => h.label)).toEqual(['participants', 'cards', 'votes', 'topics', 'comments', 'action items']);
  });
  it('participants by name without locale rules; title and completion', () => {
    expect(s.participantNames).toEqual(['Ann', 'bo', 'cy']);
    expect([s.boardId, s.title, s.completedAt]).toEqual(['b1', 'Sprint 12', at(999)]);
  });
  it('an empty board has no topics and zero counts', () => {
    const e = buildRetroSummary({ ...input, cards: [], votes: [], comments: [], actionItems: [], participants: [] } as never);
    expect(e.topics).toEqual([]);
    expect(e.headline).toEqual({ participants: 0, cards: 0, votes: 0, topics: 0, comments: 0, actionItems: 0 });
  });
});

describe('labels', () => {
  it('a comment author is never "You"; anonymous stays anonymous for its own author', () => {
    expect(summaryCommentAuthor(comment({ is_anonymous: true, author_name: null, author_participant_id: null, is_mine: true }) as never)).toBe('Anonymous');
    expect(summaryCommentAuthor(comment({ is_mine: true }) as never)).toBe('Ann');
    expect(summaryCommentAuthor(comment({ deleted_at: at(1), body: '', author_name: null }) as never)).toBe('');
  });
  it('dates', () => {
    expect(completedOnLabel('2026-11-21T23:30:00.000Z', 'UTC')).toBe('Completed on November 21, 2026');
    expect(completedOnLabel('2026-11-21T23:30:00.000Z', 'Asia/Tokyo')).toBe('Completed on November 22, 2026');
    expect(dueDateLabel('2026-11-30')).toBe('November 30, 2026');
    expect(dueDateLabel('2026-11-30T00:00:00.000Z')).toBe('November 30, 2026');
    expect(dueDateLabel(null)).toBeNull();
    expect(dueDateLabel('nope')).toBeNull();
  });
  it('owner and status', () => {
    expect(ownerLabel({ assignee: '  ' })).toBeNull();
    expect(ownerLabel({ assignee: ' Bo ' })).toBe('Bo');
    expect(statusLabel('in_progress')).toBe('In progress');
  });
  it('paths and availability', () => {
    expect(summaryPath('b1')).toBe('/board/b1/summary');
    expect(summaryDocumentTitle('Sprint 12')).toBe('Retro summary: Sprint 12');
    expect(summaryAvailable({ mode: 'guided', archived_at: at(1) })).toBe(true);
    expect(summaryAvailable({ mode: 'guided', archived_at: null })).toBe(false);
    expect(summaryAvailable({ mode: 'open', archived_at: at(1) })).toBe(false);
    expect(summaryAvailable(null)).toBe(false);
  });
});

describe('summaryViewState', () => {
  const full = { access: 'open', board: { id: 'b1', title: 'T', mode: 'guided', archived_at: at(9) },
    cards: input.cards, votes: input.votes, comments: input.comments, actionItems: input.actionItems, participants: input.participants };
  it('maps the board GET answer', () => {
    expect(summaryViewState(404, null)).toEqual({ kind: 'not-found' });
    expect(summaryViewState(500, null)).toEqual({ kind: 'failed' });
    expect(summaryViewState(200, { access: 'completed-closed', board: { id: 'b1', title: 'T', archived_at: at(1), trust_version: 2 } }))
      .toEqual({ kind: 'closed', boardId: 'b1', title: 'T' });
    expect(summaryViewState(200, { ...full, board: { ...full.board, mode: 'open' } })).toEqual({ kind: 'not-found' });
    expect(summaryViewState(200, { ...full, board: { ...full.board, archived_at: null } }))
      .toEqual({ kind: 'not-completed', boardId: 'b1', title: 'T' });
    const ready = summaryViewState(200, full);
    expect(ready.kind === 'ready' && ready.summary.topics.length).toBe(3);
    const noComments = summaryViewState(200, { ...full, comments: undefined });
    expect(noComments.kind === 'ready' && noComments.summary.headline.comments).toBe(0);
  });
});
```

`lib/__tests__/feature-flags.test.ts`: `flagEnabled({ flags: [{ key: 'summary_email', is_enabled: true }] }, 'summary_email')` true; `is_enabled: false` false; a response holding only `guided_mode` false for `summary_email`; `null`, `{}`, `{ flags: 'x' }` false; `is_enabled: 'true'` (a string) false.

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/summary.test.ts lib/__tests__/feature-flags.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the three constants files, `lib/feature-flags.ts`, `lib/summary.ts` (imports `buildAgenda`, `topicHeading`, `actionItemsForTopic` from `lib/agenda.ts`, `threadsFor` from `lib/comments.ts`, `sumVoteCounts` from `lib/votes.ts`, `compareByCreated` from `lib/groups.ts`, `exportCardText` from `utils/cardText.ts`), the `can-use` re-export and the `guidedModeEnabled` delegation.
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit && npx eslint lib/constants/summary.ts lib/constants/email.ts lib/constants/features.ts lib/feature-flags.ts lib/summary.ts lib/can-use.ts lib/phases.ts`. Expected: PASS (including `can-use.test.ts` and `phases.test.ts` unchanged), clean. Also `grep -rnP '\x{2014}' lib/constants/summary.ts lib/constants/email.ts` prints nothing (no em dash in any copy).
- [ ] **Step 5: Commit** `feat(summary): summary model, wrap-up vocabulary and the summary_email flag key`

---

### Task 2: Migration 018

**Files:**
- Create: `scripts/migrations/018_wrap_up.sql`
- Test: `lib/__tests__/wrap-up-migration-contract.test.ts`

**Interfaces:**
- Consumes: `SUMMARY_SEND_STATUSES`, `EMAIL_KINDS`, `SEND_ERROR_MAX` (`lib/constants/email.ts`), `SUMMARY_EMAIL_FEATURE` (`lib/constants/features.ts`).
- Produces: tables `email_preferences (user_id PK, summary_email, updated_at)`, `summary_email_sends (board_id, completed_at, user_id, status, error, created_at, finished_at; PK (board_id, completed_at, user_id))`, `email_outbox (id, kind, board_id, batch_key, to_address, subject, text_body, html_body, headers, created_at)`; the `summary_email` flag row, off.

ON DELETE decisions: a preference and a send record belong to the account (`CASCADE` from `"user"`, so deleting an account removes them); a send record and an outbox row belong to the board (`CASCADE` from `boards`, so purging a board, and e2e teardown, removes them). No column is added to Better Auth's tables. The recipient query reads `"user"."emailVerified"`, so the dependency guard requires that column.

- [ ] **Step 1: Write the failing contract test.**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { SUMMARY_SEND_STATUSES, EMAIL_KINDS, SEND_ERROR_MAX } from '@/lib/constants/email';
import { SUMMARY_EMAIL_FEATURE } from '@/lib/constants/features';

const sqlText = readFileSync('scripts/migrations/018_wrap_up.sql', 'utf-8');
const inList = (re: RegExp) => [...(re.exec(sqlText)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe('018_wrap_up.sql contract', () => {
  it('status and kind checks equal the constants, in order', () => {
    expect(inList(/summary_email_sends_status_check CHECK \(status IN \(([^)]*)\)\)/)).toEqual([...SUMMARY_SEND_STATUSES]);
    expect(inList(/email_outbox_kind_check CHECK \(kind IN \(([^)]*)\)\)/)).toEqual([...EMAIL_KINDS]);
    expect(Number(/char_length\(error\) <= (\d+)/.exec(sqlText)?.[1])).toBe(SEND_ERROR_MAX);
  });
  it('one send per board, completion and person; preferences and sends go with the account', () => {
    expect(sqlText).toMatch(/PRIMARY KEY \(board_id, completed_at, user_id\)/);
    expect(sqlText.match(/REFERENCES "user" \(id\) ON DELETE CASCADE/g)).toHaveLength(2);
    expect(sqlText.match(/REFERENCES boards \(id\) ON DELETE CASCADE/g)).toHaveLength(2);
  });
  it('the flag row is inserted off, under the constant key, guarded', () => {
    expect(sqlText).toContain(`SELECT '${SUMMARY_EMAIL_FEATURE}', 'Summary email',`);
    expect(sqlText).toMatch(/, false\s+WHERE NOT EXISTS \(SELECT 1 FROM feature_flags WHERE key = 'summary_email'\)/);
  });
  it('is additive and transactional, and requires the verified column', () => {
    expect(sqlText).not.toMatch(/\bDROP\b|ALTER\s+COLUMN|ALTER\s+TABLE\s+"user"/i);
    expect(sqlText).toMatch(/^BEGIN;/m);
    expect(sqlText).toMatch(/^COMMIT;/m);
    expect(sqlText).toContain(`column_name = 'emailVerified'`);
    for (const t of ['email_preferences', 'summary_email_sends', 'email_outbox']) {
      expect(sqlText).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
    }
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/wrap-up-migration-contract.test.ts`. Expected: FAIL, file not found.
- [ ] **Step 3: Write the migration** with a header comment in the style of 017 (purpose; "additive and safe under the deployed code: three new tables nothing reads until the summary_email flag is on, and one flag row, off"; "the CHECK lists must equal SUMMARY_SEND_STATUSES and EMAIL_KINDS; lib/__tests__/wrap-up-migration-contract.test.ts enforces it"; requires 013 (`schema_migrations`) and Better Auth's `"user"."emailVerified"`, not 015 to 017 (the feature that uses these tables needs them, the schema does not); idempotent; locking: brief SHARE ROW EXCLUSIVE locks on `"user"` and `boards` for the foreign keys, bounded by `lock_timeout`, safe to retry; rollback: remove the three tables, delete the `feature_flags` row `summary_email` and the `schema_migrations` row 018, safe while the flag has never been on). Body:

```sql
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RAISE EXCEPTION '018 requires 013_participant_uniqueness_and_ledger.sql (schema_migrations) to be applied first';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'emailVerified'
  ) THEN
    RAISE EXCEPTION '018 requires the Better Auth "user" table with its "emailVerified" column';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS email_preferences (
  user_id       TEXT        PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  summary_email BOOLEAN     NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS summary_email_sends (
  board_id     TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  user_id      TEXT        NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending',
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  CONSTRAINT summary_email_sends_pkey PRIMARY KEY (board_id, completed_at, user_id),
  CONSTRAINT summary_email_sends_status_check CHECK (status IN ('pending', 'sent', 'recorded', 'failed')),
  CONSTRAINT summary_email_sends_error_length CHECK (error IS NULL OR char_length(error) <= 500)
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       TEXT        NOT NULL,
  board_id   TEXT        REFERENCES boards (id) ON DELETE CASCADE,
  batch_key  TEXT        NOT NULL,
  to_address TEXT        NOT NULL,
  subject    TEXT        NOT NULL,
  text_body  TEXT        NOT NULL,
  html_body  TEXT        NOT NULL,
  headers    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_outbox_kind_check CHECK (kind IN ('summary'))
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_board_id ON email_outbox (board_id);

INSERT INTO feature_flags (key, name, description, is_enabled)
SELECT 'summary_email', 'Summary email', 'Email a short summary to signed-in people when a guided retro is completed.', false
WHERE NOT EXISTS (SELECT 1 FROM feature_flags WHERE key = 'summary_email');

COMMIT;
```

- [ ] **Step 4: Run** the contract test. Expected: PASS.
- [ ] **Step 5: Apply to dev.** Run: `node --env-file=.env.local scripts/run-one.mjs scripts/migrations/018_wrap_up.sql` (never with `--prod`, never with `NEON_BRANCH` on the command line). Expected: `Target database host: ep-calm-breeze...`, `Applied scripts/migrations/018_wrap_up.sql`, `Recorded migration 018 in schema_migrations`. If the host is not the dev host, stop and report. Run it a second time: the same three lines, no error.
- [ ] **Step 6: Prove the constraints in a rolled-back transaction** with a throwaway script outside the repo (the `devDb` guards; `BEGIN`, the checks, `ROLLBACK`; nothing committed): (1) a send row with status `bogus` fails the status check; (2) a second send row with the same board, completion and user fails the primary key; (3) a preference for a user id that does not exist fails the foreign key; (4) after inserting a throwaway user (`e2e-check@example.com`) with a preference and a send row, deleting that user removes both; (5) deleting a throwaway board removes its send and outbox rows; (6) an outbox row of kind `other` fails; (7) an error of 501 characters fails; (8) a preference inserted with only `user_id` reads `summary_email = true`. Report 8 of 8. Then read back: the three tables' columns, the constraints named above, `schema_migrations` at 018, and `SELECT is_enabled FROM feature_flags WHERE key = 'summary_email'` is false.
- [ ] **Step 7: Run** `npm test`. Expected: all PASS; report the count.
- [ ] **Step 8: Commit** `feat(db): 018 email preferences, summary sends, outbox and the summary_email flag`

---

### Task 3: The mail module, its transport seam and the outbox

**Files:**
- Create: `lib/mail/transport.ts`, `lib/mail/outbox-transport.ts`, `lib/mail/resend-transport.ts`, `lib/mail/send.ts`
- Modify: `lib/email.ts` (the from-address literal becomes `EMAIL_FROM`; nothing else)
- Test: new `lib/__tests__/email-password-reset.test.ts` (pin, written first), `lib/__tests__/mail-send.test.ts`

**Interfaces:**
- Consumes: Task 1 email constants.
- Produces (`lib/mail/transport.ts`):

```ts
export interface MailMessage { to: string; subject: string; text: string; html: string; headers: Record<string, string> }
export interface MailBatch { kind: EmailKind; boardId: string | null; key: string; messages: MailMessage[] }
export type MailSendResult =
  | { ok: true; transport: MailTransportName }
  | { ok: false; transport: MailTransportName; error: string };
export type MailEnv = Record<string, string | undefined>;
/** 'resend' only when env.SUMMARY_EMAIL_TRANSPORT is exactly 'resend'; everything else is 'outbox'. */
export function selectTransport(env: MailEnv): MailTransportName;
/** First SEND_ERROR_MAX code points of an error's message, or 'Unknown error'. */
export function sendErrorText(e: unknown): string;
```

- Produces (`lib/mail/outbox-transport.ts`): `recordToOutbox(batch: MailBatch, env: MailEnv): Promise<MailSendResult>`. When `env.VERCEL_ENV === 'production'` it returns `{ ok: false, transport: 'outbox', error: OUTBOX_DISABLED_ERROR }` without a query. Otherwise one statement:

```sql
INSERT INTO email_outbox (kind, board_id, batch_key, to_address, subject, text_body, html_body, headers)
SELECT ${batch.kind}, ${batch.boardId}, ${batch.key}, m.to_address, m.subject, m.text_body, m.html_body, m.headers
FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
  AS m(to_address text, subject text, text_body text, html_body text, headers jsonb)
```

  where `rows` maps each message to `{ to_address, subject, text_body, html_body, headers }`.
- Produces (`lib/mail/resend-transport.ts`): `sendWithResend(batch: MailBatch, env: MailEnv): Promise<MailSendResult>`. No `RESEND_API_KEY` is `{ ok: false, transport: 'resend', error: RESEND_KEY_MISSING_ERROR }` without constructing anything. Otherwise, inside the function only: `const resend = new Resend(env.RESEND_API_KEY)`; `const { error } = await resend.batch.send(batch.messages.map((m) => ({ from: EMAIL_FROM, to: m.to, subject: m.subject, text: m.text, html: m.html, headers: m.headers })), { idempotencyKey: batch.key })`; an `error` is `{ ok: false, error: sendErrorText(error) }`. (The installed SDK's `Batch.send(payload, options?: CreateBatchRequestOptions)` accepts `idempotencyKey` and per-email `headers`; check `node_modules/resend/dist/index.d.mts` once and report if not.)
- Produces (`lib/mail/send.ts`): `sendMail(batch: MailBatch, env: MailEnv = process.env): Promise<MailSendResult>`, THE one send function. An empty `messages` returns `{ ok: true, transport }` with no query and no import. `transport === 'resend'` runs `const { sendWithResend } = await import('./resend-transport')`; otherwise `recordToOutbox`. Any throw becomes `{ ok: false, transport, error: sendErrorText(e) }`; `sendMail` never throws.
- Produces (`lib/email.ts`): `sendPasswordResetEmail` passes `from: EMAIL_FROM`; every other byte of the call is unchanged.

What must NOT change: the password reset email's `to`, `subject` and `text` (pinned in Step 1), `getResend` and its lazy init.

- [ ] **Step 1: Pin the password reset email first.** `lib/__tests__/email-password-reset.test.ts` mocks `resend` (`vi.mock('resend', () => ({ Resend: vi.fn(function () { return { emails: { send: mocks.send } }; }) }))`), stubs `RESEND_API_KEY` with `vi.stubEnv`, calls `sendPasswordResetEmail('a@example.com', 'https://x/reset')`, and asserts `mocks.send` was called once with `toEqual({ from: 'RetroBoard <noreply@retroboard.live>', to: 'a@example.com', subject: 'Reset your RetroBoard password', text: <the exact text> })`, where the exact text is the `[...].join('\n')` array copied character for character from `lib/email.ts` (copy it from the file; do not retype it). Run it on the unmodified file. Expected: PASS.
- [ ] **Step 2: Write the failing tests** in `lib/__tests__/mail-send.test.ts`, mocking `resend` with a constructor spy (`mocks.ctor`) whose instance has `batch: { send: mocks.batchSend }`, and `@/lib/db` with `sql: mocks.sql`. A `batch()` factory: kind `summary`, boardId `b1`, key `summary/b1/1`, two messages to `u1@example.com` and `u2@example.com` with headers. Cases:
  - `selectTransport({})`, `({ SUMMARY_EMAIL_TRANSPORT: 'RESEND' })`, `(' resend')`, `('resend ')`, `('smtp')`, `('')` are all `'outbox'`; only `({ SUMMARY_EMAIL_TRANSPORT: 'resend' })` is `'resend'`.
  - `sendMail(batch(), {})`: one `sql` call whose text contains `INSERT INTO email_outbox` and `jsonb_to_recordset`, whose values include `'summary'`, `'b1'`, `'summary/b1/1'` and a JSON string holding both addresses; `mocks.ctor` not called; answer `{ ok: true, transport: 'outbox' }`.
  - `sendMail(batch(), { VERCEL_ENV: 'production' })`: no `sql` call, no constructor; `{ ok: false, transport: 'outbox', error: 'The outbox transport does not run in production' }`.
  - `sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k' })`: `mocks.ctor` called once with `'k'`; `mocks.batchSend` called once with two items `{ from: 'RetroBoard <noreply@retroboard.live>', to, subject, text, html, headers }` and `{ idempotencyKey: 'summary/b1/1' }`; no `sql` call; `{ ok: true, transport: 'resend' }`.
  - resend without a key: no constructor; `error: 'RESEND_API_KEY is not set'`. `batchSend` resolving `{ data: null, error: { message: 'boom' } }`: `{ ok: false, transport: 'resend', error: 'boom' }`.
  - `sql` rejecting with a 600-character message: `ok: false` with an error of exactly 500 code points. `batch()` with no messages: no `sql`, no constructor, `ok: true`.
  - Importing `@/lib/mail/resend-transport` (with `resend` mocked) does not call `mocks.ctor`.
  - Static guard (third email guard): `readFileSync('lib/mail/send.ts')` does not match `/from ['"]resend['"]/` or `/from ['"]\.\/resend-transport['"]/` and does contain `await import('./resend-transport')`; `readFileSync('lib/mail/resend-transport.ts')` contains `new Resend(` exactly once, inside `sendWithResend` (assert the text before the first `export async function sendWithResend` contains no `new Resend(`).
- [ ] **Step 3: Run** `npx vitest run lib/__tests__/mail-send.test.ts lib/__tests__/email-password-reset.test.ts`. Expected: mail tests FAIL; the pin PASSES.
- [ ] **Step 4: Implement** the four files and the `lib/email.ts` import (`import { EMAIL_FROM } from '@/lib/constants/email';`, `from: EMAIL_FROM`).
- [ ] **Step 5: EXPLAIN** the outbox insert on the dev database (throwaway script, plain `EXPLAIN` with a one-message JSON value). Report the plan's top node.
- [ ] **Step 6: Run** `npm test && npx tsc --noEmit && npx eslint lib/mail lib/email.ts`. Expected: PASS (the pin unchanged), clean.
- [ ] **Step 7: Commit** `feat(mail): one send function with an outbox transport; Resend only when explicitly chosen`

---

### Task 4: Email content and the unsubscribe token

**Files:**
- Create: `lib/summary-email/render.ts`, `lib/email-unsubscribe.ts`
- Test: new `lib/__tests__/summary-email-render.test.ts`, `lib/__tests__/email-unsubscribe.test.ts`

**Interfaces:**
- Consumes: `RetroSummary`, `headlineSentence`, `allActionItems`, `ownerLabel`, `dueDateLabel`, `summaryPath` (Task 1); `agendaVotesLabel` (`lib/agenda.ts`); `MailMessage` (Task 3); email constants.
- Produces (`lib/email-unsubscribe.ts`; imports only `node:crypto` and `./constants/email` by RELATIVE path, so the e2e spec can import it as `../lib/email-unsubscribe`):
  - `signUnsubscribeToken(userId: string, secret: string = envSecret()): string` and `verifyUnsubscribeToken(token: unknown, secret: string = envSecret()): { userId: string } | null`.
  - `envSecret()` reads `PARTICIPANT_SESSION_SECRET` and throws `PARTICIPANT_SESSION_SECRET is not set or too short` when it is missing or under 32 characters (the same rule as `lib/participant-session.ts`).
  - Key: `createHmac('sha256', secret).update('retroboard:email-unsubscribe:v1').digest()` (a derived key, so no unsubscribe signature can ever equal a participant session signature). Signature: `createHmac('sha256', key).update(`${UNSUBSCRIBE_TOKEN_PURPOSE}\n${userId}`).digest('base64url')`. Token: `${userId}.${signature}`. It binds the purpose and the account id; it does not expire (a link in an old email must keep working, and it can only turn summaries off). `signUnsubscribeToken` throws on an empty `userId` or one containing a newline.
  - `verifyUnsubscribeToken`: not a string, no `.` after the first character, an empty user id or signature, a newline, or a signature that does not match under `timingSafeEqual` (lengths compared first) is null. Parse from the right (`lastIndexOf('.')`).
- Produces (`lib/summary-email/render.ts`):
  - `appBaseUrl(env: Record<string, string | undefined>): string | null`: `env.NEXT_PUBLIC_APP_URL || env.BETTER_AUTH_URL`, trailing slashes removed; null unless it matches `/^https?:\/\/[^/\s]+/`.
  - `interface SummaryEmailLinks { summaryUrl: string; unsubscribePageUrl: string; unsubscribePostUrl: string }`, `summaryEmailLinks(baseUrl: string, boardId: string, token: string): SummaryEmailLinks` (`${baseUrl}${summaryPath(boardId)}`, `${baseUrl}${UNSUBSCRIBE_PAGE_PATH}?token=${encodeURIComponent(token)}`, `${baseUrl}${UNSUBSCRIBE_API_PATH}?token=${encodeURIComponent(token)}`).
  - `escapeHtml(s: string): string` (`&`, `<`, `>`, `"`, `'`).
  - `truncateHeading(s: string, max = SUMMARY_EMAIL_HEADING_MAX): string`: by code points; longer than `max` becomes the first `max` code points plus `...`; line breaks become single spaces first.
  - `renderSummaryEmail(summary: RetroSummary, to: string, links: SummaryEmailLinks): MailMessage`:
    - `subject`: `Retro summary: ${title}` with every run of CR or LF replaced by one space.
    - `headers`: exactly `{ 'List-Unsubscribe': `<${links.unsubscribePostUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }`.
    - `text` (lines joined by `\n`; `{owner}` is `ownerLabel(i) ?? NO_OWNER_LABEL`, `{due}` is `dueDateLabel(i.due_date) ?? NO_DUE_DATE`; headings through `truncateHeading`):

```
{title}

Your retro is complete. Here is a short summary.

{headlineSentence(headline)}

Topics
1. {heading} ({agendaVotesLabel(score)})
2. ...
(when there are no topics, the single line: No topics were discussed.)

Action items
- {description} (Owner: {owner}; Due: {due})
(when there are none, the single line: No action items.)

See the full summary: {summaryUrl}

You got this email because you took part in this retro on RetroBoard.
Stop getting summary emails: {unsubscribePageUrl}
```

    - `html`: `<!doctype html><html lang="en"><body>`, then `<h1>{title}</h1>`, `<p>{intro}</p>`, `<p>{headline}</p>`, `<h2>Topics</h2>` with an `<ol>` of `<li>{heading} ({votes})</li>` (or `<p>No topics were discussed.</p>`), `<h2>Action items</h2>` with a `<ul>` of `<li>{description} (Owner: {owner}; Due: {due})</li>` (or `<p>No action items.</p>`), `<p><a href="{summaryUrl}">See the full summary</a></p>`, `<p>{why}<br><a href="{unsubscribePageUrl}">Stop getting summary emails</a></p>`, `</body></html>`. Every interpolated value goes through `escapeHtml`. No `style`, no `img`, no colours, nothing remote.
    - It never reads card text other than through `topic.heading`, never reads `threads`, never reads a card or comment author. (Step 5's AI summary paragraph would go between the headline and `Topics`; leave a one-line code comment there and build nothing.)

- [ ] **Step 1: Write the failing tests.** `summary-email-render.test.ts` builds a `RetroSummary` with `buildRetroSummary` from a fixture where: topic 1 is a group titled `Deploys` (score 3) with a child card whose text is `CHILD-SECRET`; topic 2 is a solo card `Slow builds` (score 1); a comment body `COMMENT-SECRET`; card authors `AUTHOR-SECRET`; items `Write the runbook` (assignee `Bo`, due `2026-11-30`, topic 1) and `Fix CI` (no owner, no due, unlinked). Cases:
  - `subject` is `Retro summary: Sprint 12`; a title `Sprint\r\n12` gives `Retro summary: Sprint 12`.
  - `text` contains, in this order: `Sprint 12`, `Your retro is complete. Here is a short summary.`, the headline sentence, `Topics`, `1. Deploys (3 votes)`, `2. Slow builds (1 vote)`, `Action items`, `- Write the runbook (Owner: Bo; Due: November 30, 2026)`, `- Fix CI (Owner: No owner; Due: No due date)`, `See the full summary: https://x.test/board/b1/summary`, `Stop getting summary emails: https://x.test/email/unsubscribe?token=`.
  - Neither `text` nor `html` contains `CHILD-SECRET`, `COMMENT-SECRET` or `AUTHOR-SECRET`.
  - A heading `<script>alert(1)</script>` appears in `html` as `&lt;script&gt;alert(1)&lt;/script&gt;`; `html` has no `<img`, no `src=`, no `style=`, and exactly two `href=`.
  - `headers` equal the two keys exactly, with `<https://x.test/api/email/unsubscribe?token=...>`.
  - A 200-character heading becomes 120 code points plus `...`; 130 emoji become 120 emoji plus `...`.
  - No topics: `No topics were discussed.` in both parts; no items: `No action items.` in both.
  - `appBaseUrl({ NEXT_PUBLIC_APP_URL: 'https://a.test/' })` is `https://a.test`; falls back to `BETTER_AUTH_URL`; `{}` and `{ NEXT_PUBLIC_APP_URL: 'not a url' }` are null.
  - Neither part contains the character U+2014.

  `email-unsubscribe.test.ts` (with a 40-character test secret passed explicitly): a token for `u1` verifies to `{ userId: 'u1' }`; a token for `u1` with the user id edited to `u2` is null; a changed last signature character is null; a token signed with another secret is null; `''`, `'abc'`, `'.sig'`, `'u1.'`, `5`, `null` are null; `signUnsubscribeToken('a\nb', s)` and `signUnsubscribeToken('', s)` throw; with `PARTICIPANT_SESSION_SECRET` stubbed to 10 characters the default-secret call throws the message above; the signature for `u1` differs from `createHmac('sha256', s).update('summary_email\nu1').digest('base64url')` (the derived key is in use).
- [ ] **Step 2: Run** `npx vitest run lib/__tests__/summary-email-render.test.ts lib/__tests__/email-unsubscribe.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** both files to the signatures above.
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit && npx eslint lib/summary-email/render.ts lib/email-unsubscribe.ts`. Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat(email): summary email content and a signed one-click unsubscribe token`

---

### Task 5: The opt-out store and its two endpoints

**Files:**
- Create: `lib/email-preferences.ts`, `app/api/user/email-preferences/route.ts`, `app/api/email/unsubscribe/route.ts`
- Modify: `lib/__tests__/rate-limit-limiter.test.ts` (two entries in the wiring list)
- Test: new `lib/__tests__/email-preferences.test.ts`, `app/api/user/email-preferences/__tests__/email-preferences-route.test.ts`, `app/api/email/unsubscribe/__tests__/unsubscribe-route.test.ts`

**Interfaces:**
- Consumes: `canUse`, `SUMMARY_EMAIL_FEATURE`, `verifyUnsubscribeToken`, `getSessionOrNull`, `getFreshSession`, `readJsonObject`, `INVALID_BODY`, `rateLimitOr429`, email constants.
- Produces (`lib/email-preferences.ts`):
  - `readSummaryPreference(userId: string): Promise<boolean>`: `SELECT summary_email FROM email_preferences WHERE user_id = ${userId}`; no row is `true` (the default is on).
  - `setSummaryPreference(userId: string, enabled: boolean): Promise<void>`, the ONE write, shared by the settings route and unsubscribe:

```sql
INSERT INTO email_preferences (user_id, summary_email, updated_at)
SELECT ${userId}, ${enabled}::boolean, now()
WHERE EXISTS (SELECT 1 FROM "user" WHERE id = ${userId})
ON CONFLICT (user_id) DO UPDATE SET summary_email = EXCLUDED.summary_email, updated_at = now()
```

    (an account that no longer exists writes nothing and is not an error: the caller answers the same either way).
- Produces (`/api/user/email-preferences`):
  - `GET`: `getSessionOrNull()`; no user is 401 `{ error: 'Sign in required' }`; `canUse(SUMMARY_EMAIL_FEATURE, userId)` false is 404 `{ error: 'Not found' }` (the preferences table is not named); else 200 `{ summaryEmail: boolean }`.
  - `POST` (first statement `const limited = await rateLimitOr429(request, EMAIL_PREFS_RATE_LIMIT.key, EMAIL_PREFS_RATE_LIMIT.limit, EMAIL_PREFS_RATE_LIMIT.window);`, then `if (limited) return limited;`): body through `readJsonObject`; `summaryEmail` not a boolean is 400 `Invalid request body` before any session or database call; `getFreshSession()` with no user is 401; flag off is 404; else `setSummaryPreference(session.user.id, summaryEmail)` and 200 `{ summaryEmail }`. Any other body key (a `userId` included) is ignored.
- Produces (`/api/email/unsubscribe`):
  - `POST` (first statement `const limited = await rateLimitOr429(request, UNSUBSCRIBE_RATE_LIMIT.key, UNSUBSCRIBE_RATE_LIMIT.limit, UNSUBSCRIBE_RATE_LIMIT.window);`): the token is the `token` query parameter (RFC 8058 keeps it in the URL; the request body, `List-Unsubscribe=One-Click` or empty, is not read). `verifyUnsubscribeToken` null is 400 `{ error: 'This link is not valid.' }` with no database call; else `setSummaryPreference(userId, false)` and 200 `{ ok: true }`, the same body whether or not the account exists. It does NOT check the flag: an unsubscribe link must keep working after the flag is turned off.
  - `GET`: 303 redirect to `${UNSUBSCRIBE_PAGE_PATH}?token=<the same token, encoded>` (or to the page with no query when there is no token). No database call, no write: a scanner following the link changes nothing.

- [ ] **Step 1: Write the failing tests.** Mock `@/lib/db` (`sql: mocks.sql`), `@/lib/can-use` (`canUse: mocks.flag`), `@/lib/auth-helpers` (`getSessionOrNull: mocks.session`, `getFreshSession: mocks.fresh`), `next/headers`. Cases:
  - `email-preferences.test.ts`: `readSummaryPreference` with no row is `true`, with `{ summary_email: false }` is `false`; `setSummaryPreference('u1', false)` sends one statement containing `INSERT INTO email_preferences`, `WHERE EXISTS (SELECT 1 FROM "user" WHERE id = ?)` and `ON CONFLICT (user_id) DO UPDATE SET summary_email = EXCLUDED.summary_email`, with values `['u1', false, 'u1']`.
  - Preferences route: GET without a session is 401 with zero `sql` calls; GET with the flag off is 404 `{ error: 'Not found' }` and no `sql` call names `email_preferences`; GET on is 200 `{ summaryEmail: true }` with no row; POST `{ summaryEmail: 'no' }` is 400 with zero session and zero `sql` calls; POST without a fresh session is 401; POST with the flag off is 404 and no write; POST `{ summaryEmail: false, userId: 'other' }` as `u1` writes `u1` and answers `{ summaryEmail: false }`.
  - Unsubscribe route (token signed in the test with `signUnsubscribeToken('u1', secret)`, `PARTICIPANT_SESSION_SECRET` stubbed to that secret): POST with no token, `token=garbage` and a tampered token are each 400 `{ error: 'This link is not valid.' }` with zero `sql` calls; a valid POST writes `('u1', false)` and is 200 `{ ok: true }`; the same POST again is 200 `{ ok: true }`; a valid token whose write returns no row is 200 `{ ok: true }` (identical body); `canUse` is never called; GET with a token is 303 with `location` ending `/email/unsubscribe?token=<encoded>` and zero `sql` calls.
  - `rate-limit-limiter.test.ts` wiring list gains `{ file: 'app/api/user/email-preferences/route.ts', name: 'email-prefs', limit: 30, window: 60, call: 'EMAIL_PREFS_RATE_LIMIT.key, EMAIL_PREFS_RATE_LIMIT.limit, EMAIL_PREFS_RATE_LIMIT.window' }` and `{ file: 'app/api/email/unsubscribe/route.ts', name: 'unsubscribe', limit: 300, window: 60, call: 'UNSUBSCRIBE_RATE_LIMIT.key, UNSUBSCRIBE_RATE_LIMIT.limit, UNSUBSCRIBE_RATE_LIMIT.window' }`, plus two assertions that the constants equal those values.
- [ ] **Step 2: Run** `npx vitest run lib/__tests__/email-preferences.test.ts app/api/user/email-preferences app/api/email/unsubscribe lib/__tests__/rate-limit-limiter.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the store and both routes.
- [ ] **Step 4: EXPLAIN** the preference read and the preference write on the dev database (throwaway script, plain `EXPLAIN`).
- [ ] **Step 5: Run** `npm test && npx tsc --noEmit && npx eslint lib/email-preferences.ts app/api/user/email-preferences app/api/email/unsubscribe lib/__tests__/rate-limit-limiter.test.ts`. Expected: PASS, clean.
- [ ] **Step 6: Commit** `feat(email): summary opt-out store, account setting route and one-click unsubscribe`

---

### Task 6: The unsubscribe page and the Email setting

**Files:**
- Create: `app/email/unsubscribe/page.tsx`, `components/Email/UnsubscribeConfirm.tsx`, `lib/email-ui.ts`
- Modify: `components/pages/SettingsPage.tsx` (one new `EmailSection`, mounted between `ProfileSection` and `SecuritySection`)
- Test: new `lib/__tests__/email-ui.test.ts`

**Interfaces:**
- Consumes: Task 1 copy and `flagEnabled`, `SUMMARY_EMAIL_FEATURE`; Task 5 routes.
- Produces (`lib/email-ui.ts`): `unsubscribeOutcome(status: number): 'done' | 'invalid' | 'failed'` (200 done, 400 invalid, anything else failed); `preferenceFromResponse(status: number, body: unknown): boolean | null` (200 with a boolean `summaryEmail` gives it, anything else null); `tokenFromSearchParam(v: string | string[] | undefined): string | null` (a non-empty string, else null).
- Produces (`app/email/unsubscribe/page.tsx`, server component): `metadata = { title: UNSUBSCRIBE_TITLE, robots: { index: false, follow: false } }`; reads `searchParams.token` through `tokenFromSearchParam`; renders `<UnsubscribeConfirm token={token} />` inside `AppShell`. It makes no database call and does not verify the token (verifying would tell a visitor whether a token is real; the POST decides).
- Produces (`UnsubscribeConfirm`, client): a centred card (`max-w-md`, tokens `--surface`, `--line`, `--ink`, `--ink-3`, `--r-xl`) with `<h1>Stop summary emails</h1>`. With a token: the body `You will no longer get an email when a retro you took part in is completed.` and a filled button `Unsubscribe` (44px tall on phones, disabled while the request is in flight). The click POSTs `${UNSUBSCRIBE_API_PATH}?token=${encodeURIComponent(token)}` with no body; `done` replaces the body and button with `You are unsubscribed. You can turn summary emails back on in your account settings.` and a link `Account settings` to `/settings`; `invalid` shows `This link is not valid.` and hides the button; `failed` shows `Something went wrong. Try again.` under the button and keeps it. Without a token: only `This link is not valid.` and no button (no request is ever made).
- Produces (`EmailSection` in `SettingsPage.tsx`): on mount, fetch `/api/feature-flags` (with an `AbortController`); unless `flagEnabled(body, SUMMARY_EMAIL_FEATURE)`, render nothing and make no other request. When on, `GET /api/user/email-preferences`; `preferenceFromResponse` null renders nothing. Otherwise a `Section` titled `Email` with the description `Choose which emails RetroBoard sends you.` and one checkbox row: a native checkbox (id `settings-summary-email`) with the label `Email me a summary when a retro I took part in is completed` (the whole row at least 44px tall, the label clickable). Changing it sets the new value at once, disables the checkbox, POSTs `{ summaryEmail }`; a 200 shows `Saved.`; anything else (a network error included, caught) restores the previous value and shows `Could not save. Try again.` in `--danger`. The message clears on the next change. No timers. The other sections render exactly as before.

- [ ] **Step 1: Write the failing tests** for the three helpers (each status and body case listed above; `tokenFromSearchParam(['a', 'b'])` is null, `''` is null).
- [ ] **Step 2: Run** `npx vitest run lib/__tests__/email-ui.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, the page, the component and the section.
- [ ] **Step 4: Run** `npx tsc --noEmit && npm test && npx eslint lib/email-ui.ts app/email components/Email components/pages/SettingsPage.tsx`. Expected: clean.
- [ ] **Step 5: Observe in a browser** (dev server per the Global Constraints, after the two email-rule checks). Before turning anything on, record the settings page's section headings for a signed-in account (the "before" reading). Then:
  1. Create a throwaway account with the address `e2e-observe-<6 random hex>@example.com`. Controller ruling: NOT through the `/signup` page (sign-up and sign-in over HTTP are behind Cloudflare Turnstile, which a script cannot pass). Use a throwaway `node` script outside the repo, carrying the two `devDb` guards (refuse unless `NEON_BRANCH` is `dev`; refuse if the database URL contains the production host), that calls Better Auth's server API in process: `auth.api.signUpEmail({ body: { email, password, name } })`, then `auth.api.signInEmail({ body: { email, password }, asResponse: true })` and reads the session cookie from the response's `Set-Cookie` header; set that cookie in the Playwright browser context for `localhost:3001`. Verification is off, so sign-up sends nothing; never use password reset; never print the cookie, the password or any secret. If `lib/auth.ts` cannot be loaded from a plain script, or the server API refuses without the CAPTCHA, do NOT work around it (no hand-built session rows, no signing cookies yourself): skip steps 2 to 6's signed-in parts, do the unsubscribe page checks that need no session (generate the token for a `createUserDirect`-style throwaway user row inserted and later deleted by the same guarded script), and report exactly what was not observed so the controller can list it as not verified.
  2. With the flag still off: `/settings` shows Appearance, Profile, Security, Delete account and no Email section, identical to the before reading; the network log shows `/api/feature-flags` and no `/api/user/email-preferences` request.
  3. Turn the flag on with a throwaway script running exactly `setFlagDirect`'s statement for `summary_email` (the `devDb` guards). Reload: the Email section shows checked (the real GET ran: record its request and response). Uncheck: one POST, `Saved.`; reload: unchecked (the read ran for real again). Check it again.
  4. Generate a token for the throwaway account's user id with a throwaway `node` script importing `lib/email-unsubscribe.ts` (secret from `.env.local`; never print the secret or the token in the report). Open `/email/unsubscribe?token=<token>` and reload it three times; between reloads read the account's `email_preferences` row with a read-only SELECT: unchanged (still on). Press `Unsubscribe`: the done text and the `Account settings` link; the row now reads `summary_email = false`; `/settings` shows the box unchecked. Open the page with the token's last character changed and press `Unsubscribe`: `This link is not valid.` and no button. Open `/email/unsubscribe` with no token: the invalid text and no button.
  5. At 1280px, 390px and 360px, light and dark (theme through the header toggle, 1500 ms wait): screenshots of the Email section and of the unsubscribe page in its three states; no horizontal scroll at 360px; the checkbox row and the button measure at least 44px tall at 390px and 360px.
  6. Turn the flag off with the same script. Reload `/settings`: no Email section. Delete the throwaway account (through the page's Delete account section if it works for this account, otherwise with the guarded script: `DELETE FROM "user" WHERE id = <the id it created> AND email = <the address it created>`, which cascades its sessions, accounts and preference row); confirm with a read-only SELECT that no user with that address remains and that `summary_email` is off.
  Save screenshots to `observe-6/`.
- [ ] **Step 6: Commit** `feat(ui): email setting in account settings and a scanner-safe unsubscribe page`

---

### Task 7: Recipients, dispatch and the completion hook

**Files:**
- Create: `lib/summary-email/dispatch.ts`, `lib/summary-email/schedule.ts`
- Modify: `app/api/boards/[boardId]/route.ts` (the guided branch of `complete` only)
- Test: new `lib/__tests__/summary-email-dispatch.test.ts`; `app/api/boards/[boardId]/__tests__/guided-lifecycle.test.ts`

**Interfaces:**
- Consumes: `canUse`, `SUMMARY_EMAIL_FEATURE`; `shapeCard`, `shapeVotes`, `shapeComments`, `PUBLIC_VIEWER` (`lib/board-view.ts`); `buildRetroSummary` (Task 1); `sendMail` (Task 3); `renderSummaryEmail`, `summaryEmailLinks`, `appBaseUrl`, `signUnsubscribeToken` (Task 4); `GUIDED_MODE`; `DEFAULT_BOARD_SETTINGS`; `BOARD_COMPLETED_ERROR`; email constants.
- Produces (`lib/summary-email/dispatch.ts`):

```ts
export type DispatchOutcome = 'flag-off' | 'stale' | 'no-recipients' | 'sent' | 'recorded' | 'failed' | 'error';
export interface DispatchInput { boardId: string; completedAt: string } // completedAt: the archived_at this completion wrote
export async function dispatchSummaryEmail(input: DispatchInput, env: Record<string, string | undefined> = process.env): Promise<DispatchOutcome>;
```

  In order, and nothing else:
  1. `canUse(SUMMARY_EMAIL_FEATURE, null)` false: return `flag-off` (no other statement, nothing recorded).
  2. One read-only snapshot transaction (`{ readOnly: true, isolationLevel: 'RepeatableRead' }`), six statements:

```sql
SELECT id, title, archived_at, trust_version, settings FROM boards
WHERE id = ${boardId} AND archived_at = ${completedAt}::timestamptz AND deleted_at IS NULL AND mode = ${GUIDED_MODE}
SELECT * FROM cards WHERE board_id = ${boardId} ORDER BY position, created_at, id
SELECT * FROM votes WHERE board_id = ${boardId}
SELECT * FROM action_items WHERE board_id = ${boardId} ORDER BY created_at
SELECT * FROM participants WHERE board_id = ${boardId}
SELECT * FROM comments WHERE board_id = ${boardId} ORDER BY created_at, id
```

     No board row (reopened, completed again, trashed, purged): return `stale`.
  3. Shape with `PUBLIC_VIEWER` (`viewBoard = { trust_version, settings: { ...DEFAULT_BOARD_SETTINGS, ...settings }, archived_at }`; cards through `shapeCard`, votes through `shapeVotes`, comments through `shapeComments`) and `buildRetroSummary`.
  4. Claim, in ONE statement that selects the recipients and writes the record of intent (the board must still carry this completion's `archived_at`, so a completion undone in the meantime claims nobody):

```sql
WITH board AS (
  SELECT id, owner_id FROM boards
  WHERE id = ${boardId} AND archived_at = ${completedAt}::timestamptz AND deleted_at IS NULL
), people AS (
  SELECT owner_id AS user_id FROM board WHERE owner_id IS NOT NULL
  UNION
  SELECT m.user_id FROM board_members m JOIN board ON m.board_id = board.id
  UNION
  SELECT p.user_id FROM participants p JOIN board ON p.board_id = board.id WHERE p.user_id IS NOT NULL
), eligible AS (
  SELECT u.id AS user_id, u.email
  FROM people JOIN "user" u ON u.id = people.user_id
  LEFT JOIN email_preferences ep ON ep.user_id = u.id
  WHERE COALESCE(ep.summary_email, true)
    AND u."emailVerified" = true
    AND u.email LIKE '%_@_%'
  ORDER BY u.id
  LIMIT ${SUMMARY_EMAIL_MAX_RECIPIENTS}
), claimed AS (
  INSERT INTO summary_email_sends (board_id, completed_at, user_id, status)
  SELECT ${boardId}, ${completedAt}::timestamptz, user_id, ${SEND_PENDING} FROM eligible
  ON CONFLICT (board_id, completed_at, user_id) DO NOTHING
  RETURNING user_id
)
SELECT e.user_id, e.email FROM eligible e JOIN claimed c ON c.user_id = e.user_id ORDER BY e.user_id
```

     `UNION` de-duplicates by user id. No rows: return `no-recipients`.
  5. `appBaseUrl(env)` null: mark the claimed rows `failed` with `BASE_URL_MISSING_ERROR` (step 7's statement) and return `failed`.
  6. One message per claimed row: `renderSummaryEmail(summary, row.email, summaryEmailLinks(base, boardId, signUnsubscribeToken(row.user_id)))`; one `sendMail({ kind: SUMMARY_EMAIL_KIND, boardId, key: `summary/${boardId}/${Date.parse(completedAt)}`, messages })`.
  7. Record the outcome in one statement:

```sql
UPDATE summary_email_sends SET status = ${status}, error = ${error}, finished_at = now()
WHERE board_id = ${boardId} AND completed_at = ${completedAt}::timestamptz
  AND user_id = ANY(${userIds}::text[]) AND status = ${SEND_PENDING}
```

     `status` is `sent` for a successful `resend` result, `recorded` for a successful `outbox` result, `failed` (with the result's error) otherwise. Return that status as the outcome. Nothing is retried.
  The whole function is inside one `try`; a throw returns `error` after `console.error('[summary-email] board ' + boardId + ' failed: ' + code)`, where `code` is the error's `code` or `name` only (never its message: a Postgres message can quote row data, the Step 3 R18 lesson). No log line ever contains an address.
- Produces (`lib/summary-email/schedule.ts`): `scheduleSummaryEmail(input: DispatchInput): void`, which calls `after(async () => { const outcome = await dispatchSummaryEmail(input); console.info('[summary-email] board ' + input.boardId + ': ' + outcome); })` (`after` from `next/server`). It never throws into the caller.
- Produces (board POST, guided `complete` only):
  - The guided statement gains `AND archived_at IS NULL`: `WHERE id = ${boardId} AND archived_at IS NULL`. On no row, a guided board answers 409 `{ error: BOARD_COMPLETED_ERROR }` (`Board is completed`), publishes nothing and schedules nothing (a lost race with another completion).
  - After the guided UPDATE returns a row and before the publish: `scheduleSummaryEmail({ boardId, completedAt: archivedAt })`.
  - The open branch, its statement, its 404 on no row and its publish are unchanged; it never calls `scheduleSummaryEmail`.

How the send is guaranteed to run, and what can be lost: Vercel runs `after()` work through `waitUntil`, inside the same invocation, after the response is sent, until the function's `maxDuration`. The completion's durable fact is the board's own `archived_at`, written before the response. The claim (step 4) is the first write the dispatch makes, so every send has a `pending` row before it happens. If the invocation dies before step 4, nothing is recorded and that completion's email is never sent (detectable later as a completed guided board with no send rows). If it dies between step 4 and step 7, the rows stay `pending` (an email may or may not have gone). Neither case is retried in this step.

Rule for repeats: at most one email per person per completion. A reopen followed by another completion writes a new `archived_at`, so it may email again (the summary may have changed). Two completions racing cannot both succeed (the `archived_at IS NULL` condition).

- [ ] **Step 1: Confirm the pins and add one.** Run `npx vitest run app/api/boards/\[boardId\]/__tests__` on the unmodified route: the open complete and open reopen inline snapshots pass. In `guided-lifecycle.test.ts` add `vi.mock('@/lib/summary-email/schedule', () => ({ scheduleSummaryEmail: (...a: unknown[]) => mocks.schedule(...a) }))` (with `schedule: vi.fn()` in the hoisted mocks) and the test `an open complete schedules no email` (open board, complete, `expect(mocks.schedule).not.toHaveBeenCalled()`). Expected: PASS before and after this task.
- [ ] **Step 2: Write the failing tests.**

```ts
// guided-lifecycle.test.ts
it('the guided complete statement only completes a board that is not completed', async () => {
  mocks.sql.mockResolvedValueOnce([guided('discuss')]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
  await POST(postReq({ action: 'complete' }), ctx);
  expect(sqlText(1)).toContain('WHERE id = ? AND archived_at IS NULL');
});
it('a guided completion schedules the summary email with the archived_at it wrote, before publishing', async () => {
  mocks.sql.mockResolvedValueOnce([guided('discuss')]).mockResolvedValueOnce([{ settings: DEFAULT_BOARD_SETTINGS }]);
  await POST(postReq({ action: 'complete' }), ctx);
  expect(mocks.schedule).toHaveBeenCalledTimes(1);
  expect(mocks.schedule).toHaveBeenCalledWith({ boardId: 'b1', completedAt: sqlValues(1)[0] });
  expect(mocks.schedule.mock.invocationCallOrder[0]).toBeLessThan(mocks.publish.mock.invocationCallOrder[0]);
});
it('a guided completion that lost a race answers 409 and schedules nothing', async () => {
  mocks.sql.mockResolvedValueOnce([guided('discuss')]).mockResolvedValueOnce([]);
  const res = await POST(postReq({ action: 'complete' }), ctx);
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: 'Board is completed' });
  expect(mocks.schedule).not.toHaveBeenCalled();
  expect(mocks.publish).not.toHaveBeenCalled();
});
it('an open completion that finds no row still answers 404, as today', async () => {
  mocks.sql.mockResolvedValueOnce([ctxRow()]).mockResolvedValueOnce([]);
  expect((await POST(postReq({ action: 'complete' }), ctx)).status).toBe(404);
});
```

  `summary-email-dispatch.test.ts` mocks `@/lib/db` (`sql`, `sqlTransaction`), `@/lib/can-use`, `@/lib/mail/send` (`sendMail: mocks.send`), and stubs `PARTICIPANT_SESSION_SECRET` (40 characters). Fixture: a guided completed board with `anonymous_cards: true`, cards whose `author_name` is `AUTHOR-SECRET`, an anonymous comment `COMMENT-SECRET`, a group titled `Deploys`. `env = { NEXT_PUBLIC_APP_URL: 'https://x.test' }`. Cases:
  - Flag off: `flag-off`; `sqlTransaction`, `sql` and `send` not called.
  - Snapshot: six statements; the first contains `archived_at = ?::timestamptz` and `mode = ?` and its values include `'b1'`, the completion time and `'guided'`. No board row: `stale`, no claim.
  - Claim text contains `UNION`, `FROM board_members m`, `p.user_id IS NOT NULL`, `LEFT JOIN email_preferences ep`, `COALESCE(ep.summary_email, true)`, `u."emailVerified" = true`, `LIMIT ?`, `ON CONFLICT (board_id, completed_at, user_id) DO NOTHING`; its values include `'b1'`, the completion time, `100`, `'pending'`. No claimed rows: `no-recipients`, `send` not called.
  - Two claimed rows (`u1`, `u2`): `send` called once with `kind: 'summary'`, `boardId: 'b1'`, `key: 'summary/b1/<ms>'` and two messages to the two addresses; each message's `List-Unsubscribe` token (parsed out of the header) verifies to its own user id; no message part contains `AUTHOR-SECRET` or `COMMENT-SECRET`; an outbox success writes the update with `'recorded'` and `['u1', 'u2']` and returns `recorded`; a resend success returns `sent`; a failure `{ ok: false, error: 'boom' }` writes `'failed'`, `'boom'` and returns `failed`.
  - No base URL (`env = {}`): claimed rows marked `failed` with `No base URL is configured`; `send` not called; returns `failed`.
  - The snapshot rejecting with `{ code: '42P01', message: 'relation does not exist ... Failing row contains (secret)' }`: returns `error`; `console.error` was called with a string containing `42P01` and not containing `Failing row`.
- [ ] **Step 3: Run** `npx vitest run lib/__tests__/summary-email-dispatch.test.ts app/api/boards/\[boardId\]/__tests__/guided-lifecycle.test.ts`. Expected: the new tests FAIL; the open pins PASS.
- [ ] **Step 4: Implement** the two modules and the guided branch.
- [ ] **Step 5: EXPLAIN** on the dev database: the snapshot's first statement, the claim (plain `EXPLAIN` does not run the insert), the status update, and the changed guided complete statement. Report each plan's top node.
- [ ] **Step 6: Run** `npm test && npx tsc --noEmit && npx eslint lib/summary-email app/api/boards/\[boardId\]/route.ts`. Expected: PASS; the open complete, open reopen, open GET and PATCH snapshots unchanged (`git diff --stat` shows no change to their `__snapshots__` or inline snapshot text). Then, after the email-rule checks, `npx playwright test e2e/guided-discuss.spec.ts e2e/guided-mode.spec.ts e2e/completed-board-access.spec.ts`: all pass (guided completions ran for real with the flag off, so each dispatch returned `flag-off`); confirm with a read-only SELECT that `email_outbox` and `summary_email_sends` hold zero rows.
- [ ] **Step 7: Commit** `feat(email): completing a guided retro schedules the summary email, once per person per completion`

---

### Task 8: The summary page

**Files:**
- Create: `app/board/[boardId]/summary/page.tsx`, `lib/summary-route.ts`, `components/Summary/SummaryPage.tsx`, `components/Summary/SummaryView.tsx`, `components/Summary/index.ts`
- Test: new `lib/__tests__/summary-route.test.ts`

Why this shape (D3): (a) the access rule, the shapers and the minimal "closed to you" payload stay in the board GET and `boardAccessFrom`; the page calls that GET and adds no read path for content, so it cannot drift; (b) client-rendered content prints exactly like server-rendered content once loaded, and the print button exists only in the ready state; (c) no realtime is needed, so the page mounts no `AblyProvider`, no `useBoardChannel` and no board store. The thin server lookup exists only because "not found in the same way an unknown page does" needs a real 404 status, which a client page cannot produce. What the summary shows before completion: not available; a clear message and a link back to the board.

Who sees the content (exactly the GET's rule for a completed board): someone holding a participant cookie for the board, a signed-in user with a participant row on it, the owner, any `board_members` row (facilitator, participant or viewer) and a system admin (`lib/board-access.ts` `decideBoardAccess`, `canViewDetail`). Everyone else gets the GET's minimal payload (four board keys) and the page shows the closed view. Note: this is wider than the board page, which shows its closed view to anyone without a participant on a completed board (`components/pages/BoardPageWrapper.tsx:88`), owner included.

**Interfaces:**
- Consumes: `summaryViewState`, `headlineItems`, `summaryCommentAuthor`, `completedOnLabel`, `dueDateLabel`, `ownerLabel`, `statusLabel`, `summaryPath`, `summaryDocumentTitle` (Task 1); `agendaVotesLabel`, `agendaCardsLabel` (`lib/agenda.ts`); `COMPLETED_CLOSED_MESSAGE`; `DELETED_COMMENT_TEXT`; `NO_OWNER_LABEL`; `useAuthStore` (`isAuthenticated`); `AppShell`; `validateClientId`.
- Produces (`lib/summary-route.ts`): `guidedBoardExists(boardId: string): Promise<boolean>`: `validateClientId(boardId)` not ok is false with no query; then

```sql
SELECT to_jsonb(b) ->> 'mode' AS mode FROM boards b WHERE b.id = ${boardId} AND b.deleted_at IS NULL
```

  and true only when `mode === GUIDED_MODE` (a row from a database without 015 has no `mode` key and reads as null: false).
- Produces (`app/board/[boardId]/summary/page.tsx`): `export const dynamic = 'force-dynamic'`; `metadata = { title: SUMMARY_PAGE_TITLE, robots: { index: false, follow: false } }`; `if (!(await guidedBoardExists(boardId))) notFound();` (renders `app/not-found.tsx` with status 404, exactly as an unknown page); otherwise `<div className="min-h-screen bg-[var(--bg)]"><SummaryPage boardId={boardId} /></div>`.
- Produces (`SummaryPage`, client, inside `AppShell`): one `fetch(`/api/boards/${boardId}`, { cache: 'no-store' })` per mount and per `Try again` click (an `AbortController` cancels on unmount); its state comes from `summaryViewState`. States:
  - loading: `Loading summary...` (centred, `--ink-4`).
  - `failed`: `Could not load the summary.` and a button `Try again`.
  - `not-found`: `<h2>Board not found</h2>` and a link `Go Home` to `/` (reachable only if the board changed after the server lookup).
  - `closed`: `<h2>{title}</h2>`, `COMPLETED_CLOSED_MESSAGE`, then, only when `useAuthStore` says not signed in, `Took part with an account?` followed by the link `Sign in to see the summary` to `/login?redirect=${encodeURIComponent(summaryPath(boardId))}`; then a link `Go Home`. No content of any kind.
  - `not-completed`: `<h2>{title}</h2>`, `This summary will be ready when the retro is completed.`, a link `Back to the board` to `/board/${boardId}`.
  - `ready`: `<SummaryView summary={...} />`, and an effect sets `document.title = summaryDocumentTitle(title)` (the PDF's default file name).
- Produces (`SummaryView`, presentational, props `{ summary: RetroSummary }`), in this order, single column, `max-w-3xl mx-auto px-4 sm:px-6 py-8`, tokens `--ink`, `--ink-2`, `--ink-3`, `--ink-4`, `--line`, `--surface`, `--surface-muted`, `--accent`, `--accent-soft`, `--bg`, `--bg-elev` only (Task 9's print override covers exactly these), no new colour values:
  1. The root element carries `data-summary-root` and `data-testid="summary-root"`. A top bar (`data-testid="summary-toolbar"`) with a link `Back to the board` to `/board/{id}` (Task 9 adds the print button here).
  2. `<h1>{title}</h1>` and `<p>{completedOnLabel(completedAt)}</p>` (viewer's local time zone; omitted when `completedAt` is null).
  3. `<section aria-labelledby>` headed `At a glance`: six tiles from `headlineItems`, each `data-testid="summary-stat"` with the number large and the label under it; a 3-column grid at `sm` and up, 2 columns on phones.
  4. A code comment marking where Step 5's AI summary section will render (between "At a glance" and "Topics"). Nothing is built there.
  5. `<h2>Topics</h2>`; no topics: `No topics were discussed.`. Each topic is a `<section data-testid="summary-topic">`: `<h3>{rank}. {heading}</h3>` (full heading, `break-words`) with `agendaVotesLabel(score)` and, when not null, `agendaCardsLabel(cards.length)` beside it; `<h4>Cards</h4>` and a list of card texts (`whitespace-pre-wrap break-words`), children indented one level (`ml-6`, `border-l` with `--line`); `<h4>Discussion</h4>` and each thread (`summaryCommentAuthor` in `--ink-3`, then the body with `whitespace-pre-wrap break-words`; a deleted top-level comment shows only `This comment was deleted.`; replies indented one level), or `No comments.`; `<h4>Action items</h4>` and each item (description; a line `Owner: {owner}` or `No owner`; `Due: {date}` when `dueDateLabel` is not null; the status label), or `No action items for this topic.`.
  6. `<h2>Other action items</h2>` with the same item rendering, only when `otherActionItems` is not empty.
  7. `<h2>Participants</h2>` (`data-testid="summary-participants"`) and the names as a wrapping list.
  No card author appears anywhere; no comment author reads `You`.

- [ ] **Step 1: Write the failing tests** in `summary-route.test.ts` (mock `@/lib/db`): `guidedBoardExists('bad id!')` is false with zero queries; a missing row, `{ mode: 'open' }` and `{ mode: null }` are false; `{ mode: 'guided' }` is true; the statement text is pinned with `toMatchInlineSnapshot()` and contains `to_jsonb(b) ->> 'mode'` and `b.deleted_at IS NULL`, and does not match `/\bb\.mode\b/`.
- [ ] **Step 2: Run** `npx vitest run lib/__tests__/summary-route.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the helper, the server page and the two components.
- [ ] **Step 4: EXPLAIN** the lookup on the dev database.
- [ ] **Step 5: Run** `npx tsc --noEmit && npm test && npx eslint lib/summary-route.ts app/board components/Summary`. Expected: clean.
- [ ] **Step 6: Observe in a browser** with two profiles (A facilitator, B participant) on a guided dev board with two columns, a two-card group titled `Deploys` with votes, a solo card, a zero-vote card, one named comment, one anonymous reply by B, one deleted comment with a reply, one topic action item with owner B and a due date, one unlinked action item; then complete it through A's UI. At 1280px, 390px and 360px, light and dark: A's and B's summaries show the same topics in the same order as the Done view's agenda (record both orders); the six numbers match a count you make from the API; B's anonymous reply reads `Anonymous` on both A's and B's summaries; no `You` anywhere (search the page text); the tombstone shows with its reply under it; the action items show owner, due date and status; participants are listed. A stranger profile (no cookie, not signed in) sees the closed view with the sign-in prompt and no card text (search the HTML and the GET body for one card's text). Before completion (a second guided board) the summary shows `This summary will be ready when the retro is completed.` and `Back to the board`. `/board/<open board id>/summary` and `/board/zzzzzzzzzz/summary` both show the `404` page and answer status 404 (read from the navigation response). No horizontal scroll at 360px. An open board's grid, list and phone views read the same before and after this task. Save screenshots to `observe-8/`.
- [ ] **Step 7: Commit** `feat(summary): read-only summary page for completed guided retros`

---

### Task 9: The print stylesheet and the print button

**Files:**
- Modify: `styles/index.css` (one scoped block at the end), `components/Summary/SummaryView.tsx` (print attributes, the print button, the print-only footer)
- Test: new `lib/__tests__/summary-print-css.test.ts`

**Interfaces:**
- Consumes: Task 8's `SummaryView`; `PRINT_BUTTON`, `SUMMARY_PRINT_FOOTER_PREFIX`, `summaryPath`.
- Produces (`SummaryView`): in the top bar, a filled button `Print or save as PDF` whose handler is `() => window.print()`; the top bar carries `data-print-hide`; each topic's heading row, each card, each comment thread and each action item carries `data-print-avoid-break`; a footer with `data-print-only` reading `From RetroBoard: {window.location.origin}{summaryPath(id)}` (computed in an effect after mount, so the server and client render agree).
- Produces (`styles/index.css`), between the exact marker comments `/* summary print: start */` and `/* summary print: end */`, and nowhere else:

```css
/* summary print: start */
[data-summary-root] [data-print-only] { display: none; }
@page rb-summary { margin: 16mm 14mm; }
@media print {
  html:has([data-summary-root]),
  html:has([data-summary-root]) body,
  html:has([data-summary-root]) main { background: white !important; }
  html:has([data-summary-root]) header { display: none !important; }
  [data-summary-root] {
    page: rb-summary;
    color: black;
    background: white;
    --ink: black; --ink-2: black; --ink-3: black; --ink-4: black;
    --bg: white; --bg-elev: white; --surface: white; --surface-muted: white;
    --line: black; --accent: black; --accent-soft: white;
  }
  [data-summary-root] * { box-shadow: none !important; }
  [data-summary-root] [data-print-hide] { display: none !important; }
  [data-summary-root] [data-print-only] { display: block !important; }
  [data-summary-root] [data-print-avoid-break] { break-inside: avoid; }
  [data-summary-root] h2, [data-summary-root] h3, [data-summary-root] h4 { break-after: avoid; }
  [data-summary-root] a { color: black; text-decoration: underline; }
}
/* summary print: end */
```

What print must do: no app chrome (the header, the top bar with its link and button); black on white whatever the theme (the token overrides apply inside the summary root; `black` and `white` are the only colour words, used only here, because "black on white" is the requirement and no token holds pure black); headings stay with what follows and cards, threads and items are not split where avoidable; links readable (black, underlined) and the board link printed in the footer; page margins through the named page `rb-summary`, so printing any other page keeps the browser's defaults (an unnamed `@page` rule would change every page's print).

- [ ] **Step 1: Write the failing contract test** `summary-print-css.test.ts`: read `styles/index.css`; the start and end markers occur exactly once each; inside the block, every selector (split rule preludes on `,`, ignoring `@media print` and `@page rb-summary`) starts with `[data-summary-root]` or `html:has([data-summary-root])`; the block has no `@page {` (unnamed) and the file outside the block has no `rb-summary`; the only colour values in the block are the words `black` and `white` (no `#`, `rgb`, `oklch`, `hsl`); the block contains `[data-summary-root] [data-print-hide] { display: none !important; }`. Show it can fail once by temporarily adding `header { display: none; }` inside the block, then revert.
- [ ] **Step 2: Run** `npx vitest run lib/__tests__/summary-print-css.test.ts`. Expected: FAIL (no block).
- [ ] **Step 3: Implement** the block and the `SummaryView` changes.
- [ ] **Step 4: Run** `npx tsc --noEmit && npm test && npx eslint components/Summary`. Expected: clean.
- [ ] **Step 5: Observe in a browser** on Task 8's completed board, as B: at 1280px, 390px and 360px, light and dark, the button shows and a click calls `window.print` once (stub it with `page.addInitScript` and count). With `page.emulateMedia({ media: 'print' })` in dark theme: the header and the top bar are not visible, every topic heading is visible, the footer line is visible, and `getComputedStyle` of the summary root reads `color: rgb(0, 0, 0)` and `background-color: rgb(255, 255, 255)`. Save `page.pdf({ path: '.superpowers/sdd/2026-11-21-guided-wrap-up/observe-9/summary.pdf', format: 'A4' })` taken in dark theme, and open it: black on white, no buttons, margins present, no topic heading alone at the bottom of a page. As a control, an open board page under print emulation still shows its header (the summary's rules do not reach it). Save screenshots to `observe-9/`.
- [ ] **Step 6: Commit** `feat(summary): print stylesheet and a Print or save as PDF button`

---

### Task 10: The link from the completed board

**Files:**
- Create: `components/Summary/SummaryLinkBar.tsx`
- Modify: `components/Discuss/DiscussView.tsx`, `components/Discuss/MobileDiscuss.tsx`

**Interfaces:**
- Consumes: `useBoardStore` (`board` selected as two primitives: `board?.id`, and `summaryAvailable(board)` as a boolean), `summaryAvailable`, `summaryPath`, `SUMMARY_COMPLETED_BAR`, `VIEW_SUMMARY`.
- Produces: `<SummaryLinkBar layout: 'desktop' | 'phone' />`: renders nothing unless `summaryAvailable(board)`; otherwise a bar (`data-testid="summary-link-bar"`, `--accent-soft` background, `--line` border, `--r-md`) with the text `This retro is completed.` and a Next `Link` `View summary` (`data-testid="summary-link"`) to `summaryPath(board.id)`, styled as a filled button; on `phone` the link is at least 44px tall and the bar wraps.

Where it shows: on a completed guided board, both shells show the Done view, which is where the facilitator and every joined participant land. Desktop: `DiscussView` renders `<SummaryLinkBar layout="desktop" />` as the first child of its root, above the agenda and topic grid (facilitator and participant alike). Phone: `MobileDiscuss` renders `<SummaryLinkBar layout="phone" />` as the first child of its scroll region, above `ViewingAnotherBar` and the topic panel. Nothing else changes: no header button, no change to the board page's closed view (`BoardPageWrapper`, shared with open boards), no dashboard change. Open boards never render `DiscussView` or `MobileDiscuss`, so they show nothing new.

- [ ] **Step 1: Build `SummaryLinkBar`** and mount it in the two places above.
- [ ] **Step 2: Run** `npx tsc --noEmit && npm test && npx eslint components/Summary components/Discuss`. Expected: clean.
- [ ] **Step 3: Observe in a browser** with A (facilitator) and B (participant) on a guided dev board: in Discuss (not completed) no bar on either profile at any width; A completes through the UI; without a reload both profiles show the bar in the visible shell at 1280px (above the agenda) and at 390px and 360px (top of the topic area, link at least 44px tall, no horizontal scroll); clicking `View summary` opens the summary on both. Light and dark. A completed OPEN board (complete one through the UI) shows no bar and its views read the same before and after this task. Save screenshots to `observe-10/`.
- [ ] **Step 4: Commit** `feat(ui): a View summary link on completed guided boards`

---

### Task 11: Two-browser end-to-end run and verification

**Files:**
- Create: `e2e/guided-wrap-up.spec.ts`
- Modify: `e2e/helpers.ts`, `e2e/e2e-run.ts`, `e2e/global-teardown.ts`

**Interfaces:**
- Consumes: everything above; existing helpers (`createBoard`, `apiJoin`, `joinAs`, `capture`, `hasJsonField`, `getBoard`, `apiAddCard`, `apiMovePhase`, `apiVote`, `apiCombine`, `apiGroups`, `apiComment`, `apiActionItem`, `apiPatchActionItem`, `setFlagDirect`, `shown`); `signUnsubscribeToken` imported as `../lib/email-unsubscribe`.
- Produces (`e2e/e2e-run.ts`): `E2E_USER_EMAIL_PREFIX = 'e2e-'`, `E2E_USER_EMAIL_DOMAIN = '@example.com'`.
- Produces (`e2e/helpers.ts`, each with the two dev-only guards of `voteRowsDirect`, touching only rows the test created):
  - `createUserDirect(opts: { verified: boolean }): Promise<{ id: string; email: string; name: string }>`: first read `information_schema.columns` for `"user"` once and fail with a clear message if a NOT NULL column without a default is not in the list below; then `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES (${'e2e' + nanoid(20)}, ${name}, ${`e2e-${nanoid(10).toLowerCase()}@example.com`}, ${verified}, now(), now())`.
  - `setBoardOwnerDirect(boardId, userId)`, `linkParticipantUserDirect(boardId, participantId, userId)`, `addMemberDirect(boardId, userId, role: 'facilitator' | 'participant' | 'viewer')`, `setSummaryPreferenceDirect(userId, enabled: boolean)` (the same upsert as Task 5).
  - `outboxRowsDirect(boardId): Promise<{ to_address: string; subject: string; text_body: string; html_body: string; headers: Record<string, string> }[]>` and `summarySendsDirect(boardId): Promise<{ user_id: string; status: string; error: string | null }[]>` (read-only SELECTs ordered by `to_address` / `user_id`), `preferenceDirect(userId): Promise<boolean | null>` (null when no row).
  - `apiComplete(request, boardId)` (POST `{ action: 'complete' }` to the board route), returning the raw response.
- Produces (`e2e/global-teardown.ts`): after deleting the run's boards, `DELETE FROM "user" WHERE email LIKE ${E2E_USER_EMAIL_PREFIX + '%' + E2E_USER_EMAIL_DOMAIN} AND "createdAt" >= ${startedAt}::timestamptz` (preferences and send rows cascade), and `UPDATE feature_flags SET is_enabled = false WHERE key = 'summary_email'`, logging both counts.

Every statement this plan adds runs for real below: the summary lookup (Tests 4, 7), the guided complete with `archived_at IS NULL` (Tests 1, 2, 3, 4), the dispatch snapshot, claim, outbox insert and status update (Tests 1, 3), the preference upsert through unsubscribe (Test 3). The preference read ran for real in Task 6 (it needs a signed-in session, which e2e cannot create: sign-up is behind a CAPTCHA).

- [ ] **Step 1: Write the spec.** `beforeAll`: throw `Refusing to run: SUMMARY_EMAIL_TRANSPORT is set` if `process.env.SUMMARY_EMAIL_TRANSPORT !== undefined` (this process loads `.env.local` exactly as the dev server does); `setFlagDirect('guided_mode', true)`; `setFlagDirect('summary_email', true)`. `afterAll`: `setFlagDirect('summary_email', false)`. A `retro(browser)` builder makes a guided board with A (facilitator, `createBoard(..., { mode: 'guided', displayName })`) and B (joined), cards in Reflect, a two-card group titled `TOPIC-<rand>` (the child's text `CHILD-<rand>`), votes, an anonymous comment by B with body `COMMENT-<rand>`, an action item `ACTION-<rand>` on the group with owner B and due date `2026-11-30`, and moves to Discuss through the API.

```ts
test('completing a guided retro records one summary email per eligible account, once', async ({ browser }) => {
  // Users: U1 verified (owner via setBoardOwnerDirect), U2 verified (B's participant linked AND a member: one email),
  // U3 verified member opted out (setSummaryPreferenceDirect false), U4 unverified linked to a third participant.
  // apiComplete(A) is 200. expect.poll(outboxRowsDirect(boardId).length, 15 s) is 2; addresses are exactly U1 and U2,
  // every to_address ends with '@example.com'. summarySendsDirect: U1 and U2 'recorded', nothing for U3 or U4.
  // Each row: subject 'Retro summary: e2e <id>'; text contains 'TOPIC-<rand>', 'ACTION-<rand> (Owner: <B name>; Due: November 30, 2026)',
  // '/board/<id>/summary'; headers['List-Unsubscribe-Post'] is 'List-Unsubscribe=One-Click'.
  // Absence: neither part contains 'COMMENT-<rand>' or 'CHILD-<rand>'. Control: B's summary page shows both markers.
  // apiComplete(A) again is 409 'Board is completed'; after 3 s outboxRowsDirect still has 2 rows (Review Focus 1, 3).
});

test('with the summary_email flag off, completing records and sends nothing', async ({ browser }) => {
  // setFlagDirect('summary_email', false) at the start, back on at the end (finally). Same users linked as in test 1.
  // apiComplete is 200; after 5 s outboxRowsDirect and summarySendsDirect are both empty.
  // Control: test 1 recorded rows for the same setup with the flag on (Review Focus 6).
});

test('the unsubscribe link: a GET changes nothing, the one-click POST opts out, the next retro skips that person', async ({ browser, playwright }) => {
  // From test-1-style rows, take U1's List-Unsubscribe URL. page.goto the text body's page URL three times and request.get the
  // API URL (it answers 303 to the page): preferenceDirect(U1) stays null. The page shows 'Unsubscribe'.
  // request.post(API URL, form 'List-Unsubscribe=One-Click') is 200 { ok: true }; preferenceDirect(U1) is false; the same POST again is 200 { ok: true }.
  // The URL with its last character changed: POST is 400 'This link is not valid.'.
  // signUnsubscribeToken('e2e-no-such-user') (secret from .env.local): POST is 200 { ok: true }, the same body as a live account.
  // A second guided retro with U1 and U2 linked, completed: outbox has U2 only (Review Focus 4).
});

test('the summary shows topics, comments and action items to people who took part, and nothing to an outsider', async ({ browser }) => {
  // Before completion: B's /board/<id>/summary shows 'This summary will be ready when the retro is completed.' and 'Back to the board'.
  // capture() on A's summary page after completion. A and B: the topic headings in the same order as the Done view's agenda items;
  // the six summary-stat numbers equal counts computed from getBoard; B's comment reads 'Anonymous' on A's AND B's page; no 'You' in either page's text.
  // Absence: hasJsonField(capA, 'author_participant_id', bId) and hasJsonField(capA, 'author_name', bName) are false.
  // Control: hasJsonField(capA, 'display_name', bName) is true.
  // A stranger browser context (no cookie, not signed in): the closed view with COMPLETED_CLOSED_MESSAGE and 'Sign in to see the summary';
  // neither the page text nor any captured body contains 'TOPIC-<rand>' or 'CHILD-<rand>'. Control: B's page contains them (Review Focus 2).
});

test('the summary prints black on white without the app chrome', async ({ browser }) => {
  // B's summary in dark theme (header ThemeToggle until html[data-theme="dark"], wait 1500 ms). addInitScript stubs window.print to count.
  // Click 'Print or save as PDF': the count is 1. emulateMedia print: the header and summary-toolbar are hidden, every summary-topic h3 is visible,
  // the print-only footer is visible, the root's computed color is rgb(0, 0, 0) and background rgb(255, 255, 255).
  // page.pdf to .superpowers/sdd/2026-11-21-guided-wrap-up/observe-11/summary.pdf; the file exists and is larger than 10 KB (Review Focus 5).
});

test('the summary fits a phone and a completed guided board links to it on both shells', async ({ browser }) => {
  // After completion, B's board page at 1280x800: the visible [data-testid="summary-link"] reads 'View summary' and opens the summary.
  // At 390x844 and 360x780: the visible link is at least 44 px tall and opens the summary; on the summary,
  // document.documentElement.scrollWidth <= window.innerWidth. Before completion no visible summary-link exists (control: it exists after).
});

test('an open board: completing sends nothing, the summary is not found, and no link appears', async ({ browser }) => {
  // Open board with A (admin) and B joined, U1 verified set as owner. apiComplete(A) is 200; after 5 s outbox and sends are empty
  // (control: test 1). page.goto('/board/<open id>/summary') answers 404 and shows 'Page not found'; so does '/board/zzzzzzzzzz/summary'.
  // A's board page shows no visible summary-link (control: test 6 found it on a guided board). getBoard has no 'comments' key (Review Focus 7).
});
```

- [ ] **Step 2: Run** `npx playwright test e2e/guided-wrap-up.spec.ts` (after the email-rule checks). Expected: 7 passed. Fix the product, not the test; a failure that needs a design change stops the task and goes back to the controller.
- [ ] **Step 3: Show the guards can fail.** One at a time, each reverted before the next: (a) make `renderSummaryEmail` append the first thread's comment body to `text`: test 1 FAILS on its absence assertion; (b) replace `COALESCE(ep.summary_email, true)` in the claim with `true`: test 3 FAILS (U1 gets a row); (c) delete the `[data-print-hide]` rule from the print block: test 5 FAILS; (d) make `guidedBoardExists` return true for any existing board: test 7 FAILS on the 404. Report the four failures; `git status` shows a clean tree afterwards.
- [ ] **Step 4: Run the full suites.** Run: `npx tsc --noEmit && npm test && npm run test:e2e`. Expected: `tsc` clean; every unit test passes (1354 in 68 files before this plan plus the new ones; report the count and the file count); e2e 111 passed (104 plus 7), 0 failed, 1 skipped, including `e2e/completed-board-access.spec.ts`, `e2e/guided-discuss.spec.ts` and `e2e/guided-mode.spec.ts` unchanged. Then confirm with read-only SELECTs that the dev database holds no `e2e-%@example.com` user from this run, `summary_email` is off, and `email_outbox` holds no row whose `to_address` does not end with `@example.com`.
- [ ] **Step 5: Stop the dev server by its PID, confirm `lsof -ti tcp:3001` prints nothing, then run** `npm run build`. Expected: passes. Restore `next-env.d.ts` if it changed.
- [ ] **Step 6: Commit** `test(e2e): wrap-up across two browsers: summary page, print and the summary email outbox` (stage `e2e/guided-wrap-up.spec.ts`, `e2e/helpers.ts`, `e2e/e2e-run.ts`, `e2e/global-teardown.ts` by name).
- [ ] **Step 7: Hand back to the controller.** The controller, not the implementer, pushes `feature/guided-wrap-up` and opens a PR (base per the Global Constraints) titled `Wrap-up (Parabol parity Step 4)`. The description lists: migration 018 (dev applied, production not; production needs 015 to 017 first), that the email is off by flag and by transport and what the owner must do first ("Before this is turned on"), that it emails only verified addresses (none today), the test counts, what was seen in the browser at each width and theme, the saved PDF, the design questions and their answers, and the "Out of this plan" list. It stays unmerged for Jordan.

---

## Out of this plan

- Extra addresses a facilitator types (the spec's design decisions mention them): owner's decision; without care this is an open relay for abuse.
- Email verification itself (Better Auth `requireEmailVerification` and a verification email through Resend): owner's decision, account lifecycle work; until it ships this feature emails nobody (Design question 1).
- Automatic retry of `failed` or `pending` sends, and a sweep for completed guided boards with no send rows: hardening, needs a scheduler (Vercel Cron, Step 11).
- Resend bounce and complaint webhooks, and suppressing addresses that bounce: hardening, before volume grows.
- The AI summary section on the page and in the email: Step 5 (a marked place exists in `SummaryView` and in `renderSummaryEmail`; `RetroSummary` has no AI field yet).
- Posting "summary posted" to Slack or Teams: Step 8 (`dispatchSummaryEmail` is the natural place to fan out).
- A link to the summary from the dashboard, team pages or the board page's closed view: Step 6 or owner's decision.
- Summaries for open boards: owner's decision.
- A summary for a board in Trash (restore first): not building.
- A facilitator "send the summary again" button: owner's decision.
- A per-board opt-out (only the account-wide one is built): later, if asked.
- Card authors on the summary, and "You" labels: owner's decision (Design question 3).
- The completion date in the email, time zones and localized formats: later.
- Server-side PDF: not building (spec). Changes to the Markdown and CSV exports: none.
- Purging old `email_outbox` rows on the dev database and a retention rule for `summary_email_sends`: hardening.
- Pre-existing items found in Step 3 (participants on desktop cannot open the Actions panel; the phone emoji picker clip; the phone Actions sheet date/delete overlap): unchanged, still listed for Jordan.
- Applying 015 to 018 to production: the promotion.

## Before this is turned on

The owner's steps, in order, before `summary_email` is turned on in production and before `SUMMARY_EMAIL_TRANSPORT=resend` is set anywhere:

1. Promote the branch and apply migrations 015, 016, 017 and 018 to production in that order (018's schema needs only 013, but the feature reads 015 to 017).
2. Decide email verification. As built, the recipient query requires `"user"."emailVerified" = true`, and verification is off for every user today (`lib/auth.ts` has no `requireEmailVerification` and no verification email), so the feature sends to nobody. Either ship verification first, or decide to drop that one condition (a one-line change with a test), accepting that an address may not belong to the person who signed up with it.
3. Resend: confirm `retroboard.live` is verified for sending (SPF, DKIM, DMARC; the password reset already sends from `noreply@retroboard.live`), and check the plan's daily and monthly quota and rate limit against the expected volume (eligible people per completion, at most 100, times completions per day). The transport uses one batch call per completion.
4. Vercel environment variables: set `SUMMARY_EMAIL_TRANSPORT=resend` in **Production only**. Untick Preview and Development when adding it: Preview uses the dev database, a copy of production with real addresses. The code now also requires the production deployment for real sending (`VERCEL_ENV` must be exactly `production`), so a variable that ends up set in Preview makes every send refuse and record nothing instead of sending; still untick them. Confirm `NEXT_PUBLIC_APP_URL` is `https://retroboard.live` in Production (email links), `RESEND_API_KEY` is present, and Upstash rate limiting is configured (the preference and unsubscribe routes fail open without it).
5. Confirm `NEXT_PUBLIC_APP_URL` (or, when it is empty, the fallback `BETTER_AUTH_URL`) is a bare origin: scheme and host only, no path and no trailing newline. Anything else makes every send be marked failed and nothing goes out. The self-test in step 10 shows this.
6. Confirm `PARTICIPANT_SESSION_SECRET` differs between Preview and Production. If it is the same, unsubscribe links and participant cookies minted against the dev database verify on production for the same ids.
7. Update `/privacy`: summary emails, what they contain (title, numbers, topic headings, action items, a link; never comment text), the one-click unsubscribe and the account setting, and that RetroBoard stores per-person send status (`summary_email_sends`: account id, status, error).
8. Know the coupling: rotating `PARTICIPANT_SESSION_SECRET` invalidates every unsubscribe link already sent (and every participant cookie).
9. Know who is emailed: the board owner and the current members (every role, viewers included). A person who was removed from a board, or who left it, gets nothing, even though their participant row remains. Apply migration 018 in a quiet window: it briefly locks `boards` and `"user"`. Consider adding an index on `summary_email_sends(user_id)` before it reaches production.
10. Send yourself one real summary: on production, link only your own account to a guided test board, turn the flag on, complete it, check the email (both parts, the unsubscribe header, the link), then decide whether to leave the flag on.
11. Before turning the flag on, count the accounts with a verified address on production. Each one that is the owner or a member of a completed guided board is emailed from then on.
12. Turn on `summary_email` in `/admin` feature flags.
13. Watch `summary_email_sends` for rows still `pending` ten minutes after completion (an interrupted function) or `failed`.
14. After any interrupted end-to-end run, nothing needs doing by hand: the next run's setup now forces the dev `summary_email` flag off before it starts. Until that next run, the dev flag may still be on, which only matters for the dev database.

## Design questions for the controller

Each was decided as recommended and the plan is written that way. Controller (2026-11-21): all twenty-two accepted as recommended, and the four findings below are ruled as the plan has them (the summary's audience follows the board GET; the guided complete becomes conditional on `archived_at IS NULL`; turning the flag on in the dev database for Task 6's observation counts as dev test setup; the thin server lookup for the 404). One change written into Task 6: its throwaway account is created through Better Auth's server API in a guarded script, never through the CAPTCHA-protected pages. Questions 1 (only verified addresses), 3 (no card authors and no "You" on the summary), 4 (a reopen then completion emails again) and 9 (viewers are recipients) are listed for Jordan in the PR.

1. **Only verified addresses receive the email (`u."emailVerified" = true` in the claim).** Better Auth's `user` table always has this column and every value is false today, so the feature emails nobody until verification ships. Recommendation: keep it; it makes "an address may not belong to its signer" impossible by construction, and enabling verification later needs no code change (D7). Alternative: send to every account address and make verification an owner checklist item. Cost if wrong: the feature is inert in production until verification exists, or (alternative) mail can reach someone who never owned the address.
2. **The summary page is a thin server lookup (for the 404) plus a client page that calls the existing board GET.** Recommendation: as written (reasons in Task 8). Alternative: a server component that renders from a shared snapshot function extracted from the GET. Cost if wrong: a short loading state and no server-rendered HTML; the alternative would refactor the pinned GET.
3. **The summary never shows card authors and never says "You"; an anonymous comment reads `Anonymous` even to its own author.** A summary is printed and forwarded; "You" would mislead a reader of someone else's PDF, and showing the viewer's own anonymous card or comment under their name would unmask it once shared. Alternative: the board's own labels (`You`, `You (anonymous)`, card authors on named boards). Cost if wrong: readers of a named retro's summary cannot see who wrote which card.
4. **A reopen followed by another completion emails again** (new `archived_at`, new key). Alternative: once per board ever (key on the board alone). Cost if wrong: people get a second email after a reopen; with the alternative, a corrected summary is never sent.
5. **The guided complete statement gains `AND archived_at IS NULL` and answers 409 `Board is completed` when it finds no row.** Without it two simultaneous completions both succeed with different `archived_at` values and could each email. Guided branch only; the open statement is untouched. Alternative: leave the statement and accept a rare double email. Cost if wrong: none found; a lost race now gets 409 instead of a silent second completion.
6. **The outbox is a database table (`email_outbox`), and the outbox transport refuses to run when `VERCEL_ENV === 'production'`** (the sends are marked `failed`). The e2e process must read what the dev server would have sent, across processes, so memory cannot work; refusing in production means a forgotten transport variable fails visibly and rendered emails never pile up in the production database. Alternative: record in production too. Cost if wrong: a production launch without the variable records failures instead of quietly storing emails.
7. **The unsubscribe token is an HMAC with a key derived from `PARTICIPANT_SESSION_SECRET`, binding the purpose and the account id, with no expiry.** Alternative: a separate `EMAIL_UNSUBSCRIBE_SECRET` (one more variable to set in every environment). Cost if wrong: rotating the participant secret also breaks old unsubscribe links (the account setting still works).
8. **Unsubscribe does not depend on the flag.** Turning the flag off must not strand people who already got an email. Alternative: gate it. Cost if wrong: none found.
9. **Recipients are the owner, every `board_members` row (viewer role included) and every participant linked to an account, de-duplicated, at most 100.** Alternative: leave viewers out, or no cap. Cost if wrong: viewers get an email they may not want (they can opt out); a board with more than 100 linked accounts emails the first 100 by user id.
10. **One Resend batch call per completion, one status for the whole batch, an idempotency key `summary/{boardId}/{completedAtMs}`.** Alternative: one call per person with per-person status. Cost if wrong: one failing address fails the batch's status for everyone (the batch API validates first; per-address delivery failures arrive later as bounces, out of this plan).
11. **The `View summary` bar shows only in the Done view (both shells), not on the board page's closed view.** The closed view is shared with open boards (D1). An owner or member who never joined reaches the summary from the email or by URL. Alternative: also add it to the closed view when the full payload says guided. Cost if wrong: such an owner has no link on the board page.
12. **The summary's closed view adds `Took part with an account?` and a `Sign in to see the summary` link, shown only to people not signed in.** Email recipients are account holders who may open the link in a browser without a session. Alternative: exactly the board page's closed view. Cost if wrong: one extra line of copy on a closed page; it reveals nothing.
13. **The summary page uses `AppShell` on screen** (header, theme toggle, account menu), hidden in print. Alternative: a bare page. Cost if wrong: none found.
14. **Trashed guided boards have no summary for anyone** (the server lookup requires `deleted_at IS NULL`), although the GET still shows a trashed board to its owner. Alternative: follow the GET there too. Cost if wrong: an owner restores the board to see its summary.
15. **The email truncates topic headings to 120 characters; the page shows them in full.** Alternative: full headings in the email. Cost if wrong: a long solo-card heading is cut in the email.
16. **The email omits the completion date** (a server cannot know each reader's time zone). Alternative: a UTC date. Cost if wrong: none.
17. **`Other action items` appears only when there are some; the email lists every action item, topic ones first in agenda order.** Cost if wrong: one heading.
18. **Headline: cards count every card including grouped children; comments exclude tombstones; votes are the sum of counts.** Cost if wrong: a number differs from someone's expectation; each is one line in `buildRetroSummary`.
19. **Print uses the colour words `black` and `white` inside the scoped print block** (D13 says no new colour values; no token holds pure black, and "black on white" is the requirement). Alternative: map print to the light theme's tokens (near black on off-white). Cost if wrong: a reviewer reads the two words as new colours.
20. **The preference write is `POST /api/user/email-preferences`, not `PUT`,** so it fits the limiter wiring test's "POST limits first" rule. Cost if wrong: none.
21. **The Email settings section renders only when the public flags response says `summary_email` is on** (strict reading, a missing flag is off). Before 018 the route would 404 anyway; this keeps the settings page from even asking. Alternative: always show it. Cost if wrong: people cannot pre-set the preference before launch.
22. **Participants are sorted by lowercased display name in code-unit order, not by locale collation.** Deterministic in node and every browser. Cost if wrong: accented names sort after `z`.

### Findings about D1 to D13 (nothing is unworkable; four need a ruling)

- D6 versus D13 and the browser rule: the Email settings section exists only while `summary_email` is on (D2 forbids the settings page from naming 018 tables otherwise), so observing it in a browser requires turning the flag on in the dev database outside the e2e spec's setup, which D6's letter forbids. The plan treats Task 6's observation script as dev test setup (flag on, observe, flag off, never with the `resend` transport). Needs a ruling.
- D7's verified filter is real but empties the audience: Better Auth's `user` table has `"emailVerified"` and, with verification off (`lib/auth.ts:36-41`: no `requireEmailVerification`, no `sendVerificationEmail`), every value is false. E2E must create its accounts with `"emailVerified" = true` directly in the dev database. Needs a ruling (Design question 1).
- D3 "exactly who may see the full payload today" is wider than the board page: the GET gives the full payload to an owner, a member or a system admin who never joined (`lib/board-access.ts:34-45`, `app/api/boards/[boardId]/route.ts:87-105`), while the board page shows such a person its closed view (`components/pages/BoardPageWrapper.tsx:88`). The plan follows the GET, so those people can read the summary but not the board. Needs a ruling.
- D9's "at most once per completion" is not guaranteed by the current guided complete statement: it has no `archived_at IS NULL` condition (`app/api/boards/[boardId]/route.ts:367-373`), so two simultaneous completions both succeed. The plan adds the condition to the guided statement only (Design question 5). Needs a ruling because it changes a guided response (a lost race answers 409).
- D1's "not found in the same way an unknown page does" cannot be met by a client page alone (it would answer 200); the plan adds a server lookup that reads `to_jsonb(b) ->> 'mode'`, which D2 allows.
- D8 and e2e: the account setting is authenticated by a Better Auth session and e2e cannot sign in (sign-up is behind a CAPTCHA; `e2e/completed-board-access.spec.ts:21-22`). The setting shares its write with unsubscribe, which e2e runs for real; its read runs for real only in Task 6's browser run.
- D10 "from-address from the existing configuration": the existing configuration is a literal inside `sendPasswordResetEmail` (`lib/email.ts:18`); the plan moves it to `EMAIL_FROM` with a pin on the password reset call.
- The shared client flag store reads a missing flag as ON (`lib/phases.ts:286-289`, the comment on `guidedModeEnabled`); the settings page must not use it for `summary_email`, so the plan adds the strict `flagEnabled`.
- `lib/email.ts`'s existing password reset copy contains an em dash; it is not touched (the pin copies it from the file).
