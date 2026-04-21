import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// Better Auth uses the `__Secure-` prefix on HTTPS (production). `getSessionCookie`
// checks for both `better-auth.session_token` and `__Secure-better-auth.session_token`
// so the middleware works in both dev and production.
// Full session validation happens inside each API route via auth.api.getSession().
export function middleware(request: NextRequest) {
  const sessionToken = getSessionCookie(request);

  if (!sessionToken) {
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
