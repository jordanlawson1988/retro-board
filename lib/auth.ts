import { betterAuth } from 'better-auth';
import { Pool } from '@neondatabase/serverless';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any = null;

function getAuth() {
  if (!_auth) {
    _auth = betterAuth({
      database: new Pool({ connectionString: process.env.DATABASE_URL }),
      emailAndPassword: {
        enabled: true,
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
      },
    });
  }
  return _auth;
}

// Lazy proxy to avoid crashing at build time when DATABASE_URL is not set.
// Traps: get (property access), has (the `in` operator — needed by toNextJsHandler).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth = new Proxy({} as any, {
  get(_target, prop) {
    return Reflect.get(getAuth(), prop);
  },
  has(_target, prop) {
    return Reflect.has(getAuth(), prop);
  },
}) as ReturnType<typeof betterAuth>;
