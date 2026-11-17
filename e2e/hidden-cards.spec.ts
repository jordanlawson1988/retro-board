import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { shown, hiddenCards, waitForRealtime, createBoard, joinAs, capture, getBoard, hasJsonField } from './helpers';

const rand = () => randomBytes(5).toString('hex').toUpperCase();

test('hidden + anonymous cards never reach another participant until the facilitator reveals', async ({ browser }) => {
  const secret = `SECRET-${rand()}`;
  const aliceName = `Alice-${rand()}`;

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();

  // Board is created by A's cookie jar: A holds the creator claim and joins as facilitator.
  const { boardId } = await createBoard(ctxA.request, {
    settings: { card_visibility: 'hidden', anonymous_cards: true },
  });

  const pageA = await joinAs(ctxA, boardId, aliceName);
  const aliceId: string = (await getBoard(ctxA.request, boardId)).youAre.participantId;
  expect(aliceId).toBeTruthy();

  // B listens from the very first request.
  let cap!: ReturnType<typeof capture>;
  const pageB = await joinAs(ctxB, boardId, `Bob-${rand()}`, {
    beforeGoto: (p) => {
      cap = capture(p);
    },
  });
  // Let B's realtime connection come up before A writes.
  await waitForRealtime(cap, boardId);

  // A adds a card through the UI.
  await pageA.getByRole('button', { name: 'Add a card' }).first().click();
  await pageA.getByPlaceholder('Type your thought…').fill(secret);
  await pageA.getByPlaceholder('Type your thought…').press('Enter');
  await expect(shown(pageA, secret)).toBeVisible();

  // B sees exactly one card, with the text withheld.
  await expect(hiddenCards(pageB)).toHaveCount(1);
  await expect(pageB.getByText(secret)).toHaveCount(0);

  // Control: B really received the realtime event, so the absence below means something.
  await expect.poll(() => cap.frames.some((f) => f.includes('card-created')), { timeout: 10_000 }).toBe(true);

  // A fresh GET (reload) is shaped the same way.
  const framesBeforeReload = cap.frames.length;
  await pageB.reload();
  // Reconnecting after a reload: wait for the new realtime attach, or the reveal below could be missed.
  await waitForRealtime(cap, boardId, framesBeforeReload);
  await expect(hiddenCards(pageB)).toHaveCount(1);

  await cap.settle();
  const everything = cap.all();
  const html = await pageB.content();
  expect(everything).toContain(boardId); // control: the capture holds real app traffic
  // Control: the field matcher does fire on real data (Alice is a public participant in B's board GET).
  expect(hasJsonField(everything, 'display_name', aliceName), 'matcher control').toBe(true);
  expect(everything, 'card text in B HTTP bodies or websocket frames').not.toContain(secret);
  expect(html, 'card text in B DOM').not.toContain(secret);
  await expect(pageB.locator('body')).not.toContainText(secret);

  // Anonymous: no card carries the author's name or id as its author. (The name is still
  // public as a participant, so the check is on the card's author fields, not the bare string.)
  expect(hasJsonField(everything, 'author_name', aliceName), 'author_name on a card').toBe(false);
  expect(hasJsonField(everything, 'author_id', aliceId), 'author_id on a card').toBe(false);

  // Reveal: B shows the text within 5s, no reload.
  await pageA.getByRole('button', { name: 'Cards hidden', exact: true }).click();
  await expect(shown(pageB, secret)).toBeVisible({ timeout: 5_000 });
  await expect(hiddenCards(pageB)).toHaveCount(0);

  // Control: after the reveal the capture does contain the text, so the earlier absence was real.
  await cap.settle();
  expect(cap.all()).toContain(secret);

  // Still anonymous after reveal.
  expect(hasJsonField(cap.all(), 'author_name', aliceName), 'author_name after reveal').toBe(false);

  await ctxA.close();
  await ctxB.close();
});

test('an author keeps their own text while cards are hidden, including after an edit', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const { boardId } = await createBoard(ctxA.request, { settings: { card_visibility: 'hidden' } });
  const pageA = await joinAs(ctxA, boardId, `Alice-${rand()}`);
  let cap!: ReturnType<typeof capture>;
  const pageB = await joinAs(ctxB, boardId, `Bob-${rand()}`, { beforeGoto: (p) => { cap = capture(p); } });
  await waitForRealtime(cap, boardId);

  const first = `FIRST-${rand()}`;
  const edited = `EDITED-${rand()}`;
  await pageA.getByRole('button', { name: 'Add a card' }).first().click();
  await pageA.getByPlaceholder('Type your thought…').fill(first);
  await pageA.getByPlaceholder('Type your thought…').press('Enter');
  await expect(shown(pageA, first)).toBeVisible();
  // Close the composer: it stays focused after Enter, and its blur-collapse shifts the layout under the next click.
  await pageA.getByPlaceholder('Type your thought…').press('Escape');
  await expect(hiddenCards(pageB)).toHaveCount(1);

  await shown(pageA, first).hover();
  await pageA.getByRole('button', { name: 'Edit card', exact: true }).filter({ visible: true }).first().click();
  const editor = pageA.locator('textarea:visible').first();
  await editor.fill(edited);
  await pageA.getByRole('button', { name: 'Save edit', exact: true }).filter({ visible: true }).first().click();

  // The realtime echo of the edit arrives with the text withheld; A must still see their own text.
  await expect(shown(pageA, edited)).toBeVisible();
  await pageA.waitForTimeout(1500);
  await expect(shown(pageA, edited)).toBeVisible();
  await expect(pageB.getByText(edited)).toHaveCount(0);
  await expect(hiddenCards(pageB)).toHaveCount(1);

  await ctxA.close();
  await ctxB.close();
});
