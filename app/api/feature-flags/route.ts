import { sql } from '@/lib/db';

// Public read-only endpoint: returns only key + is_enabled.
// Full flag management is at /api/admin/feature-flags (admin only).
export async function GET() {
  const rows = await sql`SELECT key, is_enabled FROM feature_flags ORDER BY created_at`;
  return Response.json({ flags: rows });
}
