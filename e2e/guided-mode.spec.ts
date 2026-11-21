import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import {
  apiJoin,
  apiMovePhase,
  capture,
  createBoard,
  getBoard,
  hasJsonField,
  hiddenCards,
  joinAs,
  patchSettings,
  setFlagDirect,
  shown,
  waitForRealtime,
} from './helpers';

/**
 * Guided mode: the server decides what each phase allows, and nothing a phase hides reaches a
 * browser (HTTP bodies, websocket frames or DOM). Every absence check has a control that shows
 * the capture holds real traffic and the matcher fires on real data, plus a later point where
 * the same text or vote DOES arrive.
 */

const rand = () => randomBytes(5).toString('hex').toUpperCase();

test.beforeAll(async () => {
  // The dev environment is meant to have the flag on, so it is never switched off again.
  await setFlagDirect('guided_mode', true);
});

const rail = (page: Page) => page.getByTestId('phase-rail').filter({ visible: true });

async function expectPhase(page: Page, phase: string, timeout = 5_000) {
  await expect(rail(page)).toHaveAttribute('data-phase', phase, { timeout });
}

/** Press "Next: <label>" in the rail. A phase with a Ready step asks "Move on?" when not everyone is ready. */
async function advance(page: Page, label: string, opts: { confirm: boolean }) {
  await rail(page).getByRole('button', { name: `Next: ${label}` }).click();
  if (opts.confirm) {
    await expect(page.getByText('Move on?')).toBeVisible();
    await page.getByRole('button', { name: 'Move on', exact: true }).click();
    await expect(page.getByText('Move on?')).toBeHidden();
  }
}

test('a guided retro runs Reflect to Done with the server enforcing each phase', async ({ browser }) => {
  const secret = `SECRET-${rand()}`;
  const bobName = `Bob-${rand()}`;

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();

  // A creates a guided, anonymous board and joins as facilitator.
  const { boardId, columnId } = await createBoard(ctxA.request, {
    mode: 'guided',
    settings: { anonymous_cards: true },
  });
  let capA!: ReturnType<typeof capture>;
  let capB!: ReturnType<typeof capture>;
  const pageA = await joinAs(ctxA, boardId, `Alice-${rand()}`, { beforeGoto: (p) => { capA = capture(p); } });
  expect((await patchSettings(ctxA.request, boardId, { max_votes_per_card: 1 })).status()).toBe(200);
  const first = await getBoard(ctxA.request, boardId);
  expect(first.board).toMatchObject({ mode: 'guided', phase: 'reflect' });
  const pageB = await joinAs(ctxB, boardId, bobName, { beforeGoto: (p) => { capB = capture(p); } });
  const bobId: string = (await getBoard(ctxB.request, boardId)).youAre.participantId;
  expect(bobId).toBeTruthy();
  await waitForRealtime(capA, boardId);
  await waitForRealtime(capB, boardId);
  await expectPhase(pageA, 'reflect');
  await expectPhase(pageB, 'reflect');

  // ---- Reflect: B writes a card; A sees only a hidden placeholder -------------------------
  await pageB.getByRole('button', { name: 'Add a card' }).first().click();
  await pageB.getByPlaceholder('Type your thought…').fill(secret);
  await pageB.getByPlaceholder('Type your thought…').press('Enter');
  await expect(shown(pageB, secret)).toBeVisible(); // the author keeps their own text
  await pageB.getByPlaceholder('Type your thought…').press('Escape');
  await expect(hiddenCards(pageA)).toHaveCount(1);
  await expect(pageA.getByText(secret)).toHaveCount(0);

  // Control: A really received the realtime event, so the absence below means something.
  await expect.poll(() => capA.frames.some((f) => f.includes('card-created')), { timeout: 10_000 }).toBe(true);
  // A fresh GET is shaped the same way: A's own request context sees the card without text.
  const aRaw = await (await ctxA.request.get(`/api/boards/${boardId}`)).text();
  expect(aRaw).not.toContain(secret);
  expect((JSON.parse(aRaw).cards as unknown[]).length).toBe(1);

  await capA.settle();
  const reflectTraffic = capA.all();
  expect(reflectTraffic).toContain(boardId); // control: the capture holds real app traffic
  expect(hasJsonField(reflectTraffic, 'display_name', bobName), 'matcher control').toBe(true);
  expect(reflectTraffic, 'card text in A HTTP bodies or frames during Reflect').not.toContain(secret);
  expect(await pageA.content(), 'card text in A DOM during Reflect').not.toContain(secret);
  await expect(pageA.locator('body')).not.toContainText(secret);

  // B presses Ready; A's rail counts it.
  await pageB.getByRole('button', { name: 'Ready', exact: true }).filter({ visible: true }).click();
  await expect(pageB.getByRole('button', { name: 'Ready ✓', exact: true }).filter({ visible: true })).toBeVisible();
  await expect(rail(pageA)).toContainText('1 of 2 ready', { timeout: 10_000 });

  // Voting is not part of Reflect: refused by the server.
  const bobCards = (await getBoard(ctxB.request, boardId)).cards as { id: string }[];
  expect(bobCards).toHaveLength(1);
  const cardId = bobCards[0].id;
  const reflectVote = await ctxB.request.post(`/api/boards/${boardId}/votes`, { data: { cardId } });
  expect(reflectVote.status()).toBe(409);
  expect((await reflectVote.json()).error).toBe('Not available during Reflect');

  // ---- Group ----------------------------------------------------------------------------
  await advance(pageA, 'Group', { confirm: true }); // 1 of 2 ready, so A confirms
  await expectPhase(pageA, 'group');
  await expectPhase(pageB, 'group'); // no reload
  await expect(shown(pageA, secret)).toBeVisible({ timeout: 5_000 });
  await expect(hiddenCards(pageA)).toHaveCount(0);

  // Control: after the phase change the capture does contain the text, so the earlier absence was real.
  await capA.settle();
  expect(capA.all()).toContain(secret);
  // The author stays withheld on an anonymous board. (control: Bob is public as a participant)
  expect(hasJsonField(capA.all(), 'display_name', bobName), 'author matcher control').toBe(true);
  expect(hasJsonField(capA.all(), 'author_name', bobName), 'author_name on a card').toBe(false);
  expect(hasJsonField(capA.all(), 'author_id', bobId), 'author_id on a card').toBe(false);

  const groupCard = await apiLateCard(ctxB.request, boardId, columnId);
  expect(groupCard).toEqual({ status: 409, error: 'Not available during Group' });

  // ---- Vote: B's vote stays hidden from A ----------------------------------------------
  await advance(pageA, 'Vote', { confirm: true });
  await expectPhase(pageA, 'vote');
  await expectPhase(pageB, 'vote');

  await pageB.getByRole('button', { name: 'Vote for this card', exact: true }).filter({ visible: true }).click();
  await expect(pageB.getByRole('button', { name: 'Remove vote', exact: true }).filter({ visible: true })).toBeVisible();
  await expect.poll(async () => (await getBoard(ctxB.request, boardId)).votes.length).toBe(1);

  // Let any (wrongly) published vote event reach A, then reload A for a fresh GET after the vote.
  await pageA.waitForTimeout(1500);
  const framesBeforeReload = capA.frames.length;
  await pageA.reload();
  await waitForRealtime(capA, boardId, framesBeforeReload);
  await expectPhase(pageA, 'vote');
  await expect(shown(pageA, secret)).toBeVisible();
  await capA.settle();
  const voteTraffic = capA.all();
  expect(voteTraffic).toContain(boardId); // control: real traffic captured
  expect(hasJsonField(voteTraffic, 'display_name', bobName), 'vote matcher control').toBe(true);
  expect(hasJsonField(voteTraffic, 'voter_id', bobId), "B's voter_id in a vote payload").toBe(false);
  expect(voteTraffic).not.toContain('vote-cast');
  const aBoardInVote = await getBoard(ctxA.request, boardId);
  expect(aBoardInVote.votes).toEqual([]);
  expect(aBoardInVote.cards.every((c: { votes?: unknown[]; vote_count?: number }) => !c.votes?.length && c.vote_count === undefined)).toBe(true);
  // A sees an unvoted card with no count.
  const aButton = pageA.getByRole('button', { name: 'Vote for this card', exact: true }).filter({ visible: true });
  await expect(aButton).toBeVisible();
  await expect(aButton).toHaveAttribute('aria-pressed', 'false');
  await expect(aButton).not.toContainText('1');

  // B reloads: the rail shows Vote and B's own vote still shows.
  await pageB.reload();
  await expectPhase(pageB, 'vote');
  await expect(pageB.getByRole('button', { name: 'Remove vote', exact: true }).filter({ visible: true })).toBeVisible();

  // ---- Back to Group and forward again: the vote survives and stays hidden --------------
  await rail(pageA).getByRole('button', { name: 'Back', exact: true }).click();
  await expectPhase(pageA, 'group');
  await expectPhase(pageB, 'group');
  expect((await getBoard(ctxB.request, boardId)).votes).toHaveLength(1);
  expect((await getBoard(ctxA.request, boardId)).votes).toEqual([]);

  await advance(pageA, 'Vote', { confirm: true });
  await expectPhase(pageA, 'vote');
  await expectPhase(pageB, 'vote');
  const bobVotes = (await getBoard(ctxB.request, boardId)).votes as { voter_id: string; card_id: string }[];
  expect(bobVotes).toHaveLength(1);
  expect(bobVotes[0]).toMatchObject({ voter_id: bobId, card_id: cardId });
  expect((await getBoard(ctxA.request, boardId)).votes).toEqual([]);
  await expect(pageB.getByRole('button', { name: 'Remove vote', exact: true }).filter({ visible: true })).toBeVisible();

  // ---- Discuss: totals appear ----------------------------------------------------------
  await advance(pageA, 'Discuss', { confirm: true });
  await expectPhase(pageA, 'discuss');
  await expectPhase(pageB, 'discuss');
  await expect(pageA.locator('[aria-label^="1 vote"]').filter({ visible: true }).first()).toBeVisible({ timeout: 5_000 });
  const aDiscuss = await getBoard(ctxA.request, boardId);
  expect(aDiscuss.votes).toHaveLength(1);
  // Control: the vote that was absent from A's traffic during Vote now arrives, so that absence was real.
  await expect
    .poll(async () => {
      await capA.settle();
      return hasJsonField(capA.all(), 'voter_id', bobId);
    }, { timeout: 10_000 })
    .toBe(true);
  const discussVote = await ctxB.request.post(`/api/boards/${boardId}/votes`, { data: { cardId } });
  expect(discussVote.status()).toBe(409);
  expect((await discussVote.json()).error).toBe('Not available during Discuss');

  // ---- Complete -> Done ------------------------------------------------------------------
  await rail(pageA).getByRole('button', { name: 'Complete Retro' }).click();
  await pageA.getByRole('button', { name: 'Complete', exact: true }).click();
  await expectPhase(pageA, 'done');
  await expectPhase(pageB, 'done', 10_000);
  await expect(pageA.getByText('Completed', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(pageB.getByText('Completed', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
  const done = await getBoard(ctxA.request, boardId);
  expect(done.board.phase).toBe('done');
  expect(done.board.archived_at).toBeTruthy();

  await ctxA.close();
  await ctxB.close();
});

/** POST a card as whoever owns `request` and return the status and error. */
async function apiLateCard(request: import('@playwright/test').APIRequestContext, boardId: string, columnId: string) {
  const res = await request.post(`/api/boards/${boardId}/cards`, {
    data: { id: rand().slice(0, 10), columnId, text: 'late card', position: 1 },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status(), error: json.error as string | undefined };
}

test('a second facilitator pressing Next at the same time advances one phase only', async ({ playwright, baseURL }) => {
  const a = await playwright.request.newContext({ baseURL });
  const b = await playwright.request.newContext({ baseURL });
  try {
    const { boardId } = await createBoard(a, { displayName: 'Alice', mode: 'guided' });
    const joinB = await apiJoin(b, boardId, 'Bob');
    expect(joinB.status()).toBe(200);
    const bId: string = (await joinB.json()).participant.id;
    // Before promotion Bob is only a participant.
    expect((await apiMovePhase(b, boardId, 'reflect', 'next')).status()).toBe(403);
    // Alice (creator, facilitator) promotes Bob to a second facilitator.
    const promote = await a.patch(`/api/boards/${boardId}/participants`, {
      data: { participantId: bId, updates: { is_admin: true } },
    });
    expect(promote.status(), await promote.text()).toBe(200);

    const [r1, r2] = await Promise.all([
      apiMovePhase(a, boardId, 'reflect', 'next'),
      apiMovePhase(b, boardId, 'reflect', 'next'),
    ]);
    const statuses = [r1.status(), r2.status()].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = r1.status() === 200 ? r1 : r2;
    const loser = r1.status() === 200 ? r2 : r1;
    expect((await winner.json()).phase).toBe('group');
    expect((await loser.json()).error).toBe('The phase already changed');

    const { board } = await getBoard(a, boardId);
    expect(board.phase).toBe('group');
    // The stale "from" is refused for either facilitator, and the phase stays put.
    expect((await apiMovePhase(b, boardId, 'reflect', 'next')).status()).toBe(409);
    expect((await getBoard(b, boardId)).board.phase).toBe('group');
  } finally {
    await a.dispose();
    await b.dispose();
  }
});

// What this proves: a participant whose realtime connection was really cut, who missed a phase change,
// lands on the current phase after the connection comes back, with no manual reload, and the server
// refuses their stale write meanwhile. What it does NOT prove: whether the catch-up came from Ably
// replaying the missed message on resume or from the app refetching the board on reconnect; the test
// does not depend on which. (We log whether B made a new board GET after reconnecting.)
// The cut: B's Ably websocket is closed and every new Ably websocket is closed on arrival; Ably's HTTP
// fallback hosts, B's token endpoint and B's board GET are aborted. setOffline is not used because
// Chromium does not close an already-open websocket with it.
test('a participant who was offline during a phase change catches up', async ({ browser }) => {
  // realtime.ably.net, plus the fallback hosts under ably-realtime.com
  const ablyHost = /^[a-z]+:\/\/[^/]*ably[^/]*\//;
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const { boardId, columnId } = await createBoard(ctxA.request, { mode: 'guided' });
  const pageA = await joinAs(ctxA, boardId, `Alice-${rand()}`);

  let cut = false;
  let refused = 0; // Ably connection attempts and fetches we refused while cut
  const openSockets: import('@playwright/test').WebSocketRoute[] = [];
  let boardGets = 0;
  let capB!: ReturnType<typeof capture>;
  const pageB = await joinAs(ctxB, boardId, `Bob-${rand()}`, {
    beforeGoto: (p) => {
      capB = capture(p);
      void p.routeWebSocket(ablyHost, (ws) => {
        if (cut) {
          refused++;
          void ws.close();
          return;
        }
        ws.connectToServer();
        openSockets.push(ws);
      });
      void p.route(ablyHost, (route) => {
        if (cut) {
          refused++;
          return route.abort();
        }
        return route.continue();
      });
      void p.route('**/api/ably-token**', (route) => (cut ? route.abort() : route.continue()));
      void p.route(new RegExp(`/api/boards/${boardId}(\\?.*)?$`), (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        if (cut) return route.abort();
        boardGets++;
        return route.continue();
      });
    },
  });
  await waitForRealtime(capB, boardId);
  await expectPhase(pageA, 'reflect');
  await expectPhase(pageB, 'reflect');
  expect(openSockets.length, 'B has an open Ably socket to cut').toBeGreaterThan(0);

  // Cut B off: refuse everything, then close the live socket(s).
  cut = true;
  await Promise.all(openSockets.splice(0).map((ws) => ws.close()));
  // Control: B really tries to reconnect and is refused, so the cut is in force.
  await expect.poll(() => refused, { timeout: 20_000 }).toBeGreaterThan(0);

  // A moves to Group (through the UI) while B cannot hear it.
  await advance(pageA, 'Group', { confirm: true }); // nobody is ready
  await expectPhase(pageA, 'group');
  expect((await getBoard(ctxA.request, boardId)).board.phase).toBe('group');

  // B misses it. The one fixed wait: it sits immediately before an absence check.
  await pageB.waitForTimeout(3000);
  await expectPhase(pageB, 'reflect', 1_000);

  // Server half: B's stale write is refused with a clear message (B's request context is not cut off).
  const stale = await ctxB.request.post(`/api/boards/${boardId}/cards`, {
    data: { id: rand().slice(0, 10), columnId, text: 'stale card', position: 0 },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error).toBe('Not available during Group');
  await expectPhase(pageB, 'reflect', 1_000); // still cut off

  // Restore. The browser's own "online" event makes Ably retry at once rather than after its retry timer.
  const getsBefore = boardGets;
  cut = false;
  await pageB.evaluate(() => window.dispatchEvent(new Event('online')));
  await expectPhase(pageB, 'group', 10_000); // no page.reload()
  test.info().annotations.push({
    type: 'catch-up',
    description: `new board GETs by B after reconnect: ${boardGets - getsBefore}`,
  });

  await ctxA.close();
  await ctxB.close();
});

test('a participant cannot move the phase, and an open board has no phase', async ({ browser, playwright, baseURL }) => {
  // Guided board: a participant is refused, a stranger with no cookie is not signed in.
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const guided = await createBoard(ctxA.request, { mode: 'guided' });
  expect((await apiJoin(ctxA.request, guided.boardId, 'Alice')).status()).toBe(200);
  expect((await apiJoin(ctxB.request, guided.boardId, 'Bob')).status()).toBe(200);
  const refused = await apiMovePhase(ctxB.request, guided.boardId, 'reflect', 'next');
  expect(refused.status()).toBe(403);
  const nobody = await playwright.request.newContext({ baseURL });
  try {
    expect((await apiMovePhase(nobody, guided.boardId, 'reflect', 'next')).status()).toBe(401);
  } finally {
    await nobody.dispose();
  }
  expect((await getBoard(ctxA.request, guided.boardId)).board.phase).toBe('reflect');

  // Open board: the facilitator's call is refused because there is no phase; the page shows none.
  const open = await createBoard(ctxA.request, { settings: { card_visibility: 'hidden', voting_enabled: false } });
  const pageA = await joinAs(ctxA, open.boardId, `Alice-${rand()}`);
  expect((await apiJoin(ctxB.request, open.boardId, 'Bob')).status()).toBe(200);
  expect((await apiMovePhase(ctxB.request, open.boardId, 'reflect', 'next')).status()).toBe(403);
  const onOpen = await apiMovePhase(ctxA.request, open.boardId, 'reflect', 'next');
  expect(onOpen.status()).toBe(409);
  expect((await onOpen.json()).error).toBe('This board is not in guided mode');
  expect((await getBoard(ctxA.request, open.boardId)).board.mode).toBe('open');

  await expect(pageA.getByRole('button', { name: 'Cards hidden', exact: true })).toBeVisible();
  // Control: the guided page does render the rail, so its absence on the open board means something.
  const guidedPage = await ctxA.newPage(); // Alice already joined this board over the API
  await guidedPage.goto(`/board/${guided.boardId}`);
  await expect(rail(guidedPage)).toBeVisible();
  await guidedPage.close();
  await expect(pageA.getByTestId('phase-rail')).toHaveCount(0);
  await expect(pageA.getByTestId('phase-stepper')).toHaveCount(0);

  // The open board's own switches still work.
  await pageA.getByRole('button', { name: 'Cards hidden', exact: true }).click();
  await expect.poll(async () => (await getBoard(ctxA.request, open.boardId)).board.settings.card_visibility).toBe('visible');
  await pageA.getByRole('button', { name: 'Voting off', exact: true }).click();
  await expect.poll(async () => (await getBoard(ctxA.request, open.boardId)).board.settings.voting_enabled).toBe(true);
  await expect(pageA.getByRole('button', { name: 'Voting on', exact: true })).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

// Reopening needs a signed-in owner (the route reads the Better Auth session) and sign-up is behind a CAPTCHA;
// clearing archived_at with SQL would skip the code under test. The reopen-to-Discuss logic is covered by unit tests.
test.fixme('reopening a completed guided board returns it to Discuss', async () => {});
