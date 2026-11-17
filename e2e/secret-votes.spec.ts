import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { shown, waitForRealtime, createBoard, joinAs, capture, getBoard, hasJsonField, apiAddCard } from './helpers';

const rand = () => randomBytes(4).toString('hex');

test('secret votes are not visible to other participants until secret voting is turned off', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const { boardId, columnId } = await createBoard(ctxA.request, {
    settings: { card_visibility: 'visible', voting_enabled: true, secret_voting: true },
  });

  const pageA = await joinAs(ctxA, boardId, `Alice-${rand()}`);
  const aliceId: string = (await getBoard(ctxA.request, boardId)).youAre.participantId;

  let cap!: ReturnType<typeof capture>;
  const pageB = await joinAs(ctxB, boardId, `Bob-${rand()}`, {
    beforeGoto: (p) => {
      cap = capture(p);
    },
  });
  await waitForRealtime(cap, boardId);

  // A card exists on both screens.
  const text = `Votable-${rand()}`;
  const { response } = apiAddCard(ctxA.request, boardId, columnId, text);
  expect((await response).status()).toBe(200);
  await expect(shown(pageA, text)).toBeVisible();
  await expect(shown(pageB, text)).toBeVisible();

  // A votes through the UI.
  await pageA.getByRole('button', { name: 'Vote for this card', exact: true }).click();
  await expect(pageA.getByRole('button', { name: 'Remove vote', exact: true })).toBeVisible();
  await expect.poll(async () => (await getBoard(ctxA.request, boardId)).votes.length).toBe(1);

  // B: still sees an unvoted card, even after a fresh GET, and nothing about A's vote arrived.
  await pageB.waitForTimeout(2000);
  const framesBeforeReload = cap.frames.length;
  await pageB.reload();
  await waitForRealtime(cap, boardId, framesBeforeReload);
  await expect(shown(pageB, text)).toBeVisible();
  const bobButton = pageB.getByRole('button', { name: 'Vote for this card', exact: true });
  await expect(bobButton).toBeVisible();
  await expect(bobButton).toHaveAttribute('aria-pressed', 'false');
  await expect(bobButton).not.toContainText('1');
  await cap.settle();
  const everything = cap.all();
  expect(everything).toContain(boardId); // control: real traffic captured
  expect(hasJsonField(everything, 'voter_id', aliceId), "A's voter_id in a vote payload").toBe(false);
  expect(everything).not.toContain('vote-cast');
  // The vote id is unknowable to B, but the vote list B received must be empty.
  const bBoard = await (await ctxB.request.get(`/api/boards/${boardId}`)).json();
  expect(bBoard.votes).toEqual([]);
  expect(bBoard.cards.every((c: { votes?: unknown[]; vote_count?: number }) => !c.votes?.length && c.vote_count === undefined)).toBe(true);

  // Facilitator turns secret voting off: B sees the vote without reloading.
  await pageA.getByRole('button', { name: 'Secret voting', exact: true }).click();
  await expect(pageB.getByRole('button', { name: 'Vote for this card', exact: true })).toContainText('1', { timeout: 5_000 });
  await expect(pageA.getByRole('button', { name: 'Remove vote', exact: true })).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
