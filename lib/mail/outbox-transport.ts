import { sql } from '@/lib/db';
import { OUTBOX_DISABLED_ERROR, OUTBOX_TRANSPORT } from '@/lib/constants/email';
import type { MailBatch, MailEnv, MailSendResult } from './transport';

/** Record a batch in email_outbox instead of sending it. Refuses in production, before any query. */
export async function recordToOutbox(batch: MailBatch, env: MailEnv): Promise<MailSendResult> {
  if (env.VERCEL_ENV === 'production') {
    return { ok: false, transport: OUTBOX_TRANSPORT, error: OUTBOX_DISABLED_ERROR };
  }
  const rows = batch.messages.map((m) => ({
    to_address: m.to,
    subject: m.subject,
    text_body: m.text,
    html_body: m.html,
    headers: m.headers,
  }));
  await sql`
    INSERT INTO email_outbox (kind, board_id, batch_key, to_address, subject, text_body, html_body, headers)
    SELECT ${batch.kind}, ${batch.boardId}, ${batch.key}, m.to_address, m.subject, m.text_body, m.html_body, m.headers
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
      AS m(to_address text, subject text, text_body text, html_body text, headers jsonb)
  `;
  return { ok: true, transport: OUTBOX_TRANSPORT };
}
