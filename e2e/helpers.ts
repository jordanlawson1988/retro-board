import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { neon } from '@neondatabase/serverless';
import { nanoid } from 'nanoid';

/** Board settings the server stores; mirrors utils/constants DEFAULT_BOARD_SETTINGS. */
export const BASE_SETTINGS = {
  card_visibility: 'hidden',
  voting_enabled: false,
  max_votes_per_participant: 5,
  secret_voting: false,
  board_locked: false,
  card_creation_disabled: false,
  anonymous_cards: false,
  highlighted_card_id: null,
  timer: { duration: 0, remaining: 0, status: 'idle', started_at: null },
};

export interface CreateBoardOpts {
  settings?: Record<string, unknown>;
  /** When set, the creator is inserted as a participant at creation time. */
  displayName?: string;
}

export interface CreatedBoard {
  boardId: string;
  joinCode: string;
  /** Present only when displayName was given. */
  participantId: string | null;
  columnId: string;
}

/** Create a board through the real API. The cookie lands in `request`'s jar. */
export async function createBoard(
  request: APIRequestContext,
  opts: CreateBoardOpts = {}
): Promise<CreatedBoard> {
  const boardId = nanoid(10);
  const columnId = nanoid(10);
  const res = await request.post('/api/boards', {
    data: {
      id: boardId,
      title: `e2e ${boardId}`,
      description: null,
      template: 'start-stop-continue',
      settings: { ...BASE_SETTINGS, ...(opts.settings ?? {}) },
      columns: [{ id: columnId, title: 'Col', description: null, color: '#cccccc', position: 0 }],
      participant: opts.displayName ? { displayName: opts.displayName } : undefined,
    },
  });
  expect(res.status(), `create board: ${await res.text()}`).toBe(200);
  const json = await res.json();
  return { boardId, joinCode: json.joinCode, participantId: json.participantId, columnId };
}

/** Join through the API (no browser). Returns the raw response so callers can inspect status. */
export function apiJoin(
  request: APIRequestContext,
  boardId: string,
  displayName: string,
  extra: Record<string, unknown> = {}
) {
  return request.post(`/api/boards/${boardId}/join`, { data: { displayName, ...extra } });
}

export async function getBoard(request: APIRequestContext, boardId: string) {
  const res = await request.get(`/api/boards/${boardId}`);
  expect(res.status()).toBe(200);
  return res.json();
}

export function newCardBody(columnId: string, text = `card-${nanoid(6)}`) {
  return { id: nanoid(10), columnId, text, position: 0 };
}

/** Add a card through the API as whoever owns `request`'s cookie. */
export function apiAddCard(request: APIRequestContext, boardId: string, columnId: string, text?: string) {
  const body = newCardBody(columnId, text);
  return { body, response: request.post(`/api/boards/${boardId}/cards`, { data: body }) };
}

export function patchSettings(request: APIRequestContext, boardId: string, settings: Record<string, unknown>) {
  return request.patch(`/api/boards/${boardId}`, { data: { settings } });
}

/**
 * Open the board in a fresh page of `context` and join through the join modal.
 * `beforeGoto` lets a caller attach network listeners before any request is made.
 */
export async function joinAs(
  context: BrowserContext,
  boardId: string,
  name: string,
  opts: { beforeGoto?: (page: Page) => void } = {}
): Promise<Page> {
  const page = await context.newPage();
  opts.beforeGoto?.(page);
  await page.goto(`/board/${boardId}`);
  await expect(page.getByText('Join Retrospective')).toBeVisible();
  await page.locator('#display-name').fill(name);
  await page.getByRole('button', { name: 'Join Board' }).click();
  await expect(page.getByText('Join Retrospective')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add a card' }).first()).toBeVisible();
  return page;
}

/** Everything a page received over HTTP (app JSON/documents) and websockets. */
export interface Capture {
  bodies: string[];
  frames: string[];
  /** Resolves once every response body that was in flight has been read. */
  settle(): Promise<void>;
  all(): string;
}

export function capture(page: Page): Capture {
  const bodies: string[] = [];
  const frames: string[] = [];
  const pending: Promise<void>[] = [];

  page.on('response', (res) => {
    const type = res.request().resourceType();
    if (!['document', 'fetch', 'xhr', 'eventsource'].includes(type)) return;
    pending.push(
      res
        .text()
        .then((t) => {
          bodies.push(t);
        })
        .catch(() => {
          /* redirects and aborted responses have no body */
        })
    );
  });
  page.on('websocket', (ws) => {
    ws.on('framereceived', (f) => {
      frames.push(typeof f.payload === 'string' ? f.payload : f.payload.toString('utf8'));
    });
  });

  return {
    bodies,
    frames,
    settle: async () => {
      await Promise.allSettled(pending);
    },
    all: () => [...bodies, ...frames].join('\n'),
  };
}

/** Matches `"key":"value"` whether or not the JSON is nested inside an escaped string (Ably frames). */
export function hasJsonField(haystack: string, key: string, value: string): boolean {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${esc(key)}\\\\*"\\s*:\\s*\\\\*"${esc(value)}`).test(haystack);
}

// ---- v1 (legacy) boards ----------------------------------------------------

/**
 * Flip ONE board we just created to the legacy trust model. Refuses to run unless
 * the connected database is the dev branch, and only ever touches the given id.
 */
export async function makeLegacyV1(boardId: string): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('makeLegacyV1 refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('makeLegacyV1 refuses to run against the production host');
  const db = neon(url);
  const rows = await db`UPDATE boards SET trust_version = 1 WHERE id = ${boardId} AND title = ${`e2e ${boardId}`} RETURNING id`;
  if (rows.length !== 1) throw new Error(`Expected to update exactly one e2e board, updated ${rows.length}`);
}

/**
 * Legacy-board fixtures: set raw columns on ONE board we created. Same dev-only guard.
 * `settingsPatch` is merged into boards.settings; `archived` sets archived_at.
 */
export async function legacyUpdate(
  boardId: string,
  change: { settingsPatch?: Record<string, unknown>; archived?: boolean }
): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('legacyUpdate refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('legacyUpdate refuses to run against the production host');
  const db = neon(url);
  const title = `e2e ${boardId}`;
  if (change.settingsPatch) {
    const rows = await db`
      UPDATE boards SET settings = (settings::jsonb || ${JSON.stringify(change.settingsPatch)}::jsonb)
      WHERE id = ${boardId} AND title = ${title} AND trust_version = 1 RETURNING id`;
    if (rows.length !== 1) throw new Error(`legacyUpdate settings touched ${rows.length} rows`);
  }
  if (change.archived) {
    const rows = await db`
      UPDATE boards SET archived_at = now()
      WHERE id = ${boardId} AND title = ${title} AND trust_version = 1 RETURNING id`;
    if (rows.length !== 1) throw new Error(`legacyUpdate archive touched ${rows.length} rows`);
  }
}

/** The raw signed participant cookie value for a board held by `request`, or null. */
export async function cookieValue(request: APIRequestContext, boardId: string): Promise<string | null> {
  const state = await request.storageState();
  return state.cookies.find((c) => c.name === `rb_ps_${boardId}`)?.value ?? null;
}

/** A request context that sends exactly one hand-written Cookie header (for forged/foreign cookies). */
export async function withRawCookie(
  playwright: import('@playwright/test').PlaywrightWorkerArgs['playwright'],
  baseURL: string,
  name: string,
  value: string
): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `${name}=${value}` } });
}

/** The one visible element showing `text` (the board renders desktop and mobile copies; one is hidden). */
export function shown(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true }).first();
}

/** Visible "hidden until reveal" placeholders (one per hidden card on screen). */
export function hiddenCards(page: Page) {
  return page.getByTestId('card-text-hidden').filter({ visible: true });
}

/**
 * Resolve once the page's Ably connection has ATTACHED to the board channel. (Counting any
 * websocket frame is not enough: the Next dev server's HMR socket sends frames too.)
 * Pass `sinceFrame` after a reload to wait for the NEW connection's attach.
 */
export async function waitForRealtime(cap: Capture, boardId: string, sinceFrame = 0): Promise<void> {
  await expect
    .poll(
      () => cap.frames.slice(sinceFrame).some((f) => f.includes('"action":11') && f.includes(`"channel":"retro-board:${boardId}"`)),
      { timeout: 20_000 }
    )
    .toBe(true);
}

/**
 * Set or clear archived_at on ONE board we created (any trust version). Same dev-only guard.
 * Stands in for complete/reopen when the caller has no owner account: the real reopen
 * action needs a signed-in owner and sign-up is behind a CAPTCHA.
 */
export async function setArchivedDirect(boardId: string, archived: boolean): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('setArchivedDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('setArchivedDirect refuses to run against the production host');
  const db = neon(url);
  const rows = archived
    ? await db`UPDATE boards SET archived_at = now() WHERE id = ${boardId} AND title = ${`e2e ${boardId}`} RETURNING id`
    : await db`UPDATE boards SET archived_at = NULL WHERE id = ${boardId} AND title = ${`e2e ${boardId}`} RETURNING id`;
  if (rows.length !== 1) throw new Error(`setArchivedDirect touched ${rows.length} rows`);
}

/** A card's `updated_at` straight from the dev database (ISO string), or null if absent. Read-only. */
export async function cardUpdatedAt(boardId: string, cardId: string): Promise<string | null> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('cardUpdatedAt refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('cardUpdatedAt refuses to run against the production host');
  const db = neon(url);
  const rows = await db`SELECT updated_at FROM cards WHERE id = ${cardId} AND board_id = ${boardId}`;
  return rows.length === 1 ? new Date(rows[0].updated_at as string).toISOString() : null;
}
