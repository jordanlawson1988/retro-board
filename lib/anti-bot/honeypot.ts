import { MIN_SUBMIT_MS } from './constants';

export interface HoneypotPayload {
  /** Value of the hidden honeypot input. Should always be empty. */
  value: string;
  /** performance.now() at form mount (client) or Date.now() — millisecond precision. */
  mountedAt: number;
}

export type HoneypotValidationResult =
  | { ok: true }
  | { ok: false; reason: 'non_empty' | 'too_fast' | 'malformed' };

/**
 * Client helper: base64-encode the honeypot payload for use as a header value.
 * Browsers' btoa works on ASCII; the payload is plain JSON so this is safe.
 */
export function encodeHoneypotHeader(payload: HoneypotPayload): string {
  return btoa(JSON.stringify(payload));
}

/**
 * Server helper: decode the header value, validate it, and return a discriminated result.
 *
 * Validation rules:
 * 1. Header is present and parses as JSON with the expected shape.
 * 2. `value` is empty (any non-empty string fails).
 * 3. Elapsed time since `mountedAt` is at least `minMs`.
 *
 * `now` and `minMs` are injected so callers can override in tests/edge cases.
 */
export function decodeAndValidateHoneypot(
  headerValue: string | null | undefined,
  options: { minMs?: number; now?: () => number } = {}
): HoneypotValidationResult {
  const minMs = options.minMs ?? MIN_SUBMIT_MS;
  const now = options.now ?? (() => Date.now());

  if (!headerValue || typeof headerValue !== 'string') {
    return { ok: false, reason: 'malformed' };
  }

  let decoded: string;
  try {
    decoded = atob(headerValue);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as HoneypotPayload).value !== 'string' ||
    typeof (parsed as HoneypotPayload).mountedAt !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  const payload = parsed as HoneypotPayload;

  if (payload.value.length > 0) {
    return { ok: false, reason: 'non_empty' };
  }

  if (now() - payload.mountedAt < minMs) {
    return { ok: false, reason: 'too_fast' };
  }

  return { ok: true };
}
