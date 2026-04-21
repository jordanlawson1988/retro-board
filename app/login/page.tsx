'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogIn, CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Input, Button } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';

function isSafeRedirect(url: string | null | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//');
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const rawRedirect = urlParams.get('redirect') || urlParams.get('from');
      const redirectParam = isSafeRedirect(rawRedirect) ? rawRedirect : undefined;
      const destination = await signIn(email, password, redirectParam);
      setLoading(false);
      setSuccess(true);
      // Full page load so middleware reads the fresh Better Auth cookie
      setTimeout(() => {
        window.location.href = destination;
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setLoading(false);
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

              <Button
                type="submit"
                loading={loading}
                disabled={success}
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
