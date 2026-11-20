import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useBoardStore } from '@/stores/boardStore';
import { usePhaseStore } from '@/stores/phaseStore';
import { withPhaseDefaults } from '@/lib/phases';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import type { Board } from '@/types';

type FetchCall = [string, RequestInit | undefined];

function board(over: Partial<Board> = {}): Board {
  return {
    id: 'b1',
    title: 'T',
    description: null,
    template: 'start-stop-continue',
    settings: { ...DEFAULT_BOARD_SETTINGS },
    created_at: '2026-01-01T00:00:00Z',
    archived_at: null,
    trust_version: 2,
    mode: 'guided',
    phase: 'reflect',
    phase_config: { deadline: null },
    ...over,
  } as unknown as Board;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const store = new Map<string, string>();
let fetchMock: ReturnType<typeof vi.fn>;

/** Route fetch by "METHOD url" with a handler per route. */
function routes(map: Record<string, () => Response>) {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.split('?')[0]}`;
    const handler = map[key];
    if (!handler) throw new Error(`unexpected fetch ${key}`);
    return handler();
  });
  vi.stubGlobal('fetch', fetchMock);
}

const getBoardResponse = (b: Board) => () =>
  json(200, {
    board: b,
    columns: [],
    cards: [],
    votes: [],
    actionItems: [],
    participants: [],
    youAre: { participantId: null, isFacilitator: false, joined: false },
    youCanFacilitate: false,
    access: 'open',
  });

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  useBoardStore.getState().reset();
  useBoardStore.setState({ board: board(), currentParticipantId: 'p1' });
  usePhaseStore.setState({ moving: false, readyIds: [], onlineTotal: 0, iAmReadyFor: null, readyBoardId: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const movedResponse = () =>
  json(200, {
    ok: true,
    phase: 'group',
    settings: { ...DEFAULT_BOARD_SETTINGS, card_visibility: 'visible' },
    phaseConfig: { deadline: null },
  });

describe('movePhase', () => {
  it('posts the phase it believes is current and applies the response', async () => {
    routes({ 'POST /api/boards/b1/phase': movedResponse });
    await usePhaseStore.getState().movePhase('next');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/boards/b1/phase',
      expect.objectContaining({ body: JSON.stringify({ action: 'move', from: 'reflect', to: 'next' }) }),
    );
    expect(useBoardStore.getState().board?.phase).toBe('group');
    expect(useBoardStore.getState().board?.settings.card_visibility).toBe('visible');
    expect(usePhaseStore.getState().moving).toBe(false);
  });

  it('does not change the phase before the response arrives', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    fetchMock = vi.fn(async () => { await gate; return movedResponse(); });
    vi.stubGlobal('fetch', fetchMock);
    const pending = usePhaseStore.getState().movePhase('next');
    expect(usePhaseStore.getState().moving).toBe(true);
    expect(useBoardStore.getState().board?.phase).toBe('reflect');
    release();
    await pending;
    expect(useBoardStore.getState().board?.phase).toBe('group');
  });

  it('on 409 it rejects with the message, refetches the board and sets lastWriteError', async () => {
    routes({
      'POST /api/boards/b1/phase': () => json(409, { error: 'The phase already changed' }),
      'GET /api/boards/b1': getBoardResponse(board({ phase: 'vote' })),
    });
    await expect(usePhaseStore.getState().movePhase('next')).rejects.toThrow('The phase already changed');
    expect(useBoardStore.getState().lastWriteError).toBe('The phase already changed');
    expect(useBoardStore.getState().board?.phase).toBe('vote');
    expect(usePhaseStore.getState().moving).toBe(false);
  });

  it('on a non-409 failure it rejects, surfaces the message and does not refetch', async () => {
    routes({ 'POST /api/boards/b1/phase': () => json(403, { error: 'Only a facilitator can do that' }) });
    await expect(usePhaseStore.getState().movePhase('next')).rejects.toThrow('Only a facilitator can do that');
    expect(useBoardStore.getState().lastWriteError).toBe('Only a facilitator can do that');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useBoardStore.getState().board?.phase).toBe('reflect');
  });

  it('a thrown fetch rejects, clears moving, keeps the phase and sets lastWriteError', async () => {
    fetchMock = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', fetchMock);
    await expect(usePhaseStore.getState().movePhase('next')).rejects.toThrow();
    expect(usePhaseStore.getState().moving).toBe(false);
    expect(useBoardStore.getState().board?.phase).toBe('reflect');
    expect(useBoardStore.getState().lastWriteError).toBe('Could not reach the server. Check your connection and try again.');
  });

  it('ignores a second call while one is in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    fetchMock = vi.fn(async () => { await gate; return movedResponse(); });
    vi.stubGlobal('fetch', fetchMock);
    const first = usePhaseStore.getState().movePhase('next');
    const second = usePhaseStore.getState().movePhase('next');
    release();
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing on an open board', async () => {
    useBoardStore.setState({ board: board({ mode: 'open', phase: null }) });
    routes({});
    await usePhaseStore.getState().movePhase('next');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('setDeadline', () => {
  it('posts set-deadline and applies the returned phase config', async () => {
    const deadline = '2026-12-01T10:00:00.000Z';
    routes({
      'POST /api/boards/b1/phase': () =>
        json(200, { ok: true, phase: 'reflect', settings: { ...DEFAULT_BOARD_SETTINGS }, phaseConfig: { deadline } }),
    });
    await usePhaseStore.getState().setDeadline(deadline);
    const [, init] = fetchMock.mock.calls[0] as FetchCall;
    expect(init?.body).toBe(JSON.stringify({ action: 'set-deadline', deadline }));
    expect(useBoardStore.getState().board?.phase_config.deadline).toBe(deadline);
  });
});

describe('setDeadline failures', () => {
  it('rejects on a 400 with the server text and sets lastWriteError', async () => {
    routes({ 'POST /api/boards/b1/phase': () => json(400, { error: 'Deadline must be in the future' }) });
    await expect(usePhaseStore.getState().setDeadline('2020-01-01T00:00:00.000Z')).rejects.toThrow('Deadline must be in the future');
    expect(useBoardStore.getState().lastWriteError).toBe('Deadline must be in the future');
    expect(useBoardStore.getState().board?.phase_config.deadline).toBeNull();
  });

  it('a thrown fetch rejects and sets lastWriteError', async () => {
    fetchMock = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', fetchMock);
    await expect(usePhaseStore.getState().setDeadline(null)).rejects.toThrow();
    expect(useBoardStore.getState().lastWriteError).toBe('Could not reach the server. Check your connection and try again.');
  });
});

describe('stale-state recovery in failWrite', () => {
  it('a card write that fails with 409 on a guided board refetches the board', async () => {
    useBoardStore.setState({
      participants: [{ id: 'p1', board_id: 'b1', display_name: 'Ann', is_admin: false, user_id: null, joined_at: '', last_seen: '' }],
    });
    routes({
      'POST /api/boards/b1/cards': () => json(409, { error: 'Not available during Group' }),
      'GET /api/boards/b1': getBoardResponse(board({ phase: 'group' })),
    });
    await expect(useBoardStore.getState().addCard('c1', 'late thought')).rejects.toThrow('Not available during Group');
    expect(useBoardStore.getState().board?.phase).toBe('group');
  });

  it('a 409 on an open board does not refetch', async () => {
    useBoardStore.setState({
      board: board({ mode: 'open', phase: null }),
      participants: [{ id: 'p1', board_id: 'b1', display_name: 'Ann', is_admin: false, user_id: null, joined_at: '', last_seen: '' }],
    });
    routes({ 'POST /api/boards/b1/cards': () => json(409, { error: 'Conflict' }) });
    await expect(useBoardStore.getState().addCard('c1', 'x')).rejects.toThrow('Conflict');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a non-409 failure on a guided board does not refetch', async () => {
    useBoardStore.setState({
      participants: [{ id: 'p1', board_id: 'b1', display_name: 'Ann', is_admin: false, user_id: null, joined_at: '', last_seen: '' }],
    });
    routes({ 'POST /api/boards/b1/cards': () => json(403, { error: 'Not allowed' }) });
    await expect(useBoardStore.getState().addCard('c1', 'x')).rejects.toThrow('Not allowed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('ready state', () => {
  it('setReady(true) records the current phase', () => {
    usePhaseStore.getState().setReady(true);
    expect(usePhaseStore.getState().iAmReadyFor).toBe('reflect');
  });

  it('setReady(false) clears it', () => {
    usePhaseStore.getState().setReady(true);
    usePhaseStore.getState().setReady(false);
    expect(usePhaseStore.getState().iAmReadyFor).toBeNull();
  });

  it('a phase change makes it stale without any reset call', async () => {
    usePhaseStore.getState().setReady(true);
    const { currentReadyPhase } = await import('@/stores/phaseStore');
    const ps = () => usePhaseStore.getState();
    expect(currentReadyPhase(ps(), useBoardStore.getState().board)).toBe('reflect');
    useBoardStore.setState({ board: board({ phase: 'group' }) });
    expect(currentReadyPhase(ps(), useBoardStore.getState().board)).toBeNull();
  });

  it('is not ready on a different board even in the same phase', async () => {
    usePhaseStore.getState().setReady(true);
    const { currentReadyPhase } = await import('@/stores/phaseStore');
    expect(currentReadyPhase(usePhaseStore.getState(), board({ id: 'b2' }))).toBeNull();
  });

  it('setReady does nothing on an open board', () => {
    useBoardStore.setState({ board: board({ mode: 'open', phase: null }) });
    usePhaseStore.getState().setReady(true);
    expect(usePhaseStore.getState().iAmReadyFor).toBeNull();
  });

  it('setReadySummary stores the ready ids and the online total', () => {
    usePhaseStore.getState().setReadySummary({ readyIds: ['a', 'b'], total: 5 });
    expect(usePhaseStore.getState().readyIds).toEqual(['a', 'b']);
    expect(usePhaseStore.getState().onlineTotal).toBe(5);
  });
});

describe('createBoard options', () => {
  function createRoutes() {
    routes({ 'POST /api/boards': () => json(200, { participantId: 'p9' }) });
  }
  const sent = () => JSON.parse(((fetchMock.mock.calls[0] as FetchCall)[1])!.body as string);

  it('guided sends mode and anonymous_cards true by default', async () => {
    createRoutes();
    await useBoardStore.getState().createBoard('T', null, 'start-stop-continue', 'Ann', { mode: 'guided' });
    expect(sent().mode).toBe('guided');
    expect(sent().settings.anonymous_cards).toBe(true);
  });

  it('guided honours anonymous: false', async () => {
    createRoutes();
    await useBoardStore.getState().createBoard('T', null, 'start-stop-continue', 'Ann', { mode: 'guided', anonymous: false });
    expect(sent().settings.anonymous_cards).toBe(false);
  });

  it('without options the body has no mode key and settings are unchanged', async () => {
    createRoutes();
    await useBoardStore.getState().createBoard('T', null, 'start-stop-continue', 'Ann');
    expect('mode' in sent()).toBe(false);
    expect(sent().settings.anonymous_cards).toBe(DEFAULT_BOARD_SETTINGS.anonymous_cards);
  });
});

describe('completeBoard', () => {
  it('sets phase done optimistically on a guided board', async () => {
    let seen: string | null | undefined;
    fetchMock = vi.fn(async () => {
      seen = useBoardStore.getState().board?.phase;
      return json(200, { ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    await useBoardStore.getState().completeBoard();
    expect(seen).toBe('done');
  });

  it('reverts the phase when completion fails', async () => {
    // 500 so failWrite does not refetch: only the revert in completeBoard can restore the board.
    routes({ 'POST /api/boards/b1': () => json(500, { error: 'Nope' }) });
    await expect(useBoardStore.getState().completeBoard()).rejects.toThrow('Nope');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useBoardStore.getState().board?.phase).toBe('reflect');
    expect(useBoardStore.getState().board?.archived_at).toBeNull();
  });

  it('leaves phase null on an open board', async () => {
    useBoardStore.setState({ board: board({ mode: 'open', phase: null }) });
    routes({ 'POST /api/boards/b1': () => json(200, { ok: true }) });
    await useBoardStore.getState().completeBoard();
    expect(useBoardStore.getState().board?.phase).toBeNull();
  });
});

describe('fetchBoard phase fields', () => {
  it('stores mode, phase and phase_config from the response', async () => {
    useBoardStore.setState({ board: null });
    routes({
      'GET /api/boards/b1': getBoardResponse(board({ phase: 'vote', phase_config: { deadline: '2026-12-01T00:00:00.000Z' } })),
    });
    await useBoardStore.getState().fetchBoard('b1');
    const b = useBoardStore.getState().board;
    expect(b?.mode).toBe('guided');
    expect(b?.phase).toBe('vote');
    expect(b?.phase_config.deadline).toBe('2026-12-01T00:00:00.000Z');
  });

  it('defaults to an open board when an older server omits the fields', async () => {
    useBoardStore.setState({ board: null });
    const old = board() as unknown as Record<string, unknown>;
    delete old.mode;
    delete old.phase;
    delete old.phase_config;
    routes({ 'GET /api/boards/b1': getBoardResponse(old as unknown as Board) });
    await useBoardStore.getState().fetchBoard('b1');
    const b = useBoardStore.getState().board;
    expect(b?.mode).toBe('open');
    expect(b?.phase).toBeNull();
    expect(b?.phase_config).toEqual({ deadline: null });
  });
});

describe('withPhaseDefaults', () => {
  it('keeps present fields and fills missing ones', () => {
    expect(withPhaseDefaults({ id: 'x', mode: 'guided', phase: 'group', phase_config: { deadline: 'd' } }))
      .toMatchObject({ mode: 'guided', phase: 'group', phase_config: { deadline: 'd' } });
    expect(withPhaseDefaults({ id: 'x' })).toMatchObject({ mode: 'open', phase: null, phase_config: { deadline: null } });
  });

  it('does not share the default config object between boards', () => {
    const a = withPhaseDefaults({}) as { phase_config: { deadline: string | null } };
    a.phase_config.deadline = 'mutated';
    expect((withPhaseDefaults({}) as { phase_config: { deadline: string | null } }).phase_config.deadline).toBeNull();
  });
});
