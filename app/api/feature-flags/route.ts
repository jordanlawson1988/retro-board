import { sql } from '@/lib/db';

export async function GET() {
  const flags = await sql`SELECT * FROM feature_flags ORDER BY created_at`;
  return Response.json({ flags });
}
