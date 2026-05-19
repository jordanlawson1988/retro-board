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
