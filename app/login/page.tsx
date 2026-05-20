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
            className="rounded-[var(--r-2xl)] border border-[var(--line)] bg-[var(--bg-elev)] p-8 shadow-[var(--shadow-md)]"
          >
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--r-lg)] bg-[var(--accent-soft)] text-[var(--accent)]">
                <LogIn size={24} />
              </div>
              <h1 className="text-2xl font-bold text-[var(--ink)]">Welcome Back</h1>
              <p className="mt-2 text-sm text-[var(--ink-3)]">
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
                variant="accent"
                size="lg"
                loading={loading}
                disabled={success || !captchaToken || verificationUnavailable}
                className="mt-2 w-full"
              >
                <LogIn size={18} /> Sign In
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-[var(--ink-3)]">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-[var(--accent)] hover:underline">
                Sign up free
              </Link>
            </p>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
