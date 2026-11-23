import { test, expect, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';
import {
  actionRowsDirect,
  apiActionItem,
  apiAddCard,
  apiAddColumn,
  apiCombine,
  apiComment,
  apiDeleteComment,
  apiEditComment,
  apiJoin,
  apiMovePhase,
  apiPatchActionItem,
  apiSetTopic,
  apiVote,
  capture,
  commentRowsDirect,
  createBoard,
  getBoard,
  hasJsonField,
  joinAs,
  patchSettings,
  setFlagDirect,
  shown,
  voteRowsDirect,
  waitForRealtime,
} from './helpers';

/**
 * Guided Discuss across two real browsers and the real dev database: group-aware votes, the ranked
 * agenda and the stored current topic, following the facilitator, comment threads, anonymous
 * comments, the completed view, action items linked to a topic, and the open board left unchanged.
 * Every absence check carries its controls (the capture holds this board's real traffic, the matcher
 * fires on real data in that same capture, and where it matters the value does arrive later).
 */

const rand = () => randomBytes(5).toString('hex').toUpperCase();

test.beforeAll(async () => {
  // The dev environment is meant to have the flag on, so it is never switched off again.
  await setFlagDirect('guided_mode', true);
});

// ---- local helpers ----------------------------------------------------------

const rail = (page: Page) => page.getByTestId('phase-rail').filter({ visible: true });
const agendaItems = (page: Page) => page.getByTestId('agenda-item').filter({ visible: true });
const topicPanel = (page: Page) => page.getByTestId('topic-panel').filter({ visible: true });
const topicActions = (page: Page) => page.getByTestId('topic-actions').filter({ visible: true });
const viewingBar = (page: Page) => page.getByTestId('viewing-another').filter({ visible: true });

async function expectPhase(page: Page, phase: string, timeout = 10_000) {
  await expect(rail(page)).toHaveAttribute('data-phase', phase, { timeout });
}

/** Move a guided board through the phase route and require success. */
async function move(request: APIRequestContext, boardId: string, from: string, to: string) {
  const res = await apiMovePhase(request, boardId, from, to);
  expect(res.status(), `move ${from} -> ${to}: ${await res.text()}`).toBe(200);
}

/** Reflect to Discuss through the API (the cards and grouping are already in place). */
async function toDiscuss(request: APIRequestContext, boardId: string) {
  await move(request, boardId, 'reflect', 'next');
  await move(request, boardId, 'group', 'next');
  await move(request, boardId, 'vote', 'next');
}

async function addCard(request: APIRequestContext, boardId: string, columnId: string, label: string) {
  const text = `${label}-${rand()}`;
  const { body, response } = apiAddCard(request, boardId, columnId, text);
  const res = await response;
  expect(res.status(), `add card: ${await res.text()}`).toBe(200);
  return { id: body.id as string, text };
}

/** Like addCard but with a chosen id (the id decides nothing except the last tie-break). */
async function addCardWithId(request: APIRequestContext, boardId: string, columnId: string, id: string, label: string) {
  const text = `${label}-${rand()}`;
  const res = await request.post(`/api/boards/${boardId}/cards`, { data: { id, columnId, text, position: 0 } });
  expect(res.status(), `add card: ${await res.text()}`).toBe(200);
  return { id, text };
}

async function combine(request: APIRequestContext, boardId: string, childId: string, parentId: string) {
  const res = await apiCombine(request, boardId, childId, parentId);
  expect(res.status(), `combine: ${await res.text()}`).toBe(200);
}

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
const countOf = (stepper: Locator) => stepper.locator('span[aria-live]');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A guided board with Alice (creator, facilitator) and Bob in real browsers. */
async function pagePair(browser: Browser, viewport?: { width: number; height: number }, bViewport?: { width: number; height: number }) {
  const ctxA = await browser.newContext(viewport ? { viewport } : {});
  const ctxB = await browser.newContext(bViewport ? { viewport: bViewport } : {});
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
  return { ctxA, ctxB, boardId, columnId, aliceName, bobName, aliceId, bobId, pageA, pageB, capA, capB };
}

/** Wait until the Discuss view (agenda and a topic panel) is on screen. */
async function expectDiscussShown(page: Page) {
  await expect(topicPanel(page)).toBeVisible({ timeout: 15_000 });
  await expect(agendaItems(page).first()).toBeVisible();
}

// ---- tests ------------------------------------------------------------------

test('votes left on a card that was grouped later count toward the group and can be taken back', async ({ browser }) => {
  const p = await pagePair(browser);
  const { pageB } = p;
  const x = await addCard(p.ctxA.request, p.boardId, p.columnId, 'child');
  const y = await addCard(p.ctxA.request, p.boardId, p.columnId, 'lead');
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  expect((await getBoard(p.ctxA.request, p.boardId)).board.settings.max_votes_per_card).toBe(3);

  // B puts two votes on X while X is still a card of its own.
  for (let i = 0; i < 2; i++) {
    const res = await apiVote(p.ctxB.request, p.boardId, x.id, 'add');
    expect(res.status(), await res.text()).toBe(200);
  }
  // Back to Group: X goes under Y; then Vote again.
  await move(p.ctxA.request, p.boardId, 'vote', 'back');
  await combine(p.ctxA.request, p.boardId, x.id, y.id);
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  await expectPhase(pageB, 'vote');

  // The two votes left on X count on the group: B's stepper on the lead reads 2.
  await expect(shown(pageB, y.text)).toBeVisible({ timeout: 10_000 });
  const stepperY = stepperOf(pageB, y.text);
  await expect(stepperY).toBeVisible();
  await expect(countOf(stepperY)).toHaveText('2', { timeout: 10_000 });

  const statuses: Record<string, number> = {};
  // One more fits (3 on the group), the next is over the per-card limit.
  const addOk = await apiVote(p.ctxB.request, p.boardId, y.id, 'add');
  statuses.addToLead = addOk.status();
  expect(addOk.status(), await addOk.text()).toBe(200);
  const addOver = await apiVote(p.ctxB.request, p.boardId, y.id, 'add');
  statuses.addOverLimit = addOver.status();
  expect(addOver.status()).toBe(422);
  expect(await addOver.json()).toMatchObject({ error: 'You can put at most 3 votes on one card', maxVotesPerCard: 3 });

  const rowsOf = async () =>
    (await voteRowsDirect(p.boardId))
      .filter((r) => r.voter_id === p.bobId)
      .map((r) => `${r.card_id === y.id ? 'Y' : r.card_id === x.id ? 'X' : r.card_id}:${r.count}`)
      .sort();
  expect(await rowsOf()).toEqual(['X:2', 'Y:1']);

  // The limit cannot drop below what someone already holds on one group.
  const lower = await patchSettings(p.ctxA.request, p.boardId, { max_votes_per_card: 2 });
  statuses.lowerLimit = lower.status();
  expect(lower.status(), await lower.text()).toBe(409);
  expect(await lower.json()).toEqual({ error: 'Votes per card cannot go below what someone already has on one card.' });
  expect((await getBoard(p.ctxA.request, p.boardId)).board.settings.max_votes_per_card).toBe(3);

  // Removing on the lead takes the lead's own row first, then the child's, one at a time.
  const r1 = await apiVote(p.ctxB.request, p.boardId, y.id, 'remove');
  statuses.remove1 = r1.status();
  expect(r1.status(), await r1.text()).toBe(200);
  expect(await r1.json()).toMatchObject({ action: 'removed', cardId: y.id, count: 0 });
  expect(await rowsOf()).toEqual(['X:2']);

  const r2 = await apiVote(p.ctxB.request, p.boardId, y.id, 'remove');
  statuses.remove2 = r2.status();
  expect(r2.status(), await r2.text()).toBe(200);
  expect(await r2.json()).toMatchObject({ action: 'removed', cardId: x.id, count: 1 });
  expect(await rowsOf()).toEqual(['X:1']);

  const r3 = await apiVote(p.ctxB.request, p.boardId, y.id, 'remove');
  statuses.remove3 = r3.status();
  expect(r3.status(), await r3.text()).toBe(200);
  expect(await r3.json()).toMatchObject({ action: 'removed', cardId: x.id, count: 0 });
  expect(await rowsOf()).toEqual([]);

  const r4 = await apiVote(p.ctxB.request, p.boardId, y.id, 'remove');
  statuses.remove4 = r4.status();
  expect(r4.status()).toBe(409);
  expect(await r4.json()).toEqual({ error: 'You have no vote on this card' });
  expect((await voteRowsDirect(p.boardId)).filter((r) => r.voter_id === p.bobId)).toEqual([]);

  test.info().annotations.push({ type: 'group-vote-statuses', description: JSON.stringify(statuses) });
  console.log(`group-vote statuses: ${JSON.stringify(statuses)}`);
  await p.ctxA.close();
  await p.ctxB.close();
});

test('entering Discuss stores the first agenda item, the same order every browser shows', async ({ browser }) => {
  const p = await pagePair(browser);
  const { pageA, pageB } = p;
  const col2 = nanoid(10);
  const added = await apiAddColumn(p.ctxA.request, p.boardId, { id: col2, title: 'Second', position: 1 });
  expect(added.status(), await added.text()).toBe(200);

  // Creation order p, q, t, r, s. The two TIED top cards (p, q) have ids whose byte order contradicts
  // their creation order (p, created first, has the later id), so only the creation-time clause can
  // put p first; the stored topic is decided by that tie. The group (r with child s) scores below the
  // tie and above t, but only through its child's vote: without it r and t tie at 0 and t, created
  // before r, would come first.
  const cardP = await addCardWithId(p.ctxA.request, p.boardId, p.columnId, `z${nanoid(8)}`, 'p');
  const q = await addCardWithId(p.ctxA.request, p.boardId, col2, `a${nanoid(8)}`, 'q');
  const t = await addCardWithId(p.ctxA.request, p.boardId, col2, `m${nanoid(8)}`, 't');
  const r = await addCardWithId(p.ctxA.request, p.boardId, p.columnId, `n${nanoid(8)}`, 'r');
  const s = await addCardWithId(p.ctxA.request, p.boardId, p.columnId, `o${nanoid(8)}`, 's');
  const created = (await getBoard(p.ctxA.request, p.boardId)).cards as { id: string; created_at: string }[];
  const at = (id: string) => Date.parse(created.find((c) => c.id === id)!.created_at);
  expect(at(q.id), 'p and q were created at different times').toBeGreaterThan(at(cardP.id));
  expect(cardP.id > q.id, "p's id sorts after q's although p is older").toBe(true);
  test.info().annotations.push({
    type: 'tie-ids',
    description: JSON.stringify({ p: [cardP.id, created.find((c) => c.id === cardP.id)!.created_at], q: [q.id, created.find((c) => c.id === q.id)!.created_at] }),
  });
  console.log(`tie ids and created_at: p ${cardP.id} ${created.find((c) => c.id === cardP.id)!.created_at}; q ${q.id} ${created.find((c) => c.id === q.id)!.created_at}`);

  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  // Vote: A and B each put one vote on p and one on q (p 2, q 2); B puts one on s while s is still a
  // card of its own. Once s is under r, the group scores 1 (the child's vote) and t scores 0.
  const cast = async (req: APIRequestContext, cardId: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const res = await apiVote(req, p.boardId, cardId, 'add');
      expect(res.status(), await res.text()).toBe(200);
    }
  };
  await cast(p.ctxA.request, cardP.id, 1);
  await cast(p.ctxA.request, q.id, 1);
  await cast(p.ctxB.request, cardP.id, 1);
  await cast(p.ctxB.request, q.id, 1);
  await cast(p.ctxB.request, s.id, 1);
  // Back to Group, s under r, Vote again: the votes stay and the child's vote counts for its lead.
  await move(p.ctxA.request, p.boardId, 'vote', 'back');
  await combine(p.ctxA.request, p.boardId, s.id, r.id);
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  expect((await getBoard(p.ctxA.request, p.boardId)).board.phase_config.topic ?? null).toBeNull();

  await move(p.ctxA.request, p.boardId, 'vote', 'next');
  await expectDiscussShown(pageA);
  await expectDiscussShown(pageB);

  // The expected agenda: p, then q (tied at 2; p was created first although its id sorts later), then
  // r's group (1 vote, from its child), then t with no votes.
  const expected = [new RegExp(`${escapeRe(cardP.text)}.*2 votes`), new RegExp(`${escapeRe(q.text)}.*2 votes`), /Group of 2 cards.*1 vote.*2 cards/, new RegExp(`${escapeRe(t.text)}.*No votes`)];
  await expect(agendaItems(pageA)).toHaveText(expected, { timeout: 10_000 });
  await expect(agendaItems(pageB)).toHaveText(expected, { timeout: 10_000 });
  const aTexts = await agendaItems(pageA).allTextContents();
  const bTexts = await agendaItems(pageB).allTextContents();
  expect(bTexts).toEqual(aTexts);
  test.info().annotations.push({ type: 'agenda-order', description: JSON.stringify(aTexts) });
  console.log(`agenda order (both browsers): ${JSON.stringify(aTexts)}`);
  // The server's stored topic must be the card both browsers rank first.
  const storedFirst = (await getBoard(p.ctxA.request, p.boardId)).board.phase_config.topic;
  expect(storedFirst, `stored topic ${storedFirst}; both browsers rank p (${cardP.id}) first`).toBe(cardP.id);
  await expect(agendaItems(pageA).first()).toHaveAttribute('aria-current', 'true');
  await expect(agendaItems(pageB).first()).toHaveAttribute('aria-current', 'true');
  await expect(agendaItems(pageA).nth(1)).not.toHaveAttribute('aria-current', 'true');

  // The server stored the same first topic the browsers rank first.
  let board = await getBoard(p.ctxA.request, p.boardId);
  expect(board.board.phase_config.topic, `stored topic ${board.board.phase_config.topic}, first agenda item p is ${cardP.id}`).toBe(cardP.id);
  await expect(topicPanel(pageA)).toHaveAttribute('aria-label', cardP.text);

  // Back to Vote clears it; Discuss again stores the same first item.
  await move(p.ctxA.request, p.boardId, 'discuss', 'back');
  board = await getBoard(p.ctxA.request, p.boardId);
  expect(board.board.phase).toBe('vote');
  expect(board.board.phase_config.topic).toBeNull();
  await move(p.ctxA.request, p.boardId, 'vote', 'next');
  board = await getBoard(p.ctxA.request, p.boardId);
  expect(board.board.phase_config.topic).toBe(cardP.id);
  await expect(agendaItems(pageB)).toHaveText(expected, { timeout: 10_000 });

  await p.ctxA.close();
  await p.ctxB.close();
});

test('everyone follows the facilitator; a participant can look elsewhere and come back', async ({ browser }) => {
  const p = await pagePair(browser);
  const { pageA, pageB } = p;
  const t1 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'one');
  const t2 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'two');
  const t3 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'three');
  const t4 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'four');
  const kid = await addCard(p.ctxA.request, p.boardId, p.columnId, 'kid');
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await combine(p.ctxA.request, p.boardId, kid.id, t4.id);
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  await move(p.ctxA.request, p.boardId, 'vote', 'next');
  await expectDiscussShown(pageA);
  await expectDiscussShown(pageB);
  await expect(pageA.getByTestId('discuss-view').filter({ visible: true })).toBeVisible();

  const storedTopic = async () => (await getBoard(p.ctxA.request, p.boardId)).board.phase_config.topic;
  const labelOf = (page: Page) => topicPanel(page).getAttribute('aria-label');
  expect(await storedTopic()).toBe(t1.id);
  await expect(topicPanel(pageA)).toHaveAttribute('aria-label', t1.text);
  await expect(topicPanel(pageB)).toHaveAttribute('aria-label', t1.text);

  // A presses Next topic: B's panel moves to topic 2 without a reload.
  await pageA.getByRole('button', { name: 'Next topic' }).filter({ visible: true }).click();
  await expect(topicPanel(pageA)).toHaveAttribute('aria-label', t2.text);
  await expect(topicPanel(pageB)).toHaveAttribute('aria-label', t2.text, { timeout: 10_000 });
  await expect(agendaItems(pageB).nth(1)).toHaveAttribute('aria-current', 'true');
  expect(await storedTopic()).toBe(t2.id);
  await expect(viewingBar(pageB)).toHaveCount(0);

  // B looks at topic 4 (the group): the bar appears and B's view is its own.
  await agendaItems(pageB).nth(3).click();
  await expect(topicPanel(pageB)).toHaveAttribute('aria-label', 'Group of 2 cards');
  await expect(pageB.getByText('You are looking at another topic.').filter({ visible: true })).toBeVisible();
  expect(await storedTopic()).toBe(t2.id);

  // A moves on to topic 3: B's current marker moves, B's view stays on topic 4.
  await pageA.getByRole('button', { name: 'Next topic' }).filter({ visible: true }).click();
  await expect(topicPanel(pageA)).toHaveAttribute('aria-label', t3.text);
  await expect(agendaItems(pageB).nth(2)).toHaveAttribute('aria-current', 'true', { timeout: 10_000 });
  expect(await labelOf(pageB)).toBe('Group of 2 cards');
  await expect(pageB.getByText('You are looking at another topic.').filter({ visible: true })).toBeVisible();
  expect(await storedTopic()).toBe(t3.id);

  // Back to current topic: B shows topic 3 and the bar is gone.
  await pageB.getByRole('button', { name: 'Back to current topic' }).filter({ visible: true }).click();
  await expect(topicPanel(pageB)).toHaveAttribute('aria-label', t3.text);
  await expect(viewingBar(pageB)).toHaveCount(0);

  // The server's rules.
  const byParticipant = await apiSetTopic(p.ctxB.request, p.boardId, t1.id);
  expect(byParticipant.status()).toBe(403);
  expect(await byParticipant.json()).toEqual({ error: 'Facilitator access required' });
  const byChild = await apiSetTopic(p.ctxA.request, p.boardId, kid.id);
  expect(byChild.status()).toBe(404);
  expect(await byChild.json()).toEqual({ error: 'That topic is not on the agenda' });
  expect(await storedTopic()).toBe(t3.id);

  await move(p.ctxA.request, p.boardId, 'discuss', 'back');
  const inVote = await apiSetTopic(p.ctxA.request, p.boardId, t1.id);
  expect(inVote.status()).toBe(409);
  expect(await inVote.json()).toEqual({ error: 'Not available during Vote' });

  // Following resumes after the board leaves Discuss and comes back: a viewed topic does not outlive its phase.
  await move(p.ctxA.request, p.boardId, 'vote', 'next');
  await expectDiscussShown(pageB);
  await expect(topicPanel(pageB)).toHaveAttribute('aria-label', t1.text);
  await agendaItems(pageB).nth(3).click();
  await expect(topicPanel(pageB)).toHaveAttribute('aria-label', 'Group of 2 cards');
  await expect(pageB.getByText('You are looking at another topic.').filter({ visible: true })).toBeVisible();
  await move(p.ctxA.request, p.boardId, 'discuss', 'back');
  await expectPhase(pageB, 'vote');
  await move(p.ctxA.request, p.boardId, 'vote', 'next');
  await expectDiscussShown(pageB);
  await expect(topicPanel(pageB)).toHaveAttribute('aria-label', t1.text);
  await expect(viewingBar(pageB)).toHaveCount(0);
  await expect(pageB.getByText('You are looking at another topic.').filter({ visible: true })).toHaveCount(0);

  await p.ctxA.close();
  await p.ctxB.close();
});

test('comments: replies, edits, deletes and the rules that guard them', async ({ browser }) => {
  const p = await pagePair(browser);
  const { pageA, pageB } = p;
  const x = await addCard(p.ctxA.request, p.boardId, p.columnId, 'topic');
  const kid = await addCard(p.ctxA.request, p.boardId, p.columnId, 'kid');
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await combine(p.ctxA.request, p.boardId, kid.id, x.id);
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  await move(p.ctxA.request, p.boardId, 'vote', 'next');
  await expectDiscussShown(pageA);
  await expectDiscussShown(pageB);
  await expect(topicPanel(pageB).getByText('No comments yet. Start the discussion.')).toBeVisible();
  // On a guided board in Discuss the Discussion heading IS shown (so the open board's absence check is not vacuous).
  await expect(pageB.getByRole('heading').filter({ visible: true }).filter({ hasText: /^Discussion/ }).first()).toBeVisible();

  let patches = 0;
  pageB.on('request', (r) => {
    if (r.method() === 'PATCH' && new URL(r.url()).pathname.endsWith('/comments')) patches++;
  });

  // B comments through the UI.
  const bodyB = `first-${rand()}`;
  const boxB = topicPanel(pageB).getByPlaceholder('Add a comment');
  await boxB.fill(bodyB);
  await boxB.press('Enter');
  await expect(topicPanel(pageB).getByText(bodyB)).toBeVisible();
  await expect(topicPanel(pageA).getByText(bodyB)).toBeVisible({ timeout: 10_000 });
  await expect(topicPanel(pageB).getByText('You', { exact: true })).toBeVisible();

  // A replies through the UI.
  const replyBody = `reply-${rand()}`;
  const topOnA = topicPanel(pageA).locator('article').filter({ hasText: bodyB }).first();
  await topOnA.getByRole('button', { name: 'Reply', exact: true }).click();
  const replyBox = topicPanel(pageA).getByPlaceholder('Write a reply');
  await replyBox.fill(replyBody);
  await replyBox.press('Enter');
  await expect(topicPanel(pageA).getByText(replyBody)).toBeVisible();
  await expect(topicPanel(pageB).getByText(replyBody)).toBeVisible({ timeout: 10_000 });

  // B edits with Enter: exactly one PATCH.
  const editedBody = `edited-${rand()}`;
  await topicPanel(pageB).locator('article').filter({ hasText: bodyB }).first().getByRole('button', { name: 'Edit', exact: true }).click();
  const editBox = topicPanel(pageB).getByRole('textbox', { name: 'Edit comment' });
  await editBox.fill(editedBody);
  await editBox.press('Enter');
  await expect(topicPanel(pageB).getByText(editedBody)).toBeVisible();
  await expect(topicPanel(pageA).getByText(editedBody)).toBeVisible({ timeout: 10_000 });
  await expect(topicPanel(pageA).getByText('(edited)')).toBeVisible();
  await pageB.waitForTimeout(1500); // a second save (blur or a repeated Enter) would have fired by now
  expect(patches, 'PATCH requests from B').toBe(1);

  const rows = await commentRowsDirect(p.boardId);
  expect(rows).toHaveLength(2);
  const [top, reply] = rows;
  expect(top).toMatchObject({ card_id: x.id, parent_id: null, author_participant_id: p.bobId, is_anonymous: false, body: editedBody, deleted_at: null });
  expect(reply).toMatchObject({ card_id: x.id, parent_id: top.id, author_participant_id: p.aliceId, body: replyBody });

  // API refusals.
  const empty = await apiComment(p.ctxB.request, p.boardId, { cardId: x.id, body: '' });
  expect(empty.status()).toBe(400);
  expect(await empty.json()).toEqual({ error: 'Write a comment first' });
  const long = await apiComment(p.ctxB.request, p.boardId, { cardId: x.id, body: 'x'.repeat(1001) });
  expect(long.status()).toBe(400);
  expect(await long.json()).toEqual({ error: 'Comments can be at most 1000 characters' });
  const nested = await apiComment(p.ctxB.request, p.boardId, { cardId: x.id, body: 'nested', parentId: reply.id });
  expect(nested.status()).toBe(409);
  expect(await nested.json()).toEqual({ error: 'You can only reply to a comment that starts a thread' });
  const onChild = await apiComment(p.ctxB.request, p.boardId, { cardId: kid.id, body: 'inside' });
  expect(onChild.status()).toBe(409);
  expect(await onChild.json()).toEqual({ error: 'Comments go on a topic, not on a card inside it' });
  const hijack = await apiEditComment(p.ctxA.request, p.boardId, top.id, 'hijacked');
  expect(hijack.status()).toBe(403);
  expect(await hijack.json()).toEqual({ error: 'Only the author can edit this comment' });
  expect(await commentRowsDirect(p.boardId)).toHaveLength(2);

  // A (facilitator) deletes B's comment, which has a reply: a tombstone.
  const del = await apiDeleteComment(p.ctxA.request, p.boardId, top.id);
  expect(del.status(), await del.text()).toBe(200);
  const delBody = await del.json();
  expect(delBody.ids).toEqual([]);
  expect(delBody.tombstone).toMatchObject({ id: top.id, body: '' });
  expect(delBody.tombstone.deleted_at).toBeTruthy();
  await expect(topicPanel(pageA).getByText('This comment was deleted.')).toBeVisible();
  await expect(topicPanel(pageB).getByText('This comment was deleted.')).toBeVisible({ timeout: 10_000 });
  await expect(topicPanel(pageA).locator('article article').filter({ hasText: replyBody })).toBeVisible();
  await expect(topicPanel(pageB).locator('article article').filter({ hasText: replyBody })).toBeVisible();
  const afterTomb = await commentRowsDirect(p.boardId);
  expect(afterTomb.find((r) => r.id === top.id)).toMatchObject({ body: '' });
  expect(afterTomb.find((r) => r.id === top.id)?.deleted_at).toBeTruthy();
  const again = await apiDeleteComment(p.ctxA.request, p.boardId, top.id);
  expect(again.status()).toBe(409);
  expect(await again.json()).toEqual({ error: 'This comment was deleted' });
  const stranger = await apiDeleteComment(p.ctxA.request, p.boardId, '00000000-0000-4000-8000-000000000000');
  expect(stranger.status()).toBe(404);
  expect(await stranger.json()).toEqual({ error: 'Comment not found' });

  // A deletes the reply through the UI: A is its author, and B cannot delete A's reply (the API refusal below).
  const replyOnA = topicPanel(pageA).locator('article article').filter({ hasText: replyBody });
  await replyOnA.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(replyOnA.getByText('Delete this comment?')).toBeVisible();
  const notMine = await apiDeleteComment(p.ctxB.request, p.boardId, reply.id);
  expect(notMine.status()).toBe(403);
  expect(await notMine.json()).toEqual({ error: 'Only the author or a facilitator can delete this comment' });
  await replyOnA.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(async () => (await commentRowsDirect(p.boardId)).length, { timeout: 10_000 }).toBe(0);
  await expect(topicPanel(pageA).getByText('No comments yet. Start the discussion.')).toBeVisible();
  await expect(topicPanel(pageB).getByText('No comments yet. Start the discussion.')).toBeVisible({ timeout: 10_000 });

  // A participant deletes their own reply through the UI, and the other page sees it go without a reload.
  const topBody = `top-${rand()}`;
  const topCreated = await apiComment(p.ctxA.request, p.boardId, { cardId: x.id, body: topBody });
  expect(topCreated.status(), await topCreated.text()).toBe(200);
  const topId: string = (await topCreated.json()).comment.id;
  await expect(topicPanel(pageB).getByText(topBody)).toBeVisible({ timeout: 10_000 });
  const ownReply = `own-reply-${rand()}`;
  await topicPanel(pageB).locator('article').filter({ hasText: topBody }).first().getByRole('button', { name: 'Reply', exact: true }).click();
  const ownBox = topicPanel(pageB).getByPlaceholder('Write a reply');
  await ownBox.fill(ownReply);
  await ownBox.press('Enter');
  await expect(topicPanel(pageB).getByText(ownReply)).toBeVisible();
  await expect(topicPanel(pageA).getByText(ownReply)).toBeVisible({ timeout: 10_000 });
  expect((await commentRowsDirect(p.boardId)).some((r) => r.body === ownReply)).toBe(true);
  const ownOnB = topicPanel(pageB).locator('article article').filter({ hasText: ownReply });
  await ownOnB.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(ownOnB.getByText('Delete this comment?')).toBeVisible();
  await ownOnB.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(topicPanel(pageA).getByText(ownReply)).toHaveCount(0, { timeout: 10_000 });
  await expect(topicPanel(pageB).getByText(ownReply)).toHaveCount(0);
  expect((await commentRowsDirect(p.boardId)).some((r) => r.body === ownReply)).toBe(false);
  // Leave the board with no comments for the checks that follow.
  const cleanup = await apiDeleteComment(p.ctxA.request, p.boardId, topId);
  expect(cleanup.status(), await cleanup.text()).toBe(200);
  await expect.poll(async () => (await commentRowsDirect(p.boardId)).length, { timeout: 10_000 }).toBe(0);

  // In Vote nobody can comment.
  await move(p.ctxA.request, p.boardId, 'discuss', 'back');
  const inVote = await apiComment(p.ctxB.request, p.boardId, { cardId: x.id, body: 'late' });
  expect(inVote.status()).toBe(409);
  expect(await inVote.json()).toEqual({ error: 'Not available during Vote' });
  expect(await commentRowsDirect(p.boardId)).toEqual([]);

  await p.ctxA.close();
  await p.ctxB.close();
});

test('an anonymous comment never reveals its author, not even to the facilitator', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const aliceName = `Alice-${rand()}`;
  const bobName = `Bob-${rand()}`;
  const { boardId, columnId } = await createBoard(ctxA.request, { mode: 'guided' });
  let capA!: ReturnType<typeof capture>;
  // A's capture is attached before the page's first request.
  const pageA = await joinAs(ctxA, boardId, aliceName, { beforeGoto: (pg) => { capA = capture(pg); } });
  const pageB = await joinAs(ctxB, boardId, bobName);
  const bobId: string = (await getBoard(ctxB.request, boardId)).youAre.participantId;
  await waitForRealtime(capA, boardId);
  const x = await addCard(ctxA.request, boardId, columnId, 'topic');
  await toDiscuss(ctxA.request, boardId);
  await expectDiscussShown(pageA);
  await expectDiscussShown(pageB);
  expect(x.id).toBeTruthy();

  // B posts anonymously through the UI.
  const anon = `ANON-${rand()}`;
  await topicPanel(pageB).getByLabel('Post anonymously').check();
  const boxB = topicPanel(pageB).getByPlaceholder('Add a comment');
  await boxB.fill(anon);
  await boxB.press('Enter');
  await expect(topicPanel(pageB).getByText('You (anonymous)')).toBeVisible();
  await expect(topicPanel(pageA).getByText(anon)).toBeVisible({ timeout: 10_000 });
  await expect(topicPanel(pageA).getByText('Anonymous', { exact: true })).toBeVisible();

  // The server did record who wrote it (so the absence below is a real withholding).
  const rows = await commentRowsDirect(boardId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ is_anonymous: true, author_participant_id: bobId, body: anon });

  // Control 1: the text arrived in A's websocket frames. Then A reloads and it arrives in the GET body too.
  await expect.poll(() => capA.frames.some((f) => f.includes(anon)), { timeout: 10_000 }).toBe(true);
  const framesBeforeReload = capA.frames.length;
  await pageA.reload();
  await waitForRealtime(capA, boardId, framesBeforeReload);
  await expectDiscussShown(pageA);
  await expect(topicPanel(pageA).getByText(anon)).toBeVisible();
  await pageA.waitForTimeout(1500); // late frames get time to arrive before the absence check
  await capA.settle();
  expect(capA.bodies.some((b) => b.includes(anon)), 'the anonymous text is in a GET body').toBe(true);
  expect(capA.all()).toContain(boardId); // control 2: real traffic for this board was captured
  // Control 3: the matcher fires on B's name in the participants list.
  expect(hasJsonField(capA.all(), 'display_name', bobName), 'matcher fires on real data').toBe(true);
  await expect(topicPanel(pageA).getByText('Anonymous', { exact: true })).toBeVisible();

  // Absence: neither B's id nor B's name is attached to a comment A received.
  expect(hasJsonField(capA.all(), 'author_participant_id', bobId), "B's id as a comment author").toBe(false);
  expect(hasJsonField(capA.all(), 'author_name', bobName), "B's name as a comment author").toBe(false);
  // The facilitator's direct read agrees.
  const aView = await (await ctxA.request.get(`/api/boards/${boardId}`)).json();
  const aComment = aView.comments.find((c: { body: string }) => c.body === anon);
  expect(aComment).toMatchObject({ author_participant_id: null, author_name: null, is_anonymous: true });
  const bView = await (await ctxB.request.get(`/api/boards/${boardId}`)).json();
  expect(bView.comments.find((c: { body: string }) => c.body === anon)).toMatchObject({ is_mine: true });

  // The value does arrive when it is allowed: a named comment brings B's name to A within 10s.
  const named = `NAMED-${rand()}`;
  const boxB2 = topicPanel(pageB).getByPlaceholder('Add a comment');
  await expect(topicPanel(pageB).getByLabel('Post anonymously')).not.toBeChecked();
  await boxB2.fill(named);
  await boxB2.press('Enter');
  await expect(topicPanel(pageA).getByText(named)).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => hasJsonField(capA.all(), 'author_name', bobName), { timeout: 10_000 }).toBe(true);
  expect(hasJsonField(capA.all(), 'author_participant_id', bobId)).toBe(true);

  await ctxA.close();
  await ctxB.close();
});

test('a completed retro shows its comments read-only and an outsider gets nothing', async ({ browser, playwright, baseURL }) => {
  const p = await pagePair(browser);
  const { pageB } = p;
  const x = await addCard(p.ctxA.request, p.boardId, p.columnId, 'topic');
  await toDiscuss(p.ctxA.request, p.boardId);
  await expectDiscussShown(pageB);
  const commentText = `kept-${rand()}`;
  const replyText = `answer-${rand()}`;
  const c1 = await apiComment(p.ctxB.request, p.boardId, { cardId: x.id, body: commentText });
  expect(c1.status(), await c1.text()).toBe(200);
  const top = (await c1.json()).comment;
  const c2 = await apiComment(p.ctxA.request, p.boardId, { cardId: x.id, body: replyText, parentId: top.id });
  expect(c2.status(), await c2.text()).toBe(200);
  await expect(topicPanel(pageB).getByText(replyText)).toBeVisible({ timeout: 10_000 });

  // A completes the retro.
  const done = await p.ctxA.request.post(`/api/boards/${p.boardId}`, { data: { action: 'complete' } });
  expect(done.status(), await done.text()).toBe(200);
  const board = await getBoard(p.ctxA.request, p.boardId);
  expect(board.board.phase).toBe('done');
  expect(board.board.archived_at).toBeTruthy();
  expect(board.board.phase_config.topic).toBeNull();

  // B's page: both comments, the Topics heading, nothing to write or change.
  await expect(pageB.getByRole('heading', { name: 'Topics', exact: true }).filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  await expect(topicPanel(pageB).getByText(commentText)).toBeVisible();
  await expect(topicPanel(pageB).getByText(replyText)).toBeVisible();
  await expect(topicPanel(pageB).getByPlaceholder('Add a comment')).toHaveCount(0);
  for (const name of ['Reply', 'Edit', 'Delete']) {
    await expect(topicPanel(pageB).getByRole('button', { name, exact: true }), `${name} buttons`).toHaveCount(0);
  }
  await expect(pageB.getByRole('heading', { name: 'Agenda', exact: true }).filter({ visible: true })).toHaveCount(0);

  // Control: a participant's GET carries the comment text.
  const bRes = await p.ctxB.request.get(`/api/boards/${p.boardId}`);
  const bText = await bRes.text();
  expect(bText).toContain(commentText);
  expect(bText).toContain(p.boardId);
  expect(JSON.parse(bText).comments).toHaveLength(2);

  // A stranger (no cookie, not signed in) gets the minimal payload.
  const stranger = await playwright.request.newContext({ baseURL: baseURL! });
  try {
    const sRes = await stranger.get(`/api/boards/${p.boardId}`);
    expect(sRes.status()).toBe(200);
    const sText = await sRes.text();
    expect(sText).toContain(p.boardId); // the response is the board's, so the absence below means something
    const sJson = JSON.parse(sText);
    expect(Object.keys(sJson.board).sort()).toEqual(['archived_at', 'id', 'title', 'trust_version']);
    expect('comments' in sJson).toBe(false);
    expect(sText).not.toContain(commentText);
    expect(sText).not.toContain(replyText);
  } finally {
    await stranger.dispose();
  }

  await p.ctxA.close();
  await p.ctxB.close();
});

test('action items link to a topic, take an owner, and outlive their card and owner', async ({ browser }) => {
  const p = await pagePair(browser);
  const { pageA, pageB } = p;
  const ctxC = await browser.newContext();
  const cName = `Cleo-${rand()}`;
  const joinC = await apiJoin(ctxC.request, p.boardId, cName);
  expect(joinC.status()).toBe(200);
  const cId: string = (await joinC.json()).participant.id;

  const col2 = nanoid(10);
  const addedCol = await apiAddColumn(p.ctxA.request, p.boardId, { id: col2, title: 'Second', position: 1 });
  expect(addedCol.status(), await addedCol.text()).toBe(200);
  // Topic 1 is the first card created and sits in the second column; topic 2 has a grouped child.
  const t1 = await addCard(p.ctxA.request, p.boardId, col2, 'one');
  const t2 = await addCard(p.ctxA.request, p.boardId, p.columnId, 'two');
  const kid = await addCard(p.ctxA.request, p.boardId, p.columnId, 'kid');
  await move(p.ctxA.request, p.boardId, 'reflect', 'next');
  await combine(p.ctxA.request, p.boardId, kid.id, t2.id);
  await move(p.ctxA.request, p.boardId, 'group', 'next');
  await move(p.ctxA.request, p.boardId, 'vote', 'next');
  await expectDiscussShown(pageA);
  await expectDiscussShown(pageB);
  await expect(topicPanel(pageB)).toHaveAttribute('aria-label', t1.text);

  // B adds an action item with owner C inside topic 1 through the UI.
  const description = `Write the runbook ${rand()}`;
  const actionsB = topicActions(pageB);
  await actionsB.getByLabel('New action item').fill(description);
  await actionsB.getByLabel('Owner').first().selectOption({ label: cName });
  await actionsB.getByRole('button', { name: 'Add', exact: true }).click();
  await expect.poll(async () => (await actionRowsDirect(p.boardId)).length, { timeout: 10_000 }).toBe(1);
  const [row] = await actionRowsDirect(p.boardId);
  expect(row).toMatchObject({ card_id: t1.id, assignee_participant_id: cId, assignee: cName });

  // A sees it inside the topic and in the board-level Actions panel (with its topic line).
  await expect(topicActions(pageA).getByText(description)).toBeVisible({ timeout: 10_000 });
  await pageA.getByRole('button', { name: /^Actions/ }).filter({ visible: true }).first().click();
  const panel = pageA.getByRole('dialog', { name: 'Action Items' });
  await expect(panel.getByText(description)).toBeVisible();
  await expect(panel.getByText(`Topic: ${t1.text}`)).toBeVisible();
  await panel.getByRole('button', { name: 'Close action items' }).click();
  await expect(panel).toHaveAttribute('inert', ''); // a closed panel stays mounted, slid off screen and inert

  // Refusals.
  const otherCtx = await browser.newContext();
  const other = await createBoard(otherCtx.request, { displayName: `Other-${rand()}` });
  const foreign = await apiActionItem(p.ctxB.request, p.boardId, { description: 'x', cardId: t1.id, assigneeParticipantId: other.participantId });
  expect(foreign.status()).toBe(404);
  expect(await foreign.json()).toEqual({ error: 'That person is not on this board' });
  const onChild = await apiActionItem(p.ctxB.request, p.boardId, { description: 'x', cardId: kid.id });
  expect(onChild.status()).toBe(404);
  expect(await onChild.json()).toEqual({ error: 'That topic is not on the agenda' });
  expect(await actionRowsDirect(p.boardId)).toHaveLength(1);

  // A patch can change the owner too.
  const patched = await apiPatchActionItem(p.ctxB.request, p.boardId, row.id, { assignee_participant_id: p.bobId });
  expect(patched.status(), await patched.text()).toBe(200);
  expect((await actionRowsDirect(p.boardId))[0]).toMatchObject({ assignee_participant_id: p.bobId, assignee: p.bobName });
  const back = await apiPatchActionItem(p.ctxB.request, p.boardId, row.id, { assignee_participant_id: cId });
  expect(back.status(), await back.text()).toBe(200);
  expect((await actionRowsDirect(p.boardId))[0]).toMatchObject({ assignee_participant_id: cId, assignee: cName });

  // A removes C from the board: the item keeps C's name, the link is cleared.
  const removed = await p.ctxA.request.delete(`/api/boards/${p.boardId}/participants`, { data: { participantId: cId } });
  expect(removed.status(), await removed.text()).toBe(200);
  expect((await actionRowsDirect(p.boardId))[0]).toMatchObject({ id: row.id, card_id: t1.id, assignee: cName, assignee_participant_id: null });

  // A deletes the second column (it holds topic 1's card): the item stays, unlinked.
  const delCol = await p.ctxA.request.delete(`/api/boards/${p.boardId}/columns`, { data: { columnId: col2 } });
  expect(delCol.status(), await delCol.text()).toBe(200);
  expect(await actionRowsDirect(p.boardId)).toEqual([{ id: row.id, card_id: null, assignee_participant_id: null, assignee: cName }]);

  // In Vote nothing can be linked to a topic.
  await move(p.ctxA.request, p.boardId, 'discuss', 'back');
  const inVote = await apiActionItem(p.ctxB.request, p.boardId, { description: 'late', cardId: t2.id });
  expect(inVote.status()).toBe(409);
  expect(await inVote.json()).toEqual({ error: 'Not available during Vote' });
  expect(await actionRowsDirect(p.boardId)).toHaveLength(1);

  await otherCtx.close();
  await ctxC.close();
  await p.ctxA.close();
  await p.ctxB.close();
});

test("an open board's action items, board GET and views are unchanged", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const { boardId, columnId, participantId: aliceId } = await createBoard(ctxA.request, { displayName: `Alice-${rand()}`, settings: { card_visibility: 'visible' } });
  const joinB = await apiJoin(ctxB.request, boardId, `Bob-${rand()}`);
  expect(joinB.status()).toBe(200);
  const bobId: string = (await joinB.json()).participant.id;
  expect(aliceId).toBeTruthy();
  const card = await addCard(ctxA.request, boardId, columnId, 'open');

  const created = await apiActionItem(ctxA.request, boardId, { description: 'X', cardId: card.id, assigneeParticipantId: bobId });
  expect(created.status(), await created.text()).toBe(200);
  const item = (await created.json()).item;
  expect(await actionRowsDirect(boardId)).toEqual([{ id: item.id, card_id: null, assignee_participant_id: null, assignee: null }]);
  const patched = await apiPatchActionItem(ctxA.request, boardId, item.id, { status: 'done' });
  expect(patched.status(), await patched.text()).toBe(200);
  expect((await patched.json()).item).toMatchObject({ id: item.id, status: 'done' });
  const patchedOwner = await apiPatchActionItem(ctxA.request, boardId, item.id, { assignee_participant_id: bobId });
  expect(patchedOwner.status(), await patchedOwner.text()).toBe(200);
  expect((await actionRowsDirect(boardId))[0]).toMatchObject({ card_id: null, assignee_participant_id: null });

  const board = await getBoard(ctxA.request, boardId);
  expect('comments' in board).toBe(false);
  expect(board.board.phase_config).toEqual({ deadline: null });
  const comment = await apiComment(ctxA.request, boardId, { cardId: card.id, body: 'hello' });
  expect(comment.status()).toBe(409);
  expect(await comment.json()).toEqual({ error: 'This board is not in guided mode' });
  const topic = await apiSetTopic(ctxA.request, boardId, card.id);
  expect(topic.status()).toBe(409);
  expect(await topic.json()).toEqual({ error: 'This board is not in guided mode' });
  expect(await commentRowsDirect(boardId)).toEqual([]);

  // The page keeps its board views: no Discuss view, agenda or Discussion heading.
  const ctxC = await browser.newContext();
  const pageC = await joinAs(ctxC, boardId, `Cara-${rand()}`);
  await expect(shown(pageC, card.text)).toBeVisible({ timeout: 10_000 });
  await pageC.waitForTimeout(1000);
  await expect(pageC.getByTestId('discuss-view')).toHaveCount(0);
  await expect(pageC.getByTestId('agenda')).toHaveCount(0);
  await expect(pageC.getByTestId('topic-panel')).toHaveCount(0);
  await expect(pageC.getByRole('heading', { name: 'Discussion' })).toHaveCount(0);

  await ctxA.close();
  await ctxB.close();
  await ctxC.close();
});

test('the phone agenda sheet is fully on screen', async ({ browser }) => {
  const first = { width: 390, height: 844 };
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext({ viewport: first });
  const { boardId, columnId } = await createBoard(ctxA.request, { mode: 'guided', displayName: `Alice-${rand()}` });
  const joinB = await apiJoin(ctxB.request, boardId, `Bob-${rand()}`);
  expect(joinB.status()).toBe(200);
  // B joined over the API, so the phone page opens already signed in (the join form is not under test).
  const pageB = await ctxB.newPage();
  await pageB.goto(`/board/${boardId}`);
  const p = { ctxA, ctxB, boardId, columnId };
  for (const label of ['one', 'two', 'three']) await addCard(p.ctxA.request, p.boardId, p.columnId, label);
  await toDiscuss(p.ctxA.request, p.boardId);

  for (const viewport of [first, { width: 360, height: 780 }]) {
    await pageB.setViewportSize(viewport);
    const open = pageB.getByRole('button', { name: 'Agenda', exact: true }).filter({ visible: true });
    await expect(open).toBeVisible({ timeout: 15_000 });
    await open.click();
    const dialog = pageB.getByRole('dialog', { name: 'Agenda' });
    await expect(dialog).toBeVisible();

    const read = () =>
      dialog.evaluate((el) => {
        const box = (r: DOMRect) => ({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
        const overlay = el.previousElementSibling as HTMLElement | null;
        return {
          dialog: box(el.getBoundingClientRect()),
          overlay: overlay ? box(overlay.getBoundingClientRect()) : null,
          vw: window.innerWidth,
          vh: window.innerHeight,
        };
      });
    // The sheet slides up for 300ms: measure once two reads agree.
    let prev = '';
    let cur = await read();
    for (let i = 0; i < 20 && JSON.stringify(cur) !== prev; i++) {
      prev = JSON.stringify(cur);
      await pageB.waitForTimeout(100);
      cur = await read();
    }
    const label = `${viewport.width}x${viewport.height}`;
    console.log(`agenda sheet ${label}: ${JSON.stringify(cur)}`);
    test.info().annotations.push({ type: `agenda sheet ${label}`, description: JSON.stringify(cur) });
    expect([cur.vw, cur.vh], `${label} viewport`).toEqual([viewport.width, viewport.height]);
    expect(cur.dialog.top, `${label} sheet top`).toBeGreaterThanOrEqual(0);
    expect(cur.dialog.bottom, `${label} sheet bottom`).toBeLessThanOrEqual(viewport.height);
    expect(cur.dialog.left, `${label} sheet left`).toBeGreaterThanOrEqual(0);
    expect(cur.dialog.right, `${label} sheet right`).toBeLessThanOrEqual(viewport.width);
    expect(cur.dialog.height, `${label} sheet has a box`).toBeGreaterThan(0);
    expect(cur.overlay, `${label} overlay exists`).not.toBeNull();
    expect([cur.overlay!.top, cur.overlay!.left, cur.overlay!.width, cur.overlay!.height], `${label} overlay covers the viewport`).toEqual([0, 0, viewport.width, viewport.height]);
    await expect(dialog.getByTestId('agenda-item')).toHaveCount(3);

    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  await p.ctxA.close();
  await p.ctxB.close();
});

test('the last action item can be scrolled clear of the Timer button', async ({ browser }) => {
  const viewport = { width: 1280, height: 700 };
  const p = await pagePair(browser, viewport);
  const { pageA } = p;
  const x = await addCard(p.ctxA.request, p.boardId, p.columnId, 'topic');
  await toDiscuss(p.ctxA.request, p.boardId);
  await expectDiscussShown(pageA);
  expect(pageA.viewportSize()).toEqual(viewport);

  const description = `Ship it ${rand()}`;
  const res = await apiActionItem(p.ctxA.request, p.boardId, { description, cardId: x.id });
  expect(res.status(), await res.text()).toBe(200);
  const actions = topicActions(pageA);
  await expect(actions.getByText(description)).toBeVisible({ timeout: 10_000 });

  // Scroll the page to its end.
  await pageA.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => pageA.evaluate(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1)).toBe(true);

  const lastRow = actions.locator('.group').last();
  const timer = pageA.getByRole('button', { name: /timer/i }).filter({ visible: true }).first();
  await expect(lastRow).toBeVisible();
  await expect(timer).toBeVisible();
  const rowBox = (await lastRow.boundingBox())!;
  const timerBox = (await timer.boundingBox())!;
  const scroll = await pageA.evaluate(() => ({ y: window.scrollY, height: document.documentElement.scrollHeight, vh: window.innerHeight }));
  const fmt = (b: { x: number; y: number; width: number; height: number }) => `x ${b.x}..${b.x + b.width}, y ${b.y}..${b.y + b.height}`;
  console.log(`layout guard: row ${fmt(rowBox)}; timer ${fmt(timerBox)}; page ${JSON.stringify(scroll)}`);
  test.info().annotations.push({ type: 'layout-boxes', description: `row ${fmt(rowBox)}; timer ${fmt(timerBox)}; page ${JSON.stringify(scroll)}` });

  const overlapX = rowBox.x < timerBox.x + timerBox.width && timerBox.x < rowBox.x + rowBox.width;
  const overlapY = rowBox.y < timerBox.y + timerBox.height && timerBox.y < rowBox.y + rowBox.height;
  expect(overlapX && overlapY, `row (${fmt(rowBox)}) must not intersect the Timer button (${fmt(timerBox)})`).toBe(false);

  await p.ctxA.close();
  await p.ctxB.close();
});
