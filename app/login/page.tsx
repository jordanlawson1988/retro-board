'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Input, Button } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const redirect = await signIn(email, password);
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
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

            <div className="flex flex-col gap-4">
              <Input
                id="login-email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <Input
                id="login-password"
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
              />

              <Button
                type="submit"
                loading={loading}
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
