import { test, expect, type APIRequestContext } from '@playwright/test';
import { nanoid } from 'nanoid';
import {
  createBoard,
  apiJoin,
  getBoard,
  makeLegacyV1,
  legacyUpdate,
  cookieValue,
  withRawCookie,
} from './helpers';

/**
 * Action-item authorization, black-box against the running server.
 *
 * The rule, from lib/board-guards.ts (`action-item.write`) and the trust-foundation plan (Task 6 step 5):
 *   - POST, PATCH and DELETE are all the single action `action-item.write`.
 *   - State: archived board -> 409 "Board is completed" (facilitator included);
 *            board_locked -> 409 "Board is locked" for non-facilitators only.
 *   - Identity (v2): a request needs a participant row (or facilitator authority), else 401.
 *            There is NO author-ownership rule: any joined participant may create, update or
 *            delete ANY action item. Only the facilitator/participant split exists for locks.
 *   - v2 `created_by` is the cookie participant; the body's `createdBy` is ignored.
 *   - v1: identity rules are skipped; `createdBy` from the body is stored.
 */

const contexts: APIRequestContext[] = [];

test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.dispose()));
});

type PW = import('@playwright/test').PlaywrightWorkerArgs['playwright'];

async function identity(playwright: PW, baseURL: string) {
  const ctx = await playwright.request.newContext({ baseURL });
  contexts.push(ctx);
  return ctx;
}

async function boardWithAliceAndBob(playwright: PW, baseURL: string, settings: Record<string, unknown> = {}) {
  const a = await identity(playwright, baseURL);
  const b = await identity(playwright, baseURL);
  const board = await createBoard(a, { settings });
  const joinA = await apiJoin(a, board.boardId, 'Alice');
  expect(joinA.status()).toBe(200);
  const aId: string = (await joinA.json()).participant.id;
  const joinB = await apiJoin(b, board.boardId, 'Bob');
  expect(joinB.status()).toBe(200);
  const bId: string = (await joinB.json()).participant.id;
  return { a, b, aId, bId, ...board };
}

const url = (boardId: string) => `/api/boards/${boardId}/action-items`;

async function addItem(ctx: APIRequestContext, boardId: string, extra: Record<string, unknown> = {}) {
  const res = await ctx.post(url(boardId), { data: { description: `item ${nanoid(5)}`, ...extra } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).item as { id: string; description: string; status: string; created_by: string | null; board_id: string };
}

async function items(ctx: APIRequestContext, boardId: string) {
  return (await getBoard(ctx, boardId)).actionItems as Array<{
    id: string;
    description: string;
    status: string;
    assignee: string | null;
    due_date: string | null;
    created_by: string | null;
  }>;
}

test.describe('v2 action items: authentication', () => {
  test('no cookie: POST, PATCH and DELETE are all 401 and nothing is written', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(a, boardId);
    const anon = await identity(playwright, baseURL!);

    expect((await anon.post(url(boardId), { data: { description: 'x' } })).status()).toBe(401);
    expect((await anon.patch(url(boardId), { data: { itemId: item.id, updates: { description: 'pwned' } } })).status()).toBe(401);
    expect((await anon.delete(url(boardId), { data: { itemId: item.id } })).status()).toBe(401);

    const after = await items(a, boardId);
    expect(after).toHaveLength(1);
    expect(after[0].description).toBe(item.description);
  });

  test('tampered, unsigned and foreign-board cookies are 401 on every verb', async ({ playwright, baseURL }) => {
    const { a, aId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(a, boardId);
    const good = (await cookieValue(a, boardId))!;
    const parts = good.split('.');
    const sig = parts[parts.length - 1];
    const iat = parts[parts.length - 2];
    const forgeries: Record<string, string> = {
      'flipped signature char': `${aId}.${iat}.${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`,
      'unsigned participant id': aId,
      'empty signature': `${aId}.${iat}.`,
      garbage: 'not-a-cookie',
    };
    // Bob's genuine cookie for a DIFFERENT board, presented under this board's cookie name.
    const other = await boardWithAliceAndBob(playwright, baseURL!);
    forgeries['cookie signed for another board'] = (await cookieValue(other.b, other.boardId))!;

    for (const [label, value] of Object.entries(forgeries)) {
      const forged = await withRawCookie(playwright, baseURL!, `rb_ps_${boardId}`, value);
      contexts.push(forged);
      expect((await forged.post(url(boardId), { data: { description: 'x' } })).status(), `POST ${label}`).toBe(401);
      expect((await forged.patch(url(boardId), { data: { itemId: item.id, updates: { status: 'done' } } })).status(), `PATCH ${label}`).toBe(401);
      expect((await forged.delete(url(boardId), { data: { itemId: item.id } })).status(), `DELETE ${label}`).toBe(401);
    }
    const after = await items(a, boardId);
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe('open');

    // Control: the untampered cookie works.
    const control = await withRawCookie(playwright, baseURL!, `rb_ps_${boardId}`, good);
    contexts.push(control);
    expect((await control.post(url(boardId), { data: { description: 'control' } })).status()).toBe(200);
  });

  test('the creator claim cookie alone (not yet joined) is not enough: 401 "Join the board first"', async ({ playwright, baseURL }) => {
    const creator = await identity(playwright, baseURL!);
    const { boardId } = await createBoard(creator); // no displayName: cookie is a claim only
    const res = await creator.post(url(boardId), { data: { description: 'x' } });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toBe('Join the board first');
  });
});

test.describe('v2 action items: who may write', () => {
  test('facilitator (A) and plain participant (B) may each create; both are attributed to their own cookie', async ({ playwright, baseURL }) => {
    const { a, b, aId, bId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const byA = await addItem(a, boardId);
    const byB = await addItem(b, boardId);
    expect(byA.created_by).toBe(aId);
    expect(byB.created_by).toBe(bId);
    expect(byA.status).toBe('open');
    expect((await items(a, boardId)).map((i) => i.id).sort()).toEqual([byA.id, byB.id].sort());
  });

  test('there is no author rule: B may update and delete an item A created, and A may do the same to B\'s', async ({ playwright, baseURL }) => {
    const { a, b, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const byA = await addItem(a, boardId);
    const byB = await addItem(b, boardId);

    const upd = await b.patch(url(boardId), {
      data: { itemId: byA.id, updates: { description: 'edited by bob', assignee: 'Bob', due_date: '2030-01-01', status: 'in_progress' } },
    });
    expect(upd.status()).toBe(200);
    expect((await upd.json()).item).toMatchObject({ id: byA.id, description: 'edited by bob', assignee: 'Bob', status: 'in_progress' });
    // Attribution is not rewritten by an edit.
    expect((await items(a, boardId)).find((i) => i.id === byA.id)!.created_by).toBe(byA.created_by);

    expect((await a.patch(url(boardId), { data: { itemId: byB.id, updates: { status: 'done' } } })).status()).toBe(200);

    expect((await b.delete(url(boardId), { data: { itemId: byA.id } })).status()).toBe(200);
    expect((await a.delete(url(boardId), { data: { itemId: byB.id } })).status()).toBe(200);
    expect(await items(a, boardId)).toHaveLength(0);
  });

  test('board_locked: participant gets 409 on every verb, facilitator still writes', async ({ playwright, baseURL }) => {
    const { a, b, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(a, boardId);
    expect((await a.patch(`/api/boards/${boardId}`, { data: { settings: { board_locked: true } } })).status()).toBe(200);

    const post = await b.post(url(boardId), { data: { description: 'x' } });
    expect(post.status()).toBe(409);
    expect((await post.json()).error).toBe('Board is locked');
    expect((await b.patch(url(boardId), { data: { itemId: item.id, updates: { status: 'done' } } })).status()).toBe(409);
    expect((await b.delete(url(boardId), { data: { itemId: item.id } })).status()).toBe(409);
    expect((await items(a, boardId))[0].status).toBe('open');

    // Facilitator is exempt from the lock.
    expect((await a.patch(url(boardId), { data: { itemId: item.id, updates: { status: 'done' } } })).status()).toBe(200);
    expect((await a.post(url(boardId), { data: { description: 'fac ok' } })).status()).toBe(200);
    expect((await a.delete(url(boardId), { data: { itemId: item.id } })).status()).toBe(200);
  });

  test('a promoted facilitator keeps write access; a demoted one falls back to the lock rule', async ({ playwright, baseURL }) => {
    const { a, b, bId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    expect((await a.patch(`/api/boards/${boardId}`, { data: { settings: { board_locked: true } } })).status()).toBe(200);
    expect((await b.post(url(boardId), { data: { description: 'x' } })).status()).toBe(409);
    expect((await a.patch(`/api/boards/${boardId}/participants`, { data: { participantId: bId, updates: { is_admin: true } } })).status()).toBe(200);
    expect((await b.post(url(boardId), { data: { description: 'now ok' } })).status()).toBe(200);
    expect((await a.patch(`/api/boards/${boardId}/participants`, { data: { participantId: bId, updates: { is_admin: false } } })).status()).toBe(200);
    expect((await b.post(url(boardId), { data: { description: 'again no' } })).status()).toBe(409);
  });
});

test.describe('v2 action items: identity comes from the cookie, never the body', () => {
  test('POST ignores createdBy / created_by / participantId in the body', async ({ playwright, baseURL }) => {
    const { a, b, aId, bId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(b, boardId, { createdBy: aId, created_by: aId, participantId: aId, authorId: aId });
    expect(item.created_by).toBe(bId);
    expect((await items(a, boardId)).find((i) => i.id === item.id)!.created_by).toBe(bId);
  });

  test('POST with a createdBy of someone who is not on the board is still attributed to the cookie', async ({ playwright, baseURL }) => {
    const { b, bId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(b, boardId, { createdBy: 'ghost-participant' });
    expect(item.created_by).toBe(bId);
  });

  test('PATCH cannot rewrite created_by, board_id or id; unknown fields are not persisted', async ({ playwright, baseURL }) => {
    const { a, b, aId, bId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(a, boardId);
    const res = await b.patch(url(boardId), {
      data: { itemId: item.id, updates: { status: 'done', created_by: bId, board_id: 'elsewhere', id: 'hijack' } },
    });
    expect(res.status()).toBe(200);
    const stored = (await items(a, boardId))[0];
    expect(stored).toMatchObject({ id: item.id, created_by: aId, status: 'done' });
  });

  test('cross-board: a participant of board 1 cannot touch board 2\'s items by id, even with a valid cookie for board 1', async ({ playwright, baseURL }) => {
    const one = await boardWithAliceAndBob(playwright, baseURL!);
    const two = await boardWithAliceAndBob(playwright, baseURL!);
    const victim = await addItem(two.a, two.boardId);

    // Bob@board1 aims at board 1's route with board 2's item id: the board_id scope in SQL means no row is touched.
    await one.b.patch(url(one.boardId), { data: { itemId: victim.id, updates: { description: 'pwned' } } });
    await one.b.delete(url(one.boardId), { data: { itemId: victim.id } });
    const after = await items(two.a, two.boardId);
    expect(after).toHaveLength(1);
    expect(after[0].description).toBe(victim.description);

    // And Bob has no cookie for board 2.
    expect((await one.b.delete(url(two.boardId), { data: { itemId: victim.id } })).status()).toBe(401);
  });
});

test.describe('v2 action items: completed board', () => {
  test('archived: 409 "Board is completed" on POST, PATCH and DELETE, for the facilitator too; items are unchanged', async ({ playwright, baseURL }) => {
    const { a, b, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(a, boardId);
    expect((await a.post(`/api/boards/${boardId}`, { data: { action: 'complete' } })).status()).toBe(200);

    for (const [who, ctx] of [['facilitator', a], ['participant', b]] as const) {
      const post = await ctx.post(url(boardId), { data: { description: 'late' } });
      expect(post.status(), `${who} POST`).toBe(409);
      expect((await post.json()).error).toBe('Board is completed');
      expect((await ctx.patch(url(boardId), { data: { itemId: item.id, updates: { status: 'done' } } })).status(), `${who} PATCH`).toBe(409);
      expect((await ctx.delete(url(boardId), { data: { itemId: item.id } })).status(), `${who} DELETE`).toBe(409);
    }
    const after = await items(a, boardId);
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe('open');
  });

  test('unauthenticated on a completed board is 409, not 401 (state rule runs before identity)', async ({ playwright, baseURL }) => {
    // checkAction runs state BEFORE identity, so for a completed board an anonymous caller sees 409, not 401.
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    expect((await a.post(`/api/boards/${boardId}`, { data: { action: 'complete' } })).status()).toBe(200);
    const anon = await identity(playwright, baseURL!);
    const res = await anon.post(url(boardId), { data: { description: 'x' } });
    // Documented observed behaviour: state rule wins over identity.
    expect(res.status()).toBe(409);
  });
});

test.describe('action items: input validation', () => {
  const badBodies: Record<string, string> = {
    'truncated JSON': '{"description": ',
    'not JSON': 'hello',
    'JSON array': '[1,2,3]',
    'JSON null': 'null',
    'JSON string': '"x"',
  };

  test('malformed or non-object JSON is 400 on POST, PATCH and DELETE', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const json = { 'content-type': 'application/json' };
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      for (const [label, data] of Object.entries(badBodies)) {
        const res = await a.fetch(url(boardId), { method, headers: json, data });
        expect(res.status(), `${method} ${label}`).toBe(400);
      }
    }
  });

  test('malformed body is 400 even for an unauthenticated caller (validation precedes auth)', async ({ playwright, baseURL }) => {
    const { boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const anon = await identity(playwright, baseURL!);
    const res = await anon.post(url(boardId), { headers: { 'content-type': 'application/json' }, data: 'nope' });
    expect(res.status()).toBe(400);
  });

  test('POST description: missing, empty, whitespace, non-string and 2001+ chars are 400; 1 and 2000 are accepted', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    for (const bad of [undefined, null, '', '   ', 5, {}, ['a'], 'x'.repeat(2001)]) {
      const res = await a.post(url(boardId), { data: { description: bad } });
      expect(res.status(), `description ${JSON.stringify(bad)?.slice(0, 20)}`).toBe(400);
    }
    for (const good of ['x', 'y'.repeat(2000)]) {
      expect((await a.post(url(boardId), { data: { description: good } })).status(), `len ${good.length}`).toBe(200);
    }
    expect(await items(a, boardId)).toHaveLength(2);
  });

  test('POST assignee / dueDate / createdBy must be string or null', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    for (const field of ['assignee', 'dueDate', 'createdBy']) {
      for (const bad of [5, true, {}, ['x']]) {
        const res = await a.post(url(boardId), { data: { description: 'x', [field]: bad } });
        expect(res.status(), `${field}=${JSON.stringify(bad)}`).toBe(400);
      }
      expect((await a.post(url(boardId), { data: { description: 'x', [field]: null } })).status(), `${field}=null`).toBe(200);
    }
  });

  test('PATCH: itemId must be a string and updates a plain object', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(a, boardId);
    const bad: unknown[] = [
      {},
      { itemId: item.id },
      { updates: { status: 'done' } },
      { itemId: 5, updates: { status: 'done' } },
      { itemId: item.id, updates: 'done' },
      { itemId: item.id, updates: null },
      { itemId: item.id, updates: ['done'] },
    ];
    for (const data of bad) {
      expect((await a.patch(url(boardId), { data })).status(), JSON.stringify(data)).toBe(400);
    }
    expect((await items(a, boardId))[0].status).toBe('open');
  });

  test('PATCH status: only open / in_progress / done are accepted; anything else is 400 and unchanged', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(a, boardId);
    for (const bad of ['complete', 'DONE', 'Open', '', ' done', 'in-progress', null, 1, true, {}, ['done']]) {
      const res = await a.patch(url(boardId), { data: { itemId: item.id, updates: { status: bad } } });
      expect(res.status(), `status ${JSON.stringify(bad)}`).toBe(400);
      expect((await res.json()).error).toBe('Invalid status');
    }
    expect((await items(a, boardId))[0].status).toBe('open');
    for (const good of ['in_progress', 'done', 'open']) {
      const res = await a.patch(url(boardId), { data: { itemId: item.id, updates: { status: good } } });
      expect(res.status(), good).toBe(200);
      expect((await items(a, boardId))[0].status).toBe(good);
    }
  });

  test('PATCH description / assignee / due_date are validated; null clears assignee and due_date', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(a, boardId, { assignee: 'Zed', dueDate: '2030-02-02' });
    for (const updates of [{ description: '' }, { description: '  ' }, { description: 5 }, { assignee: 5 }, { due_date: 5 }, { description: 'x'.repeat(2001) }]) {
      expect((await a.patch(url(boardId), { data: { itemId: item.id, updates } })).status(), JSON.stringify(updates).slice(0, 40)).toBe(400);
    }
    const before = (await items(a, boardId))[0];
    expect(before.assignee).toBe('Zed');
    const res = await a.patch(url(boardId), { data: { itemId: item.id, updates: { assignee: null, due_date: null } } });
    expect(res.status()).toBe(200);
    const after = (await items(a, boardId))[0];
    expect(after.assignee).toBeNull();
    expect(after.due_date).toBeNull();
  });

  test('DELETE: itemId must be a string', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(a, boardId);
    for (const data of [{}, { itemId: 5 }, { itemId: null }, { itemId: ['x'] }]) {
      expect((await a.delete(url(boardId), { data })).status(), JSON.stringify(data)).toBe(400);
    }
    expect(await items(a, boardId)).toHaveLength(1);
    expect((await a.delete(url(boardId), { data: { itemId: item.id } })).status()).toBe(200);
  });

  test('unknown board is 404 on every verb', async ({ playwright, baseURL }) => {
    const a = await identity(playwright, baseURL!);
    const nope = `nope${nanoid(6)}`;
    const anyId = '00000000-0000-4000-8000-000000000000'; // well-formed: body validation runs before the board lookup
    expect((await a.post(url(nope), { data: { description: 'x' } })).status()).toBe(404);
    expect((await a.patch(url(nope), { data: { itemId: anyId, updates: { status: 'done' } } })).status()).toBe(404);
    expect((await a.delete(url(nope), { data: { itemId: anyId } })).status()).toBe(404);
  });
});

test.describe('action items: observed edge behaviour', () => {
  // The route UPDATEs by (id, board_id) and then SELECTs the row without checking it exists.
  // A PATCH of a missing / malformed-uuid id is therefore an unhandled case: this test records what
  // the server actually does so a regression (or fix) is visible. It asserts "not a 5xx crash for
  // a well-formed uuid"; the exact code is reported in the QA notes.
  test('PATCH / DELETE of a well-formed but nonexistent item id', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const ghost = '00000000-0000-4000-8000-000000000000';
    const patch = await a.patch(url(boardId), { data: { itemId: ghost, updates: { status: 'done' } } });
    const del = await a.delete(url(boardId), { data: { itemId: ghost } });
    console.log(`[observed] PATCH nonexistent item -> ${patch.status()} ${(await patch.text()).slice(0, 120)}`);
    console.log(`[observed] DELETE nonexistent item -> ${del.status()} ${(await del.text()).slice(0, 120)}`);
    // Intended contract: a missing item is a 404, not a silent 200.
    expect(patch.status(), 'PATCH of a missing item should be 404').toBe(404);
    expect(del.status(), 'DELETE of a missing item should be 404').toBe(404);
  });

  test('PATCH / DELETE with a non-uuid itemId does not crash with a 5xx', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const patch = await a.patch(url(boardId), { data: { itemId: 'not-a-uuid', updates: { status: 'done' } } });
    const del = await a.delete(url(boardId), { data: { itemId: 'not-a-uuid' } });
    console.log(`[observed] PATCH non-uuid -> ${patch.status()}; DELETE non-uuid -> ${del.status()}`);
    expect(patch.status(), 'PATCH non-uuid id should be 4xx').toBeLessThan(500);
    expect(del.status(), 'DELETE non-uuid id should be 4xx').toBeLessThan(500);
  });

  test('a PATCH with an empty updates object is a no-op 200', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const item = await addItem(a, boardId);
    const res = await a.patch(url(boardId), { data: { itemId: item.id, updates: {} } });
    expect(res.status()).toBe(200);
    expect((await res.json()).item.id).toBe(item.id);
  });
});

test.describe('action items: what each viewer can READ (board GET)', () => {
  test('documented behaviour: actionItems are NOT shaped; anonymous, participant and facilitator all receive every item with created_by', async ({ playwright, baseURL }) => {
    const { a, b, aId, bId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const byA = await addItem(a, boardId, { assignee: 'Alice', dueDate: '2030-03-03' });
    const byB = await addItem(b, boardId);
    const anon = await identity(playwright, baseURL!);

    for (const [label, ctx] of [['anonymous', anon], ['participant', b], ['facilitator', a]] as const) {
      const got = await items(ctx, boardId);
      expect(got.map((i) => i.id).sort(), label).toEqual([byA.id, byB.id].sort());
      const a1 = got.find((i) => i.id === byA.id)!;
      expect(a1, label).toMatchObject({ description: byA.description, assignee: 'Alice', created_by: aId });
      expect(got.find((i) => i.id === byB.id)!.created_by, label).toBe(bId);
    }
  });

  test('a viewer with a forged cookie reads the same items (read path has no auth; board is addressable by id)', async ({ playwright, baseURL }) => {
    const { a, aId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    await addItem(a, boardId);
    const forged = await withRawCookie(playwright, baseURL!, `rb_ps_${boardId}`, aId);
    contexts.push(forged);
    expect(await items(forged, boardId)).toHaveLength(1);
  });
});

test.describe('v1 (legacy) board: action items', () => {
  test('no cookie required; body createdBy is stored; locked and completed still 409', async ({ playwright, baseURL }) => {
    // action_items.created_by is a FK to participants.id, so a legacy client's body id must be a real
    // participant row. Create the participant while the board is still v2, then flip it to v1.
    const owner = await identity(playwright, baseURL!);
    const { boardId } = await createBoard(owner);
    const legacyId: string = (await (await apiJoin(owner, boardId, 'Legacy Larry')).json()).participant.id;
    await makeLegacyV1(boardId);
    expect((await getBoard(owner, boardId)).board.trust_version).toBe(1);

    const anon = await identity(playwright, baseURL!);
    const created = await anon.post(url(boardId), { data: { description: 'legacy item', createdBy: legacyId, assignee: 'L' } });
    expect(created.status()).toBe(200);
    const item = (await created.json()).item;
    expect(item).toMatchObject({ description: 'legacy item', created_by: legacyId, status: 'open' });

    // Create without createdBy stores null on v1.
    const noId = await anon.post(url(boardId), { data: { description: 'anon item' } });
    expect(noId.status()).toBe(200);
    expect((await noId.json()).item.created_by).toBeNull();

    // Update and delete need no identity on v1, and status validation still applies.
    expect((await anon.patch(url(boardId), { data: { itemId: item.id, updates: { status: 'done' } } })).status()).toBe(200);
    expect((await anon.patch(url(boardId), { data: { itemId: item.id, updates: { status: 'bogus' } } })).status()).toBe(400);
    expect((await items(anon, boardId)).find((i) => i.id === item.id)!.status).toBe('done');

    // Lock: v1 has no facilitator-from-body, so everyone anonymous gets 409.
    await legacyUpdate(boardId, { settingsPatch: { board_locked: true } });
    expect((await anon.post(url(boardId), { data: { description: 'x', createdBy: legacyId } })).status()).toBe(409);
    expect((await anon.patch(url(boardId), { data: { itemId: item.id, updates: { status: 'open' } } })).status()).toBe(409);
    expect((await anon.delete(url(boardId), { data: { itemId: item.id } })).status()).toBe(409);
    await legacyUpdate(boardId, { settingsPatch: { board_locked: false } });

    // Delete works while open, then completion blocks everything.
    expect((await anon.delete(url(boardId), { data: { itemId: item.id } })).status()).toBe(200);
    await legacyUpdate(boardId, { archived: true });
    expect((await anon.post(url(boardId), { data: { description: 'late' } })).status()).toBe(409);
    expect((await anon.delete(url(boardId), { data: { itemId: (await items(anon, boardId))[0].id } })).status()).toBe(409);
  });

  test('v1: a createdBy that is not a participant is a 4xx, not a 500', async ({ playwright, baseURL }) => {
    const owner = await identity(playwright, baseURL!);
    const { boardId } = await createBoard(owner);
    await makeLegacyV1(boardId);
    const res = await owner.post(url(boardId), { data: { description: 'x', createdBy: 'legacy-author-1' } });
    console.log(`[observed] v1 unknown createdBy -> ${res.status()}`);
    expect(res.status()).toBeLessThan(500);
  });

  test('v1 malformed bodies are still 400', async ({ playwright, baseURL }) => {
    const owner = await identity(playwright, baseURL!);
    const { boardId } = await createBoard(owner);
    await makeLegacyV1(boardId);
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const res = await owner.fetch(url(boardId), { method, headers: { 'content-type': 'application/json' }, data: '[1]' });
      expect(res.status(), method).toBe(400);
    }
  });
});
