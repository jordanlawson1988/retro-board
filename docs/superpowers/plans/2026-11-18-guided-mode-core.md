# Guided Mode Core (Parabol parity Step 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A board can be created as a guided retro that moves through Reflect, Group, Vote, Discuss and Done, with the server enforcing what each phase allows.

**Architecture:** One vocabulary file, `lib/constants/phases.ts`, defines the phases, their order and a permission profile per phase. The server enforces a phase in two ways that both come from that profile: a new phase rule inside `checkAction`, and the existing visibility settings (`card_visibility`, `voting_enabled`, `secret_voting`, `card_creation_disabled`, `board_locked`), which the phase route writes in the same UPDATE that changes the phase. Because those settings are written through, the Step 0 shaper (`lib/board-view.ts`) and the existing client rendering work unchanged. Clients learn of a move from a `phase-changed` Ably event and refetch the shaped board.

**Tech Stack:** Next.js 16 route handlers, `@neondatabase/serverless`, Ably (REST publish, presence), Zustand 5, Vitest (node), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-parabol-parity-design.md` (sections "Design decisions", "Step 1: guided mode core", "Decisions (Jordan, 2026-11-16)").

## Global Constraints

- Branch: `feature/guided-mode-core`, cut from `origin/develop`. PR targets `develop`. Never push to `develop` or `main` directly. (Promotion PR #24 merged on 2026-11-20; `develop` and `main` are level.)
- Never use `git commit -a`. Stage files by name. The working tree holds unrelated WIP (`.claude/hooks/supabase-env-guard.sh` deleted, `CONTEXT_SNAPSHOT.md` deleted, `AGENTS.md` type change); leave it alone.
- This plan's migration is `scripts/migrations/015_guided_mode.sql`. It is additive and safe for the code already deployed. It follows the guarded, re-runnable style of 012 to 014. In this plan it runs against the Neon `dev` branch only. Production has 011 to 014 since 2026-11-20; applying 015 there belongs to the promotion, not to this plan.
- All development and tests use the Neon `dev` branch and the Ably app `retro-board-dev` (`NEON_BRANCH=dev`). Dev server port 3001.
- `lib/db.ts` and `lib/auth.ts` are lazy. New modules read env vars and import `ably-server` inside functions, not at import.
- Do not run `npm run build` while `next dev` is running.
- Echo dedup in `useBoardChannel` (existing-id check before adding) must keep working.
- Participants never sign up. Nothing here may require a Better Auth session from an ordinary participant.
- Open boards and `trust_version = 1` boards behave exactly as they do today. Guided mode exists only on `trust_version = 2` boards and is fixed at creation; no route changes a board's mode afterwards.
- Every board write goes through `loadBoardActor` + `checkAction`. Never return or publish raw card or vote rows.
- A write route costs two database round-trips: the actor load and one statement.
- Guard status codes: 401 no participant session, 403 identified but not allowed, 409 board state or phase forbids it.
- Parabol is AGPL. Copy behaviour only: no code, copy text, art or music from it. All copy in this plan is ours.
- UI copy uses plain words and no em dashes.
- Guided mode ships behind the feature flag `guided_mode` (off by default, on in dev).
- After any change that lands on `develop` or the dev database: `npx tsc --noEmit`, `npm test`, `npm run test:e2e`, and report the counts.
- A UI task is not done until the behaviour was seen in a browser at desktop width and at 390px. If the dev server cannot run, say so; do not claim success.
- Pre-push check: `npx tsc --noEmit && npm run build && npm test`.

## Review Focus

1. Two facilitators press Next at the same moment. Expected: the board advances exactly one phase; the second request gets 409 and that browser shows the new phase. (Test in Task 4.)
2. A participant is offline while the phase changes, then reconnects. Expected: they land on the current phase without a manual reload, and a write they attempt with stale state gets a clear 409 message and triggers a refetch. (Tests in Task 6 and Task 10.)
3. Someone joins or reloads in the middle of Vote. Expected: the rail shows Vote, others' vote counts are absent from every response, and their own votes still show. (Test in Task 10.)
4. The facilitator moves back from Vote to Group, or from Discuss to Vote, after votes exist. Expected: no vote or card is deleted, and totals are hidden again in Vote. (Tests in Task 1 and Task 10.)
5. An open board, or a v1 board, after this ships. Expected: the toolbar switches still work, `POST /phase` returns 409, a settings PATCH is unchanged, and the 81 existing e2e tests pass. (Tests in Task 4, Task 5 and Task 10.)

---

## File structure

| File | Responsibility |
|---|---|
| `lib/constants/phases.ts` (new) | The one list of board modes, phase ids, phase order, permission profiles, labels and tips |
| `lib/phases.ts` (new) | Pure phase logic: moves, written-through settings, guard denial, deadline, rail steps, readiness, UI gates, event reducer |
| `lib/can-use.ts` (new) | `canUse(feature, userId)`, answered from `feature_flags` for now |
| `lib/timer-state.ts` (new) | Pure timer transitions for the stored timer |
| `scripts/migrations/015_guided_mode.sql` (new) | `boards.mode`, `boards.phase`, `boards.phase_config`, CHECKs, flag row |
| `lib/board-guards.ts`, `lib/board-actor.ts` (modify) | Phase in `BoardState`; phase rule in `checkAction` |
| `app/api/boards/[boardId]/phase/route.ts` (new) | Move the phase; set or clear the deadline |
| `app/api/boards/route.ts`, `app/api/boards/[boardId]/route.ts`, `lib/board-validation.ts` (modify) | Create guided boards; complete and reopen set the phase; PATCH refuses phase-owned settings |
| `stores/phaseStore.ts` (new) | Phase actions and readiness state |
| `hooks/usePhaseGates.ts`, `hooks/useStoredTimer.ts` (new) | UI gates from the phase; timer backed by `settings.timer` |
| `hooks/useBoardChannel.ts`, `hooks/usePresence.ts`, `stores/boardStore.ts`, `types/index.ts` (modify) | `phase-changed` event, ready flag in presence data, create options, board fields |
| `components/Phase/` (new): `PhaseRail.tsx`, `PhaseStepper.tsx`, `ReadyButton.tsx`, `PhaseTips.tsx`, `PhaseDeadline.tsx`, `ModeChoice.tsx`, `index.ts` | All phase UI |
| `components/pages/BoardPage.tsx`, `components/Board/FacilitatorToolbar.tsx`, `components/Board/MobileBoardShell.tsx`, `components/Board/MobileMoreSheet.tsx`, `components/Board/RetroCard.tsx`, `components/Dashboard/CreateBoardModal.tsx` (modify) | Mount points only; no phase logic in these files |
| `e2e/guided-mode.spec.ts` (new), `e2e/helpers.ts` (modify) | Two-browser run through every phase |

---

### Task 1: Phase vocabulary and pure logic

**Files:**
- Create: `lib/constants/phases.ts`, `lib/phases.ts`
- Modify: `types/index.ts` (Board fields)
- Test: `lib/__tests__/phases.test.ts`

**Interfaces:**
- Consumes: `BoardAction` from `lib/constants/board-actions.ts`; `BoardSettings`, `TimerState` from `types`.
- Produces (`lib/constants/phases.ts`):
  - `BOARD_MODES = ['open', 'guided'] as const`, `type BoardMode`, `isBoardMode(v: unknown): v is BoardMode`
  - `PHASE_IDS = ['reflect', 'group', 'vote', 'discuss', 'done'] as const` (this order is the phase order), `type PhaseId`, `isPhaseId(v: unknown): v is PhaseId`
  - `interface PhaseProfile { canWriteCards: boolean; canEditCards: boolean; canSeeOthersText: boolean; canGroup: boolean; canVote: boolean; canSeeTotals: boolean; canComment: boolean }`
  - `interface PhaseDef { id: PhaseId; label: string; optional: boolean; hasReady: boolean; profile: PhaseProfile; tips: readonly string[] }`
  - `PHASES: Record<PhaseId, PhaseDef>`, `FIRST_PHASE = 'reflect'`, `REOPEN_PHASE = 'discuss'`, `FINAL_PHASE = 'done'`
  - `interface PhaseConfig { deadline: string | null }`, `DEFAULT_PHASE_CONFIG: PhaseConfig = { deadline: null }`, `DEADLINE_MAX_DAYS = 30`
- Produces (`lib/phases.ts`):
  - `type PhaseTarget = 'next' | 'back' | PhaseId`
  - `resolvePhaseMove(current: PhaseId, to: PhaseTarget): { ok: true; phase: PhaseId } | { ok: false; error: string }`
  - `PHASE_OWNED_SETTINGS = ['card_visibility', 'voting_enabled', 'secret_voting', 'card_creation_disabled', 'board_locked'] as const`
  - `phaseSettings(phase: PhaseId): Pick<BoardSettings, (typeof PHASE_OWNED_SETTINGS)[number] | 'timer'>`
  - `phaseOwnedKeysIn(patch: Record<string, unknown>): string[]`
  - `phaseDenial(action: BoardAction, phase: PhaseId): string | null`
  - `validateDeadline(v: unknown, nowMs: number): { ok: true; value: string | null } | { ok: false; error: string }`
  - `deadlineState(deadline: string | null, nowMs: number): 'none' | 'open' | 'passed'`
  - `railSteps(current: PhaseId): { id: PhaseId; label: string; state: 'past' | 'current' | 'upcoming' }[]`
  - `readySummary(members: { clientId: string; data?: unknown }[], phase: PhaseId): { readyIds: string[]; total: number }`
  - `uiGates(mode: BoardMode, phase: PhaseId | null): { addLocked: boolean; editLocked: boolean; moveLocked: boolean }`
  - `interface PhaseChangedPayload { phase: PhaseId; settings: BoardSettings; phaseConfig: PhaseConfig; refetch?: boolean }`
  - `applyPhaseChanged<B extends { phase: PhaseId | null; settings: BoardSettings; phase_config: PhaseConfig }>(board: B, payload: unknown): B`
- Produces (`types/index.ts`): `Board` gains `mode: BoardMode; phase: PhaseId | null; phase_config: PhaseConfig`. Re-export the three types from `types`.

Profile values (the spec's six flags plus `canEditCards`, which the spec's "edit locked after Group" row needs):

| Phase | label | hasReady | write | edit | seeOthersText | group | vote | seeTotals | comment |
|---|---|---|---|---|---|---|---|---|---|
| reflect | Reflect | yes | yes | yes | no | no | no | no | no |
| group | Group | yes | no | yes | yes | yes | no | no | no |
| vote | Vote | yes | no | no | yes | no | yes | no | no |
| discuss | Discuss | no | no | no | yes | no | no | yes | yes |
| done | Done | no | no | no | yes | no | no | yes | no |

`optional` is `false` for all five. Tips, exactly:

- reflect: "Write one thought per card." / "Nobody can read your cards until this phase ends." / "Tap Ready when you have nothing more to add."
- group: "Drag a card onto another to group cards that say the same thing." / "Keep each group to one topic." / "You can still fix typos in your own cards."
- vote: "Vote for what you most want to talk about." / "Votes stay hidden until voting ends." / "Tap Ready when your votes are placed."
- discuss: "Start with the cards that got the most votes." / "Agree on a next step before moving on." / "Give every action item an owner."
- done: "This retro is complete. Cards and votes are read only."

- [ ] **Step 1: Write the failing tests** in `lib/__tests__/phases.test.ts`

```ts
describe('resolvePhaseMove', () => {
  it('next walks reflect > group > vote > discuss', () => {
    expect(resolvePhaseMove('reflect', 'next')).toEqual({ ok: true, phase: 'group' });
    expect(resolvePhaseMove('vote', 'next')).toEqual({ ok: true, phase: 'discuss' });
  });
  it('never moves into done; completing does that', () => {
    expect(resolvePhaseMove('discuss', 'next')).toEqual({ ok: false, error: 'Complete the retro to finish' });
    expect(resolvePhaseMove('vote', 'done')).toEqual({ ok: false, error: 'Complete the retro to finish' });
  });
  it('refuses back from the first phase, any move from done, and a move to the same phase', () => {
    expect(resolvePhaseMove('reflect', 'back')).toEqual({ ok: false, error: 'Already at the first phase' });
    expect(resolvePhaseMove('done', 'back')).toEqual({ ok: false, error: 'The retro is completed' });
    expect(resolvePhaseMove('group', 'group')).toEqual({ ok: false, error: 'Already in that phase' });
  });
  it('allows a named jump backwards and forwards', () => {
    expect(resolvePhaseMove('discuss', 'group')).toEqual({ ok: true, phase: 'group' });
    expect(resolvePhaseMove('reflect', 'vote')).toEqual({ ok: true, phase: 'vote' });
  });
});

describe('phaseSettings', () => {
  it('reflect hides text and closes voting', () => {
    expect(phaseSettings('reflect')).toMatchObject({
      card_visibility: 'hidden', voting_enabled: false, secret_voting: true,
      card_creation_disabled: false, board_locked: false,
    });
  });
  it('vote keeps totals secret; discuss shows them (Review Focus 4)', () => {
    expect(phaseSettings('vote')).toMatchObject({ voting_enabled: true, secret_voting: true, card_visibility: 'visible' });
    expect(phaseSettings('discuss')).toMatchObject({ voting_enabled: false, secret_voting: false });
  });
  it('done locks the board and every phase resets the timer to idle', () => {
    expect(phaseSettings('done').board_locked).toBe(true);
    for (const id of PHASE_IDS) expect(phaseSettings(id).timer).toEqual({ duration: 0, remaining: 0, status: 'idle', started_at: null });
  });
  it('returns exactly the phase-owned keys plus timer', () => {
    expect(Object.keys(phaseSettings('group')).sort()).toEqual([...PHASE_OWNED_SETTINGS, 'timer'].sort());
  });
});

describe('phaseDenial', () => {
  it.each([
    ['card.create', 'group'], ['card.edit', 'vote'], ['card.delete', 'discuss'],
    ['card.move', 'reflect'], ['card.move', 'vote'], ['vote.toggle', 'reflect'], ['vote.toggle', 'discuss'],
  ] as const)('%s is denied in %s', (action, phase) => {
    expect(phaseDenial(action, phase)).toBe(`Not available during ${PHASES[phase].label}`);
  });
  it.each([
    ['card.create', 'reflect'], ['card.edit', 'group'], ['card.move', 'group'], ['vote.toggle', 'vote'],
    ['card.react', 'vote'], ['action-item.write', 'reflect'], ['board.settings', 'vote'], ['participant.leave', 'done'],
  ] as const)('%s is allowed in %s', (action, phase) => {
    expect(phaseDenial(action, phase)).toBeNull();
  });
});

describe('validateDeadline', () => {
  const now = Date.parse('2026-11-18T12:00:00Z');
  it('accepts null and a future ISO time', () => {
    expect(validateDeadline(null, now)).toEqual({ ok: true, value: null });
    expect(validateDeadline('2026-11-19T17:00:00.000Z', now)).toEqual({ ok: true, value: '2026-11-19T17:00:00.000Z' });
  });
  it('rejects garbage, the past, and more than 30 days out', () => {
    for (const v of ['soon', 42, '', '2026-11-18T11:59:00Z', '2026-12-19T12:00:01Z']) {
      expect(validateDeadline(v, now).ok).toBe(false);
    }
  });
});

describe('readySummary', () => {
  it('counts a participant with two tabs once and ignores a ready flag for another phase', () => {
    const members = [
      { clientId: 'a', data: { readyPhase: 'reflect' } },
      { clientId: 'a', data: { readyPhase: null } },
      { clientId: 'b', data: { readyPhase: 'group' } },
      { clientId: 'c', data: 'junk' },
    ];
    expect(readySummary(members, 'reflect')).toEqual({ readyIds: ['a'], total: 3 });
  });
});

describe('uiGates', () => {
  it('is fully open on an open board', () => {
    expect(uiGates('open', null)).toEqual({ addLocked: false, editLocked: false, moveLocked: false });
  });
  it('follows the profile on a guided board', () => {
    expect(uiGates('guided', 'reflect')).toEqual({ addLocked: false, editLocked: false, moveLocked: true });
    expect(uiGates('guided', 'vote')).toEqual({ addLocked: true, editLocked: true, moveLocked: true });
  });
});

describe('applyPhaseChanged', () => {
  const board = { phase: 'reflect' as const, settings: DEFAULT_BOARD_SETTINGS, phase_config: { deadline: null } };
  it('applies a well-formed payload', () => {
    const next = applyPhaseChanged(board, { phase: 'group', settings: { ...DEFAULT_BOARD_SETTINGS, card_visibility: 'visible' }, phaseConfig: { deadline: null } });
    expect(next.phase).toBe('group');
    expect(next.settings.card_visibility).toBe('visible');
  });
  it('returns the board unchanged for an unknown phase or a non-object', () => {
    expect(applyPhaseChanged(board, { phase: 'party' })).toBe(board);
    expect(applyPhaseChanged(board, null)).toBe(board);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/phases.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement `lib/constants/phases.ts`** with the exports and table above.
- [ ] **Step 4: Implement `lib/phases.ts`.** `phaseSettings` derives each key from the profile: `card_visibility` from `canSeeOthersText`, `voting_enabled` from `canVote`, `secret_voting` is `!canSeeTotals`, `card_creation_disabled` is `!canWriteCards`, `board_locked` is `phase === 'done'`. `phaseDenial` maps `card.create` to `canWriteCards`, `card.edit` and `card.delete` to `canEditCards`, `card.move` to `canGroup`, `vote.toggle` to `canVote`; every other action returns null. `readySummary` de-duplicates by `clientId`; a member is ready when any of their entries has `data.readyPhase === phase`. `validateDeadline` returns the value normalised with `new Date(v).toISOString()`.
- [ ] **Step 5: Add the three fields to `Board`** in `types/index.ts`.
- [ ] **Step 6: Run** `npx vitest run lib/__tests__/phases.test.ts && npx tsc --noEmit`. Expected: tests PASS. `tsc` may report fixtures that build a `Board` without the new fields; add `mode: 'open', phase: null, phase_config: { deadline: null }` to each until it is clean.
- [ ] **Step 7: Commit** `feat(phases): phase vocabulary, profiles and pure phase logic`

---

### Task 2: Migration 015 and the feature gate

**Files:**
- Create: `scripts/migrations/015_guided_mode.sql`, `lib/can-use.ts`
- Test: `lib/__tests__/phase-migration-contract.test.ts`, `lib/__tests__/can-use.test.ts`

**Interfaces:**
- Consumes: `PHASE_IDS`, `BOARD_MODES` (Task 1).
- Produces: columns `boards.mode TEXT NOT NULL DEFAULT 'open'`, `boards.phase TEXT NULL`, `boards.phase_config JSONB NOT NULL DEFAULT '{}'`; `FEATURES = ['guided_mode'] as const`, `type Feature`, `canUse(feature: Feature, userId: string | null): Promise<boolean>`.

- [ ] **Step 1: Write the failing contract test.** It reads the SQL file and compares vocabularies, so the database CHECK and the code cannot drift.

```ts
const sqlText = readFileSync('scripts/migrations/015_guided_mode.sql', 'utf-8');
const listIn = (constraint: string) =>
  [...(new RegExp(`${constraint}[\\s\\S]*?\\(([^;]*?)\\)\\s*\\)`).exec(sqlText)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

it('boards_mode_check lists exactly BOARD_MODES', () => {
  expect(listIn('boards_mode_check').sort()).toEqual([...BOARD_MODES].sort());
});
it('boards_phase_check lists exactly PHASE_IDS', () => {
  expect(listIn('boards_phase_check').sort()).toEqual([...PHASE_IDS].sort());
});
it('is additive: no DROP and no ALTER COLUMN', () => {
  expect(sqlText).not.toMatch(/\bDROP\b|ALTER\s+COLUMN/i);
});
```

- [ ] **Step 2: Write the failing `canUse` test**, mocking `@/lib/db` the way `lib/__tests__/require-system-admin.test.ts` does: returns `true` when the flag row has `is_enabled = true`, `false` when it is off, `false` when there is no row.
- [ ] **Step 3: Run both.** Expected: FAIL, files not found.
- [ ] **Step 4: Write the migration.**

```sql
-- 015: guided mode (Parabol parity Step 1). Additive and safe under the deployed code.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'open';
ALTER TABLE boards ADD COLUMN IF NOT EXISTS phase TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS phase_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE boards ADD CONSTRAINT boards_mode_check CHECK (mode IN ('open', 'guided'));
ALTER TABLE boards ADD CONSTRAINT boards_phase_check
  CHECK (phase IS NULL OR phase IN ('reflect', 'group', 'vote', 'discuss', 'done'));
ALTER TABLE boards ADD CONSTRAINT boards_phase_matches_mode
  CHECK ((mode = 'open' AND phase IS NULL) OR (mode = 'guided' AND phase IS NOT NULL));
ALTER TABLE boards ADD CONSTRAINT boards_guided_needs_v2 CHECK (mode = 'open' OR trust_version = 2);

INSERT INTO feature_flags (key, name, description, is_enabled)
SELECT 'guided_mode', 'Guided mode', 'Create boards that step through Reflect, Group, Vote and Discuss.', false
WHERE NOT EXISTS (SELECT 1 FROM feature_flags WHERE key = 'guided_mode');
```

- [ ] **Step 5: Implement `lib/can-use.ts`**: one query, `SELECT is_enabled FROM feature_flags WHERE key = ${feature}`; no row is `false`. `userId` is accepted and unused until billing merges.
- [ ] **Step 6: Apply to dev and turn the flag on there.**

Run: `node --env-file=.env.local scripts/run-one.mjs scripts/migrations/015_guided_mode.sql`
Expected: `Target database host: ep-calm-breeze…`, `Applied …015_guided_mode.sql`, `Recorded migration 015 in schema_migrations`. If the host is not the `ep-calm-breeze` dev host, stop.

Then on the dev branch only: `UPDATE feature_flags SET is_enabled = true WHERE key = 'guided_mode';`

- [ ] **Step 7: Run** `npx vitest run lib/__tests__/phase-migration-contract.test.ts lib/__tests__/can-use.test.ts`. Expected: PASS.
- [ ] **Step 8: Commit** `feat(db): 015 guided mode columns, checks and feature flag`

---

### Task 3: Phase in the actor and the guard

**Files:**
- Modify: `lib/board-guards.ts`, `lib/board-actor.ts`
- Test: `lib/__tests__/board-guards.test.ts`, `lib/__tests__/board-actor-loaded.test.ts`, new `lib/__tests__/phase-contract.test.ts`

**Interfaces:**
- Consumes: `phaseDenial`, `PhaseId`, `BoardMode`, `PhaseConfig`, `isPhaseId`, `isBoardMode`, `railSteps`, `phaseSettings`, `applyPhaseChanged` (Task 1).
- Produces: `BoardState` becomes `{ archived: boolean; settings: BoardSettings; phase: PhaseId | null }` (`null` on an open board). `LoadedBoard.board` gains `mode: BoardMode; phase: PhaseId | null; phase_config: PhaseConfig`.

- [ ] **Step 1: Write the failing guard tests** (add to `board-guards.test.ts`; give the file's state factory a `phase: null` default).

```ts
it('an open board (phase null) is untouched by the phase rule', () => {
  expect(checkAction('card.move', v2Participant, state({ phase: null }))).toEqual({ ok: true });
});
it('a guided board denies by phase with 409, for the facilitator too', () => {
  const s = state({ phase: 'vote', settings: { ...settings, ...phaseSettings('vote') } });
  expect(checkAction('card.create', v2Facilitator, s)).toEqual({ ok: false, status: 409, error: 'Not available during Vote' });
  expect(checkAction('vote.toggle', v2Participant, s)).toEqual({ ok: true });
});
it('completed wins over the phase message', () => {
  expect(checkAction('vote.toggle', v2Participant, state({ archived: true, phase: 'done' })))
    .toEqual({ ok: false, status: 409, error: 'Board is completed' });
});
```

- [ ] **Step 2: Write the failing contract test** `lib/__tests__/phase-contract.test.ts` (the spec's round-trip test).

```ts
describe.each(PHASE_IDS)('phase %s round-trips', (id) => {
  it('through the guard: every action gets a decision, never "Unhandled"', () => {
    const s = { archived: false, phase: id, settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings(id) } };
    for (const action of BOARD_ACTIONS) {
      const r = checkAction(action, facilitator, s, { authorId: facilitator.participantId, participantId: facilitator.participantId });
      if (!r.ok) expect(r.error).not.toMatch(/Unhandled/);
    }
  });
  it('through the settings validator', () => {
    expect(validateSettingsPatch(phaseSettings(id) as Record<string, unknown>).ok).toBe(true);
  });
  it('through the store reducer', () => {
    const b = { phase: 'reflect' as PhaseId, settings: DEFAULT_BOARD_SETTINGS, phase_config: { deadline: null } };
    expect(applyPhaseChanged(b, { phase: id, settings: DEFAULT_BOARD_SETTINGS, phaseConfig: { deadline: null } }).phase).toBe(id);
  });
  it('through the phase rail', () => {
    const steps = railSteps(id);
    expect(steps.map((s) => s.id)).toEqual([...PHASE_IDS]);
    expect(steps.filter((s) => s.state === 'current').map((s) => s.id)).toEqual([id]);
  });
});
```

- [ ] **Step 3: Write the failing actor tests** (add to `board-actor-loaded.test.ts`): a row with `mode: 'guided', phase: 'group'` yields `state.phase === 'group'` and `board.mode === 'guided'`; a row with `mode: 'open'` yields `state.phase === null`; a row with `mode: 'guided'` and `phase: 'party'` throws `Invalid phase for board`; a row with no `phase_config` yields `{ deadline: null }`.
- [ ] **Step 4: Run** the three files. Expected: FAIL.
- [ ] **Step 5: Implement.** In `checkState`, after the `archived` check and before the lock check: `if (state.phase !== null) { const msg = phaseDenial(action, state.phase); if (msg) return deny(409, msg); }`. In `loadBoardActor`, read `mode` and `phase` from the row, fail closed on an unknown mode or a guided board without a valid phase, and merge `phase_config` over `DEFAULT_PHASE_CONFIG`.
- [ ] **Step 6: Run** `npm test && npx tsc --noEmit`. Expected: all PASS; fix any fixture that builds a `BoardState` without `phase`.
- [ ] **Step 7: Commit** `feat(guards): phase rule in checkAction; actor carries mode and phase`

---

### Task 4: The phase route

**Files:**
- Create: `app/api/boards/[boardId]/phase/route.ts`
- Test: `app/api/boards/[boardId]/phase/__tests__/phase-route.test.ts`

**Interfaces:**
- Consumes: `loadBoardActor`, `guardResponse`, `BOARD_NOT_FOUND`, `checkAction` (action `'board.settings'`, which is already facilitator-only on v1 and v2), `resolvePhaseMove`, `phaseSettings`, `validateDeadline`, `rateLimitOr429`, `readJsonObject`.
- Produces: `POST /api/boards/[boardId]/phase`
  - Body `{ action: 'move', from: PhaseId, to: PhaseTarget }` or `{ action: 'set-deadline', deadline: string | null }`.
  - 200 `{ ok: true, phase: PhaseId, settings: BoardSettings, phaseConfig: PhaseConfig }`.
  - 400 `Invalid request body`, `Invalid phase`, or the deadline error. 401 and 403 from the guard. 409 `This board is not in guided mode`, `The phase already changed`, a `resolvePhaseMove` error, or `Board is completed`.
  - Publishes `phase-changed` on `retro-board:{boardId}` with `PhaseChangedPayload`; `refetch: true` on a move, absent on a deadline change.
  - Rate limit: `rateLimitOr429(request, 'phase', 60, 60)`.

- [ ] **Step 1: Write the failing tests**, mocking `@/lib/db`, `@/lib/ably-server` and the session the way `app/api/boards/[boardId]/__tests__/patch-round-trips.test.ts` does.

```ts
it('moves reflect to group in two round-trips and publishes phase-changed with refetch', async () => {
  // actor load returns a guided v2 board in reflect; UPDATE returns the new row
  const res = await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctx);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, phase: 'group' });
  expect(sqlCalls).toHaveLength(2);
  expect(published).toEqual([['phase-changed', expect.objectContaining({ phase: 'group', refetch: true })]]);
});
it('the UPDATE merges phaseSettings and clears the deadline', async () => {
  // assert the statement's parameters contain JSON.stringify(phaseSettings('group')) and that phase_config.deadline is set to null
});
it('409 when `from` is not the current phase (second facilitator, Review Focus 1)', async () => {
  const res = await POST(req({ action: 'move', from: 'reflect', to: 'next' }), ctxWithBoardIn('group'));
  expect(res.status).toBe(409);
  expect((await res.json()).error).toBe('The phase already changed');
  expect(published).toEqual([]);
});
it('409 when the UPDATE matches no row (lost the race after the load)', async () => { /* UPDATE returns [] */ });
it('409 on an open board, and nothing is written (Review Focus 5)', async () => {
  expect((await (await POST(req({ action: 'move', from: 'reflect', to: 'next' }), openBoardCtx)).json()).error)
    .toBe('This board is not in guided mode');
});
it('403 for a participant who is not a facilitator; 401 with no cookie', async () => {});
it('never moves to done', async () => {
  expect((await (await POST(req({ action: 'move', from: 'discuss', to: 'next' }), ctxWithBoardIn('discuss'))).json()).error)
    .toBe('Complete the retro to finish');
});
it('set-deadline stores a future time, publishes without refetch, and rejects the past with 400', async () => {});
it('400 for an unknown action, a missing `from`, or an unknown `to`', async () => {});
```

- [ ] **Step 2: Run** `npx vitest run app/api/boards/\[boardId\]/phase`. Expected: FAIL, route not found.
- [ ] **Step 3: Implement the route.** The move is one statement, conditional on the phase the request named:

```sql
UPDATE boards SET phase = $next,
  settings = settings || $phaseSettingsJson::jsonb,
  phase_config = phase_config || '{"deadline":null}'::jsonb
WHERE id = $boardId AND mode = 'guided' AND phase = $from AND archived_at IS NULL AND deleted_at IS NULL
RETURNING phase, settings, phase_config
```

Check `from !== loaded.board.phase` before the statement and return the same 409 as an empty result. Import `ably-server` inside the handler.

- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): POST /phase moves a guided board and sets its deadline`

---

### Task 5: Create, complete, reopen and settings on guided boards

**Files:**
- Modify: `lib/board-validation.ts` (`validateNewBoard`, `NewBoardInput`), `app/api/boards/route.ts`, `app/api/boards/[boardId]/route.ts`
- Test: `lib/__tests__/new-board-mode.test.ts`, `app/api/boards/__tests__/create-guided.test.ts`, `app/api/boards/[boardId]/__tests__/guided-lifecycle.test.ts`

**Interfaces:**
- Consumes: `isBoardMode`, `FIRST_PHASE`, `REOPEN_PHASE`, `FINAL_PHASE`, `phaseSettings`, `phaseOwnedKeysIn`, `DEFAULT_PHASE_CONFIG`, `canUse`.
- Produces:
  - `NewBoardInput.mode: BoardMode`; the create body accepts an optional `mode`, default `'open'`; anything else is 400 `Invalid mode`.
  - Guided create stores `mode = 'guided'`, `phase = 'reflect'`, `phase_config = {"deadline":null}` and `settings = { ...body.settings, ...phaseSettings('reflect') }`. When `canUse('guided_mode', ownerId)` is false: 403 `Guided mode is not available`.
  - `board-completed` and `board-reopened` payloads gain `phase: PhaseId | null`.
  - Settings PATCH on a guided board with any phase-owned key: 409 `This setting follows the phase on a guided board`.

- [ ] **Step 1: Write the failing tests.**

```ts
// new-board-mode.test.ts
it('defaults to open, accepts guided, rejects anything else', () => {
  expect(validateNewBoard(base).value.mode).toBe('open');
  expect(validateNewBoard({ ...base, mode: 'guided' }).value.mode).toBe('guided');
  expect(validateNewBoard({ ...base, mode: 'party' })).toEqual({ ok: false, error: 'Invalid mode' });
});

// create-guided.test.ts
it('a guided board is inserted in reflect with the reflect settings over the body settings', async () => {
  // body.settings says card_visibility: 'visible', anonymous_cards: true
  // assert INSERT params: mode 'guided', phase 'reflect', settings JSON has card_visibility 'hidden' and anonymous_cards true
});
it('403 when the guided_mode flag is off, and nothing is inserted', async () => {});
it('an open board does not query feature_flags (still one round-trip)', async () => {});

// guided-lifecycle.test.ts
it('complete sets phase done on a guided board and leaves phase null on an open one', async () => {});
it('reopen returns a guided board to discuss with the discuss settings', async () => {});
it('PATCH settings { card_visibility } on a guided board is 409 and writes nothing', async () => {});
it('PATCH settings { timer } and { anonymous_cards } on a guided board still succeed', async () => {});
it('PATCH settings { card_visibility } on an open board is unchanged (Review Focus 5)', async () => {});
```

- [ ] **Step 2: Run** the three files. Expected: FAIL.
- [ ] **Step 3: Implement.** Complete: add `phase = CASE WHEN mode = 'guided' THEN 'done' ELSE phase END` to the existing UPDATE, merge `phaseSettings('done')` instead of the fixed JSON when guided, and return `phase`. Reopen: `phase = CASE WHEN mode = 'guided' THEN 'discuss' ELSE phase END`, and merge `phaseSettings('discuss')` instead of `{"board_locked":false}` when guided, in the same statement. PATCH: after the `board.settings` guard, refuse when `loaded.board.mode === 'guided' && phaseOwnedKeysIn(settingsPatch).length > 0`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, including the existing `create-single-owner`, `patch-round-trips` and `get-round-trips` tests.
- [ ] **Step 5: Commit** `feat(api): guided boards on create; complete, reopen and settings follow the phase`

---

### Task 6: Client state, the `phase-changed` event and readiness

**Files:**
- Create: `stores/phaseStore.ts`, `hooks/usePhaseGates.ts`
- Modify: `stores/boardStore.ts` (`createBoard`, `completeBoard`, `failWrite`), `hooks/useBoardChannel.ts`, `hooks/usePresence.ts`
- Test: `lib/__tests__/phase-store.test.ts`

**Interfaces:**
- Consumes: `applyPhaseChanged`, `readySummary`, `uiGates`, `PhaseTarget` (Task 1); `POST /phase` (Task 4).
- Produces:
  - `createBoard(title, description, template, displayName?, options?: { mode?: BoardMode; anonymous?: boolean })`. With `mode: 'guided'` the body carries `mode` and `settings.anonymous_cards = options.anonymous ?? true`.
  - `usePhaseStore` with `moving: boolean`, `movePhase(to: PhaseTarget): Promise<void>`, `setDeadline(deadline: string | null): Promise<void>`, `readyIds: string[]`, `onlineTotal: number`, `setReadySummary(s: { readyIds: string[]; total: number }): void`, `iAmReadyFor: PhaseId | null`, `setReady(ready: boolean): void`.
  - `usePhaseGates(): { guided: boolean; phase: PhaseId | null; addLocked: boolean; editLocked: boolean; moveLocked: boolean }`.
  - Presence data gains `readyPhase: PhaseId | null`.

- [ ] **Step 1: Write the failing store tests** (node, with `fetch` stubbed and `useBoardStore.setState` seeding a guided board in reflect).

```ts
it('movePhase posts the phase it believes is current and applies the response', async () => {
  await usePhaseStore.getState().movePhase('next');
  expect(fetchMock).toHaveBeenCalledWith('/api/boards/b1/phase', expect.objectContaining({
    body: JSON.stringify({ action: 'move', from: 'reflect', to: 'next' }),
  }));
  expect(useBoardStore.getState().board?.phase).toBe('group');
});
it('on 409 it refetches the board and surfaces the message (Review Focus 1)', async () => {});
it('ignores a second call while one is in flight', async () => {});
it('a card write that fails with 409 on a guided board refetches the board (Review Focus 2)', async () => {
  // fetch stub: POST /cards -> 409 { error: 'Not available during Group' }, then GET /api/boards/b1 -> group
  await expect(useBoardStore.getState().addCard('c1', 'late thought')).rejects.toThrow('Not available during Group');
  expect(useBoardStore.getState().board?.phase).toBe('group');
});
it('setReady(true) records the current phase; a phase change makes it stale without any reset call', () => {
  usePhaseStore.getState().setReady(true);
  expect(usePhaseStore.getState().iAmReadyFor).toBe('reflect');
});
```

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/phase-store.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `stores/phaseStore.ts`.** No optimistic phase change: the phase moves when the response or the event arrives. The phase itself stays on `useBoardStore().board`; this store holds actions and readiness only.
- [ ] **Step 4: Handle the event in `useBoardChannel`.** Add `case 'phase-changed'`: `board: state.board ? applyPhaseChanged(state.board, data) : null`, then `refetchIfAsked(data)`. In `board-completed` and `board-reopened`, also set `phase` when the payload carries one.
- [ ] **Step 5: Readiness in `usePresence`.** Add `readyPhase: iAmReadyFor` to the presence data and push changes with the `updateStatus` function that `usePresence` from `ably/react` returns (confirm the name against the installed version's types). Compute `readySummary(presenceData, board.phase)` in the existing effect and call `setReadySummary`.
- [ ] **Step 6: Stale-state recovery in `failWrite`.** When a write fails with 409 on a guided board, call `fetchBoard(board.id)` after surfacing the message (Review Focus 2).
- [ ] **Step 7: `createBoard` and `completeBoard`.** Pass `mode` and the anonymous flag; the optimistic completion also sets `phase: 'done'` on a guided board.
- [ ] **Step 8: Run** `npm test && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 9: Commit** `feat(client): phase store, phase-changed handling and ready state in presence`

---

### Task 7: Stored timer on guided boards

**Files:**
- Create: `lib/timer-state.ts`, `hooks/useStoredTimer.ts`
- Modify: `components/pages/BoardPage.tsx` (pick the timer source)
- Test: `lib/__tests__/timer-state.test.ts`

**Interfaces:**
- Consumes: `TimerState`; `useBoardStore().updateSettings`.
- Produces:
  - `IDLE_TIMER`, `startedTimer(duration: number, nowMs: number): TimerState`, `pausedTimer(t: TimerState, nowMs: number): TimerState`, `resumedTimer(t: TimerState, nowMs: number): TimerState`, `timerView(t: TimerState, nowMs: number): TimerState`.
  - `useStoredTimer({ enabled }: { enabled: boolean })` returning the same shape as `useTimer`: `{ timer, start, pause, resume, reset }`.

Open boards keep `useTimer` and the `:timer` channel exactly as they are. The spec lists the timer under `phase_config`; this plan keeps it in the existing, already validated `settings.timer` key so there is one timer shape, not two.

- [ ] **Step 1: Write the failing tests.**

```ts
const t0 = Date.parse('2026-11-18T12:00:00Z');
it('a started timer counts down from its start time', () => {
  const t = startedTimer(300, t0);
  expect(timerView(t, t0 + 61_000)).toMatchObject({ status: 'running', remaining: 239 });
});
it('expires at zero and never goes negative', () => {
  expect(timerView(startedTimer(60, t0), t0 + 90_000)).toMatchObject({ status: 'expired', remaining: 0 });
});
it('pause freezes the remaining time and resume continues from it', () => {
  const paused = pausedTimer(startedTimer(300, t0), t0 + 100_000);
  expect(paused).toMatchObject({ status: 'paused', remaining: 200 });
  expect(timerView(resumedTimer(paused, t0 + 500_000), t0 + 510_000)).toMatchObject({ status: 'running', remaining: 190 });
});
it('every transition passes the settings validator', () => {
  for (const t of [IDLE_TIMER, startedTimer(300, t0), pausedTimer(startedTimer(300, t0), t0 + 1000)]) {
    expect(validateSettingsPatch({ timer: t }).ok).toBe(true);
  }
});
```

- [ ] **Step 2: Run** `npx vitest run lib/__tests__/timer-state.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `lib/timer-state.ts`.**
- [ ] **Step 4: Implement `hooks/useStoredTimer.ts`.** It reads `board.settings.timer`, re-renders every 250ms while running, plays `playTimerDing()` once when the view turns `expired`, and each action calls `updateSettings({ timer })`. The server's guard already limits that to facilitators.
- [ ] **Step 5: Wire `BoardPage`.** Call both hooks: `useTimer({ boardId, liveSync: liveEventsEnabled && !!currentParticipantId && !guided })` and `useStoredTimer({ enabled: guided })`; hand `TimerFloating` whichever applies.
- [ ] **Step 6: Run** `npm test && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(timer): guided boards store the timer in settings; phase moves reset it`

---

### Task 8: Desktop phase UI

**Files:**
- Create: `components/Phase/PhaseRail.tsx`, `ReadyButton.tsx`, `PhaseTips.tsx`, `PhaseDeadline.tsx`, `index.ts`
- Modify: `components/pages/BoardPage.tsx`, `components/Board/FacilitatorToolbar.tsx`, `components/Board/RetroCard.tsx`

**Interfaces:**
- Consumes: `usePhaseStore`, `usePhaseGates` (Task 6); `railSteps`, `deadlineState`, `PHASES` (Task 1); `useBoardStore` for `board` and facilitator standing.
- Produces: `<PhaseRail isFacilitator onCompleteRetro />`, `<ReadyButton />`, `<PhaseTips phase />`, `<PhaseDeadline isFacilitator />`. Each reads the stores itself, so `BoardPage` gains only mount points. `FacilitatorToolbar` gains `guided?: boolean`.

Behaviour:

- `PhaseRail` renders the five steps from `railSteps(phase)` with `aria-current="step"` on the current one, and `data-testid="phase-rail"`, `data-phase={phase}`. Mounted in the sticky board header of `BoardPage`, only when `board.mode === 'guided'`.
- Facilitator controls in the rail: `Back` (hidden in Reflect), and a forward button labelled `Next: {next label}`. In Discuss the forward button reads `Complete Retro` and calls `onCompleteRetro`. Beside it, in phases with `hasReady`: `{readyIds.length} of {onlineTotal} ready`.
- When the facilitator presses Next and not everyone is ready, a `Modal` asks: title `Move on?`, body `{n} of {total} people are ready.`, buttons `Stay` and `Move on`.
- `ReadyButton` shows in phases with `hasReady`, for every joined participant: `Ready` (unpressed) and `Ready ✓` (pressed), `aria-pressed`.
- `PhaseTips` is a popover opened by a `Tips` button listing `PHASES[phase].tips`.
- `PhaseDeadline`: a chip `{label} closes {weekday h:mm a}` for everyone while `deadlineState` is `open`; a banner `{label} closed at {h:mm a}. Waiting for the facilitator.` when `passed`. The facilitator gets `Set a deadline` (a `datetime-local` input, `Save`, `Clear`), and on `passed` the buttons `Next: {label}` and `Extend`.
- `FacilitatorToolbar` with `guided` hides the reveal, lock, voting and secret-voting buttons and keeps Actions and Complete Retro. `BoardPage` passes `guided`.
- `BoardPage` uses `usePhaseGates()`: `cardCreationDisabled` also true when `addLocked`; the merge and drag paths (`canCombine` in the drag handler, the `boardLocked` prop passed to columns, and the `DndContext` sensors) are off when `moveLocked`.
- `RetroCard` uses `usePhaseGates()` and hides edit, delete and colour controls when `editLocked`.

- [ ] **Step 1: Build the four components and `index.ts`** to the behaviour above, with the design tokens the neighbouring components use (`--accent`, `--ink-*`, `--line`, `--r-md`).
- [ ] **Step 2: Mount them in `BoardPage`**, pass `guided` to the toolbar, apply the gates.
- [ ] **Step 3: Run** `npx tsc --noEmit && npm run lint && npm test`. Expected: clean.
- [ ] **Step 4: Observe in a browser at 1280px**, with two browser profiles on a guided dev board (create one through the API with `mode: 'guided'` until Task 9 adds the modal): the rail shows Reflect; the participant's Ready press changes the facilitator's count; Next with one of two ready shows the confirm; after moving on, both pages show Group without a reload and the other person's card text appears; Add card is disabled in Group; edit controls are gone in Vote; an open board looks the same as before. Record what was seen in the task report.
- [ ] **Step 5: Commit** `feat(ui): phase rail, ready button, tips and deadline on guided boards`

---

### Task 9: Mobile stepper and the create choice

**Files:**
- Create: `components/Phase/PhaseStepper.tsx`, `components/Phase/ModeChoice.tsx`
- Modify: `components/Board/MobileBoardShell.tsx`, `components/Board/MobileMoreSheet.tsx`, `components/Dashboard/CreateBoardModal.tsx`

**Interfaces:**
- Consumes: Task 6 stores and hooks, Task 8 components, `useFeatureFlagStore`.
- Produces: `<PhaseStepper isFacilitator onCompleteRetro />`; `<ModeChoice mode anonymous onChange />` with `onChange(next: { mode: BoardMode; anonymous: boolean }): void`.

Behaviour:

- `PhaseStepper` is one row directly above `MobileBottomNav`, rendered by `MobileBoardShell` only on guided boards: `{label}` and `{n} of 5` on the left (tapping it opens the tips in the existing `Sheet`), five dots, and on the right `Ready` for a participant or `Back` and `Next` for the facilitator (same confirm and Complete Retro rule as the rail). `data-testid="phase-stepper"`. Touch targets are at least 44px.
- `MobileMoreSheet` passes `guided` to its `FacilitatorToolbar`.
- `ModeChoice` shows two cards, selected with the same ring the template cards use:
  - `Open board`: "Everyone works on the board freely. You control reveal, voting and lock."
  - `Guided retro`: "Step through Reflect, Group, Vote and Discuss together."
  - Under Guided, a checkbox `Hide who wrote each card`, on by default.
- `CreateBoardModal` fetches flags on mount and renders `ModeChoice` above the template grid only when `isEnabled('guided_mode')`; default `open`. It passes `{ mode, anonymous }` to `createBoard`. With the flag off the modal is unchanged.

- [ ] **Step 1: Build `PhaseStepper` and mount it** in `MobileBoardShell`; pass `guided` in `MobileMoreSheet`.
- [ ] **Step 2: Build `ModeChoice` and wire `CreateBoardModal`.**
- [ ] **Step 3: Run** `npx tsc --noEmit && npm run lint && npm test`. Expected: clean.
- [ ] **Step 4: Observe in a browser at 390px**: create a guided board from the modal; the stepper sits above the bottom nav and does not cover the add-card button or the vote tracker; Ready, Next and the tips sheet work; the More sheet shows no reveal, lock or voting switches. Then at 1280px: the modal shows both choices, and an open board created from it has no rail. Record what was seen.
- [ ] **Step 5: Commit** `feat(ui): mobile phase stepper and Open or Guided choice when creating a board`

---

### Task 10: Two-browser end-to-end run and verification

**Files:**
- Create: `e2e/guided-mode.spec.ts`
- Modify: `e2e/helpers.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `CreateBoardOpts.mode?: 'open' | 'guided'`; `apiMovePhase(request, boardId, from, to)` returning the raw response; `setFlagDirect(key: string, enabled: boolean): Promise<void>` (direct SQL, like `makeLegacyV1`).

- [ ] **Step 1: Write the spec.** `beforeAll` calls `setFlagDirect('guided_mode', true)`.

```ts
test('a guided retro runs Reflect to Done with the server enforcing each phase', async ({ browser }) => {
  // A creates a guided, anonymous board and joins as facilitator; B joins with capture() from the first request.
  // Reflect: B adds SECRET through the UI. A sees one hidden card; SECRET is in none of A's responses or frames.
  //          B presses Ready; A's rail reads "1 of 2 ready".
  //          B's API vote is 409 "Not available during Reflect".
  // A presses Next and confirms. Both rails show Group without a reload; A now sees SECRET; the author is still withheld.
  //          B's API card create is 409 "Not available during Group".
  // A moves to Vote. B votes on a card. A's board GET and frames carry no vote of B's. B reloads: the rail shows Vote
  //          and B's own vote still shows (Review Focus 3).
  // A moves back to Group, then forward to Vote: B's vote still exists and is still hidden from A (Review Focus 4).
  // A moves to Discuss. A now sees the vote total. B's API vote is 409 "Not available during Discuss".
  // A completes the retro. Both show the completed state; the board GET reports phase "done".
});

test('a second facilitator pressing Next at the same time advances one phase only', async ({ browser }) => {
  // Two contexts with facilitator standing fire apiMovePhase(…, 'reflect', 'next') together.
  // Exactly one 200 and one 409 "The phase already changed"; the board is in group.
});

test('a participant who was offline during a phase change catches up', async ({ browser }) => {
  // B goes offline (context.setOffline(true)); A moves to Group; B comes back online.
  // B's rail shows Group within 10s without a reload (Review Focus 2).
});

test('a participant cannot move the phase, and an open board has no phase', async ({ browser }) => {
  // B's apiMovePhase is 403. On an open board the same call is 409 "This board is not in guided mode",
  // the page has no [data-testid="phase-rail"], and the Cards hidden / Voting off switches still work (Review Focus 5).
});

test('reopening a completed guided board returns it to Discuss', async ({ browser }) => {});
```

- [ ] **Step 2: Run** `npm run test:e2e -- guided-mode`. Expected: PASS. Fix the product, not the test, when one fails; a failure that needs a design change stops the task and goes back to Jordan.
- [ ] **Step 3: Run the full suites.**

Run: `npx tsc --noEmit && npm test && npm run test:e2e`
Expected: `tsc` clean; every unit test passes (456 before this plan, plus the new files); e2e 81 existing plus the 5 new, all passing. Report the three counts.

- [ ] **Step 4: Stop the dev server, then** `npm run build`. Expected: build passes.
- [ ] **Step 5: Commit** `test(e2e): guided retro across two browsers`
- [ ] **Step 6: Push the branch and open a PR to `develop`** titled `Guided mode core (Parabol parity Step 1)`. The description lists: migration 015 (dev applied, production not), the `guided_mode` flag (off by default), the test counts, and what was seen in the browser at both widths. Leave it unmerged for Jordan.

---

## Out of this plan

Group titles, vote counts above one, reset grouping and the team-wide remaining count (Step 2). The ranked agenda, comments and topic-linked actions (Step 3); `canComment` exists in the profile but nothing reads it yet. Optional phases (Steps 6 and 9); `phase_config` gains their keys then. Deadline reminders and the deadline-reached chat ping (Step 11); the deadline here is displayed and resolved by the facilitator, never enforced by the server.
