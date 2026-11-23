import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NO_DUE_DATE } from '@/lib/constants/email';
import { DUE_PREFIX } from '@/lib/constants/summary';
import { verifyUnsubscribeToken } from '@/lib/email-unsubscribe';

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  txn: vi.fn(),
  canUse: vi.fn(),
  send: vi.fn(),
  renderThrowOn: null as string | null,
}));

vi.mock('@/lib/db', () => ({
  sql: (...a: unknown[]) => mocks.sql(...a),
  sqlTransaction: (...a: unknown[]) => mocks.txn(...a),
}));
vi.mock('@/lib/can-use', () => ({
  canUse: (...a: unknown[]) => mocks.canUse(...a),
  FEATURES: ['guided_mode', 'summary_email'],
}));
vi.mock('@/lib/mail/send', () => ({ sendMail: (...a: unknown[]) => mocks.send(...a) }));

vi.mock('@/lib/summary-email/render', async () => {
  const actual = await vi.importActual<typeof import('@/lib/summary-email/render')>('@/lib/summary-email/render');
  return {
    ...actual,
    renderSummaryEmail: (...a: Parameters<typeof actual.renderSummaryEmail>) => {
      if (mocks.renderThrowOn !== null && a[1] === mocks.renderThrowOn) throw new Error('RENDER-SECRET ' + a[1]);
      return actual.renderSummaryEmail(...a);
    },
  };
});

import { dispatchSummaryEmail } from '@/lib/summary-email/dispatch';

const SECRET = 'test-secret-test-secret-test-secret-0123';
const COMPLETED = '2026-11-21T10:00:00.123Z';
const at = (ms: number) => new Date(Date.UTC(2026, 10, 21, 9, 0, 0, ms)).toISOString();
const env = { NEXT_PUBLIC_APP_URL: 'https://x.test' };

/** The snapshot as the Neon driver returns it (every date a Date), or the same rows with ISO strings. */
function buildSnapshot(asDate: boolean) {
  const d = (ms: number) => (asDate ? new Date(Date.UTC(2026, 10, 21, 9, 0, 0, ms)) : at(ms));
  const dueDate = asDate ? new Date(Date.UTC(2026, 10, 30)) : new Date(Date.UTC(2026, 10, 30)).toISOString();
  const card = (id: string, ms: number, over: Record<string, unknown> = {}) => ({
    id, column_id: 'col', board_id: 'b1', text: `text ${id}`, author_name: 'AUTHOR-SECRET', author_id: 'p1', color: null,
    position: 0, merged_with: null, group_title: null, reactions: {}, created_at: d(ms), updated_at: d(ms), ...over,
  });
  return [
    [{ id: 'b1', title: 'Sprint 12', archived_at: asDate ? new Date(COMPLETED) : COMPLETED, trust_version: 2, settings: { anonymous_cards: true } }],
    [card('L', 1, { group_title: 'Deploys' }), card('k', 3, { merged_with: 'L', text: 'CHILD-SECRET' }), card('S', 2, { text: 'Slow builds' })],
    [{ id: 'v1', card_id: 'L', board_id: 'b1', voter_id: 'p1', count: 2, created_at: d(0) }],
    [
      { id: 'i1', board_id: 'b1', description: 'Write the runbook', assignee: null, due_date: null, status: 'open', created_at: d(1), card_id: 'L' },
      { id: 'i2', board_id: 'b1', description: 'Ship the fix', assignee: 'Bo', due_date: dueDate, status: 'open', created_at: d(2), card_id: 'S' },
    ],
    [{ id: 'p1', board_id: 'b1', display_name: 'AUTHOR-SECRET', is_admin: true, user_id: null, joined_at: d(0), last_seen: d(0) }],
    [{ id: 'c1', board_id: 'b1', card_id: 'L', parent_id: null, author_participant_id: 'p1', author_name: 'AUTHOR-SECRET',
      is_anonymous: true, body: 'COMMENT-SECRET', created_at: d(1), edited_at: null, deleted_at: null }],
  ];
}
const snapshot = buildSnapshot(true);
const claimed = [{ user_id: 'u1', email: 'a@example.com' }, { user_id: 'u2', email: 'b@example.com' }];

const text = (call: unknown[]) => (call[0] as string[]).join('?').replace(/\s+/g, ' ');
const values = (call: unknown[]) => call.slice(1);

/** Runs the transaction builder with a txn spy; returns the canned snapshot. */
function setup(opts: { rows?: unknown[]; snapshotRows?: unknown[][] } = {}) {
  const txnCalls: unknown[][] = [];
  mocks.txn.mockImplementation(async (build: (t: (...a: unknown[]) => unknown) => unknown[]) => {
    build((...a: unknown[]) => { txnCalls.push(a); return a; });
    return opts.snapshotRows ?? snapshot;
  });
  mocks.canUse.mockResolvedValue(true);
  mocks.sql.mockResolvedValueOnce(opts.rows ?? claimed).mockResolvedValue([]);
  return txnCalls;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of [mocks.sql, mocks.txn, mocks.canUse, mocks.send]) m.mockReset();
  mocks.renderThrowOn = null;
  vi.stubEnv('PARTICIPANT_SESSION_SECRET', SECRET);
  mocks.send.mockResolvedValue({ ok: true, transport: 'outbox' });
});
afterEach(() => vi.unstubAllEnvs());

describe('dispatchSummaryEmail', () => {
  it('flag off: does nothing else', async () => {
    mocks.canUse.mockResolvedValue(false);
    expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('flag-off');
    expect(mocks.txn).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.canUse).toHaveBeenCalledWith('summary_email', null);
  });

  it('reads a six-statement read-only snapshot keyed by the completion time and the guided mode', async () => {
    const calls = setup();
    await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env);
    expect(calls).toHaveLength(6);
    expect(text(calls[0])).toContain('archived_at = ?::timestamptz');
    expect(text(calls[0])).toContain('mode = ?');
    expect(text(calls[0])).toContain('deleted_at IS NULL');
    expect(values(calls[0])).toEqual(['b1', COMPLETED, 'guided']);
    expect(text(calls[5])).toContain('FROM comments');
    expect(mocks.txn.mock.calls[0][1]).toEqual({ readOnly: true, isolationLevel: 'RepeatableRead' });
  });

  it('no board row (reopened, completed again, trashed): stale, no claim, no send', async () => {
    setup({ snapshotRows: [[], [], [], [], [], []] });
    expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('stale');
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('the claim selects verified, opted-in people once and writes the intent first', async () => {
    setup({ rows: [] });
    expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('no-recipients');
    const claim = mocks.sql.mock.calls[0];
    const t = text(claim);
    for (const part of [
      'UNION', 'SELECT owner_id AS user_id FROM board', 'FROM board_members m', 'LEFT JOIN email_preferences ep',
      'COALESCE(ep.summary_email, true)', 'u."emailVerified" = true', 'LIMIT ?',
      'ON CONFLICT (board_id, completed_at, user_id) DO NOTHING',
    ]) expect(t).toContain(part);
    expect(t).not.toContain('FROM participants');
    expect(values(claim)).toEqual(expect.arrayContaining(['b1', COMPLETED, 100, 'pending']));
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('the same completedAt string is the parameter of the snapshot, the claim and the status update', async () => {
    const calls = setup();
    await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env);
    expect(values(calls[0])).toContain(COMPLETED);
    expect(values(mocks.sql.mock.calls[0])).toContain(COMPLETED);
    expect(values(mocks.sql.mock.calls[1])).toContain(COMPLETED);
    // never read back from a row
    expect(values(mocks.sql.mock.calls[0]).filter((v) => typeof v === 'string' && v.startsWith('2026-'))).toEqual([COMPLETED, COMPLETED]);
  });

  it('sends one batch to exactly the claimed rows, records, and a repeat for the same completion sends to nobody', async () => {
    setup();
    expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('recorded');
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const batch = mocks.send.mock.calls[0][0];
    expect(batch).toMatchObject({ kind: 'summary', boardId: 'b1', key: `summary/b1/${Date.parse(COMPLETED)}` });
    expect(batch.messages.map((m: { to: string }) => m.to)).toEqual(['a@example.com', 'b@example.com']);
    batch.messages.forEach((m: { headers: Record<string, string> }, i: number) => {
      const token = decodeURIComponent((m.headers['List-Unsubscribe'].match(/token=([^>&]+)/) as RegExpMatchArray)[1]);
      expect(verifyUnsubscribeToken(token)).toEqual({ userId: claimed[i].user_id });
    });
    const update = mocks.sql.mock.calls[1];
    expect(text(update)).toContain('UPDATE summary_email_sends');
    expect(values(update)).toEqual(expect.arrayContaining(['recorded', ['u1', 'u2'], 'b1', COMPLETED, 'pending']));

    // Second dispatch: the claim's ON CONFLICT DO NOTHING returns no rows, so nobody is mailed.
    mocks.send.mockClear();
    mocks.sql.mockReset();
    mocks.sql.mockResolvedValueOnce([]).mockResolvedValue([]);
    expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('no-recipients');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('never mails an address the claim did not return', async () => {
    setup({ rows: [{ user_id: 'u9', email: 'only@example.com' }] });
    await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env);
    expect(mocks.send.mock.calls[0][0].messages.map((m: { to: string }) => m.to)).toEqual(['only@example.com']);
  });

  it('no message part carries an author name or a comment body', async () => {
    setup();
    await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env);
    for (const m of mocks.send.mock.calls[0][0].messages) {
      const all = JSON.stringify([m.subject, m.text, m.html, m.headers]);
      expect(all).not.toContain('AUTHOR-SECRET');
      expect(all).not.toContain('COMMENT-SECRET');
    }
    const first = mocks.send.mock.calls[0][0].messages[0];
    expect(first.text).toContain('Deploys');
  });

  it('a resend success is sent', async () => {
    setup();
    mocks.send.mockResolvedValue({ ok: true, transport: 'resend' });
    expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('sent');
    expect(values(mocks.sql.mock.calls[1])).toContain('sent');
  });

  it('a failed send is recorded failed with the error', async () => {
    setup();
    mocks.send.mockResolvedValue({ ok: false, transport: 'outbox', error: 'boom' });
    expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('failed');
    expect(values(mocks.sql.mock.calls[1])).toEqual(expect.arrayContaining(['failed', 'boom']));
  });

  it('no base URL: the claimed rows are marked failed and nothing is sent', async () => {
    setup();
    expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, {})).toBe('failed');
    expect(mocks.send).not.toHaveBeenCalled();
    expect(values(mocks.sql.mock.calls[1])).toEqual(expect.arrayContaining(['failed', 'No base URL is configured', ['u1', 'u2']]));
  });

  it('a database error is logged by code only and returns error', async () => {
    mocks.canUse.mockResolvedValue(true);
    mocks.txn.mockRejectedValue({ code: '42P01', message: 'relation does not exist ... Failing row contains (secret@example.com)', detail: 'Failing row' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('error');
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0].join(' '));
    expect(line).toContain('42P01');
    expect(line).toContain('b1');
    expect(line).not.toContain('Failing row');
    expect(line).not.toContain('secret@example.com');
    spy.mockRestore();
  });

  it('an error with only a name logs the name, and a throw from the flag lookup is caught', async () => {
    mocks.canUse.mockRejectedValue(new TypeError('address a@example.com'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('error');
    const line = String(spy.mock.calls[0].join(' '));
    expect(line).toContain('TypeError');
    expect(line).not.toContain('a@example.com');
    spy.mockRestore();
  });

  describe('a throw after the claim', () => {
    const FAILED_TEXT = 'build failed';
    const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});
    const failedUpdates = () => mocks.sql.mock.calls.slice(1).filter((c) => text(c).includes('UPDATE summary_email_sends'));

    it('a token that cannot be signed marks both claimed rows failed and sends nothing', async () => {
      setup();
      vi.stubEnv('PARTICIPANT_SESSION_SECRET', '');
      const spy = quiet();
      expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('error');
      expect(mocks.send).not.toHaveBeenCalled();
      expect(failedUpdates()).toHaveLength(1);
      expect(values(failedUpdates()[0])).toEqual(expect.arrayContaining(['failed', FAILED_TEXT, 'b1', COMPLETED, ['u1', 'u2'], 'pending']));
      const line = spy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(line).not.toContain('PARTICIPANT_SESSION_SECRET');
      expect(line).not.toContain('@');
      spy.mockRestore();
    });

    it('a render that throws for the second recipient fails both rows; a batch is all or nothing', async () => {
      setup();
      mocks.renderThrowOn = 'b@example.com';
      const spy = quiet();
      expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('error');
      expect(mocks.send).not.toHaveBeenCalled();
      expect(failedUpdates()).toHaveLength(1);
      expect(values(failedUpdates()[0])).toEqual(expect.arrayContaining(['failed', FAILED_TEXT, COMPLETED, ['u1', 'u2'], 'pending']));
      const line = spy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(line).not.toContain('RENDER-SECRET');
      expect(line).not.toContain('@');
      spy.mockRestore();
    });

    it('a status update that fails after sendMail was called never marks rows failed', async () => {
      setup();
      mocks.sql.mockReset();
      mocks.sql.mockResolvedValueOnce(claimed).mockRejectedValueOnce({ code: '57014', message: 'a@example.com' });
      const spy = quiet();
      expect(await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).toBe('error');
      expect(mocks.send).toHaveBeenCalledTimes(1);
      expect(mocks.sql).toHaveBeenCalledTimes(2);
      expect(mocks.sql.mock.calls.filter((c) => values(c).includes('failed'))).toHaveLength(0);
      spy.mockRestore();
    });

    it('the best-effort update itself failing still resolves to error and throws nothing', async () => {
      setup();
      vi.stubEnv('PARTICIPANT_SESSION_SECRET', '');
      mocks.sql.mockReset();
      mocks.sql.mockResolvedValueOnce(claimed).mockRejectedValueOnce({ code: '08006', message: 'a@example.com' });
      const spy = quiet();
      await expect(dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env)).resolves.toBe('error');
      expect(mocks.send).not.toHaveBeenCalled();
      const line = spy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(line).toContain('08006');
      expect(line).not.toContain('@');
      spy.mockRestore();
    });
  });

  it('the claim keeps the reopen guard: the board CTE binds this completedAt and excludes trashed boards', async () => {
    setup({ rows: [] });
    await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env);
    const claim = mocks.sql.mock.calls[0];
    const t = text(claim);
    const cte = t.slice(t.indexOf('WITH board AS ('), t.indexOf('), people AS'));
    expect(cte).toContain('FROM boards');
    expect(cte).toContain('archived_at = ?::timestamptz');
    expect(cte).toContain('deleted_at IS NULL');
    // the two placeholders of the CTE are the board id then the completion string
    expect(values(claim).slice(0, 2)).toEqual(['b1', COMPLETED]);
  });

  it('logs once that the recipient cap was reached, with no address or id, and not below the cap', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ user_id: `u${i}`, email: `p${i}@example.com` }));
    setup({ rows: full });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0].join(' '))).toBe('[summary-email] board b1: recipient cap reached (100)');
    warn.mockClear();
    setup({ rows: full.slice(0, 99) });
    await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  describe('one row shape for the email and the page', () => {
    const messagesFor = async (asDate: boolean) => {
      setup({ snapshotRows: buildSnapshot(asDate) });
      mocks.send.mockClear();
      await dispatchSummaryEmail({ boardId: 'b1', completedAt: COMPLETED }, env);
      return mocks.send.mock.calls[0][0].messages as { text: string }[];
    };

    it('driver-style Date rows still show an action item due date', async () => {
      const messages = await messagesFor(true);
      const line = messages[0].text.split('\n').find((l) => l.includes('Ship the fix')) ?? '';
      expect(line).toContain(`${DUE_PREFIX}November 30, 2026`);
      expect(line).not.toContain(NO_DUE_DATE);
      const other = messages[0].text.split('\n').find((l) => l.includes('Write the runbook')) ?? '';
      expect(other).toContain(NO_DUE_DATE);
    });

    it('messages built from Date rows equal those built from the same rows with ISO string dates', async () => {
      const fromDates = await messagesFor(true);
      const fromStrings = await messagesFor(false);
      expect(fromDates).toEqual(fromStrings);
    });
  });
});
