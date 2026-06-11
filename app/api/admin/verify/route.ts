import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireSystemAdmin, authzErrorResponse } from '@/lib/auth-helpers';

// Returns the CALLER's admin_users row (or 401/403). Never accepts a userId
// param — the old form let anyone enumerate admin accounts.
export async function GET() {
  try {
    const { userId } = await requireSystemAdmin();
    const [adminUser] = await sql`SELECT * FROM admin_users WHERE id = ${userId}`;
    return NextResponse.json(adminUser);
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(null, { status: r.status });
    throw e;
  }
}
