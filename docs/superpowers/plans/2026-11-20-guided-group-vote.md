# Group and Vote Parity (Parabol parity Step 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a guided board, people can put several votes on one card within a per-card and a per-person limit, see how many votes the team has left, name a group on its lead card, and the facilitator can reset grouping. Open boards stay exactly as they are.

**Architecture:** Migration 016 adds `votes.count` and `cards.group_title`. Limits and vocabulary live in `lib/constants/board-settings.ts`, `lib/constants/votes.ts` and `lib/constants/groups.ts`; all arithmetic and decisions live in the pure modules `lib/votes.ts` and `lib/groups.ts`. Every server path that names a new column is chosen in TypeScript from `loaded.board.mode === GUIDED_MODE`, so the open path's statements are textually unchanged (pinned by inline snapshots recorded before each route changes). Guided votes go through the existing vote route with an `action` of `add` or `remove`, in one transaction under a per-board advisory lock, and return the team's total votes used; the same aggregate is published as a `vote-tally` event. Group titles and reset go through a new `/groups` route with two new board actions gated on the Group phase. Clients keep the tally beside the board, derive "votes left" from it, and refetch through the coalesced runner after a reset.

**Tech Stack:** Next.js 16 route handlers, `@neondatabase/serverless`, Ably (REST publish), Zustand 5, Vitest (node), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-parabol-parity-design.md` (sections "Group and vote", "Design decisions" ("Groups keep the existing shape", "Votes keep the UNIQUE constraint and gain a count"), "Step 2: group and vote parity", "Decisions (Jordan, 2026-11-16)"). Step 1 plan: `docs/superpowers/plans/2026-11-18-guided-mode-core.md`.

## Design questions, answered by the controller (2026-11-20)

Both are accepted as recommended. They are listed in the PR description for Jordan.

1. **Open boards' payloads gain two constant keys once 016 is applied.** The board GET reads `SELECT * FROM votes` and `SELECT * FROM cards`, the toggle returns `RETURNING *`, and the card routes return and publish `RETURNING *` rows. No statement text changes, but on a database with 016 every open-board vote row carries `count: 1` and every card row `group_title: null`, in HTTP responses and Ably payloads. Recommendation: accept. The keys are additive and constant on open boards, no client reads them there, and Step 1 already added `mode`, `phase` and `phase_config` to every board GET. The alternative is to strip both keys in `shapeCard` and `shapeVotes` when the board is open (adds `mode` to `ViewBoard` and one step to Task 3). This plan is written for "accept".
2. **The team total reveals a two-person team's spending.** With two participants, "team votes left" minus your own spending tells you how many votes the other person has placed (never where). Recommendation: accept. Any team-wide count has this property and Parabol shows the same number; per-card totals and voter identities stay secret.

## Global Constraints

- Work in `/Users/jordan.lawson/Projects/retro-board/.worktrees/guided-mode-core` on branch `feature/guided-group-vote`. Do not switch branches. The PR targets `feature/guided-mode-hardening` until the Step 1 PRs merge. Never push to `develop` or `main`.
- Commits: never `git commit -a` or `-am`; stage files by name. Every commit message ends with a blank line and then the line `Claude-Session: <the session URL the controller supplies at dispatch>`.
- Migration: `scripts/migrations/016_group_and_vote.sql`, additive, guarded, re-runnable, one transaction, in the style of 012 to 015. Applied to the Neon `dev` branch only in this plan. Production has migrations up to 014; applying 015 and 016 there belongs to a later promotion.
- No statement on a path an open board takes may name `votes.count` or `cards.group_title`. A guided branch is chosen in TypeScript and only it names new columns. Open-board statements in files this plan modifies are pinned by inline snapshots recorded before the file changes.
- All development and tests use the Neon `dev` branch and the Ably app `retro-board-dev` (`NEON_BRANCH=dev`). Dev server port 3001. `lib/db.ts` and `lib/auth.ts` stay lazy; import `ably-server` inside functions.
- Every board write goes through `loadBoardActor` + `checkAction`. Every read and Ably payload goes through `lib/board-view.ts` or a whitelisting payload builder in `lib/board-publish.ts`. Never return or publish raw rows of other people's votes.
- A write costs two database round-trips: the actor load and one statement (a `sqlTransaction` batch counts as one). Every refusal this plan adds is decided from columns that one statement returns; no new follow-up queries.
- Guard status codes: 401 no participant session, 403 identified but not allowed, 409 board state or phase forbids it, 422 a vote limit, 400 a malformed body.
- The minimal no-access board GET payload keeps exactly four board keys (`archived_at`, `id`, `title`, `trust_version`) and no other top-level additions; `e2e/completed-board-access.spec.ts` pins it. Never add fields to it.
- Everything in this plan exists only on guided boards, which are behind the existing `guided_mode` flag. No new flag.
- Vocabulary, limits, labels and server messages are declared once and imported. Components and routes do not spell out phase names, mode names, limits or the 80-character title length.
- Store write actions reject on failure through `failWrite` (the message reaches `lastWriteError` and the connection banner); UI handlers catch the rejection.
- A response applied after an awaited request checks it still applies: same board id, and (for votes) no newer result for that card.
- Every refetch guided mode triggers goes through `refetchBoardCoalesced`, never a direct `fetchBoard`.
- No hook mounted in `BoardPage` updates React state on a timer; this plan adds no timers.
- A dialog built on `components/common/Modal.tsx` uses `useFocusTrap` itself. A form or dialog opened in one phase closes and cannot act once the phase changes.
- Unit tests run in Vitest's node environment; hooks and components cannot be rendered, so decisions live in tested pure functions and components stay thin. No new dependencies, no DOM test environment.
- `npm run lint` is broken on Next 16: run `npx eslint <the files you changed>`.
- Run one e2e spec with `npx playwright test e2e/<file>`; the `npm run test:e2e -- <pattern>` form runs everything.
- A dev server started for observation: check port 3001 first (`lsof -ti tcp:3001` must print nothing), start it with `npm run dev -- -p 3001 &`, note the PID, stop it with `kill <PID>`. Never kill by name. Never run `npm run build` while it runs.
- A UI task is done only after it was seen in a real browser at 1280px, 390px and 360px, in light and dark themes, with an open board checked for no visual change. If the dev server cannot run, say so; do not claim success.
- Every e2e absence assertion is paired with a control that proves the capture holds real traffic and the matcher fires on real data.
- UI copy is plain words with no em dashes. Every user-facing string in this plan is exact.
- Parabol is AGPL: copy behaviour only, no code or copy text.
- Baselines at the start: `npx tsc --noEmit` clean; `npm test` 733 passing in 53 files; `npm run test:e2e` 85 passed, 0 failed, 1 skipped.

## Review Focus

1. Two tabs of the same person press Add on one card eight times at once (per-card 3, per-person 5). Expected: exactly three land, the rest get 422 `You can put at most 3 votes on one card`; spreading clicks over three cards never passes 5 in total. (Tests in Task 4 for the statement and lock; Task 11 with parallel requests.)
2. A person at a limit tries again. Expected: the Add button is disabled with the reason as its title, and a request that slips through gets the matching 422 and leaves their count unchanged. (Task 1 `voteControlState`, Task 4, Task 7, Task 9 observation.)
3. The facilitator lowers a limit below what someone has spent. Expected: 409 with `Votes per person cannot go below 4. Someone has already used 4.` (or the per-card message), settings unchanged, nothing published. (Task 5, Task 11.)
4. During Vote, a participant inspects every HTTP body and websocket frame. Expected: no other person's vote row, voter id or count; only the aggregate `used`. After Vote ends, the counts arrive. (Task 3, Task 4, Task 11.)
5. Cards are grouped, ungrouped, regrouped and reset after votes exist. Expected: every vote row and count is unchanged throughout, and a group's score is the sum of its lead and children. (Task 1 `groupScore`, Task 6 reset statement, Task 11.)
6. An open board after this ships. Expected: the toggle request and response are unchanged, `action` on its vote route is 409 `This board is not in guided mode`, its statements are byte-identical, and no stepper, title or reset control appears. (Tasks 4, 5, 6, 9, 10, 11.)
7. The facilitator resets grouping while someone is mid-drag or mid-title-edit. Expected: every client converges to the reset board after one coalesced refetch; a drop that reaches the server after the reset groups only the two cards in that drop; an open title form closes when the phase moves on. (Task 6, Task 7, Task 10, Task 11.)

---

## File structure

| File | Responsibility |
|---|---|
| `lib/constants/board-settings.ts` (modify) | `MAX_VOTES_PER_CARD_RANGE`, `GUIDED_MAX_VOTES_PER_CARD`, `OPEN_MAX_VOTES_PER_CARD` |
| `lib/constants/votes.ts` (new) | `VOTE_ACTIONS` |
| `lib/constants/groups.ts` (new) | `GROUP_TITLE_MAX`, `GROUP_ACTIONS` |
| `lib/constants/phases.ts` (modify) | `NOT_GUIDED_ERROR`, `PHASE_CHANGED_ERROR` (moved from the phase route) |
| `lib/votes.ts` (new) | Pure vote arithmetic, control state, optimistic deltas, tally, limit checks and messages |
| `lib/groups.ts` (new) | Pure lead-card test, visible title, title validation, ungroup |
| `types/index.ts`, `lib/board-validation.ts` (modify) | `Vote.count`, `Card.group_title`, `BoardSettings.max_votes_per_card` and its check |
| `scripts/migrations/016_group_and_vote.sql` (new) | `votes.count`, `cards.group_title`, their CHECKs |
| `lib/constants/board-actions.ts`, `lib/phases.ts`, `lib/board-guards.ts` (modify) | `group.title`, `group.reset` actions, phase gates and identity rules |
| `lib/board-view.ts`, `lib/board-publish.ts` (modify) | Hidden text also hides the group title; `vote-tally` payload and publish |
| `app/api/boards/[boardId]/votes/route.ts` (modify) | Guided add and remove |
| `app/api/boards/route.ts`, `app/api/boards/[boardId]/route.ts` (modify) | Guided default per-card limit; limit guard on settings PATCH; `voteTally` on the guided GET |
| `app/api/boards/[boardId]/groups/route.ts` (new) | Set a group title; reset grouping |
| `app/api/boards/[boardId]/phase/route.ts` (modify) | Imports the two moved messages; no behaviour change |
| `stores/groupVoteStore.ts` (new), `stores/boardStore.ts`, `hooks/useBoardChannel.ts` (modify) | Guided vote, title and reset actions; `voteTally` state; `vote-tally` and `grouping-reset` events |
| `hooks/useTeamVotesLeft.ts` (new) | The team's votes left, or null |
| `components/Board/GuidedVoteControl.tsx`, `TeamVotesLeft.tsx`, `VoteLimits.tsx`, `GroupTitle.tsx`, `ResetGrouping.tsx`, `ResetGroupingDialog.tsx` (new) | Guided vote and group UI; each reads the stores itself |
| `components/Board/RetroCard.tsx`, `BoardColumn.tsx`, `MobileBoardShell.tsx`, `MobileVoteTracker.tsx`, `SwimlaneView.tsx`, `ListView.tsx`, `TimelineView.tsx`, `MobileMoreSheet.tsx`, `components/pages/BoardPage.tsx`, `utils/export.ts` (modify) | Count votes by weight; mount points |
| `e2e/guided-group-vote.spec.ts` (new), `e2e/helpers.ts`, `e2e/guided-mode.spec.ts` (modify) | Two-browser run of everything above |

---

### Task 1: Vocabulary, types and pure vote and group logic

**Files:**
- Modify: `lib/constants/board-settings.ts`, `lib/constants/phases.ts`, `app/api/boards/[boardId]/phase/route.ts`, `types/index.ts`, `lib/board-validation.ts`
- Create: `lib/constants/votes.ts`, `lib/constants/groups.ts`, `lib/votes.ts`, `lib/groups.ts`
- Test: `lib/__tests__/votes.test.ts`, `lib/__tests__/groups.test.ts`, `lib/board-validation-settings.test.ts`

**Interfaces:**
- Consumes: `PHASES`, `GUIDED_MODE`, `BoardMode`, `PhaseId` (`lib/constants/phases.ts`); `MAX_VOTES_PER_PARTICIPANT_RANGE`; `Board`, `BoardSettings`, `Card`, `Vote`; `DEFAULT_BOARD_SETTINGS`.
- Produces (`lib/constants/board-settings.ts`): `MAX_VOTES_PER_CARD_RANGE = { min: 1, max: 12 } as const`, `GUIDED_MAX_VOTES_PER_CARD = 3`, `OPEN_MAX_VOTES_PER_CARD = 1`.
- Produces (`lib/constants/votes.ts`): `VOTE_ACTIONS = ['add', 'remove'] as const`, `type VoteAction`, `isVoteAction(v: unknown): v is VoteAction`.
- Produces (`lib/constants/groups.ts`): `GROUP_TITLE_MAX = 80`, `GROUP_ACTIONS = ['set-title', 'reset'] as const`, `type GroupAction`, `isGroupAction(v: unknown): v is GroupAction`.
- Produces (`lib/constants/phases.ts`): `NOT_GUIDED_ERROR = 'This board is not in guided mode'`, `PHASE_CHANGED_ERROR = 'The phase already changed'`. The phase route imports both in place of its literal and its local `PHASE_CHANGED` constant.
- Produces (`types/index.ts`): `Vote.count?: number` (absent on a database without 016), `Card.group_title?: string | null`, `BoardSettings.max_votes_per_card?: number` (absent on open boards, read as 1).
- Produces (`lib/board-validation.ts`): `SETTING_CHECKS` typed `{ [K in keyof BoardSettings]-?: (v: unknown) => boolean }` (the `-?` keeps an optional key from being silently unchecked) with `max_votes_per_card`: an integer in `MAX_VOTES_PER_CARD_RANGE`.
- Produces (`lib/votes.ts`):
  - `voteWeight(v: { count?: number }): number`
  - `voteTotalsByCard(votes: readonly Vote[]): Map<string, number>`
  - `votesUsedBy(votes: readonly Vote[], participantId: string | null): number`
  - `myVotesOn(votes: readonly Vote[], cardId: string, participantId: string | null): number`
  - `sumVoteCounts(votes: readonly { count?: number }[]): number`
  - `groupScore(cardId: string, cards: readonly Pick<Card, 'id' | 'merged_with'>[], totals: ReadonlyMap<string, number>): number`
  - `maxVotesPerCard(settings: Pick<BoardSettings, 'max_votes_per_card'>): number`
  - `guidedVoteDefaults(settings: Record<string, unknown>): { max_votes_per_card: number }`
  - `voteControlKind(mode: BoardMode, settings: Pick<BoardSettings, 'max_votes_per_card'>): 'toggle' | 'stepper'`
  - `interface VoteControlInput { onCard: number; spent: number; perCard: number; perPerson: number; childCard: boolean }`
  - `voteControlState(i: VoteControlInput): { canAdd: boolean; canRemove: boolean; addBlockedReason: string | null }`
  - `GROUP_VOTE_ERROR = 'Votes go on the group, not on a card inside it'`, `NO_VOTES_LEFT = 'No votes left'`
  - `applyVoteDelta(votes: readonly Vote[], d: { boardId: string; cardId: string; voterId: string; voteId: string; delta: 1 | -1; nowIso: string }): Vote[]`
  - `settleOwnVote(votes: readonly Vote[], s: { cardId: string; voterId: string; vote: Vote | null }): Vote[]`
  - `interface VoteTally { used: number; at: number }`
  - `applyVoteTally(current: VoteTally | null, incoming: unknown): VoteTally | null`
  - `teamVotesRemaining(perPerson: number, participantCount: number, used: number): number`
  - `teamVotesLeftFor(board: Pick<Board, 'mode' | 'phase' | 'settings' | 'archived_at'> | null, participantCount: number, tally: VoteTally | null): number | null`
  - `teamVotesLabel(n: number): string`
  - `votesPerCardError(n: number): string`
  - `VOTE_LIMIT_RELATION_ERROR = 'Votes per card cannot be more than votes per person'`, `CARD_LIMIT_OPEN_ERROR = 'Votes per card is only available on guided boards'`
  - `hasLimitKey(patch: Record<string, unknown>): boolean`
  - `voteLimitProblem(current: BoardSettings, patch: Partial<BoardSettings>): string | null`
  - `limitRefusal(i: { perPerson: number | null; perCard: number | null; maxSpent: number; maxOnCard: number }): string`
  - `voteLimitsEditable(board: Pick<Board, 'mode' | 'phase' | 'archived_at'> | null): boolean`
  - `voteLockKey(boardId: string): string` (returns `` `${boardId}:votes` ``; the one advisory-lock key for a board's guided votes, used by Task 4 and Task 5)
- Produces (`lib/groups.ts`):
  - `isLeadCard(cardId: string, cards: readonly Pick<Card, 'id' | 'merged_with'>[]): boolean` (the card exists, has no parent, and at least one card has `merged_with === cardId`)
  - `visibleGroupTitle(cardId: string, cards: readonly Pick<Card, 'id' | 'merged_with' | 'group_title'>[]): string | null`
  - `validateGroupTitle(v: unknown): { ok: true; value: string | null } | { ok: false; error: string }`
  - `ungroupAll<C extends { merged_with: string | null; group_title?: string | null }>(cards: readonly C[]): C[]`
  - `hasGrouping(cards: readonly Pick<Card, 'merged_with' | 'group_title'>[]): boolean`

Decisions recorded here: a title on a card that stops being a lead card is kept but not shown, and shows again if the card regains children (clearing it would make the open-board card PATCH write a second row and name `group_title`; keeping it dormant also restores the title after an accidental drag-out). Title length is counted in code points, which is what the SQL `char_length` CHECK counts. `voteLimitsEditable` is true while totals are still hidden (Reflect, Group, Vote), since a limit change after voting has no effect.

- [ ] **Step 1: Write the failing tests** in `lib/__tests__/votes.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  voteWeight, voteTotalsByCard, votesUsedBy, myVotesOn, sumVoteCounts, groupScore, maxVotesPerCard,
  guidedVoteDefaults, voteControlKind, voteControlState, applyVoteDelta, settleOwnVote, applyVoteTally,
  teamVotesRemaining, teamVotesLeftFor, teamVotesLabel, votesPerCardError, voteLimitProblem, limitRefusal,
  hasLimitKey, voteLimitsEditable, GROUP_VOTE_ERROR, NO_VOTES_LEFT, VOTE_LIMIT_RELATION_ERROR,
} from '@/lib/votes';
import { phaseSettings } from '@/lib/phases';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import type { Board, Vote } from '@/types';

const v = (o: Partial<Vote> & Pick<Vote, 'card_id' | 'voter_id'>): Vote =>
  ({ id: `${o.card_id}-${o.voter_id}`, board_id: 'b1', created_at: '2026-11-20T00:00:00Z', ...o });
const rows = [
  v({ card_id: 'c1', voter_id: 'p1', count: 3 }),
  v({ card_id: 'c1', voter_id: 'p2' }),
  v({ card_id: 'c2', voter_id: 'p1', count: 1 }),
];

describe('vote arithmetic', () => {
  it('a row without count weighs 1, so open-board numbers are unchanged', () => {
    const open = [v({ card_id: 'c1', voter_id: 'p1' }), v({ card_id: 'c1', voter_id: 'p2' })];
    expect(voteWeight({})).toBe(1);
    expect(voteTotalsByCard(open).get('c1')).toBe(open.filter((x) => x.card_id === 'c1').length);
    expect(votesUsedBy(open, 'p1')).toBe(1);
  });
  it('totals, spending and the board sum add counts', () => {
    expect(voteTotalsByCard(rows).get('c1')).toBe(4);
    expect(votesUsedBy(rows, 'p1')).toBe(4);
    expect(votesUsedBy(rows, null)).toBe(0);
    expect(myVotesOn(rows, 'c1', 'p1')).toBe(3);
    expect(myVotesOn(rows, 'c2', 'p2')).toBe(0);
    expect(sumVoteCounts(rows)).toBe(5);
  });
  it('a group scores its lead plus its children', () => {
    const cards = [{ id: 'c1', merged_with: null }, { id: 'c2', merged_with: 'c1' }, { id: 'c3', merged_with: null }];
    expect(groupScore('c1', cards, voteTotalsByCard(rows))).toBe(5);
    expect(groupScore('c3', cards, voteTotalsByCard(rows))).toBe(0);
  });
});

describe('limits and control state', () => {
  it('an open board reads as 1 per card; guided create takes 3 but never more than per person', () => {
    expect(maxVotesPerCard(DEFAULT_BOARD_SETTINGS)).toBe(1);
    expect(maxVotesPerCard({ max_votes_per_card: 3 })).toBe(3);
    expect(guidedVoteDefaults({ max_votes_per_participant: 5 })).toEqual({ max_votes_per_card: 3 });
    expect(guidedVoteDefaults({ max_votes_per_participant: 2 })).toEqual({ max_votes_per_card: 2 });
    expect(guidedVoteDefaults({ max_votes_per_participant: 'junk' })).toEqual({ max_votes_per_card: 3 });
  });
  it('the stepper shows only on a guided board above 1 per card', () => {
    expect(voteControlKind('open', { max_votes_per_card: 3 })).toBe('toggle');
    expect(voteControlKind('guided', { max_votes_per_card: 1 })).toBe('toggle');
    expect(voteControlKind('guided', {})).toBe('toggle');
    expect(voteControlKind('guided', { max_votes_per_card: 3 })).toBe('stepper');
  });
  it('add is blocked by group, then person, then card, each with its reason', () => {
    const base = { onCard: 1, spent: 2, perCard: 3, perPerson: 5, childCard: false };
    expect(voteControlState(base)).toEqual({ canAdd: true, canRemove: true, addBlockedReason: null });
    expect(voteControlState({ ...base, childCard: true }).addBlockedReason).toBe(GROUP_VOTE_ERROR);
    expect(voteControlState({ ...base, spent: 5 }).addBlockedReason).toBe(NO_VOTES_LEFT);
    expect(voteControlState({ ...base, onCard: 3, spent: 3 })).toEqual({ canAdd: false, canRemove: true, addBlockedReason: 'You can put at most 3 votes on one card' });
    expect(voteControlState({ ...base, onCard: 0 }).canRemove).toBe(false);
  });
  it('per-card message is singular at 1', () => {
    expect(votesPerCardError(1)).toBe('You can put at most 1 vote on one card');
  });
  it('the merged limits must keep per card at or below per person', () => {
    const s = { ...DEFAULT_BOARD_SETTINGS, max_votes_per_participant: 5, max_votes_per_card: 3 };
    expect(voteLimitProblem(s, { max_votes_per_participant: 2 })).toBe(VOTE_LIMIT_RELATION_ERROR);
    expect(voteLimitProblem(s, { max_votes_per_card: 6 })).toBe(VOTE_LIMIT_RELATION_ERROR);
    expect(voteLimitProblem(s, { max_votes_per_participant: 4, max_votes_per_card: 4 })).toBeNull();
    expect(hasLimitKey({ anonymous_cards: true })).toBe(false);
    expect(hasLimitKey({ max_votes_per_card: 2 })).toBe(true);
  });
  it('a refused lowering says which limit and how far it may go', () => {
    expect(limitRefusal({ perPerson: 3, perCard: null, maxSpent: 4, maxOnCard: 1 }))
      .toBe('Votes per person cannot go below 4. Someone has already used 4.');
    expect(limitRefusal({ perPerson: null, perCard: 1, maxSpent: 4, maxOnCard: 2 }))
      .toBe('Votes per card cannot go below 2. Someone already has 2 on one card.');
    expect(limitRefusal({ perPerson: 9, perCard: 9, maxSpent: 0, maxOnCard: 0 })).toBe('The board changed. Try again.');
  });
  it('limits are editable on a guided board until totals show', () => {
    const b = (phase: Board['phase'], archived_at: string | null = null) => ({ mode: 'guided' as const, phase, archived_at });
    expect(voteLimitsEditable(b('reflect'))).toBe(true);
    expect(voteLimitsEditable(b('vote'))).toBe(true);
    expect(voteLimitsEditable(b('discuss'))).toBe(false);
    expect(voteLimitsEditable(b('vote', '2026-11-20'))).toBe(false);
    expect(voteLimitsEditable({ mode: 'open', phase: null, archived_at: null })).toBe(false);
  });
});

describe('optimistic own votes', () => {
  const d = { boardId: 'b1', cardId: 'c9', voterId: 'p1', voteId: 'new', nowIso: '2026-11-20T00:00:00Z' };
  it('+1 creates a row with count 1, then increments; -1 decrements and removes at zero', () => {
    const one = applyVoteDelta([], { ...d, delta: 1 });
    expect(one).toEqual([{ id: 'new', card_id: 'c9', board_id: 'b1', voter_id: 'p1', count: 1, created_at: d.nowIso }]);
    const two = applyVoteDelta(one, { ...d, delta: 1 });
    expect(two[0].count).toBe(2);
    expect(applyVoteDelta(applyVoteDelta(two, { ...d, delta: -1 }), { ...d, delta: -1 })).toEqual([]);
  });
  it('-1 with no row returns the same array', () => {
    expect(applyVoteDelta(rows, { ...d, delta: -1 })).toBe(rows);
  });
  it('settle replaces or removes only my row on that card', () => {
    const server = v({ card_id: 'c1', voter_id: 'p1', count: 2, id: 'srv' });
    expect(settleOwnVote(rows, { cardId: 'c1', voterId: 'p1', vote: server }).find((x) => x.voter_id === 'p1' && x.card_id === 'c1')).toEqual(server);
    const gone = settleOwnVote(rows, { cardId: 'c1', voterId: 'p1', vote: null });
    expect(gone).toHaveLength(2);
    expect(gone.some((x) => x.voter_id === 'p2')).toBe(true);
  });
});

describe('team tally', () => {
  it('applies a newer or equal tally, ignores an older or malformed one', () => {
    const cur = { used: 3, at: 100 };
    expect(applyVoteTally(null, { used: 1, at: 5 })).toEqual({ used: 1, at: 5 });
    expect(applyVoteTally(cur, { used: 4, at: 100 })).toEqual({ used: 4, at: 100 });
    expect(applyVoteTally(cur, { used: 2, at: 99 })).toBe(cur);
    for (const bad of [null, 'x', { used: -1, at: 1 }, { used: 1.5, at: 1 }, { used: 1 }]) expect(applyVoteTally(cur, bad)).toBe(cur);
  });
  it('remaining is per person times joined participants minus used, never below zero', () => {
    expect(teamVotesRemaining(5, 2, 3)).toBe(7);
    expect(teamVotesRemaining(5, 1, 9)).toBe(0);
    expect(teamVotesLabel(7)).toBe('Team: 7 votes left');
    expect(teamVotesLabel(1)).toBe('Team: 1 vote left');
  });
  it('is shown only on a guided board in Vote with a tally', () => {
    const board = { mode: 'guided' as const, phase: 'vote' as const, archived_at: null, settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings('vote'), max_votes_per_participant: 5 } };
    expect(teamVotesLeftFor(board, 2, { used: 3, at: 1 })).toBe(7);
    expect(teamVotesLeftFor({ ...board, phase: 'group' }, 2, { used: 3, at: 1 })).toBeNull();
    expect(teamVotesLeftFor({ ...board, mode: 'open', phase: null }, 2, { used: 3, at: 1 })).toBeNull();
    expect(teamVotesLeftFor(board, 2, null)).toBeNull();
  });
});
```

`lib/__tests__/groups.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isLeadCard, visibleGroupTitle, validateGroupTitle, ungroupAll, hasGrouping } from '@/lib/groups';

const cards = [
  { id: 'a', merged_with: null, group_title: 'Release pain' },
  { id: 'b', merged_with: 'a', group_title: null },
  { id: 'c', merged_with: null, group_title: 'Dormant' },
];

describe('groups', () => {
  it('a lead card has no parent and at least one child', () => {
    expect(isLeadCard('a', cards)).toBe(true);
    expect(isLeadCard('b', cards)).toBe(false);
    expect(isLeadCard('c', cards)).toBe(false);
    expect(isLeadCard('zz', cards)).toBe(false);
  });
  it('a title shows only on a lead card; a dormant one stays hidden', () => {
    expect(visibleGroupTitle('a', cards)).toBe('Release pain');
    expect(visibleGroupTitle('c', cards)).toBeNull();
  });
  it('validates: trims, empty clears, 80 code points max', () => {
    expect(validateGroupTitle(null)).toEqual({ ok: true, value: null });
    expect(validateGroupTitle('  Deploys  ')).toEqual({ ok: true, value: 'Deploys' });
    expect(validateGroupTitle('   ')).toEqual({ ok: true, value: null });
    expect(validateGroupTitle('😀'.repeat(80))).toEqual({ ok: true, value: '😀'.repeat(80) });
    expect(validateGroupTitle('x'.repeat(81))).toEqual({ ok: false, error: 'Group title must be at most 80 characters' });
    expect(validateGroupTitle(42)).toEqual({ ok: false, error: 'Invalid group title' });
  });
  it('ungroupAll clears every parent and title; hasGrouping sees either', () => {
    expect(ungroupAll(cards).every((c) => c.merged_with === null && c.group_title === null)).toBe(true);
    expect(hasGrouping(cards)).toBe(true);
    expect(hasGrouping(ungroupAll(cards))).toBe(false);
  });
});
```

Add to `lib/board-validation-settings.test.ts`:

```ts
it('max_votes_per_card is a whole number from 1 to 12', () => {
  for (const ok of [1, 3, 12]) expect(validateSettingsPatch({ max_votes_per_card: ok }).ok).toBe(true);
  for (const bad of [0, 13, 2.5, '3', null]) expect(validateSettingsPatch({ max_votes_per_card: bad }).ok).toBe(false);
});
```

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/votes.test.ts lib/__tests__/groups.test.ts lib/board-validation-settings.test.ts`. Expected: FAIL, modules not found and the new setting rejected as unknown.
- [ ] **Step 3: Add the constants, the type fields, the `SETTING_CHECKS` entry with `-?`, and the two messages in `lib/constants/phases.ts`;** switch the phase route to import them.
- [ ] **Step 4: Implement `lib/votes.ts` and `lib/groups.ts`** to the signatures and tests above. `teamVotesLeftFor` returns null unless `board.mode === GUIDED_MODE`, `board.phase` is set, `PHASES[board.phase].profile.canVote`, `!board.archived_at`, and `tally` is non-null. `voteLimitsEditable` is `mode === GUIDED_MODE && phase !== null && !archived_at && !PHASES[phase].profile.canSeeTotals`.
- [ ] **Step 5: Run** `npx vitest run lib/__tests__/votes.test.ts lib/__tests__/groups.test.ts lib/board-validation-settings.test.ts app/api/boards/\[boardId\]/phase && npx tsc --noEmit`. Expected: PASS, clean.
- [ ] **Step 6: Run** `npx eslint` on the changed files. Expected: clean.
- [ ] **Step 7: Commit** `feat(votes): vote and group vocabulary, limits and pure vote logic`

---

### Task 2: Migration 016

**Files:**
- Create: `scripts/migrations/016_group_and_vote.sql`
- Test: `lib/__tests__/group-vote-migration-contract.test.ts`

**Interfaces:**
- Consumes: `MAX_VOTES_PER_CARD_RANGE`, `OPEN_MAX_VOTES_PER_CARD` (Task 1), `GROUP_TITLE_MAX`.
- Produces: `votes.count SMALLINT NOT NULL DEFAULT 1` with `votes_count_range CHECK (count BETWEEN 1 AND 12)`; `cards.group_title TEXT NULL` with `cards_group_title_length CHECK (group_title IS NULL OR char_length(group_title) <= 80)`.

- [ ] **Step 1: Write the failing contract test.**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { MAX_VOTES_PER_CARD_RANGE, OPEN_MAX_VOTES_PER_CARD } from '@/lib/constants/board-settings';
import { GROUP_TITLE_MAX } from '@/lib/constants/groups';

const sqlText = readFileSync('scripts/migrations/016_group_and_vote.sql', 'utf-8');

describe('016_group_and_vote.sql contract', () => {
  it('votes_count_range matches MAX_VOTES_PER_CARD_RANGE', () => {
    const m = /votes_count_range\s+CHECK\s*\(\s*count\s+BETWEEN\s+(\d+)\s+AND\s+(\d+)\s*\)/i.exec(sqlText);
    expect(m && [Number(m[1]), Number(m[2])]).toEqual([MAX_VOTES_PER_CARD_RANGE.min, MAX_VOTES_PER_CARD_RANGE.max]);
  });
  it('a new vote row defaults to the open-board count', () => {
    const m = /ADD COLUMN IF NOT EXISTS count SMALLINT NOT NULL DEFAULT (\d+)/i.exec(sqlText);
    expect(Number(m?.[1])).toBe(OPEN_MAX_VOTES_PER_CARD);
  });
  it('cards_group_title_length matches GROUP_TITLE_MAX', () => {
    const m = /char_length\(group_title\)\s*<=\s*(\d+)/i.exec(sqlText);
    expect(Number(m?.[1])).toBe(GROUP_TITLE_MAX);
  });
  it('is additive and transactional: no DROP, no ALTER COLUMN, BEGIN and COMMIT', () => {
    expect(sqlText).not.toMatch(/\bDROP\b|ALTER\s+COLUMN/i);
    expect(sqlText).toMatch(/^BEGIN;/m);
    expect(sqlText).toMatch(/^COMMIT;/m);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/group-vote-migration-contract.test.ts`. Expected: FAIL, file not found.
- [ ] **Step 3: Write the migration** in the style of 015: a header comment (purpose, "additive and safe under the deployed code: both columns have safe defaults, existing INSERTs and SELECTs keep working", "the CHECK values must equal `MAX_VOTES_PER_CARD_RANGE` and `GROUP_TITLE_MAX`; `lib/__tests__/group-vote-migration-contract.test.ts` enforces it", requires 013, idempotent, rollback: drop the two constraints then the two columns and the `schema_migrations` row 016, only safe while no vote has `count > 1`), then `BEGIN;`, `SET LOCAL lock_timeout = '5s';`, `SET LOCAL statement_timeout = '60s';`, a `DO` block that raises `'016 requires 013_participant_uniqueness_and_ledger.sql (schema_migrations) to be applied first'` when `to_regclass('public.schema_migrations') IS NULL`, the two `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, each constraint inside a `DO` block guarded by `pg_constraint` on `conrelid` and `conname` exactly as 015 does, and `COMMIT;`. It does not require 015: the columns are independent of guided mode.
- [ ] **Step 4: Run** the contract test. Expected: PASS.
- [ ] **Step 5: Apply to dev.**

Run: `node --env-file=.env.local scripts/run-one.mjs scripts/migrations/016_group_and_vote.sql`
Expected: `Target database host: ep-calm-breeze…`, `Applied scripts/migrations/016_group_and_vote.sql`, `Recorded migration 016 in schema_migrations`. If the host is not the `ep-calm-breeze` dev host, stop and report.

Run it a second time. Expected: the same three lines and no error (re-runnable).

- [ ] **Step 6: Run** `npm test`. Expected: all PASS (733 plus Task 1 and Task 2 tests).
- [ ] **Step 7: Commit** `feat(db): 016 vote counts and group titles`

---

### Task 3: Group actions in the guard; shaper and tally payload

**Files:**
- Modify: `lib/constants/board-actions.ts`, `lib/phases.ts` (`ACTION_PHASE_GATE`), `lib/board-guards.ts`, `lib/board-view.ts`, `lib/board-publish.ts`
- Test: `lib/__tests__/board-guards.test.ts`, `lib/__tests__/phases.test.ts`, `lib/__tests__/board-view.test.ts`, `lib/__tests__/board-publish.test.ts` (`lib/__tests__/phase-contract.test.ts` covers the new actions automatically through `BOARD_ACTIONS`)

**Interfaces:**
- Consumes: `VoteTally` (Task 1).
- Produces:
  - `BOARD_ACTIONS` gains `'group.title'` and `'group.reset'`, inserted after `'card.move'`.
  - `ACTION_PHASE_GATE['group.title'] = 'canGroup'`, `ACTION_PHASE_GATE['group.reset'] = 'canGroup'`.
  - `checkIdentity`: `'group.title'` joins the `card.move` case (any participant; a facilitator without a participant row also passes); `'group.reset'` joins the facilitator-only case (`column.write`, `participant.manage`, `board.settings`). `isLockable` includes `'group.title'`. The v1 rule becomes `(action === 'board.settings' || action === 'group.reset') && !actor.isFacilitator`, so reset is facilitator-only on every trust version.
  - `shapeCard`: when it withholds a card's text (`text_hidden = true`), it also sets `group_title` to null if the key is present.
  - `voteTallyPayload(t: VoteTally): VoteTally` (returns exactly `{ used, at }`), `publishVoteTally(boardId: string, t: VoteTally): Promise<void>` (event `vote-tally` on `retro-board:{boardId}`).

- [ ] **Step 1: Write the failing tests.**

```ts
// board-guards.test.ts
describe('group actions', () => {
  const inGroup = state({ phase: 'group', settings: phaseSettings('group') });
  const inVote = state({ phase: 'vote', settings: phaseSettings('vote') });
  it('group.title: any joined participant during Group, refused in other phases', () => {
    expect(checkAction('group.title', actor(), inGroup)).toEqual({ ok: true });
    expect(checkAction('group.title', actor(), inVote)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
  });
  it('group.title: 401 for someone who has not joined', () => {
    expect(checkAction('group.title', actor({ participantId: null }), inGroup)).toEqual({ ok: false, status: 401, error: 'Join the board first' });
  });
  it('group.reset: facilitator only, during Group only', () => {
    expect(checkAction('group.reset', actor(), inGroup)).toEqual({ ok: false, status: 403, error: 'Facilitator access required' });
    expect(checkAction('group.reset', actor({ isFacilitator: true }), inGroup)).toEqual({ ok: true });
    expect(checkAction('group.reset', actor({ isFacilitator: true }), inVote)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
  });
  it('group.reset is facilitator-only on a v1 board too', () => {
    expect(checkAction('group.reset', actor({ trustVersion: 1 }), state())).toEqual({ ok: false, status: 403, error: 'Facilitator access required' });
  });
});

// phases.test.ts: extend the phaseDenial tables
//   denied:  ['group.title', 'reflect'], ['group.title', 'vote'], ['group.reset', 'discuss']
//   allowed: ['group.title', 'group'], ['group.reset', 'group']

// board-view.test.ts
it('a withheld text also withholds the group title; a visible card or my own keeps it', () => {
  const hidden = board({ settings: { card_visibility: 'hidden' } });
  const c = card({ author_id: 'someone', group_title: 'Release pain' });
  expect(shapeCard(c, hidden, { participantId: 'p1' }).group_title).toBeNull();
  expect(shapeCard(c, board(), { participantId: 'p1' }).group_title).toBe('Release pain');
  expect(shapeCard({ ...c, author_id: 'p1' }, hidden, { participantId: 'p1' }).group_title).toBe('Release pain');
  expect('group_title' in shapeCard(card({ author_id: 'someone' }), hidden, { participantId: 'p1' })).toBe(false);
});
it('secret voting keeps my vote with its count and drops everyone else', () => {
  const secret = board({ settings: { secret_voting: true } });
  const votes = [
    { id: 'v1', card_id: 'c1', board_id: 'b1', voter_id: 'p1', count: 2, created_at: 'x' },
    { id: 'v2', card_id: 'c1', board_id: 'b1', voter_id: 'p2', count: 3, created_at: 'x' },
  ];
  expect(shapeVotes(votes, secret, { participantId: 'p1' })).toEqual([votes[0]]);
});

// board-publish.test.ts
it('the tally payload carries only used and at', () => {
  expect(voteTallyPayload({ used: 4, at: 17, voter_id: 'p2' } as never)).toEqual({ used: 4, at: 17 });
});
```

- [ ] **Step 2: Run** the four files. Expected: FAIL (unknown actions are a type error under `tsc`, and the view and publish assertions fail).
- [ ] **Step 3: Implement** the interface changes above. `tsc` will not compile until both new actions are in `ACTION_PHASE_GATE`.
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit`. Expected: PASS, clean, including `phase-contract.test.ts` for every phase and action.
- [ ] **Step 5: Run** `npx eslint` on the changed files. Expected: clean.
- [ ] **Step 6: Commit** `feat(guards): group title and reset actions; shaper withholds hidden group titles`

---

### Task 4: Guided add and remove on the vote route

**Files:**
- Modify: `app/api/boards/[boardId]/votes/route.ts`
- Test: `app/api/boards/[boardId]/votes/__tests__/vote-round-trips.test.ts` (open-path pin), new `app/api/boards/[boardId]/votes/__tests__/guided-votes.test.ts`

**Interfaces:**
- Consumes: `isVoteAction` (Task 1), `maxVotesPerCard`, `votesPerCardError`, `GROUP_VOTE_ERROR`, `VoteTally`, `NOT_GUIDED_ERROR`, `GUIDED_MODE`; `publishVoteTally` (Task 3).
- Produces: `POST /api/boards/[boardId]/votes`
  - Body: `{ cardId: string; voterId?: string | null; voteId?: string | null; action?: 'add' | 'remove' }`. An `action` that is neither absent nor a `VoteAction` is 400 `Invalid request body`, before any database call.
  - Same rate limit, actor load and `checkAction('vote.toggle', ...)` as today (401, 403, 409 unchanged).
  - Open board: `action` present is 409 `This board is not in guided mode`. `action` absent runs today's toggle, unchanged.
  - Guided board: `action` absent is 400 `Guided boards take add or remove`. v2 participant required (`requireParticipantOn`). Per-person limit `settings.max_votes_per_participant`, per-card limit `maxVotesPerCard(settings)`.
  - `add` 200: `{ action: 'added', vote: Vote, tally: VoteTally }` (`vote.count` is the new count). 404 `Card not found`. 409 `Votes go on the group, not on a card inside it`. 422 `{ error: 'Vote limit reached', maxVotes }`. 422 `{ error: votesPerCardError(perCard), maxVotesPerCard: perCard }`.
  - `remove` 200: `{ action: 'removed', voteId: string, count: number, tally: VoteTally }` (`count` 0 means the row was deleted). 409 `You have no vote on this card`.
  - After a 200 it publishes `vote-tally` with the tally. Guided votes never publish `vote-cast` or `vote-removed`: they happen only in Vote, where votes are always secret.

Controller ruling: the lock value is `voteLockKey(boardId)` from `lib/votes.ts`, not an inline string, because Task 5 takes the same lock.

Decisions recorded here: add and remove are an `action` field on the existing route, because the toggle path must change anyway (it counts rows, `COUNT(*)`, for the per-person limit, so a guided board with `count > 1` rows could pass its limit through it), and branching on `mode` after the actor load leaves the open path's code and SQL untouched. The guided transaction locks per board (`hashtext(boardId + ':votes')`), not per voter: the per-voter lock would be enough for both limits, but the tally returned to everyone must include every committed vote, which needs all of a board's guided votes in one order; vote rates in a retro make the contention negligible. `tally.at` is the database's `clock_timestamp()` in milliseconds, taken inside that serialized transaction, so clients can drop out-of-order tallies. Adds go only on cards with no parent; removes work on any card, so a vote left on a card that was grouped later can still be taken back.

- [ ] **Step 1: Pin the open toggle statement before touching the route.** Add to `vote-round-trips.test.ts` (and add `publishVoteTally: vi.fn()` to its `@/lib/board-publish` mock):

```ts
it('the open toggle statements are unchanged by Step 2', async () => {
  mocks.sql.mockResolvedValueOnce([ctxRow()]);
  mocks.tx.mockResolvedValueOnce([[], [{ outcome: 'added', ...voteRow }]]);
  await call({ cardId: 'c1', voteId: '00000000-0000-4000-8000-000000000001' });
  const texts: string[] = [];
  mocks.tx.mock.calls[0][0]((s: TemplateStringsArray) => { texts.push(s.join('?')); return {}; });
  expect(texts).toMatchInlineSnapshot();
});
it('an open board refuses an action field with 409 and runs no transaction', async () => {
  mocks.sql.mockResolvedValueOnce([ctxRow()]);
  const res = await call({ cardId: 'c1', action: 'add' });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: 'This board is not in guided mode' });
  expect(mocks.tx).not.toHaveBeenCalled();
});
```

Run `npx vitest run app/api/boards/\[boardId\]/votes/__tests__/vote-round-trips.test.ts -u` on the unmodified route. Expected: the snapshot is written into the file and the first new test passes; the 409 test fails. Review the written snapshot against the route's SQL by eye.

- [ ] **Step 2: Write the failing guided tests** in `guided-votes.test.ts`, with the same mocks as `vote-round-trips.test.ts` plus `publishVoteTally: (...a: unknown[]) => mocks.tally(...a)` in the `@/lib/board-publish` mock.

```ts
function guidedRow(settings: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  return ctxRow({ ...phaseSettings('vote'), max_votes_per_participant: 5, max_votes_per_card: 3, ...settings }, { mode: 'guided', phase: 'vote', ...over });
}
// ctxRow(settings, over) is the vote-round-trips factory extended with an `over` spread.
const txTexts = () => {
  const calls: { text: string; values: unknown[] }[] = [];
  mocks.tx.mock.calls[0][0]((s: TemplateStringsArray, ...values: unknown[]) => { calls.push({ text: s.join('?'), values }); return {}; });
  return calls;
};
const saved = { id: 'v1', card_id: 'c1', board_id: 'b1', voter_id: 'p1', count: 2, created_at: '2026-11-20T00:00:00Z' };
const addRow = (o: Record<string, unknown> = {}) =>
  ({ card_found: 1, card_parent: null, spent: 1, on_card: 1, team_used_before: 4, tally_at: 1_700_000_000_000, ...saved, ...o });
const NO_VOTE = { id: null, card_id: null, board_id: null, voter_id: null, count: null, created_at: null };

describe('guided add', () => {
  it('increments under a per-board lock, returns the vote and the tally, publishes only the tally', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow()]]);
    const res = await call({ cardId: 'c1', action: 'add', voteId: '00000000-0000-4000-8000-000000000002' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ action: 'added', vote: saved, tally: { used: 5, at: 1_700_000_000_000 } });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
    const [lock, stmt] = txTexts();
    expect(lock.values).toEqual(['b1:votes']);
    expect(stmt.text).toContain('ON CONFLICT (card_id, voter_id) DO UPDATE SET count = votes.count + 1');
    expect(stmt.text).toContain('SUM(count)');
    expect(stmt.values).toEqual(expect.arrayContaining([5, 3]));
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.tally).toHaveBeenCalledWith('b1', { used: 5, at: 1_700_000_000_000 });
  });
  it('422 at the per-card limit, with the limit', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, spent: 3, on_card: 3 })]]);
    const res = await call({ cardId: 'c1', action: 'add' });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'You can put at most 3 votes on one card', maxVotesPerCard: 3 });
    expect(mocks.tally).not.toHaveBeenCalled();
  });
  it('422 at the per-person limit takes precedence', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, spent: 5, on_card: 3 })]]);
    expect(await (await call({ cardId: 'c1', action: 'add' })).json()).toEqual({ error: 'Vote limit reached', maxVotes: 5 });
  });
  it('404 for an unknown card, 409 for a card inside a group', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, card_found: 0 })]]);
    expect((await call({ cardId: 'nope', action: 'add' })).status).toBe(404);
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, card_parent: 'lead' })]]);
    const res = await call({ cardId: 'c2', action: 'add' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Votes go on the group, not on a card inside it');
  });
  it('a guided board without max_votes_per_card allows 1 per card', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ max_votes_per_card: undefined })]);
    mocks.tx.mockResolvedValueOnce([[], [addRow({ ...NO_VOTE, on_card: 1 })]]);
    expect(await (await call({ cardId: 'c1', action: 'add' })).json()).toEqual({ error: 'You can put at most 1 vote on one card', maxVotesPerCard: 1 });
  });
});

describe('guided remove', () => {
  const removeRow = (o: Record<string, unknown> = {}) => ({ vote_id: 'v1', count_before: 2, team_used_before: 5, tally_at: 1_700_000_000_001, ...o });
  it('decrements and returns the new count and tally', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [removeRow()]]);
    expect(await (await call({ cardId: 'c1', action: 'remove' })).json())
      .toEqual({ action: 'removed', voteId: 'v1', count: 1, tally: { used: 4, at: 1_700_000_000_001 } });
  });
  it('removing the last vote reports count 0', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [removeRow({ count_before: 1 })]]);
    expect((await (await call({ cardId: 'c1', action: 'remove' })).json()).count).toBe(0);
  });
  it('409 when there is nothing to remove, nothing published', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    mocks.tx.mockResolvedValueOnce([[], [removeRow({ vote_id: null, count_before: null })]]);
    const res = await call({ cardId: 'c1', action: 'remove' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('You have no vote on this card');
    expect(mocks.tally).not.toHaveBeenCalled();
  });
});

describe('guided request shape and guard', () => {
  it('400 for an unknown action before any database call', async () => {
    expect((await call({ cardId: 'c1', action: 'boost' })).status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it('400 on a guided board without an action, after the context query only', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    const res = await call({ cardId: 'c1' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Guided boards take add or remove');
    expect(mocks.tx).not.toHaveBeenCalled();
  });
  it('the phase guard answers first: 409 in Reflect', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow(phaseSettings('reflect'), { phase: 'reflect' })]);
    expect((await (await call({ cardId: 'c1', action: 'add' })).json()).error).toBe('Not available during Reflect');
  });
  it('401 without a participant', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({}, { cp_id: null })]);
    expect((await call({ cardId: 'c1', action: 'add' })).status).toBe(401);
  });
});
```

- [ ] **Step 3: Run both files.** Expected: the snapshot test PASSES, the open 409 test and every guided test FAIL.
- [ ] **Step 4: Implement.** Parse and check `action` with the other body fields. After the guard: `if (loaded.board.mode === GUIDED_MODE) return guidedVote(...)`, then `if (action !== undefined) return 409 NOT_GUIDED_ERROR`, then the existing code unchanged. `guidedVote` lives in the same file and runs `sqlTransaction` with `SELECT pg_advisory_xact_lock(hashtext(${boardId + ':votes'}))` then one statement:

```sql
-- add
WITH card AS (
  SELECT id, merged_with FROM cards WHERE id = $cardId AND board_id = $boardId
), mine AS (
  SELECT COALESCE(SUM(count), 0)::int AS spent,
         COALESCE(SUM(count) FILTER (WHERE card_id = $cardId), 0)::int AS on_card
  FROM votes WHERE board_id = $boardId AND voter_id = $voterId
), team AS (
  SELECT COALESCE(SUM(count), 0)::int AS used FROM votes WHERE board_id = $boardId
), upserted AS (
  INSERT INTO votes (id, card_id, board_id, voter_id, count)
  SELECT $newVoteId, $cardId, $boardId, $voterId, 1 FROM card, mine
  WHERE card.merged_with IS NULL AND mine.spent < $perPerson AND mine.on_card < $perCard
  ON CONFLICT (card_id, voter_id) DO UPDATE SET count = votes.count + 1
  RETURNING *
)
SELECT (SELECT COUNT(*) FROM card)::int AS card_found, (SELECT merged_with FROM card) AS card_parent,
       mine.spent, mine.on_card, team.used AS team_used_before,
       floor(extract(epoch from clock_timestamp()) * 1000)::float8 AS tally_at,
       u.id, u.card_id, u.board_id, u.voter_id, u.count, u.created_at
FROM mine CROSS JOIN team LEFT JOIN upserted u ON true

-- remove
WITH cur AS (
  SELECT id, count FROM votes WHERE card_id = $cardId AND voter_id = $voterId AND board_id = $boardId
), decremented AS (
  UPDATE votes SET count = votes.count - 1 FROM cur WHERE votes.id = cur.id AND cur.count > 1 RETURNING votes.id
), deleted AS (
  DELETE FROM votes USING cur WHERE votes.id = cur.id AND cur.count = 1 RETURNING votes.id
), team AS (
  SELECT COALESCE(SUM(count), 0)::int AS used FROM votes WHERE board_id = $boardId
)
SELECT cur.id AS vote_id, cur.count AS count_before, team.used AS team_used_before,
       floor(extract(epoch from clock_timestamp()) * 1000)::float8 AS tally_at
FROM team LEFT JOIN cur ON true
```

Outcome order for add: `card_found = 0` is 404; a null `u.id` with `card_parent` set is 409; with `spent >= perPerson` is the per-person 422; otherwise the per-card 422; a vote row is 200 with `used = team_used_before + 1`. For remove: null `vote_id` is 409; otherwise `count = count_before - 1`, `used = team_used_before - 1`. `newVoteId` is `voteId || crypto.randomUUID()`, as the toggle does.

- [ ] **Step 5: Run** both files without `-u`. Expected: PASS; the inline snapshot is unchanged.
- [ ] **Step 6: Run** `npm test && npx tsc --noEmit && npx eslint app/api/boards/\[boardId\]/votes`. Expected: PASS, clean.
- [ ] **Step 7: Commit** `feat(api): add and remove votes on guided boards with per-card and per-person limits`

---

### Task 5: Guided defaults, limit guard and the GET tally

**Files:**
- Modify: `app/api/boards/route.ts`, `app/api/boards/[boardId]/route.ts`
- Test: `app/api/boards/__tests__/create-guided.test.ts`, `app/api/boards/[boardId]/__tests__/patch-round-trips.test.ts` and `get-round-trips.test.ts` (open pins), `get-guided-fields.test.ts`, new `app/api/boards/[boardId]/__tests__/vote-limits.test.ts`

**Interfaces:**
- Consumes: `guidedVoteDefaults`, `hasLimitKey`, `voteLimitProblem`, `limitRefusal`, `sumVoteCounts`, `CARD_LIMIT_OPEN_ERROR`, `VoteTally`, `GUIDED_MODE` (Task 1).
- Produces:
  - Guided create stores `settings = { ...body.settings, ...phaseSettings(FIRST_PHASE), ...guidedVoteDefaults(body.settings) }`. The open insert is untouched.
  - Settings PATCH, inside the existing `patchNeedsSettingsGuard` branch after the guard and the phase-owned check:
    - Open board with `max_votes_per_card` in the patch: 409 `Votes per card is only available on guided boards`.
    - Guided board with `hasLimitKey(patch)`: `voteLimitProblem(loaded.state.settings, patch)` non-null is 400 with that message; otherwise the guarded statement below replaces the existing UPDATE. A refusal is 409 `{ error: limitRefusal(...) }` and publishes nothing. Success publishes `board-updated` exactly as today.
    - Every other PATCH keeps the existing statement.
  - Board GET on a guided board adds the top-level key `voteTally: { used: sumVoteCounts(rawVotes), at: 0 }`, computed from the vote rows the snapshot already read, before shaping. Open boards and the minimal no-access payload get no new key.

Controller ruling (limit guard and votes must not interleave): the guarded limit statement runs inside `sqlTransaction`, after `SELECT pg_advisory_xact_lock(hashtext(${voteLockKey(boardId)}))`, the same per-board lock a guided vote takes in Task 4. Without it a vote can commit between the guard's read and the update and leave someone above the new limit. A `sqlTransaction` batch is one round-trip, so the PATCH still costs two. The tests in `vote-limits.test.ts` therefore read the guarded statement from the transaction mock the way `guided-votes.test.ts` does (`mocks.sql` called once for the actor load, `mocks.tx` called once; the first transaction statement's value is `voteLockKey('b1')`), instead of `mocks.sql.mock.calls[1]`. A guided PATCH without a limit key, and every open-board PATCH, keep today's plain statement and take no lock.

Decision recorded here: `at: 0` on the GET tally means "a snapshot"; any later `vote-tally` event or vote response replaces it (Task 7). A GET cannot carry a database timestamp without another statement.

- [ ] **Step 1: Pin the open statements before touching the route.** In `patch-round-trips.test.ts` add a test that sends `{ settings: { max_votes_per_participant: 4 } }` on an open board and asserts `(mocks.sql.mock.calls[1][0] as string[]).join('?')` with `toMatchInlineSnapshot()`. In `get-round-trips.test.ts` add a test that captures the five transaction statement texts on an open board with `toMatchInlineSnapshot()` and asserts the response has no `voteTally` key. Run both files with `-u` on the unmodified route. Expected: snapshots written; tests pass.
- [ ] **Step 2: Update and add the failing tests.**

```ts
// create-guided.test.ts: the existing settings assertion becomes
expect(settings).toEqual({ ...baseBody.settings, ...phaseSettings(FIRST_PHASE), max_votes_per_card: 3 });
it('a guided board whose per-person limit is 2 gets 2 per card', async () => {
  await call({ mode: 'guided', settings: { ...baseBody.settings, max_votes_per_participant: 2 } });
  const settingsJson = boardInsert()!.values.find((v) => typeof v === 'string' && v.startsWith('{"card_visibility"')) as string;
  expect(JSON.parse(settingsJson).max_votes_per_card).toBe(2);
});
it('an open board is inserted without max_votes_per_card', async () => {
  await call();
  expect(boardInsert()!.values.some((v) => typeof v === 'string' && v.includes('max_votes_per_card'))).toBe(false);
});

// get-guided-fields.test.ts
it('a guided board GET carries the team tally summed from every vote, even while votes are secret', async () => {
  mocks.sql.mockResolvedValue([ctxRow({ mode: 'guided', phase: 'vote', settings: { secret_voting: true, voting_enabled: true } })]);
  mocks.tx.mockResolvedValue([[], [], [
    { id: 'v1', card_id: 'c1', board_id: 'b1', voter_id: 'p1', count: 2, created_at: 'x' },
    { id: 'v2', card_id: 'c1', board_id: 'b1', voter_id: 'p2', count: 3, created_at: 'x' },
  ], [], []]);
  const json = await (await call()).json();
  expect(json.voteTally).toEqual({ used: 5, at: 0 });
  expect(json.votes).toEqual([expect.objectContaining({ voter_id: 'p1', count: 2 })]);
});
it('an open board GET has no voteTally', async () => {
  mocks.sql.mockResolvedValue([ctxRow({ mode: 'open', phase: null })]);
  expect('voteTally' in (await (await call()).json())).toBe(false);
});
// The existing "minimal no-access payload" test also asserts: expect('voteTally' in json).toBe(false)

// vote-limits.test.ts (mocks as in patch-round-trips.test.ts)
const guided = (settings: Record<string, unknown> = {}) =>
  ctxRow({ mode: 'guided', phase: 'vote', settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings('vote'), max_votes_per_participant: 5, max_votes_per_card: 3, ...settings } });
const patch = (settings: Record<string, unknown>) => boardPatch(req('', { settings }), ctx);

it('lowering votes per person below what someone spent is 409 and publishes nothing', async () => {
  mocks.sql.mockResolvedValueOnce([guided()]).mockResolvedValueOnce([{ title: null, description: null, settings: null, max_spent: 4, max_on_card: 2 }]);
  const res = await patch({ max_votes_per_participant: 3 });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: 'Votes per person cannot go below 4. Someone has already used 4.' });
  expect(mocks.sql).toHaveBeenCalledTimes(2);
  expect(mocks.publish).not.toHaveBeenCalled();
  const text = (mocks.sql.mock.calls[1][0] as string[]).join('?');
  expect(text).toContain('GROUP BY voter_id');
  expect(text).toContain('MAX(count)');
});
it('lowering votes per card below the highest count is 409', async () => {
  mocks.sql.mockResolvedValueOnce([guided()]).mockResolvedValueOnce([{ title: null, description: null, settings: null, max_spent: 2, max_on_card: 2 }]);
  expect(await (await patch({ max_votes_per_card: 1 })).json()).toEqual({ error: 'Votes per card cannot go below 2. Someone already has 2 on one card.' });
});
it('raising both is saved and published like any settings change', async () => {
  const merged = { ...DEFAULT_BOARD_SETTINGS, max_votes_per_participant: 8, max_votes_per_card: 4 };
  mocks.sql.mockResolvedValueOnce([guided()]).mockResolvedValueOnce([{ title: 'T', description: null, settings: merged, max_spent: 2, max_on_card: 1 }]);
  expect((await patch({ max_votes_per_participant: 8, max_votes_per_card: 4 })).status).toBe(200);
  expect(mocks.publish).toHaveBeenCalledWith('board-updated', { settings: merged });
});
it('per card above per person is 400 after the context query only', async () => {
  mocks.sql.mockResolvedValueOnce([guided()]);
  const res = await patch({ max_votes_per_card: 6 });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe('Votes per card cannot be more than votes per person');
  expect(mocks.sql).toHaveBeenCalledTimes(1);
});
it('an open board refuses max_votes_per_card with 409', async () => {
  mocks.sql.mockResolvedValueOnce([ctxRow()]);
  const res = await patch({ max_votes_per_card: 2 });
  expect(res.status).toBe(409);
  expect((await res.json()).error).toBe('Votes per card is only available on guided boards');
  expect(mocks.sql).toHaveBeenCalledTimes(1);
});
it('a guided PATCH without a limit key uses the ordinary statement', async () => {
  mocks.sql.mockResolvedValueOnce([guided()]).mockResolvedValueOnce([{ title: 'T', description: null, settings: DEFAULT_BOARD_SETTINGS }]);
  await patch({ anonymous_cards: true });
  expect((mocks.sql.mock.calls[1][0] as string[]).join('?')).not.toContain('max_spent');
});
```

- [ ] **Step 3: Run** the five files. Expected: the new assertions FAIL; the Step 1 snapshots PASS.
- [ ] **Step 4: Implement.** The guarded statement, with the same `title` and `description` `CASE` expressions as the existing UPDATE so a combined body behaves the same:

```sql
WITH spent AS (
  SELECT COALESCE(MAX(per_voter), 0)::int AS max_spent
  FROM (SELECT SUM(count) AS per_voter FROM votes WHERE board_id = $boardId GROUP BY voter_id) s
), top AS (
  SELECT COALESCE(MAX(count), 0)::int AS max_on_card FROM votes WHERE board_id = $boardId
), updated AS (
  UPDATE boards SET
    title = CASE WHEN $hasTitle::boolean THEN $title::text ELSE title END,
    description = CASE WHEN $hasDescription::boolean THEN $description::text ELSE description END,
    settings = settings || $patchJson::jsonb
  WHERE id = $boardId AND archived_at IS NULL AND deleted_at IS NULL
    AND ($perPerson::int IS NULL OR $perPerson::int >= (SELECT max_spent FROM spent))
    AND ($perCard::int IS NULL OR $perCard::int >= (SELECT max_on_card FROM top))
    AND COALESCE($perCard::int, (settings ->> 'max_votes_per_card')::int, $openPerCard::int)
        <= COALESCE($perPerson::int, (settings ->> 'max_votes_per_participant')::int, $defaultPerPerson::int)
  RETURNING title, description, settings
)
SELECT u.title, u.description, u.settings, spent.max_spent, top.max_on_card
FROM spent CROSS JOIN top LEFT JOIN updated u ON true
```

`$openPerCard` is `OPEN_MAX_VOTES_PER_CARD`; `$defaultPerPerson` is `DEFAULT_BOARD_SETTINGS.max_votes_per_participant`. A null `u.settings` is the 409 from `limitRefusal({ perPerson, perCard, maxSpent: max_spent, maxOnCard: max_on_card })`.

- [ ] **Step 5: Run** the five files without `-u`, then `npm test && npx tsc --noEmit && npx eslint app/api/boards/route.ts app/api/boards/\[boardId\]/route.ts`. Expected: PASS, snapshots unchanged, clean.
- [ ] **Step 6: Commit** `feat(api): guided vote defaults, limit guard on settings, team vote tally on the board GET`

---

### Task 6: The groups route

**Files:**
- Create: `app/api/boards/[boardId]/groups/route.ts`
- Test: `app/api/boards/[boardId]/groups/__tests__/groups-route.test.ts`

**Interfaces:**
- Consumes: `isGroupAction`, `validateGroupTitle`, `NOT_GUIDED_ERROR`, `PHASE_CHANGED_ERROR` (Task 1); `checkAction` with `'group.title'` and `'group.reset'` (Task 3); `loadBoardActor`, `guardResponse`, `BOARD_NOT_FOUND`, `publishCard`, `shapeCard`, `rateLimitOr429`, `readJsonObject`, `refetchRouteFor` contract (`phase` + `refetch: true`).
- Produces: `POST /api/boards/[boardId]/groups`, rate limit `rateLimitOr429(request, 'groups', 120, 60)`.
  - `{ action: 'set-title', cardId: string, title: string | null }`: 200 `{ card: Card }` (shaped for the caller) and `card-updated` published through `publishCard`. 400 `Invalid request body` or the `validateGroupTitle` error. 404 `Card not found`. 409 `This board is not in guided mode`, `Only a group can have a title`, `The phase already changed`, or the guard's phase message. 401 and 403 from the guard.
  - `{ action: 'reset' }`: 200 `{ ok: true, cleared: number }`; when `cleared > 0` publishes `grouping-reset` with `{ phase: 'group', refetch: true }` (the board's current phase, read from `loaded.board.phase`). 403 for a non-facilitator; 409 as above.
  - Both validate the body fully before the actor load. After the load the guard runs, then an open board is 409 `This board is not in guided mode` (the order the phase route uses). Two round-trips each.

Decision recorded here: reset leaves every card in the column it is in (children were moved into their lead's column when grouped), as a single uncombine does today. Votes are never named by either statement.

- [ ] **Step 1: Write the failing tests**, mocking `@/lib/db`, the session, `readParticipantId`, `@/lib/board-publish` (`publishCard` as `mocks.publish`) and `@/lib/ably-server` as `cards/__tests__/round-trips.test.ts` does, except that the mocked channel's `publish` is a hoisted `channelPublish = vi.fn()` so tests can inspect it. `ctxRow`, `callValues` and `callText` are copied from that file.

```ts
const guidedRow = (over: Record<string, unknown> = {}) =>
  ctxRow({ mode: 'guided', phase: 'group', settings: { ...phaseSettings('group') }, ...over });
const card = { id: 'c1', board_id: 'b1', column_id: 'col1', text: 't', author_id: 'p2', author_name: 'Bo', position: 1, reactions: {}, merged_with: null, color: null, group_title: 'Deploys' };
const post = (body: unknown) => POST(req('POST', body), ctx);

describe('set-title', () => {
  it('sets the title on a lead card in two round-trips and publishes the card', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ target_is_lead: true, ...card }]);
    const res = await post({ action: 'set-title', cardId: 'c1', title: '  Deploys ' });
    expect(res.status).toBe(200);
    expect((await res.json()).card.group_title).toBe('Deploys');
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(callValues(1)).toEqual(expect.arrayContaining(['Deploys', 'c1', 'b1', 'group']));
    expect(callText(1)).toContain('merged_with = c.id');
    expect(mocks.publish).toHaveBeenCalledWith('b1', 'card-updated', expect.objectContaining({ id: 'c1' }), expect.anything());
  });
  it('404 for no card, 409 for a card that is not a lead, 409 when the phase moved', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([]);
    expect((await post({ action: 'set-title', cardId: 'zz', title: 'x' })).status).toBe(404);
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ target_is_lead: false, id: null }]);
    expect((await (await post({ action: 'set-title', cardId: 'c3', title: 'x' })).json()).error).toBe('Only a group can have a title');
    mocks.sql.mockResolvedValueOnce([guidedRow()]).mockResolvedValueOnce([{ target_is_lead: true, id: null }]);
    expect((await (await post({ action: 'set-title', cardId: 'c1', title: 'x' })).json()).error).toBe('The phase already changed');
  });
  it('400 for a title over 80 characters, before the database', async () => {
    const res = await post({ action: 'set-title', cardId: 'c1', title: 'x'.repeat(81) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Group title must be at most 80 characters');
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it('409 during Vote from the guard; 409 on an open board', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ phase: 'vote', settings: phaseSettings('vote') })]);
    expect((await (await post({ action: 'set-title', cardId: 'c1', title: 'x' })).json()).error).toBe('Not available during Vote');
    mocks.sql.mockResolvedValueOnce([ctxRow()]);
    expect((await (await post({ action: 'set-title', cardId: 'c1', title: 'x' })).json()).error).toBe('This board is not in guided mode');
    expect(mocks.sql).toHaveBeenCalledTimes(2);
  });
});

describe('reset', () => {
  it('a facilitator clears grouping in one statement that never names votes, then asks clients to refetch', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_is_admin: true })]).mockResolvedValueOnce([{ board_ok: true, cleared: 4 }]);
    const res = await post({ action: 'reset' });
    expect(await res.json()).toEqual({ ok: true, cleared: 4 });
    expect(callText(1)).toContain('merged_with = NULL, group_title = NULL');
    expect(callText(1)).not.toMatch(/\bvotes\b/);
    expect(channelPublish).toHaveBeenCalledWith('grouping-reset', { phase: 'group', refetch: true });
  });
  it('nothing to clear publishes nothing', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_is_admin: true })]).mockResolvedValueOnce([{ board_ok: true, cleared: 0 }]);
    await post({ action: 'reset' });
    expect(channelPublish).not.toHaveBeenCalled();
  });
  it('403 for a participant; 409 when the phase moved after the load', async () => {
    mocks.sql.mockResolvedValueOnce([guidedRow()]);
    expect((await post({ action: 'reset' })).status).toBe(403);
    mocks.sql.mockResolvedValueOnce([guidedRow({ cp_is_admin: true })]).mockResolvedValueOnce([{ board_ok: false, cleared: 0 }]);
    expect((await (await post({ action: 'reset' })).json()).error).toBe('The phase already changed');
  });
  it('400 for an unknown action or a missing cardId', async () => {
    expect((await post({ action: 'shuffle' })).status).toBe(400);
    expect((await post({ action: 'set-title', title: 'x' })).status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run app/api/boards/\[boardId\]/groups`. Expected: FAIL, route not found.
- [ ] **Step 3: Implement.** Statements:

```sql
-- set-title
WITH target AS (
  SELECT c.id,
    (c.merged_with IS NULL AND EXISTS (SELECT 1 FROM cards ch WHERE ch.board_id = c.board_id AND ch.merged_with = c.id)) AS is_lead
  FROM cards c WHERE c.id = $cardId AND c.board_id = $boardId
), updated AS (
  UPDATE cards SET group_title = $title FROM target
  WHERE cards.id = target.id AND target.is_lead
    AND EXISTS (SELECT 1 FROM boards WHERE id = $boardId AND phase = $phase AND archived_at IS NULL AND deleted_at IS NULL)
  RETURNING cards.*
)
SELECT t.is_lead AS target_is_lead, u.* FROM target t LEFT JOIN updated u ON u.id = t.id

-- reset
WITH ok AS (
  SELECT 1 FROM boards WHERE id = $boardId AND phase = $phase AND archived_at IS NULL AND deleted_at IS NULL
), cleared AS (
  UPDATE cards SET merged_with = NULL, group_title = NULL
  WHERE board_id = $boardId AND (merged_with IS NOT NULL OR group_title IS NOT NULL) AND EXISTS (SELECT 1 FROM ok)
  RETURNING id
)
SELECT EXISTS (SELECT 1 FROM ok) AS board_ok, (SELECT COUNT(*) FROM cleared)::int AS cleared
```

The returned card is the row without `target_is_lead`. Import `ably-server` inside the handler.

- [ ] **Step 4: Run** the test file, then `npm test && npx tsc --noEmit && npx eslint app/api/boards/\[boardId\]/groups`. Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat(api): group titles and reset grouping on guided boards`

---

### Task 7: Client state for guided votes, titles, reset and the tally

**Files:**
- Create: `stores/groupVoteStore.ts`
- Modify: `stores/boardStore.ts` (`voteTally` in state, `initialState`, `fetchBoard`), `hooks/useBoardChannel.ts`
- Test: `lib/__tests__/group-vote-store.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers (`applyVoteDelta`, `settleOwnVote`, `applyVoteTally`, `myVotesOn`, `votesUsedBy`, `maxVotesPerCard`, `voteControlState`, `validateGroupTitle`, `ungroupAll`, `isLeadCard`); Task 4 and Task 6 routes; `failWrite`, `refetchRouteFor`, `refetchBoardCoalesced`.
- Produces:
  - `useBoardStore` state `voteTally: VoteTally | null`; `fetchBoard` sets it from the response's `voteTally` (null when absent); `reset()` clears it.
  - `useGroupVoteStore` with `resetting: boolean`, `addVote(cardId: string): Promise<void>`, `removeVote(cardId: string): Promise<void>`, `toggleGuidedVote(cardId: string): Promise<void>`, `setGroupTitle(cardId: string, title: string | null): Promise<void>`, `resetGrouping(): Promise<void>`. Fallback messages: `Failed to add vote`, `Failed to remove vote`, `Failed to save the group title`, `Failed to reset grouping`.
  - `useBoardChannel`: `case 'vote-tally'` sets `voteTally: applyVoteTally(state.voteTally, data)`; `case 'grouping-reset'` refetches through `refetchCompletionEvent(data)` (coalesced, since the payload carries a phase).

Behaviour:
- `addVote` and `removeVote` do nothing unless the board is guided and there is a current participant; `addVote` also returns without a request when `voteControlState(...).canAdd` is false (the control is disabled then).
- Each click applies `applyVoteDelta` at once and increments a module-level pending counter keyed `${boardId}:${cardId}`; it also keeps, per key, the newest server result by `tally.at`. When a response arrives for a board that is no longer `useBoardStore.getState().board?.id`, nothing is applied. On success the tally goes through `applyVoteTally`; when the key's pending count reaches 0, `settleOwnVote` applies the newest result (the one with the greatest `at`, not the last to arrive). On failure that click's delta is reversed (same board only) and `failWrite` rejects. An add's result is the response's `vote`; a remove's result is the local row with the response's `count`, or null when `count` is 0. Add sends `{ cardId, action: 'add', voteId }` with the existing row's id or `crypto.randomUUID()`; remove sends `{ cardId, action: 'remove' }`.
- `toggleGuidedVote` calls `removeVote` when `myVotesOn(...) > 0`, else `addVote`.
- Controller ruling (a late GET must not undo a newer tally): `fetchBoard` applies the GET's `voteTally` only if no vote response and no `vote-tally` event has been applied since that GET started. Keep a module-level counter that every applied vote response and `vote-tally` event increments; `fetchBoard` reads it before the request and, when the response arrives, takes the GET's tally only if the counter is unchanged (a board with no tally yet always takes it). Put the decision in a pure function in `lib/votes.ts` (for example `tallyAfterFetch(current, fromGet, changedSince)`) with tests written first, and add a store test: a `vote-tally` event with `used: 5` arrives while a GET that will answer `used: 4` is in flight; after the GET resolves the tally is still 5.
- `setGroupTitle` validates with `validateGroupTitle` (an invalid title rejects with its error and sends nothing), sets `group_title` optimistically, posts `{ action: 'set-title', cardId, title }`, and on failure restores the previous title only if the card still shows the optimistic one, then rejects via `failWrite`.
- `resetGrouping` ignores a call while `resetting`; no optimistic change (the server decides, as with phase moves); on success applies `ungroupAll` to the same board's cards; on failure rejects via `failWrite`.

- [ ] **Step 1: Write the failing tests**, reusing the `board()`, `json()`, `routes()` and `localStorage` scaffolding from `lib/__tests__/phase-store.test.ts`, with a guided board in Vote (`settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings('vote'), max_votes_per_participant: 5, max_votes_per_card: 3 }`), `currentParticipantId: 'p1'`, and two cards `c1`, `c2`. A `deferred()` helper returns `{ promise, resolve }` so tests can control response order.

```ts
const vote = (count: number, id = 'v1') => ({ id, card_id: 'c1', board_id: 'b1', voter_id: 'p1', count, created_at: 'x' });

it('addVote shows the vote at once, posts add, then applies the server count and tally', async () => {
  const d = deferred<Response>();
  fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
  const p = useGroupVoteStore.getState().addVote('c1');
  expect(useBoardStore.getState().votes).toEqual([expect.objectContaining({ card_id: 'c1', count: 1 })]);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ cardId: 'c1', action: 'add' });
  d.resolve(json(200, { action: 'added', vote: vote(1), tally: { used: 1, at: 10 } }));
  await p;
  expect(useBoardStore.getState().votes).toEqual([vote(1)]);
  expect(useBoardStore.getState().voteTally).toEqual({ used: 1, at: 10 });
});

it('two quick adds whose answers arrive out of order settle on the newer server count', async () => {
  const first = deferred<Response>(); const second = deferred<Response>();
  fetchMock = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise); vi.stubGlobal('fetch', fetchMock);
  const a = useGroupVoteStore.getState().addVote('c1');
  const b = useGroupVoteStore.getState().addVote('c1');
  second.resolve(json(200, { action: 'added', vote: vote(2), tally: { used: 2, at: 20 } }));
  await b;
  expect(useBoardStore.getState().votes[0].count).toBe(2); // first still pending: optimistic stays
  first.resolve(json(200, { action: 'added', vote: vote(1), tally: { used: 1, at: 10 } }));
  await a;
  expect(useBoardStore.getState().votes[0].count).toBe(2);
  expect(useBoardStore.getState().voteTally).toEqual({ used: 2, at: 20 });
});

it('a refused add reverses only its own delta and rejects with the server message', async () => {
  useBoardStore.setState({ votes: [vote(3)] });
  routes({ 'POST /api/boards/b1/votes': () => json(422, { error: 'You can put at most 3 votes on one card', maxVotesPerCard: 3 }) });
  useBoardStore.setState({ board: board({ settings: { ...useBoardStore.getState().board!.settings, max_votes_per_card: 4 } }) });
  await expect(useGroupVoteStore.getState().addVote('c1')).rejects.toThrow('You can put at most 3 votes on one card');
  expect(useBoardStore.getState().votes).toEqual([vote(3)]);
  expect(useBoardStore.getState().lastWriteError).toBe('You can put at most 3 votes on one card');
});

it('addVote at the per-card limit sends nothing', async () => {
  useBoardStore.setState({ votes: [vote(3)] });
  routes({});
  await useGroupVoteStore.getState().addVote('c1');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('an answer for a board the user has left changes nothing', async () => {
  const d = deferred<Response>();
  fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
  const p = useGroupVoteStore.getState().addVote('c1');
  useBoardStore.setState({ board: board({ id: 'b2' }), votes: [] });
  d.resolve(json(200, { action: 'added', vote: vote(1), tally: { used: 1, at: 10 } }));
  await p;
  expect(useBoardStore.getState().votes).toEqual([]);
  expect(useBoardStore.getState().voteTally).toBeNull();
});

it('removeVote of the last vote removes the row; toggleGuidedVote picks add or remove', async () => {
  useBoardStore.setState({ votes: [vote(1)] });
  routes({ 'POST /api/boards/b1/votes': () => json(200, { action: 'removed', voteId: 'v1', count: 0, tally: { used: 0, at: 30 } }) });
  await useGroupVoteStore.getState().toggleGuidedVote('c1');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: 'remove' });
  expect(useBoardStore.getState().votes).toEqual([]);
});

it('setGroupTitle is optimistic and reverts on a phase refusal, which refetches', async () => {
  useBoardStore.setState({ board: board({ phase: 'group', settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings('group') } }),
    cards: [{ ...cardFixture('c1'), group_title: 'Old' }, { ...cardFixture('c2'), merged_with: 'c1' }] });
  routes({
    'POST /api/boards/b1/groups': () => json(409, { error: 'Not available during Vote' }),
    'GET /api/boards/b1': getBoardResponse(board()),
  });
  const p = useGroupVoteStore.getState().setGroupTitle('c1', 'New');
  expect(useBoardStore.getState().cards[0].group_title).toBe('New');
  await expect(p).rejects.toThrow('Not available during Vote');
  expect(fetchMock.mock.calls.map((c) => `${c[1]?.method ?? 'GET'} ${String(c[0]).split('?')[0]}`)).toContain('GET /api/boards/b1');
});

it('setGroupTitle refuses an over-long title without a request', async () => {
  routes({});
  await expect(useGroupVoteStore.getState().setGroupTitle('c1', 'x'.repeat(81))).rejects.toThrow('Group title must be at most 80 characters');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('resetGrouping ungroups on success and ignores a second call in flight', async () => {
  useBoardStore.setState({ cards: [cardFixture('c1'), { ...cardFixture('c2'), merged_with: 'c1' }] });
  const d = deferred<Response>();
  fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
  const p = useGroupVoteStore.getState().resetGrouping();
  await useGroupVoteStore.getState().resetGrouping();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  d.resolve(json(200, { ok: true, cleared: 1 }));
  await p;
  expect(useBoardStore.getState().cards.every((c) => c.merged_with === null)).toBe(true);
});

it('fetchBoard keeps the voteTally from the GET, and null when there is none', async () => {
  routes({ 'GET /api/boards/b1': () => json(200, { ...JSON.parse(JSON.stringify(baseGet)), voteTally: { used: 4, at: 0 } }) });
  await useBoardStore.getState().fetchBoard('b1');
  expect(useBoardStore.getState().voteTally).toEqual({ used: 4, at: 0 });
});
```

(`cardFixture(id)` builds a full `Card` with `merged_with: null`; `baseGet` is the body `getBoardResponse` returns.)

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/group-vote-store.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `stores/groupVoteStore.ts`, the `voteTally` state in `boardStore.ts`, and the two `useBoardChannel` cases.
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit && npx eslint stores hooks/useBoardChannel.ts`. Expected: PASS (including `phase-store.test.ts`), clean.
- [ ] **Step 5: Commit** `feat(client): guided vote, group title and reset actions; team tally from events`

---

### Task 8: Every view counts votes by their count

**Files:**
- Modify: `components/Board/BoardColumn.tsx`, `components/Board/MobileBoardShell.tsx`, `components/Board/SwimlaneView.tsx`, `components/Board/ListView.tsx`, `components/Board/TimelineView.tsx`, `components/pages/BoardPage.tsx` (the `VoteStatus` `votesUsed`), `utils/export.ts`

**Interfaces:**
- Consumes: `voteTotalsByCard`, `votesUsedBy`, `groupScore` (Task 1).
- Produces: no new exports. Every per-card total, column total, sort key and "votes used" that counts vote rows today uses the weight helpers instead. `MobileBoardShell` gives a root card `voteCount = groupScore(...)` on a guided board and keeps its own card's total on an open board.

Decision recorded here: on phones the lead card's count excludes its children today (the desktop grid includes them); guided boards get the group score so Discuss matches the desktop, and open boards keep what they show now. List, swimlane and timeline keep their per-card totals; group scores there arrive with Step 3's ranked agenda.

- [ ] **Step 1: Replace the counting.** Each `map.set(v.card_id, (map.get(v.card_id) || 0) + 1)` loop becomes `voteTotalsByCard(votes)`; each `votes.filter((v) => v.voter_id === currentParticipantId).length` becomes `votesUsedBy(votes, currentParticipantId)`; each `votes.filter((v) => v.card_id === card.id).length` becomes the card's total from the map; `BoardColumn`'s `columnVoteCount` sums totals of the column's cards. No markup changes.
- [ ] **Step 2: Check none is left.**

Run: `grep -nE "votes\.filter\([^)]*\)\.length|\(map\.get\(v\.card_id\) \|\| 0\) \+ 1" components utils`
Expected: no output.

- [ ] **Step 3: Run** `npm test && npx tsc --noEmit && npx eslint <the seven files>`. Expected: PASS (Task 1 already proves rows without `count` give the old numbers), clean.
- [ ] **Step 4: Observe in a browser** (dev server per the Global Constraints). On an open board with three participants voting (votes cast through the API as in the multi-user playbook), counts, column totals and Most votes order look exactly as on `feature/guided-mode-hardening` at 1280px, 390px and 360px, in light and dark. On a guided board taken to Discuss with a two-card group, the lead card shows the group's total on desktop and on a 390px phone. Record what was seen.
- [ ] **Step 5: Commit** `refactor(votes): every view counts votes by their count`

---

### Task 9: Guided vote controls, team votes left and vote limits

**Files:**
- Create: `components/Board/GuidedVoteControl.tsx`, `components/Board/TeamVotesLeft.tsx`, `components/Board/VoteLimits.tsx`, `hooks/useTeamVotesLeft.ts`
- Modify: `components/Board/RetroCard.tsx`, `components/Board/BoardColumn.tsx`, `components/Board/MobileVoteTracker.tsx`, `components/Board/MobileBoardShell.tsx`, `components/Board/MobileMoreSheet.tsx`, `components/pages/BoardPage.tsx`, `e2e/guided-mode.spec.ts`

**Interfaces:**
- Consumes: `useGroupVoteStore` (Task 7), `useBoardStore` (`board`, `votes`, `participants`, `voteTally`, `currentParticipantId`, `updateSettings`), `voteControlKind`, `voteControlState`, `myVotesOn`, `votesUsedBy`, `maxVotesPerCard`, `teamVotesLeftFor`, `teamVotesLabel`, `voteLimitsEditable`, `voteLimitProblem`, `MAX_VOTES_PER_PARTICIPANT_RANGE`, `MAX_VOTES_PER_CARD_RANGE` (Task 1), `usePhaseGates`.
- Produces:
  - `useTeamVotesLeft(): number | null` (one store selector over `teamVotesLeftFor(board, participants.length, voteTally)`; returns a primitive so it re-renders only when the number changes).
  - `<GuidedVoteControl cardId: string childCard: boolean />`.
  - `<TeamVotesLeft />`.
  - `<VoteLimits layout?: 'inline' | 'stacked' />`.
  - `RetroCard` gains `isChildCard?: boolean` (default false); `BoardColumn` passes `true` for expanded children.
  - `MobileVoteTracker` gains `teamLeft?: number | null`.

Controller ruling (no extra work on open boards): `RetroCard` renders once per card on every board, so anything this task or Task 10 mounts inside it must cost an open board nothing. Each component that reads a store from inside `RetroCard` uses selectors that return primitives (a number, a boolean, a string or null) and that return their "not guided" value before touching `cards`, `votes` or `participants` when `board.mode` is not guided. No selector returns a new array or object. On an open board `RetroCard`'s output and the number of times it renders for a given store change must be what they are today; say in the report how you confirmed it.

Behaviour:
- Who counts toward the team total: every participant who has joined the board (`participants`, already public in the board GET and kept current by `participant-joined` and `participant-removed`). Presence was rejected: it flaps when a laptop sleeps, and subtracting only online people's votes would need per-person data. This matches Parabol, which counts everyone who joined the meeting. The number comes from the tally (GET baseline, vote responses, `vote-tally` events); nothing is fetched on render or on a timer.
- `RetroCard` reads `voteControlKind(board.mode, board.settings)` and `usePhaseGates().guided` from the stores. On a guided board, while voting is on and the board is not completed: a child card renders `<GuidedVoteControl childCard />`; a root card renders `<GuidedVoteControl childCard={false} />` when the kind is `stepper`, else the existing `VotePill`. Everywhere else `VotePill` renders exactly as today.
- `GuidedVoteControl`: a `role="group"` with `aria-label="Your votes on this card"` and `data-testid="vote-stepper"`; a minus button `aria-label="Remove a vote"` (disabled when `!canRemove`), the person's own count, a plus button `aria-label="Add a vote"` (disabled when `!canAdd`, `title` set to `addBlockedReason`). A child card shows the control only when the person has votes on it, and never the plus button. Buttons are at least 44px on phones (`min-h-11 min-w-11 sm:min-h-0 sm:min-w-0`, as `VotePill` does). Handlers call `addVote` and `removeVote` and catch the rejection (the message already reaches the banner).
- `BoardPage` passes `onToggleVote={guided ? toggleGuidedVote : toggleVote}` wherever it passes `toggleVote` today, so a guided board with a limit of 1 keeps today's single button but sends add or remove.
- `TeamVotesLeft` renders `useTeamVotesLeft()` through `teamVotesLabel`, `data-testid="team-votes-left"`, beside `VoteStatus` in the desktop header; nothing when null. `MobileBoardShell` passes `teamLeft={useTeamVotesLeft()}` to `MobileVoteTracker`, which shows `teamVotesLabel(teamLeft)` as a second line under "x of y used" when it is a number. Both "used" figures come from `votesUsedBy`.
- `VoteLimits` (facilitator only, shown while `voteLimitsEditable(board)`): a `Vote limits` button opens an inline form with two number inputs, `Votes per person` (min 1, max 99) and `Votes per card` (min 1, max the smaller of 12 and the per-person value), and `Save` and `Cancel` buttons. Save sends only the changed keys through `updateSettings`; before sending, `voteLimitProblem` blocks the save and shows its message; a rejection shows its message under the inputs and keeps the form open. The form remembers the phase it was opened in and closes when the phase changes or `voteLimitsEditable` turns false (as `PhaseDeadline` does); Escape closes it. Mounted in the desktop guided phase row after `PhaseDeadline` when `isAdmin`, and in `MobileMoreSheet`'s facilitator section with `layout="stacked"`.
- `e2e/guided-mode.spec.ts`: right after its guided `createBoard`, add `expect((await patchSettings(ctxA.request, boardId, { max_votes_per_card: 1 })).status()).toBe(200);` so that spec keeps exercising the limit-1 control it already asserts ("Vote for this card", "Remove vote"); the stepper is covered in Task 11.

- [ ] **Step 1: Build the hook and the three components**, with the design tokens neighbouring components use (`--accent`, `--accent-soft`, `--ink-*`, `--line`, `--r-md`).
- [ ] **Step 2: Wire `RetroCard`, `BoardColumn`, `MobileVoteTracker`, `MobileBoardShell`, `MobileMoreSheet` and `BoardPage`**, and edit `e2e/guided-mode.spec.ts`.
- [ ] **Step 3: Run** `npx tsc --noEmit && npm test && npx eslint <the changed files>`. Expected: clean.
- [ ] **Step 4: Observe in a browser** with two browser profiles on a guided dev board in Vote, at 1280px, 390px and 360px, light and dark: the stepper shows 0, then 1, 2, 3 as Add is pressed; at 3 the plus is disabled and its tooltip reads `You can put at most 3 votes on one card`; at 5 used across cards every plus is disabled with `No votes left`; `Team: 7 votes left` (two people, 5 each, 3 used) changes on the other profile without a reload; the phone tracker reads `3 of 5 used` and `Team: 7 votes left` without overflow at 360px; expanded child cards show no plus. `Vote limits` lowering per person below what was spent shows `Votes per person cannot go below 4. Someone has already used 4.` and leaves the values as they were; raising saves. Setting per card to 1 turns the stepper back into the single button. An open board shows the same vote button, header and tracker as before. Record what was seen.
- [ ] **Step 5: Run** `npx playwright test e2e/guided-mode.spec.ts`. Expected: all PASS.
- [ ] **Step 6: Commit** `feat(ui): add and remove votes, team votes left and vote limits on guided boards`

---

### Task 10: Inline group titles and reset grouping

**Files:**
- Create: `components/Board/GroupTitle.tsx`, `components/Board/ResetGrouping.tsx`, `components/Board/ResetGroupingDialog.tsx`
- Modify: `components/Board/RetroCard.tsx`, `components/Board/MobileMoreSheet.tsx`, `components/pages/BoardPage.tsx`

**Interfaces:**
- Consumes: `useGroupVoteStore` (`setGroupTitle`, `resetGrouping`, `resetting`), `useBoardStore` (`board`, `cards`, `currentParticipantId`), `usePhaseGates` (`guided`, `phase`, `moveLocked`), `visibleGroupTitle`, `isLeadCard`, `hasGrouping`, `GROUP_TITLE_MAX`, `Modal`, `Button`, `useFocusTrap`.
- Produces: `<GroupTitle cardId: string />`, `<ResetGrouping layout?: 'inline' | 'stacked' />`, `<ResetGroupingDialog open: boolean busy: boolean onCancel: () => void onConfirm: () => void />`.

The controller ruling in Task 9 about components mounted inside `RetroCard` applies here: `GroupTitle` selects a primitive (the visible title or null, and whether the card is a lead) and returns the "not guided" value before reading `cards` on an open board.

Behaviour:
- `GroupTitle` renders nothing unless the board is guided and `isLeadCard(cardId, cards)` (so it works on phones, where `RetroCard` gets no `childCards`). It shows the visible title (`data-testid="group-title"`) above the card text. Editing is allowed when `!moveLocked` (the Group phase), the viewer has joined and the board is not completed: a button `aria-label="Name this group"` (no title yet, shown as the placeholder text `Name this group`) or `aria-label="Rename group"` (beside a title) opens an input `aria-label="Group title"`, placeholder `Name this group`, prefilled with the title. Enter or blur saves through `setGroupTitle` (an empty value clears the title); Escape cancels. Past 60 characters a counter `{n} of 80` shows; input beyond 80 code points is not accepted. The open editor remembers its phase and closes without saving when the phase changes. A rejected save keeps the editor open with the typed text and shows the message.
- `RetroCard` renders `<GroupTitle cardId={id} />` at the top of the card body.
- `ResetGrouping` (facilitator only, guided, not completed, `!moveLocked`): a `Reset grouping` button, disabled with `title="Nothing to reset"` when `!hasGrouping(cards)`. It opens `ResetGroupingDialog`: `Modal` titled `Reset grouping?`, body `Every group goes back to single cards and every group title is cleared. Votes stay as they are.`, buttons `Cancel` and `Reset grouping` (busy while `resetting`). The dialog's content uses `useFocusTrap(open)`; focus lands on `Cancel`. The open state remembers its phase and closes if the phase changes. Confirm calls `resetGrouping`, catches the rejection, and closes on success. Mounted in the desktop guided phase row after `VoteLimits` when `isAdmin`, and in `MobileMoreSheet`'s facilitator section with `layout="stacked"`.

- [ ] **Step 1: Build the three components.**
- [ ] **Step 2: Mount** `GroupTitle` in `RetroCard` and `ResetGrouping` in `BoardPage` and `MobileMoreSheet`.
- [ ] **Step 3: Run** `npx tsc --noEmit && npm test && npx eslint <the changed files>`. Expected: clean.
- [ ] **Step 4: Observe in a browser** with two profiles on a guided board in Group, at 1280px, 390px and 360px, light and dark: grouping two cards shows `Name this group` on the lead; typing `Deploys` and pressing Enter shows it on the other profile without a reload, on desktop and phone; an 81st character is not accepted and the counter reads `80 of 80`; ungrouping the last child hides the title and regrouping the same lead shows it again; moving to Vote with the editor open closes it and the title is no longer editable. `Reset grouping` opens the dialog with focus on `Cancel`, Tab stays inside, Escape closes; confirming splits every group and clears titles on both profiles without a reload, and both profiles' vote counts are unchanged in Discuss. The participant profile shows no reset button. An open board shows no title or reset control and its combine and uncombine work as before. Record what was seen.
- [ ] **Step 5: Commit** `feat(ui): inline group titles and reset grouping`

---

### Task 11: Two-browser end-to-end run and verification

**Files:**
- Create: `e2e/guided-group-vote.spec.ts`
- Modify: `e2e/helpers.ts`

**Interfaces:**
- Consumes: everything above; existing helpers (`createBoard`, `apiJoin`, `joinAs`, `capture`, `hasJsonField`, `waitForRealtime`, `apiAddCard`, `apiMovePhase`, `patchSettings`, `getBoard`, `setFlagDirect`, `shown`).
- Produces (`e2e/helpers.ts`):
  - `apiVote(request: APIRequestContext, boardId: string, cardId: string, action: 'add' | 'remove')` returning the raw response.
  - `apiGroups(request: APIRequestContext, boardId: string, body: Record<string, unknown>)` returning the raw response.
  - `apiCombine(request: APIRequestContext, boardId: string, childId: string, parentId: string | null)` (card PATCH of `merged_with`) returning the raw response.
  - `hasJsonNumber(haystack: string, key: string, n: number): boolean` (like `hasJsonField`, for a number value).
  - `voteRowsDirect(boardId: string): Promise<{ voter_id: string; card_id: string; count: number }[]>`: read-only, ordered by `voter_id, card_id`, with the same dev-only guards as `cardUpdatedAt`.

- [ ] **Step 1: Write the spec.** `beforeAll` calls `setFlagDirect('guided_mode', true)`. Each test builds its own guided board with A (facilitator, from `createBoard(..., { mode: 'guided' })`) and B (joined), adds cards in Reflect through `apiAddCard`, and moves phases with `apiMovePhase` unless the UI is under test.

```ts
test('concurrent adds from one person never pass either limit', async ({ browser }) => {
  // In Vote, B fires eight apiVote(..., c1, 'add') at once from one request context (two tabs share a cookie jar).
  // Exactly three are 200; five are 422 'You can put at most 3 votes on one card'. voteRowsDirect: B has count 3 on c1.
  // B then fires three adds on c2 and three on c3 at once: exactly two are 200, four are 422 'Vote limit reached'.
  // The sum of B's counts from voteRowsDirect is 5 (Review Focus 1).
});

test('a participant never learns another person\'s count during Vote', async ({ browser }) => {
  // capture() on both pages from the first request. A adds 3 on c1 with the stepper; A's stepper reads 3.
  // B adds 2 on c2 with the stepper. Controls: hasJsonNumber(capB, 'count', 2) (B's own count arrives),
  // hasJsonNumber(capB, 'used', 5) and capB contains 'vote-tally' (the aggregate arrives),
  // hasJsonField(capB, 'display_name', <A's name>) (matcher control).
  // Absence: hasJsonField(capB, 'voter_id', aliceId) is false; capB has no 'vote-cast'; B's GET votes are only B's row.
  // B's page shows 'Team: 5 votes left' (2 people x 5 - 5) without a reload.
  // A moves to Discuss: A's voter_id arrives in capB within 10s (the absence was real) and c1's pill reads '3 votes'
  // (Review Focus 4).
});

test('lowering a limit below what is spent is refused and changes nothing', async ({ browser }) => {
  // B has 4 votes, at most 2 on one card. patchSettings(A, { max_votes_per_participant: 3 }) is 409
  // 'Votes per person cannot go below 4. Someone has already used 4.'; { max_votes_per_card: 1 } is 409
  // 'Votes per card cannot go below 2. Someone already has 2 on one card.'; getBoard settings are unchanged.
  // { max_votes_per_participant: 6 } is 200. B's patchSettings is 403 (Review Focus 3).
});

test('grouping, ungrouping and reset never change a vote, and a group scores its lead plus children', async ({ browser }) => {
  // Vote: A adds 2 on c1, B adds 1 on c2. before = voteRowsDirect(boardId).
  // Back to Group. apiCombine(c2 -> c1); ungroup (null); combine again; set a title; then A resets through the UI
  // (Reset grouping, confirm). After every step voteRowsDirect equals before.
  // Both pages show no [data-testid="group-title"] after the reset, without a reload.
  // Combine c2 into c1 again, move to Vote then Discuss: c1's pill on A reads '3 votes' (Review Focus 5).
});

test('group titles: anyone names a group during Group only; reset is the facilitator\'s', async ({ browser }) => {
  // Group, c2 combined into c1. B names the group 'Deploys' through the UI; A sees 'Deploys' without a reload.
  // apiGroups(B, set-title, 81 chars) is 400 'Group title must be at most 80 characters'; on c3 (not a lead) 409
  // 'Only a group can have a title'; apiGroups(B, { action: 'reset' }) is 403 'Facilitator access required'.
  // A moves to Vote: B's set-title is 409 'Not available during Vote'; the title still shows on both pages.
});

test('a drop that lands after a reset groups only the cards in that drop', async ({ browser }) => {
  // Group with c2 and c3 combined into c1 and votes from an earlier Vote on c1.
  // A resets; then B's apiCombine(c3 -> c2) is 200. getBoard: exactly one card has merged_with (c3 -> c2);
  // voteRowsDirect is unchanged; A's page shows one group, without a reload (Review Focus 7).
});

test('an open board\'s votes are unchanged', async ({ browser }) => {
  // Open board, voting on. A's POST votes { cardId } is 200 with Object.keys(json).sort() equal to ['action', 'vote']
  // and action 'added'; again is { action: 'removed' }. { cardId, action: 'add' } is 409 'This board is not in guided mode';
  // apiGroups reset is 409 the same; patchSettings({ max_votes_per_card: 2 }) is 409
  // 'Votes per card is only available on guided boards'. The page shows 'Vote for this card' and no
  // [data-testid="vote-stepper"], [data-testid="team-votes-left"] or 'Reset grouping' (Review Focus 6).
});
```

- [ ] **Step 2: Run** `npx playwright test e2e/guided-group-vote.spec.ts`. Expected: 7 passed. Fix the product, not the test; a failure that needs a design change stops the task and goes back to the controller.
- [ ] **Step 3: Run the full suites.**

Run: `npx tsc --noEmit && npm test && npm run test:e2e`
Expected: `tsc` clean; every unit test passes (733 before this plan plus the new ones; report the count and file count); e2e 92 passed (85 plus 7), 0 failed, 1 skipped. Report the three counts.

- [ ] **Step 4: Stop the dev server by its PID, confirm `lsof -ti tcp:3001` prints nothing, then run** `npm run build`. Expected: build passes.
- [ ] **Step 5: Commit** `test(e2e): group and vote parity across two browsers` (stage `e2e/guided-group-vote.spec.ts` and `e2e/helpers.ts` by name).
- [ ] **Step 6: Hand back to the controller.** The controller, not the implementer, pushes `feature/guided-group-vote` and opens a PR to `feature/guided-mode-hardening` titled `Group and vote parity (Parabol parity Step 2)`. The description lists: migration 016 (dev applied, production not; production needs 015 first), the test counts, what was seen in the browser at each width and theme, the two design questions and their answers, and the "Out of this plan" list. It stays unmerged for Jordan.

---

## Out of this plan

- Offering several votes per card, group titles, reset grouping or the team count on open boards: a later decision for the owner. Open boards treat `max_votes_per_card` as absent (1) and refuse it.
- Group scores in the list, swimlane and timeline views (they show per-card totals on every board) and the ranked agenda across columns (Step 3).
- Comments on lead cards and topic-linked action items (Step 3); the summary (Step 4); AI-suggested groups and titles (Step 5).
- The dashboard's "Votes cast" statistic (`app/api/user/stats/route.ts`), which counts vote rows; it under-counts guided votes until it sums `count`, which must wait until production has 016 or use the `to_jsonb` technique.
- Live drag ghosts and similar-card search (Step 11).
- Applying 015 and 016 to production, which belongs to the promotion.
