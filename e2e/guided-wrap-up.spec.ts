import { test, expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  addMemberDirect,
  apiActionItem,
  apiAddCard,
  apiCombine,
  apiComment,
  apiComplete,
  apiGroups,
  apiJoin,
  apiMovePhase,
  apiVote,
  capture,
  commentRowsDirect,
  createBoard,
  createUserDirect,
  getBoard,
  hasJsonField,
  linkParticipantUserDirect,
  outboxRowsDirect,
  preferenceDirect,
  setBoardOwnerDirect,
  setFlagDirect,
  setSummaryPreferenceDirect,
  summarySendsDirect,
} from './helpers';
import { signUnsubscribeToken } from '../lib/email-unsubscribe';
import { COMPLETED_CLOSED_MESSAGE } from '../lib/constants/board-access';

/**
 * Wrap-up across two real browsers and the real dev database: the completed-retro summary page, its
 * print form, the link to it on both board shells, and the summary email, which here is only ever
 * RECORDED in the email_outbox table (the transport variable is never set, and beforeAll refuses to
 * run if it is). Every account is a throwaway `e2e-...@example.com` row created and deleted by this
 * run. Every absence check is paired with a control proving the capture or the query holds that
 * kind of data. Nothing here prints an address, a token or a cookie on purpose.
 */

const rand = () => randomBytes(5).toString('hex').toUpperCase();

test.describe.configure({ timeout: 120_000 });
// The unsubscribe test's links carry a signed token, and a kept trace would record them, so no trace is kept for this file.
test.use({ trace: 'off' });

const contexts: BrowserContext[] = [];
async function newCtx(browser: Browser, opts: Parameters<Browser['newContext']>[0] = {}) {
  const ctx = await browser.newContext(opts);
  contexts.push(ctx);
  return ctx;
}

test.beforeAll(async () => {
  if (process.env.SUMMARY_EMAIL_TRANSPORT !== undefined) {
    throw new Error('Refusing to run: SUMMARY_EMAIL_TRANSPORT is set');
  }
  await setFlagDirect('guided_mode', true);
  await setFlagDirect('summary_email', true);
});

test.afterAll(async () => {
  await setFlagDirect('summary_email', false);
});

test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close().catch(() => undefined)));
});

// ---- local helpers ----------------------------------------------------------

async function ok(res: { status(): number; text(): Promise<string> }, what: string) {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200);
}

async function move(request: APIRequestContext, boardId: string, from: string, to: string) {
  const res = await apiMovePhase(request, boardId, from, to);
  await ok(res, `move ${from} -> ${to}`);
}

async function addCard(request: APIRequestContext, boardId: string, columnId: string, label: string) {
  const text = `${label}-${rand()}`;
  const { body, response } = apiAddCard(request, boardId, columnId, text);
  await ok(await response, 'add card');
  return { id: body.id as string, text };
}

interface Retro {
  ctxA: BrowserContext;
  ctxB: BrowserContext;
  ctxC: BrowserContext;
  boardId: string;
  aName: string;
  bName: string;
  aId: string;
  bId: string;
  cId: string;
  topicTitle: string;
  childText: string;
  secondText: string;
  commentText: string;
  actionText: string;
}

/**
 * A guided board in Discuss with A (facilitator), B and C joined; a two-card group titled TOPIC-x
 * (child CHILD-x) that holds B's two votes, a single card with one vote, an anonymous comment by B,
 * and an action item owned by B due 2026-11-30. Not completed.
 */
async function retro(browser: Browser): Promise<Retro> {
  const ctxA = await newCtx(browser);
  const ctxB = await newCtx(browser);
  const ctxC = await newCtx(browser);
  const aName = `Alice-${rand()}`;
  const bName = `Bob-${rand()}`;
  const cName = `Cleo-${rand()}`;
  const { boardId, columnId, participantId } = await createBoard(ctxA.request, { mode: 'guided', displayName: aName });
  const aId = participantId as string;
  expect(aId).toBeTruthy();
  const joinB = await apiJoin(ctxB.request, boardId, bName);
  await ok(joinB, 'join B');
  const bId: string = (await joinB.json()).participant.id;
  const joinC = await apiJoin(ctxC.request, boardId, cName);
  await ok(joinC, 'join C');
  const cId: string = (await joinC.json()).participant.id;

  const parent = await addCard(ctxA.request, boardId, columnId, 'parent');
  // A authors every card: a card's author name is a named field in the payload, and the summary test
  // needs B's name to appear only where it is meant to (as a participant and an owner), never as a comment author.
  const child = await addCard(ctxA.request, boardId, columnId, 'CHILD');
  const second = await addCard(ctxA.request, boardId, columnId, 'second');

  await move(ctxA.request, boardId, 'reflect', 'next');
  const combined = await apiCombine(ctxA.request, boardId, child.id, parent.id);
  await ok(combined, 'combine');
  const topicTitle = `TOPIC-${rand()}`;
  await ok(await apiGroups(ctxA.request, boardId, { action: 'set-title', cardId: parent.id, title: topicTitle }), 'set title');
  await move(ctxA.request, boardId, 'group', 'next');
  for (let i = 0; i < 2; i++) await ok(await apiVote(ctxB.request, boardId, parent.id, 'add'), 'vote');
  await ok(await apiVote(ctxA.request, boardId, second.id, 'add'), 'vote');
  await move(ctxA.request, boardId, 'vote', 'next');

  const commentText = `COMMENT-${rand()}`;
  await ok(await apiComment(ctxB.request, boardId, { cardId: parent.id, body: commentText, anonymous: true }), 'comment');
  const actionText = `ACTION-${rand()}`;
  await ok(
    await apiActionItem(ctxA.request, boardId, {
      description: actionText,
      cardId: parent.id,
      assigneeParticipantId: bId,
      dueDate: '2026-11-30',
    }),
    'action item'
  );
  return {
    ctxA, ctxB, ctxC, boardId, aName, bName, aId, bId, cId,
    topicTitle, childText: child.text, secondText: second.text, commentText, actionText,
  };
}

type User = { id: string; email: string; name: string };
interface Users { u1: User; u2: User; u3: User; u4: User }

/** U1, U2, U3 verified; U4 not. */
async function makeUsers(): Promise<Users> {
  return {
    u1: await createUserDirect({ verified: true }),
    u2: await createUserDirect({ verified: true }),
    u3: await createUserDirect({ verified: true }),
    u4: await createUserDirect({ verified: false }),
  };
}

/**
 * U1 owns the board. U2's participant (B) is linked AND U2 is a member: one email. With `full`, U3 is a
 * verified member who opted out and U4 (unverified) is linked to a third participant.
 */
async function linkUsers(r: Retro, u: Users, full: boolean) {
  await setBoardOwnerDirect(r.boardId, u.u1.id);
  await linkParticipantUserDirect(r.boardId, r.bId, u.u2.id);
  await addMemberDirect(r.boardId, u.u2.id, 'participant');
  if (full) {
    await addMemberDirect(r.boardId, u.u3.id, 'participant');
    await setSummaryPreferenceDirect(u.u3.id, false);
    await linkParticipantUserDirect(r.boardId, r.cId, u.u4.id);
  }
}

async function pollOutbox(boardId: string, count: number) {
  await expect.poll(async () => (await outboxRowsDirect(boardId)).length, { timeout: 15_000 }).toBe(count);
}

const rowHaystack = (row: { text_body: string; html_body: string; headers: Record<string, string>; subject: string }) =>
  [row.subject, row.text_body, row.html_body, JSON.stringify(row.headers)].join('\n');

/** Whether `email` appears in `haystack` (the matcher the address absence checks use, proven on a positive below). */
const containsAddress = (haystack: string, email: string) => haystack.toLowerCase().includes(email.toLowerCase());

/** Errors from a request or navigation that carries a token are replaced by a generic one. */
async function quiet<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    throw new Error(`${label} failed (details withheld: the address carries a token)`);
  }
}

const relative = (u: string) => {
  const x = new URL(u);
  return x.pathname + x.search;
};

const summaryRoot = (page: Page) => page.getByTestId('summary-root');
const visibleSummaryLink = (page: Page) => page.getByTestId('summary-link').filter({ visible: true });

async function openSummary(ctx: BrowserContext, boardId: string, viewport?: { width: number; height: number }) {
  const page = await ctx.newPage();
  if (viewport) await page.setViewportSize(viewport);
  await page.goto(`/board/${boardId}/summary`);
  return page;
}

// ---- tests ------------------------------------------------------------------

test('completing a guided retro records one summary email per eligible account, once', async ({ browser }) => {
  const r = await retro(browser);
  const users = await makeUsers();
  const { u1, u2, u3, u4 } = users;
  await linkUsers(r, users, true);

  await ok(await apiComplete(r.ctxA.request, r.boardId), 'complete');
  await pollOutbox(r.boardId, 2);
  const rows = await outboxRowsDirect(r.boardId);
  expect(rows.map((row) => row.to_address)).toEqual([u1.email, u2.email].sort());
  // Exactly one recipient per row, on the reserved domain.
  for (const row of rows) expect(row.to_address).toMatch(/^[^,;\s<>]+@example\.com$/);

  const sends = await summarySendsDirect(r.boardId);
  expect(sends.map((s) => [s.user_id, s.status]).sort()).toEqual(
    [[u1.id, 'recorded'], [u2.id, 'recorded']].sort()
  );
  expect(sends.some((s) => s.user_id === u3.id || s.user_id === u4.id)).toBe(false);

  for (const row of rows) {
    expect(row.subject).toBe(`Retro summary: e2e ${r.boardId}`);
    // Booleans only: a failed toContain would print the whole body, which holds an unsubscribe token.
    expect(row.text_body.includes(r.topicTitle), 'the email names the topic').toBe(true);
    expect(
      row.text_body.includes(`${r.actionText} (Owner: ${r.bName}; Due: November 30, 2026)`),
      'the email action item line with owner and due date'
    ).toBe(true);
    expect(row.text_body.includes(`/board/${r.boardId}/summary`), 'the email links the summary').toBe(true);
    expect(row.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  }

  // Absence: no comment text and no grouped child card text, in either part.
  for (const row of rows) {
    for (const part of [row.text_body, row.html_body]) {
      expect(part.includes(r.commentText), 'the email carries comment text').toBe(false);
      expect(part.includes(r.childText), 'the email carries grouped card text').toBe(false);
    }
  }
  // Controls: both markers are real data. The comment is in the database and both show on B's summary page.
  expect((await commentRowsDirect(r.boardId)).some((c) => c.body === r.commentText)).toBe(true);
  const pageB = await openSummary(r.ctxB, r.boardId);
  await expect(pageB.getByText(r.commentText).first()).toBeVisible({ timeout: 15_000 });
  await expect(pageB.getByText(r.childText).first()).toBeVisible();

  // Privacy: no other recipient's address in any row's subject, bodies or headers, and only the
  // recipient's own account id in the unsubscribe links.
  const everyone = [u1, u2, u3, u4];
  for (const row of rows) {
    const own = row.to_address === u1.email ? u1 : u2;
    const hay = rowHaystack(row);
    // Control: the matcher finds an address that IS there (the row's own, once joined to its haystack).
    expect(containsAddress(`${row.to_address}\n${hay}`, own.email)).toBe(true);
    for (const other of everyone.filter((u) => u.id !== own.id)) {
      expect(containsAddress(hay, other.email), 'another account address appears in a row').toBe(false);
      expect(hay.includes(other.id), 'another account id appears in a row').toBe(false);
    }
    // Control: the row's own account id is in its unsubscribe links, so the id check above can fire.
    expect(row.text_body.includes(`token=${own.id}.`)).toBe(true);
    expect((row.headers['List-Unsubscribe'] ?? '').includes(`token=${own.id}.`)).toBe(true);
  }

  // A second complete is refused, and nothing more is recorded.
  const again = await apiComplete(r.ctxA.request, r.boardId);
  expect(again.status()).toBe(409);
  expect(await again.json()).toEqual({ error: 'Board is completed' });
  await pageB.waitForTimeout(3000);
  expect(await outboxRowsDirect(r.boardId)).toHaveLength(2);
  expect(await summarySendsDirect(r.boardId)).toHaveLength(2);
});

test('with the summary_email flag off, completing records and sends nothing', async ({ browser }) => {
  const r = await retro(browser);
  const users = await makeUsers();
  await linkUsers(r, users, true);
  await setFlagDirect('summary_email', false);
  try {
    await ok(await apiComplete(r.ctxA.request, r.boardId), 'complete');
    // The flag is read after the response, so give the dispatch time to run before looking.
    const page = await r.ctxA.newPage();
    await page.waitForTimeout(5000);
    expect(await outboxRowsDirect(r.boardId)).toEqual([]);
    expect(await summarySendsDirect(r.boardId)).toEqual([]);
    // Control: the same setup is eligible. Test 1 recorded two rows for it with the flag on.
    // Here the board has a verified owner, so only the flag stood between it and a row.
    const board = await getBoard(r.ctxA.request, r.boardId);
    expect(board.board.archived_at).toBeTruthy();
  } finally {
    await setFlagDirect('summary_email', true);
  }
});

test('the unsubscribe link: a GET changes nothing, the one-click POST opts out, the next retro skips that person', async ({ browser, playwright, baseURL }) => {
  const r = await retro(browser);
  const users = await makeUsers();
  const { u1, u2 } = users;
  await linkUsers(r, users, true);
  await ok(await apiComplete(r.ctxA.request, r.boardId), 'complete');
  await pollOutbox(r.boardId, 2);
  const row1 = (await outboxRowsDirect(r.boardId)).find((row) => row.to_address === u1.email)!;
  expect(row1).toBeTruthy();

  const pageMatch = /Stop getting summary emails: (\S+)/.exec(row1.text_body);
  expect(pageMatch !== null, 'the email carries an unsubscribe page link').toBe(true);
  const pageRel = relative(pageMatch![1]);
  const postMatch = /^<(.+)>$/.exec(row1.headers['List-Unsubscribe'] ?? '');
  expect(postMatch !== null, 'the email carries a List-Unsubscribe address').toBe(true);
  const apiRel = relative(postMatch![1]);

  // Three page loads and a GET of the API address: nothing is written.
  const visitor = await newCtx(browser);
  const page = await visitor.newPage();
  for (let i = 0; i < 3; i++) {
    await quiet('open unsubscribe page', () => page.goto(pageRel));
    await expect(page.getByRole('button', { name: 'Unsubscribe', exact: true })).toBeVisible();
    expect(await preferenceDirect(u1.id)).toBeNull();
  }
  const stranger = await playwright.request.newContext({ baseURL: baseURL! });
  try {
    const got = await quiet('GET unsubscribe', () => stranger.get(apiRel, { maxRedirects: 0 }));
    expect(got.status()).toBe(303);
    expect((got.headers()['location'] ?? '').startsWith('/email/unsubscribe')).toBe(true);
    expect(await preferenceDirect(u1.id)).toBeNull();

    // The one-click POST opts out, and again is the same answer.
    const post = await quiet('POST unsubscribe', () => stranger.post(apiRel, { form: { 'List-Unsubscribe': 'One-Click' } }));
    expect(post.status()).toBe(200);
    expect(await post.json()).toEqual({ ok: true });
    expect(await preferenceDirect(u1.id)).toBe(false);
    const post2 = await quiet('POST unsubscribe again', () => stranger.post(apiRel, { form: { 'List-Unsubscribe': 'One-Click' } }));
    expect(post2.status()).toBe(200);
    expect(await post2.json()).toEqual({ ok: true });
    expect(await preferenceDirect(u1.id)).toBe(false);

    // A token with its last character changed is refused.
    const last = apiRel.slice(-1);
    const tampered = apiRel.slice(0, -1) + (last === 'A' ? 'B' : 'A');
    const bad = await quiet('POST tampered', () => stranger.post(tampered, { form: { 'List-Unsubscribe': 'One-Click' } }));
    expect(bad.status()).toBe(400);
    expect(await bad.json()).toEqual({ error: 'This link is not valid.' });

    // A well-signed token for an account that does not exist answers like a live one and writes nothing.
    const ghostId = 'e2e-no-such-user';
    const ghost = await quiet('POST unknown account', () =>
      stranger.post(`/api/email/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(ghostId))}`, {
        form: { 'List-Unsubscribe': 'One-Click' },
      })
    );
    expect(ghost.status()).toBe(200);
    expect(await ghost.json()).toEqual({ ok: true });
    expect(await preferenceDirect(ghostId)).toBeNull();
  } finally {
    await stranger.dispose();
  }

  // A second guided retro with U1 and U2 linked: only U2 gets a row.
  const r2 = await retro(browser);
  await linkUsers(r2, users, false);
  await ok(await apiComplete(r2.ctxA.request, r2.boardId), 'complete second');
  await pollOutbox(r2.boardId, 1);
  expect((await outboxRowsDirect(r2.boardId)).map((row) => row.to_address)).toEqual([u2.email]);
  expect((await summarySendsDirect(r2.boardId)).map((s) => [s.user_id, s.status])).toEqual([[u2.id, 'recorded']]);
});

test('the summary shows topics, comments and action items to people who took part, and nothing to an outsider', async ({ browser }) => {
  const r = await retro(browser);

  // Before completion: nothing to show yet, and a way back.
  const early = await openSummary(r.ctxB, r.boardId);
  await expect(early.getByText('This summary will be ready when the retro is completed.')).toBeVisible({ timeout: 15_000 });
  await expect(early.getByRole('link', { name: 'Back to the board' })).toBeVisible();
  await early.close();

  await ok(await apiComplete(r.ctxA.request, r.boardId), 'complete');

  // A's summary, with everything the page received captured.
  const pageA = await r.ctxA.newPage();
  const capA = capture(pageA);
  await pageA.goto(`/board/${r.boardId}/summary`);
  await expect(summaryRoot(pageA)).toBeVisible({ timeout: 15_000 });
  await capA.settle();
  const pageB = await r.ctxB.newPage();
  const capB = capture(pageB);
  await pageB.goto(`/board/${r.boardId}/summary`);
  await expect(summaryRoot(pageB)).toBeVisible({ timeout: 15_000 });
  await capB.settle();

  // Topic headings in the order the Done view's agenda lists them.
  const headingsOf = async (page: Page) =>
    (await page.getByTestId('summary-topic').locator('h3').allInnerTexts()).map((t) => t.replace(/^\d+\.\s*/, '').trim());
  const headingsA = await headingsOf(pageA);
  expect(headingsA).toEqual([r.topicTitle, r.secondText]);
  expect(await headingsOf(pageB)).toEqual(headingsA);
  const board = await page_board_done(r);
  expect(board.length).toBe(headingsA.length);
  headingsA.forEach((h, i) => expect(board[i]).toContain(h));

  // The six numbers equal counts computed from the board.
  const data = await getBoard(r.ctxA.request, r.boardId);
  const expected = [
    data.participants.length,
    data.cards.length,
    (data.votes as { count?: number }[]).reduce((n, v) => n + Number(v.count ?? 1), 0),
    headingsA.length,
    (data.comments as { deleted_at: string | null }[]).filter((c) => c.deleted_at === null).length,
    data.actionItems.length,
  ];
  expect(expected).toEqual([3, 3, 3, 2, 1, 1]);
  for (const page of [pageA, pageB]) {
    const stats = (await page.getByTestId('summary-stat').allInnerTexts()).map((t) => Number(t.split('\n')[0].trim()));
    expect(stats).toEqual(expected);
  }

  // The anonymous comment reads Anonymous for everyone and never "You".
  for (const page of [pageA, pageB]) {
    const text = await summaryRoot(page).innerText();
    expect(text).toContain(r.commentText);
    expect(text).toContain('Anonymous');
    expect(/\bYou\b/.test(text), 'the summary says "You"').toBe(false);
    expect(text).toContain(r.actionText);
    expect(text).toContain(r.childText);
  }

  // Absence: the author of the anonymous comment never reaches A. Controls: the same capture holds
  // participant display names, so a leak of this kind would match.
  expect(hasJsonField(capA.all(), 'author_participant_id', r.bId)).toBe(false);
  expect(hasJsonField(capA.all(), 'author_name', r.bName)).toBe(false);
  expect(hasJsonField(capA.all(), 'display_name', r.bName)).toBe(true);
  expect(hasJsonField(capA.all(), 'author_name', r.aName)).toBe(true);

  // An outsider (no cookie, not signed in) sees the closed view and none of the content.
  const outsider = await newCtx(browser);
  const pageS = await outsider.newPage();
  const capS = capture(pageS);
  await pageS.goto(`/board/${r.boardId}/summary`);
  await expect(pageS.getByText(COMPLETED_CLOSED_MESSAGE)).toBeVisible({ timeout: 15_000 });
  await expect(pageS.getByText('Sign in to see the summary')).toBeVisible();
  await capS.settle();
  const outsiderText = await pageS.locator('body').innerText();
  for (const marker of [r.topicTitle, r.childText]) {
    expect(outsiderText).not.toContain(marker);
    expect(capS.all()).not.toContain(marker);
  }
  // Controls: B's page and B's captured traffic carry both markers.
  const bText = await pageB.locator('body').innerText();
  for (const marker of [r.topicTitle, r.childText]) {
    expect(bText).toContain(marker);
    expect(capB.all()).toContain(marker);
  }
});

/** The agenda items of A's completed board page, as text, in order. */
async function page_board_done(r: Retro): Promise<string[]> {
  const page = await r.ctxA.newPage();
  await page.goto(`/board/${r.boardId}`);
  const items = page.getByTestId('agenda-item').filter({ visible: true });
  await expect(items.first()).toBeVisible({ timeout: 15_000 });
  const texts = await items.allInnerTexts();
  await page.close();
  return texts;
}

test('the summary prints black on white without the app chrome', async ({ browser }) => {
  const r = await retro(browser);
  await ok(await apiComplete(r.ctxA.request, r.boardId), 'complete');

  const page = await r.ctxB.newPage();
  await page.addInitScript(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => {
      (window as unknown as { __prints: number }).__prints += 1;
    };
  });
  await page.goto(`/board/${r.boardId}/summary`);
  await expect(summaryRoot(page)).toBeVisible({ timeout: 15_000 });

  // Dark theme through the header's own toggle.
  const toggle = page.locator('header').getByRole('button', { name: /theme/i }).filter({ visible: true }).first();
  for (let i = 0; i < 4; i++) {
    if ((await page.locator('html').getAttribute('data-theme')) === 'dark') break;
    await toggle.click();
    await page.waitForTimeout(200);
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForTimeout(1500);

  await page.getByRole('button', { name: 'Print or save as PDF' }).click();
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('header').filter({ visible: true })).toHaveCount(0);
  await expect(page.getByTestId('summary-toolbar')).toBeHidden();
  const headings = page.getByTestId('summary-topic').locator('h3');
  const count = await headings.count();
  expect(count).toBe(2);
  for (let i = 0; i < count; i++) await expect(headings.nth(i)).toBeVisible();
  const footer = page.locator('[data-print-only]');
  await expect(footer).toBeVisible();
  await expect(footer).toContainText('From RetroBoard: ');
  const colors = await summaryRoot(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, background: cs.backgroundColor };
  });
  expect(colors).toEqual({ color: 'rgb(0, 0, 0)', background: 'rgb(255, 255, 255)' });

  const dir = path.resolve(process.cwd(), '.superpowers/sdd/2026-11-21-guided-wrap-up/observe-11');
  mkdirSync(dir, { recursive: true });
  const pdf = path.join(dir, 'summary.pdf');
  await page.pdf({ path: pdf, format: 'A4' });
  expect(statSync(pdf).size).toBeGreaterThan(10 * 1024);
});

test('the summary fits a phone and a completed guided board links to it on both shells', async ({ browser }) => {
  const r = await retro(browser);
  const page = await r.ctxB.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/board/${r.boardId}`);
  await expect(page.getByTestId('topic-panel').filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  // Before completion there is no link. (The Discuss view is on screen, so the page has rendered.)
  await expect(visibleSummaryLink(page)).toHaveCount(0);

  await ok(await apiComplete(r.ctxA.request, r.boardId), 'complete');
  // Control: after completion the same page shows it.
  const desktopLink = visibleSummaryLink(page).first();
  await expect(desktopLink).toBeVisible({ timeout: 15_000 });
  await expect(desktopLink).toHaveText('View summary');
  await desktopLink.click();
  await expect(page).toHaveURL(new RegExp(`/board/${r.boardId}/summary$`));
  await expect(summaryRoot(page)).toBeVisible({ timeout: 15_000 });

  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 780 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`/board/${r.boardId}`);
    const link = visibleSummaryLink(page).first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    const box = (await link.boundingBox())!;
    expect(box.height, `${viewport.width}px link height`).toBeGreaterThanOrEqual(44);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/board/${r.boardId}/summary$`));
    await expect(summaryRoot(page)).toBeVisible({ timeout: 15_000 });
    const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    expect(widths.inner).toBe(viewport.width);
    expect(widths.scroll, `${viewport.width}px page width`).toBeLessThanOrEqual(widths.inner);
  }
});

test('an open board: completing sends nothing, the summary is not found, and no link appears', async ({ browser }) => {
  const ctxA = await newCtx(browser);
  const ctxB = await newCtx(browser);
  const aName = `Alice-${rand()}`;
  const { boardId, columnId } = await createBoard(ctxA.request, { displayName: aName });
  await ok(await apiJoin(ctxB.request, boardId, `Bob-${rand()}`), 'join B');
  await addCard(ctxA.request, boardId, columnId, 'open');
  const u1 = await createUserDirect({ verified: true });
  await setBoardOwnerDirect(boardId, u1.id);

  await ok(await apiComplete(ctxA.request, boardId), 'complete');
  const page = await ctxA.newPage();
  await page.waitForTimeout(5000);
  // Control: with the flag on, a guided completion with the same kind of owner recorded rows (test 1).
  expect(await outboxRowsDirect(boardId)).toEqual([]);
  expect(await summarySendsDirect(boardId)).toEqual([]);

  // The summary page is a real 404 for an open board and for a board that does not exist.
  for (const id of [boardId, 'zzzzzzzzzz']) {
    const res = await page.goto(`/board/${id}/summary`);
    expect(res!.status()).toBe(404);
    await expect(page.getByText('Page not found')).toBeVisible();
  }

  // The completed open board shows no summary link, and its payload has no comments key.
  await page.goto(`/board/${boardId}`);
  await expect(page.locator('body')).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(visibleSummaryLink(page)).toHaveCount(0);
  expect('comments' in (await getBoard(ctxA.request, boardId))).toBe(false);
});
