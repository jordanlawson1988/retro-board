# Discuss (Parabol parity Step 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a guided board in Discuss, everyone sees one ranked agenda of topics built from every column, follows the topic the facilitator has chosen (and can look at another one and come back), discusses each topic in a comment thread with one level of replies and an optional anonymous flag, and records action items inside the topic with a real owner picked from the board's people. Votes left on a card inside a group count toward that group's per-card limit. Open boards stay exactly as they are.

**Architecture:** Task 1 makes votes group-aware first (the agenda ranks by group score): the guided add statement checks the per-card limit against the person's votes on the lead and its children, and the guided remove takes from the lead's own row first and then from one of the person's rows on a child, all under the existing per-board vote lock. Migration 017 adds a `comments` table and two nullable columns on `action_items` (`card_id`, `assignee_participant_id`). The agenda is derived, never stored: one pure function `buildAgenda` in `lib/agenda.ts` (group score descending, then earliest `created_at` to the millisecond, then id in code-unit order), mirrored by one SQL ordering used only when the phase route moves a board into Discuss. The current topic is `phase_config.topic` (optional key, so an open board's `phase_config` stays `{ deadline: null }`), written by the phase route (computed inside the move statement, or set by a new `set-topic` action) and published with the existing `phase-changed` event. Comments have their own route (create, edit, delete) and travel to the client inside the guided board GET (Discuss and Done only), shaped per viewer by `shapeComment` in `lib/board-view.ts`, and live through three new events published by `lib/board-publish.ts`. Topic-linked action items go through the existing action-items route, which takes a guided statement after the mode check; the open statements are pinned before the file changes. Every new write is conditional inside its statement on the loaded phase, `archived_at IS NULL` and `deleted_at IS NULL`, and locks the board row `FOR SHARE` so a phase move or completion cannot slip between the check and the write. On the client, Discuss and Done on a guided board replace the four board views (desktop) and the column list (phone) with one Discuss view, so there is exactly one place cards appear in Discuss and it always agrees with the agenda.

**Tech Stack:** Next.js 16 route handlers, `@neondatabase/serverless`, Ably (REST publish), Zustand 5, Vitest (node), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-parabol-parity-design.md` (sections "Discuss and actions", "Design decisions" ("People without accounts stay inside the board", "One function shapes what each viewer may see", "Groups keep the existing shape", "Done means completed"), "Step 3: discuss", "Step 4: wrap-up", "Step 5: AI", "Not building", "Risks"). Step 2 plan: `docs/superpowers/plans/2026-11-20-guided-group-vote.md`. Step 2 ledger rulings R1 to R19: `.superpowers/sdd/2026-11-20-guided-group-vote/progress.md`.

## Global Constraints

- Work in `/Users/jordan.lawson/Projects/retro-board/.worktrees/guided-mode-core` on branch `feature/guided-discuss`. Do not switch branches and do not `cd` to the parent repository. The PR targets `feature/guided-group-vote` (PR #30) until that PR merges; the controller decides. Never push to `develop` or `main`. No task pushes or opens a pull request.
- Commits: conventional commit subjects; never `git commit -a`, `-am` or `git add -A`; stage files by name. Every commit message ends with a blank line and then exactly the line `Claude-Session: https://claude.ai/code/session_01Y4KwMbz98PW3K8YxSqvEY9`. `next-env.d.ts` is restored if a build or dev run changes it and is never committed.
- Migration: `scripts/migrations/017_discuss.sql`, additive, guarded, re-runnable, one transaction, in the style of 015 and 016. Applied to the Neon `dev` branch only, by Task 3. Production has migrations up to 014; applying 015, 016 and 017 there belongs to a later promotion.
- Production safety (D2): no SQL statement on a path an open board can take may name a column or table added by 015, 016 or 017 (`mode`, `phase`, `phase_config`, `votes.count`, `cards.group_title`, `comments`, `action_items.card_id`, `action_items.assignee_participant_id`). A guided branch is chosen in TypeScript after the mode check (`loaded.board.mode === GUIDED_MODE`) and only it names new columns. Before a task changes a file that holds open-board statements, it pins those statements with `toMatchInlineSnapshot()` (or extends an existing pin) on the unmodified file; the pins must pass unchanged at the end of the task.
- Known open-board payload difference (accepted, listed for Jordan): once 017 is applied, every action item row an open board reads with `SELECT *` or returns with `RETURNING *` carries `card_id: null` and `assignee_participant_id: null` (board GET `actionItems`, the action-items POST and PATCH responses, and the `action-item-created` and `action-item-updated` events). No statement text changes. Same treatment as Step 2's ruling R1.
- `PhaseConfig.topic` is OPTIONAL. Never add it to `DEFAULT_PHASE_CONFIG`: `lib/board-actor.ts` merges that default into every board's `phase_config`, and the board GET returns it for open boards (`app/api/boards/[boardId]/route.ts` `modeFields`), so a default `topic` key would change every open-board GET (pinned by `get-guided-fields.test.ts` "a row with no mode key returns the open defaults").
- All development and tests use the Neon `dev` branch and the Ably app `retro-board-dev` (`NEON_BRANCH=dev`). Dev server port 3001. `lib/db.ts` and `lib/auth.ts` stay lazy; import `ably-server` inside functions.
- Every board write goes through `loadBoardActor` + `checkAction`, with identity only from the signed participant cookie. Every comment returned or published goes through `shapeComment` / `shapeComments` (`lib/board-view.ts`) or the payload builders in `lib/board-publish.ts`. Never return or publish a raw comment row, and never return or publish another person's vote rows while votes are secret. Action item events keep their existing names and payload shape (`{ item }`, `{ itemId }`); this plan adds no action item event.
- A write costs two database round-trips: the actor load and one statement (a `sqlTransaction` batch counts as one). Every refusal this plan adds is decided from columns that one statement returns.
- A guided write statement is conditional INSIDE the statement on the phase the request was checked against (`phase = $phase`), `archived_at IS NULL` and `deleted_at IS NULL`, and answers 409 `PHASE_CHANGED_ERROR` (`The phase already changed`) when that fails. Locking, per write: guided votes keep the per-board advisory lock `voteLockKey(boardId)` (they must serialize against each other and against limit changes) and, from Task 1, also read the board row `FOR SHARE` (so a completion cannot slip between a vote's check and its write); the phase move keeps it (the topic is computed inside that locked statement); comment writes and guided action item writes take NO advisory lock and instead read the board row with `FOR SHARE` in their `ok` CTE, which conflicts with the row lock every `UPDATE boards` takes (phase move, set-topic, complete), so the write either commits before the move or re-checks the moved row and fails; `set-topic` is itself an `UPDATE boards ... WHERE phase = $phase`, serialized by the row lock. None of these touch votes, so the vote lock would add nothing.
- Guard status codes: 401 no participant session, 403 identified but not allowed, 404 a named thing (card, topic, comment, person, action item) is not on this board, 409 board state or phase forbids it, 422 a vote limit, 400 a malformed body.
- The minimal no-access board GET payload keeps exactly four board keys (`archived_at`, `id`, `title`, `trust_version`) and no other top-level additions; it never carries `comments`. `e2e/completed-board-access.spec.ts` and `get-guided-fields.test.ts` pin it.
- Everything in this plan exists only on guided boards, behind the existing `guided_mode` flag. No new flag.
- Messages, limits, labels shared between files, event names and action names are declared once in `lib/constants/` (or `types/`) and imported. Before adding a vocabulary, grep for its values. Components and routes do not spell out phase names, limits, event names or the 1000-character comment length.
- Store write actions reject on failure through `failWrite` (the message reaches `lastWriteError` and the connection banner); UI handlers catch the rejection. A failure for a board the user has left applies nothing to the store (no `failWrite`, no refetch) and only rejects. A response applied after an awaited request checks it still applies: same board id, and (for the topic) the same phase it was sent in.
- A form, editor or confirmation opened in one phase closes and cannot act once the phase changes (use `editorStillOpen` from `lib/groups.ts`). An editor remembers the text it opened with and does not save unchanged text. In this plan blur never saves anything (comments and topic actions save on Enter or their button only), so Enter cannot cause a second save through blur. A component clears the shared error banner only when the banner shows that component's own message.
- Every refetch guided mode triggers goes through `refetchBoardCoalesced`, never a direct `fetchBoard`.
- No hook mounted in `BoardPage` updates React state on a timer; this plan adds no timers.
- Nothing new is mounted inside `RetroCard` in this plan. Any component that reads the stores from inside a per-card component selects primitives and returns its not-guided value before reading cards, votes, comments or participants on an open board (Step 2 ruling R4).
- Any dialog or overlay opened from the sticky board header renders through a portal on `document.body` and uses `useFocusTrap` (the header's `backdrop-blur-sm` confines `position: fixed` descendants; Step 2 ruling R11). This plan opens nothing from the header; the phone agenda uses the existing `MobileSheet` (focus trap built in) from inside the Discuss area, and comment deletion confirms inline.
- Unit tests run in Vitest's node environment; hooks and components cannot be rendered, so decisions live in tested pure functions and components stay thin. No new dependencies, no DOM test environment.
- `npm run lint` is broken on Next 16: run `npx eslint <the files you changed>`.
- Run one e2e spec with `npx playwright test e2e/<file>`; `npm run test:e2e -- <pattern>` runs everything.
- A dev server started for observation: check port 3001 first (`lsof -ti tcp:3001` must print nothing), start it with `npm run dev -- -p 3001 &`, note the PID, stop it with `kill <PID>`. Never kill by name. Never run `npm run build` while it runs.
- A UI task is done only after it was seen in a real browser at 1280px, 390px and 360px, in light and dark themes, with an open board read before and after the change (the same readings, listed in the report) and screenshots saved under `.superpowers/sdd/2026-11-20-guided-discuss/observe-<task number>/` for the controller to open. If the dev server cannot run, say so; do not claim success.
- Tests: logic is pure functions with unit tests written first. Every new SQL statement is executed for real by Task 12 (Step 2 shipped a statement that had only been mocked; never again). After a task adds a statement, the controller EXPLAINs it on the dev database. Every e2e assertion that something is ABSENT from a browser's HTTP bodies and websocket frames is paired with a control proving the capture holds that kind of traffic and the matcher fires on real data. A guard test (layout, absence) is shown able to fail once by a temporary mutation that is then reverted. Dialog and sheet on-screen checks measure bounding boxes.
- UI copy is plain words with no em dashes. Every user-facing string in this plan is exact.
- Parabol is AGPL: copy behaviour only, no code or copy text.
- Baselines at the start (controller-run on 36cedde): `npx tsc --noEmit` clean; `npm test` 927 passing in 61 files; `npm run test:e2e` 94 passed, 0 failed, 1 skipped.

## Review Focus

1. A person put 2 votes on card X in Vote, the facilitator went back to Group and X was grouped under Y, then Vote again with 3 per card. Expected: the stepper on Y reads 2; one Add on Y succeeds (3) and the next is 422 `You can put at most 3 votes on one card`; Remove on Y takes Y's own row first, then X's row, and answers 409 `You have no vote on this card` only when the person has nothing left anywhere in the group; lowering per card to 2 is refused. (Tasks 1, 12.)
2. Two facilitators press Next from Vote at the same instant. Expected: one move wins (Step 1 behaviour) and the topic stored with it is the first agenda item, computed inside that locked statement; every browser's agenda shows the same order, including a tie between two cards with equal scores, and the same current topic. (Tasks 2, 5, 12.)
3. A participant posts an anonymous comment. Expected: no HTTP body or websocket frame sent to anyone, the facilitator included, carries that comment's author id or name; the author sees `You (anonymous)`. (Tasks 4, 7, 12.)
4. The facilitator moves on (or completes the retro) while someone is typing a comment or their POST is in flight. Expected: a request that reaches the server after the move gets 409 `The phase already changed` (never a comment saved into a phase that cannot show it), the composer closes on the phase change, and the store converges after one coalesced refetch. (Tasks 7, 8, 10.)
5. A top-level comment with replies is deleted. Expected: a tombstone reading `This comment was deleted.` keeps the replies in place, its body is `''` in the database, and when the last reply goes the tombstone goes too. (Tasks 7, 10, 12.)
6. A participant looks at topic 4 while the group is on topic 2, and the facilitator moves to topic 3. Expected: the participant stays on topic 4 with `You are looking at another topic.` and `Back to current topic`, which takes them to topic 3. (Tasks 2, 8, 9, 12.)
7. A topic's card is deleted (its column is removed) or an assigned person is removed. Expected: the action item survives with `card_id` null or `assignee_participant_id` null and its owner's name kept in `assignee`. (Tasks 3, 6, 12.)
8. An open board after this ships. Expected: every action items, board GET and complete statement is byte-identical (pins), the board GET has no `comments` key and the same `phase_config`, action item requests carrying `cardId` or `assigneeParticipantId` behave as today (the fields are ignored), the comments route and `set-topic` answer 409 `This board is not in guided mode`, and no Discuss view, agenda or comment control appears. (Tasks 5, 6, 7, 9, 12.)

---

## File structure

| File | Responsibility |
|---|---|
| `lib/votes.ts`, `lib/groups.ts` (modify) | Group-aware vote counts and remove target; `isRootCard`, `compareByCreated` |
| `app/api/boards/[boardId]/votes/route.ts` (modify) | Group-aware guided add and remove statements |
| `app/api/boards/[boardId]/route.ts` (modify) | Group-aware limit guard; topic cleared on complete; `comments` on the guided GET |
| `stores/groupVoteStore.ts`, `components/Board/GuidedVoteControl.tsx` (modify) | Group-aware stepper count and remove |
| `lib/constants/comments.ts`, `lib/constants/agenda.ts` (new) | Comment limits, events and messages; topic and topic-action messages |
| `lib/constants/phases.ts` (modify) | `PhaseConfig.topic?`, `AGENDA_PHASE`, `PHASE_ROUTE_ACTIONS` |
| `lib/agenda.ts`, `lib/comments.ts` (new) | Pure agenda, topic, comment thread and outcome logic |
| `lib/board-validation.ts`, `types/index.ts` (modify) | `isUuid`, `INVALID_ASSIGNEE`; `Comment`, `ActionItem.card_id`, `ActionItem.assignee_participant_id` |
| `scripts/migrations/017_discuss.sql` (new) | `comments` table; `action_items.card_id`, `action_items.assignee_participant_id` |
| `lib/constants/board-actions.ts`, `lib/phases.ts`, `lib/board-guards.ts` (modify) | `topic.set`, `comment.*`, `action-item.link` actions; `phaseConfigAfterClose` clears the topic |
| `lib/board-view.ts`, `lib/board-publish.ts` (modify) | `shapeComment`, comment event payloads and publish |
| `app/api/boards/[boardId]/phase/route.ts` (modify) | Topic on entering Discuss; `set-topic` |
| `app/api/boards/[boardId]/action-items/route.ts` (modify) | Guided create with topic and owner; guided owner change |
| `app/api/boards/[boardId]/comments/route.ts` (new) | Create, edit, delete comments |
| `lib/commentJournal.ts`, `stores/failAction.ts`, `stores/discussStore.ts` (new); `stores/boardStore.ts`, `hooks/useBoardChannel.ts` (modify) | Comments state, topic and comment actions, comment events |
| `components/Discuss/*` (new); `components/pages/BoardPage.tsx`, `components/Board/MobileBoardShell.tsx` (modify) | Discuss view, agenda, topic panel, comment thread, topic actions |
| `components/ActionItems/ActionItemRow.tsx`, `ActionItemsPanel.tsx` (modify) | Owner picked by participant and topic label on guided boards |
| `e2e/guided-discuss.spec.ts` (new), `e2e/helpers.ts` (modify) | Two-browser run of everything above |

---

### Task 1: Group-aware votes (D3)

Votes stranded on a child card (Step 2 ruling R16) are fixed first, because the agenda ranks by group score. No vote is ever re-homed.

**Files:**
- Modify: `lib/votes.ts`, `lib/groups.ts`, `app/api/boards/[boardId]/votes/route.ts`, `app/api/boards/[boardId]/route.ts` (the guarded limit statement only), `stores/groupVoteStore.ts`, `components/Board/GuidedVoteControl.tsx`
- Test: `lib/__tests__/votes.test.ts`, `lib/__tests__/groups.test.ts`, `lib/__tests__/vote-settle.test.ts`, `app/api/boards/[boardId]/votes/__tests__/guided-votes.test.ts`, `app/api/boards/[boardId]/__tests__/vote-limits.test.ts`, `lib/__tests__/group-vote-store.test.ts`

**Interfaces:**
- Produces (`lib/groups.ts`):
  - `isRootCard(cardId: string, cards: readonly Pick<Card, 'id' | 'merged_with'>[]): boolean`: the card exists and its `merged_with` is null or names a card not in `cards` (the database sets `merged_with` to null when a lead is deleted, so a client still holding a deleted lead's children treats them as roots, as the server does).
  - `compareByCreated(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number`: `Date.parse(a.created_at) - Date.parse(b.created_at)` (millisecond precision), then `a.id < b.id ? -1 : a.id > b.id ? 1 : 0` (UTF-16 code units, which for the URL-safe id alphabet equals the byte order of `COLLATE "C"`). Task 2's agenda uses it.
- Produces (`lib/votes.ts`):
  - `myGroupVotesOn(votes: readonly Vote[], cards: readonly Pick<Card, 'id' | 'merged_with'>[], cardId: string, participantId: string | null): number`: for a root card, the sum of my `count` over the card and every card whose `merged_with` is `cardId`; for a child card, my count on that card only. A solo card gives exactly `myVotesOn`.
  - `groupRemoveTarget(votes: readonly Vote[], cards: readonly Pick<Card, 'id' | 'merged_with' | 'created_at'>[], cardId: string, participantId: string | null): string | null`: the card whose row a remove takes from. My row on `cardId` when I have one; otherwise, when `cardId` is a root, the child (`merged_with === cardId`) holding a row of mine that sorts first by `compareByCreated`; otherwise null.
  - `VoteResult` gains `cardId: string` (the card of the row the answer describes). `voteResult` reads it from an `added` answer's `vote.card_id`, and from a `removed` answer's new `cardId` field when it is a string (else `ctx.cardId`); the local row it builds for a removal is the row on that card.
  - `VoteSlot` gains `otherRow: boolean`; `EMPTY_VOTE_SLOT.otherRow` is false. `VoteClickOutcome`'s `ok` variant gains `otherRow: boolean` (the answer changed a row on a card other than the clicked one). `finishVoteClick`: an `ok` outcome with `otherRow` sets the slot's `otherRow`; when the burst ends with `otherRow` set it returns `settle: null` and `refetch: true` (the server's truth replaces the optimistic rows through one coalesced GET).
- Produces (`POST /api/boards/[boardId]/votes`, guided only): the add statement's per-card check uses the group sum; the remove statement takes the row `groupRemoveTarget` describes; the remove answer gains `cardId: string` (the card whose row changed): `{ action: 'removed', voteId, cardId, count, tally }`. Every other status, message and the open toggle path are unchanged.
- Produces (board PATCH, guided limit guard only): `max_on_card` becomes the largest sum of one person's counts over one group.
- Produces (`GuidedVoteControl`): the number shown on a root card is `myGroupVotesOn(...)`; on a child card it stays `myVotesOn(...)`. `canRemove` follows that number.
- Produces (`useGroupVoteStore`): `addVote` checks `voteControlState` with `onCard: myGroupVotesOn(...)`; `removeVote` returns without a request when `groupRemoveTarget(...)` is null; `toggleGuidedVote` removes when `myGroupVotesOn(...) > 0`; a remove click applies its optimistic delta to the row on `groupRemoveTarget(...)`, reverses a failed click on that same row, sends `{ cardId, action: 'remove' }` with the CLICKED card id (the server decides the row), and passes `otherRow: result.cardId !== cardId`; the slot stays keyed by the clicked card and its expected count is `myGroupVotesOn` on the clicked card. When `finish` for an `ok` answer returns `true`, `castVote` awaits `refetchBoardCoalesced(boardId)` if the board is still current (today the `ok` path ignores that return value).

What must NOT change: the open toggle statements and their inline snapshot in `vote-round-trips.test.ts`; the open settings PATCH snapshot in `patch-round-trips.test.ts`; the open GET snapshot; the guided add's 404, 409 and 422 messages; `VotePill` and every open-board view. The group-aware rule applies only where a root card has children; a solo card behaves exactly as now.

- [ ] **Step 1: Write the failing pure tests.** Add to `lib/__tests__/groups.test.ts`:

```ts
import { isRootCard, compareByCreated } from '@/lib/groups';

describe('roots and creation order', () => {
  const cards = [{ id: 'L', merged_with: null }, { id: 'c', merged_with: 'L' }, { id: 'o', merged_with: 'gone' }];
  it('a root has no parent or a parent that is not on the board', () => {
    expect(isRootCard('L', cards)).toBe(true);
    expect(isRootCard('c', cards)).toBe(false);
    expect(isRootCard('o', cards)).toBe(true);
    expect(isRootCard('zz', cards)).toBe(false);
  });
  it('orders by creation to the millisecond, then by id in code-unit order', () => {
    const at = (ms: number) => new Date(Date.UTC(2026, 10, 20, 10, 0, 0, ms)).toISOString();
    expect(compareByCreated({ created_at: at(1), id: 'z' }, { created_at: at(2), id: 'a' })).toBeLessThan(0);
    expect(compareByCreated({ created_at: at(5), id: 'B' }, { created_at: at(5), id: 'a' })).toBeLessThan(0);
    expect(compareByCreated({ created_at: at(5), id: 'a' }, { created_at: at(5), id: 'a' })).toBe(0);
  });
});
```

Add to `lib/__tests__/votes.test.ts`:

```ts
import { myGroupVotesOn, groupRemoveTarget, finishVoteClick, EMPTY_VOTE_SLOT, startVoteClick, voteResult } from '@/lib/votes';

describe('group-aware votes', () => {
  const at = (ms: number) => new Date(Date.UTC(2026, 10, 20, 10, 0, 0, ms)).toISOString();
  const cards = [
    { id: 'L', merged_with: null, created_at: at(0) },
    { id: 'c2', merged_with: 'L', created_at: at(2) },
    { id: 'c1', merged_with: 'L', created_at: at(1) },
    { id: 'S', merged_with: null, created_at: at(3) },
  ];
  it('a lead counts my votes on it and its children; a child or solo card counts its own row', () => {
    const vs = [
      v({ card_id: 'L', voter_id: 'p1', count: 1 }), v({ card_id: 'c2', voter_id: 'p1', count: 2 }),
      v({ card_id: 'c1', voter_id: 'p2', count: 1 }), v({ card_id: 'S', voter_id: 'p1', count: 1 }),
    ];
    expect(myGroupVotesOn(vs, cards, 'L', 'p1')).toBe(3);
    expect(myGroupVotesOn(vs, cards, 'L', 'p2')).toBe(1);
    expect(myGroupVotesOn(vs, cards, 'c2', 'p1')).toBe(2);
    expect(myGroupVotesOn(vs, cards, 'S', 'p1')).toBe(1);
    expect(myGroupVotesOn(vs, cards, 'L', null)).toBe(0);
  });
  it('a remove on a lead takes the lead row first, then my earliest child row', () => {
    const both = [v({ card_id: 'L', voter_id: 'p1' }), v({ card_id: 'c2', voter_id: 'p1' }), v({ card_id: 'c1', voter_id: 'p1' })];
    expect(groupRemoveTarget(both, cards, 'L', 'p1')).toBe('L');
    expect(groupRemoveTarget(both.slice(1), cards, 'L', 'p1')).toBe('c1');
    expect(groupRemoveTarget([v({ card_id: 'c2', voter_id: 'p1' })], cards, 'L', 'p1')).toBe('c2');
  });
  it('a child target uses its own row only; no vote in the group is null', () => {
    expect(groupRemoveTarget([v({ card_id: 'L', voter_id: 'p1' })], cards, 'c1', 'p1')).toBeNull();
    expect(groupRemoveTarget([v({ card_id: 'c1', voter_id: 'p2' })], cards, 'L', 'p1')).toBeNull();
  });
  it('a removed answer names the row it changed', () => {
    const r = voteResult({ action: 'removed', voteId: 'v9', cardId: 'c2', count: 1, tally: { used: 3, at: 7 } }, undefined,
      { boardId: 'b1', cardId: 'L', voterId: 'p1', nowIso: 'x' });
    expect(r).toEqual({ tally: { used: 3, at: 7 }, cardId: 'c2', vote: expect.objectContaining({ id: 'v9', card_id: 'c2', count: 1 }) });
  });
});

describe('a click that changes another row', () => {
  it('ends its burst with no settle and one refetch', () => {
    const slot = startVoteClick(EMPTY_VOTE_SLOT, 1);
    const done = finishVoteClick(slot, { kind: 'ok', at: 5, vote: null, otherRow: true });
    expect(done.settle).toBeNull();
    expect(done.refetch).toBe(true);
  });
  it('an ordinary burst still settles on the newest answer and does not refetch', () => {
    const done = finishVoteClick(startVoteClick(EMPTY_VOTE_SLOT, 1), { kind: 'ok', at: 5, vote: null, otherRow: false });
    expect(done.settle).toEqual({ vote: null });
    expect(done.refetch).toBe(false);
  });
});
```

Update every existing `finishVoteClick` call in `lib/__tests__/vote-settle.test.ts` and `votes.test.ts` to pass `otherRow: false` on `ok` outcomes.

- [ ] **Step 2: Write the failing route tests.** In `guided-votes.test.ts` rename the fixture key `on_card` to `on_group` in `addRow` and every override, and add:

```ts
it('the add counts my votes on the whole group against the per-card limit', async () => {
  mocks.sql.mockResolvedValueOnce([guidedRow()]);
  mocks.tx.mockResolvedValueOnce([[], [addRow()]]);
  await call({ cardId: 'c1', action: 'add' });
  const [, stmt] = txTexts();
  expect(stmt.text).toContain('grp AS (');
  expect(stmt.text).toContain('(id = ? OR merged_with = ?)');
  expect(stmt.text).toContain('FILTER (WHERE card_id IN (SELECT id FROM grp))');
  expect(stmt.text).toContain('mine.on_group < lim.per_card');
  expect(stmt.text).toMatch(/deleted_at IS NULL\s+FOR SHARE\s+\), upserted AS/);
});
it('422 per card when the group already holds my limit, even with nothing on the lead itself', async () => {
  mocks.sql.mockResolvedValueOnce([guidedRow()]);
  mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, spent: 3, on_group: 3 })]]);
  const res = await call({ cardId: 'c1', action: 'add' });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ error: 'You can put at most 3 votes on one card', maxVotesPerCard: 3 });
});
it('a remove on a lead with no row of its own answers with the child row it took from', async () => {
  mocks.sql.mockResolvedValueOnce([guidedRow()]);
  mocks.tx.mockResolvedValueOnce([[], [{ board_ok: true, vote_id: 'v2', vote_card_id: 'c2', count_before: 2, team_used_before: 4, tally_at: 9 }]]);
  expect(await (await call({ cardId: 'c1', action: 'remove' })).json())
    .toEqual({ action: 'removed', voteId: 'v2', cardId: 'c2', count: 1, tally: { used: 3, at: 9 } });
  const [, stmt] = txTexts();
  expect(stmt.text).toContain('ORDER BY (v.card_id = ?::text) DESC');
  expect(stmt.text).toContain(`date_trunc('milliseconds', c.created_at) ASC, c.id COLLATE "C" ASC`);
  expect(stmt.text).toContain('LIMIT 1');
  expect(stmt.text).toMatch(/deleted_at IS NULL\s+FOR SHARE\s+\), target AS/);
});
```

The existing remove tests gain `vote_card_id: 'c1'` in their rows and `cardId: 'c1'` in their expected bodies. In `vote-limits.test.ts` add to the first refusal test: `expect(text).toContain('GROUP BY v.voter_id, COALESCE(c.merged_with, c.id)')` (read from the transaction mock as the file already does).

- [ ] **Step 3: Write the failing store tests** in `group-vote-store.test.ts`, with `cardFixture` cards `c1` (root) and `c2` (`merged_with: 'c1'`) and `vote(count, id)` rows given an explicit `card_id`:

```ts
it('a lead counts my child votes: add is refused locally at the per-card limit', async () => {
  useBoardStore.setState({ cards: [cardFixture('c1'), { ...cardFixture('c2'), merged_with: 'c1' }],
    votes: [vote(1), { ...vote(2, 'v2'), card_id: 'c2' }] });
  routes({});
  await useGroupVoteStore.getState().addVote('c1');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('remove on a lead with no row of its own takes the child row at once and ends with one coalesced GET', async () => {
  useBoardStore.setState({ cards: [cardFixture('c1'), { ...cardFixture('c2'), merged_with: 'c1' }],
    votes: [{ ...vote(2, 'v2'), card_id: 'c2' }] });
  routes({
    'POST /api/boards/b1/votes': () => json(200, { action: 'removed', voteId: 'v2', cardId: 'c2', count: 1, tally: { used: 1, at: 40 } }),
    'GET /api/boards/b1': getBoardResponse(board(), { votes: [{ ...vote(1, 'v2'), card_id: 'c2' }] }),
  });
  const p = useGroupVoteStore.getState().removeVote('c1');
  expect(useBoardStore.getState().votes).toEqual([expect.objectContaining({ card_id: 'c2', count: 1 })]);
  await p;
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ cardId: 'c1', action: 'remove' });
  expect(fetchMock.mock.calls.map((c) => `${c[1]?.method ?? 'GET'} ${String(c[0]).split('?')[0]}`)).toContain('GET /api/boards/b1');
});
it('toggleGuidedVote on a lead whose only vote is on a child sends remove', async () => {
  useBoardStore.setState({ cards: [cardFixture('c1'), { ...cardFixture('c2'), merged_with: 'c1' }],
    votes: [{ ...vote(1, 'v2'), card_id: 'c2' }] });
  routes({ 'POST /api/boards/b1/votes': () => json(200, { action: 'removed', voteId: 'v2', cardId: 'c2', count: 0, tally: { used: 0, at: 41 } }),
    'GET /api/boards/b1': getBoardResponse(board(), { votes: [] }) });
  await useGroupVoteStore.getState().toggleGuidedVote('c1');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: 'remove' });
});
```

- [ ] **Step 4: Run** `npx vitest run lib/__tests__/votes.test.ts lib/__tests__/groups.test.ts lib/__tests__/vote-settle.test.ts lib/__tests__/group-vote-store.test.ts app/api/boards/\[boardId\]/votes app/api/boards/\[boardId\]/__tests__/vote-limits.test.ts`. Expected: the new tests FAIL; `vote-round-trips.test.ts` (open pin) PASSES.
- [ ] **Step 5: Implement.** The guided add statement becomes (only `grp`, `on_group`, the insert condition and the `FOR SHARE` on the board read change; `team`, the conflict clause and the output columns other than `on_group` stay as they are). Controller ruling: both vote statements read the board row `FOR SHARE` (in `lim` for add, in `ok` for remove), so a completion or any other `UPDATE boards` cannot commit between the statement's check and its write. This closes the completion race Step 2 left open (Step 2 ruling R19) without touching the shared complete path. The advisory lock stays: it still serializes votes against each other, the limit guard and the phase move.

```sql
WITH card AS (
  SELECT id, merged_with FROM cards WHERE id = ${cardId} AND board_id = ${boardId}
), grp AS (
  SELECT id FROM cards WHERE board_id = ${boardId} AND (id = ${cardId} OR merged_with = ${cardId})
), mine AS (
  SELECT COALESCE(SUM(count), 0)::int AS spent,
         COALESCE(SUM(count) FILTER (WHERE card_id IN (SELECT id FROM grp)), 0)::int AS on_group
  FROM votes WHERE board_id = ${boardId} AND voter_id = ${voterId}
), team AS (
  SELECT COALESCE(SUM(count), 0)::int AS used FROM votes WHERE board_id = ${boardId}
), lim AS (
  SELECT COALESCE((settings ->> 'max_votes_per_participant')::int, ${DEFAULT_BOARD_SETTINGS.max_votes_per_participant}::int) AS per_person,
         COALESCE((settings ->> 'max_votes_per_card')::int, ${OPEN_MAX_VOTES_PER_CARD}::int) AS per_card
  FROM boards
  WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
  FOR SHARE
), upserted AS (
  INSERT INTO votes (id, card_id, board_id, voter_id, count)
  SELECT ${newVoteId}, ${cardId}, ${boardId}, ${voterId}, 1 FROM card, mine, lim
  WHERE card.merged_with IS NULL AND mine.spent < lim.per_person AND mine.on_group < lim.per_card
  ON CONFLICT (card_id, voter_id) DO UPDATE SET count = votes.count + 1
  RETURNING *
)
SELECT EXISTS (SELECT 1 FROM lim) AS board_ok,
       (SELECT COUNT(*) FROM card)::int AS card_found, (SELECT merged_with FROM card) AS card_parent,
       mine.spent, mine.on_group, lim.per_person, lim.per_card, team.used AS team_used_before,
       floor(extract(epoch from clock_timestamp()) * 1000)::float8 AS tally_at,
       u.id, u.card_id, u.board_id, u.voter_id, u.count, u.created_at
FROM mine CROSS JOIN team LEFT JOIN lim ON true LEFT JOIN upserted u ON true
```

The guided remove statement becomes:

```sql
WITH ok AS (
  SELECT 1 FROM boards
  WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
  FOR SHARE
), target AS (
  SELECT id, merged_with FROM cards WHERE id = ${cardId} AND board_id = ${boardId}
), cur AS (
  SELECT v.id, v.count, v.card_id
  FROM votes v JOIN cards c ON c.id = v.card_id AND c.board_id = v.board_id
  WHERE v.board_id = ${boardId} AND v.voter_id = ${voterId}
    AND (v.card_id = ${cardId}
         OR (c.merged_with = ${cardId} AND EXISTS (SELECT 1 FROM target WHERE merged_with IS NULL)))
  ORDER BY (v.card_id = ${cardId}::text) DESC,
           date_trunc('milliseconds', c.created_at) ASC, c.id COLLATE "C" ASC
  LIMIT 1
), decremented AS (
  UPDATE votes SET count = votes.count - 1 FROM cur
  WHERE votes.id = cur.id AND cur.count > 1 AND EXISTS (SELECT 1 FROM ok)
  RETURNING votes.id
), deleted AS (
  DELETE FROM votes USING cur
  WHERE votes.id = cur.id AND cur.count = 1 AND EXISTS (SELECT 1 FROM ok)
  RETURNING votes.id
), team AS (
  SELECT COALESCE(SUM(count), 0)::int AS used FROM votes WHERE board_id = ${boardId}
)
SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
       cur.id AS vote_id, cur.card_id AS vote_card_id, cur.count AS count_before,
       team.used AS team_used_before,
       floor(extract(epoch from clock_timestamp()) * 1000)::float8 AS tally_at
FROM team LEFT JOIN cur ON true
```

Outcome order is unchanged; the 200 body adds `cardId: row.vote_card_id`. In the board PATCH guarded statement replace only the `top` CTE:

```sql
top AS (
  SELECT COALESCE(MAX(per_group), 0)::int AS max_on_card FROM (
    SELECT SUM(v.count) AS per_group
    FROM votes v JOIN cards c ON c.id = v.card_id AND c.board_id = v.board_id
    WHERE v.board_id = ${boardId}
    GROUP BY v.voter_id, COALESCE(c.merged_with, c.id)
  ) g
)
```

Then the pure helpers, the store and the control selector:

```ts
const onCard = useBoardStore((s) =>
  s.board?.mode !== GUIDED_MODE ? 0
  : childCard ? myVotesOn(s.votes, cardId, s.currentParticipantId)
  : myGroupVotesOn(s.votes, s.cards, cardId, s.currentParticipantId),
);
```

- [ ] **Step 6: Run** the Step 4 command without `-u`, then `npm test && npx tsc --noEmit && npx eslint <the changed files>`. Expected: PASS, clean; the open toggle, open PATCH and open GET inline snapshots unchanged.
- [ ] **Step 7: Observe in a browser** (dev server per the Global Constraints). Build the stranded case through the API on a guided dev board with two cards X and Y and per card 3: in Vote add 2 on X as participant B, move back to Group, group X under Y, move to Vote. At 1280px, 390px and 360px, light and dark: B's stepper on Y reads `2`; one Add makes it `3` and the plus turns disabled with the title `You can put at most 3 votes on one card`; the expanded child X shows B's own `2` with only a minus; Remove on Y twice reads `2` then `1`. An open board's vote button, header count and phone tracker read the same before and after the change. Save screenshots to `observe-1/`.
- [ ] **Step 8: Commit** `fix(votes): a group's votes count toward its per-card limit and a remove on the lead reaches its children`

---

### Task 2: Discuss vocabulary, types and pure agenda and comment logic

**Files:**
- Create: `lib/constants/comments.ts`, `lib/constants/agenda.ts`, `lib/agenda.ts`, `lib/comments.ts`
- Modify: `lib/constants/phases.ts`, `types/index.ts`, `lib/board-validation.ts`
- Test: `lib/__tests__/agenda.test.ts`, `lib/__tests__/comments.test.ts`, `lib/board-validation-ids.test.ts`

- [ ] **Step 0: Grep before declaring.** Run `grep -rn "comment-created\|set-topic\|'topic'\|Agenda\|isUuid\|Invalid assignee" app lib stores hooks components types utils e2e`. Expected: only `Invalid assignee` inside `lib/board-validation.ts`; nothing else. If anything else appears, reuse it and report.

**Interfaces:**
- Produces (`lib/constants/phases.ts`):
  - `PhaseConfig` becomes `{ deadline: string | null; topic?: string | null }` with the comment `topic: the current Discuss topic's root card id. Optional, never in DEFAULT_PHASE_CONFIG, so an open board's phase_config stays { deadline: null }.` `DEFAULT_PHASE_CONFIG` is unchanged.
  - `AGENDA_PHASE: PhaseId = 'discuss'` (the phase whose entry sets a topic).
  - `PHASE_ROUTE_ACTIONS = ['move', 'set-deadline', 'set-topic'] as const`, `type PhaseRouteAction`, `isPhaseRouteAction(v: unknown): v is PhaseRouteAction`.
- Produces (`lib/constants/comments.ts`):
  - `COMMENT_BODY_MAX = 1000`, `COMMENT_COUNTER_FROM = 900`, `COMMENTS_PER_BOARD_MAX = 500`.
  - `COMMENT_EVENTS = ['comment-created', 'comment-updated', 'comment-deleted'] as const`, `type CommentEvent`, `COMMENT_CREATED: CommentEvent = COMMENT_EVENTS[0]`, `COMMENT_UPDATED = COMMENT_EVENTS[1]`, `COMMENT_DELETED = COMMENT_EVENTS[2]`.
  - Messages: `COMMENT_EMPTY_ERROR = 'Write a comment first'`, ``COMMENT_TOO_LONG_ERROR = `Comments can be at most ${COMMENT_BODY_MAX} characters` ``, `COMMENT_NOT_FOUND_ERROR = 'Comment not found'`, `COMMENT_TARGET_ERROR = 'Comments go on a topic, not on a card inside it'`, `REPLY_PARENT_ERROR = 'You can only reply to a comment that starts a thread'`, `COMMENT_NOT_YOURS_ERROR = 'Only the author can edit this comment'`, `COMMENT_DELETE_DENIED_ERROR = 'Only the author or a facilitator can delete this comment'`, `COMMENT_GONE_ERROR = 'This comment was deleted'`, ``COMMENT_LIMIT_ERROR = `This board has reached its limit of ${COMMENTS_PER_BOARD_MAX} comments` ``, `DELETED_COMMENT_TEXT = 'This comment was deleted.'`.
  - Fallbacks: `POST_COMMENT_FALLBACK = 'Failed to post the comment'`, `SAVE_COMMENT_FALLBACK = 'Failed to save the comment'`, `DELETE_COMMENT_FALLBACK = 'Failed to delete the comment'`.
- Produces (`lib/constants/agenda.ts`): `TOPIC_NOT_FOUND_ERROR = 'That topic is not on the agenda'`, `ASSIGNEE_NOT_FOUND_ERROR = 'That person is not on this board'`, `SET_TOPIC_FALLBACK = 'Failed to change the topic'`, `ADD_TOPIC_ACTION_FALLBACK = 'Failed to add the action item'`, `ASSIGN_FALLBACK = 'Failed to change the owner'`.
- Produces (`lib/board-validation.ts`): `isUuid(v: unknown): v is string` (the `UUID_RE` pattern now local to the action-items route, `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) and `INVALID_ASSIGNEE = 'Invalid assignee'`, which `validateActionItemUpdates` now uses in place of its literal (message unchanged). The action-items route keeps its own `UUID_RE` until Task 6.
- Produces (`types/index.ts`):

```ts
export interface Comment {
  id: string;
  board_id: string;
  card_id: string;
  parent_id: string | null;
  author_participant_id: string | null; // null when anonymous, deleted, or the author left the board
  author_name: string | null;           // null when anonymous or deleted
  is_anonymous: boolean;
  body: string;                         // '' on a deleted comment kept for its replies
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  is_mine?: boolean;                    // set by the shaper (lib/board-view.ts)
}
```
  and `ActionItem` gains `card_id?: string | null` and `assignee_participant_id?: string | null` (absent before migration 017).
- Produces (`lib/agenda.ts`):
  - `interface AgendaItem { cardId: string; rank: number; score: number; cardIds: string[]; title: string | null }` (`cardIds`: the root, then its children in `compareByCreated` order; `title`: `visibleGroupTitle(root)`).
  - `buildAgenda(cards: readonly Pick<Card, 'id' | 'merged_with' | 'created_at' | 'group_title'>[], votes: readonly Vote[]): AgendaItem[]`: every `isRootCard`, ordered by `groupScore` descending, then `compareByCreated`; ranks from 1. Zero-score cards therefore follow every voted card in the same stable order.
  - `phaseTopic(config: { topic?: string | null } | null | undefined): string | null` (a string, else null).
  - `currentTopicId(agenda: readonly AgendaItem[], stored: string | null): string | null`: `stored` when an agenda item has that `cardId`, else `agenda[0]?.cardId ?? null` (a topic whose card was deleted falls back to the first item, the same on every client).
  - `interface ViewedTopic { boardId: string; phase: PhaseId; cardId: string }`.
  - `shownTopicId(agenda, current: string | null, viewed: ViewedTopic | null, at: { boardId: string | null; phase: PhaseId | null }): string | null`: `viewed.cardId` when `viewed` matches `at.boardId` and `at.phase` and is on the agenda, else `current`.
  - `neighbourTopicId(agenda, cardId: string | null, step: 1 | -1): string | null`.
  - `topicPositionLabel(agenda, cardId: string | null): string | null` (`Topic 2 of 6`).
  - `agendaCountLabel(n: number): string` (`1 topic`, `${n} topics`).
  - `agendaVotesLabel(n: number): string` (`No votes`, `1 vote`, `${n} votes`).
  - `agendaCardsLabel(n: number): string | null` (`${n} cards` when `n > 1`, else null).
  - `topicHeading(item: AgendaItem, cards: readonly Pick<Card, 'id' | 'text'>[]): string`: the title; else `Group of ${n} cards` when `cardIds.length > 1`; else the root card's text.
  - `discussViewShown(board: Pick<Board, 'mode' | 'phase'> | null): boolean`: guided and phase `discuss` or `done`.
  - `topicFollowable(board: Pick<Board, 'mode' | 'phase' | 'archived_at'> | null): boolean`: guided, phase `AGENDA_PHASE`, not archived (a current topic exists only then; Done has none).
  - `actionItemsForTopic<A extends Pick<ActionItem, 'id' | 'created_at'> & { card_id?: string | null }>(items: readonly A[], cardIds: readonly string[]): A[]` (in `compareByCreated` order).
  - `topicActionOutcome(row: { board_ok: boolean; topic_ok: boolean; owner_ok: boolean; id: unknown }): 'ok' | 'phase-changed' | 'topic-missing' | 'owner-missing'` (checked in that order, `ok` needs a non-null `id`), and `assignOutcome(row: { board_ok: boolean; owner_ok: boolean; id: unknown }): 'ok' | 'phase-changed' | 'owner-missing' | 'item-missing'`.
  - `setTopicOutcome(row: { topic_ok: boolean; phase: unknown } | undefined): 'ok' | 'topic-missing' | 'phase-changed'` (`topic-missing` first, then a null `phase` is `phase-changed`).
- Produces (`lib/comments.ts`):
  - `commentLength(v: string): number` (code points, `[...v].length`), `clampComment(v: string): string` (first `COMMENT_BODY_MAX` code points), `showCommentCounter(v: string): boolean` (length at least `COMMENT_COUNTER_FROM`).
  - `validateCommentBody(v: unknown): { ok: true; value: string } | { ok: false; error: string }`: not a string is `INVALID_BODY`; trimmed empty is `COMMENT_EMPTY_ERROR`; over `COMMENT_BODY_MAX` code points after trimming is `COMMENT_TOO_LONG_ERROR`.
  - `commentsReadable(board: Pick<Board, 'mode' | 'phase'> | null): boolean`: guided and (`PHASES[phase].profile.canComment` or phase is `FINAL_PHASE`).
  - `commentsWritable(board: Pick<Board, 'mode' | 'phase' | 'archived_at'> | null): boolean`: guided, `canComment`, not archived.
  - `interface CommentThread { top: Comment; replies: Comment[] }`, `threadsFor(comments: readonly Comment[], cardIds: readonly string[]): CommentThread[]`: top-level comments whose `card_id` is in `cardIds`, oldest first by `compareByCreated`, each with its replies oldest first; a reply whose parent is not in the list is left out.
  - `isMyComment(c: Comment, participantId: string | null): boolean` (`c.is_mine === true` or a non-null `author_participant_id` equal to `participantId`).
  - `canEditComment(c, participantId, writable: boolean): boolean` (writable, not deleted, mine), `canDeleteComment(c, participantId, isFacilitator: boolean, writable: boolean): boolean` (writable, not deleted, mine or facilitator), `canReplyTo(c: Comment, writable: boolean): boolean` (writable, top-level, not deleted).
  - `commentAuthorLabel(c: Comment, participantId: string | null): string`: deleted is `''`; mine and anonymous is `You (anonymous)`; mine is `You`; anonymous or no name is `Anonymous`; else `author_name`.
  - `parseComment(v: unknown): Comment | null` (strings where `Comment` has strings, `is_anonymous` boolean, nullable fields null or string; anything else null).
  - `mergeIncomingComment(local: Comment | undefined, incoming: Comment): Comment`: `{ ...incoming, is_mine: (local?.is_mine ?? false) || (incoming.is_mine ?? false) }`.
  - `upsertComment(list: readonly Comment[], incoming: Comment): Comment[]`, `removeComments(list: readonly Comment[], ids: readonly string[], tombstone: Comment | null): Comment[]`.
  - `type CommentChange = { boardId: string; kind: 'upsert'; comment: Comment } | { boardId: string; kind: 'remove'; ids: string[]; tombstone: Comment | null }`, `replayComments(fromGet: readonly Comment[], changes: readonly CommentChange[], boardId: string): Comment[]` (applies, in order, the changes for `boardId` onto the GET's list).
  - `createCommentOutcome(row: { board_ok: boolean; card_found: number; card_parent: string | null; parent_ok: boolean; comment_count: number; id: unknown } | undefined, isReply: boolean, max: number): 'ok' | 'phase-changed' | 'card-missing' | 'not-a-topic' | 'bad-parent' | 'limit'` (in that order: `board_ok` false, `card_found` 0, a top-level comment on a card with a parent, a reply with `parent_ok` false, `comment_count >= max`, then `ok` needs a non-null `id`).
  - `editCommentOutcome(row: { board_ok: boolean; found: number; is_deleted: boolean | null; is_author: boolean | null; id: unknown } | undefined): 'ok' | 'phase-changed' | 'missing' | 'gone' | 'not-yours'`.
  - `deleteCommentOutcome(row: { board_ok: boolean; found: number; already_deleted: boolean | null; permitted: boolean } | undefined): 'ok' | 'phase-changed' | 'missing' | 'gone' | 'denied'`.

- [ ] **Step 1: Write the failing tests.** `lib/__tests__/agenda.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  buildAgenda, currentTopicId, shownTopicId, neighbourTopicId, topicPositionLabel, agendaCountLabel,
  agendaVotesLabel, agendaCardsLabel, topicHeading, discussViewShown, topicFollowable, actionItemsForTopic,
  phaseTopic, topicActionOutcome, assignOutcome, setTopicOutcome,
} from '@/lib/agenda';

const at = (ms: number) => new Date(Date.UTC(2026, 10, 20, 10, 0, 0, ms)).toISOString();
const card = (id: string, ms: number, merged_with: string | null = null, group_title: string | null = null, text = `text ${id}`) =>
  ({ id, merged_with, group_title, text, created_at: at(ms) });
const vote = (card_id: string, voter_id: string, count = 1) =>
  ({ id: `${card_id}-${voter_id}`, card_id, board_id: 'b1', voter_id, count, created_at: at(0) });

describe('buildAgenda', () => {
  it('ranks root cards from every column by group score, a group counting its children', () => {
    const cards = [card('a', 1), card('b', 2), card('c', 3, 'b'), card('d', 4)];
    const agenda = buildAgenda(cards, [vote('a', 'p1', 2), vote('b', 'p1'), vote('c', 'p2', 2), vote('d', 'p2')]);
    expect(agenda.map((i) => [i.cardId, i.score, i.rank])).toEqual([['b', 3, 1], ['a', 2, 2], ['d', 1, 3]]);
    expect(agenda[0].cardIds).toEqual(['b', 'c']);
  });
  it('breaks ties by earliest creation to the millisecond, then id in code-unit order', () => {
    const cards = [card('z', 5), card('y', 5), card('B', 9), card('a', 9), card('x', 1)];
    const votes = cards.map((c) => vote(c.id, 'p1'));
    expect(buildAgenda(cards, votes).map((i) => i.cardId)).toEqual(['x', 'y', 'z', 'B', 'a']);
  });
  it('cards with no votes come after every voted card, in the same stable order', () => {
    expect(buildAgenda([card('n1', 1), card('v1', 2), card('n2', 0)], [vote('v1', 'p1')]).map((i) => i.cardId))
      .toEqual(['v1', 'n2', 'n1']);
  });
  it('lists children oldest first, treats a card whose parent is gone as a root, and shows a lead title', () => {
    const agenda = buildAgenda([card('L', 0, null, 'Deploys'), card('k2', 5, 'L'), card('k1', 3, 'L'), card('o', 9, 'gone')], []);
    expect(agenda.map((i) => i.cardId)).toEqual(['L', 'o']);
    expect(agenda[0].cardIds).toEqual(['L', 'k1', 'k2']);
    expect(agenda[0].title).toBe('Deploys');
    expect(agenda[1].title).toBeNull();
    expect(buildAgenda([], [])).toEqual([]);
  });
});

describe('current and shown topic', () => {
  const agenda = buildAgenda([card('a', 1), card('b', 2), card('c', 3)], []);
  it('the stored topic when it is on the agenda, else the first item, else null', () => {
    expect(currentTopicId(agenda, 'b')).toBe('b');
    expect(currentTopicId(agenda, 'gone')).toBe('a');
    expect(currentTopicId(agenda, null)).toBe('a');
    expect(currentTopicId([], 'a')).toBeNull();
  });
  it('a viewed topic shows only on the same board, in the same phase, while it is on the agenda', () => {
    const viewed = { boardId: 'b1', phase: 'discuss' as const, cardId: 'c' };
    expect(shownTopicId(agenda, 'a', viewed, { boardId: 'b1', phase: 'discuss' })).toBe('c');
    expect(shownTopicId(agenda, 'a', viewed, { boardId: 'b1', phase: 'done' })).toBe('a');
    expect(shownTopicId(agenda, 'a', viewed, { boardId: 'b2', phase: 'discuss' })).toBe('a');
    expect(shownTopicId(agenda, 'a', { ...viewed, cardId: 'gone' }, { boardId: 'b1', phase: 'discuss' })).toBe('a');
    expect(shownTopicId(agenda, 'a', null, { boardId: 'b1', phase: 'discuss' })).toBe('a');
  });
  it('neighbours and position', () => {
    expect(neighbourTopicId(agenda, 'b', 1)).toBe('c');
    expect(neighbourTopicId(agenda, 'b', -1)).toBe('a');
    expect(neighbourTopicId(agenda, 'c', 1)).toBeNull();
    expect(neighbourTopicId(agenda, 'a', -1)).toBeNull();
    expect(neighbourTopicId(agenda, null, 1)).toBeNull();
    expect(topicPositionLabel(agenda, 'b')).toBe('Topic 2 of 3');
    expect(topicPositionLabel(agenda, 'gone')).toBeNull();
  });
});

describe('labels and gates', () => {
  it('counts', () => {
    expect(agendaCountLabel(1)).toBe('1 topic');
    expect(agendaCountLabel(4)).toBe('4 topics');
    expect(agendaVotesLabel(0)).toBe('No votes');
    expect(agendaVotesLabel(1)).toBe('1 vote');
    expect(agendaVotesLabel(7)).toBe('7 votes');
    expect(agendaCardsLabel(1)).toBeNull();
    expect(agendaCardsLabel(3)).toBe('3 cards');
  });
  it('a heading is the title, else the group size, else the card text', () => {
    const cards = [card('L', 0, null, 'Deploys'), card('k', 1, 'L'), card('M', 2), card('m', 3, 'M'), card('S', 4)];
    const agenda = buildAgenda(cards, []);
    const byId = (id: string) => agenda.find((i) => i.cardId === id)!;
    expect(topicHeading(byId('L'), cards)).toBe('Deploys');
    expect(topicHeading(byId('M'), cards)).toBe('Group of 2 cards');
    expect(topicHeading(byId('S'), cards)).toBe('text S');
  });
  it('the Discuss view shows in Discuss and Done of a guided board; a topic is followed only in Discuss before completion', () => {
    expect(discussViewShown({ mode: 'guided', phase: 'discuss' })).toBe(true);
    expect(discussViewShown({ mode: 'guided', phase: 'done' })).toBe(true);
    expect(discussViewShown({ mode: 'guided', phase: 'vote' })).toBe(false);
    expect(discussViewShown({ mode: 'open', phase: null })).toBe(false);
    expect(discussViewShown(null)).toBe(false);
    expect(topicFollowable({ mode: 'guided', phase: 'discuss', archived_at: null })).toBe(true);
    expect(topicFollowable({ mode: 'guided', phase: 'done', archived_at: '2026-11-20' })).toBe(false);
    expect(phaseTopic({ deadline: null })).toBeNull();
    expect(phaseTopic({ deadline: null, topic: 'a' })).toBe('a');
  });
  it('topic actions are the items linked to any card of the topic, oldest first', () => {
    const items = [
      { id: '2', created_at: at(2), card_id: 'L' }, { id: '1', created_at: at(1), card_id: 'k' },
      { id: '3', created_at: at(3), card_id: null }, { id: '4', created_at: at(4) },
    ];
    expect(actionItemsForTopic(items, ['L', 'k']).map((i) => i.id)).toEqual(['1', '2']);
  });
  it('route outcomes', () => {
    const okRow = { board_ok: true, topic_ok: true, owner_ok: true, id: 'i1' };
    expect(topicActionOutcome(okRow)).toBe('ok');
    expect(topicActionOutcome({ ...okRow, board_ok: false })).toBe('phase-changed');
    expect(topicActionOutcome({ ...okRow, topic_ok: false, id: null })).toBe('topic-missing');
    expect(topicActionOutcome({ ...okRow, owner_ok: false, id: null })).toBe('owner-missing');
    expect(assignOutcome({ board_ok: true, owner_ok: true, id: null })).toBe('item-missing');
    expect(setTopicOutcome({ topic_ok: false, phase: null })).toBe('topic-missing');
    expect(setTopicOutcome({ topic_ok: true, phase: null })).toBe('phase-changed');
    expect(setTopicOutcome({ topic_ok: true, phase: 'discuss' })).toBe('ok');
  });
});
```

`lib/__tests__/comments.test.ts` covers, with a `comment(over)` factory (`id: 'm1', board_id: 'b1', card_id: 'L', parent_id: null, author_participant_id: 'p1', author_name: 'Ann', is_anonymous: false, body: 'hi', created_at: at(0), edited_at: null, deleted_at: null`):
- `validateCommentBody('  hi  ')` is `{ ok: true, value: 'hi' }`; `'   '` is `{ ok: false, error: 'Write a comment first' }`; `'😀'.repeat(1000)` is ok; `' ' + 'x'.repeat(1000) + ' '` is ok (trimmed first); `'x'.repeat(1001)` is `{ ok: false, error: 'Comments can be at most 1000 characters' }`; `5` and `null` are `{ ok: false, error: 'Invalid request body' }`.
- `commentLength('😀😀')` is 2; `clampComment('😀'.repeat(1001))` has 1000 code points; `showCommentCounter('x'.repeat(899))` false, `('x'.repeat(900))` true.
- `commentsReadable`: guided discuss and guided done true; guided vote and open false; `commentsWritable`: guided discuss not archived true; guided discuss archived false; guided done false.
- `threadsFor`: two top-level comments on `L` and `k` (cardIds `['L', 'k']`) come back oldest first; one on another card is left out; replies attach under their parent oldest first; a reply whose parent is missing is left out; a deleted top-level comment with replies stays.
- `commentAuthorLabel`: `You`, `You (anonymous)` (anonymous with `is_mine: true` and null author fields), `Anonymous` (anonymous, someone else), `Ann`, `''` for a deleted one.
- `canEditComment` true for mine and writable, false for a deleted one, for someone else's, and when not writable; `canDeleteComment` true for a facilitator on someone else's; `canReplyTo` false for a reply and for a deleted comment.
- `parseComment` accepts the factory output and rejects `null`, `{}` and a comment whose `body` is a number.
- `mergeIncomingComment({ ...c, is_mine: true }, { ...c, is_mine: false, body: 'new' })` keeps `is_mine: true` and takes `body: 'new'`.
- `upsertComment` appends a new id and replaces an existing one through `mergeIncomingComment`; `removeComments(list, ['m2'], tombstone)` drops `m2` and replaces the tombstone's row.
- `replayComments`: a comment upserted after the GET started and missing from the GET is added; a comment removed after the GET started and present in the GET is removed; a change for board `b2` is ignored.
- The three outcome functions on one row per outcome, including `undefined` rows (`createCommentOutcome(undefined, false, 500)` is `phase-changed`, the edit and delete ones `missing`).

Add to `lib/board-validation-ids.test.ts`: `isUuid('00000000-0000-4000-8000-000000000001')` true; `isUuid('x')`, `isUuid(5)` false.

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/agenda.test.ts lib/__tests__/comments.test.ts lib/board-validation-ids.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the constants, types and the two modules to the signatures above. `lib/agenda.ts` imports `groupScore`, `voteTotalsByCard` from `lib/votes.ts` and `isRootCard`, `compareByCreated`, `visibleGroupTitle` from `lib/groups.ts`.
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit && npx eslint <the changed files>`. Expected: PASS (including `phase-contract.test.ts`, whose `phase_config: { deadline: null }` literals stay valid because `topic` is optional), clean.
- [ ] **Step 5: Commit** `feat(discuss): agenda, topic and comment vocabulary with pure logic`

---

### Task 3: Migration 017

**Files:**
- Create: `scripts/migrations/017_discuss.sql`
- Test: `lib/__tests__/discuss-migration-contract.test.ts`

**Interfaces:**
- Consumes: `COMMENT_BODY_MAX` (Task 2).
- Produces: table `comments`; columns `action_items.card_id TEXT NULL`, `action_items.assignee_participant_id TEXT NULL`; their constraints and indexes.

ON DELETE decisions: a comment belongs to its card and goes with it (`CASCADE`, the same as votes); a reply goes with its parent (`CASCADE`; the routes never hard-delete a parent that has replies); a comment's author leaving keeps the comment and its stored name (`SET NULL (author_participant_id)`). An action item never goes with a card or a person: `SET NULL (card_id)` and `SET NULL (assignee_participant_id)` (the owner's name stays in `assignee`). The column lists keep `board_id` intact (PG 15+ syntax, as 012 4c and 4d use).

- [ ] **Step 1: Write the failing contract test.**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { COMMENT_BODY_MAX } from '@/lib/constants/comments';

const sqlText = readFileSync('scripts/migrations/017_discuss.sql', 'utf-8');

describe('017_discuss.sql contract', () => {
  it('the body length check matches COMMENT_BODY_MAX and a deleted comment keeps an empty body', () => {
    const m = /char_length\(body\)\s+BETWEEN\s+1\s+AND\s+(\d+)/i.exec(sqlText);
    expect(Number(m?.[1])).toBe(COMMENT_BODY_MAX);
    expect(sqlText).toMatch(/deleted_at IS NOT NULL AND body = ''/);
  });
  it('a deleted card or person never deletes an action item', () => {
    expect(sqlText).toMatch(/REFERENCES cards \(id, board_id\)\s+ON DELETE SET NULL \(card_id\)/);
    expect(sqlText).toMatch(/REFERENCES participants \(id, board_id\)\s+ON DELETE SET NULL \(assignee_participant_id\)/);
  });
  it('a reply stays on its parent\'s card and an author leaving keeps the comment', () => {
    expect(sqlText).toMatch(/FOREIGN KEY \(parent_id, card_id\) REFERENCES comments \(id, card_id\)/);
    expect(sqlText).toMatch(/ON DELETE SET NULL \(author_participant_id\)/);
  });
  it('is additive and transactional: no DROP, no ALTER COLUMN, BEGIN and COMMIT, guarded table', () => {
    expect(sqlText).not.toMatch(/\bDROP\b|ALTER\s+COLUMN/i);
    expect(sqlText).toMatch(/^BEGIN;/m);
    expect(sqlText).toMatch(/^COMMIT;/m);
    expect(sqlText).toMatch(/CREATE TABLE IF NOT EXISTS comments/);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/discuss-migration-contract.test.ts`. Expected: FAIL, file not found.
- [ ] **Step 3: Write the migration** with a header comment in the style of 016 (purpose; "additive and safe under the deployed code: a new table nothing reads yet and two nullable columns; existing INSERTs name their columns, existing `SELECT *` reads gain two null keys"; "the body CHECK must equal COMMENT_BODY_MAX; lib/__tests__/discuss-migration-contract.test.ts enforces it"; requires 012 (`uq_cards_id_board_id`, `uq_participants_id_board_id`) and 013 (`schema_migrations`), not 015 or 016; idempotent; rollback: drop table `comments`, drop the two `action_items_*` constraints and the index, drop the two columns, delete `schema_migrations` row 017, only safe while no action item has a non-null `card_id` or `assignee_participant_id` that matters). Body:

```sql
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NULL THEN
    RAISE EXCEPTION '017 requires 013_participant_uniqueness_and_ledger.sql (schema_migrations) to be applied first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.cards'::regclass AND conname = 'uq_cards_id_board_id')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.participants'::regclass AND conname = 'uq_participants_id_board_id') THEN
    RAISE EXCEPTION '017 requires 012_schema_hardening.sql (uq_cards_id_board_id, uq_participants_id_board_id) to be applied first';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS comments (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id              TEXT        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
  card_id               TEXT        NOT NULL,
  parent_id             UUID,
  author_participant_id TEXT,
  author_name           TEXT        NOT NULL,
  is_anonymous          BOOLEAN     NOT NULL DEFAULT false,
  body                  TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at             TIMESTAMPTZ,
  deleted_at            TIMESTAMPTZ,
  CONSTRAINT uq_comments_id_card_id UNIQUE (id, card_id),
  CONSTRAINT comments_card_id_board_id_fkey
    FOREIGN KEY (card_id, board_id) REFERENCES cards (id, board_id) ON DELETE CASCADE,
  CONSTRAINT comments_parent_same_card_fkey
    FOREIGN KEY (parent_id, card_id) REFERENCES comments (id, card_id) ON DELETE CASCADE,
  CONSTRAINT comments_author_board_fkey
    FOREIGN KEY (author_participant_id, board_id) REFERENCES participants (id, board_id)
    ON DELETE SET NULL (author_participant_id),
  CONSTRAINT comments_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT comments_body_length CHECK (
    (deleted_at IS NULL AND char_length(body) BETWEEN 1 AND 1000)
    OR (deleted_at IS NOT NULL AND body = '')
  )
);

CREATE INDEX IF NOT EXISTS idx_comments_board_id_created_at ON comments (board_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments (parent_id) WHERE parent_id IS NOT NULL;

ALTER TABLE action_items ADD COLUMN IF NOT EXISTS card_id TEXT;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS assignee_participant_id TEXT;
```

then two guarded `DO` blocks (by `pg_constraint` on `conrelid` and `conname`, exactly as 016) adding `action_items_card_id_board_id_fkey FOREIGN KEY (card_id, board_id) REFERENCES cards (id, board_id) ON DELETE SET NULL (card_id)` and `action_items_assignee_board_id_fkey FOREIGN KEY (assignee_participant_id, board_id) REFERENCES participants (id, board_id) ON DELETE SET NULL (assignee_participant_id)`, then `CREATE INDEX IF NOT EXISTS idx_action_items_card_id ON action_items (card_id) WHERE card_id IS NOT NULL;` and `COMMIT;`.

- [ ] **Step 4: Run** the contract test. Expected: PASS.
- [ ] **Step 5: Apply to dev,** exactly as Step 2's Task 2 did.

Run: `node --env-file=.env.local scripts/run-one.mjs scripts/migrations/017_discuss.sql` (the runner refuses unless `.env.local` sets `NEON_BRANCH=dev`; never set it on the command line and never pass `--prod`).
Expected: `Target database host: ep-calm-breeze…`, `Applied scripts/migrations/017_discuss.sql`, `Recorded migration 017 in schema_migrations`. If the host is not the `ep-calm-breeze` dev host, stop and report.

Run it a second time. Expected: the same three lines and no error (re-runnable).

- [ ] **Step 6: Run** `npm test`. Expected: all PASS. Report the count. (Controller check after the task: read back the `comments` columns, the five `comments_*`/`uq_comments_*` constraints, the two `action_items_*` constraints and `schema_migrations` at 017 on the dev database.)
- [ ] **Step 7: Commit** `feat(db): 017 comments and topic-linked action items`

---

### Task 4: Topic and comment actions in the guard; comment shaper and publish helpers

**Files:**
- Modify: `lib/constants/board-actions.ts`, `lib/phases.ts` (`ACTION_PHASE_GATE`), `lib/board-guards.ts`, `lib/board-view.ts`, `lib/board-publish.ts`
- Test: `lib/__tests__/board-guards.test.ts`, `lib/__tests__/phases.test.ts`, `lib/__tests__/board-view.test.ts`, `lib/__tests__/board-publish.test.ts` (`phase-contract.test.ts` covers the new actions through `BOARD_ACTIONS`)

**Interfaces:**
- Produces:
  - `BOARD_ACTIONS` gains `'topic.set'`, `'comment.create'`, `'comment.edit'`, `'comment.delete'` (inserted after `'vote.toggle'`, in that order) and `'action-item.link'` (after `'action-item.write'`).
  - `ACTION_PHASE_GATE`: all five map to `'canComment'` (the Discuss capability; no new profile flag).
  - `checkIdentity`: `'topic.set'` joins the facilitator-only case; `'comment.create'`, `'comment.edit'`, `'comment.delete'` and `'action-item.link'` join the any-joined case (who wrote a comment is decided inside the comment statements, as card ownership is in the cards PATCH). `isLockable` includes the four comment and link actions. The v1 rule becomes `(action === 'board.settings' || action === 'group.reset' || action === 'topic.set') && !actor.isFacilitator`.
  - `shapeComment(c: Comment, viewer: Viewer): Comment`: returns a NEW object with exactly the `Comment` keys (a future column never leaks). A deleted comment: `body: ''`, `author_participant_id: null`, `author_name: null`, `is_mine: false`. An anonymous comment: author fields null; `is_mine` true only when `viewer.participantId` equals the stored author. Otherwise the author fields as stored and `is_mine` by the same comparison. A facilitator is just a viewer: nothing about their role changes the result. `shapeComments(list: readonly Comment[], viewer: Viewer): Comment[]`.
  - `commentEventPayload(c: Comment): { comment: Comment }` (shaped for `PUBLIC_VIEWER`), `commentDeletedPayload(ids: readonly string[], tombstone: Comment | null): { ids: string[]; tombstone: Comment | null }` (the tombstone shaped for `PUBLIC_VIEWER`), `publishComment(boardId: string, event: typeof COMMENT_CREATED | typeof COMMENT_UPDATED, c: Comment): Promise<void>`, `publishCommentDeleted(boardId: string, ids: readonly string[], tombstone: Comment | null): Promise<void>`.

- [ ] **Step 1: Write the failing tests.**

```ts
// board-guards.test.ts
describe('discuss actions', () => {
  const inDiscuss = state({ phase: 'discuss', settings: phaseSettings('discuss') });
  const inVote = state({ phase: 'vote', settings: phaseSettings('vote') });
  it('comment.create, comment.edit and action-item.link: any joined participant during Discuss only', () => {
    for (const a of ['comment.create', 'comment.edit', 'action-item.link'] as const) {
      expect(checkAction(a, actor(), inDiscuss)).toEqual({ ok: true });
      expect(checkAction(a, actor(), inVote)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
      expect(checkAction(a, actor({ participantId: null }), inDiscuss)).toEqual({ ok: false, status: 401, error: 'Join the board first' });
    }
  });
  it('comment.delete passes a facilitator who has no participant row', () => {
    expect(checkAction('comment.delete', actor({ participantId: null, isFacilitator: true }), inDiscuss)).toEqual({ ok: true });
  });
  it('topic.set: facilitator only, Discuss only, on any trust version', () => {
    expect(checkAction('topic.set', actor(), inDiscuss)).toEqual({ ok: false, status: 403, error: 'Facilitator access required' });
    expect(checkAction('topic.set', actor({ isFacilitator: true }), inDiscuss)).toEqual({ ok: true });
    expect(checkAction('topic.set', actor({ isFacilitator: true }), inVote)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
    expect(checkAction('topic.set', actor({ trustVersion: 1 }), state())).toEqual({ ok: false, status: 403, error: 'Facilitator access required' });
  });
  it('a completed board refuses every comment action', () => {
    const done = state({ phase: 'done', archived: true, settings: phaseSettings('done') });
    expect(checkAction('comment.create', actor(), done)).toEqual({ ok: false, status: 409, error: 'Board is completed' });
  });
});

// phases.test.ts: extend the phaseDenial tables
//   denied:  ['comment.create', 'reflect'], ['comment.edit', 'group'], ['comment.delete', 'vote'], ['topic.set', 'vote'], ['action-item.link', 'reflect']
//   allowed: ['comment.create', 'discuss'], ['topic.set', 'discuss'], ['action-item.link', 'discuss']
//   unchanged: ['action-item.write', <every phase>] stays allowed

// board-view.test.ts
const comment = (over: Partial<Comment> = {}): Comment => ({ id: 'm1', board_id: 'b1', card_id: 'L', parent_id: null,
  author_participant_id: 'p2', author_name: 'Bo', is_anonymous: false, body: 'hi', created_at: 'x', edited_at: null, deleted_at: null, ...over });
it('an anonymous comment carries no author to anyone, the facilitator included; its author sees is_mine', () => {
  const anon = comment({ is_anonymous: true });
  expect(shapeComment(anon, { participantId: 'p1' })).toMatchObject({ author_participant_id: null, author_name: null, is_mine: false });
  expect(shapeComment(anon, { participantId: 'p2' })).toMatchObject({ author_participant_id: null, author_name: null, is_mine: true });
  expect(shapeComment(anon, PUBLIC_VIEWER)).toMatchObject({ author_participant_id: null, author_name: null, is_mine: false });
});
it('a named comment keeps its author; a deleted one keeps nothing', () => {
  expect(shapeComment(comment(), { participantId: 'p1' })).toMatchObject({ author_participant_id: 'p2', author_name: 'Bo', is_mine: false });
  expect(shapeComment(comment({ deleted_at: 'y', body: '' }), { participantId: 'p2' }))
    .toMatchObject({ body: '', author_participant_id: null, author_name: null, is_mine: false });
});
it('unknown keys never pass through', () => {
  expect('secret' in shapeComment({ ...comment(), secret: 1 } as never, PUBLIC_VIEWER)).toBe(false);
});

// board-publish.test.ts
it('comment payloads are shaped for nobody', () => {
  expect(commentEventPayload(comment({ is_anonymous: true })).comment).toMatchObject({ author_participant_id: null, is_mine: false });
  expect(commentDeletedPayload(['m2'], comment({ deleted_at: 'y', body: '' })))
    .toEqual({ ids: ['m2'], tombstone: expect.objectContaining({ id: 'm1', body: '', author_name: null }) });
  expect(commentDeletedPayload(['m2'], null)).toEqual({ ids: ['m2'], tombstone: null });
});
```

- [ ] **Step 2: Run** the four files. Expected: FAIL (unknown actions fail `tsc`; view and publish assertions fail).
- [ ] **Step 3: Implement.** `tsc` will not compile until all five actions are in `ACTION_PHASE_GATE`.
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit && npx eslint <the changed files>`. Expected: PASS, clean, including `phase-contract.test.ts` for every phase and action; no existing action's decision changes.
- [ ] **Step 5: Commit** `feat(guards): topic and comment actions; shaper and events for comments`

---

### Task 5: The current topic: entering Discuss, set-topic and completion

**Files:**
- Modify: `app/api/boards/[boardId]/phase/route.ts`, `app/api/boards/[boardId]/route.ts` (the guided complete statement only), `lib/phases.ts` (`phaseConfigAfterClose`)
- Test: `app/api/boards/[boardId]/phase/__tests__/phase-route.test.ts`, `app/api/boards/[boardId]/__tests__/guided-lifecycle.test.ts`, `lib/__tests__/phases.test.ts`

**Interfaces:**
- Consumes: `AGENDA_PHASE`, `isPhaseRouteAction`, `TOPIC_NOT_FOUND_ERROR`, `setTopicOutcome` (Task 2); `'topic.set'` (Task 4); `validateClientId`.
- Produces (`POST /api/boards/[boardId]/phase`):
  - `action` is checked with `isPhaseRouteAction` (400 `Invalid request body` otherwise, as now).
  - `move`: unchanged except the statement below, which also writes `phase_config.topic`: the first agenda item when the target is `AGENDA_PHASE`, otherwise null (so leaving Discuss, forward or back, clears it). It is computed inside the move statement, which already runs under the per-board vote lock after any vote in flight, so two facilitators cannot disagree: only one move wins (it is conditional on `phase = from`) and its topic comes from the one locked snapshot.
  - `set-topic`: body `{ action: 'set-topic', cardId: string }`; `cardId` must pass `validateClientId` (400 `Invalid request body` before any database call). Guard `checkAction('topic.set', ...)` (403 for a participant; 409 `Not available during {Phase}`; 409 `Board is completed`), then an open board is 409 `This board is not in guided mode`. One statement (below). `topic_ok` false is 404 `That topic is not on the agenda` (missing card, or a card inside a group); no row is 409 `The phase already changed`. 200 `{ ok: true, phase, settings, phaseConfig }`, and `phase-changed` published with `{ phase, settings, phaseConfig }` (no `refetch`: nothing withheld changes). No advisory lock: the statement is an `UPDATE boards` conditional on the phase, serialized against the move by the row lock.
  - `set-deadline`: unchanged.
- Produces (board POST): the guided complete statement merges `'{"deadline":null,"topic":null}'::jsonb` in place of `'{"deadline":null}'::jsonb`. The guided reopen statement is NOT changed: it returns the board to Discuss with the null topic completion left, and every client then shows the first agenda item through `currentTopicId` (Discuss freezes cards and votes, so every client computes the same item) until the facilitator's first move stores a real id. Reopen needs a signed-in owner, so e2e cannot run it (`e2e/guided-mode.spec.ts` keeps its `test.fixme`); leaving its statement alone keeps the rule that every changed statement runs for real. The open complete and open reopen statements do not change.
- Produces (`lib/phases.ts`): `phaseConfigAfterClose` returns `{ ...config, deadline: null, topic: null }` for a guided payload (it carries a phase); an open payload still returns the config unchanged.

What must NOT change: the open complete, open reopen, guided reopen, open GET and open PATCH statements (pinned before this task edits the board route); `set-deadline`; the phase route's two round-trips per request. After a move a guided board's `phase_config` carries a `topic` key (null outside Discuss): before finishing, run `grep -rnE "phase_config|phaseConfig" e2e lib/__tests__ app stores | grep -E "toEqual|toStrictEqual"` and check every hit; an open-board assertion of `{ deadline: null }` must still pass unchanged, and a guided assertion that now sees the extra key is updated and listed in the report.

- [ ] **Step 1: Pin the open lifecycle statements** before touching the board route. In `guided-lifecycle.test.ts` add two tests that run `complete` and `reopen` on an open board and assert `(mocks.sql.mock.calls[1][0] as string[]).join('?')` with `toMatchInlineSnapshot()` (the call index each existing "keeps its exact statement" test uses). Run `npx vitest run app/api/boards/\[boardId\]/__tests__/guided-lifecycle.test.ts -u` on the unmodified route. Expected: snapshots written, tests pass. Review them against the route by eye.
- [ ] **Step 2: Write the failing tests.**

```ts
// phase-route.test.ts
describe('POST /phase topic', () => {
  it('moving into Discuss stores the first agenda item, computed in the locked move statement', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ cp_is_admin: true, mode: 'guided', phase: 'vote' })]);
    mocks.tx.mockResolvedValueOnce([[], [{ phase: 'discuss', settings: {}, phase_config: { deadline: null, topic: 'c9' } }]]);
    const res = await post({ action: 'move', from: 'vote', to: 'next' });
    expect((await res.json()).phaseConfig).toEqual({ deadline: null, topic: 'c9' });
    const [lock, stmt] = txTexts();
    expect(lock.values).toEqual(['b1:votes']);
    expect(stmt.text).toContain(`jsonb_build_object(`);
    expect(stmt.text).toContain(`'topic', CASE WHEN ?::text = ? THEN (`);
    expect(stmt.text).toContain(`WHERE c.board_id = ? AND c.merged_with IS NULL`);
    expect(stmt.text).toContain(`) DESC, date_trunc('milliseconds', c.created_at) ASC, c.id COLLATE "C" ASC`);
    expect(stmt.values).toEqual(expect.arrayContaining(['discuss']));
  });
  it('set-topic: two round-trips, publishes phase-changed without refetch', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ cp_is_admin: true, mode: 'guided', phase: 'discuss' })])
      .mockResolvedValueOnce([{ topic_ok: true, phase: 'discuss', settings: {}, phase_config: { deadline: null, topic: 'c2' } }]);
    const res = await post({ action: 'set-topic', cardId: 'c2' });
    expect(res.status).toBe(200);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callText(1)).toContain('merged_with IS NULL');
    expect(callText(1)).toContain('AND phase = ?');
    expect(callValues(1)).toEqual(expect.arrayContaining(['c2', 'b1', 'discuss']));
    expect(channelPublish).toHaveBeenCalledWith('phase-changed', expect.not.objectContaining({ refetch: true }));
    expect(mocks.tx).not.toHaveBeenCalled();
  });
  it('set-topic refusals', async () => {
    mocks.sql.mockResolvedValueOnce([ctxRow({ cp_is_admin: true, mode: 'guided', phase: 'discuss' })]).mockResolvedValueOnce([{ topic_ok: false, phase: null }]);
    const missing = await post({ action: 'set-topic', cardId: 'child' });
    expect(missing.status).toBe(404);
    expect((await missing.json()).error).toBe('That topic is not on the agenda');
    mocks.sql.mockResolvedValueOnce([ctxRow({ cp_is_admin: true, mode: 'guided', phase: 'discuss' })]).mockResolvedValueOnce([{ topic_ok: true, phase: null }]);
    expect((await (await post({ action: 'set-topic', cardId: 'c2' })).json()).error).toBe('The phase already changed');
    mocks.sql.mockResolvedValueOnce([ctxRow({ mode: 'guided', phase: 'discuss' })]);
    expect((await post({ action: 'set-topic', cardId: 'c2' })).status).toBe(403);
    mocks.sql.mockResolvedValueOnce([ctxRow({ cp_is_admin: true, mode: 'guided', phase: 'vote' })]);
    expect((await (await post({ action: 'set-topic', cardId: 'c2' })).json()).error).toBe('Not available during Vote');
    mocks.sql.mockResolvedValueOnce([ctxRow({ cp_is_admin: true })]);
    expect((await (await post({ action: 'set-topic', cardId: 'c2' })).json()).error).toBe('This board is not in guided mode');
  });
  it('400 for a malformed cardId with zero queries', async () => {
    expect((await post({ action: 'set-topic', cardId: 'bad id!' })).status).toBe(400);
    expect((await post({ action: 'set-topic' })).status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
```

(Use the file's existing `post`, `ctxRow`, transaction capture and channel mock; add `callText`/`callValues` helpers if the file lacks them, copied from `groups-route.test.ts`.) Update the existing test "takes the per-board vote lock first, in the same transaction, and the UPDATE text is unchanged" so it asserts the new move statement (the guided statement changes on purpose); keep its lock assertion.

In `guided-lifecycle.test.ts`: the guided complete statement contains `'{"deadline":null,"topic":null}'::jsonb` and the guided reopen statement still contains `'{"deadline":null}'::jsonb` unchanged; the open ones still never mention `phase_config` (existing tests) and match their new snapshots. In `phases.test.ts`: `phaseConfigAfterClose({ deadline: 'x', topic: 'c1' }, { phase: 'done' })` is `{ deadline: null, topic: null }`; `phaseConfigAfterClose({ deadline: null }, { refetch: true })` returns the same object.

- [ ] **Step 3: Run** the three files. Expected: the new assertions FAIL; the Step 1 snapshots PASS.
- [ ] **Step 4: Implement.** The move statement (inside the existing transaction, after the lock):

```sql
UPDATE boards SET phase = ${move.phase},
  settings = settings || ${JSON.stringify(phaseSettings(move.phase))}::jsonb,
  phase_config = phase_config || jsonb_build_object(
    'deadline', NULL::text,
    'topic', CASE WHEN ${move.phase}::text = ${AGENDA_PHASE} THEN (
      SELECT c.id FROM cards c
      WHERE c.board_id = ${boardId} AND c.merged_with IS NULL
      ORDER BY (
        SELECT COALESCE(SUM(v.count), 0) FROM votes v
        WHERE v.board_id = ${boardId}
          AND v.card_id IN (SELECT g.id FROM cards g WHERE g.board_id = ${boardId} AND (g.id = c.id OR g.merged_with = c.id))
      ) DESC, date_trunc('milliseconds', c.created_at) ASC, c.id COLLATE "C" ASC
      LIMIT 1
    ) END)
WHERE id = ${boardId} AND mode = 'guided' AND phase = ${from}
  AND archived_at IS NULL AND deleted_at IS NULL
RETURNING phase, settings, phase_config
```

This ordering is the SQL twin of `buildAgenda`; Task 12 proves they agree on a real database, including a tie. The set-topic statement:

```sql
WITH target AS (
  SELECT id FROM cards WHERE id = ${cardId} AND board_id = ${boardId} AND merged_with IS NULL
), updated AS (
  UPDATE boards SET phase_config = phase_config || jsonb_build_object('topic', ${cardId}::text)
  WHERE id = ${boardId} AND mode = 'guided' AND phase = ${phase}
    AND archived_at IS NULL AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM target)
  RETURNING phase, settings, phase_config
)
SELECT EXISTS (SELECT 1 FROM target) AS topic_ok, u.phase, u.settings, u.phase_config
FROM (SELECT 1) one LEFT JOIN updated u ON true
```

`phase` is `loaded.board.phase`. Decide the answer with `setTopicOutcome`.

- [ ] **Step 5: Run** the three files without `-u`, then `npm test && npx tsc --noEmit && npx eslint <the changed files>`. Expected: PASS; every pre-existing open snapshot (GET, PATCH, toggle) and the two new lifecycle snapshots unchanged.
- [ ] **Step 6: Commit** `feat(api): the current topic is set on entering Discuss and by the facilitator`

---

### Task 6: Topic-linked action items with a real owner

**Files:**
- Modify: `app/api/boards/[boardId]/action-items/route.ts`
- Test: new `app/api/boards/[boardId]/action-items/__tests__/action-items-round-trips.test.ts` (open pins), new `app/api/boards/[boardId]/action-items/__tests__/guided-action-items.test.ts`

Who may write action items stays as it is today, and it is not unsafe on a guided board: any joined participant (or a facilitator without a participant row) may create, edit, complete and delete any action item, in every phase (`ACTION_PHASE_GATE['action-item.write']` is null; the routes check no ownership); a locked board limits that to facilitators. Action items carry nothing that guided mode withholds. This task adds one rule: linking an item to a topic needs `action-item.link` (Discuss only).

**Interfaces:**
- Consumes: `isUuid`, `INVALID_ASSIGNEE`, `validateClientId` (Task 2); `TOPIC_NOT_FOUND_ERROR`, `ASSIGNEE_NOT_FOUND_ERROR`, `topicActionOutcome`, `assignOutcome` (Task 2); `'action-item.link'` (Task 4); `GUIDED_MODE`, `PHASE_CHANGED_ERROR`.
- Produces (`POST /api/boards/[boardId]/action-items`):
  - Open board: exactly today's code and statement. `cardId` and `assigneeParticipantId` in the body are ignored, as every unknown field is today (no new 400 for an open board).
  - Guided board (after the guard): `cardId` (absent, null, or a `validateClientId` string) and `assigneeParticipantId` (absent, null, or a `validateClientId` string) are validated: a bad `cardId` is 400 `Invalid request body`, a bad owner 400 `Invalid assignee`. With a `cardId`, `checkAction('action-item.link', ...)` also runs (409 `Not available during {Phase}`). Then the guided statement below. Outcomes: `phase-changed` 409 `The phase already changed`; `topic-missing` 404 `That topic is not on the agenda`; `owner-missing` 404 `That person is not on this board`; `ok` 200 `{ item }` (the row without the three flag columns) and `action-item-created` published with `{ item }`.
  - With an owner, `assignee` is stored as the owner's `display_name` (the free text in the body is ignored then); without one, the body's free-text `assignee` is stored as today.
- Produces (`PATCH`):
  - Open board: exactly today's code and statement (an `assignee_participant_id` key is ignored, as today).
  - Guided board: `updates.assignee_participant_id`, when present, is null or a `validateClientId` string (400 `Invalid assignee`). The guided statement below: a present owner key sets both `assignee_participant_id` and `assignee` (to the owner's name, or both null); otherwise a present `assignee` key sets the free text and clears `assignee_participant_id` (the link would be stale); description, due date and status as today. Outcomes: `phase-changed` 409; `owner-missing` 404 `That person is not on this board`; `item-missing` 404 `Action item not found`; `ok` 200 `{ item }` and `action-item-updated` published with `{ item }`.
- `DELETE`: unchanged for every board.
- The route imports `isUuid` from `lib/board-validation.ts` in place of its local `UUID_RE` (no behaviour change).
- Locking: no advisory lock; the guided statements read the board row `FOR SHARE` (Global Constraints).

- [ ] **Step 1: Pin the open statements before touching the route.** Create `action-items-round-trips.test.ts` with the mocks `groups/__tests__/groups-route.test.ts` uses (`@/lib/db` `sql`, `next/headers`, `@/lib/auth`, `@/lib/ably-server` with a hoisted `channelPublish`, `@/lib/rate-limit`, `@/lib/auth-helpers`, `@/lib/participant-session`) and its `ctxRow`, `callText`, `callValues`. On an open v2 board: POST `{ description: 'Do it', assignee: 'Ann', dueDate: '2026-12-01' }`, PATCH `{ itemId: <uuid>, updates: { status: 'done' } }` and DELETE `{ itemId: <uuid> }`; for each assert `callText(1)` with `toMatchInlineSnapshot()`, the 200 body, and the published event name. Add: an open POST carrying `cardId: 'c1', assigneeParticipantId: 'p9'` runs the same statement text with the same values as without them; an open PATCH with `updates: { assignee_participant_id: 'p9' }` runs the pinned statement. Run with `-u` on the unmodified route. Expected: snapshots written, all pass. Review them by eye.
- [ ] **Step 2: Write the failing guided tests** in `guided-action-items.test.ts` (same mocks; `guidedRow = ctxRow({ mode: 'guided', phase: 'discuss', settings: phaseSettings('discuss') })`):
  - A topic action with an owner: 200, two round-trips, `callText(1)` contains `FOR SHARE`, `merged_with IS NULL`, `COALESCE((SELECT display_name FROM owner)`, values include `'c1'`, `'p9'`, `'discuss'`; the body is `{ item }` without `board_ok`, `topic_ok`, `owner_ok`; `channelPublish` called with `'action-item-created', { item }`.
  - A guided create without topic or owner in Reflect runs the guided statement (contains `FOR SHARE`) and is 200 (the link rule only applies with a `cardId`).
  - A guided create with `cardId` in Vote: 409 `Not available during Vote`, one round-trip.
  - Outcome rows: `board_ok: false` is 409 `The phase already changed`; `topic_ok: false` is 404 `That topic is not on the agenda`; `owner_ok: false` is 404 `That person is not on this board`; nothing published for any of them.
  - `assigneeParticipantId: 5` is 400 `Invalid assignee`; `cardId: 'bad id!'` is 400 `Invalid request body`; each after one round-trip (validated after the mode is known).
  - PATCH `{ assignee_participant_id: 'p9' }`: `callText(1)` contains `WHEN ?::boolean THEN (SELECT display_name FROM owner)` and `FOR SHARE`; 200 `{ item }`; `owner_ok: false` is 404 `That person is not on this board`; a null `id` is 404 `Action item not found`.
  - PATCH `{ assignee: 'Someone' }` on a guided board runs the guided statement (the free text clears the link); PATCH `{ assignee_participant_id: 7 }` is 400 `Invalid assignee`.
- [ ] **Step 3: Run** both files. Expected: the snapshots PASS; the guided tests FAIL.
- [ ] **Step 4: Implement.** After the guard: `if (loaded.board.mode === GUIDED_MODE) return guidedCreate(...)` (and `guidedPatch` in PATCH), then the existing code unchanged. Statements:

```sql
-- guided create
WITH ok AS (
  SELECT 1 AS one FROM boards
  WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
  FOR SHARE
), topic AS (
  SELECT id FROM cards WHERE id = ${cardId}::text AND board_id = ${boardId} AND merged_with IS NULL
), owner AS (
  SELECT id, display_name FROM participants WHERE id = ${ownerId}::text AND board_id = ${boardId}
), inserted AS (
  INSERT INTO action_items (board_id, description, assignee, due_date, created_by, card_id, assignee_participant_id)
  SELECT ${boardId}, ${description}, COALESCE((SELECT display_name FROM owner), ${assignee}::text),
         ${dueDate}::date, ${createdBy}, (SELECT id FROM topic), (SELECT id FROM owner)
  FROM ok
  WHERE (${cardId}::text IS NULL OR EXISTS (SELECT 1 FROM topic))
    AND (${ownerId}::text IS NULL OR EXISTS (SELECT 1 FROM owner))
  RETURNING *
)
SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
       (${cardId}::text IS NULL OR EXISTS (SELECT 1 FROM topic)) AS topic_ok,
       (${ownerId}::text IS NULL OR EXISTS (SELECT 1 FROM owner)) AS owner_ok,
       i.*
FROM (SELECT 1) one LEFT JOIN inserted i ON true

-- guided patch
WITH ok AS (
  SELECT 1 AS one FROM boards
  WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
  FOR SHARE
), owner AS (
  SELECT id, display_name FROM participants WHERE id = ${ownerId}::text AND board_id = ${boardId}
), updated AS (
  UPDATE action_items SET
    description = CASE WHEN ${has('description')}::boolean THEN ${updates.description ?? null}::text ELSE description END,
    assignee = CASE WHEN ${hasOwner}::boolean THEN (SELECT display_name FROM owner)
                    WHEN ${has('assignee')}::boolean THEN ${updates.assignee ?? null}::text ELSE assignee END,
    assignee_participant_id = CASE WHEN ${hasOwner}::boolean THEN (SELECT id FROM owner)
                    WHEN ${has('assignee')}::boolean THEN NULL ELSE assignee_participant_id END,
    due_date = CASE WHEN ${has('due_date')}::boolean THEN ${updates.due_date ?? null}::date ELSE due_date END,
    status = CASE WHEN ${has('status')}::boolean THEN ${updates.status ?? null}::text ELSE status END
  FROM ok
  WHERE action_items.id = ${itemId} AND action_items.board_id = ${boardId}
    AND (NOT ${hasOwner}::boolean OR ${ownerId}::text IS NULL OR EXISTS (SELECT 1 FROM owner))
  RETURNING action_items.*
)
SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
       (NOT ${hasOwner}::boolean OR ${ownerId}::text IS NULL OR EXISTS (SELECT 1 FROM owner)) AS owner_ok,
       u.*
FROM (SELECT 1) one LEFT JOIN updated u ON true
```

`phase` is `loaded.board.phase`; `createdBy` is whatever the open create passes for `created_by` for the same actor (read the open code first: a signed-in facilitator without a participant row must still be able to create, exactly as on an open board; add a guided test for that case); `hasOwner` is `updates.assignee_participant_id !== undefined`. Strip the flag columns before responding and publishing.

- [ ] **Step 5: Run** both files without `-u`, then `npm test && npx tsc --noEmit && npx eslint app/api/boards/\[boardId\]/action-items`. Expected: PASS; the Step 1 snapshots unchanged; `e2e/action-items-authz.spec.ts` is untouched (Task 12 runs it).
- [ ] **Step 6: Commit** `feat(api): action items link to a topic and take an owner from the board's people on guided boards`

---

### Task 7: The comments route and comments on the guided board GET

**Files:**
- Create: `app/api/boards/[boardId]/comments/route.ts`
- Modify: `app/api/boards/[boardId]/route.ts` (GET only)
- Test: new `app/api/boards/[boardId]/comments/__tests__/comments-route.test.ts`; `app/api/boards/[boardId]/__tests__/get-guided-fields.test.ts`, `get-round-trips.test.ts`

**Interfaces:**
- Consumes: Task 2 (`validateCommentBody`, `isUuid`, `validateClientId`, `commentsReadable`, the three outcome functions, every comment message, `COMMENTS_PER_BOARD_MAX`); Task 4 (`'comment.*'` actions, `shapeComment`, `shapeComments`, `publishComment`, `publishCommentDeleted`); `requireParticipantOn`, `JOIN_FIRST_ERROR`.
- Produces (`/api/boards/[boardId]/comments`, rate limit `rateLimitOr429(request, 'comment', 300, 60)` on every method; the body is validated fully before the actor load; after the load the guard runs, then an open board is 409 `This board is not in guided mode`; two round-trips each):
  - `POST { cardId: string; body: string; anonymous?: boolean; parentId?: string | null }`: guard `comment.create`; `requireParticipantOn` (a facilitator without a participant row cannot comment: a comment needs an author). 200 `{ comment }` shaped for the caller (`is_mine: true`); publishes `comment-created`. Refusals from `createCommentOutcome`: `phase-changed` 409 `The phase already changed`; `card-missing` 404 `Card not found`; `not-a-topic` 409 `Comments go on a topic, not on a card inside it`; `bad-parent` 409 `You can only reply to a comment that starts a thread`; `limit` 409 `This board has reached its limit of 500 comments`. A reply is stored on its parent's card: the client sends the parent's `card_id` as `cardId`, and the statement requires the parent to be a live top-level comment on that card (the composite foreign key enforces the same card in the database). A top-level comment must target a root card.
  - `PATCH { commentId: string; body: string }`: guard `comment.edit`; `requireParticipantOn`. 200 `{ comment }` shaped for the caller; publishes `comment-updated`. `editCommentOutcome`: `phase-changed` 409; `missing` 404 `Comment not found`; `gone` 409 `This comment was deleted`; `not-yours` 403 `Only the author can edit this comment` (a facilitator cannot edit someone else's comment). The anonymous flag never changes.
  - `DELETE { commentId: string }`: guard `comment.delete` (a facilitator without a participant row may delete). 200 `{ ids: string[], tombstone: Comment | null }` (the tombstone shaped for the public); publishes `comment-deleted` with the same payload. `deleteCommentOutcome`: `phase-changed` 409; `missing` 404; `gone` 409 `This comment was deleted`; `denied` 403 `Only the author or a facilitator can delete this comment`. A top-level comment with replies becomes a tombstone (`deleted_at` set, `body` `''`); anything else is deleted; deleting the last reply under a tombstone deletes the tombstone too (both ids in `ids`).
  - 400 `Invalid request body` for a missing or malformed `cardId`, `commentId` (`isUuid`), `parentId` (`isUuid` or null), or a non-boolean `anonymous`; the body's `validateCommentBody` error for its text.
  - Locking: no advisory lock; every statement reads the board row `FOR SHARE` in `ok`, so a comment cannot commit after a phase move or completion that it raced. The 500 cap is checked inside the insert without a lock, so simultaneous requests can pass it by their number; it bounds abuse, not an exact count.
- Produces (board GET, guided only): the snapshot transaction gains a sixth statement `SELECT * FROM comments WHERE board_id = ${boardId} ORDER BY created_at, id` only when `loadedAny.board.mode === GUIDED_MODE && commentsReadable(loadedAny.board)` (chosen in TypeScript; the open board's transaction keeps exactly its five pinned statements). The response gains `comments: shapeComments(rows, viewer)` for every guided board (an empty array outside Discuss and Done) and no key at all for an open board or the minimal no-access payload.

Why comments travel inside the GET: every guided phase change and every reconnect already refetches the board through the one coalesced runner; a separate comments route would need its own request on each of those, its own coalescing and its own stale-board guard, or the thread would lag the phase. Payload: a comment row is about 300 bytes plus its body; a heavy retro (10 people, 150 comments, 100-character bodies) adds about 60 KB to the Discuss GET, and the 500-comment cap bounds the worst case near 650 KB. Comments are not read at all before Discuss.

- [ ] **Step 1: Write the failing tests** in `comments-route.test.ts`, mocking as `groups-route.test.ts` does, with `@/lib/board-publish` mocked as `publishComment: mocks.publish`, `publishCommentDeleted: mocks.publishDeleted`, and `guidedRow = ctxRow({ mode: 'guided', phase: 'discuss', settings: phaseSettings('discuss') })`. A stored row factory `row(over)` returns a full comments row (`id: '00000000-0000-4000-8000-0000000000a1'`, `author_participant_id: 'p1'`, `author_name: 'Ann'`, `is_anonymous: false`, `body: 'hi'`, ...). Cases:
  - Create: 200 in two round-trips; `callText(1)` contains `FOR SHARE`, `room.n < ?`, `target.merged_with IS NULL`, `parent.parent_id IS NULL AND parent.deleted_at IS NULL`; values include `'L'`, `'hi'`, `false`, `500`, `'discuss'`; the body is `{ comment }` with `is_mine: true`; `mocks.publish` called with `('b1', 'comment-created', <the stored row>)`.
  - An anonymous create answers `{ comment }` with `author_participant_id: null`, `author_name: null`, `is_mine: true`.
  - Each `createCommentOutcome` refusal row gives its status and message above, and nothing is published.
  - `{ cardId: 'L', body: '   ' }` is 400 `Write a comment first`; `'x'.repeat(1001)` is 400 `Comments can be at most 1000 characters`; `anonymous: 'yes'` and `parentId: 'nope'` are 400 `Invalid request body`; all with zero queries.
  - During Vote: 409 `Not available during Vote` after one round-trip; on an open board 409 `This board is not in guided mode` after one round-trip; a signed-in facilitator with no participant row is 401 `Join the board first`.
  - Edit: 200 `{ comment }`, `callText(1)` contains `edited_at = now()` and `cur.author_participant_id = ?`; publishes `comment-updated`; `is_author: false` is 403 `Only the author can edit this comment`; `is_deleted: true` is 409 `This comment was deleted`; `found: 0` is 404 `Comment not found`.
  - Delete: a top-level comment with replies answers `{ ids: [], tombstone: <shaped, body ''> }`; `callText(1)` contains `SET body = '', deleted_at = now()` and `p.deleted_at IS NOT NULL`; a reply that was the last under a tombstone answers `{ ids: [<reply>, <parent>], tombstone: null }`; `permitted: false` is 403 `Only the author or a facilitator can delete this comment`; a facilitator's delete of someone else's comment passes `true` as the facilitator value; `mocks.publishDeleted` called with `('b1', ids, tombstone)`.

Add to `get-guided-fields.test.ts`:

```ts
it('a guided board in Discuss reads comments in the same snapshot and shapes them for the viewer', async () => {
  mocks.sql.mockResolvedValue([ctxRow({ mode: 'guided', phase: 'discuss', cp_id: 'p2', settings: phaseSettings('discuss') })]);
  const anon = { id: 'm1', board_id: 'b1', card_id: 'L', parent_id: null, author_participant_id: 'p2', author_name: 'Bo',
    is_anonymous: true, body: 'hi', created_at: 'x', edited_at: null, deleted_at: null };
  mocks.tx.mockResolvedValue([[], [], [], [], [], [anon]]);
  const json = await (await call()).json();
  expect(json.comments).toEqual([expect.objectContaining({ id: 'm1', author_participant_id: null, author_name: null, is_mine: true })]);
  const texts: string[] = [];
  mocks.tx.mock.calls[0][0]((s: TemplateStringsArray) => { texts.push(s.join('?')); return {}; });
  expect(texts).toHaveLength(6);
  expect(texts[5]).toBe('SELECT * FROM comments WHERE board_id = ? ORDER BY created_at, id');
});
it('a guided board before Discuss runs five statements and answers comments: []', async () => {
  mocks.sql.mockResolvedValue([ctxRow({ mode: 'guided', phase: 'vote', settings: phaseSettings('vote') })]);
  mocks.tx.mockResolvedValue([[], [], [], [], []]);
  expect((await (await call()).json()).comments).toEqual([]);
});
it('an open board GET has no comments key', async () => {
  mocks.sql.mockResolvedValue([ctxRow({ mode: 'open', phase: null })]);
  expect('comments' in (await (await call()).json())).toBe(false);
});
// The existing minimal no-access payload test also asserts: expect('comments' in json).toBe(false)
```

In `get-round-trips.test.ts`, the open-board snapshot test also asserts the response has no `comments` key; its five-statement inline snapshot must not change.

- [ ] **Step 2: Run** `npx vitest run app/api/boards/\[boardId\]/comments app/api/boards/\[boardId\]/__tests__/get-guided-fields.test.ts app/api/boards/\[boardId\]/__tests__/get-round-trips.test.ts`. Expected: the new tests FAIL; the open snapshot PASSES.
- [ ] **Step 3: Implement.** Statements (`phase` is `loaded.board.phase`, `actorId` is `loaded.actor.participantId`, `isFacilitator` is `loaded.actor.isFacilitator`):

```sql
-- create
WITH ok AS (
  SELECT 1 AS one FROM boards
  WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
  FOR SHARE
), target AS (
  SELECT id, merged_with FROM cards WHERE id = ${cardId} AND board_id = ${boardId}
), parent AS (
  SELECT id, card_id, parent_id, deleted_at FROM comments WHERE id = ${parentId}::uuid AND board_id = ${boardId}
), room AS (
  SELECT COUNT(*)::int AS n FROM comments WHERE board_id = ${boardId}
), author AS (
  SELECT display_name FROM participants WHERE id = ${actorId} AND board_id = ${boardId}
), inserted AS (
  INSERT INTO comments (board_id, card_id, parent_id, author_participant_id, author_name, is_anonymous, body)
  SELECT ${boardId}, target.id, ${parentId}::uuid, ${actorId}, author.display_name, ${anonymous}, ${body}
  FROM ok, target, room, author
  WHERE room.n < ${COMMENTS_PER_BOARD_MAX}
    AND CASE WHEN ${parentId}::uuid IS NULL THEN target.merged_with IS NULL
             ELSE EXISTS (SELECT 1 FROM parent WHERE parent.card_id = target.id
                          AND parent.parent_id IS NULL AND parent.deleted_at IS NULL) END
  RETURNING *
)
SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
       (SELECT COUNT(*) FROM target)::int AS card_found,
       (SELECT merged_with FROM target) AS card_parent,
       (${parentId}::uuid IS NULL OR EXISTS (SELECT 1 FROM parent WHERE parent.card_id = ${cardId}
          AND parent.parent_id IS NULL AND parent.deleted_at IS NULL)) AS parent_ok,
       (SELECT n FROM room) AS comment_count,
       i.*
FROM (SELECT 1) one LEFT JOIN inserted i ON true

-- edit
WITH ok AS (
  SELECT 1 AS one FROM boards
  WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
  FOR SHARE
), cur AS (
  SELECT id, author_participant_id, deleted_at FROM comments WHERE id = ${commentId} AND board_id = ${boardId}
), updated AS (
  UPDATE comments SET body = ${body}, edited_at = now()
  FROM cur, ok
  WHERE comments.id = cur.id AND cur.deleted_at IS NULL AND cur.author_participant_id = ${actorId}
  RETURNING comments.*
)
SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
       (SELECT COUNT(*) FROM cur)::int AS found,
       (SELECT deleted_at IS NOT NULL FROM cur) AS is_deleted,
       (SELECT author_participant_id = ${actorId} FROM cur) AS is_author,
       u.*
FROM (SELECT 1) one LEFT JOIN updated u ON true

-- delete
WITH ok AS (
  SELECT 1 AS one FROM boards
  WHERE id = ${boardId} AND phase = ${phase} AND archived_at IS NULL AND deleted_at IS NULL
  FOR SHARE
), cur AS (
  SELECT id, parent_id, author_participant_id, deleted_at FROM comments WHERE id = ${commentId} AND board_id = ${boardId}
), allowed AS (
  SELECT cur.* FROM cur, ok
  WHERE cur.deleted_at IS NULL AND (${isFacilitator}::boolean OR cur.author_participant_id = ${actorId}::text)
), has_replies AS (
  SELECT EXISTS (SELECT 1 FROM comments r JOIN allowed a ON r.parent_id = a.id) AS yes
), tombstoned AS (
  UPDATE comments SET body = '', deleted_at = now()
  FROM allowed, has_replies
  WHERE comments.id = allowed.id AND has_replies.yes
  RETURNING comments.*
), removed AS (
  DELETE FROM comments USING allowed, has_replies
  WHERE comments.id = allowed.id AND NOT has_replies.yes
  RETURNING comments.id, comments.parent_id
), orphan AS (
  DELETE FROM comments p USING removed
  WHERE p.id = removed.parent_id AND p.deleted_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM comments r WHERE r.parent_id = p.id AND r.id <> removed.id)
  RETURNING p.id
)
SELECT EXISTS (SELECT 1 FROM ok) AS board_ok,
       (SELECT COUNT(*) FROM cur)::int AS found,
       (SELECT deleted_at IS NOT NULL FROM cur) AS already_deleted,
       EXISTS (SELECT 1 FROM allowed) AS permitted,
       COALESCE((SELECT array_agg(x.id::text) FROM (SELECT id FROM removed UNION ALL SELECT id FROM orphan) x), '{}') AS removed_ids,
       t.*
FROM (SELECT 1) one LEFT JOIN tombstoned t ON true
```

(Every sub-statement of one statement sees the snapshot from before it, so `orphan` excludes the reply `removed` is deleting.) Strip the flag columns, shape, respond, then publish. Import `ably-server` only through `lib/board-publish.ts`.

- [ ] **Step 4: Run** the Step 2 command without `-u`, then `npm test && npx tsc --noEmit && npx eslint app/api/boards/\[boardId\]/comments app/api/boards/\[boardId\]/route.ts`. Expected: PASS; the open GET snapshot unchanged.
- [ ] **Step 5: Commit** `feat(api): comment threads on guided topics, readable in Discuss and Done`

---

### Task 8: Client state for the topic, comments and topic actions

**Files:**
- Create: `lib/commentJournal.ts`, `stores/failAction.ts`, `stores/discussStore.ts`
- Modify: `stores/boardStore.ts` (`comments` state, `initialState`, `fetchBoard`, `reset`), `stores/groupVoteStore.ts` (imports the moved `failAction`; no behaviour change), `hooks/useBoardChannel.ts`
- Test: new `lib/__tests__/discuss-store.test.ts`; `lib/__tests__/group-vote-store.test.ts` and `phase-store.test.ts` must stay green

**Interfaces:**
- Produces (`lib/commentJournal.ts`, module state like `lib/voteTallyVersion.ts`): `recordCommentChange(change: CommentChange): void` (keeps the newest 200), `commentSeq(): number`, `commentChangesSince(seq: number): CommentChange[]`.
- Produces (`stores/failAction.ts`): `failAction(res: Response | null, fallback: string, boardId: string, opts?: { refetch: boolean }): Promise<Error>` and `noAnswer(): Response`, moved verbatim from `groupVoteStore.ts`, which now imports them.
- Produces (`useBoardStore`): state `comments: Comment[]` (initially `[]`). `fetchBoard` reads `commentSeq()` before its request and sets `comments: replayComments(response.comments ?? [], commentChangesSince(seqAtStart), boardId)`: a change applied while the GET was in flight survives it (Step 2 ruling R3, for comments). An open board's GET has no `comments`, so the list stays `[]`. `reset()` clears it.
- Produces (`useDiscussStore`):

```ts
interface DiscussState {
  viewed: ViewedTopic | null;          // a participant looking at another topic; null means following
  settingTopic: boolean;
  viewTopic: (cardId: string | null) => void;
  setTopic: (cardId: string) => Promise<void>;
  createComment: (input: { cardId: string; body: string; anonymous: boolean; parentId: string | null }) => Promise<void>;
  editComment: (commentId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  createTopicAction: (input: { cardId: string; description: string; assigneeParticipantId: string | null }) => Promise<void>;
  assignActionItem: (itemId: string, participantId: string | null) => Promise<void>;
}
export function applyCommentUpsertEvent(boardId: string, data: unknown): void;
export function applyCommentDeletedEvent(boardId: string, data: unknown): void;
```

Behaviour:
- Every action does nothing unless the board is guided; a write needs a current participant except `deleteComment` and `setTopic`, which a facilitator without one may send.
- `viewTopic(cardId)` stores `{ boardId, phase, cardId }` from the current board (null clears it). Nothing resets it on a timer or an effect: `shownTopicId` ignores it once the board or the phase differs.
- `setTopic(cardId)`: ignored while `settingTopic`; sets `board.phase_config.topic` optimistically; POSTs `{ action: 'set-topic', cardId }` to the phase route; on 200 applies the answer's `phaseConfig` only if the board is the same and its phase is still the one the request was sent in, and clears `viewed`; on failure restores the previous topic only if the board still shows the optimistic one, then rejects through `failAction` (a 409 refetches through `failWrite`). Fallback `SET_TOPIC_FALLBACK`.
- `createComment`: not optimistic (the server decides authorship, anonymity and the phase); POSTs to the comments route; on 200 for the same board applies the answer through `upsertComment` and records an `upsert` change; a failure rejects through `failAction` with `POST_COMMENT_FALLBACK`. `editComment` (PATCH) the same with `SAVE_COMMENT_FALLBACK`; it sends nothing when the body equals the stored one. `deleteComment` (DELETE) applies `removeComments(ids, tombstone)` and records a `remove` change, fallback `DELETE_COMMENT_FALLBACK`.
- `applyCommentUpsertEvent` / `applyCommentDeletedEvent`: ignored unless `boardId` is the current board and the payload parses (`parseComment` for `data.comment`; an array of strings for `data.ids` and a parsable or null `data.tombstone`); otherwise applied through `upsertComment` (which keeps `is_mine` from a local copy, so an author's anonymous comment stays theirs when its public echo arrives) or `removeComments`, and recorded.
- `createTopicAction`: POSTs `{ description, cardId, assigneeParticipantId }` to the action-items route; on 200 for the same board adds the answer's `item` unless an item with that id is already there (the `action-item-created` echo may arrive first). Fallback `ADD_TOPIC_ACTION_FALLBACK`.
- `assignActionItem`: optimistic `{ assignee_participant_id, assignee }` (the participant's display name, or both null); PATCHes `{ itemId, updates: { assignee_participant_id } }`; on 200 for the same board replaces the item with the answer's; on failure restores the previous item only if it still shows the optimistic owner, then rejects. Fallback `ASSIGN_FALLBACK`.
- `useBoardChannel` gains `case COMMENT_CREATED:` and `case COMMENT_UPDATED:` calling `applyCommentUpsertEvent(boardId, data)`, and `case COMMENT_DELETED:` calling `applyCommentDeletedEvent(boardId, data)`. The topic arrives through the existing `phase-changed` case (`applyPhaseChanged` replaces `phase_config`); `board-completed` and `board-reopened` clear it through `phaseConfigAfterClose` (Task 5).

Realtime volume (the spec lists Ably volume as a risk): each comment create, edit or delete, each topic change and each topic action create or owner change publishes exactly one message on the board channel, which Ably delivers to every connected client (billed as 1 publish plus N deliveries). No typing indicators, no per-keystroke traffic, no presence change. A heavy Discuss with 10 people, 150 comments, 20 edits or deletes, 15 topic changes and 20 action item writes is 205 publishes and about 2,255 billed messages, comparable to a Vote phase where 10 people place 5 votes each with tally events (50 publishes, 550 messages) times four.

- [ ] **Step 1: Write the failing tests** in `discuss-store.test.ts`, reusing the `board()`, `json()`, `deferred()`, `routes()`, `getBoardResponse()` and `localStorage` scaffolding from `group-vote-store.test.ts`, with a guided board in Discuss (`phase: 'discuss'`, `settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings('discuss') }`, `phase_config: { deadline: null, topic: 'c1' }`), `currentParticipantId: 'p1'`, and a `comment(over)` factory. Cases:
  - `fetchBoard` sets `comments` from the GET, and `[]` when the GET has no `comments` key.
  - A `comment-created` event for `m2` applied while a GET that lacks `m2` is in flight: after the GET resolves `m2` is still there. A `comment-deleted` event for `m1` while a GET that still has `m1` is in flight: after it resolves `m1` is gone.
  - `createComment` posts `{ cardId: 'c1', body: 'hi', anonymous: true, parentId: null }` and applies the answer (`is_mine: true`, author fields null); a `comment-created` echo of the same id with `is_mine: false` afterwards leaves `is_mine: true`; the echo arriving BEFORE the answer ends the same way.
  - A `createComment` answer for a board the user has left changes nothing; a 409 answer rejects with the server's message, leaves `comments` unchanged and triggers one coalesced GET.
  - `editComment` with unchanged text sends nothing; with new text applies the answer. `deleteComment` applies `ids` and the tombstone.
  - `setTopic('c2')` shows `c2` at once and keeps it after a 200; a second `setTopic` while the first is in flight sends nothing; a 409 restores `c1` (when still showing `c2`) and rejects; an answer that arrives after the phase moved to `done` is not applied.
  - `viewTopic('c3')` stores `{ boardId: 'b1', phase: 'discuss', cardId: 'c3' }`; a successful `setTopic` clears it.
  - `createTopicAction` posts `{ description: 'Fix it', cardId: 'c1', assigneeParticipantId: 'p2' }` and adds the answer's item once even when the `action-item-created` event already added it.
  - `assignActionItem('i1', 'p2')` shows `assignee: 'Bo', assignee_participant_id: 'p2'` at once; a 404 restores the previous owner and rejects with `That person is not on this board`.
  - `applyCommentUpsertEvent('b2', ...)` and a malformed payload change nothing.
- [ ] **Step 2: Run** `npx vitest run lib/__tests__/discuss-store.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the three new files, the board store state and the channel cases; move `failAction` and `noAnswer` and update `groupVoteStore.ts`'s import.
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit && npx eslint stores hooks/useBoardChannel.ts lib/commentJournal.ts`. Expected: PASS (including `group-vote-store.test.ts` and `phase-store.test.ts` unchanged), clean.
- [ ] **Step 5: Commit** `feat(client): topic, comment and topic action state with comment events`

---

### Task 9: The Discuss view: agenda and current topic, desktop and phone

**Files:**
- Create: `components/Discuss/DiscussView.tsx`, `components/Discuss/AgendaList.tsx`, `components/Discuss/TopicPanel.tsx`, `components/Discuss/MobileDiscuss.tsx`, `components/Discuss/index.ts`
- Modify: `components/pages/BoardPage.tsx`, `components/Board/MobileBoardShell.tsx`

**Interfaces:**
- Consumes: `useBoardStore` (`board`, `cards`, `votes`, `participants`, `currentParticipantId`, `updateCard`, `deleteCard`, `toggleReaction`), `useDiscussStore` (`viewed`, `settingTopic`, `viewTopic`, `setTopic`), Task 2 agenda helpers, `groupScore`, `voteTotalsByCard`, `useCardText`, `isMine`, `RetroCard`, `MobileSheet`.
- Produces: `<DiscussView isFacilitator: boolean />`, `<AgendaList agenda: AgendaItem[] currentId: string | null shownId: string | null onSelect: (cardId: string) => void />`, `<TopicPanel item: AgendaItem | null agenda: AgendaItem[] currentId: string | null isFacilitator: boolean layout: 'desktop' | 'phone' />`, `<MobileDiscuss isFacilitator: boolean />`.

Behaviour:
- Where it shows: when `discussViewShown(board)`, the desktop content area renders `<DiscussView isFacilitator={isAdmin} />` in place of the view toggle and column filter row and the four views (the `?view=` value is ignored until the phase leaves Discuss); the phone shell renders `<MobileDiscuss isFacilitator={isAdmin} />` in place of the column tabs, the merge banner, the sort control and the card list (the vote tracker and the add button are already hidden in Discuss because voting and card creation are off; the phase stepper, bottom nav, More sheet and action items sheet stay). Everywhere else, and on every open board, both shells render exactly what they render today. This is the one place cards appear in Discuss and Done, so every view agrees with the agenda and the current topic by construction.
- Derived values (memoized, never stored): `agenda = buildAgenda(cards, votes)`; `current = topicFollowable(board) ? currentTopicId(agenda, phaseTopic(board.phase_config)) : null`; `shown = shownTopicId(agenda, current ?? agenda[0]?.cardId ?? null, viewed, { boardId: board.id, phase: board.phase })`.
- `AgendaList`: heading `Agenda` (Done: `Topics`) with `agendaCountLabel(n)` beside it; an empty agenda reads `No cards to discuss.` Each item is a `button` with `data-testid="agenda-item"`, `aria-current="true"` on the current topic, showing its rank, `topicHeading(...)` clamped to two lines, `agendaVotesLabel(score)`, `agendaCardsLabel(cardIds.length)` when not null, and a `Now` pill on the current topic. The shown topic, when it is not the current one, has the selected outline (`--accent` border). A facilitator's click in Discuss calls `setTopic(cardId)` (everyone moves there); everyone else's click, and everyone's click in Done, calls `viewTopic(cardId)` (only their own view moves; clicking the current topic calls `viewTopic(null)`).
- `TopicPanel`: `data-testid="topic-panel"`; header `topicPositionLabel(...)` and, when the shown topic is the current one, a `Current topic` pill; the title `topicHeading(...)`; then a `Cards` section rendering the root and its children (in `item.cardIds` order) with `RetroCard`, passing the props `MobileBoardShell` passes, except `canMerge={false}`, no merge handlers, no `childCards`, `isChildCard` true for children, and `voteCount` = `groupScore` for the root and the card's own total for a child. Nothing new is mounted inside `RetroCard`.
- Facilitator controls (Discuss, not completed), in the panel header: `Previous topic` and `Next topic` buttons calling `setTopic(neighbourTopicId(agenda, current, -1 | 1))`, disabled at the ends with the titles `This is the first topic` and `This is the last topic`, and disabled while `settingTopic`; when the facilitator is looking at a topic that is not current (after a participant-style view, or a failed set), a `Discuss this topic` button calls `setTopic(shown)`. Handlers catch rejections.
- A participant looking at another topic in Discuss sees, above the panel, `You are looking at another topic.` and a `Back to current topic` button calling `viewTopic(null)`.
- `MobileDiscuss`: a top bar with `topicPositionLabel(...)`, an `Agenda` button (Done: `Topics`) that opens a `MobileSheet` (`label` and `title` the same word) holding `AgendaList` (selecting an item closes the sheet), and for a facilitator in Discuss two 44px icon buttons `aria-label="Previous topic"` and `aria-label="Next topic"`; below it the back bar when it applies, then the scrolling `TopicPanel layout="phone"`. Bottom padding clears the stepper and nav as the card list does today (`pb-[calc(84px+var(--safe-bottom))]` plus the stepper area).
- Layout: desktop `md:grid md:grid-cols-[minmax(240px,320px)_1fr] md:gap-6`, inside the existing `max-w-[1400px]` container; phone single column. Design tokens only (`--ink-*`, `--line`, `--surface`, `--surface-muted`, `--accent`, `--accent-soft`, `--r-md`); no new colour values. Text at least 16px in inputs on phones (none in this task).

- [ ] **Step 1: Build the five components** to the behaviour above.
- [ ] **Step 2: Mount** `DiscussView` in `BoardPage` and `MobileDiscuss` in `MobileBoardShell`, each behind `discussViewShown(board)`.
- [ ] **Step 3: Run** `npx tsc --noEmit && npm test && npx eslint <the changed files>`. Expected: clean.
- [ ] **Step 4: Observe in a browser** with two profiles (A facilitator, B participant) on a guided dev board with two columns, six cards, one two-card group with a title, votes giving one tie and one zero-vote card, moved to Discuss through the API. At 1280px, 390px and 360px, light and dark: both profiles show the same agenda order (record it; the tie and the zero-vote card are where `buildAgenda` puts them) and the same `Now` item; A's `Next topic` moves B's panel without a reload; B clicks topic 4, sees `You are looking at another topic.`, A moves to topic 3, B stays on 4, `Back to current topic` takes B to 3; A's `Next topic` is disabled on the last topic with its title; the phone `Agenda` sheet opens fully on screen at 390px and 360px (measure its bounding box against the viewport) and closes on a selection; the group shows its title and both cards; reactions on a topic card still work. Moving back to Vote shows the normal board views on both profiles; completing shows the read-only view with heading `Topics` and no `Now`. An open board's grid, list, swimlane, timeline and phone column list read the same before and after the change. Save screenshots to `observe-9/`.
- [ ] **Step 5: Commit** `feat(ui): ranked agenda and a shared current topic in Discuss`

---

### Task 10: Comment threads

**Files:**
- Create: `components/Discuss/CommentThread.tsx`, `components/Discuss/CommentItem.tsx`, `components/Discuss/CommentComposer.tsx`
- Modify: `components/Discuss/TopicPanel.tsx`

**Interfaces:**
- Consumes: `useBoardStore` (`board`, `comments`, `currentParticipantId`, `lastWriteError`, `clearWriteError`), `useDiscussStore` (`createComment`, `editComment`, `deleteComment`), Task 2 comment helpers, `editorStillOpen`, `formatDeadlineTime`, `COMMENT_BODY_MAX`.
- Produces: `<CommentThread rootId: string cardIds: string[] isFacilitator: boolean />` (mounted in `TopicPanel` under the cards, heading `Discussion`), `<CommentItem comment: Comment replies?: Comment[] ... />`, `<CommentComposer mode: 'comment' | 'reply' | 'edit' ... />`.

Behaviour:
- Readable whenever `commentsReadable(board)`; writable only while `commentsWritable(board)`. In Done everything is read-only: no composer, no Reply, Edit or Delete.
- The heading reads `Discussion`, with ` (n)` appended when there are live comments. The list is `threadsFor(comments, cardIds)`. Empty: `No comments yet. Start the discussion.` when writable, `No comments yet.` otherwise.
- Each comment shows `commentAuthorLabel(...)`, the time (`formatDeadlineTime(Date.parse(created_at))`), `(edited)` when `edited_at` is set, and its body with line breaks kept (`whitespace-pre-wrap`, `break-words`). A deleted comment shows only `This comment was deleted.` (from `DELETED_COMMENT_TEXT`) and keeps its replies under it. Replies are indented one level (`ml-6`, `border-l` with `--line`); nothing nests deeper.
- Buttons (text buttons, 44px tall on phones): `Reply` when `canReplyTo`, `Edit` when `canEditComment`, `Delete` when `canDeleteComment` (a facilitator sees `Delete` on anyone's comment, never `Edit`).
- Composer (top of the thread when writable): a textarea `aria-label="Comment"`, placeholder `Add a comment`, at least 16px text on phones; a checkbox `Post anonymously`, initially checked when `board.settings.anonymous_cards` is true; a `Comment` button, disabled while the trimmed text is empty or a post is in flight. Enter posts; Shift+Enter adds a line break; blur does nothing. The textarea carries `enterKeyHint="send"` so a phone keyboard labels the key (controller ruling; the reply and edit textareas carry it too). Input beyond 1000 code points is not accepted (`clampComment`); from 900 a counter reads `{n} of 1000`. On success the text clears and the checkbox returns to its initial value; on failure the text stays and the message shows under the composer.
- Reply composer: opened by `Reply` under that comment; textarea `aria-label="Reply"`, placeholder `Write a reply`, the same checkbox, buttons `Reply` and `Cancel`; it sends `parentId` = the comment's id and `cardId` = the comment's `card_id`. Escape or `Cancel` closes it.
- Edit: `Edit` swaps the body for a textarea `aria-label="Edit comment"` prefilled with the body, with `Save` and `Cancel`. Enter or `Save` saves; nothing is sent when the text equals what it opened with (it just closes); Escape or `Cancel` closes; blur does nothing. A rejected save keeps the editor open with the typed text and shows the message.
- Delete: `Delete` swaps the buttons for an inline confirmation `Delete this comment?` (or `Delete this comment? Its replies stay.` when it has replies) with `Delete` and `Cancel`; confirming calls `deleteComment` and catches; no modal.
- Every open composer, editor and confirmation remembers the phase it opened in and closes, without sending, when the phase changes or the board stops being writable (`editorStillOpen`). A component clears the shared banner only when it shows that component's own message.
- Accessibility: the thread is a `section` labelled by its heading; each comment is an `article`; the composer's error is tied with `aria-describedby`.

- [ ] **Step 1: Build the three components** and mount `CommentThread` in `TopicPanel`.
- [ ] **Step 2: Run** `npx tsc --noEmit && npm test && npx eslint <the changed files>`. Expected: clean.
- [ ] **Step 3: Observe in a browser** with two profiles on a guided dev board in Discuss, at 1280px, 390px and 360px, light and dark: B posts `First thought` and A sees it without a reload with B's name; B posts anonymously and sees `You (anonymous)` while A sees `Anonymous`; A replies `Agreed`, B sees it indented under the first comment; B edits `First thought` to `First thought, edited` with Enter, one PATCH is sent (count requests), `(edited)` shows on both; opening the editor and pressing `Save` without changes sends nothing; A deletes B's first comment (it has a reply), both see `This comment was deleted.` with the reply under it; B deletes the reply, both see the tombstone disappear; a 1001st character is not accepted and the counter reads `1000 of 1000`; A moves to Vote with B's composer holding text: the Discuss view goes away; back in Discuss the composer is empty. In Done (after completing) the thread shows with no composer and no buttons. An open board shows no comment control and its views read the same before and after. Save screenshots to `observe-10/`.
- [ ] **Step 4: Commit** `feat(ui): comment threads with replies and anonymous comments in Discuss`

---

### Task 11: Topic action items

**Files:**
- Create: `components/Discuss/TopicActions.tsx`
- Modify: `components/Discuss/TopicPanel.tsx`, `components/ActionItems/ActionItemRow.tsx`, `components/ActionItems/ActionItemsPanel.tsx`, `components/pages/BoardPage.tsx`

**Interfaces:**
- Consumes: `useBoardStore` (`board`, `actionItems`, `participants`, `cards`, `updateActionItem`, `deleteActionItem`), `useDiscussStore` (`createTopicAction`, `assignActionItem`), `actionItemsForTopic`, `topicHeading`, `buildAgenda`, `commentsWritable`.
- Produces:
  - `<TopicActions rootId: string cardIds: string[] />` mounted in `TopicPanel` under the thread, heading `Action items`.
  - `ActionItemRow` gains optional `assigneeMode?: 'name' | 'participant'` (default `'name'`), `onAssign?: (itemId: string, participantId: string | null) => void` and `topicLabel?: string | null`. In `'name'` mode, with no `topicLabel`, it renders exactly as today.
  - `ActionItemsPanel` gains optional `assigneeMode`, `onAssign` and `topicLabelFor?: (cardId: string) => string | null`, passed through to every row. `BoardPage` passes them only on a guided board (`assigneeMode="participant"`, `onAssign` from `assignActionItem`, `topicLabelFor` built from the agenda); on an open board it passes nothing, so the panel renders exactly as today.

Behaviour:
- `TopicActions` lists `actionItemsForTopic(actionItems, cardIds)` with `ActionItemRow` in `'participant'` mode (no topic label inside a topic). Empty: `No action items for this topic yet.`
- While `commentsWritable(board)` (Discuss, not completed) it shows a form: an input `aria-label="New action item"`, placeholder `Add an action item for this topic`; a select `aria-label="Owner"` with first option `No owner` and then every participant by `display_name` (value the participant id); an `Add` button, disabled while the trimmed text is empty or a create is in flight. Enter or `Add` creates through `createTopicAction({ cardId: rootId, description, assigneeParticipantId })`; on success the input clears and the owner returns to `No owner`; on failure the text stays and the message shows under the form. Blur does nothing. The form closes its pending state when the phase changes (`editorStillOpen`).
- `ActionItemRow` in `'participant'` mode: the owner select's options are `Unassigned` (value `''`) and every participant (value the id); the selected value is `item.assignee_participant_id`, or, when the item has a free-text `assignee` and no participant id, an extra first option showing that text (value `__text__`, not selectable again once changed). Choosing calls `onAssign(item.id, id or null)`. With a `topicLabel`, a line `Topic: {topicLabel}` (truncated to one line) shows under the description.
- The board-level action items list keeps working on both kinds of board: on a guided board it shows every item, topic-linked or not, with the owner picked by participant and the topic label for linked items; its add box still creates an unlinked item.
- People without accounts appear in the owner list like everyone else (participants are board members by display name).

- [ ] **Step 1: Build `TopicActions`, extend `ActionItemRow` and `ActionItemsPanel`, mount and wire.**
- [ ] **Step 2: Run** `npx tsc --noEmit && npm test && npx eslint <the changed files>`. Expected: clean.
- [ ] **Step 3: Observe in a browser** with two profiles on a guided dev board in Discuss, at 1280px, 390px and 360px, light and dark: B adds `Write the runbook` with owner A inside topic 1; A sees it in the topic and in the Actions panel (desktop panel and phone sheet) with A's name and `Topic: {heading}` in the panel; A changes the owner to `Unassigned` in the panel and B sees the change without a reload; the topic shows only its own items when moving to topic 2; the add form does not show in Done; on a phone at 360px the input, owner select and `Add` fit without horizontal scroll. An open board's Actions panel (add, assign by name, due date, status, delete) looks and behaves the same before and after; record the readings. Save screenshots to `observe-11/`.
- [ ] **Step 4: Commit** `feat(ui): action items inside a topic with an owner from the board`

---

### Task 12: Two-browser end-to-end run and verification

**Files:**
- Create: `e2e/guided-discuss.spec.ts`
- Modify: `e2e/helpers.ts`

**Interfaces:**
- Consumes: everything above; existing helpers (`createBoard`, `apiJoin`, `joinAs`, `capture`, `hasJsonField`, `hasJsonNumber`, `waitForRealtime`, `apiAddCard`, `apiMovePhase`, `apiVote`, `apiCombine`, `patchSettings`, `getBoard`, `setFlagDirect`, `voteRowsDirect`, `shown`).
- Produces (`e2e/helpers.ts`):
  - `apiAddColumn(request: APIRequestContext, boardId: string, column: { id: string; title: string; position: number })` (POST the columns route with `description: null`, `color: '#cccccc'`), returning the raw response.
  - `apiSetTopic(request, boardId, cardId)`, `apiComment(request, boardId, body: Record<string, unknown>)`, `apiEditComment(request, boardId, commentId, body: string)`, `apiDeleteComment(request, boardId, commentId)`, `apiActionItem(request, boardId, body: Record<string, unknown>)`, `apiPatchActionItem(request, boardId, itemId, updates: Record<string, unknown>)`, each returning the raw response.
  - `commentRowsDirect(boardId: string)` (`id, card_id, parent_id, author_participant_id, is_anonymous, body, deleted_at`, ordered by `created_at, id`) and `actionRowsDirect(boardId: string)` (`id, card_id, assignee_participant_id, assignee`, ordered by `created_at`): read-only SELECTs with the same two dev-only guards as `voteRowsDirect`.

Every statement this plan adds runs for real below: guided add and remove (Test 1), the group-aware limit guard (Test 1), the move with topic and the set-topic (Tests 2, 3), complete with the topic cleared (Test 6), comment create, edit and delete including tombstone and orphan removal (Tests 4, 5), the guided GET with comments (Tests 2, 5, 6), guided action item create and patch (Test 7).

- [ ] **Step 1: Write the spec.** `beforeAll` calls `setFlagDirect('guided_mode', true)`. Each test builds its own guided board with A (facilitator, from `createBoard(..., { mode: 'guided', displayName })`) and B (joined), adds cards in Reflect through `apiAddCard`, and moves phases with `apiMovePhase` unless the UI is under test.

```ts
test('votes left on a card that was grouped later count toward the group and can be taken back', async ({ browser }) => {
  // Per card 3. Vote: B adds 2 on X. Back to Group; apiCombine(X -> Y); Vote again.
  // B's stepper on Y reads 2. apiVote(B, Y, 'add') is 200; again is 422 'You can put at most 3 votes on one card'.
  // voteRowsDirect: B has Y:1, X:2. patchSettings(A, { max_votes_per_card: 2 }) is 409
  // 'Votes per card cannot go below what someone already has on one card.'
  // apiVote(B, Y, 'remove') answers cardId Y (Y's row goes); the next answers cardId X with count 1; the next cardId X count 0;
  // the next is 409 'You have no vote on this card'. voteRowsDirect: no rows for B (Review Focus 1).
});

test('entering Discuss stores the first agenda item, the same order every browser shows', async ({ browser }) => {
  // Two columns (apiAddColumn). Cards in creation order: p, q (column 2), r, s, t. Vote: A puts 1 on p and 1 on q (a tie),
  // B puts 2 on r, nobody votes s or t. Group: s combined into r before voting.
  // Move to Discuss: getBoard phase_config.topic is r (score 2). Both pages' [data-testid="agenda-item"] texts in order:
  // r (with '2 cards'), p, q, t: p before q because p was created first. Back to Vote: topic is null in getBoard.
  // Discuss again: topic is r again (Review Focus 2).
});

test('everyone follows the facilitator; a participant can look elsewhere and come back', async ({ browser }) => {
  // Discuss with four topics. A presses 'Next topic': B's topic panel shows topic 2 without a reload.
  // B clicks agenda item 4: B sees 'You are looking at another topic.'. A presses 'Next topic' (topic 3): B still shows 4.
  // B presses 'Back to current topic': B shows topic 3 and the bar is gone.
  // apiSetTopic(B, ...) is 403 'Facilitator access required'; apiSetTopic(A, child card) is 404 'That topic is not on the agenda';
  // in Vote apiSetTopic(A, ...) is 409 'Not available during Vote' (Review Focus 6).
});

test('comments: replies, edits, deletes and the rules that guard them', async ({ browser }) => {
  // Discuss. B comments through the UI; A replies through the UI; B edits with Enter (one PATCH counted from capture).
  // API refusals: body '' is 400 'Write a comment first'; 1001 'x' is 400 'Comments can be at most 1000 characters';
  // a reply to the reply is 409 'You can only reply to a comment that starts a thread';
  // a top-level comment on a grouped child card is 409 'Comments go on a topic, not on a card inside it';
  // A editing B's comment is 403 'Only the author can edit this comment'; A deleting B's comment (it has a reply) is 200 with a tombstone.
  // Both pages show 'This comment was deleted.' with the reply under it; commentRowsDirect: that row has body '' and deleted_at set.
  // B deletes the reply: commentRowsDirect is empty; both pages show 'No comments yet. Start the discussion.'
  // A moves to Vote: apiComment(B, ...) is 409 'Not available during Vote' (Review Focus 5).
});

test('an anonymous comment never reveals its author, not even to the facilitator', async ({ browser }) => {
  // capture() on A's page from the first request. B posts anonymously the body ANON-<rand> through the UI.
  // Controls: ANON-<rand> appears in A's capture (frames and, after A reloads, the GET body);
  // hasJsonField(capA, 'display_name', bName) is true (the matcher fires on B's name in the participants list).
  // Absence: hasJsonField(capA, 'author_participant_id', bId) and hasJsonField(capA, 'author_name', bName) are false.
  // B's page shows 'You (anonymous)'; A's shows 'Anonymous'.
  // Then B posts a named comment: hasJsonField(capA, 'author_name', bName) becomes true within 10s (the absence was real)
  // (Review Focus 3).
});

test('a completed retro shows its comments read-only and an outsider gets nothing', async ({ browser, playwright, baseURL }) => {
  // Discuss, one comment and one reply. A completes the retro: getBoard phase_config.topic is null.
  // B's page shows both comments, the heading 'Topics', no composer, no Reply, Edit or Delete.
  // A stranger request context (no cookie, not signed in): the GET's board keys are exactly
  // ['archived_at', 'id', 'title', 'trust_version'] and the JSON has no 'comments' key; the raw body has no comment text.
  // Control: B's GET body contains the comment text.
});

test('action items link to a topic, take an owner, and outlive their card and owner', async ({ browser }) => {
  // Discuss. B adds 'Write the runbook' with owner C (a third participant) inside topic 1 through the UI.
  // actionRowsDirect: card_id = topic 1's root, assignee_participant_id = C, assignee = C's name. A sees it in the topic and the panel.
  // apiActionItem(B, { description, cardId: topic1, assigneeParticipantId: <a participant of another board> }) is 404
  // 'That person is not on this board'; with a grouped child card id is 404 'That topic is not on the agenda'.
  // A removes C from the board: the row keeps assignee = C's name, assignee_participant_id is null.
  // A deletes the second column (holding topic 1's card): the row keeps card_id null and still exists.
  // In Vote, apiActionItem(B, { description, cardId }) is 409 'Not available during Vote' (Review Focus 7).
});

test("an open board's action items, board GET and views are unchanged", async ({ browser }) => {
  // Open board. apiActionItem(A, { description: 'X', cardId: <card>, assigneeParticipantId: <B> }) is 200 and
  // actionRowsDirect shows card_id null and assignee_participant_id null (ignored, as today).
  // apiPatchActionItem(A, id, { status: 'done' }) is 200 with { item }. getBoard has no 'comments' key and
  // board.phase_config equals { deadline: null }. apiComment(A, ...) is 409 'This board is not in guided mode';
  // apiSetTopic(A, ...) is 409 the same. The page shows no [data-testid="discuss-view"], no agenda and no 'Discussion' heading
  // (Review Focus 8).
});

test('the phone agenda sheet is fully on screen', async ({ browser }) => {
  // Guided board in Discuss, B's page at 390x844 and again at 360x780. Open 'Agenda': the sheet's dialog bounding box lies inside
  // the viewport (top >= 0, bottom <= viewport height, left >= 0, right <= viewport width) and its overlay covers the viewport.
});
```

- [ ] **Step 2: Run** `npx playwright test e2e/guided-discuss.spec.ts`. Expected: 9 passed. Fix the product, not the test; a failure that needs a design change stops the task and goes back to the controller.
- [ ] **Step 3: Show the guards can fail.** (a) Temporarily make `shapeComment` keep `author_participant_id` for anonymous comments, run the anonymous test, see it FAIL on the absence assertion, revert. (b) Temporarily change the move statement's tie-break to `c.id COLLATE "C" DESC`, run the agenda test, see it FAIL, revert. (c) Temporarily give the phone `Agenda` sheet a `top-[-200px]` offset, run the sheet test, see it FAIL, revert. Report the three failures; `git status` shows a clean tree afterwards.
- [ ] **Step 4: Run the full suites.**

Run: `npx tsc --noEmit && npm test && npm run test:e2e`
Expected: `tsc` clean; every unit test passes (927 in 61 files before this plan plus the new ones; report the count and the file count); e2e 103 passed (94 plus 9), 0 failed, 1 skipped, including `e2e/action-items-authz.spec.ts`, `e2e/completed-board-access.spec.ts`, `e2e/guided-group-vote.spec.ts` and `e2e/guided-mode.spec.ts` unchanged. Report the three counts.

- [ ] **Step 5: Stop the dev server by its PID, confirm `lsof -ti tcp:3001` prints nothing, then run** `npm run build`. Expected: build passes. Restore `next-env.d.ts` if it changed.
- [ ] **Step 6: Commit** `test(e2e): discuss across two browsers` (stage `e2e/guided-discuss.spec.ts` and `e2e/helpers.ts` by name).
- [ ] **Step 7: Hand back to the controller.** The controller, not the implementer, pushes `feature/guided-discuss` and opens a PR (base per the Global Constraints) titled `Discuss (Parabol parity Step 3)`. The description lists: migration 017 (dev applied, production not; production needs 015 and 016 first), the known open-payload difference for action items, the test counts, what was seen in the browser at each width and theme, the design questions and their answers, and the "Out of this plan" list. It stays unmerged for Jordan.

---

## Out of this plan

- Facilitator reordering of the agenda: owner's decision (Parabol allows it; the agenda here is derived and needs a stored order to support it).
- Reactions on comments: Step 11. Mentions: not building (spec). Typing indicators: Step 11, only after the Ably plan's limits are checked. Polls in threads: not building (spec "Not building").
- An AI discussion question per multi-card topic and AI-suggested action items: Step 5 (an `AgendaItem` with more than one `cardIds` entry is a multi-card topic).
- The summary page, email and PDF: Step 4. It can reuse `buildAgenda` (pure, runs on the server too), `threadsFor`, the tombstone rule and `actionItemsForTopic`.
- Pushing action items to trackers: Step 8. An action tracker across boards and "my actions" from `assignee_participant_id`: Step 6.
- Re-linking an existing action item to a different topic: owner's decision.
- Comments, topics and owner-by-participant on open boards: owner's decision (open boards ignore the new fields).
- Replies deeper than one level: not building.
- A per-topic timer: owner's decision (the stored phase timer still works in Discuss).
- Blocking column deletion on guided boards in Discuss (`column.write` is not phase-gated, so a facilitator can delete a column, its cards, their comments and votes mid-discussion): hardening list, before the flag goes on.
- Group-aware "voted" state on the single vote button of a guided board whose per-card limit is 1 (the stepper is group-aware; the pill's `hasVoted` still reads the card's own row in five views): hardening list; reachable only with a stranded vote and a limit of 1.
- Shaping or whitelisting action item events (they publish raw rows today, which carry nothing withheld): hardening list.
- Removing the unused `highlighted_card_id` setting: owner's decision. Guided boards ignore it; nothing renders it today.
- Admin archive and unarchive made phase- and topic-aware (Step 1 ruling R15) and the `fetchBoard` stale-board guard (Step 2 ruling R17): unchanged, still on the "before the flag goes on" list. The vote completion race (Step 2 ruling R19) is closed by Task 1's `FOR SHARE`.
- Showing who is looking at which topic (presence per topic): later, if asked.
- Applying 015, 016 and 017 to production: the promotion.

## Design questions for the controller

Each was decided as recommended and the plan is written that way. Controller (2026-11-20): all twenty accepted as recommended, with two additions written into the tasks: the guided vote statements also read the board row `FOR SHARE` (Task 1, closing Step 2 ruling R19), and comment textareas carry `enterKeyHint="send"` (Task 10). Questions 1 and 19 (Discuss replaces the board views in Discuss and Done) and question 6 (a facilitator's click moves everyone) are listed for Jordan in the PR.

1. **Discuss replaces the four board views on a guided board in Discuss and Done.** Recommendation: one Discuss view (agenda plus topic panel) on desktop and phone, the view toggle hidden while it shows. It makes "every view agrees on the agenda order and the current topic" true by construction and keeps the cards (with reactions) inside the topic. Alternative: keep grid, list, swimlane and timeline in Discuss and add rank badges and a current-topic marker to each, plus the phone list (five surfaces, each needing the group-score sort). Cost if wrong: a facilitator who wants the column layout during Discuss has to step back to Vote; switching to the alternative later reuses `buildAgenda` and adds the five markers.
2. **Comments travel inside the guided board GET, only in Discuss and Done, with a soft cap of 500 per board.** Recommendation: as written (reasons and sizes in Task 7). Alternative: a `GET /comments` route fetched on entering Discuss and on every reconnect, with its own coalescing and stale-board guard. Cost if wrong: about 60 KB more on each Discuss refetch for a heavy retro; moving to a route later touches only the GET, `fetchBoard` and the store. The cap: alternative is no cap (rate limit only); cost of the cap: a real 500-comment retro would be refused at comment 501.
3. **Comment and topic-action writes lock the board row `FOR SHARE` instead of taking the vote advisory lock.** Recommendation: as written; it closes both the phase-move race and the completion race (which Step 2 left open for votes, R19) without coupling comments to votes. Alternative: take `voteLockKey` in a transaction and also add it to the complete path (shared open code). Cost if wrong: if `FOR SHARE` in a CTE behaved differently than expected, a comment could land just after a move; Task 12's real runs and the controller's EXPLAIN check the statements, but the race itself is not reproduced by a test.
4. **Completion clears the topic and reopen leaves it null; clients fall back to the first agenda item.** Recommendation: as written. The neon tagged template cannot share the agenda SQL fragment, duplicating it in the reopen statement would put the ordering in two statements, and reopen needs a signed-in owner so e2e could never run that copy. Alternative: copy the ordering subquery into the guided reopen statement and test it by unit only. Cost if wrong: after a reopen, until the facilitator first moves, each client computes the first item itself; they agree because Discuss freezes cards and votes.
5. **A stored topic whose card is gone falls back to the first agenda item** (`currentTopicId`). Alternative: show no current topic until the facilitator picks one. Cost if wrong: after a column deletion everyone jumps to topic 1.
6. **A facilitator's click on an agenda item makes it current for everyone; participants' clicks move only their own view.** Matches Parabol. Alternative: the facilitator also browses privately and uses `Discuss this topic`. Cost if wrong: a facilitator peeking ahead moves the room.
7. **`topic.set`, `comment.*` and `action-item.link` are gated on `canComment`** (the Discuss flag), with no new `PhaseProfile` field. Alternative: add `hasAgenda` to every phase profile. Cost if wrong: a later phase that allows comments without an agenda would need the split.
8. **Comments store an `author_name` snapshot** (not in the spec's column list), like cards do, set from the participant row inside the insert; it is stored for anonymous comments too and never returned for them. Alternative: no name column, join `participants` at read time and show `Former participant` after a removal. Cost if wrong: one more column holding a name the privacy page must mention (it already says author ids stay in the database).
9. **Comments are not optimistic** (the composer waits for the server); topic changes and owner changes are. Alternative: optimistic comments with client ids. Cost if wrong: a slow network shows a short wait after pressing Enter.
10. **The anonymous checkbox starts checked when the board's `anonymous_cards` setting is on.** Alternative: always unchecked. Cost if wrong: one default.
11. **Enter posts a comment, Shift+Enter adds a line break, blur never saves.** Alternative: Enter adds a line and only the button posts. Cost if wrong: a habit mismatch for people who write long comments.
12. **Deleting the last reply under a deleted comment also removes the deleted comment.** Alternative: keep empty tombstones. Cost if wrong: none for data; one fewer "This comment was deleted." line.
13. **Comments cascade with their card** (a column deleted mid-Discuss removes its topics' comments). Alternative: `SET NULL` and keep orphan comments for the summary. Cost if wrong: discussion text lost with a deleted column; votes already behave this way.
14. **On a guided board every action item POST and PATCH runs the guided statement; the owner's display name is copied into `assignee`; editing the free-text assignee clears the participant link.** Alternative: keep the open statements for guided requests that carry no new field, and resolve the owner's name at read time. Cost if wrong: the free-text and participant forms of one owner could disagree in the alternative; in this plan a renamed participant (names do not change today) would keep the old name in `assignee`.
15. **Open boards ignore `cardId`, `assigneeParticipantId` and `assignee_participant_id`** (as they ignore every unknown field today) rather than answering 409. Keeps every open-board response identical (D1). Alternative: 409 `This board is not in guided mode`, as Step 2 ruling R18 accepted for votes. Cost if wrong: a crafted open-board request silently drops the fields.
16. **Linking to a topic is Discuss-only; picking an owner from the list works in every phase of a guided board.** Alternative: owner picking also Discuss-only. Cost if wrong: none found.
17. **A vote burst that touched a row other than the clicked card's ends with one coalesced refetch instead of settling.** Only stranded votes reach it. Alternative: settle each answer on its own row. Cost if wrong: one extra GET after removing a stranded vote.
18. **`RetroCard` is reused inside the topic panel** (with merging off), so reactions, colour and author show as on the board. Alternative: a lighter read-only topic card. Cost if wrong: RetroCard props grow if Discuss needs something card-specific later.
19. **In Done the Discuss view stays (read-only, heading `Topics`, no current topic).** This is where "readable in Done" is met until Step 4's summary exists. Alternative: Done shows the normal board views and comments only in the summary. Cost if wrong: Step 4 may replace this view.
20. **Rate limit `comment`: 300 requests per 60 seconds per address.** Teams behind one office address share it. Alternative: 60 (too tight for 10 people in one office). Cost if wrong: a very busy shared-address team could hit 429.

### Findings about D1 to D10 (nothing is unworkable)

- D5 says `highlighted_card_id` "exists today". It is stored and validated (`lib/board-validation.ts:138`, `types/index.ts:64`, `utils/constants.ts:11`) but no component reads it (`grep -rn highlight components stores hooks` finds nothing), so there is no behaviour to adapt. Guided boards ignore it; open boards are untouched.
- D1 and D2 hide a trap: adding `topic` to `DEFAULT_PHASE_CONFIG` (`lib/constants/phases.ts:103`) would change every open-board GET, because `lib/board-actor.ts:155` merges the default into every board and the GET returns it (`app/api/boards/[boardId]/route.ts:74-77`; pinned by `get-guided-fields.test.ts:61`). The plan makes `topic` optional.
- D9 asks that events go only through the shaped publish helpers. The action item events this plan reuses publish raw rows today (`app/api/boards/[boardId]/action-items/route.ts:51,88,113`). They carry nothing guided mode withholds, the plan adds no new action item event, and changing them would change open-board events, so they stay; listed under "Out of this plan".
- D8 asks who may create, edit and complete actions today: any joined participant (or a facilitator without a participant row) may create, edit and delete any action item on any board in any phase (`lib/phases.ts:91` `'action-item.write': null`; no ownership check in the PATCH or DELETE). Not unsafe on a guided board; unchanged.
- D5 and D6 need a Discuss-only gate for setting the topic; there is no profile flag for it, so `topic.set` reuses `canComment` (question 7).
- D10's portal rule has nothing to apply to: no Discuss control opens from the sticky header. The phone agenda uses `MobileSheet`, which already traps focus and is not inside the header.
