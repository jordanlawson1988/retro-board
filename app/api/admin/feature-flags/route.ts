import { sql } from '@/lib/db';

export async function GET() {
  const flags = await sql`SELECT * FROM feature_flags ORDER BY created_at`;
  return Response.json({ flags });
}

export async function PATCH(request: Request) {
  const { id, is_enabled } = await request.json();
  await sql`UPDATE feature_flags SET is_enabled = ${is_enabled}, updated_at = NOW() WHERE id = ${id}`;
  return Response.json({ ok: true });
}
