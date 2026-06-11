'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Always show success — never reveal whether an email has an account.
    await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    }).catch(() => {});
    setSent(true);
    setLoading(false);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-bold text-[var(--ink)]">Reset your password</h1>
      {sent ? (
        <p className="mt-4 text-sm leading-6 text-[var(--ink-2)]">
          If an account exists for <strong>{email}</strong>, a reset link is on its way.
          Check your inbox (and spam) — the link expires in 1 hour.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Input
            id="email"
            type="email"
            label="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 text-sm text-[var(--accent)]">
        Back to sign in
      </Link>
    </main>
  );
}
