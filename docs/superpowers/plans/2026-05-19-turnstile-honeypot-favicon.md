# Turnstile + Honeypot + Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cloudflare Turnstile + honeypot bot defense to Better Auth signup/sign-in, and wire the existing brand favicon SVG into the document metadata so it actually renders.

**Architecture:** Two server-enforced layers in front of `/api/auth/sign-up/email` and `/api/auth/sign-in/email`. Turnstile is enforced via Better Auth's first-party `captcha` plugin (which targets those endpoints by default). Honeypot is enforced via a `hooks.before` matcher in `lib/auth.ts` that reads a custom `x-hpf` header containing the field value and form-mount timestamp. Client sends both as headers via `authClient.*.email({ fetchOptions: { headers } })`.

**Tech Stack:** Next.js 16 App Router, React 19, Better Auth 1.5.5 (`captcha` plugin + `hooks.before`), Neon, `@marsidev/react-turnstile` (new dep), Tailwind 4, Zustand.

**Repo convention:** No automated test suite (per `CLAUDE.md`). Each task ends with a manual verification step or a build/type-check command. Commit after each task.

---

## File Structure

| Path                                              | Action  | Responsibility                                                                                                  |
| ------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `package.json`                                    | Modify  | Add `@marsidev/react-turnstile` dependency.                                                                     |
| `lib/anti-bot/constants.ts`                       | Create  | Single source of truth: header names, min-submit-time, honeypot field name, dev test keys.                       |
| `lib/anti-bot/honeypot.ts`                        | Create  | Pure helpers: `encodeHoneypotHeader`, `decodeAndValidateHoneypot`.                                              |
| `lib/auth.ts`                                     | Modify  | Register `captcha` plugin. Add `hooks.before` matcher for sign-up + sign-in that runs honeypot validation.       |
| `components/common/Turnstile.tsx`                 | Create  | Wrapper around `@marsidev/react-turnstile`. Resolves site key (real or dev test). Exposes token via `onToken` cb.|
| `components/common/index.ts`                      | Modify  | Re-export `Turnstile`.                                                                                          |
| `stores/authStore.ts`                             | Modify  | Extend `signUp`/`signIn` to accept `{ captchaToken, honeypot }` and forward as headers.                          |
| `components/pages/SignUpPage.tsx`                 | Modify  | Render widget + hidden honeypot input; pass headers on submit.                                                  |
| `app/login/page.tsx`                              | Modify  | Same as SignUpPage.                                                                                             |
| `app/layout.tsx`                                  | Modify  | Add `metadata.icons` pointing to `/favicon.svg`.                                                                |
| `.env.example`                                    | Create  | Document required env vars including the two new Turnstile keys.                                                |

---

## Task 1: Add Turnstile React library dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `@marsidev/react-turnstile`**

Run:
```bash
npm install @marsidev/react-turnstile
```

Expected: package.json `dependencies` gains an entry like `"@marsidev/react-turnstile": "^1.x.x"`. `package-lock.json` updates.

- [ ] **Step 2: Verify it imports cleanly**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors (the lib ships its own types).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: add @marsidev/react-turnstile dependency

Thin wrapper around Cloudflare Turnstile. Used for invisible bot
challenge on signup + login forms.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Anti-bot constants module

**Files:**
- Create: `lib/anti-bot/constants.ts`

- [ ] **Step 1: Write the file**

Create `lib/anti-bot/constants.ts`:

```ts
/**
 * Single source of truth for anti-bot configuration.
 * Imported by both client (form components) and server (Better Auth hooks).
 */

export const ANTI_BOT_HEADERS = {
  /** Cloudflare Turnstile token. Consumed by Better Auth's captcha plugin. */
  CAPTCHA_RESPONSE: 'x-captcha-response',
  /** Honeypot payload: base64-encoded JSON of `{ value: string, mountedAt: number }`. */
  HONEYPOT: 'x-hpf',
} as const;

/** Minimum milliseconds between form mount and submit before request is accepted. */
export const MIN_SUBMIT_MS = 1500;

/** Name attribute for the hidden honeypot input. Generic so naïve bots fill it. */
export const HONEYPOT_FIELD_NAME = 'company_url';

/**
 * Cloudflare Turnstile published test keys.
 * Used only in development when real keys are not configured.
 * Reference: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_DEV_KEYS = {
  /** Always-pass site key (visible widget, completes immediately). */
  SITE_KEY: '1x00000000000000000000AA',
  /** Always-pass server-side verification secret. */
  SECRET: '1x0000000000000000000000000000000AA',
} as const;
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/anti-bot/constants.ts
git commit -m "$(cat <<'EOF'
feat: anti-bot constants module

Single source of truth for header names, min-submit-time, honeypot
field name, and the Cloudflare published dev test keys.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Honeypot encode / decode helpers

**Files:**
- Create: `lib/anti-bot/honeypot.ts`

- [ ] **Step 1: Write the file**

Create `lib/anti-bot/honeypot.ts`:

```ts
import { MIN_SUBMIT_MS } from './constants';

export interface HoneypotPayload {
  /** Value of the hidden honeypot input. Should always be empty. */
  value: string;
  /** performance.now() at form mount (client) or Date.now() — millisecond precision. */
  mountedAt: number;
}

export type HoneypotValidationResult =
  | { ok: true }
  | { ok: false; reason: 'non_empty' | 'too_fast' | 'malformed' };

/**
 * Client helper: base64-encode the honeypot payload for use as a header value.
 * Browsers' btoa works on ASCII; the payload is plain JSON so this is safe.
 */
export function encodeHoneypotHeader(payload: HoneypotPayload): string {
  return btoa(JSON.stringify(payload));
}

/**
 * Server helper: decode the header value, validate it, and return a discriminated result.
 *
 * Validation rules:
 * 1. Header is present and parses as JSON with the expected shape.
 * 2. `value` is empty (any non-empty string fails).
 * 3. Elapsed time since `mountedAt` is at least `minMs`.
 *
 * `now` and `minMs` are injected so callers can override in tests/edge cases.
 */
export function decodeAndValidateHoneypot(
  headerValue: string | null | undefined,
  options: { minMs?: number; now?: () => number } = {}
): HoneypotValidationResult {
  const minMs = options.minMs ?? MIN_SUBMIT_MS;
  const now = options.now ?? (() => Date.now());

  if (!headerValue || typeof headerValue !== 'string') {
    return { ok: false, reason: 'malformed' };
  }

  let decoded: string;
  try {
    decoded = atob(headerValue);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as HoneypotPayload).value !== 'string' ||
    typeof (parsed as HoneypotPayload).mountedAt !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  const payload = parsed as HoneypotPayload;

  if (payload.value.length > 0) {
    return { ok: false, reason: 'non_empty' };
  }

  if (now() - payload.mountedAt < minMs) {
    return { ok: false, reason: 'too_fast' };
  }

  return { ok: true };
}
```

- [ ] **Step 2: Smoke-test the helpers in a Node one-liner**

Run (one-liner to avoid adding a test framework):
```bash
npx tsx -e "
import { encodeHoneypotHeader, decodeAndValidateHoneypot } from './lib/anti-bot/honeypot.ts';

// happy path: empty value, mounted 2 seconds ago
const happy = encodeHoneypotHeader({ value: '', mountedAt: Date.now() - 2000 });
console.log('happy:', decodeAndValidateHoneypot(happy));

// non_empty: bot filled the field
const filled = encodeHoneypotHeader({ value: 'spam', mountedAt: Date.now() - 2000 });
console.log('filled:', decodeAndValidateHoneypot(filled));

// too_fast: submitted instantly
const fast = encodeHoneypotHeader({ value: '', mountedAt: Date.now() });
console.log('fast:', decodeAndValidateHoneypot(fast));

// malformed
console.log('malformed:', decodeAndValidateHoneypot('not-base64!@'));
console.log('missing:', decodeAndValidateHoneypot(null));
"
```

Expected output:
```
happy: { ok: true }
filled: { ok: false, reason: 'non_empty' }
fast: { ok: false, reason: 'too_fast' }
malformed: { ok: false, reason: 'malformed' }
missing: { ok: false, reason: 'malformed' }
```

If `tsx` isn't installed, use `npx -y tsx -e "..."` to fetch it on the fly. This is a one-time check; do not add `tsx` to devDependencies.

- [ ] **Step 3: Commit**

```bash
git add lib/anti-bot/honeypot.ts
git commit -m "$(cat <<'EOF'
feat: honeypot encode/decode helpers

Pure functions for the honeypot defense layer.

- encodeHoneypotHeader: client-side, base64(JSON({value, mountedAt}))
- decodeAndValidateHoneypot: server-side, returns discriminated union
  with reasons: non_empty | too_fast | malformed | ok

Smoke-tested via npx tsx one-liner (no test framework added per repo
convention of no automated tests).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Register captcha plugin and honeypot hook in `lib/auth.ts`

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Replace the file with the updated version**

Replace the entire contents of `lib/auth.ts` with:

```ts
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
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors. If the `captcha` import path or `createAuthMiddleware` shape differs in `better-auth@1.5.5`, the TS compiler will flag it — fall back to inspecting `node_modules/better-auth/dist/plugins/index.d.ts` and `node_modules/better-auth/dist/api/index.d.ts` for the correct names. The Better Auth docs reference both paths verbatim.

- [ ] **Step 3: Smoke-test the dev server loads**

Run:
```bash
npm run dev
```

Visit `http://localhost:3000/login` in a browser. Expected: the page loads (the widget won't render yet — that's the next task). No 500 errors from `lib/auth.ts`. Kill the dev server with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts
git commit -m "$(cat <<'EOF'
feat: register captcha plugin and honeypot hook in lib/auth.ts

- captcha plugin (provider: cloudflare-turnstile) validates the
  x-captcha-response header against Cloudflare siteverify before
  /sign-up/email and /sign-in/email run.
- hooks.before matcher on the same two paths reads the x-hpf header
  and runs decodeAndValidateHoneypot. Trips return a generic 400
  ('Unable to verify request') so attackers can't fingerprint which
  layer rejected.
- Dev fallback: missing TURNSTILE_SECRET_KEY in development uses
  Cloudflare's published always-pass test secret. Production builds
  throw immediately if the env var is missing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Build the `Turnstile.tsx` component

**Files:**
- Create: `components/common/Turnstile.tsx`
- Modify: `components/common/index.ts`

- [ ] **Step 1: Write the component**

Create `components/common/Turnstile.tsx`:

```tsx
'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Turnstile as CFTurnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { TURNSTILE_DEV_KEYS } from '@/lib/anti-bot/constants';

export interface TurnstileHandle {
  /** Reset the widget so a new token will be issued. Call after a failed submit. */
  reset: () => void;
}

interface TurnstileProps {
  /** Receives a fresh token whenever Cloudflare resolves the challenge. */
  onToken: (token: string) => void;
  /** Called when the widget errors out (network, invalid key, etc.). */
  onError?: () => void;
  /** Called when the issued token expires. Widget auto-refreshes; this is informational. */
  onExpire?: () => void;
}

function resolveSiteKey(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    // In production, missing site key surfaces as a render error rather than a
    // silent always-pass. The server-side env check is the authoritative gate.
    return '';
  }

  return TURNSTILE_DEV_KEYS.SITE_KEY;
}

export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(
  ({ onToken, onError, onExpire }, ref) => {
    const innerRef = useRef<TurnstileInstance | null>(null);
    const siteKey = resolveSiteKey();

    useImperativeHandle(ref, () => ({
      reset: () => innerRef.current?.reset(),
    }), []);

    if (!siteKey) {
      return (
        <p className="text-sm text-[var(--color-error)]">
          Verification service unavailable. Please contact support.
        </p>
      );
    }

    return (
      <div className="my-2">
        <CFTurnstile
          ref={innerRef}
          siteKey={siteKey}
          onSuccess={onToken}
          onError={onError}
          onExpire={onExpire}
          options={{
            // Managed mode is configured in the Cloudflare dashboard; the
            // component renders whatever mode the site is set to. No appearance
            // override here so Cloudflare's adaptive challenge UX wins.
            theme: 'auto',
          }}
        />
      </div>
    );
  }
);

Turnstile.displayName = 'Turnstile';
```

- [ ] **Step 2: Re-export from the barrel**

Modify `components/common/index.ts`:

```ts
export { Button } from './Button';
export { Input } from './Input';
export { Textarea } from './Textarea';
export { Modal } from './Modal';
export { Badge } from './Badge';
export { Turnstile, type TurnstileHandle } from './Turnstile';
```

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/common/Turnstile.tsx components/common/index.ts
git commit -m "$(cat <<'EOF'
feat: Turnstile component wrapper

Thin client component around @marsidev/react-turnstile. Resolves the
site key from NEXT_PUBLIC_TURNSTILE_SITE_KEY or falls back to
Cloudflare's published always-pass test key in development. Exposes a
ref handle with reset() so consumers can refresh the widget after a
failed submit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Extend `authStore` signUp / signIn to forward anti-bot headers

**Files:**
- Modify: `stores/authStore.ts`

- [ ] **Step 1: Update the file**

Replace the entire contents of `stores/authStore.ts` with:

```ts
'use client';

import { create } from 'zustand';
import { authClient } from '@/lib/auth-client';
import { ANTI_BOT_HEADERS } from '@/lib/anti-bot/constants';
import { encodeHoneypotHeader, type HoneypotPayload } from '@/lib/anti-bot/honeypot';
import type { AdminUser, User, Subscription } from '@/types';

export interface AntiBotPayload {
  /** Token issued by the Cloudflare Turnstile widget. */
  captchaToken: string;
  /** Honeypot field value + mountedAt timestamp. */
  honeypot: HoneypotPayload;
}

function buildAntiBotHeaders(antiBot: AntiBotPayload): Record<string, string> {
  return {
    [ANTI_BOT_HEADERS.CAPTCHA_RESPONSE]: antiBot.captchaToken,
    [ANTI_BOT_HEADERS.HONEYPOT]: encodeHoneypotHeader(antiBot.honeypot),
  };
}

interface AuthState {
  user: User | null;
  adminUser: AdminUser | null;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string, antiBot: AntiBotPayload, redirectTo?: string) => Promise<string>;
  signUp: (email: string, password: string, name: string, antiBot: AntiBotPayload) => Promise<string>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  adminUser: null,
  subscription: null,
  loading: true,
  error: null,
  isAuthenticated: false,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const session = await authClient.getSession();
      if (!session.data?.user) {
        set({ user: null, adminUser: null, subscription: null, loading: false, isAuthenticated: false });
        return;
      }

      const adminRes = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
      const adminUser = adminRes.ok ? await adminRes.json() : null;

      set({
        user: session.data.user,
        adminUser,
        subscription: null,
        loading: false,
        isAuthenticated: true,
      });
    } catch {
      set({ user: null, adminUser: null, subscription: null, loading: false, isAuthenticated: false });
    }
  },

  signIn: async (email, password, antiBot, redirectTo) => {
    set({ loading: true, error: null });
    const result = await authClient.signIn.email(
      { email, password },
      { headers: buildAntiBotHeaders(antiBot) }
    );
    if (result.error) {
      set({ loading: false, error: result.error.message });
      throw new Error(result.error.message);
    }

    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ loading: false, error: 'Sign in failed' });
      throw new Error('Sign in failed');
    }

    const adminRes = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
    const adminUser = adminRes.ok ? await adminRes.json() : null;

    set({
      user: session.data.user,
      adminUser,
      loading: false,
      isAuthenticated: true,
    });

    return redirectTo || '/dashboard';
  },

  signUp: async (email, password, name, antiBot) => {
    set({ loading: true, error: null });
    const result = await authClient.signUp.email(
      { email, password, name },
      { headers: buildAntiBotHeaders(antiBot) }
    );
    if (result.error) {
      set({ loading: false, error: result.error.message });
      throw new Error(result.error.message);
    }

    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ loading: false, error: 'Sign up failed' });
      throw new Error('Sign up failed');
    }

    set({
      user: session.data.user,
      adminUser: null,
      loading: false,
      isAuthenticated: true,
    });

    return '/dashboard';
  },

  signOut: async () => {
    await authClient.signOut();
    set({ user: null, adminUser: null, subscription: null, loading: false, error: null, isAuthenticated: false });
  },
}));
```

Notes:
- The `signIn` parameter order moved from `(email, password, redirectTo?)` to `(email, password, antiBot, redirectTo?)`. This is intentional — both call sites (`SignUpPage`, `LoginPage`) are updated in the next two tasks. Searching the codebase confirms these are the only consumers.
- Better Auth's `authClient.signIn.email` / `signUp.email` accept a second argument of fetch overrides; `headers` is forwarded to the underlying request. If the runtime API shape differs (e.g., `fetchOptions` is the key), adjust here. Verify against `node_modules/better-auth/dist/client/index.d.ts`.

- [ ] **Step 2: Confirm only the two known call sites consume these signatures**

Run:
```bash
grep -rn "useAuthStore\|\.signIn(\|\.signUp(" --include="*.tsx" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -v .next | grep -v stores/authStore.ts
```

Expected hits: `components/pages/SignUpPage.tsx`, `app/login/page.tsx`, and any header/avatar component that calls `signOut()` (no signature change needed there). No other call sites should exist.

- [ ] **Step 3: Type-check (will fail until Tasks 7+8 land)**

Run:
```bash
npx tsc --noEmit
```

Expected: errors in `SignUpPage.tsx` and `app/login/page.tsx` because their `signUp(email, password, name)` / `signIn(email, password, redirectParam)` calls now miss the `antiBot` argument. This is expected — Tasks 7 and 8 fix it. Do NOT commit yet — bundle this with Task 7 to keep the tree compiling at every commit boundary.

Actually, to keep commits green, this task's commit is held until Task 7 succeeds. Mark Step 4 of this task as "Combined with Task 7 commit."

- [ ] **Step 4: Combined commit with Task 7** — see Task 7 Step 4.

---

## Task 7: Update `SignUpPage` to render Turnstile + honeypot

**Files:**
- Modify: `components/pages/SignUpPage.tsx`

- [ ] **Step 1: Replace the file**

Replace `components/pages/SignUpPage.tsx` with:

```tsx
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { UserPlus, CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Input, Button, Turnstile, type TurnstileHandle } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { HONEYPOT_FIELD_NAME } from '@/lib/anti-bot/constants';

export function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [verificationUnavailable, setVerificationUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const mountedAtRef = useRef<number>(Date.now());
  const turnstileRef = useRef<TurnstileHandle | null>(null);
  const signUp = useAuthStore((s) => s.signUp);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!captchaToken) {
      setError('Verification not ready yet — please wait a moment.');
      return;
    }

    setLoading(true);

    try {
      const destination = await signUp(
        email,
        password,
        name.trim() || email.split('@')[0],
        {
          captchaToken,
          honeypot: { value: honeypot, mountedAt: mountedAtRef.current },
        }
      );
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        window.location.href = destination;
      }, 900);
    } catch (err) {
      // Generic message — never expose which layer rejected.
      const raw = err instanceof Error ? err.message : 'Sign up failed';
      const isVerificationLayer =
        raw.toLowerCase().includes('verify') || raw.toLowerCase().includes('captcha');
      setError(isVerificationLayer ? 'Verification failed — please try again.' : raw);
      setLoading(false);
      setCaptchaToken(null);
      turnstileRef.current?.reset();
    }
  };

  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-8 shadow-sm"
          >
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-navy)]/10 text-[var(--color-navy)]">
                <UserPlus size={24} />
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-gray-8)]">Create Account</h1>
              <p className="mt-2 text-sm text-[var(--color-gray-6)]">
                Sign up to save your retros and manage your boards.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
                {error}
              </div>
            )}

            {verificationUnavailable && (
              <div className="mb-4 rounded-lg bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
                Verification service unavailable. Please disable privacy blockers for this page and refresh.
              </div>
            )}

            {success && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--color-success)]/10 px-4 py-3 text-sm font-medium text-[var(--color-success)]"
              >
                <CheckCircle2 size={16} />
                <span>Account created. Redirecting...</span>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <Input
                id="signup-name"
                label="Your name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                disabled={loading || success}
              />
              <Input
                id="signup-email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading || success}
              />
              <Input
                id="signup-password"
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                minLength={8}
                required
                disabled={loading || success}
              />

              {/* Honeypot: hidden from humans, visible to naïve bots */}
              <input
                type="text"
                name={HONEYPOT_FIELD_NAME}
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
              />

              <Turnstile
                ref={turnstileRef}
                onToken={setCaptchaToken}
                onError={() => setVerificationUnavailable(true)}
                onExpire={() => setCaptchaToken(null)}
              />

              <Button
                type="submit"
                loading={loading}
                disabled={success || !captchaToken || verificationUnavailable}
                className="mt-2 w-full"
              >
                <UserPlus size={18} /> Create Account
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-[var(--color-gray-6)]">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-[var(--color-navy)] hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Type-check (must now pass cleanly)**

Run:
```bash
npx tsc --noEmit
```

Expected: zero errors in `SignUpPage.tsx`. `app/login/page.tsx` will still error until Task 8.

- [ ] **Step 3: Manual smoke test (dev server)**

Run:
```bash
npm run dev
```

In a browser, visit `http://localhost:3000/signup`:
- Widget renders (because dev test key is the always-pass key — you'll see a brief Turnstile widget that auto-completes).
- The submit button is initially disabled and enables once the token resolves (within ~1 second).
- Fill out the form with a brand-new email + password (min 8 chars) + a name → click Create Account.
- Expect: success message, redirect to `/dashboard`.
- Verify in Neon: new row in the `user` table.

Kill the dev server with Ctrl-C. If anything fails, fix and re-run before committing.

- [ ] **Step 4: Combined commit (Tasks 6 + 7)**

```bash
git add stores/authStore.ts components/pages/SignUpPage.tsx
git commit -m "$(cat <<'EOF'
feat: signup page renders Turnstile + honeypot

- authStore signUp/signIn signatures gain a required antiBot payload
  ({ captchaToken, honeypot: { value, mountedAt } }), forwarded to
  Better Auth as x-captcha-response and x-hpf headers.
- SignUpPage renders the Turnstile widget (managed mode via dashboard
  config) and an off-screen honeypot input. mountedAt is captured on
  first render. Submit disabled until a token is present. Generic
  'Verification failed' message on rejection regardless of which layer
  caught it. Widget auto-resets after failure so users can retry.

LoginPage update follows in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update `app/login/page.tsx` to render Turnstile + honeypot

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Replace the file**

Replace `app/login/page.tsx` with:

```tsx
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { LogIn, CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Input, Button, Turnstile, type TurnstileHandle } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { HONEYPOT_FIELD_NAME } from '@/lib/anti-bot/constants';

function isSafeRedirect(url: string | null | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//');
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [verificationUnavailable, setVerificationUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const mountedAtRef = useRef<number>(Date.now());
  const turnstileRef = useRef<TurnstileHandle | null>(null);
  const signIn = useAuthStore((s) => s.signIn);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!captchaToken) {
      setError('Verification not ready yet — please wait a moment.');
      return;
    }

    setLoading(true);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const rawRedirect = urlParams.get('redirect') || urlParams.get('from');
      const redirectParam = isSafeRedirect(rawRedirect) ? rawRedirect : undefined;
      const destination = await signIn(
        email,
        password,
        {
          captchaToken,
          honeypot: { value: honeypot, mountedAt: mountedAtRef.current },
        },
        redirectParam
      );
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        window.location.href = destination;
      }, 900);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Sign in failed';
      const isVerificationLayer =
        raw.toLowerCase().includes('verify') || raw.toLowerCase().includes('captcha');
      setError(isVerificationLayer ? 'Verification failed — please try again.' : raw);
      setLoading(false);
      setCaptchaToken(null);
      turnstileRef.current?.reset();
    }
  };

  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-8 shadow-sm"
          >
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-navy)]/10 text-[var(--color-navy)]">
                <LogIn size={24} />
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-gray-8)]">Welcome Back</h1>
              <p className="mt-2 text-sm text-[var(--color-gray-6)]">
                Sign in to access your boards.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
                {error}
              </div>
            )}

            {verificationUnavailable && (
              <div className="mb-4 rounded-lg bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
                Verification service unavailable. Please disable privacy blockers for this page and refresh.
              </div>
            )}

            {success && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--color-success)]/10 px-4 py-3 text-sm font-medium text-[var(--color-success)]"
              >
                <CheckCircle2 size={16} />
                <span>Successfully logged in. Redirecting...</span>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <Input
                id="login-email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading || success}
              />
              <Input
                id="login-password"
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                disabled={loading || success}
              />

              {/* Honeypot: hidden from humans, visible to naïve bots */}
              <input
                type="text"
                name={HONEYPOT_FIELD_NAME}
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
              />

              <Turnstile
                ref={turnstileRef}
                onToken={setCaptchaToken}
                onError={() => setVerificationUnavailable(true)}
                onExpire={() => setCaptchaToken(null)}
              />

              <Button
                type="submit"
                loading={loading}
                disabled={success || !captchaToken || verificationUnavailable}
                className="mt-2 w-full"
              >
                <LogIn size={18} /> Sign In
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-[var(--color-gray-6)]">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-[var(--color-navy)] hover:underline">
                Sign up free
              </Link>
            </p>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Type-check (whole repo)**

Run:
```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Manual smoke test (dev server)**

Run:
```bash
npm run dev
```

In a browser:
1. Visit `http://localhost:3000/login`. Widget renders, submit disabled briefly, then enables.
2. Sign in with the account created in Task 7. Expect redirect to `/dashboard`.
3. Sign out (header avatar → sign out).
4. Re-visit `/login` and confirm the widget still renders.

Kill the dev server with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "$(cat <<'EOF'
feat: login page renders Turnstile + honeypot

Matches the signup treatment from the previous commit. Widget +
off-screen honeypot input + mountedAt ref. Submit disabled until
Turnstile token is present. Generic 'Verification failed' message on
rejection. Widget resets after failure for retry.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Wire favicon via `metadata.icons`

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update `app/layout.tsx`**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import '@/styles/index.css';

export const metadata: Metadata = {
  title: 'RetroBoard',
  description: 'Real-time retrospective board for team collaboration',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('retro-theme');if(t==='light'||t==='dark'||t==='system')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Manual verification**

Run:
```bash
npm run dev
```

Hard-refresh `http://localhost:3000/` in Chrome (Cmd-Shift-R / Ctrl-Shift-R). The tab icon should now be the red rounded square with the teal corner. If it still shows the default globe, force a deeper cache flush:

1. Close all RetroBoard tabs
2. DevTools → Application → Clear storage → Clear site data
3. Reopen the page

Repeat in Firefox and Safari if available — all modern browsers support SVG favicons.

Kill the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "$(cat <<'EOF'
feat: wire favicon via metadata.icons

public/favicon.svg already existed but was never referenced from the
document head, so browser tabs requested /favicon.ico and fell back to
the default globe icon. Adding metadata.icons makes Next.js emit the
correct <link rel='icon' type='image/svg+xml' href='/favicon.svg'>
tag. No new image assets required.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Create `.env.example`

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write the file**

Create `.env.example`:

```ini
# Neon Postgres
DATABASE_URL=postgresql://...

# Better Auth
BETTER_AUTH_SECRET=generate-via-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Ably (server-side only)
ABLY_API_KEY=

# Resend (transactional email)
RESEND_API_KEY=

# Cloudflare Turnstile (signup + login anti-bot)
# Site key is public; secret is server-only. Provision at:
# https://dash.cloudflare.com/?to=/:account/turnstile
# Set widget mode to "Managed" and include all domains (localhost, preview, prod).
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

- [ ] **Step 2: Verify the local `.env.local` actually has the two new keys**

Run:
```bash
grep -E "^NEXT_PUBLIC_TURNSTILE_SITE_KEY=|^TURNSTILE_SECRET_KEY=" .env.local || echo "MISSING — add real keys from Cloudflare dashboard"
```

If "MISSING" prints, Jordan needs to paste the keys into `.env.local` (and Vercel) before this feature can be tested with real Cloudflare validation. Until then the dev fallback (always-pass test keys) keeps local dev working.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
docs: .env.example with Turnstile keys documented

Adds the two new env vars (NEXT_PUBLIC_TURNSTILE_SITE_KEY,
TURNSTILE_SECRET_KEY) alongside the existing Neon/Better Auth/Ably/
Resend placeholders. Includes a pointer to the Cloudflare Turnstile
dashboard and a note on the required widget mode.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: End-to-end verification + build gate

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Production build**

Run:
```bash
npm run build
```

Expected: build succeeds with all routes compiled. If `lib/auth.ts` throws at module evaluation because `TURNSTILE_SECRET_KEY` is missing in the build environment, that's the production gate working — the build runs with `NODE_ENV=production`. To unblock the local build, set the env var locally for this command only:

```bash
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA npm run build
```

(Using the dev test secret just to clear the build gate; production deploys must use the real secret.)

- [ ] **Step 3: Full verification matrix (manual, browser-based)**

Run `npm run dev` and walk through every row of the testing table from the spec:

| Scenario                                | Pass criteria                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Signup happy path                       | New account created, redirect to `/dashboard`, row visible in Neon `user` table.                                                          |
| Login happy path                        | Sign in with the new account succeeds, redirect to `/dashboard`.                                                                           |
| Honeypot trip                           | DevTools → set the `company_url` input value to `"x"` → submit → 400 response, no Neon row created.                                       |
| Min-time-to-submit trip                 | DevTools console: `document.querySelector('form').requestSubmit()` within 500 ms of `/signup` load → 400 response.                          |
| Missing Turnstile token (replay attack) | DevTools network → right-click signup POST → Replay XHR with header `x-captcha-response` removed → expect 403.                              |
| Failed Turnstile token                  | Temporarily set `NEXT_PUBLIC_TURNSTILE_SITE_KEY=2x00000000000000000000AB` (always-fail) in `.env.local`, restart dev → submit → 403.        |
| Privacy blocker simulation              | DevTools → Network → Add request blocking pattern `challenges.cloudflare.com/*` → reload `/signup` → expect "Verification service unavailable" message and disabled submit button. |
| Favicon renders                         | Hard-refresh `/` in Chrome → tab icon = red/teal mark.                                                                                    |

Document each result inline (✓ / ✗) in your final report to Jordan. Any ✗ requires a fix commit before merging.

- [ ] **Step 4: Push the feature branch**

```bash
git push -u origin feature/turnstile-honeypot-favicon
```

Then create a PR develop ← feature/turnstile-honeypot-favicon via `gh pr create` (do not run this without Jordan's confirmation — per CLAUDE.md, PR creation is a user-explicit action).

- [ ] **Step 5: Final summary report to Jordan**

Post a status comment with:
- Commits on the branch (one per task)
- Verification matrix results
- Any caveats (env vars to set on Vercel preview/prod before merge)

---

## Verification Matrix (filled in during Task 11)

| #  | Scenario                          | Result |
| -- | --------------------------------- | ------ |
| 1  | Signup happy path                 |        |
| 2  | Login happy path                  |        |
| 3  | Honeypot trip                     |        |
| 4  | Min-time trip                     |        |
| 5  | Missing token replay              |        |
| 6  | Failed token (always-fail key)    |        |
| 7  | Privacy blocker simulation        |        |
| 8  | Favicon renders                   |        |
| 9  | `tsc --noEmit` clean              |        |
| 10 | `npm run build` clean             |        |
