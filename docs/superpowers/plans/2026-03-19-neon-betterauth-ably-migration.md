# Retro Board Migration: Supabase → Neon + Better Auth + Ably

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Retro Board from Vite SPA + Supabase to Next.js App Router + Neon + Better Auth + Ably, preserving all existing functionality.

**Architecture:** The current app is a Vite SPA with all database calls made client-side via `@supabase/supabase-js`. The new architecture uses Next.js App Router with server-side API routes that write to Neon and publish events to Ably. Auth moves from Supabase Auth to Better Auth with sessions stored in Neon. Realtime moves from Supabase postgres_changes/broadcast/presence to Ably pub/sub and presence hooks.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5.9, `@neondatabase/serverless`, `better-auth`, `ably` (React hooks), Tailwind CSS 4, Zustand 5, @dnd-kit, lucide-react, nanoid

**Spec:** `docs/plans/retro-board-migration-spec.md`

---

## File Structure (New / Modified)

### New Files — Next.js Scaffold
```
app/
├── layout.tsx                          # Root layout (providers, global CSS)
├── page.tsx                            # Home page (create/join board)
├── not-found.tsx                       # 404
├── login/
│   └── page.tsx                        # Login/signup page
├── board/
│   └── [boardId]/
│       └── page.tsx                    # Board page (main collaboration UI)
├── admin/
│   ├── layout.tsx                      # Admin layout (sidebar, auth gate)
│   ├── page.tsx                        # Dashboard
│   ├── features/
│   │   └── page.tsx                    # Feature flags
│   ├── boards/
│   │   └── page.tsx                    # Board management
│   └── settings/
│       └── page.tsx                    # App settings
└── api/
    ├── auth/
    │   └── [...all]/
    │       └── route.ts                # Better Auth catch-all
    ├── ably-token/
    │   └── route.ts                    # Ably token auth endpoint
    ├── boards/
    │   ├── route.ts                    # POST create board
    │   └── [boardId]/
    │       ├── route.ts                # GET fetch board, PATCH update settings, POST complete
    │       ├── join/
    │       │   └── route.ts            # POST join board
    │       ├── participants/
    │       │   └── route.ts            # PATCH update, DELETE remove participant
    │       ├── columns/
    │       │   └── route.ts            # POST create, PATCH update, DELETE
    │       ├── cards/
    │       │   └── route.ts            # POST create, PATCH update/move, DELETE
    │       ├── votes/
    │       │   └── route.ts            # POST toggle vote
    │       └── action-items/
    │           └── route.ts            # POST create, PATCH update, DELETE
    ├── admin/
    │   ├── feature-flags/
    │   │   └── route.ts                # GET list, PATCH toggle
    │   ├── app-settings/
    │   │   └── route.ts                # GET fetch, PATCH update
    │   └── boards/
    │       └── route.ts                # GET list all boards (admin)
    └── feature-flags/
        └── route.ts                    # GET public flag list
```

### New Files — Infrastructure
```
lib/
├── auth.ts                             # Better Auth server config
├── auth-client.ts                      # Better Auth client
├── db.ts                               # Neon SQL client
└── ably-server.ts                      # Ably server-side client
components/
└── providers/
    ├── AblyProvider.tsx                # Ably React context provider
    └── Providers.tsx                   # Combines all providers
middleware.ts                           # Auth middleware for protected routes
next.config.ts                          # Next.js config
```

### Migrated Files (src/ → components/ or lib/ or hooks/)
```
components/                             # All existing src/components/ move here
├── ActionItems/
├── Admin/
├── Board/
├── Layout/
├── Timer/
└── common/
hooks/
├── usePresence.ts                      # Rewritten: Supabase → Ably presence
├── useTimer.ts                         # Rewritten: Supabase broadcast → Ably channel
├── usePolling.ts                       # Kept as-is
└── useTheme.ts                         # Kept as-is
stores/
├── boardStore.ts                       # Rewritten: Supabase client calls → fetch() to API routes
├── authStore.ts                        # Rewritten: Supabase Auth → Better Auth
├── featureFlagStore.ts                 # Rewritten: Supabase → fetch() to API routes
└── appSettingsStore.ts                 # Rewritten: Supabase → fetch() to API routes
types/
└── index.ts                            # Kept, minor additions for Ably events
utils/                                  # All kept as-is
styles/
└── index.css                           # Kept as-is (design tokens)
```

### Deleted Files
```
src/main.tsx                            # Replaced by Next.js app/layout.tsx
src/App.tsx                             # Replaced by Next.js app/ routing
src/lib/supabase.ts                     # Replaced by lib/db.ts + lib/auth.ts
index.html                              # Next.js handles this
vite.config.ts                          # Replaced by next.config.ts
supabase/                               # No longer needed (schema lives in Neon)
```

---

## Chunk 1: Framework Migration (Vite → Next.js) + Database

### Task 1: Initialize Next.js alongside existing code

**Files:**
- Create: `next.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx` (placeholder)
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Install Next.js dependencies**

```bash
npm install next@latest
npm uninstall @vitejs/plugin-react @tailwindcss/vite
```

Note: Keep `react`, `react-dom`, `tailwindcss` — they're shared.

- [ ] **Step 2: Create `next.config.ts`**

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tailwind CSS 4 uses postcss, not the vite plugin
};

export default nextConfig;
```

- [ ] **Step 3: Create `postcss.config.mjs` for Tailwind CSS 4**

```javascript
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

```bash
npm install @tailwindcss/postcss
```

- [ ] **Step 4: Update `tsconfig.json` for Next.js**

Replace contents. **IMPORTANT:** Keep `@/` pointing to `./src/` temporarily — files move in Task 2.
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Install eslint-config-next and update scripts**

```bash
npm install -D eslint-config-next
```

Replace scripts in `package.json`:
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

- [ ] **Step 6: Create root layout with global CSS**

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import '@/styles/index.css';

export const metadata: Metadata = {
  title: 'RetroBoard',
  description: 'Real-time retrospective board for team collaboration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create placeholder home page**

```typescript
// app/page.tsx
export default function Home() {
  return <div>RetroBoard — migration in progress</div>;
}
```

- [ ] **Step 8: Delete Vite files and verify Next.js boots**

Delete: `vite.config.ts`, `index.html`, `src/main.tsx`, `tsconfig.app.json`, `tsconfig.node.json`

```bash
npm run dev
```

Expected: Next.js dev server starts on port 3000, placeholder page renders.

- [ ] **Step 9: Add `.next/` to `.gitignore`**

- [ ] **Step 10: Commit**

```
feat: initialize Next.js App Router, remove Vite
```

---

### Task 2: Move source files from `src/` to project root

**Why now:** The `@/` alias currently points to `./src/`. Next.js convention is `@/` → `./`. Moving files now means all subsequent tasks can use root-relative paths and existing component imports continue to work.

**Files:**
- Move: `src/components/` → `components/`
- Move: `src/hooks/` → `hooks/`
- Move: `src/stores/` → `stores/`
- Move: `src/types/` → `types/`
- Move: `src/utils/` → `utils/`
- Move: `src/lib/audio.ts` → `lib/audio.ts`
- Move: `src/styles/` → `styles/`
- Delete: `src/main.tsx`, `src/App.tsx`, `src/lib/supabase.ts`
- Modify: `tsconfig.json` (update `@/` alias to `"./*"`)

- [ ] **Step 1: Move all directories from `src/` to root**

```bash
mv src/components components
mv src/hooks hooks
mv src/stores stores
mv src/types types
mv src/utils utils
mkdir -p lib
mv src/lib/audio.ts lib/audio.ts
mv src/styles styles
```

- [ ] **Step 2: Delete Vite-only entry files**

```bash
rm src/main.tsx src/App.tsx src/lib/supabase.ts
rm -rf src/pages  # Pages will be recreated as App Router pages
rmdir src/lib src
```

- [ ] **Step 3: Add `'use client'` directives to all client components**

Every file that uses React hooks, browser APIs, or event handlers needs `'use client'` at the top. This includes all files in:
- `components/` (all subdirectories)
- `hooks/` (all files)
- `stores/` (all files)

Skip: `types/`, `utils/` (pure TypeScript, no React), `styles/` (CSS).

- [ ] **Step 4: Update `tsconfig.json` path alias**

Change `"@/*": ["./src/*"]` to `"@/*": ["./*"]`.

- [ ] **Step 5: Verify build compiles**

```bash
npm run dev
```

Expected: Next.js boots, placeholder page renders. Existing components aren't mounted yet but imports resolve.

- [ ] **Step 6: Commit**

```
refactor: move source files from src/ to project root for Next.js convention
```

---

### Task 3: Set up Neon database client

**Files:**
- Create: `lib/db.ts`
- Modify: `.env.local` (add DATABASE_URL)
- Modify: `.env.example`

- [ ] **Step 1: Install Neon serverless driver**

```bash
npm install @neondatabase/serverless
```

- [ ] **Step 2: Create `lib/db.ts`**

```typescript
// lib/db.ts
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = neon(process.env.DATABASE_URL);
```

- [ ] **Step 3: Update `.env.example`**

```env
# Neon
DATABASE_URL="postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET=""
BETTER_AUTH_URL="http://localhost:3000"

# Ably
ABLY_API_KEY=""
```

- [ ] **Step 4: Add DATABASE_URL to `.env.local`**

The user needs to create a Neon project at https://console.neon.tech and paste the connection string.

- [ ] **Step 5: Commit**

```
feat: add Neon database client
```

---

### Task 4: Create Neon database schema

**Files:**
- Create: `scripts/migrate.sql`

- [ ] **Step 1: Create migration SQL for Neon**

Take the existing `supabase/migrations/001_initial_schema.sql` and strip Supabase-specific lines:
- Remove all `ALTER PUBLICATION supabase_realtime` statements
- Remove all RLS policies and `ENABLE ROW LEVEL SECURITY` (no RLS needed — API routes control access)
- Keep: tables, indexes, triggers, comments

Also include the `002_admin_console.sql` tables but strip the Supabase auth references:
- `admin_users` table: change `id UUID REFERENCES auth.users(id)` to `id TEXT PRIMARY KEY` (will reference Better Auth user IDs)
- Remove RLS policies that reference `auth.uid()`

```sql
-- scripts/migrate.sql
-- Retro Board schema for Neon (no RLS, no Supabase-specific features)

-- [Full cleaned schema — tables, indexes, triggers from 001 + 002, no RLS/realtime]
```

- [ ] **Step 2: Run migration against Neon**

```bash
psql "$DATABASE_URL" < scripts/migrate.sql
```

- [ ] **Step 3: Commit**

```
feat: add Neon migration script
```

---

### Task 5: Create first API route — fetch board

**Files:**
- Create: `app/api/boards/[boardId]/route.ts`

- [ ] **Step 1: Create the GET handler**

```typescript
// app/api/boards/[boardId]/route.ts
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const [board] = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  const [columns, cards, votes, actionItems, participants] = await Promise.all([
    sql`SELECT * FROM columns WHERE board_id = ${boardId} ORDER BY position`,
    sql`SELECT * FROM cards WHERE board_id = ${boardId} ORDER BY position`,
    sql`SELECT * FROM votes WHERE board_id = ${boardId}`,
    sql`SELECT * FROM action_items WHERE board_id = ${boardId} ORDER BY created_at`,
    sql`SELECT * FROM participants WHERE board_id = ${boardId}`,
  ]);

  return NextResponse.json({ board, columns, cards, votes, actionItems, participants });
}
```

- [ ] **Step 2: Verify the route works**

```bash
npm run dev
# In another terminal:
curl http://localhost:3000/api/boards/test-id
```

Expected: `{ "error": "Board not found" }` with 404 status (confirms Neon connection works).

- [ ] **Step 3: Commit**

```
feat: add board fetch API route with Neon
```

---

## Chunk 2: Auth (Better Auth)

### Task 6: Set up Better Auth

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/auth-client.ts`
- Create: `app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Install Better Auth**

```bash
npm install better-auth
```

- [ ] **Step 2: Create `lib/auth.ts` (server config)**

```typescript
// lib/auth.ts
import { betterAuth } from 'better-auth';
import { Pool } from '@neondatabase/serverless';

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});
```

- [ ] **Step 3: Create `lib/auth-client.ts`**

```typescript
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
});
```

- [ ] **Step 4: Create auth API route**

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { POST, GET } = toNextJsHandler(auth);
```

- [ ] **Step 5: Generate Better Auth tables in Neon**

Better Auth auto-creates its tables (`user`, `session`, `account`, `verification`) on first request if they don't exist. Or run the CLI:

```bash
npx @better-auth/cli generate
```

Then apply the generated migration to Neon.

- [ ] **Step 6: Add env vars to `.env.local`**

```
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 7: Commit**

```
feat: add Better Auth server and client config
```

---

### Task 7: Create login page and auth middleware

**Files:**
- Create: `app/login/page.tsx`
- Create: `middleware.ts`

- [ ] **Step 1: Create login page**

```typescript
// app/login/page.tsx
'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isSignUp) {
        await authClient.signUp.email({ email, password, name: email.split('@')[0] });
      } else {
        await authClient.signIn.email({ email, password });
      }
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-gray-0)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-[var(--color-navy)]">
          {isSignUp ? 'Create Account' : 'Admin Login'}
        </h1>
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
        <button type="submit" className="w-full rounded bg-[var(--color-navy)] px-4 py-2 text-white">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
        <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-sm text-[var(--color-navy)]">
          {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create auth middleware**

```typescript
// middleware.ts
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

Note: Board pages (`/board/:boardId`) do NOT require auth — participants join with a display name (same as current behavior).

- [ ] **Step 3: Commit**

```
feat: add login page and admin auth middleware
```

---

### Task 8: Rewrite authStore for Better Auth

**Files:**
- Modify: `stores/authStore.ts`

- [ ] **Step 1: Rewrite authStore**

Preserve the `adminUser` concept — the admin check now queries the `admin_users` table via an API route.

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { authClient } from '@/lib/auth-client';
import type { AdminUser } from '@/types';

interface AuthState {
  user: { id: string; email: string; name: string } | null;
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
    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ user: null, adminUser: null, loading: false });
      return;
    }

    // Check admin access
    const res = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
    const adminUser = res.ok ? await res.json() : null;

    set({
      user: session.data.user,
      adminUser,
      loading: false,
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      set({ loading: false, error: result.error.message });
      return;
    }

    const session = await authClient.getSession();
    if (!session.data?.user) {
      set({ loading: false, error: 'Sign in failed' });
      return;
    }

    // Verify admin access
    const res = await fetch(`/api/admin/verify?userId=${session.data.user.id}`);
    if (!res.ok) {
      await authClient.signOut();
      set({ loading: false, error: 'You do not have admin access' });
      return;
    }

    const adminUser = await res.json();
    set({ user: session.data.user, adminUser, loading: false });
  },

  signOut: async () => {
    await authClient.signOut();
    set({ user: null, adminUser: null, loading: false, error: null });
  },
}));
```

Also create the admin verify API route:

```typescript
// app/api/admin/verify/route.ts
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json(null, { status: 400 });

  const [adminUser] = await sql`SELECT * FROM admin_users WHERE id = ${userId}`;
  if (!adminUser) return NextResponse.json(null, { status: 403 });

  return NextResponse.json(adminUser);
}
```

- [ ] **Step 2: Commit**

```
feat: rewrite authStore for Better Auth with admin verification
```

---

## Chunk 3: Ably Realtime Setup + Presence

### Task 9: Set up Ably provider and token auth

**Files:**
- Create: `app/api/ably-token/route.ts`
- Create: `components/providers/AblyProvider.tsx`
- Create: `components/providers/Providers.tsx`
- Create: `lib/ably-server.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Install Ably**

```bash
npm install ably
```

- [ ] **Step 2: Create server-side Ably client**

```typescript
// lib/ably-server.ts
import Ably from 'ably';

if (!process.env.ABLY_API_KEY) {
  throw new Error('ABLY_API_KEY environment variable is not set');
}

export const ablyServer = new Ably.Rest(process.env.ABLY_API_KEY);
```

- [ ] **Step 3: Create Ably token auth endpoint**

```typescript
// app/api/ably-token/route.ts
import { ablyServer } from '@/lib/ably-server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Use participantId from query param (board participants aren't authenticated users)
  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) {
    return new Response('Missing clientId', { status: 400 });
  }

  const tokenRequest = await ablyServer.auth.createTokenRequest({
    clientId,
  });

  return Response.json(tokenRequest);
}
```

Note: Board participants use participantId (not auth userId) as Ably clientId. Admin routes that need auth can add session checks separately.

- [ ] **Step 4: Create AblyProvider**

```typescript
// components/providers/AblyProvider.tsx
'use client';

import { AblyProvider as AblyReactProvider } from 'ably/react';
import * as Ably from 'ably';
import { useRef } from 'react';

export function AblyProvider({
  clientId,
  children,
}: {
  clientId: string;
  children: React.ReactNode;
}) {
  const clientRef = useRef<Ably.Realtime | null>(null);

  if (!clientRef.current) {
    clientRef.current = new Ably.Realtime({
      authUrl: `/api/ably-token?clientId=${clientId}`,
      authMethod: 'GET',
      clientId,
    });
  }

  return (
    <AblyReactProvider client={clientRef.current}>
      {children}
    </AblyReactProvider>
  );
}
```

- [ ] **Step 5: Create combined Providers wrapper**

```typescript
// components/providers/Providers.tsx
'use client';

import { ThemeProvider } from '@/hooks/useTheme';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // AblyProvider is mounted per-board (needs participantId), not at root
    <>{children}</>
  );
}
```

Note: AblyProvider is NOT a root provider. It wraps the board page specifically because it needs a participantId. The root layout just includes global providers (theme, etc.).

- [ ] **Step 6: Update root layout to use Providers**

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import '@/styles/index.css';

export const metadata: Metadata = {
  title: 'RetroBoard',
  description: 'Real-time retrospective board for team collaboration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Commit**

```
feat: add Ably provider and token auth endpoint
```

---

### Task 10: Rewrite usePresence for Ably

**Files:**
- Modify: `hooks/usePresence.ts`

- [ ] **Step 1: Rewrite usePresence hook**

```typescript
// hooks/usePresence.ts
'use client';

import { usePresence as useAblyPresence, usePresenceListener } from 'ably/react';
import { useEffect } from 'react';
import { useBoardStore } from '@/stores/boardStore';

interface PresenceData {
  participantId: string;
  displayName: string;
  isAdmin: boolean;
}

export function usePresence(
  boardId: string | undefined,
  participantId: string | null,
  liveSync = true
) {
  const setOnlineParticipantIds = useBoardStore((s) => s.setOnlineParticipantIds);
  const participants = useBoardStore((s) => s.participants);

  const participant = participants.find((p) => p.id === participantId);

  // Enter presence
  useAblyPresence(
    {
      channelName: `retro-board:${boardId}`,
      skip: !boardId || !participantId || !liveSync || !participant,
    },
    {
      participantId,
      displayName: participant?.display_name ?? '',
      isAdmin: participant?.is_admin ?? false,
    } satisfies PresenceData
  );

  // Listen to presence changes
  const { presenceData } = usePresenceListener({
    channelName: `retro-board:${boardId}`,
    skip: !boardId || !liveSync,
  });

  useEffect(() => {
    if (!liveSync) return;
    const ids = presenceData.map((m) => m.clientId);
    setOnlineParticipantIds(ids);
  }, [presenceData, liveSync, setOnlineParticipantIds]);
}
```

- [ ] **Step 2: Commit**

```
feat: rewrite usePresence for Ably
```

---

### Task 11: Rewrite useTimer for Ably

**Files:**
- Modify: `hooks/useTimer.ts`

- [ ] **Step 1: Rewrite useTimer hook**

```typescript
// hooks/useTimer.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChannel } from 'ably/react';
import { playTimerDing, resumeAudioContext } from '@/lib/audio';
import type { TimerState } from '@/types';

const IDLE_TIMER: TimerState = { duration: 0, remaining: 0, status: 'idle', started_at: null };

interface UseTimerOptions {
  boardId: string;
  liveSync?: boolean;
}

export function useTimer({ boardId, liveSync = true }: UseTimerOptions) {
  const [timer, setTimer] = useState<TimerState>(IDLE_TIMER);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<TimerState>(IDLE_TIMER);

  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startCountdown = useCallback((startedAt: string, duration: number) => {
    clearTick();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      if (remaining <= 0) {
        clearTick();
        setTimer({ duration, remaining: 0, status: 'expired', started_at: startedAt });
        playTimerDing();
      } else {
        setTimer({ duration, remaining, status: 'running', started_at: startedAt });
      }
    }, 250);
  }, [clearTick]);

  // Ably channel for timer events
  const { channel } = useChannel(
    {
      channelName: `retro-board:${boardId}:timer`,
      skip: !liveSync,
    },
    (message) => {
      const { name, data } = message;

      if (name === 'timer:start' || name === 'timer:resume' || name === 'timer:sync-response') {
        const state = data as TimerState;
        resumeAudioContext();
        setTimer(state);
        if (state.started_at && state.status === 'running') {
          startCountdown(state.started_at, state.duration);
        }
      } else if (name === 'timer:pause') {
        clearTick();
        setTimer(data as TimerState);
      } else if (name === 'timer:reset') {
        clearTick();
        setTimer(IDLE_TIMER);
      } else if (name === 'timer:sync-request') {
        // Respond with current timer state
        channel?.publish('timer:sync-response', timerRef.current);
      }
    }
  );

  // Request sync on mount
  useEffect(() => {
    if (!liveSync || !channel) return;
    channel.publish('timer:sync-request', {});
  }, [liveSync, channel]);

  const start = useCallback((duration: number) => {
    resumeAudioContext();
    const startedAt = new Date().toISOString();
    const state: TimerState = { duration, remaining: duration, status: 'running', started_at: startedAt };
    setTimer(state);
    startCountdown(startedAt, duration);
    channel?.publish('timer:start', state);
  }, [startCountdown, channel]);

  const pause = useCallback(() => {
    clearTick();
    const paused: TimerState = { ...timerRef.current, status: 'paused' };
    setTimer(paused);
    channel?.publish('timer:pause', paused);
  }, [clearTick, channel]);

  const resume = useCallback(() => {
    resumeAudioContext();
    const prev = timerRef.current;
    const startedAt = new Date(Date.now() - (prev.duration - prev.remaining) * 1000).toISOString();
    const resumed: TimerState = { ...prev, status: 'running', started_at: startedAt };
    setTimer(resumed);
    startCountdown(startedAt, prev.duration);
    channel?.publish('timer:resume', resumed);
  }, [startCountdown, channel]);

  const reset = useCallback(() => {
    clearTick();
    setTimer(IDLE_TIMER);
    channel?.publish('timer:reset', IDLE_TIMER);
  }, [clearTick, channel]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { timer, start, pause, resume, reset };
}
```

- [ ] **Step 2: Commit**

```
feat: rewrite useTimer for Ably broadcast
```

---

## Chunk 4: Board API Routes + Store Rewrite

### Task 12: Create all board API routes

**Files:**
- Create: `app/api/boards/route.ts`
- Modify: `app/api/boards/[boardId]/route.ts`
- Create: `app/api/boards/[boardId]/join/route.ts`
- Create: `app/api/boards/[boardId]/columns/route.ts`
- Create: `app/api/boards/[boardId]/cards/route.ts`
- Create: `app/api/boards/[boardId]/votes/route.ts`
- Create: `app/api/boards/[boardId]/action-items/route.ts`

Each API route follows the same pattern:
1. Parse request body
2. Write to Neon via `sql` tagged template
3. Publish event to Ably channel
4. Return JSON response

- [ ] **Step 1: Create board creation route (`POST /api/boards`)**

```typescript
// app/api/boards/route.ts
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  const body = await request.json();
  const { id, title, description, template, createdBy, settings, columns, participant } = body;

  // Insert board
  await sql`
    INSERT INTO boards (id, title, description, template, created_by, settings)
    VALUES (${id}, ${title}, ${description}, ${template}, ${createdBy}, ${JSON.stringify(settings)})
  `;

  // Insert columns
  if (columns?.length) {
    for (const col of columns) {
      await sql`
        INSERT INTO columns (id, board_id, title, description, color, position)
        VALUES (${col.id}, ${id}, ${col.title}, ${col.description}, ${col.color}, ${col.position})
      `;
    }
  }

  // Insert creator as participant
  if (participant) {
    await sql`
      INSERT INTO participants (id, board_id, display_name, is_admin)
      VALUES (${participant.id}, ${id}, ${participant.displayName}, true)
    `;
  }

  return Response.json({ boardId: id });
}
```

- [ ] **Step 2: Add PATCH (update settings) and POST /complete to board route**

```typescript
// app/api/boards/[boardId]/route.ts — add PATCH and POST handlers
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { settings } = await request.json();

  await sql`UPDATE boards SET settings = ${JSON.stringify(settings)} WHERE id = ${boardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('board-updated', { settings });

  return Response.json({ ok: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { action } = await request.json();

  if (action === 'complete') {
    const archivedAt = new Date().toISOString();
    const [board] = await sql`SELECT settings FROM boards WHERE id = ${boardId}`;
    const newSettings = { ...board.settings, card_visibility: 'visible', board_locked: true };

    await sql`
      UPDATE boards SET archived_at = ${archivedAt}, settings = ${JSON.stringify(newSettings)}
      WHERE id = ${boardId}
    `;

    const channel = ablyServer.channels.get(`retro-board:${boardId}`);
    await channel.publish('board-completed', { archivedAt, settings: newSettings });

    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
```

- [ ] **Step 3: Create join route**

```typescript
// app/api/boards/[boardId]/join/route.ts
import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { participantId, displayName, isAdmin } = await request.json();

  await sql`
    INSERT INTO participants (id, board_id, display_name, is_admin)
    VALUES (${participantId}, ${boardId}, ${displayName}, ${isAdmin})
  `;

  if (isAdmin) {
    await sql`UPDATE boards SET created_by = ${participantId} WHERE id = ${boardId}`;
  }

  const [participant] = await sql`SELECT * FROM participants WHERE id = ${participantId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-joined', { participant });

  return Response.json({ participant });
}
```

- [ ] **Step 4: Create participants route (update/remove)**

```typescript
// app/api/boards/[boardId]/participants/route.ts
import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { participantId, updates } = await request.json();

  if (updates.is_admin !== undefined) {
    await sql`UPDATE participants SET is_admin = ${updates.is_admin} WHERE id = ${participantId}`;
  }

  const [participant] = await sql`SELECT * FROM participants WHERE id = ${participantId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-updated', { participant });

  return Response.json({ participant });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { participantId } = await request.json();

  await sql`DELETE FROM participants WHERE id = ${participantId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('participant-removed', { participantId });

  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Create columns route**

```typescript
// app/api/boards/[boardId]/columns/route.ts
import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { id, title, description, color, position } = await request.json();

  await sql`
    INSERT INTO columns (id, board_id, title, description, color, position)
    VALUES (${id}, ${boardId}, ${title}, ${description}, ${color}, ${position})
  `;

  const [column] = await sql`SELECT * FROM columns WHERE id = ${id}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('column-created', { column });

  return Response.json({ column });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { columnId, updates } = await request.json();

  // Update each field individually
  if (updates.title !== undefined) {
    await sql`UPDATE columns SET title = ${updates.title} WHERE id = ${columnId}`;
  }
  if (updates.color !== undefined) {
    await sql`UPDATE columns SET color = ${updates.color} WHERE id = ${columnId}`;
  }
  if (updates.description !== undefined) {
    await sql`UPDATE columns SET description = ${updates.description} WHERE id = ${columnId}`;
  }

  const [column] = await sql`SELECT * FROM columns WHERE id = ${columnId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('column-updated', { column });

  return Response.json({ column });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { columnId } = await request.json();

  await sql`DELETE FROM columns WHERE id = ${columnId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('column-deleted', { columnId });

  return Response.json({ ok: true });
}
```

- [ ] **Step 6: Create cards route**

```typescript
// app/api/boards/[boardId]/cards/route.ts
import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { id, columnId, text, authorName, authorId, position } = await request.json();

  await sql`
    INSERT INTO cards (id, column_id, board_id, text, author_name, author_id, position)
    VALUES (${id}, ${columnId}, ${boardId}, ${text}, ${authorName}, ${authorId}, ${position})
  `;

  const [card] = await sql`SELECT * FROM cards WHERE id = ${id}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('card-created', { card });

  return Response.json({ card });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { cardId, updates } = await request.json();

  // Handle each possible update field
  if (updates.text !== undefined) {
    await sql`UPDATE cards SET text = ${updates.text} WHERE id = ${cardId}`;
  }
  if (updates.color !== undefined) {
    await sql`UPDATE cards SET color = ${updates.color} WHERE id = ${cardId}`;
  }
  if (updates.column_id !== undefined) {
    await sql`UPDATE cards SET column_id = ${updates.column_id} WHERE id = ${cardId}`;
  }
  if (updates.position !== undefined) {
    await sql`UPDATE cards SET position = ${updates.position} WHERE id = ${cardId}`;
  }
  if (updates.merged_with !== undefined) {
    await sql`UPDATE cards SET merged_with = ${updates.merged_with} WHERE id = ${cardId}`;
  }

  const [card] = await sql`SELECT * FROM cards WHERE id = ${cardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('card-updated', { card });

  return Response.json({ card });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { cardId } = await request.json();

  await sql`DELETE FROM cards WHERE id = ${cardId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('card-deleted', { cardId });

  return Response.json({ ok: true });
}
```

- [ ] **Step 7: Create votes route**

```typescript
// app/api/boards/[boardId]/votes/route.ts
import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { cardId, voterId } = await request.json();

  // Check if vote exists (toggle)
  const existing = await sql`
    SELECT id FROM votes WHERE card_id = ${cardId} AND voter_id = ${voterId}
  `;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);

  if (existing.length > 0) {
    // Remove vote
    await sql`DELETE FROM votes WHERE id = ${existing[0].id}`;
    await channel.publish('vote-removed', { voteId: existing[0].id, cardId, voterId });
    return Response.json({ action: 'removed', voteId: existing[0].id });
  } else {
    // Enforce vote limit
    const [board] = await sql`SELECT settings FROM boards WHERE id = ${boardId}`;
    const maxVotes = board?.settings?.max_votes_per_participant ?? 99;
    const myVotes = await sql`SELECT count(*) as cnt FROM votes WHERE board_id = ${boardId} AND voter_id = ${voterId}`;
    if (Number(myVotes[0].cnt) >= maxVotes) {
      return Response.json({ error: 'Vote limit reached' }, { status: 429 });
    }

    // Add vote
    const [vote] = await sql`
      INSERT INTO votes (card_id, board_id, voter_id)
      VALUES (${cardId}, ${boardId}, ${voterId})
      RETURNING *
    `;
    await channel.publish('vote-cast', { vote });
    return Response.json({ action: 'added', vote });
  }
}
```

- [ ] **Step 8: Create action items route**

```typescript
// app/api/boards/[boardId]/action-items/route.ts
import { sql } from '@/lib/db';
import { ablyServer } from '@/lib/ably-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { description, assignee, dueDate } = await request.json();

  const [item] = await sql`
    INSERT INTO action_items (board_id, description, assignee, due_date)
    VALUES (${boardId}, ${description}, ${assignee}, ${dueDate})
    RETURNING *
  `;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-created', { item });

  return Response.json({ item });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { itemId, updates } = await request.json();

  if (updates.description !== undefined) {
    await sql`UPDATE action_items SET description = ${updates.description} WHERE id = ${itemId}`;
  }
  if (updates.assignee !== undefined) {
    await sql`UPDATE action_items SET assignee = ${updates.assignee} WHERE id = ${itemId}`;
  }
  if (updates.due_date !== undefined) {
    await sql`UPDATE action_items SET due_date = ${updates.due_date} WHERE id = ${itemId}`;
  }
  if (updates.status !== undefined) {
    await sql`UPDATE action_items SET status = ${updates.status} WHERE id = ${itemId}`;
  }

  const [item] = await sql`SELECT * FROM action_items WHERE id = ${itemId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-updated', { item });

  return Response.json({ item });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const { itemId } = await request.json();

  await sql`DELETE FROM action_items WHERE id = ${itemId}`;

  const channel = ablyServer.channels.get(`retro-board:${boardId}`);
  await channel.publish('action-item-deleted', { itemId });

  return Response.json({ ok: true });
}
```

- [ ] **Step 9: Commit**

```
feat: add all board CRUD API routes with Neon + Ably
```

---

### Task 13: Rewrite boardStore to use API routes + Ably

**Files:**
- Modify: `stores/boardStore.ts`

This is the biggest single task. The store changes from calling Supabase directly to:
1. CRUD methods → `fetch()` to API routes
2. `subscribeToBoard()` → removed (replaced by Ably `useChannel` hooks in components)
3. Optimistic update pattern stays the same

- [ ] **Step 1: Rewrite boardStore — remove all Supabase imports, use fetch()**

Replace the entire store. Key changes:
- Remove `import { supabase }`
- All methods use `fetch('/api/boards/...')` instead of `supabase.from(...)`
- Remove `subscribeToBoard()` entirely (realtime is now handled by Ably hooks in components)
- Keep all optimistic update logic
- Keep the same state shape and interface

The store becomes a pure "data + optimistic update" layer. Realtime sync is handled separately by `useBoardChannel` hook (next task).

- [ ] **Step 2: Commit**

```
feat: rewrite boardStore to use API routes instead of Supabase
```

---

### Task 14: Create useBoardChannel hook for Ably realtime sync

**Files:**
- Create: `hooks/useBoardChannel.ts`

This hook replaces the old `subscribeToBoard()` method. It subscribes to Ably events and updates the Zustand store.

- [ ] **Step 1: Create the hook**

```typescript
// hooks/useBoardChannel.ts
'use client';

import { useChannel } from 'ably/react';
import { useBoardStore } from '@/stores/boardStore';
import type { Card, Column, Vote, Participant, ActionItem, Board } from '@/types';

export function useBoardChannel(boardId: string) {
  const store = useBoardStore;

  useChannel({ channelName: `retro-board:${boardId}` }, (message) => {
    const { name, data } = message;

    switch (name) {
      // Cards
      case 'card-created':
        store.setState((state) => {
          if (state.cards.some((c) => c.id === data.card.id)) return state;
          return { cards: [...state.cards, data.card as Card] };
        });
        break;
      case 'card-updated':
        store.setState((state) => ({
          cards: state.cards.map((c) => c.id === data.card.id ? (data.card as Card) : c),
        }));
        break;
      case 'card-deleted':
        store.setState((state) => ({
          cards: state.cards.filter((c) => c.id !== data.cardId),
          votes: state.votes.filter((v) => v.card_id !== data.cardId),
        }));
        break;

      // Columns
      case 'column-created':
        store.setState((state) => {
          if (state.columns.some((c) => c.id === data.column.id)) return state;
          return { columns: [...state.columns, data.column as Column] };
        });
        break;
      case 'column-updated':
        store.setState((state) => ({
          columns: state.columns.map((c) => c.id === data.column.id ? (data.column as Column) : c),
        }));
        break;
      case 'column-deleted':
        store.setState((state) => ({
          columns: state.columns.filter((c) => c.id !== data.columnId),
          cards: state.cards.filter((c) => c.column_id !== data.columnId),
        }));
        break;

      // Votes
      case 'vote-cast':
        store.setState((state) => {
          if (state.votes.some((v) => v.id === data.vote.id)) return state;
          return { votes: [...state.votes, data.vote as Vote] };
        });
        break;
      case 'vote-removed':
        store.setState((state) => ({
          votes: state.votes.filter((v) => v.id !== data.voteId),
        }));
        break;

      // Participants
      case 'participant-joined':
        store.setState((state) => {
          if (state.participants.some((p) => p.id === data.participant.id)) return state;
          return { participants: [...state.participants, data.participant as Participant] };
        });
        break;
      case 'participant-updated':
        store.setState((state) => ({
          participants: state.participants.map((p) =>
            p.id === data.participant.id ? (data.participant as Participant) : p
          ),
        }));
        break;
      case 'participant-removed':
        store.setState((state) => ({
          participants: state.participants.filter((p) => p.id !== data.participantId),
        }));
        break;

      // Board state
      case 'board-updated':
        store.setState((state) => ({
          board: state.board ? { ...state.board, settings: data.settings } : null,
        }));
        break;
      case 'board-completed':
        store.setState((state) => ({
          board: state.board
            ? { ...state.board, archived_at: data.archivedAt, settings: data.settings }
            : null,
        }));
        break;

      // Action Items
      case 'action-item-created':
        store.setState((state) => {
          if (state.actionItems.some((a) => a.id === data.item.id)) return state;
          return { actionItems: [...state.actionItems, data.item as ActionItem] };
        });
        break;
      case 'action-item-updated':
        store.setState((state) => ({
          actionItems: state.actionItems.map((a) =>
            a.id === data.item.id ? (data.item as ActionItem) : a
          ),
        }));
        break;
      case 'action-item-deleted':
        store.setState((state) => ({
          actionItems: state.actionItems.filter((a) => a.id !== data.itemId),
        }));
        break;
    }
  });
}
```

- [ ] **Step 2: Commit**

```
feat: add useBoardChannel hook for Ably realtime sync
```

---

## Chunk 5: Migrate Pages to Next.js App Router

### Task 15: Migrate HomePage

**Files:**
- Modify: `app/page.tsx`
- Move: `pages/HomePage.tsx` → referenced as component from `app/page.tsx`

- [ ] **Step 1: Convert HomePage to client component and mount in app/page.tsx**

The existing HomePage component has client-side state (board creation form, template selection). Wrap it as a client component in the App Router page.

```typescript
// app/page.tsx
import { HomePage } from '@/components/pages/HomePage';

export default function Home() {
  return <HomePage />;
}
```

Move `src/pages/HomePage.tsx` → `components/pages/HomePage.tsx`, add `'use client'` directive, and update imports:
- Replace `react-router-dom` navigation with `next/navigation` (`useRouter().push()`)
- Remove any Supabase imports (board creation now goes through the store which calls API routes)

- [ ] **Step 2: Commit**

```
feat: migrate HomePage to Next.js App Router
```

---

### Task 16: Migrate BoardPage

**Files:**
- Create: `app/board/[boardId]/page.tsx`
- Move: `pages/BoardPage.tsx` → `components/pages/BoardPage.tsx`

- [ ] **Step 1: Create the App Router page with AblyProvider wrapper**

```typescript
// app/board/[boardId]/page.tsx
import { BoardPageWrapper } from '@/components/pages/BoardPageWrapper';

export default async function BoardRoute({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  return <BoardPageWrapper boardId={boardId} />;
}
```

```typescript
// components/pages/BoardPageWrapper.tsx
'use client';

import { AblyProvider } from '@/components/providers/AblyProvider';
import { BoardPage } from '@/components/pages/BoardPage';
import { useBoardStore } from '@/stores/boardStore';
import { useBoardChannel } from '@/hooks/useBoardChannel';
import { usePresence } from '@/hooks/usePresence';

export function BoardPageWrapper({ boardId }: { boardId: string }) {
  const currentParticipantId = useBoardStore((s) => s.currentParticipantId);

  // If no participant yet (join modal showing), render without Ably
  if (!currentParticipantId) {
    return <BoardPage boardId={boardId} />;
  }

  return (
    <AblyProvider clientId={currentParticipantId}>
      <BoardPageInner boardId={boardId} />
    </AblyProvider>
  );
}

function BoardPageInner({ boardId }: { boardId: string }) {
  const currentParticipantId = useBoardStore((s) => s.currentParticipantId);

  // Set up realtime subscriptions
  useBoardChannel(boardId);
  usePresence(boardId, currentParticipantId);

  return <BoardPage boardId={boardId} />;
}
```

- [ ] **Step 2: Migrate BoardPage component**

Move `src/pages/BoardPage.tsx` → `components/pages/BoardPage.tsx`:
- Add `'use client'` directive
- Replace `useParams()` from react-router-dom with `boardId` prop
- Replace `useSearchParams()` from react-router-dom with `next/navigation`
- Remove `subscribeToBoard()` call (now handled by `useBoardChannel` in wrapper)
- Remove `usePresence()` call (now handled in wrapper)
- Keep all other logic the same

- [ ] **Step 3: Commit**

```
feat: migrate BoardPage to Next.js App Router with Ably
```

---

### Task 17: Migrate Admin pages

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/features/page.tsx`
- Create: `app/admin/boards/page.tsx`
- Create: `app/admin/settings/page.tsx`
- Move: admin components to `components/pages/admin/`

- [ ] **Step 1: Create admin layout**

```typescript
// app/admin/layout.tsx
import { AdminLayoutWrapper } from '@/components/pages/admin/AdminLayoutWrapper';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
```

- [ ] **Step 2: Create admin page routes**

Each page is a thin wrapper around the existing component:

```typescript
// app/admin/page.tsx
import { AdminDashboardPage } from '@/components/pages/admin/AdminDashboardPage';
export default function AdminDashboard() { return <AdminDashboardPage />; }
```

Repeat for features, boards, settings.

- [ ] **Step 3: Migrate admin components**

Move all admin pages from `src/pages/admin/` → `components/pages/admin/`:
- Add `'use client'` directives
- Replace react-router-dom navigation with next/navigation
- Replace Supabase calls with fetch() to admin API routes

- [ ] **Step 4: Create admin API routes**

```typescript
// app/api/admin/feature-flags/route.ts
// app/api/admin/app-settings/route.ts
// app/api/admin/boards/route.ts
```

These mirror the existing featureFlagStore/appSettingsStore Supabase calls but as server-side API routes.

- [ ] **Step 5: Rewrite featureFlagStore and appSettingsStore**

Replace Supabase calls with fetch() to the new admin API routes.

- [ ] **Step 6: Create public feature flags route**

```typescript
// app/api/feature-flags/route.ts
import { sql } from '@/lib/db';

export async function GET() {
  const flags = await sql`SELECT * FROM feature_flags ORDER BY created_at`;
  return Response.json({ flags });
}
```

- [ ] **Step 7: Commit**

```
feat: migrate admin pages to Next.js App Router
```

---

### Task 18: Create not-found page

**Files:**
- Create: `app/not-found.tsx`

- [ ] **Step 1: Create 404 page**

Move `src/pages/NotFoundPage.tsx` → `app/not-found.tsx` as a server component, or reference the existing component.

- [ ] **Step 2: Commit**

```
feat: add not-found page
```

---

## Chunk 6: Cleanup

### Task 19: Remove Supabase and old dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Uninstall Supabase and react-router-dom packages**

```bash
npm uninstall @supabase/supabase-js @supabase/ssr
npm uninstall react-router-dom
```

- [ ] **Step 2: Remove old env vars from `.env.example`**

Remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 3: Grep for any remaining Supabase/react-router imports**

```bash
grep -r "supabase" --include="*.ts" --include="*.tsx" -l
grep -r "react-router" --include="*.ts" --include="*.tsx" -l
```

Fix any remaining references.

- [ ] **Step 4: Verify clean build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```
feat: remove Supabase and react-router-dom dependencies
```

---

## Chunk 7: End-to-End Verification

### Task 20: Smoke test all features

- [ ] **Step 1: Start dev server and test home page**

```bash
npm run dev
```

Open http://localhost:3000 — create a board with a template.

- [ ] **Step 2: Test board collaboration**

Open the board URL in two browser tabs:
- Tab 1: Create cards, edit text, change colors
- Tab 2: Verify cards appear in real-time via Ably
- Both tabs: Verify presence (avatar stack shows both participants)

- [ ] **Step 3: Test voting**

- Cast votes in both tabs
- Verify vote counts update in real-time
- Verify vote limit enforcement

- [ ] **Step 4: Test timer**

- Start timer from facilitator tab
- Verify countdown syncs to participant tab
- Verify pause/resume/reset sync

- [ ] **Step 5: Test facilitator controls**

- Lock/unlock board
- Reveal/hide cards
- Complete retro (archive)

- [ ] **Step 6: Test admin console**

- Log in at /login
- Navigate to /admin
- Toggle feature flags
- View boards list
- Update app settings

- [ ] **Step 7: Test production build**

```bash
npm run build && npm start
```

Repeat smoke tests against production build.

- [ ] **Step 8: Final commit**

```
chore: verify migration complete — all features working on Neon + Better Auth + Ably
```

---

## Summary

| Chunk | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-5 | Framework migration (Vite → Next.js) + file moves + Neon database |
| 2 | 6-8 | Better Auth setup (server, client, authStore) |
| 3 | 9-11 | Ably setup + presence + timer hooks |
| 4 | 12-14 | Board API routes + store rewrite + realtime channel hook |
| 5 | 15-18 | Migrate all pages to App Router |
| 6 | 19 | Remove Supabase and old dependencies |
| 7 | 20 | End-to-end smoke testing |

**Total: 20 tasks across 7 chunks**

**Critical path:** Chunk 1 → 2 → 3 → 4 (sequential, each depends on prior). Chunks 5-6 can partially overlap with Chunk 4.
