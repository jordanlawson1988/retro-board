'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Input, Button } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';

export function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const redirect = await signUp(email, password, name.trim() || email.split('@')[0]);
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
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

            <div className="flex flex-col gap-4">
              <Input
                id="signup-name"
                label="Your name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
              />
              <Input
                id="signup-email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
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
              />

              <Button
                type="submit"
                loading={loading}
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
