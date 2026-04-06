import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // In the browser, omitting baseURL (or using empty string) makes requests
  // relative to the current origin, so it works on any port.
  baseURL: typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
});
