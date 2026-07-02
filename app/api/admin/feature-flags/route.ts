import { sql } from '@/lib/db';
import { requireSystemAdmin, authzErrorResponse } from '@/lib/auth-helpers';

export async function GET() {
  try {
    await requireSystemAdmin();
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return Response.json(r.body, { status: r.status });
    throw e;
  }
  const flags = await sql`SELECT * FROM feature_flags ORDER BY created_at`;
  return Response.json({ flags });
}

export async function PATCH(request: Request) {
  try {
    await requireSystemAdmin();
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return Response.json(r.body, { status: r.status });
    throw e;
  }
  const { id, is_enabled } = await request.json();
  await sql`UPDATE feature_flags SET is_enabled = ${is_enabled}, updated_at = NOW() WHERE id = ${id}`;
  return Response.json({ ok: true });
}
