import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useBoardStore } from '@/stores/boardStore';
import { useGroupVoteStore, applyVoteTallyEvent } from '@/stores/groupVoteStore';
import { phaseSettings } from '@/lib/phases';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import type { Board, Card, Vote } from '@/types';

type FetchCall = [string, RequestInit | undefined];

function board(over: Partial<Board> = {}): Board {
  return {
    id: 'b1',
    title: 'T',
    description: null,
    template: 'start-stop-continue',
    settings: {
      ...DEFAULT_BOARD_SETTINGS,
      ...phaseSettings('vote'),
      max_votes_per_participant: 5,
      max_votes_per_card: 3,
    },
    created_at: '2026-01-01T00:00:00Z',
    archived_at: null,
    trust_version: 2,
    mode: 'guided',
    phase: 'vote',
    phase_config: { deadline: null },
    ...over,
  } as unknown as Board;
}

function cardFixture(id: string): Card {
  return {
    id, column_id: 'col1', board_id: 'b1', text: id, author_name: null, author_id: null, color: null,
    position: 0, merged_with: null, group_title: null, reactions: {},
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const store = new Map<string, string>();
let fetchMock: ReturnType<typeof vi.fn>;

function routes(map: Record<string, () => Response>) {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.split('?')[0]}`;
    const handler = map[key];
    if (!handler) throw new Error(`unexpected fetch ${key}`);
    return handler();
  });
  vi.stubGlobal('fetch', fetchMock);
}

const baseGet = (b: Board, extra: Record<string, unknown> = {}) => ({
  board: b, columns: [], cards: [], votes: [], actionItems: [], participants: [],
  youAre: { participantId: null, isFacilitator: false, joined: false },
  youCanFacilitate: false, access: 'open', ...extra,
});
const getBoardResponse = (b: Board, extra: Record<string, unknown> = {}) => () => json(200, baseGet(b, extra));

const calls = () => (fetchMock.mock.calls as FetchCall[]).map((c) => `${c[1]?.method ?? 'GET'} ${String(c[0]).split('?')[0]}`);
const vote = (count: number, id = 'v1'): Vote =>
  ({ id, card_id: 'c1', board_id: 'b1', voter_id: 'p1', count, created_at: 'x' }) as Vote;

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  useBoardStore.getState().reset();
  useBoardStore.setState({
    board: board(), currentParticipantId: 'p1', cards: [cardFixture('c1'), cardFixture('c2')],
  });
  useGroupVoteStore.setState({ resetting: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('guided votes', () => {
  it('addVote shows the vote at once, posts add, then applies the server count and tally', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useGroupVoteStore.getState().addVote('c1');
    expect(useBoardStore.getState().votes).toEqual([expect.objectContaining({ card_id: 'c1', count: 1 })]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ cardId: 'c1', action: 'add' });
    d.resolve(json(200, { action: 'added', vote: vote(1), tally: { used: 1, at: 10 } }));
    await p;
    expect(useBoardStore.getState().votes).toEqual([vote(1)]);
    expect(useBoardStore.getState().voteTally).toEqual({ used: 1, at: 10 });
  });

  it('two quick adds whose answers arrive out of order settle on the newer server count', async () => {
    const first = deferred<Response>(); const second = deferred<Response>();
    fetchMock = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise); vi.stubGlobal('fetch', fetchMock);
    const a = useGroupVoteStore.getState().addVote('c1');
    const b = useGroupVoteStore.getState().addVote('c1');
    second.resolve(json(200, { action: 'added', vote: vote(2), tally: { used: 2, at: 20 } }));
    await b;
    expect(useBoardStore.getState().votes[0].count).toBe(2); // first still pending: optimistic stays
    first.resolve(json(200, { action: 'added', vote: vote(1), tally: { used: 1, at: 10 } }));
    await a;
    expect(useBoardStore.getState().votes[0].count).toBe(2);
    expect(useBoardStore.getState().voteTally).toEqual({ used: 2, at: 20 });
  });

  it('a refused add reverses only its own delta and rejects with the server message', async () => {
    useBoardStore.setState({ votes: [vote(3)] });
    routes({
      'POST /api/boards/b1/votes': () => json(422, { error: 'You can put at most 3 votes on one card', maxVotesPerCard: 3 }),
      'GET /api/boards/b1': getBoardResponse(board(), { votes: [vote(3)] }),
    });
    useBoardStore.setState({ board: board({ settings: { ...useBoardStore.getState().board!.settings, max_votes_per_card: 4 } }) });
    await expect(useGroupVoteStore.getState().addVote('c1')).rejects.toThrow('You can put at most 3 votes on one card');
    expect(useBoardStore.getState().votes).toEqual([vote(3)]);
    expect(useBoardStore.getState().lastWriteError).toBe('You can put at most 3 votes on one card');
    expect(calls()).toEqual(['POST /api/boards/b1/votes', 'GET /api/boards/b1']);
  });

  it('addVote at the per-card limit sends nothing', async () => {
    useBoardStore.setState({ votes: [vote(3)] });
    routes({});
    await useGroupVoteStore.getState().addVote('c1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('addVote with no votes left, on a card inside a group, or without a participant sends nothing', async () => {
    routes({});
    useBoardStore.setState({ votes: [{ ...vote(5), card_id: 'c2' }] });
    await useGroupVoteStore.getState().addVote('c1');
    useBoardStore.setState({ votes: [], cards: [cardFixture('c1'), { ...cardFixture('c2'), merged_with: 'c1' }] });
    await useGroupVoteStore.getState().addVote('c2');
    useBoardStore.setState({ currentParticipantId: null, cards: [cardFixture('c1')] });
    await useGroupVoteStore.getState().addVote('c1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an answer for a board the user has left changes nothing', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useGroupVoteStore.getState().addVote('c1');
    useBoardStore.setState({ board: board({ id: 'b2' }), votes: [] });
    d.resolve(json(200, { action: 'added', vote: vote(1), tally: { used: 1, at: 10 } }));
    await p;
    expect(useBoardStore.getState().votes).toEqual([]);
    expect(useBoardStore.getState().voteTally).toBeNull();
  });

  it('a failure for a board the user has left does not reverse anything on the new board', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useGroupVoteStore.getState().addVote('c1');
    useBoardStore.setState({ board: board({ id: 'b2' }), votes: [{ ...vote(2), board_id: 'b2' }] });
    d.resolve(json(422, { error: 'Vote limit reached' }));
    await expect(p).rejects.toThrow('Vote limit reached');
    expect(useBoardStore.getState().votes).toEqual([{ ...vote(2), board_id: 'b2' }]);
  });

  it('removeVote of the last vote removes the row; toggleGuidedVote picks add or remove', async () => {
    useBoardStore.setState({ votes: [vote(1)] });
    routes({ 'POST /api/boards/b1/votes': () => json(200, { action: 'removed', voteId: 'v1', count: 0, tally: { used: 0, at: 30 } }) });
    await useGroupVoteStore.getState().toggleGuidedVote('c1');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ cardId: 'c1', action: 'remove' });
    expect(useBoardStore.getState().votes).toEqual([]);
    expect(useBoardStore.getState().voteTally).toEqual({ used: 0, at: 30 });

    routes({ 'POST /api/boards/b1/votes': () => json(200, { action: 'added', vote: vote(1, 'v2'), tally: { used: 1, at: 31 } }) });
    await useGroupVoteStore.getState().toggleGuidedVote('c1');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: 'add' });
    expect(useBoardStore.getState().votes).toEqual([vote(1, 'v2')]);
  });

  it('removeVote with one of several votes keeps the row with the server count', async () => {
    useBoardStore.setState({ votes: [vote(2)] });
    routes({ 'POST /api/boards/b1/votes': () => json(200, { action: 'removed', voteId: 'v1', count: 1, tally: { used: 1, at: 40 } }) });
    await useGroupVoteStore.getState().removeVote('c1');
    expect(useBoardStore.getState().votes).toEqual([vote(1)]);
  });

  it('removeVote with no vote on the card sends nothing', async () => {
    routes({});
    await useGroupVoteStore.getState().removeVote('c1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a 500 on add reverses the optimistic vote, rejects, and refetches through the coalesced GET', async () => {
    let atGet: Vote[] | null = null;
    routes({
      'POST /api/boards/b1/votes': () => json(500, { error: 'Failed to add vote' }),
      'GET /api/boards/b1': () => { atGet = useBoardStore.getState().votes; return getBoardResponse(board())(); },
    });
    await expect(useGroupVoteStore.getState().addVote('c1')).rejects.toThrow('Failed to add vote');
    expect(atGet).toEqual([]); // the delta was reversed before the refetch was made
    expect(calls()).toEqual(['POST /api/boards/b1/votes', 'GET /api/boards/b1']);
    expect(useBoardStore.getState().lastWriteError).toBe('Failed to add vote');
  });

  it('a thrown fetch reverses the delta, rejects with a plain message and refetches', async () => {
    let n = 0;
    let atGet: Vote[] | null = null;
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { n += 1; throw new TypeError('network down'); }
      atGet = useBoardStore.getState().votes;
      return getBoardResponse(board(), { votes: [vote(1)] })();
    });
    vi.stubGlobal('fetch', fetchMock);
    useBoardStore.setState({ votes: [vote(1)] });
    await expect(useGroupVoteStore.getState().addVote('c1')).rejects.toThrow(/Could not reach the server/);
    expect(n).toBe(1);
    expect(atGet).toEqual([vote(1)]);
    expect(useBoardStore.getState().votes).toEqual([vote(1)]);
    expect(useBoardStore.getState().lastWriteError).toMatch(/Could not reach the server/);
    expect(calls()).toContain('GET /api/boards/b1');
  });

  it('a malformed 200 answer is treated as a failure: delta reversed, refetched', async () => {
    routes({
      'POST /api/boards/b1/votes': () => json(200, { nonsense: true }),
      'GET /api/boards/b1': getBoardResponse(board()),
    });
    await expect(useGroupVoteStore.getState().addVote('c1')).rejects.toThrow('Failed to add vote');
    expect(useBoardStore.getState().votes).toEqual([]);
    expect(calls()).toContain('GET /api/boards/b1');
  });

  it('a 409 phase refusal reverses the delta and refetches (through failWrite)', async () => {
    routes({
      'POST /api/boards/b1/votes': () => json(409, { error: 'Not available during Group' }),
      'GET /api/boards/b1': getBoardResponse(board()),
    });
    await expect(useGroupVoteStore.getState().addVote('c1')).rejects.toThrow('Not available during Group');
    expect(useBoardStore.getState().votes).toEqual([]);
    expect(calls().filter((c) => c === 'GET /api/boards/b1')).toHaveLength(1);
  });
});

describe('late GET and vote-tally events', () => {
  it('a vote-tally event that arrives while a GET is in flight is not undone by the GET', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    useBoardStore.setState({ voteTally: { used: 3, at: 1 } });
    const g = useBoardStore.getState().fetchBoard('b1');
    applyVoteTallyEvent('b1', { used: 5, at: 50 });
    d.resolve(json(200, { ...baseGet(board()), voteTally: { used: 4, at: 0 } }));
    await g;
    expect(useBoardStore.getState().voteTally).toEqual({ used: 5, at: 50 });
  });

  it('a vote response applied while a GET is in flight is not undone by the GET', async () => {
    const getD = deferred<Response>(); const postD = deferred<Response>();
    fetchMock = vi.fn(async (_u: string, init?: RequestInit) => (init?.method === 'POST' ? postD.promise : getD.promise));
    vi.stubGlobal('fetch', fetchMock);
    const g = useBoardStore.getState().fetchBoard('b1');
    const p = useGroupVoteStore.getState().addVote('c1');
    postD.resolve(json(200, { action: 'added', vote: vote(1), tally: { used: 5, at: 60 } }));
    await p;
    getD.resolve(json(200, { ...baseGet(board()), voteTally: { used: 4, at: 0 } }));
    await g;
    expect(useBoardStore.getState().voteTally).toEqual({ used: 5, at: 60 });
  });

  it('a GET with nothing applied since it started takes its tally', async () => {
    routes({ 'GET /api/boards/b1': () => json(200, { ...baseGet(board()), voteTally: { used: 4, at: 0 } }) });
    await useBoardStore.getState().fetchBoard('b1');
    expect(useBoardStore.getState().voteTally).toEqual({ used: 4, at: 0 });
  });

  it('an open board GET has no voteTally key and leaves the tally null', async () => {
    useBoardStore.setState({ voteTally: { used: 2, at: 1 } });
    routes({ 'GET /api/boards/b1': getBoardResponse(board({ mode: 'open', phase: null } as Partial<Board>)) });
    await useBoardStore.getState().fetchBoard('b1');
    expect(useBoardStore.getState().voteTally).toBeNull();
  });

  it('reset clears the tally', () => {
    useBoardStore.setState({ voteTally: { used: 2, at: 1 } });
    useBoardStore.getState().reset();
    expect(useBoardStore.getState().voteTally).toBeNull();
  });

  it('applyVoteTallyEvent applies newer, ignores older and ignores another board', () => {
    applyVoteTallyEvent('b1', { used: 2, at: 10 });
    applyVoteTallyEvent('b1', { used: 1, at: 5 });
    expect(useBoardStore.getState().voteTally).toEqual({ used: 2, at: 10 });
    applyVoteTallyEvent('other', { used: 9, at: 99 });
    expect(useBoardStore.getState().voteTally).toEqual({ used: 2, at: 10 });
  });
});

describe('group titles', () => {
  it('setGroupTitle is optimistic and reverts on a phase refusal, which refetches', async () => {
    useBoardStore.setState({
      board: board({ phase: 'group', settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings('group') } }),
      cards: [{ ...cardFixture('c1'), group_title: 'Old' }, { ...cardFixture('c2'), merged_with: 'c1' }],
    });
    routes({
      'POST /api/boards/b1/groups': () => json(409, { error: 'Not available during Vote' }),
      'GET /api/boards/b1': getBoardResponse(board()),
    });
    const p = useGroupVoteStore.getState().setGroupTitle('c1', 'New');
    expect(useBoardStore.getState().cards[0].group_title).toBe('New');
    await expect(p).rejects.toThrow('Not available during Vote');
    expect(calls()).toContain('GET /api/boards/b1');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'set-title', cardId: 'c1', title: 'New' });
  });

  it('does not restore the old title when a newer title already replaced the optimistic one', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    useBoardStore.setState({ cards: [{ ...cardFixture('c1'), group_title: 'Old' }, { ...cardFixture('c2'), merged_with: 'c1' }] });
    const p = useGroupVoteStore.getState().setGroupTitle('c1', 'New');
    useBoardStore.setState((s) => ({ cards: s.cards.map((c) => (c.id === 'c1' ? { ...c, group_title: 'Theirs' } : c)) }));
    d.resolve(json(400, { error: 'Bad' }));
    await expect(p).rejects.toThrow('Bad');
    expect(useBoardStore.getState().cards[0].group_title).toBe('Theirs');
  });

  it('setGroupTitle sends null for a cleared title and keeps the title on success', async () => {
    useBoardStore.setState({ cards: [{ ...cardFixture('c1'), group_title: 'Old' }, { ...cardFixture('c2'), merged_with: 'c1' }] });
    routes({ 'POST /api/boards/b1/groups': () => json(200, { card: {} }) });
    await useGroupVoteStore.getState().setGroupTitle('c1', '   ');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'set-title', cardId: 'c1', title: null });
    expect(useBoardStore.getState().cards[0].group_title).toBeNull();
  });

  it('setGroupTitle refuses an over-long title without a request', async () => {
    routes({});
    await expect(useGroupVoteStore.getState().setGroupTitle('c1', 'x'.repeat(81))).rejects.toThrow('Group title must be at most 80 characters');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useBoardStore.getState().lastWriteError).toBe('Group title must be at most 80 characters');
  });
});

describe('resetGrouping', () => {
  it('ungroups on success and ignores a second call in flight', async () => {
    useBoardStore.setState({ cards: [cardFixture('c1'), { ...cardFixture('c2'), merged_with: 'c1' }] });
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useGroupVoteStore.getState().resetGrouping();
    expect(useGroupVoteStore.getState().resetting).toBe(true);
    await useGroupVoteStore.getState().resetGrouping();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'reset' });
    d.resolve(json(200, { ok: true, cleared: 1 }));
    await p;
    expect(useBoardStore.getState().cards.every((c) => c.merged_with === null)).toBe(true);
    expect(useGroupVoteStore.getState().resetting).toBe(false);
  });

  it('changes nothing before the answer and rejects on a refusal', async () => {
    useBoardStore.setState({ cards: [cardFixture('c1'), { ...cardFixture('c2'), merged_with: 'c1' }] });
    const server = [cardFixture('c1'), { ...cardFixture('c2'), merged_with: 'c1' }];
    routes({
      'POST /api/boards/b1/groups': () => json(409, { error: 'Not available during Vote' }),
      'GET /api/boards/b1': getBoardResponse(board(), { cards: server }),
    });
    await expect(useGroupVoteStore.getState().resetGrouping()).rejects.toThrow('Not available during Vote');
    expect(useBoardStore.getState().cards[1].merged_with).toBe('c1');
    expect(useGroupVoteStore.getState().resetting).toBe(false);
  });

  it('does not touch the cards of a board the user has left', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    useBoardStore.setState({ cards: [cardFixture('c1'), { ...cardFixture('c2'), merged_with: 'c1' }] });
    const p = useGroupVoteStore.getState().resetGrouping();
    const other = [{ ...cardFixture('x2'), merged_with: 'x1' }];
    useBoardStore.setState({ board: board({ id: 'b2' }), cards: other });
    d.resolve(json(200, { ok: true, cleared: 1 }));
    await p;
    expect(useBoardStore.getState().cards).toEqual(other);
  });
});

describe('open boards', () => {
  it('every guided action does nothing and sends nothing', async () => {
    useBoardStore.setState({ board: board({ mode: 'open', phase: null } as Partial<Board>), votes: [vote(1)] });
    routes({});
    const s = useGroupVoteStore.getState();
    await s.addVote('c1');
    await s.removeVote('c1');
    await s.toggleGuidedVote('c1');
    await s.setGroupTitle('c1', 'T');
    await s.resetGrouping();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useBoardStore.getState().votes).toEqual([vote(1)]);
  });
});

describe('a failure on a board the user has left touches nothing', () => {
  const answers: Array<[string, (d: ReturnType<typeof deferred<Response>>) => void, string]> = [
    ['a 500', (d) => d.resolve(json(500, { error: 'Server broke' })), 'Server broke'],
    ['a 401', (d) => d.resolve(json(401, { error: 'Sign in again' })), 'Sign in again'],
    ['a thrown fetch', (d) => d.reject(new TypeError('offline')), 'Could not reach the server'],
  ];
  const actions: Array<[string, () => Promise<void>]> = [
    ['addVote', () => useGroupVoteStore.getState().addVote('c1')],
    ['setGroupTitle', () => useGroupVoteStore.getState().setGroupTitle('c1', 'New')],
    ['resetGrouping', () => useGroupVoteStore.getState().resetGrouping()],
  ];

  for (const [actionName, run] of actions) {
    for (const [label, answer, message] of answers) {
      it(`${actionName} then ${label}: rejects, and board B is exactly as it was`, async () => {
        useBoardStore.setState({ cards: [{ ...cardFixture('c1'), group_title: 'Old' }, { ...cardFixture('c2'), merged_with: 'c1' }] });
        const d = deferred<Response>();
        fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
        const p = run();
        const settled = p.then(() => null, (e: Error) => e);
        const B = {
          board: board({ id: 'b2' }),
          votes: [{ ...vote(2), board_id: 'b2', card_id: 'x1' }],
          cards: [{ ...cardFixture('x1'), board_id: 'b2' }],
          voteTally: { used: 2, at: 5 },
          currentParticipantId: 'p9',
          lastWriteError: null,
        };
        useBoardStore.setState(B);
        answer(d);
        const err = await settled;
        expect(err).toBeInstanceOf(Error);
        expect(err!.message).toContain(message);
        const now = useBoardStore.getState();
        expect({ board: now.board, votes: now.votes, cards: now.cards, voteTally: now.voteTally,
          currentParticipantId: now.currentParticipantId, lastWriteError: now.lastWriteError }).toEqual(B);
        expect(calls()).toHaveLength(1);
        expect(store.size).toBe(0);
      });
    }
  }
});

describe('failed votes settle from the server', () => {
  it('(a) a refetch between two clicks and a later refusal never leaves the count below the server', async () => {
    useBoardStore.setState({ votes: [vote(1)] });
    const first = deferred<Response>(); const second = deferred<Response>();
    let gets = 0;
    fetchMock = vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.method === 'POST') return ((fetchMock.mock.calls as FetchCall[]).filter((c) => c[1]?.method === 'POST').length === 1 ? first : second).promise;
      gets += 1;
      return getBoardResponse(board(), { votes: [vote(2)], voteTally: { used: 2, at: 0 } })();
    });
    vi.stubGlobal('fetch', fetchMock);
    const a = useGroupVoteStore.getState().addVote('c1');
    const b = useGroupVoteStore.getState().addVote('c1');
    expect(useBoardStore.getState().votes[0].count).toBe(3);
    useBoardStore.setState({ votes: [vote(1)] }); // a refetch replaced the rows
    first.resolve(json(200, { action: 'added', vote: vote(2), tally: { used: 2, at: 20 } }));
    await a;
    second.resolve(json(422, { error: 'Vote limit reached' }));
    await expect(b).rejects.toThrow('Vote limit reached');
    expect(useBoardStore.getState().votes).toEqual([vote(2)]);
    expect(useBoardStore.getState().votes[0].count).not.toBe(0);
    expect(gets).toBe(1);
  });

  it('(b) a single refused add reverses at once, rejects with the server message, then one coalesced GET follows', async () => {
    useBoardStore.setState({ votes: [vote(1)] });
    let atGet: Vote[] | null = null;
    routes({
      'POST /api/boards/b1/votes': () => json(422, { error: 'Vote limit reached' }),
      'GET /api/boards/b1': () => { atGet = useBoardStore.getState().votes; return getBoardResponse(board(), { votes: [vote(1)] })(); },
    });
    await expect(useGroupVoteStore.getState().addVote('c1')).rejects.toThrow('Vote limit reached');
    expect(atGet).toEqual([vote(1)]);
    expect(useBoardStore.getState().votes).toEqual([vote(1)]);
    expect(useBoardStore.getState().lastWriteError).toBe('Vote limit reached');
    expect(calls()).toEqual(['POST /api/boards/b1/votes', 'GET /api/boards/b1']);
  });
});

describe('scrambled answer orders', () => {
  const countOn = () => useBoardStore.getState().votes[0]?.count;

  it('three adds answered third, first, second end at the third count and its tally', async () => {
    const d = [deferred<Response>(), deferred<Response>(), deferred<Response>()];
    fetchMock = vi.fn().mockReturnValueOnce(d[0].promise).mockReturnValueOnce(d[1].promise).mockReturnValueOnce(d[2].promise);
    vi.stubGlobal('fetch', fetchMock);
    const p = [1, 2, 3].map(() => useGroupVoteStore.getState().addVote('c1'));
    expect(countOn()).toBe(3);
    d[2].resolve(json(200, { action: 'added', vote: vote(3), tally: { used: 3, at: 30 } }));
    await p[2];
    expect(countOn()).toBe(3);
    expect(useBoardStore.getState().voteTally).toEqual({ used: 3, at: 30 });
    d[0].resolve(json(200, { action: 'added', vote: vote(1), tally: { used: 1, at: 10 } }));
    await p[0];
    expect(countOn()).toBe(3);
    expect(useBoardStore.getState().voteTally).toEqual({ used: 3, at: 30 });
    d[1].resolve(json(200, { action: 'added', vote: vote(2), tally: { used: 2, at: 20 } }));
    await p[1];
    expect(countOn()).toBe(3);
    expect(useBoardStore.getState().voteTally).toEqual({ used: 3, at: 30 });
  });

  it('add, add, remove answered scrambled end at the server final count and newest tally', async () => {
    const d = [deferred<Response>(), deferred<Response>(), deferred<Response>()];
    fetchMock = vi.fn().mockReturnValueOnce(d[0].promise).mockReturnValueOnce(d[1].promise).mockReturnValueOnce(d[2].promise);
    vi.stubGlobal('fetch', fetchMock);
    const a1 = useGroupVoteStore.getState().addVote('c1');
    const a2 = useGroupVoteStore.getState().addVote('c1');
    const r = useGroupVoteStore.getState().removeVote('c1');
    expect(countOn()).toBe(1);
    d[2].resolve(json(200, { action: 'removed', voteId: 'v1', count: 1, tally: { used: 1, at: 30 } }));
    await r;
    expect(countOn()).toBe(1);
    expect(useBoardStore.getState().voteTally).toEqual({ used: 1, at: 30 });
    d[1].resolve(json(200, { action: 'added', vote: vote(2), tally: { used: 2, at: 20 } }));
    await a2;
    expect(countOn()).toBe(1);
    d[0].resolve(json(200, { action: 'added', vote: vote(1), tally: { used: 1, at: 10 } }));
    await a1;
    expect(countOn()).toBe(1);
    expect(useBoardStore.getState().votes).toEqual([expect.objectContaining({ card_id: 'c1', voter_id: 'p1', count: 1 })]);
    expect(useBoardStore.getState().voteTally).toEqual({ used: 1, at: 30 });
  });
});
