import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, adminUser, loading, initialize } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-warm-white)]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-gray-2)] border-t-[var(--color-navy)]" />
          <p className="mt-4 text-sm text-[var(--color-gray-5)]">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user || !adminUser) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
