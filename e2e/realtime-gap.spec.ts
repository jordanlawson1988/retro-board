import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { shown, hiddenCards, createBoard, joinAs, patchSettings, apiAddCard } from './helpers';

const rand = () => randomBytes(5).toString('hex').toUpperCase();

test('events published between the board GET and the Ably attach are not lost', async ({ browser }) => {
  const secret = `GAP-${rand()}`;

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();

  // A is the creator and facilitator; no browser needed for A.
  const { boardId, columnId } = await createBoard(ctxA.request, {
    displayName: `Alice-${rand()}`,
    settings: { card_visibility: 'hidden' },
  });

  const pageB = await joinAs(ctxB, boardId, `Bob-${rand()}`);

  // Hold B's Ably token so the board GET completes but the channel cannot attach.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let tokenRequested = false;
  await pageB.route('**/api/ably-token**', async (route) => {
    tokenRequested = true;
    await gate;
    await route.continue();
  });

  const boardGet = pageB.waitForResponse(
    (r) => r.url().endsWith(`/api/boards/${boardId}`) && r.request().method() === 'GET'
  );
  await pageB.reload();
  await boardGet;
  await expect.poll(() => tokenRequested, { timeout: 15_000 }).toBe(true);
  await expect(pageB.getByRole('button', { name: 'Add a card' }).first()).toBeVisible();

  // While B is stuck between GET and attach: A adds a card, then reveals. Both events are lost to B.
  const { response } = apiAddCard(ctxA.request, boardId, columnId, secret);
  expect((await response).status()).toBe(200);
  expect((await patchSettings(ctxA.request, boardId, { card_visibility: 'visible' })).status()).toBe(200);
  // Give the publishes time to land on Ably before B can attach.
  await pageB.waitForTimeout(1500);
  await expect(pageB.getByText(secret)).toHaveCount(0);

  release();

  // B catches up without a reload, and the card appears exactly once.
  await expect(shown(pageB, secret)).toBeVisible({ timeout: 5_000 });
  await expect(hiddenCards(pageB)).toHaveCount(0);
  await expect(pageB.getByText(secret).filter({ visible: true })).toHaveCount(1);

  await ctxA.close();
  await ctxB.close();
});
