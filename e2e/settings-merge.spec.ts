import { test, expect, type APIRequestContext } from '@playwright/test';
import { createBoard, apiJoin, getBoard, patchSettings } from './helpers';

/**
 * Board settings PATCH merges key by key (settings = settings || patch) in one statement, so two
 * facilitators changing DIFFERENT keys at the same moment both win. Before the merge the second
 * writer's whole-object overwrite undid the first one's change.
 */

const contexts: APIRequestContext[] = [];
test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.dispose()));
});

type PW = import('@playwright/test').PlaywrightWorkerArgs['playwright'];

async function twoFacilitators(playwright: PW, baseURL: string) {
  const a = await playwright.request.newContext({ baseURL });
  const b = await playwright.request.newContext({ baseURL });
  contexts.push(a, b);
  const board = await createBoard(a, { displayName: 'Alice' });
  const joinB = await apiJoin(b, board.boardId, 'Bob');
  expect(joinB.status()).toBe(200);
  const bId: string = (await joinB.json()).participant.id;
  // Alice (creator, facilitator) promotes Bob to a second facilitator.
  const promote = await a.patch(`/api/boards/${board.boardId}/participants`, {
    data: { participantId: bId, updates: { is_admin: true } },
  });
  expect(promote.status(), await promote.text()).toBe(200);
  return { a, b, ...board };
}

test('two facilitators changing different keys concurrently: both persist', async ({ playwright, baseURL }) => {
  const { a, b, boardId } = await twoFacilitators(playwright, baseURL!);
  const timer = { duration: 300, remaining: 300, status: 'running', started_at: new Date().toISOString() };

  // Repeat so a last-writer-wins overwrite would be caught with near certainty.
  for (let i = 0; i < 5; i++) {
    const reveal = i % 2 === 0 ? 'visible' : 'hidden';
    const [r1, r2] = await Promise.all([
      patchSettings(a, boardId, { card_visibility: reveal }),
      patchSettings(b, boardId, { timer: { ...timer, remaining: 300 - i } }),
    ]);
    expect(r1.status(), await r1.text()).toBe(200);
    expect(r2.status(), await r2.text()).toBe(200);
    const { board } = await getBoard(a, boardId);
    expect(board.settings.card_visibility, `round ${i}`).toBe(reveal);
    expect(board.settings.timer.remaining, `round ${i}`).toBe(300 - i);
    // Keys nobody sent are untouched.
    expect(board.settings.max_votes_per_participant).toBe(5);
  }
});

test('a patch with one key leaves every other key alone', async ({ playwright, baseURL }) => {
  const { a, boardId } = await twoFacilitators(playwright, baseURL!);
  expect((await patchSettings(a, boardId, { voting_enabled: true, max_votes_per_participant: 3 })).status()).toBe(200);
  expect((await patchSettings(a, boardId, { card_visibility: 'visible' })).status()).toBe(200);
  const { board } = await getBoard(a, boardId);
  expect(board.settings).toMatchObject({ voting_enabled: true, max_votes_per_participant: 3, card_visibility: 'visible' });
});

test('invalid settings are rejected with 400 and change nothing', async ({ playwright, baseURL }) => {
  const { a, boardId } = await twoFacilitators(playwright, baseURL!);
  for (const bad of [
    { mystery: true },
    { card_visibility: 'open' },
    { voting_enabled: 'yes' },
    { max_votes_per_participant: 0 },
    { timer: { duration: 1 } },
  ]) {
    const res = await patchSettings(a, boardId, bad);
    expect(res.status(), JSON.stringify(bad)).toBe(400);
    expect(typeof (await res.json()).error).toBe('string');
  }
  const { board } = await getBoard(a, boardId);
  expect(board.settings.card_visibility).toBe('hidden');
  expect(board.settings).not.toHaveProperty('mystery');
});
