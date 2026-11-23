import { describe, it, expect, afterEach, vi } from 'vitest';
import { postNewBoard } from '../create-board-request';
import {
  CREATE_BOARD_FAILED,
  CREATE_BOARD_TIMED_OUT,
  CREATE_BOARD_TIMEOUT_MS,
  CREATE_BOARD_UNREACHABLE,
} from '../constants/create-board';

const BODY = { id: 'abc', title: 'T', columns: [] };
const jsonRes = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const textRes = (status: number, body: string, type = 'text/html') =>
  new Response(body, { status, headers: { 'Content-Type': type } });
const asFetch = (fn: unknown) => fn as typeof fetch;

/** A fetch that never settles; records the signal it was given. */
function hangingFetch() {
  const seen: { signal?: AbortSignal | null } = {};
  const fn = vi.fn((_url: unknown, init?: RequestInit) => {
    seen.signal = init?.signal;
    return new Promise<Response>(() => {});
  });
  return { fn: asFetch(fn), seen };
}

async function failure(p: Promise<unknown>): Promise<Error> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
    return e as Error;
  }
  throw new Error('expected a rejection');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('postNewBoard', () => {
  it('declares the limit as 20 seconds', () => {
    expect(CREATE_BOARD_TIMEOUT_MS).toBe(20000);
  });

  it('resolves with the parsed success body and clears its timer', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => jsonRes(200, { participantId: 'p1' }));
    const out = await postNewBoard(BODY, { fetchImpl: asFetch(fetchImpl) });
    expect(out).toEqual({ participantId: 'p1' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/boards');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe(JSON.stringify(BODY));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a fetch that never settles, aborts it, and leaves no timer', async () => {
    vi.useFakeTimers();
    const { fn, seen } = hangingFetch();
    let settled = false;
    const p = postNewBoard(BODY, { fetchImpl: fn });
    const caught = failure(p);
    p.catch(() => {}).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(CREATE_BOARD_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    expect(seen.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const err = await caught;
    expect(err.message).toBe(CREATE_BOARD_TIMED_OUT);
    expect(seen.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('honours a custom timeoutMs', async () => {
    vi.useFakeTimers();
    const { fn } = hangingFetch();
    const caught = failure(postNewBoard(BODY, { fetchImpl: fn, timeoutMs: 500 }));
    await vi.advanceTimersByTimeAsync(500);
    expect((await caught).message).toBe(CREATE_BOARD_TIMED_OUT);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports a rejected fetch as unreachable, without the raw message', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await failure(postNewBoard(BODY, { fetchImpl: asFetch(fetchImpl) }));
    expect(err.message).toBe(CREATE_BOARD_UNREACHABLE);
    expect(err.message).not.toContain('Failed to fetch');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes the server error text through for a 429', async () => {
    vi.useFakeTimers();
    const msg = 'Too many requests. Try again in a minute.';
    const fetchImpl = vi.fn(async () => jsonRes(429, { error: msg }));
    const err = await failure(postNewBoard(BODY, { fetchImpl: asFetch(fetchImpl) }));
    expect(err.message).toBe(msg);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes the server error text through for a 403', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => jsonRes(403, { error: 'Guided mode is not available' }));
    const err = await failure(postNewBoard(BODY, { fetchImpl: asFetch(fetchImpl) }));
    expect(err.message).toBe('Guided mode is not available');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the failure text for a 504 with an HTML body', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => textRes(504, '<html>Gateway Timeout</html>'));
    const err = await failure(postNewBoard(BODY, { fetchImpl: asFetch(fetchImpl) }));
    expect(err.message).toBe(CREATE_BOARD_FAILED);
    expect(err.message).not.toMatch(/Unexpected token|SyntaxError/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['an empty JSON object', {}],
    ['a non-string error', { error: 42 }],
  ])('uses the failure text for a 500 with %s', async (_label, payload) => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => jsonRes(500, payload));
    const err = await failure(postNewBoard(BODY, { fetchImpl: asFetch(fetchImpl) }));
    expect(err.message).toBe(CREATE_BOARD_FAILED);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the failure text for a 200 whose body is not JSON', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => textRes(200, 'ok but not json', 'text/plain'));
    const err = await failure(postNewBoard(BODY, { fetchImpl: asFetch(fetchImpl) }));
    expect(err.message).toBe(CREATE_BOARD_FAILED);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['an OK response', true, 200],
    ['an error response', false, 502],
  ])('times out when the body of %s stalls', async (_label, ok, status) => {
    vi.useFakeTimers();
    const stalled = { ok, status, json: () => new Promise(() => {}) } as unknown as Response;
    const fetchImpl = vi.fn(async () => stalled);
    const caught = failure(postNewBoard(BODY, { fetchImpl: asFetch(fetchImpl) }));
    await vi.advanceTimersByTimeAsync(CREATE_BOARD_TIMEOUT_MS);
    expect((await caught).message).toBe(CREATE_BOARD_TIMED_OUT);
    expect(vi.getTimerCount()).toBe(0);
  });
});
