import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

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
    const r = await sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k' });
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
    const r = await sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: 'resend' });
    expect(mocks.ctor).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, transport: 'resend', error: 'RESEND_API_KEY is not set' });
  });

  it('turns a Resend error into a failed result', async () => {
    mocks.batchSend.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const r = await sendMail(batch(), { SUMMARY_EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k' });
    expect(r).toEqual({ ok: false, transport: 'resend', error: 'boom' });
  });

  it('never throws and cuts the error to 500 code points', async () => {
    mocks.sql.mockRejectedValue(new Error('x'.repeat(600)));
    const r = await sendMail(batch(), {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.transport).toBe('outbox');
      expect(Array.from(r.error)).toHaveLength(500);
    }
  });

  it('does nothing for an empty batch', async () => {
    const r = await sendMail(batch({ messages: [] }), { SUMMARY_EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k' });
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.ctor).not.toHaveBeenCalled();
    expect(mocks.batchSend).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, transport: 'resend' });
    const r2 = await sendMail(batch({ messages: [] }), {});
    expect(r2).toEqual({ ok: true, transport: 'outbox' });
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
