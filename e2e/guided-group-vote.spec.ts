import { test, expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import {
  apiAddCard,
  apiCombine,
  apiGroups,
  apiJoin,
  apiMovePhase,
  apiVote,
  capture,
  createBoard,
  getBoard,
  hasJsonField,
  hasJsonNumber,
  joinAs,
  patchSettings,
  setFlagDirect,
  shown,
  voteRowsDirect,
  waitForRealtime,
} from './helpers';

/**
 * Guided group and vote parity across two real browsers and the real dev database. Every absence
 * check carries its controls: the capture holds real traffic for this board, the matcher fires on
 * real data in that same capture, and after the reveal the value does arrive.
 */

const rand = () => randomBytes(5).toString('hex').toUpperCase();

test.beforeAll(async () => {
  // The dev environment is meant to have the flag on, so it is never switched off again.
  await setFlagDirect('guided_mode', true);
});

// ---- local helpers ----------------------------------------------------------

const rail = (page: Page) => page.getByTestId('phase-rail').filter({ visible: true });

async function expectPhase(page: Page, phase: string, timeout = 10_000) {
  await expect(rail(page)).toHaveAttribute('data-phase', phase, { timeout });
}

/** Move a guided board one step through the phase route and require success. */
async function move(request: APIRequestContext, boardId: string, from: string, to: string) {
  const res = await apiMovePhase(request, boardId, from, to);
  expect(res.status(), `move ${from} -> ${to}: ${await res.text()}`).toBe(200);
}

/** Add a card as the owner of `request`; returns its id and text. */
async function addCard(request: APIRequestContext, boardId: string, columnId: string, label: string) {
  const text = `${label}-${rand()}`;
  const { body, response } = apiAddCard(request, boardId, columnId, text);
  const res = await response;
  expect(res.status(), `add card: ${await res.text()}`).toBe(200);
  return { id: body.id, text };
}

/** The vote stepper on the card (or list row) showing `text`: the nearest ancestor of the text that holds a stepper. */
function stepperOf(page: Page, text: string) {
  return page
    .getByText(text)
    .filter({ visible: true })
    .first()
    .locator('xpath=ancestor::*[.//*[@data-testid="vote-stepper"]][1]')
    .getByTestId('vote-stepper')
    .filter({ visible: true })
    .first();
}

/** The number between the minus and plus buttons (the stepper also holds screen-reader text). */
const countOf = (stepper: Locator) => stepper.locator('span[aria-live]');

const teamVotes = (page: Page) => page.getByTestId('team-votes-left').filter({ visible: true }).first();
const groupTitles = (page: Page) => page.getByTestId('group-title').filter({ visible: true });

/** Any card-ish content of the board: used only to be sure the cards reached the page before the walk. */
function hiddenOrShown(page: Page) {
  return page.getByTestId('card-text-hidden').or(page.getByText(/^(lead|child)-/)).filter({ visible: true }).first();
}

interface Pair {
  ctxA: BrowserContext;
  ctxB: BrowserContext;
  boardId: string;
  columnId: string;
  aliceName: string;
  bobName: string;
  aliceId: string;
  bobId: string;
}

/** A guided board with Alice (creator, facilitator) and Bob joined over the API: no browser pages. */
async function apiPair(browser: Browser): Promise<Pair> {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const aliceName = `Alice-${rand()}`;
  const bobName = `Bob-${rand()}`;
  const { boardId, columnId, participantId } = await createBoard(ctxA.request, { displayName: aliceName, mode: 'guided' });
  const joinB = await apiJoin(ctxB.request, boardId, bobName);
  expect(joinB.status()).toBe(200);
  const bobId: string = (await joinB.json()).participant.id;
  expect(participantId).toBeTruthy();
  return { ctxA, ctxB, boardId, columnId, aliceName, bobName, aliceId: participantId as string, bobId };
}

/** A guided board with Alice and Bob in real browsers (Alice created it, so she is the facilitator). */
async function pagePair(browser: Browser, aViewport?: { width: number; height: number }) {
  const ctxA = await browser.newContext(aViewport ? { viewport: aViewport } : {});
  const ctxB = await browser.newContext();
  const aliceName = `Alice-${rand()}`;
  const bobName = `Bob-${rand()}`;
  const { boardId, columnId } = await createBoard(ctxA.request, { mode: 'guided' });
  let capA!: ReturnType<typeof capture>;
  let capB!: ReturnType<typeof capture>;
  const pageA = await joinAs(ctxA, boardId, aliceName, { beforeGoto: (p) => { capA = capture(p); } });
  const pageB = await joinAs(ctxB, boardId, bobName, { beforeGoto: (p) => { capB = capture(p); } });
  const aliceId: string = (await getBoard(ctxA.request, boardId)).youAre.participantId;
  const bobId: string = (await getBoard(ctxB.request, boardId)).youAre.participantId;
  expect(aliceId).toBeTruthy();
  expect(bobId).toBeTruthy();
  await waitForRealtime(capA, boardId);
  await waitForRealtime(capB, boardId);
  await expectPhase(pageA, 'reflect');
  await expectPhase(pageB, 'reflect');
  return { ctxA, ctxB, boardId, columnId, aliceName, bobName, aliceId, bobId, pageA, pageB, capA, capB };
}

// ---- tests ------------------------------------------------------------------

test('concurrent adds from one person never pass either limit', async ({ browser }) => {
  const p = await apiPair(browser);
  const c1 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'one');
  const c2 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'two');
  const c3 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'three');
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await move(p.ctxA.request, p.boardId, 'group', 'next');

  // Eight adds in flight together from one request context (one cookie jar).
  const firstWave = await Promise.all(
    Array.from({ length: 8 }, () => apiVote(p.ctxB.request, p.boardId, c1.id, 'add'))
  );
  const firstStatuses = firstWave.map((r) => r.status());
  const firstBodies = await Promise.all(firstWave.map((r) => r.json()));
  test.info().annotations.push({ type: 'wave-1', description: JSON.stringify(firstStatuses) });
  expect(firstStatuses.filter((s) => s === 200), JSON.stringify(firstBodies)).toHaveLength(3);
  const refusedPerCard = firstBodies.filter((_, i) => firstStatuses[i] === 422);
  expect(refusedPerCard, JSON.stringify(firstBodies)).toHaveLength(5);
  for (const body of refusedPerCard) {
    expect(body).toMatchObject({ error: 'You can put at most 3 votes on one card', maxVotesPerCard: 3 });
  }
  expect(firstStatuses.filter((s) => s !== 200 && s !== 422), 'no other status').toHaveLength(0);
  let rows = await voteRowsDirect(p.boardId);
  expect(rows).toEqual([{ voter_id: p.bobId, card_id: c1.id, count: 3 }]);

  // Six more at once across two other cards: only two votes are left to spend.
  const secondWave = await Promise.all([
    ...Array.from({ length: 3 }, () => apiVote(p.ctxB.request, p.boardId, c2.id, 'add')),
    ...Array.from({ length: 3 }, () => apiVote(p.ctxB.request, p.boardId, c3.id, 'add')),
  ]);
  const secondStatuses = secondWave.map((r) => r.status());
  const secondBodies = await Promise.all(secondWave.map((r) => r.json()));
  test.info().annotations.push({ type: 'wave-2', description: JSON.stringify(secondStatuses) });
  expect(secondStatuses.filter((s) => s === 200), JSON.stringify(secondBodies)).toHaveLength(2);
  const refusedPerPerson = secondBodies.filter((_, i) => secondStatuses[i] === 422);
  expect(refusedPerPerson, JSON.stringify(secondBodies)).toHaveLength(4);
  for (const body of refusedPerPerson) {
    expect(body).toMatchObject({ error: 'Vote limit reached', maxVotes: 5 });
  }
  expect(secondStatuses.filter((s) => s !== 200 && s !== 422), 'no other status').toHaveLength(0);

  rows = await voteRowsDirect(p.boardId);
  expect(rows.every((r) => r.voter_id === p.bobId)).toBe(true);
  expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(5);
  expect(rows.find((r) => r.card_id === c1.id)?.count).toBe(3);
  expect(rows.filter((r) => r.card_id !== c1.id).reduce((sum, r) => sum + r.count, 0)).toBe(2);
  expect(rows.every((r) => r.count >= 1 && r.count <= 3)).toBe(true);

  await p.ctxA.close();
  await p.ctxB.close();
});

test('removing votes one at a time ends with no row', async ({ browser }) => {
  const p = await pagePair(browser);
  const { pageA, pageB, capA } = p;
  const c1 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'one');
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  await expectPhase(pageA, 'vote');
  await expectPhase(pageB, 'vote');
  const settings = (await getBoard(p.ctxA.request, p.boardId)).board.settings;
  expect(settings.max_votes_per_card).toBe(3);
  const mine = async () => (await voteRowsDirect(p.boardId)).filter((r) => r.voter_id === p.bobId && r.card_id === c1.id);

  for (let i = 0; i < 2; i++) {
    const res = await apiVote(p.ctxB.request, p.boardId, c1.id, 'add');
    expect(res.status(), await res.text()).toBe(200);
  }
  expect(await mine()).toEqual([{ voter_id: p.bobId, card_id: c1.id, count: 2 }]);

  // First remove: 2 -> 1, the row stays.
  const first = await apiVote(p.ctxB.request, p.boardId, c1.id, 'remove');
  expect(first.status(), await first.text()).toBe(200);
  const firstBody = await first.json();
  expect(firstBody).toEqual({ action: 'removed', voteId: expect.any(String), cardId: c1.id, count: 1, tally: { used: 1, at: expect.any(Number) } });
  expect(await mine()).toEqual([{ voter_id: p.bobId, card_id: c1.id, count: 1 }]);

  // Second remove: 1 -> 0, the row is deleted. The answer keeps the same shape, with count 0.
  const second = await apiVote(p.ctxB.request, p.boardId, c1.id, 'remove');
  expect(second.status(), await second.text()).toBe(200);
  const secondBody = await second.json();
  expect(secondBody).toEqual({ action: 'removed', voteId: firstBody.voteId, cardId: c1.id, count: 0, tally: { used: 0, at: expect.any(Number) } });
  expect(await mine()).toEqual([]);

  // Third remove: nothing left.
  const third = await apiVote(p.ctxB.request, p.boardId, c1.id, 'remove');
  expect(third.status()).toBe(409);
  expect(await third.json()).toEqual({ error: 'You have no vote on this card' });

  // Alice's page got the aggregate for the last remove (used 0 only ever comes from a remove).
  await expect
    .poll(async () => {
      await capA.settle();
      return capA.frames.some((f) => f.includes('vote-tally') && hasJsonNumber(f, 'used', 0));
    }, { timeout: 15_000 })
    .toBe(true);

  // After Discuss starts, an add is refused.
  await move(p.ctxA.request, p.boardId, 'vote', 'next');
  await expectPhase(pageB, 'discuss');
  const late = await apiVote(p.ctxB.request, p.boardId, c1.id, 'add');
  expect(late.status()).toBe(409);
  expect(await late.json()).toEqual({ error: 'Not available during Discuss' });
  expect(await mine()).toEqual([]);

  await p.ctxA.close();
  await p.ctxB.close();
});

test("a participant never learns another person's count during Vote", async ({ browser }) => {
  const p = await pagePair(browser);
  const { pageA, pageB, capB } = p;
  const c1 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'alpha');
  const c2 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'beta');
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  await expectPhase(pageA, 'vote');
  await expectPhase(pageB, 'vote');
  await expect(shown(pageA, c1.text)).toBeVisible();
  await expect(shown(pageB, c2.text)).toBeVisible();

  // A puts three votes on c1 with the stepper.
  const aStepper = stepperOf(pageA, c1.text);
  await expect(aStepper).toBeVisible();
  for (let i = 0; i < 3; i++) await aStepper.getByRole('button', { name: 'Add a vote' }).click();
  await expect(countOf(aStepper)).toHaveText('3');
  await expect(aStepper.getByRole('button', { name: 'Add a vote' })).toBeDisabled(); // per-card limit reached
  await expect.poll(async () => (await voteRowsDirect(p.boardId)).find((r) => r.voter_id === p.aliceId && r.card_id === c1.id)?.count).toBe(3);

  // B puts two votes on c2.
  const bStepper = stepperOf(pageB, c2.text);
  await expect(bStepper).toBeVisible();
  await bStepper.getByRole('button', { name: 'Add a vote' }).click();
  await bStepper.getByRole('button', { name: 'Add a vote' }).click();
  await expect(countOf(bStepper)).toHaveText('2');
  await expect.poll(async () => (await voteRowsDirect(p.boardId)).find((r) => r.voter_id === p.bobId && r.card_id === c2.id)?.count).toBe(2);

  // The team number reaches B without a reload: 2 people x 5 votes - 5 spent.
  await expect(teamVotes(pageB)).toHaveText('Team: 5 votes left', { timeout: 10_000 });
  await expect(teamVotes(pageA)).toHaveText('Team: 5 votes left', { timeout: 10_000 });

  // Controls: B's capture holds real traffic, B's own count and the aggregate arrived, and the matcher fires.
  await expect
    .poll(async () => {
      await capB.settle();
      return capB.frames.some((f) => f.includes('vote-tally') && hasJsonNumber(f, 'used', 5));
    }, { timeout: 15_000 })
    .toBe(true);
  await new Promise((r) => setTimeout(r, 1500)); // a late frame from the other person's earlier votes must have time to arrive
  await capB.settle();
  const duringVote = capB.all();
  expect(duringVote).toContain(p.boardId); // the capture holds real app traffic for this board
  expect(hasJsonNumber(duringVote, 'count', 2), "B's own count arrives").toBe(true);
  expect(hasJsonNumber(duringVote, 'used', 5), 'the aggregate arrives').toBe(true);
  expect(duringVote).toContain('vote-tally');
  expect(hasJsonField(duringVote, 'display_name', p.aliceName), 'matcher control').toBe(true);
  // Matcher self-checks on the same capture's shape: a longer number never matches.
  expect(hasJsonNumber('{"count":20}', 'count', 2)).toBe(false);
  expect(hasJsonNumber('{\\"count\\":12,', 'count', 2)).toBe(false);
  expect(hasJsonNumber('{\\"count\\":2,', 'count', 2)).toBe(true);
  expect(hasJsonNumber('{"count":2.5}', 'count', 2)).toBe(false);
  expect(hasJsonNumber('{"vote_count":2,', 'count', 2)).toBe(false);

  // Absence: nothing says what A voted or how many.
  expect(hasJsonField(duringVote, 'voter_id', p.aliceId), "A's voter_id in B's traffic").toBe(false);
  expect(hasJsonNumber(duringVote, 'count', 3), "A's count of 3 in B's traffic").toBe(false);
  expect(duringVote).not.toContain('vote-cast');
  expect(duringVote).not.toContain('vote-removed');
  const bVotes = (await getBoard(p.ctxB.request, p.boardId)).votes as { voter_id: string; card_id: string; count: number }[];
  expect(bVotes).toEqual([expect.objectContaining({ voter_id: p.bobId, card_id: c2.id, count: 2 })]);

  // Reveal: A moves to Discuss; the vote that was absent arrives and the pill reads the total.
  await move(p.ctxA.request, p.boardId, 'vote', 'next');
  await expectPhase(pageB, 'discuss');
  await expect
    .poll(async () => {
      await capB.settle();
      return hasJsonField(capB.all(), 'voter_id', p.aliceId);
    }, { timeout: 10_000 })
    .toBe(true);
  expect(hasJsonNumber(capB.all(), 'count', 3), "A's count arrives after the reveal").toBe(true);
  const pill = (page: Page, label: string) =>
    page.locator(`[aria-label^="${label}"]`).or(page.getByText(label, { exact: true })).filter({ visible: true }).first();
  await expect(pill(pageB, '3 votes')).toBeVisible({ timeout: 10_000 });
  await expect(pill(pageA, '3 votes')).toBeVisible({ timeout: 10_000 });
  await expect(pill(pageB, '2 votes')).toBeVisible();

  await p.ctxA.close();
  await p.ctxB.close();
});

test('lowering a limit below what is spent is refused and changes nothing', async ({ browser }) => {
  const p = await apiPair(browser);
  const c1 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'one');
  const c2 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'two');
  const c3 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'three');
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await move(p.ctxA.request, p.boardId, 'group', 'next');

  // B spends 4 votes, at most 2 on one card.
  for (const id of [c1.id, c1.id, c2.id, c3.id]) {
    const res = await apiVote(p.ctxB.request, p.boardId, id, 'add');
    expect(res.status(), await res.text()).toBe(200);
  }
  const before = await voteRowsDirect(p.boardId);
  const settingsBefore = (await getBoard(p.ctxA.request, p.boardId)).board.settings;
  expect(settingsBefore.max_votes_per_participant).toBe(5);
  expect(settingsBefore.max_votes_per_card).toBe(3);

  const lowerPerson = await patchSettings(p.ctxA.request, p.boardId, { max_votes_per_participant: 3 });
  expect(lowerPerson.status()).toBe(409);
  const lowerPersonBody = await lowerPerson.json();
  expect(lowerPersonBody).toEqual({ error: 'Votes per person cannot go below what someone has already used.' });
  expect(JSON.stringify(lowerPersonBody)).not.toMatch(/\d/);

  const lowerCard = await patchSettings(p.ctxA.request, p.boardId, { max_votes_per_card: 1 });
  expect(lowerCard.status()).toBe(409);
  const lowerCardBody = await lowerCard.json();
  expect(lowerCardBody).toEqual({ error: 'Votes per card cannot go below what someone already has on one card.' });
  expect(JSON.stringify(lowerCardBody)).not.toMatch(/\d/);

  const unchanged = (await getBoard(p.ctxA.request, p.boardId)).board.settings;
  expect(unchanged.max_votes_per_participant).toBe(5);
  expect(unchanged.max_votes_per_card).toBe(3);
  expect(await voteRowsDirect(p.boardId)).toEqual(before);

  // Raising is fine; a participant cannot touch settings at all.
  const raise = await patchSettings(p.ctxA.request, p.boardId, { max_votes_per_participant: 6 });
  expect(raise.status(), await raise.text()).toBe(200);
  expect((await getBoard(p.ctxA.request, p.boardId)).board.settings.max_votes_per_participant).toBe(6);
  const byParticipant = await patchSettings(p.ctxB.request, p.boardId, { max_votes_per_participant: 8 });
  expect(byParticipant.status()).toBe(403);
  expect((await getBoard(p.ctxA.request, p.boardId)).board.settings.max_votes_per_participant).toBe(6);
  expect(await voteRowsDirect(p.boardId)).toEqual(before);

  await p.ctxA.close();
  await p.ctxB.close();
});

test('grouping, ungrouping and reset never change a vote, and a group scores its lead plus children', async ({ browser }) => {
  const p = await pagePair(browser);
  const { pageA, pageB } = p;
  const c1 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'lead');
  const c2 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'child');
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  for (let i = 0; i < 2; i++) expect((await apiVote(p.ctxA.request, p.boardId, c1.id, 'add')).status()).toBe(200);
  expect((await apiVote(p.ctxB.request, p.boardId, c2.id, 'add')).status()).toBe(200);
  const before = await voteRowsDirect(p.boardId);
  expect(before.reduce((sum, r) => sum + r.count, 0)).toBe(3);

  await move(p.ctxA.request, p.boardId, 'vote', 'back');
  await expectPhase(pageA, 'group');
  await expectPhase(pageB, 'group');
  expect(await voteRowsDirect(p.boardId)).toEqual(before);

  const combine = await apiCombine(p.ctxA.request, p.boardId, c2.id, c1.id);
  expect(combine.status(), await combine.text()).toBe(200);
  expect(await voteRowsDirect(p.boardId)).toEqual(before);
  const ungroup = await apiCombine(p.ctxA.request, p.boardId, c2.id, null);
  expect(ungroup.status(), await ungroup.text()).toBe(200);
  expect(await voteRowsDirect(p.boardId)).toEqual(before);
  const again = await apiCombine(p.ctxA.request, p.boardId, c2.id, c1.id);
  expect(again.status(), await again.text()).toBe(200);
  expect(await voteRowsDirect(p.boardId)).toEqual(before);
  const titled = await apiGroups(p.ctxB.request, p.boardId, { action: 'set-title', cardId: c1.id, title: 'Deploys' });
  expect(titled.status(), await titled.text()).toBe(200);
  expect(await voteRowsDirect(p.boardId)).toEqual(before);
  await expect(groupTitles(pageA).first()).toHaveText('Deploys', { timeout: 10_000 });
  await expect(groupTitles(pageB).first()).toHaveText('Deploys', { timeout: 10_000 });

  // A resets through the UI.
  await pageA.getByRole('button', { name: 'Reset grouping', exact: true }).filter({ visible: true }).click();
  const dialog = pageA.getByRole('dialog', { name: 'Reset grouping?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Reset grouping', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(groupTitles(pageA)).toHaveCount(0, { timeout: 10_000 });
  await expect(groupTitles(pageB)).toHaveCount(0, { timeout: 10_000 }); // no reload
  const afterReset = await getBoard(p.ctxA.request, p.boardId);
  expect((afterReset.cards as { merged_with: string | null; group_title: string | null }[]).every(
    (c) => !c.merged_with && !c.group_title
  )).toBe(true);
  expect(await voteRowsDirect(p.boardId)).toEqual(before);

  // Group again, then Vote and Discuss: the lead's pill scores the lead plus its child (2 + 1).
  const regroup = await apiCombine(p.ctxA.request, p.boardId, c2.id, c1.id);
  expect(regroup.status(), await regroup.text()).toBe(200);
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  await move(p.ctxA.request, p.boardId, 'vote', 'next');
  await expectPhase(pageA, 'discuss');
  await expect(
    pageA.locator('[aria-label^="3 votes"]').or(pageA.getByText('3 votes', { exact: true })).filter({ visible: true }).first()
  ).toBeVisible({ timeout: 10_000 });
  expect(await voteRowsDirect(p.boardId)).toEqual(before);

  await p.ctxA.close();
  await p.ctxB.close();
});

test("group titles: anyone names a group during Group only; reset is the facilitator's", async ({ browser }) => {
  const p = await pagePair(browser);
  const { pageA, pageB } = p;
  const c1 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'lead');
  const c2 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'child');
  const c3 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'single');
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await expectPhase(pageA, 'group');
  await expectPhase(pageB, 'group');
  const combine = await apiCombine(p.ctxA.request, p.boardId, c2.id, c1.id);
  expect(combine.status(), await combine.text()).toBe(200);

  // B names the group through the UI; A sees it without a reload.
  const nameIt = pageB.getByRole('button', { name: 'Name this group', exact: true }).filter({ visible: true });
  await expect(nameIt).toHaveCount(1, { timeout: 10_000 });
  await nameIt.click();
  const input = pageB.getByLabel('Group title').filter({ visible: true });
  await input.fill('Deploys');
  await input.press('Enter');
  await expect(groupTitles(pageB).first()).toHaveText('Deploys', { timeout: 10_000 });
  await expect(groupTitles(pageA).first()).toHaveText('Deploys', { timeout: 10_000 });
  await expect(pageA.getByRole('button', { name: 'Rename group', exact: true }).filter({ visible: true })).toHaveCount(1);

  // The server's rules.
  const tooLong = await apiGroups(p.ctxB.request, p.boardId, { action: 'set-title', cardId: c1.id, title: 'x'.repeat(81) });
  expect(tooLong.status()).toBe(400);
  expect((await tooLong.json()).error).toBe('Group title must be at most 80 characters');
  const notLead = await apiGroups(p.ctxB.request, p.boardId, { action: 'set-title', cardId: c3.id, title: 'Nope' });
  expect(notLead.status()).toBe(409);
  expect((await notLead.json()).error).toBe('Only a group can have a title');
  const byParticipant = await apiGroups(p.ctxB.request, p.boardId, { action: 'reset' });
  expect(byParticipant.status()).toBe(403);
  expect((await byParticipant.json()).error).toBe('Facilitator access required');
  expect((await getBoard(p.ctxA.request, p.boardId)).cards.find((c: { id: string }) => c.id === c1.id).group_title).toBe('Deploys');

  // Vote: titling is closed, the title stays on both pages.
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  await expectPhase(pageA, 'vote');
  await expectPhase(pageB, 'vote');
  const inVote = await apiGroups(p.ctxB.request, p.boardId, { action: 'set-title', cardId: c1.id, title: 'Later' });
  expect(inVote.status()).toBe(409);
  expect((await inVote.json()).error).toBe('Not available during Vote');
  await expect(groupTitles(pageA).first()).toHaveText('Deploys');
  await expect(groupTitles(pageB).first()).toHaveText('Deploys');

  // List view: the stepper is on a row, two votes go on one card from there, and the grid shows the same count.
  await pageA.goto(`/board/${p.boardId}?view=list`);
  await expectPhase(pageA, 'vote');
  const listStepper = stepperOf(pageA, c3.text);
  await expect(listStepper).toBeVisible({ timeout: 10_000 });
  await listStepper.getByRole('button', { name: 'Add a vote' }).click();
  await listStepper.getByRole('button', { name: 'Add a vote' }).click();
  await expect(countOf(listStepper)).toHaveText('2');
  await expect
    .poll(async () => (await voteRowsDirect(p.boardId)).find((r) => r.voter_id === p.aliceId && r.card_id === c3.id)?.count)
    .toBe(2);
  await pageA.goto(`/board/${p.boardId}`);
  await expectPhase(pageA, 'vote');
  await expect(countOf(stepperOf(pageA, c3.text))).toHaveText('2', { timeout: 10_000 });

  await p.ctxA.close();
  await p.ctxB.close();
});

test('a drop that lands after a reset groups only the cards in that drop', async ({ browser }) => {
  const p = await pagePair(browser);
  const { pageA } = p;
  const c1 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'one');
  const c2 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'two');
  const c3 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'three');
  // An earlier Vote puts votes on c1; then back to Group.
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  expect((await apiVote(p.ctxA.request, p.boardId, c1.id, 'add')).status()).toBe(200);
  expect((await apiVote(p.ctxB.request, p.boardId, c1.id, 'add')).status()).toBe(200);
  expect((await apiVote(p.ctxB.request, p.boardId, c1.id, 'add')).status()).toBe(200);
  await move(p.ctxA.request, p.boardId, 'vote', 'back');
  await expectPhase(pageA, 'group');
  const before = await voteRowsDirect(p.boardId);
  expect(before.reduce((sum, r) => sum + r.count, 0)).toBe(3);

  // c2 and c3 under c1.
  for (const child of [c2, c3]) {
    const res = await apiCombine(p.ctxB.request, p.boardId, child.id, c1.id);
    expect(res.status(), await res.text()).toBe(200);
  }
  const nameIt = pageA.getByRole('button', { name: 'Name this group', exact: true }).filter({ visible: true });
  await expect(nameIt).toHaveCount(1, { timeout: 10_000 });

  // A resets; the page drops its group before the late drop lands.
  const reset = await apiGroups(p.ctxA.request, p.boardId, { action: 'reset' });
  expect(reset.status(), await reset.text()).toBe(200);
  expect(await reset.json()).toEqual({ ok: true, cleared: 2 });
  await expect(nameIt).toHaveCount(0, { timeout: 10_000 });

  // B's drop of c3 on c2 arrives after the reset: it groups only those two.
  const late = await apiCombine(p.ctxB.request, p.boardId, c3.id, c2.id);
  expect(late.status(), await late.text()).toBe(200);
  const board = await getBoard(p.ctxA.request, p.boardId);
  const merged = (board.cards as { id: string; merged_with: string | null }[]).filter((c) => c.merged_with);
  expect(merged.map((c) => [c.id, c.merged_with])).toEqual([[c3.id, c2.id]]);
  expect(await voteRowsDirect(p.boardId)).toEqual(before);
  await expect(nameIt).toHaveCount(1, { timeout: 10_000 }); // exactly one group, no reload

  await p.ctxA.close();
  await p.ctxB.close();
});

test("an open board's votes are unchanged", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();

  // Control: a guided board does render the stepper, the team number and Reset grouping, so their absence below means something.
  const guided = await createBoard(ctxA.request, { displayName: `Alice-${rand()}`, mode: 'guided' });
  const gCard = await addCard(ctxA.request, guided.boardId, guided.columnId, 'guided');
  await move(ctxA.request, guided.boardId, 'reflect', 'next');
  const guidedPage = await ctxA.newPage();
  await guidedPage.goto(`/board/${guided.boardId}`);
  await expectPhase(guidedPage, 'group');
  await expect(guidedPage.getByRole('button', { name: 'Reset grouping', exact: true }).filter({ visible: true })).toBeVisible();
  await move(ctxA.request, guided.boardId, 'group', 'next');
  await expectPhase(guidedPage, 'vote');
  await expect(stepperOf(guidedPage, gCard.text)).toBeVisible();
  await expect(teamVotes(guidedPage)).toBeVisible();
  await guidedPage.close();

  // The open board, voting on.
  const open = await createBoard(ctxA.request, {
    displayName: `Alice-${rand()}`,
    settings: { card_visibility: 'visible', voting_enabled: true },
  });
  expect((await apiJoin(ctxB.request, open.boardId, 'Bob')).status()).toBe(200);
  const card = await addCard(ctxA.request, open.boardId, open.columnId, 'open');

  const added = await ctxA.request.post(`/api/boards/${open.boardId}/votes`, { data: { cardId: card.id } });
  expect(added.status(), await added.text()).toBe(200);
  const addedJson = await added.json();
  expect(Object.keys(addedJson).sort()).toEqual(['action', 'vote']);
  expect(addedJson.action).toBe('added');
  const removed = await ctxA.request.post(`/api/boards/${open.boardId}/votes`, { data: { cardId: card.id } });
  expect(removed.status(), await removed.text()).toBe(200);
  expect((await removed.json()).action).toBe('removed');

  const guidedAction = await apiVote(ctxA.request, open.boardId, card.id, 'add');
  expect(guidedAction.status()).toBe(409);
  expect((await guidedAction.json()).error).toBe('This board is not in guided mode');
  const reset = await apiGroups(ctxA.request, open.boardId, { action: 'reset' });
  expect(reset.status()).toBe(409);
  expect((await reset.json()).error).toBe('This board is not in guided mode');
  const perCard = await patchSettings(ctxA.request, open.boardId, { max_votes_per_card: 2 });
  expect(perCard.status()).toBe(409);
  expect((await perCard.json()).error).toBe('Votes per card is only available on guided boards');

  const page = await ctxA.newPage();
  await page.goto(`/board/${open.boardId}`);
  await expect(page.getByRole('button', { name: 'Vote for this card', exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('vote-stepper')).toHaveCount(0);
  await expect(page.getByTestId('team-votes-left')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset grouping' })).toHaveCount(0);
  await expect(page.getByTestId('phase-rail')).toHaveCount(0);

  await ctxA.close();
  await ctxB.close();
});

test('dialogs opened from the board header are fully on screen', async ({ browser }) => {
  const viewport = { width: 1280, height: 800 };
  const p = await pagePair(browser, viewport);
  const { pageA } = p;
  expect(pageA.viewportSize()).toEqual(viewport);
  const c1 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'lead');
  const c2 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'child');
  await expect(hiddenOrShown(pageA)).toBeVisible({ timeout: 10_000 });

  /** Measure the open dialog titled `title`: its title box and the fixed, full-screen ancestor that is its overlay. */
  const measure = async (title: string) => {
    const heading = pageA.getByRole('heading', { name: title, exact: true });
    await expect(heading).toBeVisible();
    const read = () =>
      heading.evaluate((el) => {
        const box = (r: DOMRect) => ({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
        let overlay: HTMLElement | null = el.parentElement;
        while (overlay && getComputedStyle(overlay).position !== 'fixed') overlay = overlay.parentElement;
        return {
          title: box(el.getBoundingClientRect()),
          overlay: overlay ? box(overlay.getBoundingClientRect()) : null,
          vw: window.innerWidth,
          vh: window.innerHeight,
        };
      });
    // The dialog animates in for 150ms: measure once two reads agree.
    let prev = '';
    let cur = await read();
    for (let i = 0; i < 20 && JSON.stringify(cur) !== prev; i++) {
      prev = JSON.stringify(cur);
      await pageA.waitForTimeout(100);
      cur = await read();
    }
    test.info().annotations.push({ type: `measure: ${title}`, description: JSON.stringify(cur) });
    console.log(`measure ${title}: ${JSON.stringify(cur)}`);
    return cur;
  };
  const expectOnScreen = (m: Awaited<ReturnType<typeof measure>>, label: string) => {
    expect(m.vw, `${label} viewport width`).toBe(viewport.width);
    expect(m.vh, `${label} viewport height`).toBe(viewport.height);
    expect(m.overlay, `${label}: a fixed ancestor exists`).not.toBeNull();
    const o = m.overlay!;
    expect([o.top, o.left, o.width, o.height], `${label} overlay covers the viewport`).toEqual([0, 0, viewport.width, viewport.height]);
    expect(m.title.top, `${label} title top`).toBeGreaterThanOrEqual(0);
    expect(m.title.bottom, `${label} title bottom`).toBeLessThanOrEqual(viewport.height);
    expect(m.title.left, `${label} title left`).toBeGreaterThanOrEqual(0);
    expect(m.title.right, `${label} title right`).toBeLessThanOrEqual(viewport.width);
    expect(m.title.height, `${label} title has a box`).toBeGreaterThan(0);
  };

  // (1) Reflect, Bob joined and not ready: Next: Group asks "Move on?".
  await rail(pageA).getByRole('button', { name: 'Next: Group' }).click();
  expectOnScreen(await measure('Move on?'), 'Move on?');
  await pageA.getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(pageA.getByRole('heading', { name: 'Move on?', exact: true })).toBeHidden();
  await expectPhase(pageA, 'reflect', 2_000);

  // (2) Group two cards, then Reset grouping.
  await rail(pageA).getByRole('button', { name: 'Next: Group' }).click();
  await pageA.getByRole('button', { name: 'Move on', exact: true }).click();
  await expectPhase(pageA, 'group');
  const combine = await apiCombine(p.ctxA.request, p.boardId, c2.id, c1.id);
  expect(combine.status(), await combine.text()).toBe(200);
  const resetButton = pageA.getByRole('button', { name: 'Reset grouping', exact: true }).filter({ visible: true });
  await expect(resetButton).toBeEnabled({ timeout: 10_000 });
  await resetButton.click();
  expectOnScreen(await measure('Reset grouping?'), 'Reset grouping?');
  await pageA.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(pageA.getByRole('heading', { name: 'Reset grouping?', exact: true })).toBeHidden();

  await p.ctxA.close();
  await p.ctxB.close();
});
