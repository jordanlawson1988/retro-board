import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminShell } from './AdminShell';

export function AdminLayout() {
  return (
    <ProtectedRoute>
      <AdminShell>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-gray-2)] border-t-[var(--color-navy)]" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </AdminShell>
    </ProtectedRoute>
  );
}
