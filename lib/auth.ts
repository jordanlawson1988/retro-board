import { betterAuth } from 'better-auth';
import { captcha } from 'better-auth/plugins';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { Pool } from '@neondatabase/serverless';
import { ANTI_BOT_HEADERS, TURNSTILE_DEV_KEYS } from './anti-bot/constants';
import { decodeAndValidateHoneypot } from './anti-bot/honeypot';

const CAPTCHA_PROTECTED_PATHS = new Set([
  '/sign-up/email',
  '/sign-in/email',
]);

function resolveTurnstileSecret(): string {
  const fromEnv = process.env.TURNSTILE_SECRET_KEY;
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'TURNSTILE_SECRET_KEY is required in production. Set it in the Vercel project env (Preview + Production).'
    );
  }

  // Development fallback: Cloudflare's published always-pass test secret.
  // Pairs with the always-pass site key resolved on the client.
  return TURNSTILE_DEV_KEYS.SECRET;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any = null;

function getAuth() {
  if (!_auth) {
    _auth = betterAuth({
      database: new Pool({ connectionString: process.env.DATABASE_URL }),
      emailAndPassword: {
        enabled: true,
      },
      user: {
        deleteUser: {
          enabled: true,
        },
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
      },
      plugins: [
        captcha({
          provider: 'cloudflare-turnstile',
          secretKey: resolveTurnstileSecret(),
        }),
      ],
      hooks: {
        before: createAuthMiddleware(async (ctx) => {
          if (!CAPTCHA_PROTECTED_PATHS.has(ctx.path)) return;

          const headerValue = ctx.headers?.get(ANTI_BOT_HEADERS.HONEYPOT) ?? null;
          const result = decodeAndValidateHoneypot(headerValue);
          if (!result.ok) {
            throw new APIError('BAD_REQUEST', {
              message: 'Unable to verify request',
            });
          }
        }),
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
