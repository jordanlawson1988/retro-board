import { sql } from '@/lib/db';

/** Features gated by a row in feature_flags. Declared once; add new keys here. */
export const FEATURES = ['guided_mode'] as const;
export type Feature = (typeof FEATURES)[number];

/**
 * Whether a feature is enabled. Reads feature_flags; a missing row means off.
 * `userId` is accepted for the future per-user entitlement check (billing) and is unused today.
 */
export async function canUse(feature: Feature, userId: string | null): Promise<boolean> {
  void userId;
  const rows = (await sql`SELECT is_enabled FROM feature_flags WHERE key = ${feature}`) as { is_enabled: boolean }[];
  return rows[0]?.is_enabled === true;
}
