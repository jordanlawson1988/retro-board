import { NextRequest, NextResponse } from 'next/server';

// Better Auth stores sessions in a signed cookie named 'better-auth.session_token'.
// We do a lightweight cookie-presence check here (Edge Runtime compatible).
// Full session validation happens inside each API route via auth.api.getSession().
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('better-auth.session_token');

  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Only protect /admin/* routes.
  // Public routes (/, /board/*, /login, /api/*) are not matched.
  matcher: ['/admin/:path*'],
};
