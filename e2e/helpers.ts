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
  /** 'guided' creates a phase-driven board (needs the guided_mode flag). Omitted means an open board. */
  mode?: 'open' | 'guided';
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
      ...(opts.mode ? { mode: opts.mode } : {}),
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

/** Ask the phase route to move a guided board. Returns the raw response so callers can inspect status. */
export function apiMovePhase(request: APIRequestContext, boardId: string, from: string, to: string) {
  return request.post(`/api/boards/${boardId}/phase`, { data: { action: 'move', from, to } });
}

/**
 * Turn a feature flag on or off for the whole (dev) database. Same dev-only guard as makeLegacyV1.
 * Touches only the row with this key and throws unless exactly one row changed.
 */
export async function setFlagDirect(key: string, enabled: boolean): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('setFlagDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('setFlagDirect refuses to run against the production host');
  const db = neon(url);
  const rows = await db`UPDATE feature_flags SET is_enabled = ${enabled} WHERE key = ${key} RETURNING key`;
  if (rows.length !== 1) throw new Error(`setFlagDirect expected to update exactly one flag, updated ${rows.length}`);
}

// ---- guided group and vote helpers -----------------------------------------

/** Add or remove one vote on a guided board. Returns the raw response so callers can inspect status. */
export function apiVote(request: APIRequestContext, boardId: string, cardId: string, action: 'add' | 'remove') {
  return request.post(`/api/boards/${boardId}/votes`, { data: { cardId, action } });
}

/** POST to the groups route (set-title, reset). Returns the raw response. */
export function apiGroups(request: APIRequestContext, boardId: string, body: Record<string, unknown>) {
  return request.post(`/api/boards/${boardId}/groups`, { data: body });
}

/** Group `childId` under `parentId`, or ungroup it with null (the existing card PATCH). Returns the raw response. */
export function apiCombine(request: APIRequestContext, boardId: string, childId: string, parentId: string | null) {
  return request.patch(`/api/boards/${boardId}/cards`, {
    data: { cardId: childId, updates: { merged_with: parentId } },
  });
}

/**
 * Matches `"key":N` for a number value whether or not the JSON is nested inside an escaped string
 * (Ably frames), like hasJsonField does for strings. The value must end there: 2 matches `"count":2`
 * and `"count":2}` but not `"count":20`, `"count":12` or `"count":2.5`. The key must start at a quote,
 * so `count` does not match `"vote_count":2`.
 * Self-check: hasJsonNumber('{"count":2}', 'count', 2) is true; ('{"count":20}', 'count', 2) and
 * ('{"count":12}', 'count', 2) are false; ('{\\"count\\":2,', 'count', 2) is true.
 */
export function hasJsonNumber(haystack: string, key: string, n: number): boolean {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\\\*"${esc(key)}\\\\*"\\s*:\\s*${esc(String(n))}(?![0-9.])`).test(haystack);
}

/** Every vote row of ONE board, straight from the dev database. Read-only (a SELECT), same dev-only guard. */
export async function voteRowsDirect(
  boardId: string
): Promise<{ voter_id: string; card_id: string; count: number }[]> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('voteRowsDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('voteRowsDirect refuses to run against the production host');
  const db = neon(url);
  const rows = await db`
    SELECT voter_id, card_id, count::int AS count FROM votes
    WHERE board_id = ${boardId} ORDER BY voter_id, card_id`;
  return rows.map((r) => ({ voter_id: r.voter_id as string, card_id: r.card_id as string, count: Number(r.count) }));
}

// ---- guided discuss helpers -------------------------------------------------

/** Add a column through the columns route. Returns the raw response. */
export function apiAddColumn(
  request: APIRequestContext,
  boardId: string,
  column: { id: string; title: string; position: number }
) {
  return request.post(`/api/boards/${boardId}/columns`, {
    data: { ...column, description: null, color: '#cccccc' },
  });
}

/** Make `cardId` the current topic (facilitator only, Discuss only). Returns the raw response. */
export function apiSetTopic(request: APIRequestContext, boardId: string, cardId: string) {
  return request.post(`/api/boards/${boardId}/phase`, { data: { action: 'set-topic', cardId } });
}

/** Post a comment or reply. `body` is `{ cardId, body, anonymous?, parentId? }`. Returns the raw response. */
export function apiComment(request: APIRequestContext, boardId: string, body: Record<string, unknown>) {
  return request.post(`/api/boards/${boardId}/comments`, { data: body });
}

export function apiEditComment(request: APIRequestContext, boardId: string, commentId: string, body: string) {
  return request.patch(`/api/boards/${boardId}/comments`, { data: { commentId, body } });
}

export function apiDeleteComment(request: APIRequestContext, boardId: string, commentId: string) {
  return request.delete(`/api/boards/${boardId}/comments`, { data: { commentId } });
}

/** Create an action item. `body` is `{ description, cardId?, assigneeParticipantId?, ... }`. Returns the raw response. */
export function apiActionItem(request: APIRequestContext, boardId: string, body: Record<string, unknown>) {
  return request.post(`/api/boards/${boardId}/action-items`, { data: body });
}

export function apiPatchActionItem(
  request: APIRequestContext,
  boardId: string,
  itemId: string,
  updates: Record<string, unknown>
) {
  return request.patch(`/api/boards/${boardId}/action-items`, { data: { itemId, updates } });
}

/** Every comment row of ONE board, straight from the dev database. Read-only (a SELECT), same dev-only guards. */
export async function commentRowsDirect(boardId: string): Promise<
  {
    id: string;
    card_id: string;
    parent_id: string | null;
    author_participant_id: string | null;
    is_anonymous: boolean;
    body: string;
    deleted_at: string | null;
  }[]
> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('commentRowsDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('commentRowsDirect refuses to run against the production host');
  const db = neon(url);
  const rows = await db`
    SELECT id, card_id, parent_id, author_participant_id, is_anonymous, body, deleted_at
    FROM comments WHERE board_id = ${boardId} ORDER BY created_at, id`;
  return rows.map((r) => ({
    id: r.id as string,
    card_id: r.card_id as string,
    parent_id: (r.parent_id as string | null) ?? null,
    author_participant_id: (r.author_participant_id as string | null) ?? null,
    is_anonymous: r.is_anonymous as boolean,
    body: r.body as string,
    deleted_at: r.deleted_at === null ? null : new Date(r.deleted_at as string).toISOString(),
  }));
}

/** Every action item row of ONE board, straight from the dev database. Read-only (a SELECT), same dev-only guards. */
export async function actionRowsDirect(boardId: string): Promise<
  {
    id: string;
    card_id: string | null;
    assignee_participant_id: string | null;
    assignee: string | null;
  }[]
> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('actionRowsDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('actionRowsDirect refuses to run against the production host');
  const db = neon(url);
  const rows = await db`
    SELECT id, card_id, assignee_participant_id, assignee
    FROM action_items WHERE board_id = ${boardId} ORDER BY created_at`;
  return rows.map((r) => ({
    id: r.id as string,
    card_id: (r.card_id as string | null) ?? null,
    assignee_participant_id: (r.assignee_participant_id as string | null) ?? null,
    assignee: (r.assignee as string | null) ?? null,
  }));
}

// ---- wrap-up helpers: throwaway accounts, the summary email outbox ----------------------------
//
// Every helper below carries the same two dev-only guards as voteRowsDirect and touches only rows this
// run created: accounts whose id starts with `e2e` and whose address is `e2e-...@example.com`, and
// boards titled `e2e <id>`. None of them selects, returns or logs any other row of "user". The
// outbox readers return only the rows of the board id they are given, and fail (printing only a
// count) if any address does not end in @example.com.

const E2E_USER_ID_PREFIX = 'e2e';
const E2E_ADDRESS_SUFFIX = '@example.com';

/** Create a throwaway account (verified or not) with an `e2e-<random>@example.com` address. */
export async function createUserDirect(opts: {
  verified: boolean;
}): Promise<{ id: string; email: string; name: string }> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('createUserDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('createUserDirect refuses to run against the production host');
  const db = neon(url);
  // Read the table's shape once: if a required column appears that this insert does not fill, say so clearly.
  const filled = ['id', 'name', 'email', 'emailVerified', 'createdAt', 'updatedAt'];
  const required = await db`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user' AND is_nullable = 'NO' AND column_default IS NULL`;
  const missing = required.map((r) => r.column_name as string).filter((c) => !filled.includes(c));
  if (missing.length > 0) {
    throw new Error(`createUserDirect: "user" has NOT NULL columns without a default that this helper does not fill: ${missing.join(', ')}`);
  }
  const id = E2E_USER_ID_PREFIX + nanoid(20);
  const name = `E2E User ${nanoid(6)}`;
  const email = `e2e-${nanoid(10).toLowerCase()}${E2E_ADDRESS_SUFFIX}`;
  await db`
    INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    VALUES (${id}, ${name}, ${email}, ${opts.verified}, now(), now())`;
  return { id, name, email };
}

function requireE2eUserId(who: string, userId: string) {
  if (!userId.startsWith(E2E_USER_ID_PREFIX)) throw new Error(`${who} only touches throwaway accounts (id starting "e2e")`);
}

/** Make a throwaway account the owner of ONE board we created. Same dev-only guards. */
export async function setBoardOwnerDirect(boardId: string, userId: string): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('setBoardOwnerDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('setBoardOwnerDirect refuses to run against the production host');
  requireE2eUserId('setBoardOwnerDirect', userId);
  const db = neon(url);
  const rows = await db`
    UPDATE boards SET owner_id = ${userId}
    WHERE id = ${boardId} AND title = ${`e2e ${boardId}`}
      AND EXISTS (SELECT 1 FROM "user" WHERE id = ${userId} AND email LIKE ${'e2e-%' + E2E_ADDRESS_SUFFIX})
    RETURNING id`;
  if (rows.length !== 1) throw new Error(`setBoardOwnerDirect touched ${rows.length} rows`);
}

/** Link ONE participant of a board we created to a throwaway account. Same dev-only guards. */
export async function linkParticipantUserDirect(boardId: string, participantId: string, userId: string): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('linkParticipantUserDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('linkParticipantUserDirect refuses to run against the production host');
  requireE2eUserId('linkParticipantUserDirect', userId);
  const db = neon(url);
  const rows = await db`
    UPDATE participants SET user_id = ${userId}
    WHERE id = ${participantId} AND board_id = ${boardId}
      AND EXISTS (SELECT 1 FROM boards WHERE id = ${boardId} AND title = ${`e2e ${boardId}`})
      AND EXISTS (SELECT 1 FROM "user" WHERE id = ${userId} AND email LIKE ${'e2e-%' + E2E_ADDRESS_SUFFIX})
    RETURNING id`;
  if (rows.length !== 1) throw new Error(`linkParticipantUserDirect touched ${rows.length} rows`);
}

/** Add a throwaway account as a member of ONE board we created. Same dev-only guards. */
export async function addMemberDirect(
  boardId: string,
  userId: string,
  role: 'facilitator' | 'participant' | 'viewer'
): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('addMemberDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('addMemberDirect refuses to run against the production host');
  requireE2eUserId('addMemberDirect', userId);
  const db = neon(url);
  const rows = await db`
    INSERT INTO board_members (board_id, user_id, role)
    SELECT b.id, u.id, ${role}
    FROM boards b, "user" u
    WHERE b.id = ${boardId} AND b.title = ${`e2e ${boardId}`}
      AND u.id = ${userId} AND u.email LIKE ${'e2e-%' + E2E_ADDRESS_SUFFIX}
    RETURNING id`;
  if (rows.length !== 1) throw new Error(`addMemberDirect inserted ${rows.length} rows`);
}

/** The same upsert as the account setting and the unsubscribe route, for a throwaway account only. Same dev-only guards. */
export async function setSummaryPreferenceDirect(userId: string, enabled: boolean): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('setSummaryPreferenceDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('setSummaryPreferenceDirect refuses to run against the production host');
  requireE2eUserId('setSummaryPreferenceDirect', userId);
  const db = neon(url);
  const rows = await db`
    INSERT INTO email_preferences (user_id, summary_email, updated_at)
    SELECT ${userId}, ${enabled}::boolean, now()
    WHERE EXISTS (SELECT 1 FROM "user" WHERE id = ${userId} AND email LIKE ${'e2e-%' + E2E_ADDRESS_SUFFIX})
    ON CONFLICT (user_id) DO UPDATE SET summary_email = EXCLUDED.summary_email, updated_at = now()
    RETURNING user_id`;
  if (rows.length !== 1) throw new Error(`setSummaryPreferenceDirect wrote ${rows.length} rows`);
}

/** A throwaway account's stored preference, or null when it has no row. Read-only. Same dev-only guards. */
export async function preferenceDirect(userId: string): Promise<boolean | null> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('preferenceDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('preferenceDirect refuses to run against the production host');
  requireE2eUserId('preferenceDirect', userId);
  const db = neon(url);
  const rows = await db`SELECT summary_email FROM email_preferences WHERE user_id = ${userId}`;
  return rows.length === 0 ? null : (rows[0].summary_email as boolean);
}

/**
 * Every outbox row of ONE board we created, ordered by address. Read-only (a SELECT), same dev-only guards.
 * Fails loudly, printing only a count, if any row is addressed outside @example.com.
 */
export async function outboxRowsDirect(boardId: string): Promise<
  { to_address: string; subject: string; text_body: string; html_body: string; headers: Record<string, string> }[]
> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('outboxRowsDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('outboxRowsDirect refuses to run against the production host');
  const db = neon(url);
  const rows = await db`
    SELECT o.to_address, o.subject, o.text_body, o.html_body, o.headers
    FROM email_outbox o JOIN boards b ON b.id = o.board_id
    WHERE o.board_id = ${boardId} AND b.title = ${`e2e ${boardId}`}
    ORDER BY o.to_address`;
  const offending = rows.filter((r) => !(r.to_address as string).endsWith(E2E_ADDRESS_SUFFIX)).length;
  if (offending > 0) throw new Error(`${offending} outbox row(s) are addressed outside ${E2E_ADDRESS_SUFFIX}`);
  return rows.map((r) => ({
    to_address: r.to_address as string,
    subject: r.subject as string,
    text_body: r.text_body as string,
    html_body: r.html_body as string,
    headers: r.headers as Record<string, string>,
  }));
}

/** Every summary-send row of ONE board we created, ordered by user id. Read-only. Same dev-only guards. */
export async function summarySendsDirect(
  boardId: string
): Promise<{ user_id: string; status: string; error: string | null }[]> {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NEON_BRANCH !== 'dev') throw new Error('summarySendsDirect refuses to run unless NEON_BRANCH=dev');
  if (url.includes('ep-delicate-star')) throw new Error('summarySendsDirect refuses to run against the production host');
  const db = neon(url);
  const rows = await db`
    SELECT s.user_id, s.status, s.error
    FROM summary_email_sends s JOIN boards b ON b.id = s.board_id
    WHERE s.board_id = ${boardId} AND b.title = ${`e2e ${boardId}`}
    ORDER BY s.user_id`;
  return rows.map((r) => ({
    user_id: r.user_id as string,
    status: r.status as string,
    error: (r.error as string | null) ?? null,
  }));
}

/** Complete a board through the board route (`{ action: 'complete' }`). Returns the raw response. */
export function apiComplete(request: APIRequestContext, boardId: string) {
  return request.post(`/api/boards/${boardId}`, { data: { action: 'complete' } });
}
