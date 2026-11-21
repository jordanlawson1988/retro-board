import {
  OUTBOX_TRANSPORT,
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

/** First SEND_ERROR_MAX code points of an error's message, or 'Unknown error'. */
export function sendErrorText(e: unknown): string {
  const message =
    e instanceof Error
      ? e.message
      : e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string'
        ? (e as { message: string }).message
        : '';
  if (!message) return 'Unknown error';
  return Array.from(message).slice(0, SEND_ERROR_MAX).join('');
}
