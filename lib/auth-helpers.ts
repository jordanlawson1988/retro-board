import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * Get the current session or null. Does not throw.
 * Use in API routes where auth is optional (e.g., board creation can be anonymous).
 */
export async function getSessionOrNull() {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    return session;
  } catch {
    return null;
  }
}

/**
 * Get the current session or throw 401.
 * Use in API routes that require authentication (e.g., dashboard, billing).
 */
export async function requireSession() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}
