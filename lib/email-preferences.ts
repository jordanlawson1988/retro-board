import { sql } from '@/lib/db';

// The summary email opt-out. Both the account setting and the one-click unsubscribe write
// through setSummaryPreference, so there is one statement to keep right. Callers must only
// reach this after the feature flag is on or a signed token has verified: production has no
// email_preferences table until migration 018 is applied.

/** No row means the default, which is on. */
export async function readSummaryPreference(userId: string): Promise<boolean> {
  const rows = (await sql`
    SELECT summary_email FROM email_preferences WHERE user_id = ${userId}
  `) as { summary_email: boolean }[];
  return rows[0]?.summary_email ?? true;
}

/**
 * The one write. An account that no longer exists writes nothing and is not an error, so a
 * caller answers the same whether or not the account is there.
 */
export async function setSummaryPreference(userId: string, enabled: boolean): Promise<void> {
  await sql`
    INSERT INTO email_preferences (user_id, summary_email, updated_at)
    SELECT ${userId}, ${enabled}::boolean, now()
    WHERE EXISTS (SELECT 1 FROM "user" WHERE id = ${userId})
    ON CONFLICT (user_id) DO UPDATE SET summary_email = EXCLUDED.summary_email, updated_at = now()
  `;
}
