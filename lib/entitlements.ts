// lib/entitlements.ts
// Single source of truth for plan vocabulary and entitlement decisions.
// Server-only (imports the lazy sql). Decision logic is pure for testability.
import { sql } from '@/lib/db';

export const FREE_ACTIVE_BOARD_LIMIT = 1; // D1 2026-06-10. Tune here; code is N-agnostic.
export const LAPSE_GRACE_DAYS = 14; // D3 2026-06-10.

export type Plan = 'paid' | 'comped' | 'free';

export interface SubscriptionRow {
  status: string;
  current_period_end: string | null;
  canceled_at: string | null;
}

export interface Entitlement {
  plan: Plan;
  canCreateBoard: boolean;
  activeBoards: number;
  limit: number | null; // null = unlimited
}

/** Pure: is this subscription still entitled, including the 14-day grace window? */
export function isSubscriptionEntitled(sub: SubscriptionRow | null, now: Date): boolean {
  if (!sub) return false;
  if (sub.status === 'active' || sub.status === 'trialing') return true;
  if (sub.status === 'past_due' || sub.status === 'canceled') {
    const anchor = sub.current_period_end ?? sub.canceled_at;
    if (!anchor) return false;
    const graceEnd = new Date(new Date(anchor).getTime() + LAPSE_GRACE_DAYS * 86_400_000);
    return now < graceEnd;
  }
  return false; // paused / unknown
}

/** Pure decision over already-loaded facts. */
export function resolveEntitlement(input: {
  isAllowlisted: boolean;
  subscription: SubscriptionRow | null;
  activeBoards: number;
  now: Date;
}): Entitlement {
  const { isAllowlisted, subscription, activeBoards, now } = input;
  if (isAllowlisted) {
    return { plan: 'comped', canCreateBoard: true, activeBoards, limit: null };
  }
  if (isSubscriptionEntitled(subscription, now)) {
    return { plan: 'paid', canCreateBoard: true, activeBoards, limit: null };
  }
  return {
    plan: 'free',
    canCreateBoard: activeBoards < FREE_ACTIVE_BOARD_LIMIT,
    activeBoards,
    limit: FREE_ACTIVE_BOARD_LIMIT,
  };
}

/** Load facts and decide. One indexed query — no caching at this scale (deliberate). */
export async function getEntitlement(userId: string, email: string): Promise<Entitlement> {
  const [row] = await sql`
    SELECT
      EXISTS (SELECT 1 FROM free_access WHERE email = ${email.toLowerCase()}) AS is_allowlisted,
      (SELECT row_to_json(s) FROM (
         SELECT status, current_period_end, canceled_at
         FROM subscriptions WHERE user_id = ${userId}
       ) s) AS subscription,
      (SELECT COUNT(*)::int FROM boards
        WHERE owner_id = ${userId} AND archived_at IS NULL AND deleted_at IS NULL) AS active_boards
  `;
  return resolveEntitlement({
    isAllowlisted: !!row?.is_allowlisted,
    subscription: (row?.subscription as SubscriptionRow | null) ?? null,
    activeBoards: Number(row?.active_boards ?? 0),
    now: new Date(),
  });
}
