import { test, expect, type APIRequestContext } from '@playwright/test';
import { createBoard, apiJoin, getBoard, newCardBody } from './helpers';

const contexts: APIRequestContext[] = [];

test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.dispose()));
});

const PEOPLE = 10;

test.describe('reactions are applied per person, not as a wholesale replace', () => {
  test('10 participants react to one card at the same moment: all 10 reactions are stored', async ({ playwright, baseURL }) => {
    const owner = await playwright.request.newContext({ baseURL: baseURL! });
    contexts.push(owner);
    const board = await createBoard(owner, { settings: { card_visibility: 'visible' } });
    expect((await apiJoin(owner, board.boardId, 'Owner')).status()).toBe(200);
    const card = newCardBody(board.columnId);
    expect((await owner.post(`/api/boards/${board.boardId}/cards`, { data: card })).status()).toBe(200);

    const people: { ctx: APIRequestContext; id: string }[] = [];
    for (let i = 0; i < PEOPLE; i++) {
      const ctx = await playwright.request.newContext({ baseURL: baseURL! });
      contexts.push(ctx);
      const res = await apiJoin(ctx, board.boardId, `P${i}`);
      expect(res.status()).toBe(200);
      people.push({ ctx, id: (await res.json()).participant.id });
    }

    // Every client sends its own view of the map: just itself under the emoji.
    const responses = await Promise.all(
      people.map((p) =>
        p.ctx.patch(`/api/boards/${board.boardId}/cards`, {
          data: { cardId: card.id, updates: { reactions: { '👍': [p.id] } } },
        })
      )
    );
    for (const r of responses) expect(r.status()).toBe(200);

    const stored = (await getBoard(owner, board.boardId)).cards.find((c: { id: string }) => c.id === card.id);
    expect([...stored.reactions['👍']].sort()).toEqual(people.map((p) => p.id).sort());
    expect(stored.reactions['👍']).toHaveLength(PEOPLE);
  });

  test('removing your own reaction leaves everyone else\'s, and an emptied emoji disappears', async ({ playwright, baseURL }) => {
    const a = await playwright.request.newContext({ baseURL: baseURL! });
    const b = await playwright.request.newContext({ baseURL: baseURL! });
    contexts.push(a, b);
    const board = await createBoard(a, { settings: { card_visibility: 'visible' } });
    const aId: string = (await (await apiJoin(a, board.boardId, 'Alice')).json()).participant.id;
    const bId: string = (await (await apiJoin(b, board.boardId, 'Bob')).json()).participant.id;
    const card = newCardBody(board.columnId);
    await a.post(`/api/boards/${board.boardId}/cards`, { data: card });

    await a.patch(`/api/boards/${board.boardId}/cards`, { data: { cardId: card.id, updates: { reactions: { '👍': [aId], '🎉': [aId] } } } });
    // Bob's client is stale: it has not seen Alice's reactions yet.
    await b.patch(`/api/boards/${board.boardId}/cards`, { data: { cardId: card.id, updates: { reactions: { '👍': [bId] } } } });
    let stored = (await getBoard(a, board.boardId)).cards.find((c: { id: string }) => c.id === card.id);
    expect(stored.reactions).toEqual({ '👍': [aId, bId], '🎉': [aId] });

    // Alice removes both of hers; Bob's stays.
    await a.patch(`/api/boards/${board.boardId}/cards`, { data: { cardId: card.id, updates: { reactions: {} } } });
    stored = (await getBoard(a, board.boardId)).cards.find((c: { id: string }) => c.id === card.id);
    expect(stored.reactions).toEqual({ '👍': [bId] });
  });
});
