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
