# Cloudflare Turnstile + Honeypot for New-User Forms

**Date:** 2026-05-19
**Status:** Approved for implementation
**Scope:** Signup + Login (Better Auth email/password flows) + favicon metadata fix

## Goal

Reduce bot signups and credential-stuffing attempts on RetroBoard's two Better Auth entry points by adding two layers of bot defense:

1. **Cloudflare Turnstile** — invisible/managed challenge, server-validated via Better Auth's first-party `captcha` plugin.
2. **Honeypot** — hidden form field + minimum time-to-submit check, server-validated via a Better Auth `hooks.before` matcher.

Also ship the existing `public/favicon.svg` properly via Next.js metadata so browser tabs render the brand mark instead of the default icon.

## Non-Goals

- Protecting `/api/boards` (anonymous board creation) or participant join (`JoinModal`). Out of scope this release.
- Replacing Better Auth's auth handler. The catch-all `app/api/auth/[...all]/route.ts` stays.
- New `account verification` email step. Not in scope.
- Brute-force rate limiting on `/login`. Turnstile is the layer being added now; rate limiting is a separate workstream.

## Architecture Overview

Two server-enforced layers in front of two Better Auth endpoints:

| Endpoint                        | Turnstile (plugin) | Honeypot (`hooks.before`) |
| ------------------------------- | ------------------ | -------------------------- |
| `POST /api/auth/sign-up/email`  | ✓                  | ✓                          |
| `POST /api/auth/sign-in/email`  | ✓                  | ✓                          |

The `captcha` plugin validates the Turnstile token against Cloudflare's `siteverify` endpoint on the server. The `hooks.before` matcher reads the honeypot payload from a custom header and validates two predicates:

1. Honeypot field value is empty
2. Time between form mount and submit is ≥ 1500 ms

If either predicate fails, the hook returns a generic `400` and Better Auth never runs the underlying signup/sign-in logic. The honeypot trip surface uses the same error shape as a Turnstile failure so probes can't fingerprint which layer rejected.

## Components

### New

| File                                  | Purpose                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/common/Turnstile.tsx`     | Thin wrapper around `@marsidev/react-turnstile`. Invisible mode. Exposes `onSuccess(token)`, `onError`, `onExpire`. Auto-resets on parent unmount.       |
| `lib/anti-bot/honeypot.ts`            | Pure helpers. Client: `encodeHoneypotHeader({ value, mountedAt })`. Server: `decodeAndValidateHoneypot(headerValue, { minMs })`. Returns discriminated union `{ ok: true } \| { ok: false, reason: 'non_empty' \| 'too_fast' \| 'malformed' }`. |
| `lib/anti-bot/constants.ts`           | Single source of truth: header names (`x-captcha-response`, `x-hpf`), min submit time (1500 ms), honeypot form-field name (`company_url`). Imported by every consumer.                                          |

### Modified

| File                              | Change                                                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/auth.ts`                     | Register `captcha` plugin (`provider: 'cloudflare-turnstile'`, `secretKey: env.TURNSTILE_SECRET_KEY`). Add `hooks.before` matcher on `/sign-up/email` and `/sign-in/email` paths that calls `decodeAndValidateHoneypot`. |
| `components/pages/SignUpPage.tsx` | Render `<Turnstile />`. Hold `captchaToken` in state. Render hidden honeypot input. Capture `mountedAt` ref on first render. Disable submit until token present. Pass headers via `signUp(...)` extended signature. |
| `app/login/page.tsx`              | Identical treatment to SignUpPage: widget + honeypot + headers in `signIn(...)`.                                                                                                  |
| `stores/authStore.ts`             | Extend `signIn(email, password, redirectTo, antiBot?)` and `signUp(email, password, name, antiBot?)` signatures. The `antiBot` object holds `{ captchaToken, honeypot }` and gets forwarded via `authClient.*.email({ fetchOptions: { headers } })`. |
| `app/layout.tsx`                  | Add `metadata.icons = { icon: '/favicon.svg' }` so the existing SVG actually renders in browser tabs.                                                                             |
| `.env.example` (create)           | Document `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` placeholders.                                                                                                |

### Dependencies

- `@marsidev/react-turnstile` (~3 kB, MIT, well-maintained). Loads Cloudflare's `turnstile.js` once per session and manages widget lifecycle. Picked over rolling a custom script-tag component for clarity and reset/expiry handling.

## Data Flow

### Signup

```
User loads /signup
  ├── SignUpPage mounts → mountedAtRef.current = performance.now()
  ├── <Turnstile siteKey=NEXT_PUBLIC_TURNSTILE_SITE_KEY /> mounts
  │     ├── Cloudflare runs invisible challenge in background
  │     └── On success → setCaptchaToken(token) → submit button enabled
  └── Hidden honeypot input renders off-screen (tabIndex=-1, aria-hidden, autoComplete=off)

User submits form
  ├── handleSubmit gathers { email, password, name, captchaToken, honeypotValue, mountedAt }
  ├── authClient.signUp.email({
  │     email, password, name,
  │     fetchOptions: { headers: {
  │       'x-captcha-response': captchaToken,
  │       'x-hpf': encodeHoneypotHeader({ value: honeypotValue, mountedAt })
  │     }}
  │   })
  └── POST /api/auth/sign-up/email
        ├── hooks.before matcher runs first
        │     └── decodeAndValidateHoneypot(req.headers['x-hpf'])
        │           ├── { ok: false } → return 400 { error: 'Unable to verify request' }
        │           └── { ok: true } → continue
        ├── captcha plugin reads x-captcha-response
        │     ├── POST to challenges.cloudflare.com/turnstile/v0/siteverify
        │     ├── verify success → continue
        │     └── verify fail → return 403 { error: 'Unable to verify request' }
        └── Better Auth runs normal signup
              ├── creates user + session cookie
              └── 200 { user, session }

Client
  ├── On success → setSuccess(true) → redirect to /dashboard via full reload
  └── On failure → setError('Verification failed — please try again.') and reset Turnstile widget
```

### Sign-in

Identical to signup, hits `/sign-in/email`.

## Error Handling

| Failure mode                              | User-facing message                                                                          | Server response          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| Turnstile script blocked / fails to load  | "Verification service unavailable. Please disable privacy blockers for this page and refresh." | n/a (client-side only)   |
| Turnstile token verification fails        | "Verification failed — please try again."                                                    | `403`                    |
| Token expired before submit (~5 min)      | Widget auto-refreshes silently. If refresh itself fails, fall back to the "Verification service unavailable" message. | n/a                      |
| Honeypot field non-empty                  | "Unable to verify request."                                                                  | `400`                    |
| Submitted under 1500 ms after mount       | "Unable to verify request."                                                                  | `400`                    |
| Bad/missing `x-hpf` header (malformed)    | "Unable to verify request."                                                                  | `400`                    |

Generic messaging on every server-side failure prevents attackers from fingerprinting which layer caught them. Client-side `Turnstile script blocked` is the only differentiated message because that case requires user action (disable blockers) rather than masking the rejection logic.

## Environment & Setup

### Env vars

| Name                                | Where it lives           | Purpose                                                                       |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`    | `.env.local` + Vercel    | Public site key. Embedded in client bundle. Needs the `NEXT_PUBLIC_` prefix.  |
| `TURNSTILE_SECRET_KEY`              | `.env.local` + Vercel    | Server-only secret. Used by Better Auth `captcha` plugin for siteverify.      |

### Cloudflare setup (manual, once)

1. Cloudflare dashboard → Turnstile → "Add site"
2. Widget mode: **Managed**
3. Domains: `localhost`, `127.0.0.1`, production hostname(s) (Vercel preview + prod)
4. Copy site key + secret into `.env.local` and Vercel project env (Preview + Production)
5. No DNS or proxy changes required — Turnstile works on any domain

### Dev fallback

If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset in `NODE_ENV=development`, the `Turnstile.tsx` component uses Cloudflare's published always-pass test site key `1x00000000000000000000AA`. The server-side `captcha` plugin uses the matching test secret `1x0000000000000000000000000000000AA`. This lets local development continue to work without real keys but **production builds refuse to start without real keys present** — a runtime check in `lib/auth.ts` throws if `NODE_ENV === 'production' && !process.env.TURNSTILE_SECRET_KEY`.

## Favicon

The repo already has `public/favicon.svg` matching the brand (red rounded square with a teal corner triangle, colors `#DD0031` and `#004F71`). It is not currently wired into the document `<head>`, so browser tabs request `/favicon.ico` by default and fall back to the browser's default icon.

Fix in `app/layout.tsx`:

```ts
export const metadata: Metadata = {
  title: 'RetroBoard',
  description: 'Real-time retrospective board for team collaboration',
  icons: { icon: '/favicon.svg' },
};
```

No new image assets needed. Modern browsers (Chrome, Firefox, Safari, Edge) all support SVG favicons. Older clients without SVG support will silently fall back to no icon, which matches today's behavior.

## Testing

Repo has no automated test suite (per `CLAUDE.md`). Verification plan, gated by the `ui-feature-verify` skill before merge:

| Scenario                                       | How to verify                                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Signup happy path**                          | Browser: visit `/signup`, fill form, submit. Confirm invisible Turnstile completes, redirect to `/dashboard`, new row in Neon `user` table.   |
| **Login happy path**                           | Browser: sign out, visit `/login`, sign in. Same as above, redirect to `/dashboard`.                                                          |
| **Honeypot trip**                              | Browser devtools: set the honeypot input value to `"x"`, submit. Expect 400, no account created (verify Neon).                                |
| **Min-time-to-submit trip**                    | Browser devtools console: dispatch the form's submit event programmatically within 500 ms of page load. Expect 400.                            |
| **Missing Turnstile token**                    | Browser devtools network tab: replay a signup POST with the `x-captcha-response` header stripped. Expect 403.                                  |
| **Failed Turnstile token**                     | Switch the site key to Cloudflare's always-fail test key `2x00000000000000000000AB`. Submit. Expect 403.                                       |
| **Privacy blocker simulation**                 | Browser devtools network tab: block `challenges.cloudflare.com`. Reload `/signup`. Expect inline "Verification service unavailable" message.    |
| **Favicon renders**                            | Hard refresh in Chrome, Firefox, Safari. Tab icon shows the red/teal mark, not the default globe.                                              |
| **TypeScript + build**                         | `npx tsc --noEmit && npm run build` clean on develop before promoting to main.                                                                |

## Risks & Trade-offs

1. **Third-party dep**: `@marsidev/react-turnstile` is a ~3 kB MIT-licensed wrapper. Adds one transitive dependency. Alternative: load `turnstile.js` manually via a `<Script>` tag and manage state ourselves (~30 LOC). Picked the library because reset/expiry/error lifecycle handling is fiddly. If the dep is unacceptable later, the `Turnstile.tsx` component is a drop-in replacement boundary.
2. **Header-based honeypot is unconventional**: Better Auth's signup/sign-in body schema is fixed (`{email, password, name}`). Adding form fields to the body would require extending Better Auth's user schema, which is overkill for a hidden defensive field. Headers are the cleanest extension point and `hooks.before` reads them directly.
3. **Better Auth `hooks.before` API**: confirmed available in better-auth 1.5.5 via docs. The exact request-context shape (how to read headers) will be verified during implementation; if it diverges from expectation, fall back to a thin custom middleware that runs before the Better Auth handler in the catch-all route.
4. **Legitimate-user failure surface**: privacy-blocking extensions (uBlock, Privacy Badger with strict rules) can block `challenges.cloudflare.com`. Mitigated by the explicit "disable privacy blockers" message. Acceptable trade-off — these users are a small percentage and the prompt is actionable.
5. **Dev fallback security**: the dev fallback only activates when `NODE_ENV !== 'production'` AND the env var is missing. Production builds hard-fail without real keys to prevent accidental "always pass" deployment.
6. **Existing sessions**: no impact. Users with active session cookies are not re-challenged. New sign-ins on `/login` will go through Turnstile.

## Out of Scope for This Spec

- Cloudflare bot management rules (zone-level, not application-level)
- Rate limiting on `/login` (separate workstream)
- CAPTCHA on board creation or participant join (anonymous flows; deferred)
- Account email verification step (separate workstream)

## Implementation Order (preview — full plan to follow)

1. Add `@marsidev/react-turnstile` dep
2. Create `lib/anti-bot/constants.ts` and `lib/anti-bot/honeypot.ts`
3. Wire `captcha` plugin + `hooks.before` honeypot matcher in `lib/auth.ts`
4. Build `components/common/Turnstile.tsx`
5. Update `stores/authStore.ts` signatures
6. Update `SignUpPage.tsx` and `app/login/page.tsx` to render widget + honeypot + pass headers
7. Add `metadata.icons` to `app/layout.tsx`
8. Add `.env.example`
9. Manual verification per Testing table
10. `tsc --noEmit && npm run build`
11. Deploy to develop → verify on preview → merge to main
