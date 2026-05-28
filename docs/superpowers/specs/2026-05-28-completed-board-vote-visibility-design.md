# Completed-Board Vote Visibility — Design

**Date:** 2026-05-28
**Status:** Approved, pending implementation
**Author:** Jordan Lawson (with Claude)

## Problem

When a retro board is completed (archived), facilitators and teammates want to look back at what mattered and to whom. Today the post-completion view falls short on two counts:

1. **Vote counts are inconsistent and easy to miss.** Grid/Swimlane shows a small read-only count pill on cards with ≥1 vote when `secret_voting` is off; List/Timeline keeps showing an interactive vote button (a latent bug — clicking on a completed board is a server-no-op). When `secret_voting` was on during the session, counts are hidden forever, so the team can't see which cards resonated.
2. **Voter identity is never shown anywhere.** The `votes` table stores `voter_id` per vote and that data is already plumbed through every view, but no UI surfaces it. Once the retro is over, there is value in knowing *who* voted for *what* — useful for follow-up conversations and ownership.

Reactions already solve the same problem: `ReactionPill` reveals reactor names on hover/tap. Votes don't.

## Goals

- On completed boards, every view shows the vote count for each card with ≥1 vote, including boards that had `secret_voting` enabled during the session.
- Hovering (desktop) or tapping (touch) the vote pill reveals a tooltip with the participant names of the voters, capped and overflow-truncated like the reactor tooltip.
- A single `VotePill` component owns vote display across `RetroCard`, `ListView`, `TimelineView`, and the mobile shell — one source of truth, no per-view divergence.
- Boards that had `secret_voting` enabled reveal **counts only, not names** post-completion. The original anonymity promise is preserved.
- The latent "interactive vote button on completed board" bug in List/Timeline is closed as part of the rewrite.
- Behavior on active boards is unchanged — voters stay blind during the session to prevent influence.

## Non-goals

- Active-board voter reveal (intentionally kept blind).
- Admin-only voter reveal on active boards (no use case raised).
- A vote history timeline ("who unvoted when") — the data model doesn't track this.
- Markdown/CSV export changes for voter names — happy to follow up as a separate ticket if wanted; out of scope here.
- Migrating reaction tooltip behavior — `ReactionPill` keeps its current shape; we factor the popover primitive out so vote and reaction tooltips share it.
- A new admin permission or board setting to toggle this behavior — completed-board reveal is policy, not configuration.

## Architecture decisions

### A new `VotePill` component, parallel to `ReactionPill`

Three options considered:

| Option | Verdict |
|---|---|
| **A. Extract `VotePill`** (chosen) | One component owns vote display in every view. Encapsulates count + hover-voters + read-only/interactive modes + secret-voting policy. Mirrors `ReactionPill` structurally, so the patterns stay learnable. |
| B. Inline edits in each view | Faster to ship, but duplicates hover/tooltip logic four times and we drift over time — same divergence risk as the allergen-vocabulary incident. |
| C. Reuse `ReactionPill` directly | Tempting (90% overlap), but vote semantics (limit-reached, "Voted" badge for self in secret mode, no pill when count is 0) would force conditional spaghetti into `ReactionPill`. |

### Factor the popover primitive out of `ReactionPill`

Hover/tap show-hide timing, outside-click + ESC dismissal, touch detection, and the entry-list rendering are identical for reactors and voters. Lift those into a small `PeoplePopover` primitive that both pills consume. `ReactionPill` shrinks; `VotePill` reuses.

### Voter list formatting mirrors `formatReactorList`

A pure function `formatVoterList(voters, participants, currentParticipantId)` returns `{ entries, overflow }` with the same cap. Rename `MAX_REACTOR_NAMES = 8` to `MAX_PEOPLE_NAMES = 8` and share it between reactor and voter formatters. This makes the tooltip contract testable in isolation, matching the existing `formatReactorList.test.ts` pattern.

### Secret-voting policy is encoded in `VotePill`, not at call sites

Call sites pass `secretVoting` and `isCompleted` as flags. The pill decides what to render based on the table below. Encoding it at the component (not in each view) is what makes a single contract testable end-to-end.

## Display contract

```ts
interface VotePillProps {
  voteCount: number;
  voters: Vote[];                  // full vote rows for THIS card
  participants: Participant[];
  currentParticipantId: string | null;
  mode: 'interactive' | 'readonly';
  // Interactive-mode only:
  hasVoted?: boolean;
  voteLimitReached?: boolean;
  onToggleVote?: () => void;
  // Policy flags:
  secretVoting: boolean;
  isCompleted: boolean;
}
```

### Display matrix

| Board state | `secret_voting` | Count visible? | Voter names on hover? | Pill interactive? |
|---|---|---|---|---|
| Active | off | Yes when count > 0 | No (preserves blind voting during session) | Yes |
| Active | on | "Voted" badge for self only; no number | No | Yes |
| Completed | off | Yes when count > 0 | **Yes** | No |
| Completed | on | **Yes when count > 0** (reveal counts) | **No** (preserve original anonymity) | No |

### Zero-vote pill on completed boards

Hide. A "0" pill is visual noise and conveys nothing the absence of a pill doesn't already convey. Only render the pill when `voteCount > 0`.

### When does the popover open?

Only when there are names to reveal. Specifically: `mode === 'readonly' && !secretVoting && voters.length > 0`. In the secret-voting + completed case, the pill is a static count badge with no hover/tap target — opening an empty popover or one that just re-shows the count is noise.

### Tooltip contents

- Heading: `<ThumbsUp icon /> Voters` (matches `ReactionPill`'s `<emoji /> Reactions`).
- Body: list of names, up to 8 (`MAX_PEOPLE_NAMES`), current user marked `(You)` and styled with accent color.
- Overflow: `+ N more` line if voter count exceeds the cap.
- If a `voter_id` doesn't resolve in `participants` (departed participant), show `Someone` — matches `formatReactorList` fallback.
- Empty case: pill is hidden entirely; tooltip never renders.

## View coverage

| View | Today | After |
|---|---|---|
| `RetroCard` (grid + swimlane) | Read-only pill (count only, gated by `secretVoting` and `voteCount > 0`) | `<VotePill mode="readonly" />` when `isCompleted`; otherwise `<VotePill mode="interactive" />`. Same component, two modes. |
| `ListView` | Interactive `<button>` even when completed (latent bug) | `<VotePill mode={isCompleted ? 'readonly' : 'interactive'} />`. Bug closed. |
| `TimelineView` | Same latent bug as List | Same fix as List. |
| Mobile (`MobileBoardShell` cards) | Uses `RetroCard` → inherits | Inherits automatically. |
| `MobileVoteTracker` | Per-participant vote summary (not per-card) | No change — different concern. |

## Touch and accessibility

- **Touch — read-only mode (non-secret completed board):** Tap opens the popover with voter names. No toggle action is available.
- **Touch — read-only mode (secret completed board):** Pill is a static count badge. No popover, no toggle.
- **Touch — interactive mode (active board):** Tap toggles the vote, same as today. Popover does not render because there are no names to show during an active session.
- **Keyboard:** Focusing the pill opens the popover (parity with hover, applies only when the popover-opens condition is met). ESC closes it. Pill remains a `<button>` and tab-focusable in all modes.
- **ARIA:** Popover gets `role="tooltip"` (matches reactor). Pill `aria-label` reflects state: `"N votes — hover to see voters"` in non-secret readonly mode, `"N votes"` in secret readonly mode, `"Vote for this card"` / `"Remove vote"` in interactive mode (current behavior preserved).

## Tests

All Vitest, mirroring existing `formatReactorList.test.ts` and the project's `lib/__tests__/` convention. The project currently runs Vitest in `node` environment with the include glob `lib/**/*.test.ts` and `app/**/*.test.ts` — no React Testing Library, no jsdom. Rather than add that infrastructure for one component, we extract the display policy into a pure function and test it exhaustively. The React component becomes a thin renderer over that policy's output.

### Decision function

`lib/votePillPolicy.ts` exports `votePillPolicy(input)` which returns a structured decision:

```ts
interface VotePillPolicyInput {
  voteCount: number;
  mode: 'interactive' | 'readonly';
  hasVoted: boolean;
  secretVoting: boolean;
  isCompleted: boolean;
}

interface VotePillPolicyOutput {
  render: 'pill' | 'voted-badge' | 'none';   // top-level: do we show anything?
  showCount: boolean;                          // numeric count visible on the pill?
  popover: 'voters' | 'none';                  // does hover/tap open the names popover?
  interactive: boolean;                        // is the pill a vote-toggle button?
  ariaLabel: string;
}
```

The component reads this and renders accordingly. All policy edge cases are tested without rendering React.

### Test files

- **`lib/__tests__/formatVoterList.test.ts`** — voter list formatting: name resolution, "Someone" fallback for unknown ids, current-user marking, overflow cap at `MAX_PEOPLE_NAMES`. Mirrors `formatReactorList.test.ts` row-for-row.
- **`lib/__tests__/votePillPolicy.test.ts`** — exhaustive table-driven test of the display matrix from §"Display contract":
  - Active + non-secret + count > 0 → `render: 'pill'`, `showCount: true`, `popover: 'none'`, `interactive: true`.
  - Active + non-secret + count == 0 → `render: 'pill'` (with no count text), `interactive: true` (vote button still present).
  - Active + secret + hasVoted → `render: 'voted-badge'`, `showCount: false`, `popover: 'none'`, `interactive: true`.
  - Active + secret + !hasVoted → `render: 'pill'` (empty vote button), `interactive: true`.
  - Completed + non-secret + count > 0 → `render: 'pill'`, `showCount: true`, `popover: 'voters'`, `interactive: false`.
  - Completed + non-secret + count == 0 → `render: 'none'`.
  - Completed + secret + count > 0 → `render: 'pill'`, `showCount: true`, `popover: 'none'`, `interactive: false` (contract test for the secret-voting reveal policy).
  - Completed + secret + count == 0 → `render: 'none'`.
- **One round-trip vocabulary contract test** in `lib/__tests__/votePillPolicy.test.ts` that calls the policy with a representative completed+secret input and asserts `popover === 'none' && showCount === true` — explicitly named so a future regression is loud (e.g., `it('CONTRACT: secret-voting + completed reveals counts but hides voter names', ...)`).

### What is NOT covered by tests

- Visual rendering of the React component (no jsdom). Verified manually during `ui-feature-verify`.
- The hover/tap timing of the popover (lives in `PeoplePopover`, untested by this plan because the refactored-out component preserves `ReactionPill`'s existing behavior verbatim — verified by the existing emoji-reaction manual UX flow).
- Cross-view rendering integration. The contract is enforced because all three views call `<VotePill />` with the same flags — there is no per-view decision branch to test.

No Playwright. The behavior is observable in pure unit tests plus a browser pass during `ui-feature-verify`.

## Migration / rollout

- No DB migration. All required data (`votes.voter_id`) is already stored, fetched, and plumbed through to every view.
- No feature flag. Behavior change is a strict superset (counts revealed where previously hidden under secret-voting completion; voter names revealed where previously absent on completed boards). No regressions on active-board behavior.
- Backward compatibility: legacy boards with `secret_voting=true, archived_at=set` will start showing counts on next page load. This is intentional — the team explicitly chose to reveal counts post-completion regardless of secret-voting history.

## Files touched (estimate)

- `components/Board/VotePill.tsx` (new — thin renderer over `votePillPolicy`)
- `components/common/PeoplePopover.tsx` (new — factored out of `ReactionPill`)
- `lib/votePillPolicy.ts` (new — pure display policy function)
- `utils/formatVoterList.ts` (new, mirrors `formatReactorList.ts`)
- `utils/formatReactorList.ts` (rename `MAX_REACTOR_NAMES` → `MAX_PEOPLE_NAMES`, re-export shim if any imports lean on the old name)
- `components/Board/ReactionPill.tsx` (refactor to use `PeoplePopover`)
- `components/Board/RetroCard.tsx` (replace inline vote pill/button with `<VotePill />`)
- `components/Board/ListView.tsx` (replace inline vote button)
- `components/Board/TimelineView.tsx` (replace inline vote button)
- `lib/__tests__/formatVoterList.test.ts` (new)
- `lib/__tests__/votePillPolicy.test.ts` (new)
- `lib/__tests__/formatReactorList.test.ts` (update for renamed constant)

Estimated diff size: ~300–400 LOC net (the new component + policy + tests offset by inline removals).

## Out of scope, captured for later

- **Export reveal:** Markdown/CSV exports today show vote counts but not voter names. Adding a `--- Voters: Alice, Bob ---` line to exported card sections is a natural follow-up but separate.
- **Active-board admin reveal:** A facilitator could theoretically benefit from seeing voters during a live session for moderation, but the influence-on-blind-voting tradeoff is real. Park this until a user actually asks.
- **Per-board "reveal voters" toggle:** Could let board owners opt into name reveal even when secret-voting was on, or opt out of name reveal post-completion. Adds configuration surface area for a behavior most teams won't think about. Park.
