import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage, BoardPage, NotFoundPage } from '@/pages';

// Lazy-load admin pages to avoid bloating the main bundle
const AdminLoginPage = lazy(() =>
  import('@/pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage }))
);
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminFeaturesPage = lazy(() =>
  import('@/pages/admin/AdminFeaturesPage').then((m) => ({ default: m.AdminFeaturesPage }))
);
const AdminBoardsPage = lazy(() =>
  import('@/pages/admin/AdminBoardsPage').then((m) => ({ default: m.AdminBoardsPage }))
);
const AdminSettingsPage = lazy(() =>
  import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage }))
);
const AdminLayout = lazy(() =>
  import('@/components/Admin/AdminLayout').then((m) => ({ default: m.AdminLayout }))
);

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-gray-2)] border-t-[var(--color-navy)]" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/board/:boardId" element={<BoardPage />} />

        {/* Admin routes */}
        <Route
          path="/admin/login"
          element={
            <Suspense fallback={<AdminFallback />}>
              <AdminLoginPage />
            </Suspense>
          }
        />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<AdminFallback />}>
              <AdminLayout />
            </Suspense>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="features" element={<AdminFeaturesPage />} />
          <Route path="boards" element={<AdminBoardsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
