import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import {
  createBoard,
  apiJoin,
  getBoard,
  makeLegacyV1,
  legacyUpdate,
  setArchivedDirect,
  cookieValue,
  withRawCookie,
  capture,
  joinAs,
} from './helpers';

/**
 * Rule A: action items go only to people who are part of the board.
 * Rule B: a completed board accepts no new participants and shows its content only to
 * people who were already part of it (participant row, or a signed-in owner/member/matched user).
 *
 * Signed-in paths (owner, member, matched user, system admin) are covered by the unit tests of
 * decideBoardAccess: sign-up is CAPTCHA-protected, so e2e has no account to sign in with.
 */

type PW = import('@playwright/test').PlaywrightWorkerArgs['playwright'];
const contexts: APIRequestContext[] = [];
test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.dispose()));
});
const rand = () => randomBytes(5).toString('hex').toUpperCase();

async function identity(playwright: PW, baseURL: string) {
  const ctx = await playwright.request.newContext({ baseURL });
  contexts.push(ctx);
  return ctx;
}

const CLOSED_KEYS = ['board', 'columns', 'cards', 'votes', 'actionItems', 'participants'];

/** Alice (facilitator) and Bob joined; one card and one action item with unique markers. */
async function boardWithContent(playwright: PW, baseURL: string, settings: Record<string, unknown> = {}) {
  const a = await identity(playwright, baseURL);
  const b = await identity(playwright, baseURL);
  const stranger = await identity(playwright, baseURL);
  const board = await createBoard(a, { settings: { card_visibility: 'visible', ...settings } });
  const aliceName = `Alice${rand()}`;
  const bobName = `Bob${rand()}`;
  const joinA = await apiJoin(a, board.boardId, aliceName);
  expect(joinA.status()).toBe(200);
  const aId: string = (await joinA.json()).participant.id;
  const joinB = await apiJoin(b, board.boardId, bobName);
  expect(joinB.status()).toBe(200);
  const bId: string = (await joinB.json()).participant.id;
  const cardText = `CARD${rand()}`;
  const card = await a.post(`/api/boards/${board.boardId}/cards`, {
    data: { id: `c${rand()}`, columnId: board.columnId, text: cardText, position: 0 },
  });
  expect(card.status(), await card.text()).toBe(200);
  const itemText = `ITEM${rand()}`;
  const item = await a.post(`/api/boards/${board.boardId}/action-items`, { data: { description: itemText } });
  expect(item.status(), await item.text()).toBe(200);
  return { a, b, stranger, aId, bId, aliceName, bobName, cardText, itemText, ...board };
}

function expectClosedPayload(json: Record<string, unknown>, boardId: string, raw: string, secrets: string[]) {
  expect(json.access).toBe('completed-closed');
  const board = json.board as Record<string, unknown>;
  expect(Object.keys(board).sort()).toEqual(['archived_at', 'id', 'title', 'trust_version']);
  expect(board.id).toBe(boardId);
  expect(board.archived_at).toBeTruthy();
  for (const k of CLOSED_KEYS.slice(1)) expect(json[k], k).toEqual([]);
  expect(json.youAre).toMatchObject({ participantId: null, joined: false, isFacilitator: false });
  expect(json.youCanFacilitate).toBe(false);
  expect(json.yourParticipantId).toBeNull();
  for (const s of secrets) expect(raw, `leaked ${s}`).not.toContain(s);
}

async function getRaw(ctx: APIRequestContext, boardId: string, query = '') {
  const res = await ctx.get(`/api/boards/${boardId}${query}`);
  expect(res.status()).toBe(200);
  const raw = await res.text();
  return { raw, json: JSON.parse(raw) as Record<string, unknown> };
}

test.describe('Rule A (v2): action items only for joined people', () => {
  test('unjoined caller gets none; participant and facilitator get them', async ({ playwright, baseURL }) => {
    const w = await boardWithContent(playwright, baseURL!);
    const { raw, json } = await getRaw(w.stranger, w.boardId);
    expect(json.actionItems).toEqual([]);
    expect(raw).not.toContain(w.itemText);
    expect(json.access).toBe('open');
    // The join screen still gets what it needs.
    expect((json.board as { title: string }).title).toContain(w.boardId);

    const bob = await getBoard(w.b, w.boardId);
    expect(bob.actionItems).toHaveLength(1);
    expect(bob.actionItems[0].description).toBe(w.itemText);
    const alice = await getBoard(w.a, w.boardId);
    expect(alice.actionItems).toHaveLength(1);
    expect(alice.access).toBe('open');
  });

  test('a creator cookie with no participant row is not joined: no action items', async ({ playwright, baseURL }) => {
    const creator = await identity(playwright, baseURL!);
    const fresh = await createBoard(creator); // creator cookie, never joined
    expect((await getBoard(creator, fresh.boardId)).actionItems).toEqual([]);
  });
});

test.describe('Rule B (v2): completed board', () => {
  test('participant keeps the full read-only board; a fresh visitor gets the minimal payload', async ({ playwright, baseURL }) => {
    const w = await boardWithContent(playwright, baseURL!);
    expect((await w.a.post(`/api/boards/${w.boardId}`, { data: { action: 'complete' } })).status()).toBe(200);

    const bob = await getBoard(w.b, w.boardId);
    expect(bob.access).toBe('open');
    expect(bob.cards.map((c: { text: string }) => c.text)).toContain(w.cardText);
    expect(bob.actionItems).toHaveLength(1);
    expect(bob.participants).toHaveLength(2);
    expect(bob.youAre.joined).toBe(true);
    // Still read-only.
    const write = await w.b.post(`/api/boards/${w.boardId}/cards`, {
      data: { id: `c${rand()}`, columnId: w.columnId, text: 'x', position: 1 },
    });
    expect(write.status()).toBe(409);

    const { raw, json } = await getRaw(w.stranger, w.boardId);
    expectClosedPayload(json, w.boardId, raw, [w.cardText, w.itemText, w.aliceName, w.bobName, w.aId, w.bId]);

    const join = await apiJoin(w.stranger, w.boardId, 'Newcomer');
    expect(join.status()).toBe(409);
    expect((await join.json()).error).toBe('Board is completed');
    // Still no participant after the refused join.
    expect((await getBoard(w.a, w.boardId)).participants).toHaveLength(2);
    // A body-supplied id does not help either.
    expect((await apiJoin(w.stranger, w.boardId, 'Newcomer', { participantId: w.bId })).status()).toBe(409);
  });

  test('an existing participant can re-establish their session after completion', async ({ playwright, baseURL }) => {
    const w = await boardWithContent(playwright, baseURL!);
    await w.a.post(`/api/boards/${w.boardId}`, { data: { action: 'complete' } });
    const again = await apiJoin(w.b, w.boardId, 'Bob Renamed');
    expect(again.status()).toBe(200);
    expect((await again.json()).reused).toBe(true);
  });

  test('forged or tampered cookie is a fresh visitor', async ({ playwright, baseURL }) => {
    const w = await boardWithContent(playwright, baseURL!);
    await w.a.post(`/api/boards/${w.boardId}`, { data: { action: 'complete' } });
    const real = (await cookieValue(w.b, w.boardId))!;
    const [pid, iat, sig] = real.split('.');
    const tampered = `${pid}.${iat}.${sig.slice(0, -2)}${sig.endsWith('AA') ? 'BB' : 'AA'}`;
    for (const value of [tampered, `${w.aId}.${iat}.${sig}`, 'garbage']) {
      const forged = await withRawCookie(playwright, baseURL!, `rb_ps_${w.boardId}`, value);
      contexts.push(forged);
      const { raw, json } = await getRaw(forged, w.boardId);
      expectClosedPayload(json, w.boardId, raw, [w.cardText, w.itemText, w.bobName]);
      expect((await apiJoin(forged, w.boardId, 'Mallory')).status()).toBe(409);
      expect((await forged.get(`/api/ably-token?boardId=${w.boardId}`)).status()).toBeGreaterThanOrEqual(401);
    }
  });

  test('a participant removed before completion is a fresh visitor', async ({ playwright, baseURL }) => {
    const w = await boardWithContent(playwright, baseURL!);
    const removed = await w.a.delete(`/api/boards/${w.boardId}/participants`, { data: { participantId: w.bId } });
    expect(removed.status()).toBe(200);
    await w.a.post(`/api/boards/${w.boardId}`, { data: { action: 'complete' } });
    const { raw, json } = await getRaw(w.b, w.boardId);
    expectClosedPayload(json, w.boardId, raw, [w.cardText, w.itemText, w.aliceName]);
    expect((await apiJoin(w.b, w.boardId, 'Bob Again')).status()).toBe(409);
  });

  test('leaving a completed board is still allowed', async ({ playwright, baseURL }) => {
    const w = await boardWithContent(playwright, baseURL!);
    await w.a.post(`/api/boards/${w.boardId}`, { data: { action: 'complete' } });
    const leave = await w.b.delete(`/api/boards/${w.boardId}/participants`, { data: { participantId: w.bId } });
    expect(leave.status()).toBe(200);
  });

  test('ably token: refused to a fresh visitor, granted to a prior participant', async ({ playwright, baseURL }) => {
    const w = await boardWithContent(playwright, baseURL!);
    await w.a.post(`/api/boards/${w.boardId}`, { data: { action: 'complete' } });
    const denied = await w.stranger.get(`/api/ably-token?boardId=${w.boardId}`);
    expect(denied.status()).toBe(401);
    const granted = await w.b.get(`/api/ably-token?boardId=${w.boardId}`);
    expect(granted.status()).toBe(200);
    expect((await granted.json()).clientId).toBe(w.bId);
  });

  test('the creator who never joined is not "part of it": minimal payload, join refused', async ({ playwright, baseURL }) => {
    const creator = await identity(playwright, baseURL!);
    const board = await createBoard(creator); // cookie only, no participant row
    // Someone else did the work and the board is completed without the creator ever joining.
    const other = await identity(playwright, baseURL!);
    expect((await apiJoin(other, board.boardId, `Other${rand()}`)).status()).toBe(200);
    await setArchivedDirect(board.boardId, true);

    const { raw, json } = await getRaw(creator, board.boardId);
    expectClosedPayload(json, board.boardId, raw, []);
    expect((await apiJoin(creator, board.boardId, 'Creator')).status()).toBe(409);
    expect((await creator.get(`/api/ably-token?boardId=${board.boardId}`)).status()).toBe(401);
  });

  test('reopen restores joining and viewing', async ({ playwright, baseURL }) => {
    const w = await boardWithContent(playwright, baseURL!);
    await w.a.post(`/api/boards/${w.boardId}`, { data: { action: 'complete' } });
    expect((await apiJoin(w.stranger, w.boardId, 'Early')).status()).toBe(409);
    // The real reopen action needs a signed-in owner; clearing archived_at is its database effect.
    await setArchivedDirect(w.boardId, false);
    const { json } = await getRaw(w.stranger, w.boardId);
    expect(json.access).toBe('open');
    expect((json.board as { archived_at: unknown }).archived_at).toBeNull();
    const join = await apiJoin(w.stranger, w.boardId, 'Late');
    expect(join.status()).toBe(200);
    const late = await getBoard(w.stranger, w.boardId);
    expect(late.cards.map((c: { text: string }) => c.text)).toContain(w.cardText);
  });

  test('anonymity persists on a completed board for an allowed viewer', async ({ playwright, baseURL }) => {
    const w = await boardWithContent(playwright, baseURL!, { anonymous_cards: true });
    await w.a.post(`/api/boards/${w.boardId}`, { data: { action: 'complete' } });
    const bob = await getBoard(w.b, w.boardId);
    const card = bob.cards.find((c: { text: string }) => c.text === w.cardText);
    expect(card.author_id).toBeNull();
    expect(card.author_name).toBeNull();
  });

  test('join by code: completed board is refused to a stranger, allowed to a participant', async ({ playwright, baseURL }) => {
    const w = await boardWithContent(playwright, baseURL!);
    await w.a.post(`/api/boards/${w.boardId}`, { data: { action: 'complete' } });
    const denied = await w.stranger.post('/api/boards/join', { data: { joinCode: w.joinCode } });
    expect(denied.status()).toBe(409);
    expect((await denied.json()).error).toBe('Board is completed');
    const ok = await w.b.post('/api/boards/join', { data: { joinCode: w.joinCode } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).boardId).toBe(w.boardId);
  });
});

test.describe('Rule B (v1 legacy): best effort with the claimed id', () => {
  async function legacyBoard(playwright: PW, baseURL: string) {
    const a = await identity(playwright, baseURL);
    const board = await createBoard(a);
    await makeLegacyV1(board.boardId);
    const pid = `v1-${rand()}`;
    const name = `Legacy${rand()}`;
    const join = await apiJoin(a, board.boardId, name, { participantId: pid });
    expect(join.status()).toBe(200);
    const itemText = `ITEM${rand()}`;
    const item = await a.post(`/api/boards/${board.boardId}/action-items`, { data: { description: itemText, createdBy: pid } });
    expect(item.status(), await item.text()).toBe(200);
    return { a, pid, name, itemText, ...board };
  }

  test('active: an unknown id gets no action items, the known id does', async ({ playwright, baseURL }) => {
    const w = await legacyBoard(playwright, baseURL!);
    const anon = await identity(playwright, baseURL!);
    expect((await getRaw(anon, w.boardId)).json.actionItems).toEqual([]);
    expect((await getRaw(anon, w.boardId, '?pid=nobody')).json.actionItems).toEqual([]);
    const mine = (await getRaw(anon, w.boardId, `?pid=${w.pid}`)).json.actionItems as unknown[];
    expect(mine).toHaveLength(1);
  });

  test('completed: known id views, unknown id gets the minimal payload, join refused', async ({ playwright, baseURL }) => {
    const w = await legacyBoard(playwright, baseURL!);
    await legacyUpdate(w.boardId, { archived: true });
    const anon = await identity(playwright, baseURL!);

    const known = (await getRaw(anon, w.boardId, `?pid=${w.pid}`)).json;
    expect(known.access).toBe('open');
    expect((known.participants as unknown[]).length).toBe(1);
    expect((known.actionItems as unknown[]).length).toBe(1);

    for (const q of ['', '?pid=nobody']) {
      const { raw, json } = await getRaw(anon, w.boardId, q);
      expectClosedPayload(json, w.boardId, raw, [w.itemText, w.name]);
    }
    const refused = await apiJoin(anon, w.boardId, 'Newcomer', { participantId: `v1-${rand()}` });
    expect(refused.status()).toBe(409);
    // The known participant can still re-establish.
    const again = await apiJoin(anon, w.boardId, w.name, { participantId: w.pid });
    expect(again.status()).toBe(200);
    // Token: unknown clientId refused, known granted.
    expect((await anon.get(`/api/ably-token?boardId=${w.boardId}&clientId=nobody`)).status()).toBe(403);
    expect((await anon.get(`/api/ably-token?boardId=${w.boardId}&clientId=${w.pid}`)).status()).toBe(200);
  });
});

test.describe('Rule B (browser)', () => {
  test('a fresh context sees the completed screen and opens no Ably websocket; a prior participant still views', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const { boardId } = await createBoard(ctxA.request, { settings: { card_visibility: 'visible' } });
    const aliceName = `Alice${rand()}`;
    const pageA = await joinAs(ctxA, boardId, aliceName);
    const cardText = `CARD${rand()}`;
    await pageA.getByRole('button', { name: 'Add a card' }).first().click();
    await pageA.getByPlaceholder('Type your thought…').fill(cardText);
    await pageA.getByPlaceholder('Type your thought…').press('Enter');
    await expect(pageA.getByText(cardText).filter({ visible: true }).first()).toBeVisible();
    expect((await ctxA.request.post(`/api/boards/${boardId}`, { data: { action: 'complete' } })).status()).toBe(200);

    // Fresh context.
    const ctxF = await browser.newContext();
    const pageF = await ctxF.newPage();
    const sockets: string[] = [];
    pageF.on('websocket', (ws) => sockets.push(ws.url()));
    const cap = capture(pageF);
    await pageF.goto(`/board/${boardId}`);
    await expect(pageF.getByText('This retro has been completed. It is no longer open to new participants.')).toBeVisible();
    await expect(pageF.getByText(`e2e ${boardId}`)).toBeVisible();
    await expect(pageF.getByRole('link', { name: 'Go Home' })).toBeVisible();
    await expect(pageF.getByText('Join Retrospective')).toHaveCount(0);
    await expect(pageF.locator('#display-name')).toHaveCount(0);
    await pageF.waitForTimeout(1500);
    await cap.settle();
    expect(sockets.filter((u) => !u.includes('/_next/') && !u.includes('webpack-hmr')), 'non-HMR websockets').toEqual([]);
    expect(sockets.some((u) => u.includes('ably'))).toBe(false);
    expect(cap.all()).not.toContain(cardText);
    expect(cap.all()).not.toContain(aliceName);
    expect(await pageF.content()).not.toContain(cardText);

    // Previously joined context reloads and still sees the board, read-only.
    const socketsA: string[] = [];
    pageA.on('websocket', (ws) => socketsA.push(ws.url()));
    await pageA.reload();
    await expect(pageA.getByText(cardText).filter({ visible: true }).first()).toBeVisible();
    await expect(pageA.getByRole('button', { name: 'Add a card' })).toHaveCount(0);
    // Control: the prior participant does open the Ably socket, so its absence above means something.
    await expect.poll(() => socketsA.some((u) => u.includes('ably')), { timeout: 15_000 }).toBe(true);
    await expect(pageA.getByText('It is no longer open to new participants')).toHaveCount(0);
  });
});
