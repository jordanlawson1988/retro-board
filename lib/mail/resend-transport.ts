import { Resend } from 'resend';
import { EMAIL_FROM, RESEND_KEY_MISSING_ERROR, RESEND_TRANSPORT } from '@/lib/constants/email';
import { sendErrorText, type MailBatch, type MailEnv, type MailSendResult } from './transport';

/** Send a batch through Resend. Loaded only by dynamic import from send.ts, on the resend branch. */
export async function sendWithResend(batch: MailBatch, env: MailEnv): Promise<MailSendResult> {
  if (!env.RESEND_API_KEY) {
    return { ok: false, transport: RESEND_TRANSPORT, error: RESEND_KEY_MISSING_ERROR };
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.batch.send(
    batch.messages.map((m) => ({
      from: EMAIL_FROM,
      to: m.to,
      subject: m.subject,
      text: m.text,
      html: m.html,
      headers: m.headers,
    })),
    { idempotencyKey: batch.key }
  );
  if (error) return { ok: false, transport: RESEND_TRANSPORT, error: sendErrorText(error) };
  return { ok: true, transport: RESEND_TRANSPORT };
}
