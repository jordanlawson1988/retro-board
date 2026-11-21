/** Summary email vocabulary, limits and copy, declared once. */
export const EMAIL_FROM = 'RetroBoard <noreply@retroboard.live>';

export const SUMMARY_EMAIL_TRANSPORT_ENV = 'SUMMARY_EMAIL_TRANSPORT';
export const MAIL_TRANSPORTS = ['outbox', 'resend'] as const;
export type MailTransportName = (typeof MAIL_TRANSPORTS)[number];
export const OUTBOX_TRANSPORT = MAIL_TRANSPORTS[0];
export const RESEND_TRANSPORT = MAIL_TRANSPORTS[1];

export const EMAIL_KINDS = ['summary'] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];
export const SUMMARY_EMAIL_KIND = EMAIL_KINDS[0];

export const SUMMARY_SEND_STATUSES = ['pending', 'sent', 'recorded', 'failed'] as const;
export type SummarySendStatus = (typeof SUMMARY_SEND_STATUSES)[number];
export const SEND_PENDING = SUMMARY_SEND_STATUSES[0];
export const SEND_SENT = SUMMARY_SEND_STATUSES[1];
export const SEND_RECORDED = SUMMARY_SEND_STATUSES[2];
export const SEND_FAILED = SUMMARY_SEND_STATUSES[3];

export const SUMMARY_EMAIL_MAX_RECIPIENTS = 100;
export const SEND_ERROR_MAX = 500;
export const SUMMARY_EMAIL_HEADING_MAX = 120;

export const OUTBOX_DISABLED_ERROR = 'The outbox transport does not run in production';
export const RESEND_KEY_MISSING_ERROR = 'RESEND_API_KEY is not set';
export const BASE_URL_MISSING_ERROR = 'No base URL is configured';

/** Mail providers send one-click unsubscribe POSTs from shared addresses, so that limit is high. */
export const EMAIL_PREFS_RATE_LIMIT = { key: 'email-prefs', limit: 30, window: 60 } as const;
export const UNSUBSCRIBE_RATE_LIMIT = { key: 'unsubscribe', limit: 300, window: 60 } as const;

export const UNSUBSCRIBE_PAGE_PATH = '/email/unsubscribe';
export const UNSUBSCRIBE_API_PATH = '/api/email/unsubscribe';
export const UNSUBSCRIBE_TOKEN_PURPOSE = 'summary_email';

export const SIGN_IN_REQUIRED_ERROR = 'Sign in required';
export const NOT_FOUND_ERROR = 'Not found';

export const EMAIL_SECTION_TITLE = 'Email';
export const EMAIL_SECTION_DESCRIPTION = 'Choose which emails RetroBoard sends you.';
export const SUMMARY_EMAIL_SETTING_LABEL = 'Email me a summary when a retro I took part in is completed';
export const PREFERENCE_SAVED = 'Saved.';
export const PREFERENCE_SAVE_FAILED = 'Could not save. Try again.';

export const UNSUBSCRIBE_TITLE = 'Stop summary emails';
export const UNSUBSCRIBE_BODY = 'You will no longer get an email when a retro you took part in is completed.';
export const UNSUBSCRIBE_BUTTON = 'Unsubscribe';
export const UNSUBSCRIBE_DONE = 'You are unsubscribed. You can turn summary emails back on in your account settings.';
export const ACCOUNT_SETTINGS_LINK = 'Account settings';
export const UNSUBSCRIBE_INVALID = 'This link is not valid.';
export const UNSUBSCRIBE_FAILED = 'Something went wrong. Try again.';

export const SUMMARY_EMAIL_INTRO = 'Your retro is complete. Here is a short summary.';
export const SUMMARY_EMAIL_TOPICS = 'Topics';
export const SUMMARY_EMAIL_ACTIONS = 'Action items';
export const SUMMARY_EMAIL_NO_ACTIONS = 'No action items.';
export const SUMMARY_EMAIL_FULL = 'See the full summary';
export const SUMMARY_EMAIL_WHY = 'You got this email because you took part in this retro on RetroBoard.';
export const SUMMARY_EMAIL_STOP = 'Stop getting summary emails';
export const NO_DUE_DATE = 'No due date';
