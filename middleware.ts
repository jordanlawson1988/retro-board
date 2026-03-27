import { NextRequest, NextResponse } from 'next/server';

// Better Auth stores sessions in a signed cookie named 'better-auth.session_token'.
// We do a lightweight cookie-presence check here (Edge Runtime compatible).
// Full session validation happens inside each API route via auth.api.getSession().
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('better-auth.session_token');

  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protect admin, dashboard, and settings routes.
  // Public routes (/, /board/*, /login, /signup, /pricing, /api/*) are not matched.
  matcher: ['/admin/:path*', '/dashboard/:path*', '/settings/:path*'],
};
