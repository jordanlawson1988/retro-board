import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useBoardStore } from '@/stores/boardStore';
import { useDiscussStore, applyCommentUpsertEvent, applyCommentDeletedEvent } from '@/stores/discussStore';
import { phaseSettings } from '@/lib/phases';
import { parseCommentDeletion } from '@/lib/comments';
import { commentChangesSince, commentSeq, recordCommentChange } from '@/lib/commentJournal';
import { DEFAULT_BOARD_SETTINGS } from '@/utils/constants';
import type { ActionItem, Board, Card, Comment, Participant } from '@/types';

type FetchCall = [string, RequestInit | undefined];

function board(over: Partial<Board> = {}): Board {
  return {
    id: 'b1',
    title: 'T',
    description: null,
    template: 'start-stop-continue',
    settings: { ...DEFAULT_BOARD_SETTINGS, ...phaseSettings('discuss') },
    created_at: '2026-01-01T00:00:00Z',
    archived_at: null,
    trust_version: 2,
    mode: 'guided',
    phase: 'discuss',
    phase_config: { deadline: null, topic: 'c1' },
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

function comment(over: Partial<Comment> = {}): Comment {
  return {
    id: 'm1', board_id: 'b1', card_id: 'c1', parent_id: null, author_participant_id: null, author_name: null,
    is_anonymous: true, body: 'hi', created_at: '2026-01-01T00:00:00Z', edited_at: null, deleted_at: null, is_mine: false,
    ...over,
  };
}

const person = (id: string, name: string): Participant =>
  ({ id, board_id: 'b1', display_name: name, is_admin: false, user_id: null, joined_at: 'x', last_seen: 'x' });

const item = (over: Partial<ActionItem> = {}): ActionItem => ({
  id: 'i1', board_id: 'b1', description: 'Fix it', assignee: null, due_date: null, status: 'open',
  created_at: 'x', card_id: 'c1', assignee_participant_id: null, ...over,
} as ActionItem);

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
const sentBody = (i = 0) => JSON.parse((fetchMock.mock.calls as FetchCall[])[i][1]!.body as string);
const ids = () => useBoardStore.getState().comments.map((c) => c.id);

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
  useDiscussStore.setState({ viewed: null, settingTopic: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchBoard and comments', () => {
  it('sets comments from the GET', async () => {
    routes({ 'GET /api/boards/b1': getBoardResponse(board(), { comments: [comment({ id: 'm1' })] }) });
    await useBoardStore.getState().fetchBoard('b1');
    expect(ids()).toEqual(['m1']);
  });

  it('an open board GET with no comments key keeps the very same empty array across fetches', async () => {
    const open = board({ mode: 'open', phase: null } as Partial<Board>);
    routes({ 'GET /api/boards/b1': getBoardResponse(open) });
    useBoardStore.getState().reset();
    const before = useBoardStore.getState().comments;
    let wakes = 0;
    const unsubscribe = useBoardStore.subscribe((s, prev) => { if (s.comments !== prev.comments) wakes += 1; });
    await useBoardStore.getState().fetchBoard('b1');
    await useBoardStore.getState().fetchBoard('b1');
    unsubscribe();
    expect(useBoardStore.getState().comments).toBe(before);
    expect(before).toEqual([]);
    expect(wakes).toBe(0);
  });

  it('a GET with no comments key empties a list left from a guided board', async () => {
    useBoardStore.setState({ comments: [comment()] });
    routes({ 'GET /api/boards/b1': getBoardResponse(board({ mode: 'open', phase: null } as Partial<Board>)) });
    await useBoardStore.getState().fetchBoard('b1');
    expect(useBoardStore.getState().comments).toEqual([]);
  });

  it('a comment-created event applied while a GET lacking it is in flight survives the GET', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    useBoardStore.setState({ comments: [comment({ id: 'm1' })] });
    const p = useBoardStore.getState().fetchBoard('b1');
    applyCommentUpsertEvent('b1', { comment: comment({ id: 'm2' }) });
    d.resolve(json(200, baseGet(board(), { comments: [comment({ id: 'm1' })] })));
    await p;
    expect(ids()).toEqual(['m1', 'm2']);
  });

  it('a comment-deleted event applied while a GET that still has the comment is in flight is not undone', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    useBoardStore.setState({ comments: [comment({ id: 'm1' })] });
    const p = useBoardStore.getState().fetchBoard('b1');
    applyCommentDeletedEvent('b1', { ids: ['m1'], tombstone: null });
    d.resolve(json(200, baseGet(board(), { comments: [comment({ id: 'm1' })] })));
    await p;
    expect(ids()).toEqual([]);
  });

  it('reset clears the comments', () => {
    useBoardStore.setState({ comments: [comment()] });
    useBoardStore.getState().reset();
    expect(useBoardStore.getState().comments).toEqual([]);
  });
});

describe('comment journal', () => {
  it('keeps only the newest 200 changes and returns those after a sequence number', () => {
    const start = commentSeq();
    for (let i = 0; i < 250; i += 1) {
      recordCommentChange({ boardId: 'b1', kind: 'upsert', comment: comment({ id: `j${i}` }) });
    }
    const all = commentChangesSince(start);
    expect(all).toHaveLength(200);
    expect((all[0] as { comment: Comment }).comment.id).toBe('j50');
    expect(commentChangesSince(commentSeq())).toEqual([]);
    expect(commentChangesSince(commentSeq() - 1)).toHaveLength(1);
  });
});

describe('parseCommentDeletion', () => {
  it('accepts ids with a tombstone or null, and rejects anything else', () => {
    expect(parseCommentDeletion({ ids: ['a'], tombstone: null })).toEqual({ ids: ['a'], tombstone: null });
    expect(parseCommentDeletion({ ids: ['a'], tombstone: comment() })?.tombstone?.id).toBe('m1');
    expect(parseCommentDeletion({ ids: ['a'] })).toEqual({ ids: ['a'], tombstone: null });
    expect(parseCommentDeletion({ ids: [1] })).toBeNull();
    expect(parseCommentDeletion({ ids: 'a' })).toBeNull();
    expect(parseCommentDeletion({ ids: ['a'], tombstone: { id: 1 } })).toBeNull();
    expect(parseCommentDeletion(null)).toBeNull();
  });
});

describe('createComment', () => {
  const input = { cardId: 'c1', body: 'hi', anonymous: true, parentId: null };
  const mine = () => comment({ id: 'm9', is_mine: true });
  const echo = () => comment({ id: 'm9', is_mine: false });

  it('posts the body and applies the answer, and a later public echo keeps is_mine true', async () => {
    routes({ 'POST /api/boards/b1/comments': () => json(200, { comment: mine() }) });
    await useDiscussStore.getState().createComment(input);
    expect(sentBody()).toEqual({ cardId: 'c1', body: 'hi', anonymous: true, parentId: null });
    expect(useBoardStore.getState().comments).toEqual([expect.objectContaining({ id: 'm9', is_mine: true, author_name: null, author_participant_id: null })]);
    applyCommentUpsertEvent('b1', { comment: echo() });
    expect(useBoardStore.getState().comments).toHaveLength(1);
    expect(useBoardStore.getState().comments[0].is_mine).toBe(true);
  });

  it('an echo that arrives BEFORE the answer still ends with is_mine true', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().createComment(input);
    applyCommentUpsertEvent('b1', { comment: echo() });
    expect(useBoardStore.getState().comments[0].is_mine).toBe(false); // echo first, answer not here yet
    d.resolve(json(200, { comment: mine() }));
    await p;
    expect(useBoardStore.getState().comments).toHaveLength(1);
    expect(useBoardStore.getState().comments[0].is_mine).toBe(true);
  });

  it('an answer for a board the user has left changes nothing', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().createComment(input);
    useBoardStore.setState({ board: board({ id: 'b2' }), comments: [] });
    d.resolve(json(200, { comment: mine() }));
    await p;
    expect(useBoardStore.getState().comments).toEqual([]);
    expect(calls()).toEqual(['POST /api/boards/b1/comments']);
  });

  it('a failure for a board the user has left only rejects: no banner, no refetch', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().createComment(input);
    useBoardStore.setState({ board: board({ id: 'b2' }) });
    d.resolve(json(409, { error: 'The phase already changed' }));
    await expect(p).rejects.toThrow('The phase already changed');
    expect(useBoardStore.getState().lastWriteError).toBeNull();
    expect(calls()).toEqual(['POST /api/boards/b1/comments']);
  });

  it('a 409 rejects with the server message, leaves comments alone and runs one coalesced GET', async () => {
    useBoardStore.setState({ comments: [comment({ id: 'm1' })] });
    routes({
      'POST /api/boards/b1/comments': () => json(409, { error: 'The phase already changed' }),
      'GET /api/boards/b1': getBoardResponse(board(), { comments: [comment({ id: 'm1' })] }),
    });
    await expect(useDiscussStore.getState().createComment(input)).rejects.toThrow('The phase already changed');
    expect(ids()).toEqual(['m1']);
    expect(calls()).toEqual(['POST /api/boards/b1/comments', 'GET /api/boards/b1']);
  });

  it('a network failure rejects and pulls the real state back once', async () => {
    fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(json(200, baseGet(board(), { comments: [] })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(useDiscussStore.getState().createComment(input)).rejects.toThrow();
    expect(calls()).toEqual(['POST /api/boards/b1/comments', 'GET /api/boards/b1']);
  });

  it('does nothing without a participant or on an open board', async () => {
    routes({});
    useBoardStore.setState({ currentParticipantId: null });
    await useDiscussStore.getState().createComment(input);
    useBoardStore.setState({ currentParticipantId: 'p1', board: board({ mode: 'open', phase: null } as Partial<Board>) });
    await useDiscussStore.getState().createComment(input);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('editComment and deleteComment', () => {
  it('editComment with unchanged text sends nothing; with new text it applies the answer', async () => {
    useBoardStore.setState({ comments: [comment({ id: 'm1', body: 'hi', is_mine: true })] });
    routes({ 'PATCH /api/boards/b1/comments': () => json(200, { comment: comment({ id: 'm1', body: 'hello', is_mine: true, edited_at: 'now' }) }) });
    await useDiscussStore.getState().editComment('m1', 'hi');
    expect(fetchMock).not.toHaveBeenCalled();
    await useDiscussStore.getState().editComment('m1', 'hello');
    expect(sentBody()).toEqual({ commentId: 'm1', body: 'hello' });
    expect(useBoardStore.getState().comments[0]).toMatchObject({ body: 'hello', edited_at: 'now' });
  });

  it('deleteComment applies the ids and the tombstone', async () => {
    useBoardStore.setState({
      comments: [comment({ id: 'm1' }), comment({ id: 'm2', parent_id: 'm1' }), comment({ id: 'm3' })],
    });
    const tomb = comment({ id: 'm1', body: '', deleted_at: 'now', is_anonymous: false });
    routes({ 'DELETE /api/boards/b1/comments': () => json(200, { ids: ['m3', 'm1'], tombstone: tomb }) });
    await useDiscussStore.getState().deleteComment('m3');
    expect(sentBody()).toEqual({ commentId: 'm3' });
    expect(useBoardStore.getState().comments.map((c) => [c.id, c.deleted_at])).toEqual([['m1', 'now'], ['m2', null]]);
  });

  it('a facilitator without a participant may delete', async () => {
    useBoardStore.setState({ currentParticipantId: null, comments: [comment({ id: 'm1' })] });
    routes({ 'DELETE /api/boards/b1/comments': () => json(200, { ids: ['m1'], tombstone: null }) });
    await useDiscussStore.getState().deleteComment('m1');
    expect(ids()).toEqual([]);
  });

  it('a refused delete rejects with the fallback-or-server message and leaves the list', async () => {
    useBoardStore.setState({ comments: [comment({ id: 'm1' })] });
    routes({ 'DELETE /api/boards/b1/comments': () => json(403, { error: 'Only the author or a facilitator can delete this comment' }) });
    await expect(useDiscussStore.getState().deleteComment('m1')).rejects.toThrow('Only the author or a facilitator');
    expect(ids()).toEqual(['m1']);
  });
});

describe('comment events', () => {
  it('ignore another board, a malformed payload and an open board', () => {
    applyCommentUpsertEvent('b2', { comment: comment() });
    applyCommentUpsertEvent('b1', { comment: { id: 1 } });
    applyCommentUpsertEvent('b1', null);
    applyCommentDeletedEvent('b2', { ids: ['m1'], tombstone: null });
    applyCommentDeletedEvent('b1', { ids: 'm1' });
    expect(useBoardStore.getState().comments).toEqual([]);
    useBoardStore.setState({ board: board({ mode: 'open', phase: null } as Partial<Board>) });
    const before = useBoardStore.getState().comments;
    applyCommentUpsertEvent('b1', { comment: comment() });
    expect(useBoardStore.getState().comments).toBe(before);
  });

  it('a duplicate create event leaves one comment', () => {
    applyCommentUpsertEvent('b1', { comment: comment() });
    applyCommentUpsertEvent('b1', { comment: comment() });
    expect(ids()).toEqual(['m1']);
  });
});

describe('setTopic and viewTopic', () => {
  const topic = () => useBoardStore.getState().board!.phase_config.topic;
  const answer = (t: string) => ({ ok: true, phase: 'discuss', settings: board().settings, phaseConfig: { deadline: null, topic: t } });

  it('setTopic shows c2 at once and keeps it after a 200', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().setTopic('c2');
    expect(topic()).toBe('c2');
    expect(sentBody()).toEqual({ action: 'set-topic', cardId: 'c2' });
    expect(calls()).toEqual(['POST /api/boards/b1/phase']);
    d.resolve(json(200, answer('c2')));
    await p;
    expect(topic()).toBe('c2');
    expect(useDiscussStore.getState().settingTopic).toBe(false);
  });

  it('a second setTopic while the first is in flight sends nothing', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().setTopic('c2');
    await useDiscussStore.getState().setTopic('c1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    d.resolve(json(200, answer('c2')));
    await p;
  });

  it('a 409 restores c1 while c2 is still shown, rejects, and refetches through failWrite', async () => {
    routes({
      'POST /api/boards/b1/phase': () => json(409, { error: 'The phase already changed' }),
      'GET /api/boards/b1': getBoardResponse(board(), { comments: [] }),
    });
    await expect(useDiscussStore.getState().setTopic('c2')).rejects.toThrow('The phase already changed');
    expect(topic()).toBe('c1');
    expect(useDiscussStore.getState().settingTopic).toBe(false);
    expect(calls()).toEqual(['POST /api/boards/b1/phase', 'GET /api/boards/b1']);
  });

  it('a failure does not restore when something else already changed the topic', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().setTopic('c2');
    useBoardStore.setState({ board: { ...board(), phase_config: { deadline: null, topic: 'c3' } } });
    d.resolve(json(404, { error: 'That topic is not on the agenda' }));
    await expect(p).rejects.toThrow('That topic is not on the agenda');
    expect(topic()).toBe('c3');
  });

  it('an answer that arrives after the phase moved to done is not applied', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().setTopic('c2');
    useBoardStore.setState({ board: { ...board(), phase: 'done', phase_config: { deadline: null } } as unknown as Board });
    d.resolve(json(200, answer('c2')));
    await p;
    expect(useBoardStore.getState().board!.phase).toBe('done');
    expect(topic()).toBeUndefined();
  });

  it('an answer for a board the user has left is applied to nothing, and a failure only rejects', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().setTopic('c2');
    useBoardStore.setState({ board: board({ id: 'b2' }) });
    d.resolve(json(200, answer('c2')));
    await p;
    expect(topic()).toBe('c1');

    const d2 = deferred<Response>();
    fetchMock = vi.fn(() => d2.promise); vi.stubGlobal('fetch', fetchMock);
    const q = useDiscussStore.getState().setTopic('c3');
    useBoardStore.setState({ board: board({ id: 'b3' }) });
    d2.resolve(json(409, { error: 'The phase already changed' }));
    await expect(q).rejects.toThrow('The phase already changed');
    expect(useBoardStore.getState().lastWriteError).toBeNull();
    expect(calls()).toEqual(['POST /api/boards/b2/phase']);
  });

  it('a facilitator without a participant may set the topic', async () => {
    useBoardStore.setState({ currentParticipantId: null });
    routes({ 'POST /api/boards/b1/phase': () => json(200, answer('c2')) });
    await useDiscussStore.getState().setTopic('c2');
    expect(topic()).toBe('c2');
  });

  it('viewTopic stores the viewed topic and a successful setTopic clears it', async () => {
    useDiscussStore.getState().viewTopic('c3');
    expect(useDiscussStore.getState().viewed).toEqual({ boardId: 'b1', phase: 'discuss', cardId: 'c3' });
    routes({ 'POST /api/boards/b1/phase': () => json(200, answer('c2')) });
    await useDiscussStore.getState().setTopic('c2');
    expect(useDiscussStore.getState().viewed).toBeNull();
    useDiscussStore.getState().viewTopic('c3');
    useDiscussStore.getState().viewTopic(null);
    expect(useDiscussStore.getState().viewed).toBeNull();
  });
});

describe('topic actions', () => {
  it('createTopicAction posts the body and adds the answer once, even after the event added it', async () => {
    routes({ 'POST /api/boards/b1/action-items': () => json(200, { item: item({ assignee_participant_id: 'p2' }) }) });
    useBoardStore.setState({ actionItems: [item({ assignee_participant_id: 'p2' })] }); // the event came first
    await useDiscussStore.getState().createTopicAction({ cardId: 'c1', description: 'Fix it', assigneeParticipantId: 'p2' });
    expect(sentBody()).toEqual({ description: 'Fix it', cardId: 'c1', assigneeParticipantId: 'p2' });
    expect(useBoardStore.getState().actionItems).toHaveLength(1);
  });

  it('createTopicAction adds the item when the event has not', async () => {
    routes({ 'POST /api/boards/b1/action-items': () => json(200, { item: item() }) });
    await useDiscussStore.getState().createTopicAction({ cardId: 'c1', description: 'Fix it', assigneeParticipantId: null });
    expect(useBoardStore.getState().actionItems.map((a) => a.id)).toEqual(['i1']);
  });

  it('createTopicAction for a board the user has left adds nothing', async () => {
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().createTopicAction({ cardId: 'c1', description: 'Fix it', assigneeParticipantId: null });
    useBoardStore.setState({ board: board({ id: 'b2' }) });
    d.resolve(json(200, { item: item() }));
    await p;
    expect(useBoardStore.getState().actionItems).toEqual([]);
  });

  it('createTopicAction rejects with the server message on a refusal', async () => {
    routes({ 'POST /api/boards/b1/action-items': () => json(404, { error: 'That topic is not on the agenda' }) });
    await expect(useDiscussStore.getState().createTopicAction({ cardId: 'c9', description: 'x', assigneeParticipantId: null }))
      .rejects.toThrow('That topic is not on the agenda');
    expect(useBoardStore.getState().actionItems).toEqual([]);
  });

  it('assignActionItem shows the owner at once and replaces the item with the answer', async () => {
    useBoardStore.setState({ actionItems: [item()], participants: [person('p2', 'Bo')] });
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().assignActionItem('i1', 'p2');
    expect(useBoardStore.getState().actionItems[0]).toMatchObject({ assignee: 'Bo', assignee_participant_id: 'p2' });
    expect(sentBody()).toEqual({ itemId: 'i1', updates: { assignee_participant_id: 'p2' } });
    d.resolve(json(200, { item: item({ assignee: 'Bo', assignee_participant_id: 'p2', status: 'in_progress' as ActionItem['status'] }) }));
    await p;
    expect(useBoardStore.getState().actionItems[0]).toMatchObject({ assignee: 'Bo', status: 'in_progress' });
  });

  it('a 404 restores the previous owner and rejects with the server message', async () => {
    useBoardStore.setState({ actionItems: [item({ assignee: 'Al', assignee_participant_id: 'p3' })], participants: [person('p2', 'Bo')] });
    routes({ 'PATCH /api/boards/b1/action-items': () => json(404, { error: 'That person is not on this board' }) });
    await expect(useDiscussStore.getState().assignActionItem('i1', 'p2')).rejects.toThrow('That person is not on this board');
    expect(useBoardStore.getState().actionItems[0]).toMatchObject({ assignee: 'Al', assignee_participant_id: 'p3' });
  });

  it('a failure does not restore when the item already shows another owner', async () => {
    useBoardStore.setState({ actionItems: [item()], participants: [person('p2', 'Bo')] });
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().assignActionItem('i1', 'p2');
    useBoardStore.setState({ actionItems: [item({ assignee: 'Cy', assignee_participant_id: 'p4' })] });
    d.resolve(json(404, { error: 'That person is not on this board' }));
    await expect(p).rejects.toThrow();
    expect(useBoardStore.getState().actionItems[0]).toMatchObject({ assignee_participant_id: 'p4' });
  });

  it('assignActionItem for a board the user has left applies nothing and only rejects', async () => {
    useBoardStore.setState({ actionItems: [item()], participants: [person('p2', 'Bo')] });
    const d = deferred<Response>();
    fetchMock = vi.fn(() => d.promise); vi.stubGlobal('fetch', fetchMock);
    const p = useDiscussStore.getState().assignActionItem('i1', 'p2');
    useBoardStore.setState({ board: board({ id: 'b2' }) });
    d.resolve(json(404, { error: 'That person is not on this board' }));
    await expect(p).rejects.toThrow('That person is not on this board');
    expect(useBoardStore.getState().lastWriteError).toBeNull();
    expect(calls()).toEqual(['PATCH /api/boards/b1/action-items']);
  });

  it('clearing the owner sends null and shows no owner', async () => {
    useBoardStore.setState({ actionItems: [item({ assignee: 'Al', assignee_participant_id: 'p3' })] });
    routes({ 'PATCH /api/boards/b1/action-items': () => json(200, { item: item() }) });
    await useDiscussStore.getState().assignActionItem('i1', null);
    expect(sentBody()).toEqual({ itemId: 'i1', updates: { assignee_participant_id: null } });
    expect(useBoardStore.getState().actionItems[0]).toMatchObject({ assignee: null, assignee_participant_id: null });
  });
});
