'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <p className="mt-4 text-sm text-[var(--ink-2)]">
        This reset link is invalid or incomplete. Request a new one from the{' '}
        <a href="/forgot-password" className="text-[var(--accent)]">forgot password</a> page.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    const { error: apiError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setLoading(false);
    if (apiError) {
      setError('This link has expired or was already used. Request a new one.');
      return;
    }
    router.push('/login?reset=success');
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <Input
        id="new-password"
        type="password"
        label="New password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
        autoComplete="new-password"
      />
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-bold text-[var(--ink)]">Choose a new password</h1>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
