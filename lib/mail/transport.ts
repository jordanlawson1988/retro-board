import {
  OUTBOX_TRANSPORT,
  PRODUCTION_ENV,
  RESEND_PRODUCTION_ONLY_ERROR,
  RESEND_TRANSPORT,
  SEND_ERROR_MAX,
  SUMMARY_EMAIL_TRANSPORT_ENV,
  type EmailKind,
  type MailTransportName,
} from '@/lib/constants/email';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
}

export interface MailBatch {
  kind: EmailKind;
  boardId: string | null;
  key: string;
  messages: MailMessage[];
}

export type MailSendResult =
  | { ok: true; transport: MailTransportName }
  | { ok: false; transport: MailTransportName; error: string };

export type MailEnv = Record<string, string | undefined>;

/** 'resend' only when env.SUMMARY_EMAIL_TRANSPORT is exactly 'resend'; everything else is 'outbox'. */
export function selectTransport(env: MailEnv): MailTransportName {
  return env[SUMMARY_EMAIL_TRANSPORT_ENV] === RESEND_TRANSPORT ? RESEND_TRANSPORT : OUTBOX_TRANSPORT;
}

/** Real sending needs the production deployment. Null when allowed (or not asked for), else the refusal text. */
export function resendRefusal(env: MailEnv): string | null {
  if (selectTransport(env) !== RESEND_TRANSPORT) return null;
  return env.VERCEL_ENV === PRODUCTION_ENV ? null : RESEND_PRODUCTION_ONLY_ERROR;
}

/**
 * A short safe label for an error: its name (or string code) and numeric statusCode, never its
 * message (a provider or database message can quote an address or a key). Cut to SEND_ERROR_MAX.
 */
export function sendErrorText(e: unknown): string {
  const o = e && typeof e === 'object' ? (e as { name?: unknown; code?: unknown; statusCode?: unknown }) : {};
  const label =
    typeof o.name === 'string' && o.name ? o.name : typeof o.code === 'string' && o.code ? o.code : '';
  const status = typeof o.statusCode === 'number' && Number.isFinite(o.statusCode) ? String(o.statusCode) : '';
  const text = [label, status].filter(Boolean).join(' ');
  if (!text) return 'Unknown error';
  return Array.from(text).slice(0, SEND_ERROR_MAX).join('');
}
