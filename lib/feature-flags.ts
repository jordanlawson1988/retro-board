import type { Feature } from '@/lib/constants/features';

/**
 * Whether a /api/feature-flags response says a feature is on. Strict: a missing flag, a failed
 * or a malformed response all read as off (the shared store's isEnabled reads a missing flag as on).
 */
export function flagEnabled(response: unknown, key: Feature): boolean {
  if (!response || typeof response !== 'object') return false;
  const flags = (response as { flags?: unknown }).flags;
  if (!Array.isArray(flags)) return false;
  return flags.some(
    (f) => !!f && typeof f === 'object' && (f as { key?: unknown }).key === key && (f as { is_enabled?: unknown }).is_enabled === true,
  );
}
