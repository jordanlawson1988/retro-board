import { sql } from '@/lib/db';
import { validateClientId } from '@/lib/board-validation';
import { GUIDED_MODE } from '@/lib/constants/phases';

/**
 * Whether a board exists, is not deleted and is guided. It answers a boolean and nothing else:
 * no title, no content, nothing that depends on who is asking, so the server page can answer a
 * real 404 without becoming a read path for content.
 *
 * The mode is read through `to_jsonb(b) ->> 'mode'`, never the column: a database without
 * migration 015 (production) has no `mode` column, the key is simply absent, and every board
 * reads as not guided instead of the statement failing.
 */
export async function guidedBoardExists(boardId: string): Promise<boolean> {
  if (!validateClientId(boardId).ok) return false;
  const rows = await sql`
    SELECT to_jsonb(b) ->> 'mode' AS mode FROM boards b WHERE b.id = ${boardId} AND b.deleted_at IS NULL
  `;
  return (rows[0] as { mode?: string | null } | undefined)?.mode === GUIDED_MODE;
}
