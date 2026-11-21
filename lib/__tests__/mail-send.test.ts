import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const mocks = vi.hoisted(() => ({ sql: vi.fn(), ctor: vi.fn(), batchSend: vi.fn() }));

vi.mock('resend', () => ({
  Resend: vi.fn(function (key: string) {
    mocks.ctor(key);
    return { batch: { send: mocks.batchSend } };
  }),
}));
vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => mocks.sql(...a) }));

import { selectTransport } from '@/lib/mail/transport';
import { sendMail } from '@/lib/mail/send';
import type { MailBatch } from '@/lib/mail/transport';

const batch = (over: Partial<MailBatch> = {}): MailBatch => ({
  kind: 'summary',
  boardId: 'b1',
  key: 'summary/b1/1',
  messages: [
    { to: 'u1@example.com', subject: 's1', text: 't1', html: '<p>1</p>', headers: { 'List-Unsubscribe': '<https://x/u1>' } },
    { to: 'u2@example.com', subject: 's2', text: 't2', html: '<p>2</p>', headers: { 'List-Unsubscribe': '<https://x/u2>' } },
  ],
  ...over,
});

const callText = (i: number) => (mocks.sql.mock.calls[i][0] as string[]).join('?');
const callValues = (i: number) => mocks.sql.mock.calls[i].slice(1);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sql.mockResolvedValue([]);
  mocks.batchSend.mockResolvedValue({ data: { data: [] }, error: null });
});

describe('selectTransport', () => {
  it('selects the outbox for everything except the exact string resend', () => {
    expect(selectTransport({})).toBe('outbox');
    expect(selectTransport({ SUMMARY_EMAIL_TRANSPORT: 'RESEND' })).toBe('outbox');
    expect(selectTransport({ SUMMARY_EMAIL_TRANSPORT: ' resend' })).toBe('outbox');
    expect(selectTransport({ SUMMARY_EMAIL_TRANSPORT: 'resend ' })).toBe('outbox');
    expect(selectTransport({ SUMMARY_EMAIL_TRANSPORT: 'smtp' })).toBe('outbox');
    expect(selectTransport({ SUMMARY_EMAIL_TRANSPORT: '' })).toBe('outbox');
    expect(selectTransport({ SUMMARY_EMAIL_TRANSPORT: 'resend' })).toBe('resend');
  });
});

describe('sendMail', () => {
  it('records to the outbox by default and never builds a Resend client', async () => {
    const r = await sendMail(batch(), {});
    expect(mocks.sql).toHaveBeenCalledTimes(1);
    expect(callText(0)).toContain('INSERT INTO email_outbox');
    expect(callText(0)).toContain('jsonb_to_recordset');
    const values = callValues(0);
    expect(values).toContain('summary');
    expect(values).toContain('b1');
    expect(values).toContain('summary/b1/1');
    const json = values.find((v) => typeof v === 'string' && v.includes('u1@example.com')) as string;
    expect(json).toContain('u2@example.com');
    expect(mocks.ctor).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, transport: 'outbox' });
  });

  it('refuses the outbox in production before any query', async () => {
    const r = await sendMail(batch(), { VERCEL_ENV: 'production' });
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.ctor).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, transport: 'outbox', error: 'The outbox transport does not run in production' });
  });

  it('sends through Resend only when explicitly chosen', async () => {
    const r = await sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k', VERCEL_ENV: 'production' });
    expect(mocks.ctor).toHaveBeenCalledTimes(1);
    expect(mocks.ctor).toHaveBeenCalledWith('k');
    expect(mocks.batchSend).toHaveBeenCalledTimes(1);
    expect(mocks.batchSend).toHaveBeenCalledWith(
      [
        { from: 'RetroBoard <noreply@retroboard.live>', to: 'u1@example.com', subject: 's1', text: 't1', html: '<p>1</p>', headers: { 'List-Unsubscribe': '<https://x/u1>' } },
        { from: 'RetroBoard <noreply@retroboard.live>', to: 'u2@example.com', subject: 's2', text: 't2', html: '<p>2</p>', headers: { 'List-Unsubscribe': '<https://x/u2>' } },
      ],
      { idempotencyKey: 'summary/b1/1' }
    );
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, transport: 'resend' });
  });

  it('reports a missing key without constructing a client', async () => {
    const r = await sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: 'resend', VERCEL_ENV: 'production' });
    expect(mocks.ctor).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, transport: 'resend', error: 'RESEND_API_KEY is not set' });
  });

  it('turns a Resend error into a failed result carrying only its name and status, never its message', async () => {
    mocks.batchSend.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', statusCode: 403, message: 'You can only send to owner@acct-secret.example with key re_SECRETKEY123' },
    });
    const r = await sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k', VERCEL_ENV: 'production' });
    expect(r).toEqual({ ok: false, transport: 'resend', error: 'validation_error 403' });
    if (!r.ok) {
      expect(r.error).not.toContain('acct-secret');
      expect(r.error).not.toContain('re_SECRETKEY123');
    }
    mocks.batchSend.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const r2 = await sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k', VERCEL_ENV: 'production' });
    expect(r2).toEqual({ ok: false, transport: 'resend', error: 'Unknown error' });
  });

  it('a thrown error is reported by name and status only, cut to 500 code points', async () => {
    const e = Object.assign(new Error('row for a@b.example'), { name: 'NeonDbError', statusCode: 500 });
    mocks.sql.mockRejectedValue(e);
    const r = await sendMail(batch(), {});
    expect(r).toEqual({ ok: false, transport: 'outbox', error: 'NeonDbError 500' });
    mocks.sql.mockRejectedValue(Object.assign(new Error('m'), { name: 'x'.repeat(600) }));
    const r2 = await sendMail(batch(), {});
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(Array.from(r2.error)).toHaveLength(500);
  });

  it('does nothing for an empty batch', async () => {
    const r = await sendMail(batch({ messages: [] }), { SUMMARY_EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k', VERCEL_ENV: 'production' });
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.ctor).not.toHaveBeenCalled();
    expect(mocks.batchSend).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, transport: 'resend' });
    const r2 = await sendMail(batch({ messages: [] }), {});
    expect(r2).toEqual({ ok: true, transport: 'outbox' });
  });
});

describe('real sending only on the production deployment', () => {
  const REFUSAL = 'Real sending is only allowed on the production deployment';
  for (const venv of ['preview', 'development', '', undefined]) {
    it(`resend with VERCEL_ENV ${JSON.stringify(venv)} refuses, builds no client, records nothing`, async () => {
      const r = await sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k', VERCEL_ENV: venv });
      expect(r).toEqual({ ok: false, transport: 'resend', error: REFUSAL });
      expect(mocks.ctor).not.toHaveBeenCalled();
      expect(mocks.batchSend).not.toHaveBeenCalled();
      expect(mocks.sql).not.toHaveBeenCalled();
    });
  }
  it('resend with production runs the Resend path', async () => {
    const r = await sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k', VERCEL_ENV: 'production' });
    expect(r).toEqual({ ok: true, transport: 'resend' });
    expect(mocks.batchSend).toHaveBeenCalledTimes(1);
  });
  for (const value of ['resend\n', ' resend', 'RESEND']) {
    it(`${JSON.stringify(value)} with production is not Resend: the outbox refuses in production`, async () => {
      const r = await sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: value, RESEND_API_KEY: 'k', VERCEL_ENV: 'production' });
      expect(r).toEqual({ ok: false, transport: 'outbox', error: 'The outbox transport does not run in production' });
      expect(mocks.ctor).not.toHaveBeenCalled();
      expect(mocks.sql).not.toHaveBeenCalled();
    });
  }
  it('the variable absent with preview records to the outbox', async () => {
    const r = await sendMail(batch(), { VERCEL_ENV: 'preview' });
    expect(r).toEqual({ ok: true, transport: 'outbox' });
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
});

describe('who may import resend', () => {
  const ROOTS = ['app', 'lib', 'components', 'stores', 'hooks', 'scripts'];
  const walk = (dir: string, out: string[] = []): string[] => {
    let names: string[] = [];
    try { names = readdirSync(dir); } catch { return out; }
    for (const n of names) {
      if (n === 'node_modules' || n === '.next' || n === '__tests__') continue;
      const full = join(dir, n);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx|js|mjs|cjs)$/.test(n) && !/\.test\.(ts|tsx)$/.test(n)) out.push(relative('.', full));
    }
    return out;
  };
  const files = ROOTS.flatMap((r) => walk(r));
  const RESEND_IMPORT = /from\s+['"]resend['"]|require\(\s*['"]resend['"]\s*\)|import\(\s*['"]resend['"]\s*\)/;
  const TRANSPORT_IMPORT = /import\(\s*['"](\.\/|@\/lib\/mail\/)resend-transport['"]\s*\)/;
  it('only lib/email.ts and the Resend transport import resend', () => {
    expect(files.length).toBeGreaterThan(50);
    const hits = files.filter((f) => RESEND_IMPORT.test(readFileSync(f, 'utf8'))).sort();
    expect(hits).toEqual(['lib/email.ts', 'lib/mail/resend-transport.ts']);
  });
  it('only lib/mail/send.ts dynamically imports the Resend transport', () => {
    const hits = files.filter((f) => TRANSPORT_IMPORT.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual(['lib/mail/send.ts']);
  });
});

describe('the Resend client is never built by importing', () => {
  it('importing the transport module does not construct a client', async () => {
    await import('@/lib/mail/resend-transport');
    expect(mocks.ctor).not.toHaveBeenCalled();
  });

  it('send.ts loads the transport only by dynamic import and constructs once inside sendWithResend', () => {
    const send = readFileSync('lib/mail/send.ts', 'utf8');
    expect(send).not.toMatch(/from ['"]resend['"]/);
    expect(send).not.toMatch(/from ['"]\.\/resend-transport['"]/);
    expect(send).toContain("await import('./resend-transport')");
    const rt = readFileSync('lib/mail/resend-transport.ts', 'utf8');
    expect(rt.split('new Resend(').length - 1).toBe(1);
    const head = rt.slice(0, rt.indexOf('export async function sendWithResend'));
    expect(head).not.toContain('new Resend(');
  });
});
