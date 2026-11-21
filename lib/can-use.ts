import { sql } from '@/lib/db';
import type { Feature } from '@/lib/constants/features';

export { FEATURES, type Feature } from '@/lib/constants/features';

/**
 * Whether a feature is enabled. Reads feature_flags; a missing row means off.
 * `userId` is accepted for the future per-user entitlement check (billing) and is unused today.
 */
export async function canUse(feature: Feature, userId: string | null): Promise<boolean> {
  void userId;
  const rows = (await sql`SELECT is_enabled FROM feature_flags WHERE key = ${feature}`) as { is_enabled: boolean }[];
  return rows[0]?.is_enabled === true;
}
