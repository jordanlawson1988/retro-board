/**
 * Single source of truth for anti-bot configuration.
 * Imported by both client (form components) and server (Better Auth hooks).
 */

export const ANTI_BOT_HEADERS = {
  /** Cloudflare Turnstile token. Consumed by Better Auth's captcha plugin. */
  CAPTCHA_RESPONSE: 'x-captcha-response',
  /** Honeypot payload: base64-encoded JSON of `{ value: string, mountedAt: number }`. */
  HONEYPOT: 'x-hpf',
} as const;

/** Minimum milliseconds between form mount and submit before request is accepted. */
export const MIN_SUBMIT_MS = 1500;

/** Name attribute for the hidden honeypot input. Generic so naïve bots fill it. */
export const HONEYPOT_FIELD_NAME = 'company_url';

/**
 * Cloudflare Turnstile published test keys.
 * Used only in development when real keys are not configured.
 * Reference: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_DEV_KEYS = {
  /** Always-pass site key (visible widget, completes immediately). */
  SITE_KEY: '1x00000000000000000000AA',
  /** Always-pass server-side verification secret. */
  SECRET: '1x0000000000000000000000000000000AA',
} as const;
