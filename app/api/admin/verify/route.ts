import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json(null, { status: 400 });

  const [adminUser] = await sql`SELECT * FROM admin_users WHERE id = ${userId}`;
  if (!adminUser) return NextResponse.json(null, { status: 403 });

  return NextResponse.json(adminUser);
}
