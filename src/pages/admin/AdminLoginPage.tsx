import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button, Input } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';

export function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, error } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setSubmitting(true);
    await signIn(email.trim(), password.trim());
    setSubmitting(false);

    // signIn doesn't throw on failure — it sets error in the store.
    // Only navigate if we successfully authenticated as an admin.
    const { adminUser } = useAuthStore.getState();
    if (adminUser) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-warm-white)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-gray-1)]">
            <Lock size={24} className="text-[var(--color-gray-6)]" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[var(--color-gray-8)]">Admin Console</h1>
          <p className="mt-1 text-sm text-[var(--color-gray-5)]">Sign in to manage RetroBoard</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-6">
          {error && (
            <div className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <Input
              id="admin-email"
              label="Email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <Input
              id="admin-password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" loading={submitting} disabled={!email.trim() || !password.trim()}>
              Sign In
            </Button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-[var(--color-primary)] hover:underline">
            ← Back to RetroBoard
          </Link>
        </div>
      </div>
    </div>
  );
}
