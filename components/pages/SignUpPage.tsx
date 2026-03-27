'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-gray-0)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-[var(--color-navy)]">Create Account</h1>
        <p className="text-sm text-[var(--color-gray-5)]">
          Sign up to save your retros and manage your boards.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded border px-3 py-2"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 characters)"
          className="w-full rounded border px-3 py-2"
          minLength={8}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[var(--color-navy)] px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
        <p className="text-center text-sm text-[var(--color-gray-5)]">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--color-navy)] hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
