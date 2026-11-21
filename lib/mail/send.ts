import { RESEND_TRANSPORT } from '@/lib/constants/email';
import { recordToOutbox } from './outbox-transport';
import { resendRefusal, selectTransport, sendErrorText, type MailBatch, type MailEnv, type MailSendResult } from './transport';

/**
 * The one send function. Records to email_outbox unless SUMMARY_EMAIL_TRANSPORT is exactly
 * 'resend', and sends for real only when VERCEL_ENV is exactly 'production' (otherwise it refuses and
 * records nothing). The Resend transport is loaded only on that branch, by dynamic import. Never throws.
 */
export async function sendMail(batch: MailBatch, env: MailEnv = process.env): Promise<MailSendResult> {
  const transport = selectTransport(env);
  try {
    if (batch.messages.length === 0) return { ok: true, transport };
    if (transport === RESEND_TRANSPORT) {
      const refusal = resendRefusal(env);
      if (refusal) return { ok: false, transport, error: refusal };
      const { sendWithResend } = await import('./resend-transport');
      return await sendWithResend(batch, env);
    }
    return await recordToOutbox(batch, env);
  } catch (e) {
    return { ok: false, transport, error: sendErrorText(e) };
  }
}
