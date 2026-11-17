import { test, expect, type APIRequestContext } from '@playwright/test';
import Ably from 'ably';
import { nanoid } from 'nanoid';
import {
  createBoard,
  apiJoin,
  getBoard,
  newCardBody,
  makeLegacyV1,
  legacyUpdate,
  cookieValue,
  withRawCookie,
  cardUpdatedAt,
} from './helpers';

const contexts: APIRequestContext[] = [];

test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.dispose()));
});

/** One cookie jar per identity. */
async function identity(playwright: import('@playwright/test').PlaywrightWorkerArgs['playwright'], baseURL: string) {
  const ctx = await playwright.request.newContext({ baseURL });
  contexts.push(ctx);
  return ctx;
}

/** A board whose creator (A) has joined as facilitator and a second person (B) has joined. */
async function boardWithAliceAndBob(
  playwright: import('@playwright/test').PlaywrightWorkerArgs['playwright'],
  baseURL: string,
  settings: Record<string, unknown> = {}
) {
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

test.describe('v2 board: identity comes from the signed cookie only', () => {
  test('join ignores isAdmin / is_admin / participantId in the body', async ({ playwright, baseURL }) => {
    const { a, b, aId, bId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const c = await identity(playwright, baseURL!);
    const res = await apiJoin(c, boardId, 'Mallory', { isAdmin: true, is_admin: true, participantId: aId });
    expect(res.status()).toBe(200);
    const { participant } = await res.json();
    expect(participant.is_admin).toBe(false);
    expect(participant.id).not.toBe(aId);

    const view = await getBoard(c, boardId);
    expect(view.youAre).toMatchObject({ participantId: participant.id, isFacilitator: false, joined: true });
    expect((await getBoard(b, boardId)).youAre.isFacilitator).toBe(false);
    expect(bId).not.toBe(aId);
    // Alice is untouched.
    expect((await getBoard(a, boardId)).youAre).toMatchObject({ participantId: aId, isFacilitator: true });
  });

  test('B cannot edit or delete A\'s card, and may edit their own', async ({ playwright, baseURL }) => {
    const { a, b, boardId, columnId } = await boardWithAliceAndBob(playwright, baseURL!, { card_visibility: 'visible' });
    const body = newCardBody(columnId, 'alice card');
    expect((await a.post(`/api/boards/${boardId}/cards`, { data: body })).status()).toBe(200);

    const edit = await b.patch(`/api/boards/${boardId}/cards`, { data: { cardId: body.id, updates: { text: 'pwned' } } });
    expect(edit.status()).toBe(403);
    const del = await b.delete(`/api/boards/${boardId}/cards`, { data: { cardId: body.id } });
    expect(del.status()).toBe(403);
    const still = (await getBoard(a, boardId)).cards.find((c: { id: string }) => c.id === body.id);
    expect(still.text).toBe('alice card');

    const own = newCardBody(columnId, 'bob card');
    expect((await b.post(`/api/boards/${boardId}/cards`, { data: own })).status()).toBe(200);
    const ownEdit = await b.patch(`/api/boards/${boardId}/cards`, { data: { cardId: own.id, updates: { text: 'bob edited' } } });
    expect(ownEdit.status()).toBe(200);
  });

  test('B cannot make themselves admin, remove A, or add a column', async ({ playwright, baseURL }) => {
    const { a, b, aId, bId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const promote = await b.patch(`/api/boards/${boardId}/participants`, {
      data: { participantId: bId, updates: { is_admin: true } },
    });
    expect(promote.status()).toBe(403);
    const remove = await b.delete(`/api/boards/${boardId}/participants`, { data: { participantId: aId } });
    expect(remove.status()).toBe(403);
    const column = await b.post(`/api/boards/${boardId}/columns`, {
      data: { id: nanoid(10), title: 'evil', color: '#000', position: 9 },
    });
    expect(column.status()).toBe(403);
    // B cannot change board settings either.
    const settings = await b.patch(`/api/boards/${boardId}`, { data: { settings: { card_visibility: 'visible' } } });
    expect(settings.status()).toBe(403);

    const view = await getBoard(a, boardId);
    expect(view.participants.map((p: { id: string }) => p.id)).toContain(aId);
    expect(view.participants.find((p: { id: string }) => p.id === bId).is_admin).toBe(false);
    expect(view.columns).toHaveLength(1);
    // The facilitator, by contrast, may add a column.
    const ok = await a.post(`/api/boards/${boardId}/columns`, {
      data: { id: nanoid(10), title: 'ok', color: '#000', position: 2 },
    });
    expect(ok.status()).toBe(200);
  });

  test('no cookie: card POST is 401; foreign-board cookie is 401', async ({ playwright, baseURL }) => {
    const { b, boardId, columnId } = await boardWithAliceAndBob(playwright, baseURL!);
    const anon = await identity(playwright, baseURL!);
    const res = await anon.post(`/api/boards/${boardId}/cards`, { data: newCardBody(columnId) });
    expect(res.status()).toBe(401);

    // Bob's genuine cookie for THIS board, but another board is targeted.
    const other = await boardWithAliceAndBob(playwright, baseURL!);
    const bobsCookie = (await cookieValue(b, boardId))!;
    expect(bobsCookie).toBeTruthy();
    // Present it under the other board's cookie name: signed for a different board.
    const foreign = await withRawCookie(playwright, baseURL!, `rb_ps_${other.boardId}`, bobsCookie);
    contexts.push(foreign);
    const res2 = await foreign.post(`/api/boards/${other.boardId}/cards`, { data: newCardBody(other.columnId) });
    expect(res2.status()).toBe(401);
    const view = await getBoard(foreign, other.boardId);
    expect(view.youAre).toMatchObject({ participantId: null, joined: false, isFacilitator: false });
  });

  test('a forged or tampered rb_ps_ cookie is no session (401)', async ({ playwright, baseURL }) => {
    const { a, aId, boardId, columnId } = await boardWithAliceAndBob(playwright, baseURL!);
    const good = (await cookieValue(a, boardId))!;
    const [pid, iat, sig] = [good.slice(0, good.lastIndexOf('.', good.lastIndexOf('.') - 1)), good.split('.').slice(-2)[0], good.split('.').slice(-1)[0]];
    expect(pid).toBe(aId);
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
    const forgeries: Record<string, string> = {
      'flipped signature char': `${pid}.${iat}.${flipped}`,
      'unsigned participant id': aId,
      'empty signature': `${pid}.${iat}.`,
      'garbage': 'not-a-cookie',
      'newer timestamp, old signature': `${pid}.${Number(iat) + 5}.${sig}`,
    };
    for (const [label, value] of Object.entries(forgeries)) {
      const forged = await withRawCookie(playwright, baseURL!, `rb_ps_${boardId}`, value);
      contexts.push(forged);
      const res = await forged.post(`/api/boards/${boardId}/cards`, { data: newCardBody(columnId) });
      expect(res.status(), label).toBe(401);
      const view = await getBoard(forged, boardId);
      expect(view.youAre.joined, label).toBe(false);
      expect(view.youAre.isFacilitator, label).toBe(false);
    }
    // Control: the untampered cookie works.
    const control = await withRawCookie(playwright, baseURL!, `rb_ps_${boardId}`, good);
    contexts.push(control);
    expect((await control.post(`/api/boards/${boardId}/cards`, { data: newCardBody(columnId) })).status()).toBe(200);
  });

  test('vote with a forged voterId is recorded for the cookie participant', async ({ playwright, baseURL }) => {
    const { a, b, aId, bId, boardId, columnId } = await boardWithAliceAndBob(playwright, baseURL!, {
      voting_enabled: true,
      card_visibility: 'visible',
    });
    const card = newCardBody(columnId);
    expect((await a.post(`/api/boards/${boardId}/cards`, { data: card })).status()).toBe(200);
    const vote = await b.post(`/api/boards/${boardId}/votes`, { data: { cardId: card.id, voterId: aId } });
    expect(vote.status()).toBe(200);
    const json = await vote.json();
    expect(json.vote.voter_id).toBe(bId);
    const view = await getBoard(a, boardId);
    expect(view.votes.map((v: { voter_id: string }) => v.voter_id)).toEqual([bId]);

    // A second identical request toggles Bob's own vote off, it never touches Alice's.
    expect((await a.post(`/api/boards/${boardId}/votes`, { data: { cardId: card.id } })).status()).toBe(200);
    const removed = await b.post(`/api/boards/${boardId}/votes`, { data: { cardId: card.id, voterId: aId } });
    expect((await removed.json()).action).toBe('removed');
    const after = (await getBoard(a, boardId)).votes.map((v: { voter_id: string }) => v.voter_id);
    expect(after).toEqual([aId]);
  });

  test('reactions: another participant\'s id in the submitted map is ignored, your own is applied', async ({ playwright, baseURL }) => {
    const { a, b, aId, bId, boardId, columnId } = await boardWithAliceAndBob(playwright, baseURL!, { card_visibility: 'visible' });
    const card = newCardBody(columnId);
    expect((await a.post(`/api/boards/${boardId}/cards`, { data: card })).status()).toBe(200);
    const stored = async (viewer: APIRequestContext) =>
      (await getBoard(viewer, boardId)).cards.find((c: { id: string }) => c.id === card.id).reactions;

    // Forged: Bob submits only Alice's id. Accepted, but nothing is stored for Alice, and Bob gains nothing.
    const forged = await b.patch(`/api/boards/${boardId}/cards`, {
      data: { cardId: card.id, updates: { reactions: { '👍': [aId] } } },
    });
    expect(forged.status()).toBe(200);
    expect(await stored(a)).toEqual({});

    // Forged plus own: only Bob's own id lands.
    const both = await b.patch(`/api/boards/${boardId}/cards`, {
      data: { cardId: card.id, updates: { reactions: { '👍': [aId, bId], '🎉': [aId] } } },
    });
    expect(both.status()).toBe(200);
    expect(await stored(a)).toEqual({ '👍': [bId] });
    expect(await stored(b)).toEqual({ '👍': [bId] });

    // Alice really reacts; Bob then submits a map that forges Alice under a second emoji.
    expect((await a.patch(`/api/boards/${boardId}/cards`, {
      data: { cardId: card.id, updates: { reactions: { '👍': [bId, aId] } } },
    })).status()).toBe(200);
    expect((await b.patch(`/api/boards/${boardId}/cards`, {
      data: { cardId: card.id, updates: { reactions: { '👍': [bId], '❤️': [aId] } } },
    })).status()).toBe(200);
    // Alice's real reaction is untouched, no forged entry appeared, Bob's own is kept.
    expect(await stored(a)).toEqual({ '👍': [bId, aId] });
  });

  test('card PATCH with no recognised updates is 400 and writes nothing, even on a completed board', async ({ playwright, baseURL }) => {
    const { a, boardId, columnId } = await boardWithAliceAndBob(playwright, baseURL!, { card_visibility: 'visible' });
    const anon = await identity(playwright, baseURL!);
    const card = newCardBody(columnId);
    expect((await a.post(`/api/boards/${boardId}/cards`, { data: card })).status()).toBe(200);
    const before = await cardUpdatedAt(boardId, card.id);
    expect(before).not.toBeNull();

    for (const updates of [{}, { unknown_field: 1 }]) {
      const res = await anon.patch(`/api/boards/${boardId}/cards`, { data: { cardId: card.id, updates } });
      expect(res.status()).toBe(400);
      expect(typeof (await res.json()).error).toBe('string');
    }
    expect(await cardUpdatedAt(boardId, card.id)).toBe(before);

    expect((await a.post(`/api/boards/${boardId}`, { data: { action: 'complete' } })).status()).toBe(200);
    const done = await anon.patch(`/api/boards/${boardId}/cards`, { data: { cardId: card.id, updates: {} } });
    expect(done.status()).toBe(400);
    expect(await cardUpdatedAt(boardId, card.id)).toBe(before);
  });

  test('after complete: card POST is 409, votes are 409, and the board is read-only', async ({ playwright, baseURL }) => {
    const { a, b, boardId, columnId } = await boardWithAliceAndBob(playwright, baseURL!, { voting_enabled: true });
    const done = await a.post(`/api/boards/${boardId}`, { data: { action: 'complete' } });
    expect(done.status()).toBe(200);
    const res = await b.post(`/api/boards/${boardId}/cards`, { data: newCardBody(columnId) });
    expect(res.status()).toBe(409);
    // The facilitator is blocked too: completed means completed.
    const res2 = await a.post(`/api/boards/${boardId}/cards`, { data: newCardBody(columnId) });
    expect(res2.status()).toBe(409);
    // Completing twice is also a state conflict.
    expect((await a.post(`/api/boards/${boardId}`, { data: { action: 'complete' } })).status()).toBe(409);
    // A non-facilitator cannot complete a board.
    const open = await boardWithAliceAndBob(playwright, baseURL!);
    expect((await open.b.post(`/api/boards/${open.boardId}`, { data: { action: 'complete' } })).status()).toBe(403);
  });

  test('locked / voting-off / card-creation-off give 409 to a participant, not to the facilitator', async ({ playwright, baseURL }) => {
    const { a, b, boardId, columnId } = await boardWithAliceAndBob(playwright, baseURL!, {
      board_locked: true,
      voting_enabled: false,
    });
    expect((await b.post(`/api/boards/${boardId}/cards`, { data: newCardBody(columnId) })).status()).toBe(409);
    expect((await a.post(`/api/boards/${boardId}/cards`, { data: newCardBody(columnId) })).status()).toBe(200);

    const card = newCardBody(columnId);
    expect((await a.post(`/api/boards/${boardId}/cards`, { data: card })).status()).toBe(200);
    // Voting is off for everyone, including the facilitator.
    expect((await a.post(`/api/boards/${boardId}/votes`, { data: { cardId: card.id } })).status()).toBe(409);

    const off = await boardWithAliceAndBob(playwright, baseURL!, { card_creation_disabled: true });
    expect((await off.b.post(`/api/boards/${off.boardId}/cards`, { data: newCardBody(off.columnId) })).status()).toBe(409);
  });
});

test.describe('v2 board: creator claim', () => {
  test('creation sets a signed httpOnly cookie even with no participant; the cookie claims the facilitator seat', async ({ playwright, baseURL }) => {
    const creator = await identity(playwright, baseURL!);
    const board = await createBoard(creator);
    expect(board.participantId).toBeNull();

    const state = await creator.storageState();
    const cookie = state.cookies.find((c) => c.name === `rb_ps_${board.boardId}`);
    expect(cookie, 'rb_ps_{boardId} cookie').toBeTruthy();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Lax');
    expect(cookie!.value.split('.')).toHaveLength(3);

    // Before joining the cookie is only a claim: no participant row, not a facilitator yet.
    const before = await getBoard(creator, board.boardId);
    expect(before.youAre).toMatchObject({ participantId: null, joined: false, isFacilitator: false });

    const join = await apiJoin(creator, board.boardId, 'Creator');
    expect(join.status()).toBe(200);
    const { participant } = await join.json();
    expect(participant.is_admin).toBe(true);
    const after = await getBoard(creator, board.boardId);
    expect(after.youAre).toMatchObject({ participantId: participant.id, isFacilitator: true, joined: true });
    expect(after.board.created_by).toBe(participant.id);

    // Joining again with the same cookie reuses the participant (no duplicate).
    const again = await apiJoin(creator, board.boardId, 'Creator Renamed');
    expect((await again.json()).reused).toBe(true);
    expect((await getBoard(creator, board.boardId)).participants).toHaveLength(1);
  });

  test('a cookie-less second joiner is not a facilitator and cannot claim the seat via the body', async ({ playwright, baseURL }) => {
    const creator = await identity(playwright, baseURL!);
    const second = await identity(playwright, baseURL!);
    const board = await createBoard(creator);
    // Learn the creator id the only way an attacker could: from the public board payload.
    const creatorId: string = (await getBoard(second, board.boardId)).board.created_by;
    expect(creatorId).toBeTruthy();

    // Second joins BEFORE the creator has claimed, sending every hint it can.
    const joinSecond = await apiJoin(second, board.boardId, 'Second', {
      is_admin: true,
      isAdmin: true,
      participantId: creatorId,
      id: creatorId,
    });
    expect(joinSecond.status()).toBe(200);
    const { participant } = await joinSecond.json();
    expect(participant.is_admin).toBe(false);
    expect(participant.id).not.toBe(creatorId);
    expect((await getBoard(second, board.boardId)).youAre.isFacilitator).toBe(false);
    expect((await second.post(`/api/boards/${board.boardId}/columns`, {
      data: { id: nanoid(10), title: 'x', color: '#000', position: 5 },
    })).status()).toBe(403);

    // The real creator can still claim afterwards.
    const joinCreator = await apiJoin(creator, board.boardId, 'Creator');
    expect(joinCreator.status()).toBe(200);
    const created = (await joinCreator.json()).participant;
    expect(created.is_admin).toBe(true);
    expect(created.id).toBe(creatorId);
    expect((await getBoard(second, board.boardId)).youAre.isFacilitator).toBe(false);
  });

  test('a promoted facilitator cannot demote or remove the creator', async ({ playwright, baseURL }) => {
    const { a, b, aId, bId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const promote = await a.patch(`/api/boards/${boardId}/participants`, {
      data: { participantId: bId, updates: { is_admin: true } },
    });
    expect(promote.status()).toBe(200);
    expect((await getBoard(b, boardId)).youAre.isFacilitator).toBe(true);

    const demote = await b.patch(`/api/boards/${boardId}/participants`, {
      data: { participantId: aId, updates: { is_admin: false } },
    });
    expect(demote.status()).toBe(403);
    const remove = await b.delete(`/api/boards/${boardId}/participants`, { data: { participantId: aId } });
    expect(remove.status()).toBe(403);

    const view = await getBoard(a, boardId);
    const alice = view.participants.find((p: { id: string }) => p.id === aId);
    expect(alice).toBeTruthy();
    expect(alice.is_admin).toBe(true);
    expect(view.youAre.isFacilitator).toBe(true);
    // The promoted facilitator can still be demoted by the creator.
    const back = await a.patch(`/api/boards/${boardId}/participants`, {
      data: { participantId: bId, updates: { is_admin: false } },
    });
    expect(back.status()).toBe(200);
  });
});

test.describe('input validation', () => {
  const badBodies: Record<string, string> = {
    'truncated JSON': '{"displayName": ',
    'not JSON': 'hello',
    'JSON array': '[1,2,3]',
    'JSON null': 'null',
    'JSON string': '"x"',
  };

  test('malformed or non-object JSON bodies are 400 on every write route', async ({ playwright, baseURL }) => {
    const { a, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const json = { 'content-type': 'application/json' };
    const targets: Array<[string, string]> = [
      ['POST', '/api/boards'],
      ['POST', `/api/boards/${boardId}/join`],
      ['POST', `/api/boards/${boardId}/cards`],
      ['PATCH', `/api/boards/${boardId}/cards`],
      ['DELETE', `/api/boards/${boardId}/cards`],
      ['POST', `/api/boards/${boardId}/votes`],
      ['POST', `/api/boards/${boardId}/columns`],
      ['PATCH', `/api/boards/${boardId}/participants`],
      ['DELETE', `/api/boards/${boardId}/participants`],
      ['PATCH', `/api/boards/${boardId}`],
      ['POST', `/api/boards/${boardId}`],
    ];
    for (const [method, url] of targets) {
      for (const [label, data] of Object.entries(badBodies)) {
        const res = await a.fetch(url, { method, headers: json, data });
        expect(res.status(), `${method} ${url} with ${label}`).toBe(400);
      }
    }
  });

  test('display name: 0, whitespace-only and 51+ chars are rejected; 1 and 50 are accepted', async ({ playwright, baseURL }) => {
    const creator = await identity(playwright, baseURL!);
    const { boardId } = await createBoard(creator);
    for (const bad of ['', '   ', 'x'.repeat(51), 'x'.repeat(500)]) {
      const j = await identity(playwright, baseURL!);
      expect((await apiJoin(j, boardId, bad)).status(), `len ${bad.length}`).toBe(400);
    }
    for (const bad of [undefined, null, 5, {}, ['a']]) {
      const j = await identity(playwright, baseURL!);
      const res = await j.post(`/api/boards/${boardId}/join`, { data: { displayName: bad } });
      expect(res.status(), JSON.stringify(bad)).toBe(400);
    }
    for (const good of ['x', 'y'.repeat(50)]) {
      const j = await identity(playwright, baseURL!);
      expect((await apiJoin(j, boardId, good)).status(), `len ${good.length}`).toBe(200);
    }
    // No participant rows were created by the rejected attempts.
    expect((await getBoard(creator, boardId)).participants).toHaveLength(2);
  });

  test('board creation rejects a bad creator display name', async ({ playwright, baseURL }) => {
    for (const bad of ['', 'x'.repeat(51)]) {
      const c = await identity(playwright, baseURL!);
      const res = await c.post('/api/boards', {
        data: {
          id: `bad${Date.now() % 100000}`,
          title: 'e2e bad name',
          description: null,
          template: 'x',
          settings: {},
          columns: [],
          participant: { displayName: bad },
        },
      });
      expect(res.status(), `len ${bad.length}`).toBe(400);
    }
  });
});

test.describe('ably token route', () => {
  test('v2: not joined is 401; unknown board 404; missing boardId 400', async ({ playwright, baseURL }) => {
    const creator = await identity(playwright, baseURL!);
    const { boardId } = await createBoard(creator);
    const stranger = await identity(playwright, baseURL!);
    expect((await stranger.get(`/api/ably-token?boardId=${boardId}&clientId=anything`)).status()).toBe(401);
    // The creator's claim cookie is not a participant until they join.
    expect((await creator.get(`/api/ably-token?boardId=${boardId}&clientId=anything`)).status()).toBe(401);
    expect((await stranger.get('/api/ably-token?boardId=doesnotexist')).status()).toBe(404);
    expect((await stranger.get('/api/ably-token')).status()).toBe(400);
  });

  test('v2: joined token is bound to the cookie participant and cannot publish on the main channel', async ({ playwright, baseURL }) => {
    const { b, bId, boardId } = await boardWithAliceAndBob(playwright, baseURL!);
    const res = await b.get(`/api/ably-token?boardId=${boardId}&clientId=forged-client-id`);
    expect(res.status()).toBe(200);
    const tokenRequest = await res.json();
    expect(tokenRequest.clientId).toBe(bId);
    const capability = JSON.parse(tokenRequest.capability);
    expect(Object.keys(capability).sort()).toEqual([`retro-board:${boardId}`, `retro-board:${boardId}:timer`].sort());
    expect(capability[`retro-board:${boardId}`].sort()).toEqual(['presence', 'subscribe']);
    expect(capability[`retro-board:${boardId}`]).not.toContain('publish');

    // Black box: a real Ably client holding this token is refused when it publishes.
    const rest = new Ably.Rest({ authCallback: (_params, cb) => cb(null, tokenRequest) });
    const main = rest.channels.get(`retro-board:${boardId}`);
    await expect(main.publish('card-created', { card: { id: 'forged' } })).rejects.toMatchObject({ code: 40160 });
    // And it cannot publish onto some other board's channel either.
    const other = rest.channels.get('retro-board:someotherboard');
    await expect(other.publish('card-created', {})).rejects.toMatchObject({ code: 40160 });

    // Bob's cookie says nothing about a different board.
    const elsewhere = await boardWithAliceAndBob(playwright, baseURL!);
    expect((await b.get(`/api/ably-token?boardId=${elsewhere.boardId}`)).status()).toBe(401);
  });
});

test.describe('v1 (legacy) board', () => {
  test('state guards apply, identity comes from the body, and nothing 500s', async ({ playwright, baseURL }) => {
    const anon = await identity(playwright, baseURL!);
    const { boardId, columnId } = await createBoard(anon, { settings: { voting_enabled: true, card_visibility: 'visible' } });
    await makeLegacyV1(boardId);

    // Loads for a viewer with no cookie, and does not shape anything away.
    const view = await getBoard(await identity(playwright, baseURL!), boardId);
    expect(view.board.trust_version).toBe(1);

    // A card POST with body ids and no cookie is accepted and keeps the claimed author.
    const body = { ...newCardBody(columnId, 'v1 card'), authorId: 'legacy-author-1', authorName: 'Legacy Larry' };
    const res = await (await identity(playwright, baseURL!)).post(`/api/boards/${boardId}/cards`, { data: body });
    expect(res.status()).toBe(200);
    const card = (await res.json()).card;
    expect(card).toMatchObject({ text: 'v1 card', author_id: 'legacy-author-1', author_name: 'Legacy Larry' });
    const shown = (await getBoard(anon, boardId)).cards.find((c: { id: string }) => c.id === body.id);
    expect(shown.text).toBe('v1 card');
    expect(shown.author_name).toBe('Legacy Larry');

    // Votes use the body's voterId on v1.
    const vote = await anon.post(`/api/boards/${boardId}/votes`, { data: { cardId: body.id, voterId: 'legacy-voter-1' } });
    expect(vote.status()).toBe(200);
    expect((await vote.json()).vote.voter_id).toBe('legacy-voter-1');
    expect((await anon.post(`/api/boards/${boardId}/votes`, { data: { cardId: body.id } })).status()).toBe(400);

    // Legacy ably token: the query clientId is still used.
    const token = await anon.get(`/api/ably-token?boardId=${boardId}&clientId=legacy-voter-1`);
    expect(token.status()).toBe(200);
    expect((await token.json()).clientId).toBe('legacy-voter-1');

    // Locked: 409.
    await legacyUpdate(boardId, { settingsPatch: { board_locked: true } });
    const locked = await anon.post(`/api/boards/${boardId}/cards`, {
      data: { ...newCardBody(columnId), authorId: 'legacy-author-1', authorName: 'Legacy Larry' },
    });
    expect(locked.status()).toBe(409);

    // Completed: 409, including card edits and votes.
    await legacyUpdate(boardId, { settingsPatch: { board_locked: false } });
    await legacyUpdate(boardId, { archived: true });
    const done = await anon.post(`/api/boards/${boardId}/cards`, {
      data: { ...newCardBody(columnId), authorId: 'legacy-author-1', authorName: 'Legacy Larry' },
    });
    expect(done.status()).toBe(409);
    const doneVote = await anon.post(`/api/boards/${boardId}/votes`, { data: { cardId: body.id, voterId: 'legacy-voter-2' } });
    expect(doneVote.status()).toBe(409);
    const doneEdit = await anon.patch(`/api/boards/${boardId}/cards`, { data: { cardId: body.id, updates: { text: 'late' } } });
    expect(doneEdit.status()).toBe(409);
  });
});
