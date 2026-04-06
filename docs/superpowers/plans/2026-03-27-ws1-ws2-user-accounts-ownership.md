# WS1-WS2: User Accounts & Board Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated user accounts for board creators while keeping anonymous participant joining. Establish board ownership and access control so users see only their boards.

**Architecture:** Better Auth email/password (already configured) becomes the general auth system, not just admin. Boards gain an `owner_id` FK to the Better Auth `user` table. A new `board_members` table tracks who has access to which boards. Participants optionally link to user accounts.

**Tech Stack:** Better Auth 1.5.5, Neon serverless Postgres, Zustand 5, Next.js 16 App Router

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `scripts/migrations/002_user_accounts.sql` | Add owner_id to boards, user_id to participants |
| `scripts/migrations/003_board_access.sql` | board_members and board_invites tables |
| `app/signup/page.tsx` | Sign-up page (server component wrapper) |
| `components/pages/SignUpPage.tsx` | Sign-up form client component |
| `app/dashboard/page.tsx` | Dashboard page (server component wrapper) |
| `components/pages/DashboardPage.tsx` | "My Boards" dashboard client component |
| `components/Dashboard/BoardCard.tsx` | Board card for dashboard grid |
| `components/Dashboard/index.ts` | Barrel export |
| `stores/userStore.ts` | General user state (replaces admin-only authStore usage for non-admin users) |
| `app/api/user/boards/route.ts` | Fetch boards owned by or shared with authenticated user |
| `app/api/boards/[boardId]/members/route.ts` | Board member CRUD |
| `lib/auth-helpers.ts` | Shared auth utilities (getSessionOrNull, requireSession) |

### Modified Files
| File | Changes |
|------|---------|
| `lib/auth.ts` | No changes needed — email/password already enabled |
| `lib/auth-client.ts` | No changes needed — client already configured |
| `middleware.ts` | Expand protected routes to include `/dashboard`, `/settings` |
| `stores/authStore.ts` | Add non-admin user support (remove admin-only enforcement) |
| `stores/boardStore.ts` | Pass owner_id on board creation when authenticated |
| `components/Layout/Header.tsx` | Add Sign In / user avatar dropdown |
| `components/pages/HomePage.tsx` | Add auth-aware board creation (prompt sign-in or continue anonymous) |
| `app/api/boards/route.ts` | Accept optional owner_id, validate auth |
| `app/api/boards/[boardId]/join/route.ts` | Link participant to user_id when authenticated |
| `types/index.ts` | Add User, BoardMember, BoardInvite types |
| `app/login/page.tsx` | Redirect to /dashboard after login (not just /admin) |

---

### Task 1: Database Migration — User-Board Ownership

**Files:**
- Create: `scripts/migrations/002_user_accounts.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 002_user_accounts.sql
-- Adds user ownership to boards and optional user linking for participants.
-- Better Auth auto-creates: user, session, account, verification tables.
-- This migration adds columns that reference the Better Auth `user` table.

-- Add owner_id to boards (nullable for backwards compat with existing boards)
ALTER TABLE boards ADD COLUMN owner_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

-- Add user_id to participants (nullable — anonymous participants have no user)
ALTER TABLE participants ADD COLUMN user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

-- Index for dashboard queries: "show me all boards I own"
CREATE INDEX idx_boards_owner_id ON boards (owner_id) WHERE owner_id IS NOT NULL;

-- Index for "show me boards where I'm a participant"
CREATE INDEX idx_participants_user_id ON participants (user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN boards.owner_id IS 'Better Auth user ID of the board creator (NULL for anonymous/legacy boards)';
COMMENT ON COLUMN participants.user_id IS 'Better Auth user ID if participant is logged in (NULL for anonymous)';
```

- [ ] **Step 2: Run migration against Neon**

Run: `psql $DATABASE_URL -f scripts/migrations/002_user_accounts.sql`
Expected: `ALTER TABLE` x2, `CREATE INDEX` x2

- [ ] **Step 3: Commit**

```bash
git add scripts/migrations/002_user_accounts.sql
git commit -m "feat: add owner_id to boards and user_id to participants"
```

---

### Task 2: Database Migration — Board Access Control

**Files:**
- Create: `scripts/migrations/003_board_access.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 003_board_access.sql
-- Board membership and invite system for access control.

-- Add visibility setting to boards
ALTER TABLE boards ADD COLUMN visibility TEXT NOT NULL DEFAULT 'link'
  CHECK (visibility IN ('link', 'invite_only'));

-- Board members: tracks which authenticated users have explicit access
CREATE TABLE board_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   TEXT        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'participant'
                         CHECK (role IN ('owner', 'facilitator', 'participant', 'viewer')),
  invited_by TEXT        REFERENCES "user"(id),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);

COMMENT ON TABLE board_members IS 'Authenticated users with explicit board access';
COMMENT ON COLUMN board_members.role IS 'Access level: owner > facilitator > participant > viewer';

CREATE INDEX idx_board_members_board_id ON board_members (board_id);
CREATE INDEX idx_board_members_user_id ON board_members (user_id);

-- Board invites: email-based invite tokens
CREATE TABLE board_invites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    TEXT        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'participant'
                          CHECK (role IN ('facilitator', 'participant', 'viewer')),
  token       TEXT        NOT NULL UNIQUE,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE board_invites IS 'Email-based board invitations with expiring tokens';

CREATE INDEX idx_board_invites_board_id ON board_invites (board_id);
CREATE INDEX idx_board_invites_token ON board_invites (token);

COMMENT ON COLUMN boards.visibility IS 'link = anyone with URL can join; invite_only = requires board_members entry or valid invite';
```

- [ ] **Step 2: Run migration against Neon**

Run: `psql $DATABASE_URL -f scripts/migrations/003_board_access.sql`
Expected: `ALTER TABLE`, `CREATE TABLE` x2, `CREATE INDEX` x4

- [ ] **Step 3: Commit**

```bash
git add scripts/migrations/003_board_access.sql
git commit -m "feat: add board_members and board_invites tables"
```

---

### Task 3: TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add new types to types/index.ts**

Add after the existing `AdminUser` interface (after line 145):

```typescript
// User types (Better Auth user — subset of fields we use)
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  createdAt?: string;
}

// Board membership
export type BoardMemberRole = 'owner' | 'facilitator' | 'participant' | 'viewer';

export interface BoardMember {
  id: string;
  board_id: string;
  user_id: string;
  role: BoardMemberRole;
  invited_by: string | null;
  joined_at: string;
  // Joined from user table for display
  user_email?: string;
  user_name?: string;
}

// Board invites
export interface BoardInvite {
  id: string;
  board_id: string;
  email: string;
  role: BoardMemberRole;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

// Subscription (Better Auth Stripe plugin shape)
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';

export interface Subscription {
  id: string;
  plan: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

// Plan limits
export const PLAN_LIMITS = {
  free: { maxActiveBoards: 3, pdfExport: false, imageExport: false },
  pro: { maxActiveBoards: Infinity, pdfExport: true, imageExport: true },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;
```

- [ ] **Step 2: Update the Board interface to include owner_id and visibility**

Update the existing `Board` interface (lines 2-11):

```typescript
export interface Board {
  id: string;
  title: string;
  description: string | null;
  template: BoardTemplate;
  created_by: string;
  owner_id: string | null;       // Better Auth user ID (null for anonymous/legacy)
  visibility: 'link' | 'invite_only';
  settings: BoardSettings;
  created_at: string;
  archived_at: string | null;
}
```

- [ ] **Step 3: Update the Participant interface to include user_id**

Update the existing `Participant` interface (lines 93-100):

```typescript
export interface Participant {
  id: string;
  board_id: string;
  display_name: string;
  is_admin: boolean;
  user_id: string | null;        // Better Auth user ID (null for anonymous)
  joined_at: string;
  last_seen: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add types/index.ts
git commit -m "feat: add User, BoardMember, BoardInvite, Subscription types"
```

---

### Task 4: Auth Helpers

**Files:**
- Create: `lib/auth-helpers.ts`

- [ ] **Step 1: Create shared auth utility functions**

```typescript
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * Get the current session or null. Does not throw.
 * Use in API routes where auth is optional (e.g., board creation can be anonymous).
 */
export async function getSessionOrNull() {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    return session;
  } catch {
    return null;
  }
}

/**
 * Get the current session or throw 401.
 * Use in API routes that require authentication (e.g., dashboard, billing).
 */
export async function requireSession() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth-helpers.ts
git commit -m "feat: add auth helper utilities (getSessionOrNull, requireSession)"
```

---

### Task 5: Expand authStore for General Users

**Files:**
- Modify: `stores/authStore.ts`

- [ ] **Step 1: Refactor authStore to support both regular users and admins**

Replace the entire file:

```typescript
'use client';

import { create } from 'zustand';
import { authClient } from '@/lib/auth-client';
import type { AdminUser, User, Subscription } from '@/types';

interface AuthState {
  user: User | null;
  adminUser: AdminUser | null;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string, redirectTo?: string) => Promise<string>;
  signUp: (email: string, password: string, name: string) => Promise<string>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  adminUser: null,
  subscription: null,
  loading: true,
  error: null,
  isAuthenticated: false,

  initialize: async () => {
    set({ loading: true, error: null });
    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ user: null, adminUser: null, subscription: null, loading: false, isAuthenticated: false });
      return;
    }

    // Check admin access (optional — not all users are admins)
    const adminRes = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
    const adminUser = adminRes.ok ? await adminRes.json() : null;

    set({
      user: session.data.user,
      adminUser,
      subscription: null, // WS3 will populate this
      loading: false,
      isAuthenticated: true,
    });
  },

  signIn: async (email, password, redirectTo) => {
    set({ loading: true, error: null });
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      set({ loading: false, error: result.error.message });
      throw new Error(result.error.message);
    }

    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ loading: false, error: 'Sign in failed' });
      throw new Error('Sign in failed');
    }

    // Check admin access (optional)
    const adminRes = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
    const adminUser = adminRes.ok ? await adminRes.json() : null;

    set({
      user: session.data.user,
      adminUser,
      loading: false,
      isAuthenticated: true,
    });

    return redirectTo || (adminUser ? '/admin' : '/dashboard');
  },

  signUp: async (email, password, name) => {
    set({ loading: true, error: null });
    const result = await authClient.signUp.email({ email, password, name });
    if (result.error) {
      set({ loading: false, error: result.error.message });
      throw new Error(result.error.message);
    }

    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ loading: false, error: 'Sign up failed' });
      throw new Error('Sign up failed');
    }

    set({
      user: session.data.user,
      adminUser: null,
      loading: false,
      isAuthenticated: true,
    });

    return '/dashboard';
  },

  signOut: async () => {
    await authClient.signOut();
    set({ user: null, adminUser: null, subscription: null, loading: false, error: null, isAuthenticated: false });
  },
}));
```

- [ ] **Step 2: Verify existing admin pages still work**

The admin `ProtectedRoute` component at `components/Admin/ProtectedRoute.tsx` uses `useAuthStore` and checks for `adminUser`. This still works because the refactored store still populates `adminUser` for admin users.

- [ ] **Step 3: Commit**

```bash
git add stores/authStore.ts
git commit -m "feat: expand authStore for general users (sign up, non-admin access)"
```

---

### Task 6: Sign Up Page

**Files:**
- Create: `app/signup/page.tsx`
- Create: `components/pages/SignUpPage.tsx`

- [ ] **Step 1: Create the server component wrapper**

```typescript
// app/signup/page.tsx
import { SignUpPage } from '@/components/pages/SignUpPage';

export default function Page() {
  return <SignUpPage />;
}
```

- [ ] **Step 2: Create the sign-up form component**

```typescript
// components/pages/SignUpPage.tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add app/signup/page.tsx components/pages/SignUpPage.tsx
git commit -m "feat: add sign-up page for new users"
```

---

### Task 7: Refactor Login Page

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Update login page to redirect based on user type**

Replace the entire file:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-gray-0)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-[var(--color-navy)]">Sign In</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
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
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[var(--color-navy)] px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="text-center text-sm text-[var(--color-gray-5)]">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-[var(--color-navy)] hover:underline">
            Sign up free
          </Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/login/page.tsx
git commit -m "refactor: update login page to support general users with smart redirect"
```

---

### Task 8: Auth-Aware Header

**Files:**
- Modify: `components/Layout/Header.tsx`

- [ ] **Step 1: Add sign-in button and user avatar dropdown**

Replace the entire file:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, LayoutDashboard, Settings, Shield, User } from 'lucide-react';
import { APP_NAME } from '@/utils/constants';
import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '@/stores/authStore';

interface HeaderProps {
  rightContent?: React.ReactNode;
}

export function Header({ rightContent }: HeaderProps) {
  const { user, adminUser, isAuthenticated, signOut, initialize } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const handleSignOut = async () => {
    await signOut();
    setDropdownOpen(false);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-gray-1)] bg-[var(--color-surface-translucent)] backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2 hover:no-underline">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-9 w-9">
            <path d="M6 2h14Q30 5 30 12v14c0 2.2-1.8 4-4 4H6c-2.2 0-4-1.8-4-4V6c0-2.2 1.8-4 4-4z" fill="#DD0031"/>
            <path d="M20 2v6c0 2.2 1.8 4 4 4h6Q30 5 20 2z" fill="#004F71"/>
          </svg>
          <span className="text-xl font-bold text-[var(--color-gray-8)]">
            {APP_NAME}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {rightContent}
          <ThemeToggle />
          {isAuthenticated && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-navy)] text-sm font-medium text-white"
                title={user.name || user.email}
              >
                {(user.name || user.email).charAt(0).toUpperCase()}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-[var(--color-gray-1)] bg-[var(--color-surface)] py-1 shadow-lg">
                  <div className="border-b border-[var(--color-gray-1)] px-4 py-2">
                    <p className="text-sm font-medium text-[var(--color-gray-8)]">{user.name}</p>
                    <p className="text-xs text-[var(--color-gray-5)]">{user.email}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
                  >
                    <LayoutDashboard size={16} /> My Boards
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
                  >
                    <Settings size={16} /> Settings
                  </Link>
                  {adminUser && (
                    <Link
                      href="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
                    >
                      <Shield size={16} /> Admin
                    </Link>
                  )}
                  <div className="border-t border-[var(--color-gray-1)]">
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-gray-2)] px-3 py-1.5 text-sm font-medium text-[var(--color-gray-7)] hover:bg-[var(--color-gray-0)]"
            >
              <User size={16} /> Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Layout/Header.tsx
git commit -m "feat: add auth-aware header with user avatar dropdown"
```

---

### Task 9: Update Middleware for New Protected Routes

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Expand middleware matcher to protect dashboard and settings**

Replace the entire file:

```typescript
import { NextRequest, NextResponse } from 'next/server';

// Better Auth stores sessions in a signed cookie named 'better-auth.session_token'.
// We do a lightweight cookie-presence check here (Edge Runtime compatible).
// Full session validation happens inside each API route via auth.api.getSession().
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('better-auth.session_token');

  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protect admin, dashboard, and settings routes.
  // Public routes (/, /board/*, /login, /signup, /pricing, /api/*) are not matched.
  matcher: ['/admin/:path*', '/dashboard/:path*', '/settings/:path*'],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: expand middleware to protect dashboard and settings routes"
```

---

### Task 10: Update Board Creation API for Ownership

**Files:**
- Modify: `app/api/boards/route.ts`

- [ ] **Step 1: Accept owner_id and persist it**

Replace the entire file:

```typescript
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getSessionOrNull } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  const { id, title, description, template, createdBy, settings, columns, participant } =
    await request.json();

  // Get authenticated user if available (board creation works for both auth'd and anon users)
  const session = await getSessionOrNull();
  const ownerId = session?.user?.id ?? null;

  // Insert board with owner_id
  await sql`
    INSERT INTO boards (id, title, description, template, created_by, owner_id, settings)
    VALUES (${id}, ${title}, ${description}, ${template}, ${createdBy}, ${ownerId}, ${JSON.stringify(settings)})
  `;

  // Insert columns
  for (const col of columns) {
    await sql`
      INSERT INTO columns (id, board_id, title, description, color, position)
      VALUES (${col.id}, ${id}, ${col.title}, ${col.description ?? null}, ${col.color}, ${col.position})
    `;
  }

  // Insert participant if provided
  if (participant) {
    await sql`
      INSERT INTO participants (id, board_id, display_name, is_admin, user_id)
      VALUES (${participant.id}, ${id}, ${participant.displayName}, ${participant.isAdmin ?? true}, ${ownerId})
    `;
  }

  // If authenticated, create board_members entry for the owner
  if (ownerId) {
    await sql`
      INSERT INTO board_members (board_id, user_id, role)
      VALUES (${id}, ${ownerId}, 'owner')
    `;
  }

  return NextResponse.json({ boardId: id });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/boards/route.ts
git commit -m "feat: set owner_id and create board_members entry on board creation"
```

---

### Task 11: User Boards API

**Files:**
- Create: `app/api/user/boards/route.ts`

- [ ] **Step 1: Create the user boards endpoint**

```typescript
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const filter = request.nextUrl.searchParams.get('filter') || 'all'; // all | active | completed

  let boards;
  if (filter === 'active') {
    boards = await sql`
      SELECT DISTINCT b.*,
        (SELECT COUNT(*) FROM cards WHERE board_id = b.id) AS card_count,
        (SELECT COUNT(*) FROM participants WHERE board_id = b.id) AS participant_count,
        (SELECT COUNT(*) FROM action_items WHERE board_id = b.id) AS action_count,
        CASE WHEN b.owner_id = ${userId} THEN 'owner' ELSE bm.role END AS user_role
      FROM boards b
      LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = ${userId}
      WHERE (b.owner_id = ${userId} OR bm.user_id = ${userId})
        AND b.archived_at IS NULL
      ORDER BY b.created_at DESC
    `;
  } else if (filter === 'completed') {
    boards = await sql`
      SELECT DISTINCT b.*,
        (SELECT COUNT(*) FROM cards WHERE board_id = b.id) AS card_count,
        (SELECT COUNT(*) FROM participants WHERE board_id = b.id) AS participant_count,
        (SELECT COUNT(*) FROM action_items WHERE board_id = b.id) AS action_count,
        CASE WHEN b.owner_id = ${userId} THEN 'owner' ELSE bm.role END AS user_role
      FROM boards b
      LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = ${userId}
      WHERE (b.owner_id = ${userId} OR bm.user_id = ${userId})
        AND b.archived_at IS NOT NULL
      ORDER BY b.archived_at DESC
    `;
  } else {
    boards = await sql`
      SELECT DISTINCT b.*,
        (SELECT COUNT(*) FROM cards WHERE board_id = b.id) AS card_count,
        (SELECT COUNT(*) FROM participants WHERE board_id = b.id) AS participant_count,
        (SELECT COUNT(*) FROM action_items WHERE board_id = b.id) AS action_count,
        CASE WHEN b.owner_id = ${userId} THEN 'owner' ELSE bm.role END AS user_role
      FROM boards b
      LEFT JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = ${userId}
      WHERE b.owner_id = ${userId} OR bm.user_id = ${userId}
      ORDER BY b.created_at DESC
    `;
  }

  return NextResponse.json({ boards });
}
```

- [ ] **Step 2: Create the directory structure**

Run: `mkdir -p app/api/user/boards`

- [ ] **Step 3: Commit**

```bash
git add app/api/user/boards/route.ts
git commit -m "feat: add /api/user/boards endpoint for dashboard"
```

---

### Task 12: Update Board Join to Link User

**Files:**
- Modify: `app/api/boards/[boardId]/join/route.ts`

- [ ] **Step 1: Read the current file**

Read `app/api/boards/[boardId]/join/route.ts` to understand current structure.

- [ ] **Step 2: Add user_id linking when participant is authenticated**

Update the participant INSERT to include `user_id` when the joining participant is logged in. Add `getSessionOrNull` import and pass `user_id` to the INSERT.

In the POST handler, after parsing the request body, add:

```typescript
const session = await getSessionOrNull();
const userId = session?.user?.id ?? null;
```

Update the INSERT query from:
```sql
INSERT INTO participants (id, board_id, display_name, is_admin)
VALUES (${participantId}, ${boardId}, ${displayName}, ${isAdmin})
```
to:
```sql
INSERT INTO participants (id, board_id, display_name, is_admin, user_id)
VALUES (${participantId}, ${boardId}, ${displayName}, ${isAdmin}, ${userId})
```

If the user is authenticated and this is a `link`-visibility board, also add a `board_members` entry:

```typescript
if (userId) {
  await sql`
    INSERT INTO board_members (board_id, user_id, role)
    VALUES (${boardId}, ${userId}, 'participant')
    ON CONFLICT (board_id, user_id) DO NOTHING
  `;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/boards/[boardId]/join/route.ts
git commit -m "feat: link participant to user account when authenticated on join"
```

---

### Task 13: Board Members API

**Files:**
- Create: `app/api/boards/[boardId]/members/route.ts`

- [ ] **Step 1: Create the board members CRUD endpoint**

```typescript
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const members = await sql`
    SELECT bm.*, u.email AS user_email, u.name AS user_name
    FROM board_members bm
    JOIN "user" u ON bm.user_id = u.id
    WHERE bm.board_id = ${boardId}
    ORDER BY bm.joined_at ASC
  `;

  return NextResponse.json({ members });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify requester is board owner
  const [board] = await sql`SELECT owner_id FROM boards WHERE id = ${boardId}`;
  if (!board || board.owner_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the board owner can add members' }, { status: 403 });
  }

  const { userId, role } = await request.json();

  await sql`
    INSERT INTO board_members (board_id, user_id, role, invited_by)
    VALUES (${boardId}, ${userId}, ${role || 'participant'}, ${session.user.id})
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = ${role || 'participant'}
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify requester is board owner
  const [board] = await sql`SELECT owner_id FROM boards WHERE id = ${boardId}`;
  if (!board || board.owner_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the board owner can remove members' }, { status: 403 });
  }

  const { userId } = await request.json();

  // Can't remove the owner
  if (userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot remove board owner' }, { status: 400 });
  }

  await sql`DELETE FROM board_members WHERE board_id = ${boardId} AND user_id = ${userId}`;

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/boards/[boardId]/members/route.ts
git commit -m "feat: add board members CRUD API"
```

---

### Task 14: Dashboard Page

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `components/pages/DashboardPage.tsx`
- Create: `components/Dashboard/BoardCard.tsx`
- Create: `components/Dashboard/index.ts`

- [ ] **Step 1: Create server component wrapper**

```typescript
// app/dashboard/page.tsx
import { DashboardPage } from '@/components/pages/DashboardPage';

export default function Page() {
  return <DashboardPage />;
}
```

- [ ] **Step 2: Create BoardCard component**

```typescript
// components/Dashboard/BoardCard.tsx
'use client';

import Link from 'next/link';
import { LayoutGrid, MessageSquare, Users, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';

interface BoardCardProps {
  board: {
    id: string;
    title: string;
    description: string | null;
    template: string;
    created_at: string;
    archived_at: string | null;
    card_count: number;
    participant_count: number;
    action_count: number;
    user_role: string;
  };
}

export function BoardCard({ board }: BoardCardProps) {
  const isCompleted = !!board.archived_at;
  const date = new Date(board.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link
      href={`/board/${board.id}`}
      className={cn(
        'group flex flex-col rounded-xl border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-5 transition-all hover:border-[var(--color-gray-2)] hover:shadow-md',
        isCompleted && 'opacity-75'
      )}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-gray-8)] group-hover:text-[var(--color-navy)]">
          {board.title}
        </h3>
        {isCompleted ? (
          <span className="flex items-center gap-1 rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
            <CheckCircle2 size={12} /> Done
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-[var(--color-navy)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-navy)]">
            <Clock size={12} /> Active
          </span>
        )}
      </div>

      {board.description && (
        <p className="mt-1 line-clamp-2 text-sm text-[var(--color-gray-5)]">{board.description}</p>
      )}

      <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-[var(--color-gray-4)]">
        <span className="flex items-center gap-1"><MessageSquare size={12} /> {board.card_count}</span>
        <span className="flex items-center gap-1"><Users size={12} /> {board.participant_count}</span>
        <span className="flex items-center gap-1"><LayoutGrid size={12} /> {board.action_count}</span>
        <span className="ml-auto">{date}</span>
      </div>

      {board.user_role !== 'owner' && (
        <p className="mt-2 text-xs text-[var(--color-gray-4)]">
          Shared with you as {board.user_role}
        </p>
      )}
    </Link>
  );
}
```

- [ ] **Step 3: Create barrel export**

```typescript
// components/Dashboard/index.ts
export { BoardCard } from './BoardCard';
```

- [ ] **Step 4: Create DashboardPage component**

```typescript
// components/pages/DashboardPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Button, Input } from '@/components/common';
import { BoardCard } from '@/components/Dashboard';
import { useAuthStore } from '@/stores/authStore';

type Filter = 'all' | 'active' | 'completed';

interface DashboardBoard {
  id: string;
  title: string;
  description: string | null;
  template: string;
  created_at: string;
  archived_at: string | null;
  card_count: number;
  participant_count: number;
  action_count: number;
  user_role: string;
}

export function DashboardPage() {
  const [boards, setBoards] = useState<DashboardBoard[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuthStore();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login?redirect=/dashboard');
      return;
    }

    async function fetchBoards() {
      setLoading(true);
      const res = await fetch(`/api/user/boards?filter=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setBoards(data.boards);
      }
      setLoading(false);
    }
    fetchBoards();
  }, [filter, isAuthenticated, authLoading, router]);

  const filteredBoards = search
    ? boards.filter((b) => b.title.toLowerCase().includes(search.toLowerCase()))
    : boards;

  const ownedBoards = filteredBoards.filter((b) => b.user_role === 'owner');
  const sharedBoards = filteredBoards.filter((b) => b.user_role !== 'owner');

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[var(--color-gray-8)]">My Boards</h1>
            <Button onClick={() => router.push('/')}>
              <Plus size={18} /> New Retro
            </Button>
          </div>

          {/* Filters + Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-lg border border-[var(--color-gray-1)] bg-[var(--color-surface)] p-1">
              {(['all', 'active', 'completed'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    filter === f
                      ? 'bg-[var(--color-navy)] text-white'
                      : 'text-[var(--color-gray-5)] hover:text-[var(--color-gray-7)]'
                  )}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-gray-4)]" />
              <input
                type="text"
                placeholder="Search boards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-gray-1)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          {/* Board Grid */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl border border-[var(--color-gray-1)] bg-[var(--color-gray-0)]" />
              ))}
            </div>
          ) : (
            <>
              {ownedBoards.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-gray-4)]">
                    My Retros ({ownedBoards.length})
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {ownedBoards.map((board) => (
                      <BoardCard key={board.id} board={board} />
                    ))}
                  </div>
                </section>
              )}

              {sharedBoards.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-gray-4)]">
                    Shared With Me ({sharedBoards.length})
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {sharedBoards.map((board) => (
                      <BoardCard key={board.id} board={board} />
                    ))}
                  </div>
                </section>
              )}

              {ownedBoards.length === 0 && sharedBoards.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-lg text-[var(--color-gray-5)]">No boards yet</p>
                  <p className="mt-1 text-sm text-[var(--color-gray-4)]">Create your first retro to get started.</p>
                  <Button className="mt-4" onClick={() => router.push('/')}>
                    <Plus size={18} /> Create a Retro
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx components/pages/DashboardPage.tsx components/Dashboard/BoardCard.tsx components/Dashboard/index.ts
git commit -m "feat: add dashboard page with My Boards and Shared With Me sections"
```

---

### Task 15: Update Board Fetch to Return New Fields

**Files:**
- Modify: `app/api/boards/[boardId]/route.ts`

- [ ] **Step 1: Read the current file to understand its structure**

- [ ] **Step 2: Ensure the GET response includes owner_id and visibility**

The existing query `SELECT * FROM boards WHERE id = ${boardId}` already returns all columns. Since we added `owner_id` and `visibility` via migration, they'll be included automatically. No code change needed in the query.

However, verify that the response shape matches the updated `Board` TypeScript interface (which now includes `owner_id` and `visibility`).

- [ ] **Step 3: Commit (if any changes were needed)**

---

### Task 16: Verify and Test

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with all new routes compiled

- [ ] **Step 3: Manual smoke test checklist**

1. Visit `/signup` — create a new account
2. Redirected to `/dashboard` — see empty state
3. Visit `/` — create a board (should have owner_id set in DB)
4. Visit `/dashboard` — board appears in "My Retros"
5. Header shows user avatar with dropdown
6. Dropdown links work: My Boards, Settings, Sign Out
7. Open board link in incognito — participant joins without auth (frictionless)
8. Admin login still works → redirects to `/admin`

- [ ] **Step 4: Commit any fixes**
