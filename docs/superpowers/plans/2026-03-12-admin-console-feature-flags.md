# Admin Console & Feature Flags Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin console with feature flags (live events toggle), board management, global settings, and a polling fallback when realtime is disabled.

**Architecture:** Admin routes added to existing React Router in the same Vite SPA. Supabase Auth gates admin access via ProtectedRoute. Feature flags stored in DB, fetched at app startup, and consumed by boardStore to conditionally use realtime subscriptions or 10-second polling.

**Tech Stack:** React 19, TypeScript, Zustand, Supabase (Auth + PostgreSQL), Tailwind CSS 4, React Router 7.13, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-11-admin-console-feature-flags-design.md`

**Note:** No test framework is configured in this project. Steps omit TDD but include manual verification commands.

---

## Chunk 1: Database, Types & Stores (Foundation)

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/002_admin_console.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 002_admin_console.sql
-- Admin Console: admin_users, feature_flags, app_settings tables
-- Generated: 2026-03-12

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Admin users (references Supabase Auth)
CREATE TABLE admin_users (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id),
  email      TEXT        NOT NULL,
  role       TEXT        NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_users IS 'Admin console users linked to Supabase Auth accounts';

-- Feature flags
CREATE TABLE feature_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  is_enabled  BOOLEAN     NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE feature_flags IS 'Application feature flags toggled via admin console';

-- Auto-update updated_at on feature_flags
CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- App-wide settings (singleton enforced by CHECK constraint)
CREATE TABLE app_settings (
  id                     UUID    PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
                                 CHECK (id = '00000000-0000-0000-0000-000000000000'::uuid),
  default_template       TEXT        NOT NULL DEFAULT 'mad-sad-glad',
  default_board_settings JSONB       NOT NULL DEFAULT '{
    "card_visibility": "hidden",
    "voting_enabled": false,
    "max_votes_per_participant": 5,
    "secret_voting": false,
    "board_locked": false,
    "card_creation_disabled": false,
    "anonymous_cards": false
  }'::jsonb,
  app_name               TEXT        NOT NULL DEFAULT 'RetroBoard',
  app_logo_url           TEXT,
  board_retention_days   INTEGER,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app_settings IS 'Singleton row for global application settings';

-- Auto-update updated_at on app_settings
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

-- feature_flags: anyone can read, only admins can write
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags: public read"
  ON feature_flags FOR SELECT USING (true);
CREATE POLICY "feature_flags: admin write"
  ON feature_flags FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "feature_flags: admin update"
  ON feature_flags FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "feature_flags: admin delete"
  ON feature_flags FOR DELETE
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- app_settings: anyone can read, only admins can write
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings: public read"
  ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings: admin write"
  ON app_settings FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "app_settings: admin update"
  ON app_settings FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));

-- admin_users: only admins can read/write (bootstrap first user via service role)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users: admin read"
  ON admin_users FOR SELECT
  USING (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "admin_users: admin write"
  ON admin_users FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "admin_users: admin update"
  ON admin_users FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY "admin_users: admin delete"
  ON admin_users FOR DELETE
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- ============================================================================
-- 3. SEED DATA
-- ============================================================================

-- Initial feature flag: live_events (enabled by default for backwards compat)
INSERT INTO feature_flags (key, name, description, is_enabled) VALUES
  ('live_events', 'Live Events (Realtime)',
   'Supabase Realtime subscriptions for live card, vote, and participant sync. When disabled, falls back to 10-second polling.',
   true);

-- Initial app settings singleton row
INSERT INTO app_settings (default_template) VALUES ('mad-sad-glad');
```

- [ ] **Step 2: Verify migration file is valid SQL**

Run: `cat supabase/migrations/002_admin_console.sql | head -5`
Expected: File exists and starts with the comment header.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_admin_console.sql
git commit -m "feat: add admin_users, feature_flags, app_settings migration"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add new interfaces and update ConnectionStatus**

Add to the end of `src/types/index.ts`:

```typescript
// Admin types
export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  updated_at: string;
  created_at: string;
}

export interface AppSettings {
  id: string;
  default_template: BoardTemplate;
  default_board_settings: Partial<BoardSettings>;
  app_name: string;
  app_logo_url: string | null;
  board_retention_days: number | null;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'owner' | 'admin';
  created_at: string;
}
```

Update `ConnectionStatus` on line 21:

```typescript
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnected' | 'polling';
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing errors may be present).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add FeatureFlag, AppSettings, AdminUser types and polling status"
```

---

### Task 3: Feature Flag Store

**Files:**
- Create: `src/stores/featureFlagStore.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { FeatureFlag } from '@/types';

interface FeatureFlagState {
  flags: FeatureFlag[];
  loading: boolean;
  error: string | null;

  fetchFlags: () => Promise<void>;
  updateFlag: (id: string, is_enabled: boolean) => Promise<void>;
  isEnabled: (key: string) => boolean;
}

export const useFeatureFlagStore = create<FeatureFlagState>((set, get) => ({
  flags: [],
  loading: false,
  error: null,

  fetchFlags: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('created_at');

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    set({ flags: data as FeatureFlag[], loading: false });
  },

  updateFlag: async (id, is_enabled) => {
    // Optimistic update
    set((state) => ({
      flags: state.flags.map((f) =>
        f.id === id ? { ...f, is_enabled, updated_at: new Date().toISOString() } : f
      ),
    }));

    const { error } = await supabase
      .from('feature_flags')
      .update({ is_enabled })
      .eq('id', id);

    if (error) {
      // Revert on failure
      set((state) => ({
        flags: state.flags.map((f) =>
          f.id === id ? { ...f, is_enabled: !is_enabled } : f
        ),
      }));
      throw error;
    }
  },

  isEnabled: (key) => {
    const flag = get().flags.find((f) => f.key === key);
    return flag?.is_enabled ?? true; // Default to enabled if flag not found
  },
}));
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/stores/featureFlagStore.ts
git commit -m "feat: add featureFlagStore for feature flag management"
```

---

### Task 4: Auth Store

**Files:**
- Create: `src/stores/authStore.ts`

- [ ] **Step 1: Create the auth store**

```typescript
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { AdminUser } from '@/types';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  adminUser: AdminUser | null;
  loading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  adminUser: null,
  loading: true,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });

    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      set({ user: null, adminUser: null, loading: false });
      return;
    }

    // Verify user is in admin_users table
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error || !adminUser) {
      set({ user: null, adminUser: null, loading: false });
      return;
    }

    set({
      user: session.user,
      adminUser: adminUser as AdminUser,
      loading: false,
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      set({ loading: false, error: authError.message });
      return;
    }

    if (!data.user) {
      set({ loading: false, error: 'Sign in failed' });
      return;
    }

    // Verify admin access
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (adminError || !adminUser) {
      await supabase.auth.signOut();
      set({ loading: false, error: 'You do not have admin access' });
      return;
    }

    set({
      user: data.user,
      adminUser: adminUser as AdminUser,
      loading: false,
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, adminUser: null, loading: false, error: null });
  },
}));
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/stores/authStore.ts
git commit -m "feat: add authStore for admin authentication"
```

---

### Task 5: App Settings Store

**Files:**
- Create: `src/stores/appSettingsStore.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { AppSettings } from '@/types';

interface AppSettingsState {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Omit<AppSettings, 'id' | 'updated_at'>>) => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: null,
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .single();

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    set({ settings: data as AppSettings, loading: false });
  },

  updateSettings: async (updates) => {
    const prev = get().settings;
    if (!prev) return;

    // Optimistic update
    const updated = { ...prev, ...updates, updated_at: new Date().toISOString() };
    set({ settings: updated });

    const { error } = await supabase
      .from('app_settings')
      .update(updates)
      .eq('id', prev.id);

    if (error) {
      set({ settings: prev });
      throw error;
    }
  },
}));
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/stores/appSettingsStore.ts
git commit -m "feat: add appSettingsStore for global settings"
```

---

## Chunk 2: Admin Auth & Layout

### Task 6: ProtectedRoute Component

**Files:**
- Create: `src/components/Admin/ProtectedRoute.tsx`

- [ ] **Step 1: Create the component**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Admin/ProtectedRoute.tsx
git commit -m "feat: add ProtectedRoute for admin auth guard"
```

---

### Task 7: AdminShell & AdminSidebar

**Files:**
- Create: `src/components/Admin/AdminSidebar.tsx`
- Create: `src/components/Admin/AdminShell.tsx`

- [ ] **Step 1: Create AdminSidebar**

```typescript
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Flag, Kanban, Settings, ArrowLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { href: '/admin/features', label: 'Feature Flags', icon: Flag },
  { href: '/admin/boards', label: 'Boards', icon: Kanban },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar() {
  const { adminUser, signOut } = useAuthStore();

  return (
    <aside className="flex h-screen w-60 flex-col bg-[var(--color-gray-8)] text-[var(--color-gray-3)]">
      <div className="border-b border-[var(--color-gray-7)] px-4 py-4">
        <h2 className="text-sm font-semibold text-white">RetroBoard Admin</h2>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'border-l-3 border-[var(--color-primary)] bg-white/5 text-white'
                  : 'border-l-3 border-transparent hover:bg-white/5 hover:text-white'
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--color-gray-7)] p-4">
        <div className="mb-3 text-xs text-[var(--color-gray-4)]">
          {adminUser?.email}
        </div>
        <div className="flex flex-col gap-1">
          <NavLink
            to="/"
            className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-xs text-[var(--color-gray-4)] hover:bg-white/5 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to App
          </NavLink>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-xs text-[var(--color-gray-4)] hover:bg-white/5 hover:text-white transition-colors text-left"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create AdminShell**

```typescript
import type { ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--color-warm-white)]">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create barrel export**

Create `src/components/Admin/index.ts`:

```typescript
export { AdminShell } from './AdminShell';
export { AdminSidebar } from './AdminSidebar';
export { ProtectedRoute } from './ProtectedRoute';
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Admin/
git commit -m "feat: add AdminShell, AdminSidebar, and barrel exports"
```

---

### Task 8: Admin Login Page

**Files:**
- Create: `src/pages/admin/AdminLoginPage.tsx`

- [ ] **Step 1: Create the login page**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/AdminLoginPage.tsx
git commit -m "feat: add AdminLoginPage with Supabase Auth"
```

---

### Task 9: Admin Routes in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add lazy-loaded admin routes**

Replace the entire content of `src/App.tsx`:

```typescript
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
```

- [ ] **Step 2: Create AdminLayout wrapper**

Create `src/components/Admin/AdminLayout.tsx`:

```typescript
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
```

- [ ] **Step 3: Update Admin barrel export**

Add to `src/components/Admin/index.ts`:

```typescript
export { AdminLayout } from './AdminLayout';
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Note: Admin page files don't exist yet — expect import errors. Those are resolved in Chunk 3.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/Admin/AdminLayout.tsx src/components/Admin/index.ts
git commit -m "feat: add lazy-loaded admin routes with nested layout"
```

---

## Chunk 3: Admin Pages

### Task 10: Admin Dashboard Page

**Files:**
- Create: `src/pages/admin/AdminDashboardPage.tsx`

- [ ] **Step 1: Create the dashboard page**

```typescript
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Kanban, Flag, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DashboardStats {
  activeBoards: number;
  completedBoards: number;
  totalFlags: number;
}

interface RecentBoard {
  id: string;
  title: string;
  created_at: string;
  archived_at: string | null;
  participantCount: number;
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ activeBoards: 0, completedBoards: 0, totalFlags: 0 });
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const [activeRes, completedRes, flagsRes, boardsRes] = await Promise.all([
        supabase.from('boards').select('id', { count: 'exact', head: true }).is('archived_at', null),
        supabase.from('boards').select('id', { count: 'exact', head: true }).not('archived_at', 'is', null),
        supabase.from('feature_flags').select('id', { count: 'exact', head: true }),
        supabase.from('boards').select('id, title, created_at, archived_at').order('created_at', { ascending: false }).limit(5),
      ]);

      setStats({
        activeBoards: activeRes.count ?? 0,
        completedBoards: completedRes.count ?? 0,
        totalFlags: flagsRes.count ?? 0,
      });

      if (boardsRes.data) {
        // Fetch participant counts for recent boards
        const boardIds = boardsRes.data.map((b) => b.id);
        const { data: participants } = await supabase
          .from('participants')
          .select('board_id')
          .in('board_id', boardIds);

        const countMap = new Map<string, number>();
        participants?.forEach((p) => {
          countMap.set(p.board_id, (countMap.get(p.board_id) ?? 0) + 1);
        });

        setRecentBoards(
          boardsRes.data.map((b) => ({
            ...b,
            participantCount: countMap.get(b.id) ?? 0,
          }))
        );
      }

      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading) {
    return <div className="text-sm text-[var(--color-gray-5)]">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--color-gray-8)]">Dashboard</h1>
      <p className="mt-1 text-sm text-[var(--color-gray-5)]">Overview of your RetroBoard instance</p>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Kanban} label="Active Boards" value={stats.activeBoards} />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completedBoards} />
        <StatCard icon={Flag} label="Feature Flags" value={stats.totalFlags} />
      </div>

      {/* Recent boards */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-gray-7)]">Recent Boards</h2>
          <Link to="/admin/boards" className="text-xs text-[var(--color-primary)] hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] overflow-hidden">
          {recentBoards.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-gray-4)]">No boards yet</div>
          ) : (
            recentBoards.map((board) => (
              <div key={board.id} className="flex items-center justify-between border-b border-[var(--color-gray-1)] px-4 py-3 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-[var(--color-gray-8)]">{board.title}</p>
                  <p className="text-xs text-[var(--color-gray-4)]">
                    {board.participantCount} participant{board.participantCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  board.archived_at
                    ? 'bg-[var(--color-info)]/10 text-[var(--color-info)]'
                    : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                }`}>
                  {board.archived_at ? 'Completed' : 'Active'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 text-[var(--color-gray-4)]">
        <Icon size={16} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--color-gray-8)]">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/AdminDashboardPage.tsx
git commit -m "feat: add AdminDashboardPage with stats and recent boards"
```

---

### Task 11: Feature Flags Page

**Files:**
- Create: `src/components/Admin/FeatureFlagCard.tsx`
- Create: `src/pages/admin/AdminFeaturesPage.tsx`

- [ ] **Step 1: Create FeatureFlagCard**

```typescript
import { Info } from 'lucide-react';
import type { FeatureFlag } from '@/types';

interface FeatureFlagCardProps {
  flag: FeatureFlag;
  onToggle: (id: string, enabled: boolean) => void;
}

export function FeatureFlagCard({ flag, onToggle }: FeatureFlagCardProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-gray-8)]">{flag.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              flag.is_enabled
                ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
            }`}>
              {flag.is_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {flag.description && (
            <p className="mt-1 text-sm text-[var(--color-gray-5)]">{flag.description}</p>
          )}
          <div className="mt-3 flex gap-4 text-xs text-[var(--color-gray-4)]">
            <span>
              Key: <code className="rounded bg-[var(--color-gray-1)] px-1 py-0.5 text-xs">{flag.key}</code>
            </span>
            <span>
              Last toggled: {new Date(flag.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <button
          onClick={() => onToggle(flag.id, !flag.is_enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            flag.is_enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-gray-3)]'
          }`}
          role="switch"
          aria-checked={flag.is_enabled}
          aria-label={`Toggle ${flag.name}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              flag.is_enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AdminFeaturesPage**

```typescript
import { useEffect } from 'react';
import { Info } from 'lucide-react';
import { useFeatureFlagStore } from '@/stores/featureFlagStore';
import { FeatureFlagCard } from '@/components/Admin/FeatureFlagCard';

export function AdminFeaturesPage() {
  const { flags, loading, fetchFlags, updateFlag } = useFeatureFlagStore();

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await updateFlag(id, enabled);
    } catch (err) {
      console.error('Failed to update flag:', err);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--color-gray-8)]">Feature Flags</h1>
      <p className="mt-1 text-sm text-[var(--color-gray-5)]">Toggle features on or off for your application</p>

      {loading ? (
        <div className="mt-6 text-sm text-[var(--color-gray-5)]">Loading flags...</div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {flags.map((flag) => (
            <FeatureFlagCard key={flag.id} flag={flag} onToggle={handleToggle} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-info)]/10 px-4 py-3 text-sm text-[var(--color-info)]">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>Feature flags take effect immediately for new board sessions. Active boards will pick up changes on their next polling cycle or page refresh.</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update Admin barrel export**

Add `FeatureFlagCard` export to `src/components/Admin/index.ts`:

```typescript
export { FeatureFlagCard } from './FeatureFlagCard';
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Admin/FeatureFlagCard.tsx src/pages/admin/AdminFeaturesPage.tsx src/components/Admin/index.ts
git commit -m "feat: add feature flags admin page with toggle cards"
```

---

### Task 12: Boards Management Page

**Files:**
- Create: `src/pages/admin/AdminBoardsPage.tsx`

- [ ] **Step 1: Create the boards page**

```typescript
import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Archive, Trash2, Download, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Modal } from '@/components/common';
import { exportMarkdown, exportCsv } from '@/utils/export';
import type { Board } from '@/types';

type BoardFilter = 'all' | 'active' | 'completed';

interface BoardRow extends Board {
  participant_count: number;
  card_count: number;
}

const PAGE_SIZE = 10;

export function AdminBoardsPage() {
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState({ all: 0, active: 0, completed: 0 });
  const [deleteTarget, setDeleteTarget] = useState<BoardRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBoards = useCallback(async () => {
    setLoading(true);

    // Get counts for filter tabs
    const [allRes, activeRes, completedRes] = await Promise.all([
      supabase.from('boards').select('id', { count: 'exact', head: true }),
      supabase.from('boards').select('id', { count: 'exact', head: true }).is('archived_at', null),
      supabase.from('boards').select('id', { count: 'exact', head: true }).not('archived_at', 'is', null),
    ]);
    setCounts({
      all: allRes.count ?? 0,
      active: activeRes.count ?? 0,
      completed: completedRes.count ?? 0,
    });

    // Build main query
    let query = supabase
      .from('boards')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filter === 'active') query = query.is('archived_at', null);
    if (filter === 'completed') query = query.not('archived_at', 'is', null);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, count } = await query;
    setTotalCount(count ?? 0);

    if (data) {
      const boardIds = data.map((b) => b.id);

      const [participantsRes, cardsRes] = await Promise.all([
        supabase.from('participants').select('board_id').in('board_id', boardIds),
        supabase.from('cards').select('board_id').in('board_id', boardIds),
      ]);

      const pCounts = new Map<string, number>();
      participantsRes.data?.forEach((p) => pCounts.set(p.board_id, (pCounts.get(p.board_id) ?? 0) + 1));

      const cCounts = new Map<string, number>();
      cardsRes.data?.forEach((c) => cCounts.set(c.board_id, (cCounts.get(c.board_id) ?? 0) + 1));

      setBoards(
        data.map((b) => ({
          ...(b as Board),
          participant_count: pCounts.get(b.id) ?? 0,
          card_count: cCounts.get(b.id) ?? 0,
        }))
      );
    }

    setLoading(false);
  }, [filter, search, page]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  // Reset to page 0 when filter/search changes
  useEffect(() => {
    setPage(0);
  }, [filter, search]);

  const handleArchive = async (boardId: string) => {
    // Fetch current settings first to avoid overwriting the entire JSONB column
    const { data: board } = await supabase
      .from('boards')
      .select('settings')
      .eq('id', boardId)
      .single();

    const mergedSettings = { ...(board?.settings ?? {}), board_locked: true };

    await supabase
      .from('boards')
      .update({ archived_at: new Date().toISOString(), settings: mergedSettings })
      .eq('id', boardId);
    fetchBoards();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('boards').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    setDeleting(false);
    fetchBoards();
  };

  const handleExport = async (boardId: string, format: 'markdown' | 'csv') => {
    const [boardRes, colsRes, cardsRes, votesRes, actionsRes] = await Promise.all([
      supabase.from('boards').select('*').eq('id', boardId).single(),
      supabase.from('columns').select('*').eq('board_id', boardId).order('position'),
      supabase.from('cards').select('*').eq('board_id', boardId).order('position'),
      supabase.from('votes').select('*').eq('board_id', boardId),
      supabase.from('action_items').select('*').eq('board_id', boardId).order('created_at'),
    ]);

    if (!boardRes.data) return;

    const exportData = {
      boardTitle: boardRes.data.title,
      boardDescription: boardRes.data.description,
      columns: colsRes.data ?? [],
      cards: cardsRes.data ?? [],
      votes: votesRes.data ?? [],
      actionItems: actionsRes.data ?? [],
    };

    if (format === 'markdown') exportMarkdown(exportData);
    else exportCsv(exportData);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const filterTabs: { key: BoardFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--color-gray-8)]">Boards</h1>
      <p className="mt-1 text-sm text-[var(--color-gray-5)]">View and manage all retrospective boards</p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-[var(--color-gray-8)] text-white'
                : 'bg-[var(--color-surface)] border border-[var(--color-gray-2)] text-[var(--color-gray-6)] hover:border-[var(--color-gray-3)]'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-gray-4)]" />
          <input
            type="text"
            placeholder="Search boards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-sm text-[var(--color-gray-8)] placeholder:text-[var(--color-gray-4)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)]">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_80px_80px_100px_120px] gap-2 border-b border-[var(--color-gray-1)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-gray-5)]">
          <div>Board</div>
          <div>Template</div>
          <div>Users</div>
          <div>Cards</div>
          <div>Created</div>
          <div></div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-gray-5)]">Loading...</div>
        ) : boards.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-gray-4)]">No boards found</div>
        ) : (
          boards.map((board) => (
            <div key={board.id} className="grid grid-cols-[2fr_1fr_80px_80px_100px_120px] items-center gap-2 border-b border-[var(--color-gray-1)] px-4 py-3 text-sm last:border-b-0">
              <div>
                <p className="font-medium text-[var(--color-gray-8)]">{board.title}</p>
                <p className="text-xs text-[var(--color-gray-4)]">ID: {board.id}</p>
              </div>
              <div className="text-[var(--color-gray-5)] text-xs">{board.template}</div>
              <div className="text-[var(--color-gray-5)]">{board.participant_count}</div>
              <div className="text-[var(--color-gray-5)]">{board.card_count}</div>
              <div className="text-xs text-[var(--color-gray-5)]">
                {new Date(board.created_at).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={`/board/${board.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)]"
                  title="View board"
                >
                  <ExternalLink size={14} />
                </a>
                {!board.archived_at && (
                  <button
                    onClick={() => handleArchive(board.id)}
                    className="rounded p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)]"
                    title="Archive board"
                  >
                    <Archive size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleExport(board.id, 'markdown')}
                  className="rounded p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-gray-1)] hover:text-[var(--color-gray-6)]"
                  title="Export markdown"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(board)}
                  className="rounded p-1 text-[var(--color-gray-4)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                  title="Delete board"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-[var(--color-gray-5)]">
          <span>Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-1 text-xs disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-[var(--radius-md)] border border-[var(--color-gray-2)] px-3 py-1 text-xs disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Board"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-gray-5)]">
            Permanently delete <strong className="text-[var(--color-gray-8)]">{deleteTarget?.title}</strong> and all its data? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button onClick={handleDelete} loading={deleting}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/AdminBoardsPage.tsx
git commit -m "feat: add AdminBoardsPage with filters, search, pagination, and actions"
```

---

### Task 13: Admin Settings Page

**Files:**
- Create: `src/pages/admin/AdminSettingsPage.tsx`

- [ ] **Step 1: Create the settings page**

```typescript
import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { Button } from '@/components/common';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import { BOARD_TEMPLATES } from '@/utils/templates';
import type { BoardTemplate } from '@/types';

export function AdminSettingsPage() {
  const { settings, loading, fetchSettings, updateSettings } = useAppSettingsStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local form state
  const [appName, setAppName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [defaultTemplate, setDefaultTemplate] = useState<BoardTemplate>('mad-sad-glad');
  const [cardVisibility, setCardVisibility] = useState<'hidden' | 'visible'>('hidden');
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [maxVotes, setMaxVotes] = useState(5);
  const [secretVoting, setSecretVoting] = useState(false);
  const [retentionEnabled, setRetentionEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Sync form state when settings load
  useEffect(() => {
    if (!settings) return;
    setAppName(settings.app_name);
    setLogoUrl(settings.app_logo_url ?? '');
    setDefaultTemplate(settings.default_template);

    const bs = settings.default_board_settings;
    if (bs.card_visibility) setCardVisibility(bs.card_visibility);
    if (bs.voting_enabled !== undefined) setVotingEnabled(bs.voting_enabled);
    if (bs.max_votes_per_participant !== undefined) setMaxVotes(bs.max_votes_per_participant);
    if (bs.secret_voting !== undefined) setSecretVoting(bs.secret_voting);

    setRetentionEnabled(settings.board_retention_days !== null);
    setRetentionDays(settings.board_retention_days ?? 90);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        app_name: appName,
        app_logo_url: logoUrl || null,
        default_template: defaultTemplate,
        default_board_settings: {
          card_visibility: cardVisibility,
          voting_enabled: votingEnabled,
          max_votes_per_participant: maxVotes,
          secret_voting: secretVoting,
          board_locked: false,
          card_creation_disabled: false,
          anonymous_cards: false,
        },
        board_retention_days: retentionEnabled ? retentionDays : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[var(--color-gray-5)]">Loading settings...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-gray-8)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--color-gray-5)]">Configure application-wide defaults and branding</p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save size={16} />
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {/* Branding */}
        <Section title="Branding" subtitle="Customize the look and name of your instance">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-gray-7)]">Application Name</label>
              <input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-gray-8)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-gray-7)]">
                Logo URL <span className="font-normal text-[var(--color-gray-4)]">(optional)</span>
              </label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.svg"
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-gray-8)] placeholder:text-[var(--color-gray-4)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
          </div>
        </Section>

        {/* Default Template */}
        <Section title="Default Board Template" subtitle="Pre-selected template when users create a new board">
          <div className="flex flex-wrap gap-2">
            {BOARD_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setDefaultTemplate(t.id)}
                className={`rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors ${
                  defaultTemplate === t.id
                    ? 'bg-[var(--color-info)]/10 border-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border border-[var(--color-gray-2)] text-[var(--color-gray-6)] hover:border-[var(--color-gray-3)]'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Section>

        {/* Default Board Settings */}
        <Section title="Default Board Settings" subtitle="Applied to every new board unless the facilitator changes them">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingRow label="Card Visibility" description="Start cards hidden or visible">
              <div className="flex rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-gray-1)] p-0.5">
                {(['hidden', 'visible'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setCardVisibility(v)}
                    className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      cardVisibility === v
                        ? 'bg-[var(--color-gray-8)] text-white'
                        : 'text-[var(--color-gray-5)]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow label="Voting Enabled" description="Allow participants to vote on cards">
              <Toggle checked={votingEnabled} onChange={setVotingEnabled} />
            </SettingRow>

            <SettingRow label="Max Votes per Participant" description="Limit how many votes each person gets">
              <input
                type="number"
                min={1}
                max={99}
                value={maxVotes}
                onChange={(e) => setMaxVotes(Number(e.target.value))}
                className="w-16 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-2 py-1 text-center text-sm text-[var(--color-gray-8)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </SettingRow>

            <SettingRow label="Secret Voting" description="Hide vote counts until revealed">
              <Toggle checked={secretVoting} onChange={setSecretVoting} />
            </SettingRow>
          </div>
        </Section>

        {/* Board Retention */}
        <Section title="Board Retention" subtitle="Automatically clean up old boards to save storage">
          <div className="flex items-center gap-3">
            <Toggle checked={retentionEnabled} onChange={setRetentionEnabled} />
            <span className="text-sm text-[var(--color-gray-6)]">Auto-delete completed boards after</span>
            <input
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              disabled={!retentionEnabled}
              className="w-16 rounded-[var(--radius-md)] border border-[var(--color-gray-2)] bg-[var(--color-surface)] px-2 py-1 text-center text-sm text-[var(--color-gray-8)] disabled:opacity-40 focus:border-[var(--color-primary)] focus:outline-none"
            />
            <span className="text-sm text-[var(--color-gray-6)]">days</span>
          </div>
          <p className="mt-2 text-xs text-[var(--color-gray-4)]">
            When disabled, boards are kept indefinitely. Only completed boards are affected.
          </p>
          <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]" style={{ color: '#92700c' }}>
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Auto-deletion is not yet active. This setting will be used when the scheduled cleanup job is implemented.</span>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-5">
      <h2 className="text-base font-semibold text-[var(--color-gray-8)]">{title}</h2>
      <p className="mt-0.5 text-sm text-[var(--color-gray-5)]">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--color-gray-1)] py-3 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-[var(--color-gray-7)]">{label}</p>
        <p className="text-xs text-[var(--color-gray-4)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-gray-3)]'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/AdminSettingsPage.tsx
git commit -m "feat: add AdminSettingsPage with branding, template, defaults, and retention"
```

---

### Task 14: Verify Admin Console Compiles

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new type errors from admin code.

- [ ] **Step 2: Run dev server**

Run: `npm run dev`
Navigate to `http://localhost:5173/admin/login` and verify the login page renders.

- [ ] **Step 3: Commit any fixes if needed**

---

## Chunk 4: Polling Fallback & Board Integration

### Task 15: usePolling Hook

**Files:**
- Create: `src/hooks/usePolling.ts`

- [ ] **Step 1: Create the polling hook**

```typescript
import { useEffect, useRef } from 'react';
import { useBoardStore } from '@/stores/boardStore';

export function usePolling(boardId: string | undefined, intervalMs: number, enabled: boolean) {
  const fetchBoard = useBoardStore((s) => s.fetchBoard);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!boardId || !enabled) return;

    // Start polling
    intervalRef.current = setInterval(() => {
      fetchBoard(boardId);
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [boardId, intervalMs, enabled, fetchBoard]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePolling.ts
git commit -m "feat: add usePolling hook for realtime fallback"
```

---

### Task 16: Update usePresence with liveSync Parameter

**Files:**
- Modify: `src/hooks/usePresence.ts`

- [ ] **Step 1: Add liveSync parameter with early return**

Replace the entire file:

```typescript
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useBoardStore } from '@/stores/boardStore';

interface PresenceState {
  participant_id: string;
  display_name: string;
  is_admin: boolean;
  online_at: string;
}

export function usePresence(boardId: string | undefined, participantId: string | null, liveSync = true) {
  const setOnlineParticipantIds = useBoardStore((s) => s.setOnlineParticipantIds);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!boardId || !participantId || !liveSync) return;

    const participant = useBoardStore.getState().participants.find((p) => p.id === participantId);
    if (!participant) return;

    const channel = supabase.channel(`presence:${boardId}`, {
      config: { presence: { key: participantId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const ids = Object.keys(state);
        setOnlineParticipantIds(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            participant_id: participantId,
            display_name: participant.display_name,
            is_admin: participant.is_admin,
            online_at: new Date().toISOString(),
          } satisfies PresenceState);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, participantId, liveSync, setOnlineParticipantIds]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePresence.ts
git commit -m "feat: add liveSync parameter to usePresence hook"
```

---

### Task 17: Update useTimer with liveSync Parameter

**Files:**
- Modify: `src/hooks/useTimer.ts`

- [ ] **Step 1: Add liveSync parameter**

The key change: when `liveSync` is false, skip the broadcast channel subscription entirely. Timer still works locally (start/pause/resume/reset) but doesn't sync.

Replace the `UseTimerOptions` interface and the broadcast effect (lines 8-179):

At line 8, change the interface:

```typescript
interface UseTimerOptions {
  boardId: string;
  liveSync?: boolean;
}
```

At line 12, update the destructuring:

```typescript
export function useTimer({ boardId, liveSync = true }: UseTimerOptions) {
```

Replace the `broadcastEvent` callback (lines 49-55) to be conditional:

```typescript
  const broadcastEvent = useCallback((event: string, payload: Partial<TimerState>) => {
    if (!liveSync) return;
    channelRef.current?.send({
      type: 'broadcast',
      event,
      payload,
    });
  }, [liveSync]);
```

Wrap the broadcast subscription effect (lines 93-179) with a liveSync guard. Replace:

```typescript
  // Subscribe to broadcast channel -- stable deps only (no timer state)
  useEffect(() => {
    const channel = supabase.channel(`timer:${boardId}`);
```

With:

```typescript
  // Subscribe to broadcast channel -- stable deps only (no timer state)
  useEffect(() => {
    if (!liveSync) return;

    const channel = supabase.channel(`timer:${boardId}`);
```

And update the effect's dependency array from `[boardId, broadcastEvent]` to `[boardId, liveSync, broadcastEvent]`.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTimer.ts
git commit -m "feat: add liveSync parameter to useTimer hook"
```

---

### Task 18: Update ConnectionStatusBanner

**Files:**
- Modify: `src/components/Board/ConnectionStatusBanner.tsx`

- [ ] **Step 1: Add polling mode variant**

Replace the entire file:

```typescript
import { Wifi, WifiOff, RefreshCw, Radio } from 'lucide-react';
import { useBoardStore } from '@/stores/boardStore';

export function ConnectionStatusBanner() {
  const connectionStatus = useBoardStore((s) => s.connectionStatus);

  if (connectionStatus === 'connected') return null;

  if (connectionStatus === 'polling') {
    return (
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-info)]/10 px-4 py-2 text-sm font-medium text-[var(--color-info)]">
          <Radio size={16} />
          <span>Polling mode — updates every 10 seconds</span>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning)]/15 px-4 py-2 text-sm font-medium text-[var(--color-warning)]" style={{ color: '#92700c' }}>
          <WifiOff size={16} />
          <span>Connection lost — reconnecting</span>
          <RefreshCw size={14} className="animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success)]/15 px-4 py-2 text-sm font-medium text-[var(--color-success)]">
        <Wifi size={16} />
        <span>Reconnected — board data refreshed</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Board/ConnectionStatusBanner.tsx
git commit -m "feat: add polling mode variant to ConnectionStatusBanner"
```

---

### Task 19: Update BoardPage to Use Feature Flags

**Files:**
- Modify: `src/pages/BoardPage.tsx`

- [ ] **Step 1: Add feature flag imports and polling logic**

Add imports at the top of `src/pages/BoardPage.tsx` (after existing imports):

```typescript
import { useFeatureFlagStore } from '@/stores/featureFlagStore';
import { usePolling } from '@/hooks/usePolling';
```

After the existing `usePresence(boardId, currentParticipantId);` call (line 102), the hooks section should become:

```typescript
  const liveEventsEnabled = useFeatureFlagStore((s) => s.isEnabled('live_events'));

  const { timer, start: timerStart, pause: timerPause, resume: timerResume, reset: timerReset } = useTimer({
    boardId: boardId || '',
    liveSync: liveEventsEnabled,
  });

  usePresence(boardId, currentParticipantId, liveEventsEnabled);
  usePolling(boardId, 10_000, !liveEventsEnabled && !!currentParticipantId);
```

Update the realtime subscription effect (lines 121-126) to be conditional:

```typescript
  // Subscribe to realtime changes (only when live events enabled)
  useEffect(() => {
    if (boardId && currentParticipantId && liveEventsEnabled) {
      const unsubscribe = subscribeToBoard(boardId);
      return unsubscribe;
    } else if (boardId && currentParticipantId && !liveEventsEnabled) {
      // Set polling status
      useBoardStore.setState({ connectionStatus: 'polling' });
    }
  }, [boardId, currentParticipantId, liveEventsEnabled, subscribeToBoard]);
```

Remove the old `useTimer` and `usePresence` calls (lines 98-102) since they're replaced above.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/pages/BoardPage.tsx
git commit -m "feat: integrate feature flags with board page for conditional realtime/polling"
```

---

### Task 20: Fetch Feature Flags on App Startup

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add flag fetching on mount**

Add to the top of `src/App.tsx`, after imports:

```typescript
import { useEffect } from 'react';
import { useFeatureFlagStore } from '@/stores/featureFlagStore';
```

Inside the `App` component, before the return:

```typescript
  const fetchFlags = useFeatureFlagStore((s) => s.fetchFlags);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: fetch feature flags on app startup"
```

---

### Task 21: Integrate App Settings with Board Creation

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Read app_settings for default template**

Add import at top of `src/pages/HomePage.tsx`:

```typescript
import { useAppSettingsStore } from '@/stores/appSettingsStore';
```

Inside `HomePage`, after existing state:

```typescript
  const appSettings = useAppSettingsStore((s) => s.settings);
  const fetchAppSettings = useAppSettingsStore((s) => s.fetchSettings);

  useEffect(() => {
    fetchAppSettings();
  }, [fetchAppSettings]);
```

Change the `selectedTemplate` initial state from hardcoded to:

```typescript
  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate>(
    appSettings?.default_template ?? 'mad-sad-glad'
  );
```

Add an effect to sync when settings load:

```typescript
  useEffect(() => {
    if (appSettings?.default_template) {
      setSelectedTemplate(appSettings.default_template);
    }
  }, [appSettings]);
```

- [ ] **Step 2: Update boardStore.createBoard to merge app_settings defaults**

In `src/stores/boardStore.ts`, update the `createBoard` method. Change line 91:

```typescript
      settings: DEFAULT_BOARD_SETTINGS,
```

To:

```typescript
      settings: {
        ...DEFAULT_BOARD_SETTINGS,
        ...(useAppSettingsStore?.getState?.()?.settings?.default_board_settings ?? {}),
      },
```

Add import at top of `boardStore.ts`:

```typescript
import { useAppSettingsStore } from '@/stores/appSettingsStore';
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx src/stores/boardStore.ts
git commit -m "feat: integrate app_settings with board creation defaults"
```

---

### Task 22: Final Build Verification

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: Clean or only pre-existing warnings.

- [ ] **Step 2: Run lint**

Run: `npm run lint 2>&1 | tail -20`
Expected: No new errors from admin code.

- [ ] **Step 3: Run production build**

Run: `npm run build 2>&1 | tail -20`
Expected: Builds successfully. Admin pages should be in separate chunks due to lazy loading.

- [ ] **Step 4: Manual smoke test**

1. Start dev server: `npm run dev`
2. Navigate to `/admin/login` — verify login page renders
3. Navigate to `/` — verify homepage still works
4. Create a board — verify it works normally (realtime still enabled by default)

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "fix: resolve build issues from admin console integration"
```

---

## Post-Implementation Setup

After the code is deployed, these manual steps are needed:

1. **Enable Supabase Auth** in the Supabase Dashboard → Authentication → Providers → Enable Email
2. **Run migration** `002_admin_console.sql` in Supabase Dashboard → SQL Editor
3. **Create admin user** in Supabase Dashboard → Authentication → Create User (email/password)
4. **Link admin user** in SQL Editor:
   ```sql
   INSERT INTO admin_users (id, email, role) VALUES
     ('<auth-user-uuid>', 'your-email@example.com', 'owner');
   ```
5. **Sign in** at `/admin/login` with the created credentials
