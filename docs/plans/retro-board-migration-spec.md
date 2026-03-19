# Retro Board Migration: Supabase → Neon + Better Auth + Ably

## Context

The Retro Board is a live collaborative retrospective tool used by your CFA work team. It currently runs on Supabase (Auth, PostgreSQL, Realtime) and has known bugs where Supabase Realtime's broadcast channel falls back to REST instead of WebSocket delivery, causing presence, timer, and card reveal events to arrive late or out of order.

This migration moves the entire project off Supabase onto the new default stack: Neon (database), Better Auth (authentication), Ably (realtime), deployed on Vercel.

---

## What maps where

| Current (Supabase) | New stack | Notes |
|---|---|---|
| Supabase Auth | Better Auth | Sessions stored in Neon. Migration script available. |
| Supabase PostgreSQL | Neon | Standard Postgres. pg_dump/restore or Prisma migrate. |
| Supabase Realtime (presence) | Ably `usePresence` / `usePresenceListener` | Built-in React hooks. No custom WebSocket code. |
| Supabase Realtime (broadcast) | Ably `useChannel` / `publish` | Timer ticks, card reveal, board lock signals. |
| Supabase Realtime (postgres changes) | Ably `publish` from API routes | You publish events explicitly after DB writes. |
| Supabase RLS (`auth.uid()`) | Better Auth session + middleware | Verify session in API routes, pass userId to queries. |
| Supabase client SDK | `@neondatabase/serverless` + `ably/react` + `better-auth` | Three imports instead of one, but each does its job well. |

---

## Database migration (Supabase → Neon)

### Step 1: Create Neon project

1. Go to https://console.neon.tech
2. Create project: "retro-board"
3. Copy the connection string

### Step 2: Export from Supabase

If using Prisma:
```bash
# Your existing Prisma schema already defines the structure.
# Point DATABASE_URL to Neon and run:
npx prisma migrate deploy
```

If doing a raw migration:
```bash
# Export from Supabase (get connection string from Supabase dashboard > Settings > Database)
pg_dump "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" \
  --schema=public \
  --no-owner \
  --no-privileges \
  > retro-board-export.sql

# Import to Neon
psql "postgresql://[user]:[password]@[endpoint].neon.tech/neondb?sslmode=require" \
  < retro-board-export.sql
```

### Step 3: Update environment variables

```env
# Remove
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Add
DATABASE_URL="postgresql://[user]:[password]@[endpoint].neon.tech/neondb?sslmode=require"
```

---

## Auth migration (Supabase Auth → Better Auth)

### Step 1: Install

```bash
npm install better-auth
```

### Step 2: Configure auth server

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { Pool } from "@neondatabase/serverless";

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: {
    enabled: true,
  },
  // Add social providers as needed
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});
```

### Step 3: Create API route

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

### Step 4: Create auth client

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});
```

### Step 5: Migrate existing users

If the retro board has existing Supabase Auth users you need to preserve:

```typescript
// scripts/migrate-users.ts
// Better Auth has a published migration guide from Supabase Auth:
// https://better-auth.com/docs/guides/supabase-migration-guide
//
// Key steps:
// 1. Export users from Supabase auth.users table
// 2. Insert into Better Auth's user/account tables in Neon
// 3. Note: Supabase uses bcrypt for passwords, configure Better Auth to use bcrypt
```

If the team uses magic links or OAuth only (no passwords), migration is simpler. Just create new Better Auth sessions on first login. Users re-authenticate once and they're done.

### Step 6: Protect routes

```typescript
// middleware.ts
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/board/:path*", "/dashboard/:path*"],
};
```

---

## Realtime migration (Supabase Realtime → Ably)

This is the core of the migration. The Retro Board has 6 realtime features. Here's how each one maps to Ably.

### Step 1: Install and configure Ably

```bash
npm install ably
```

```env
NEXT_PUBLIC_ABLY_API_KEY=your-ably-api-key
# Get this from https://ably.com/dashboard after creating a free account
```

### Step 2: Set up Ably provider

```typescript
// components/providers/AblyProvider.tsx
'use client';
import * as Ably from 'ably';
import { AblyProvider } from 'ably/react';

// Create client OUTSIDE the component to prevent re-creation on re-renders
const client = new Ably.Realtime({
  key: process.env.NEXT_PUBLIC_ABLY_API_KEY!,
  clientId: 'will-be-set-after-auth', // see step 3
});

export function AblyRealtimeProvider({ children }: { children: React.ReactNode }) {
  return (
    <AblyProvider client={client}>
      {children}
    </AblyProvider>
  );
}
```

### Step 3: Authenticate Ably with your user identity

For production, use token auth so your API key isn't exposed to clients:

```typescript
// app/api/ably-token/route.ts
import Ably from 'ably';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response('Unauthorized', { status: 401 });

  const client = new Ably.Rest(process.env.ABLY_API_KEY!);
  const tokenRequest = await client.auth.createTokenRequest({
    clientId: session.user.id,
  });

  return Response.json(tokenRequest);
}
```

```typescript
// Updated AblyProvider using token auth
const client = new Ably.Realtime({
  authUrl: '/api/ably-token',
  authMethod: 'GET',
});
```

### Step 4: Channel naming convention

```
retro-board:{boardId}           → card events, vote events, board state changes
retro-board:{boardId}:timer     → timer ticks (high frequency, separate channel)
```

---

## Feature-by-feature migration

### Feature 1: Presence (who's on the board)

**Before (Supabase):**
```typescript
// Old: Supabase channel presence
const channel = supabase.channel(`board-${boardId}`);
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  setParticipants(Object.values(state).flat());
});
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({ user_id: userId, name: userName, avatar: avatarUrl });
  }
});
```

**After (Ably):**
```typescript
// New: Ably presence with React hooks
import { usePresence, usePresenceListener } from 'ably/react';
import { ChannelProvider } from 'ably/react';

function BoardWrapper({ boardId }: { boardId: string }) {
  return (
    <ChannelProvider channelName={`retro-board:${boardId}`}>
      <Board boardId={boardId} />
    </ChannelProvider>
  );
}

function Board({ boardId }: { boardId: string }) {
  // Enter presence with user data
  const { updateStatus } = usePresence(
    { channelName: `retro-board:${boardId}` },
    { name: userName, avatar: avatarUrl, role: 'participant' }
  );

  // Subscribe to others' presence
  const { presenceData } = usePresenceListener({ channelName: `retro-board:${boardId}` });

  const participants = presenceData.map(member => ({
    userId: member.clientId,
    name: member.data?.name,
    avatar: member.data?.avatar,
    role: member.data?.role,
  }));

  return (
    <div>
      <AvatarStack participants={participants} />
      {/* ... rest of board UI */}
    </div>
  );
}
```

### Feature 2: Live card sync (create, edit, delete, move)

**Pattern: Write to Neon via API route, then publish event to Ably.**

```typescript
// app/api/boards/[boardId]/cards/route.ts
import { neon } from '@neondatabase/serverless';
import Ably from 'ably';

const sql = neon(process.env.DATABASE_URL!);
const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

export async function POST(request: Request, { params }: { params: { boardId: string } }) {
  const body = await request.json();
  const { boardId } = params;

  // 1. Write to database
  const [card] = await sql`
    INSERT INTO cards (board_id, column_id, content, author_id, created_at)
    VALUES (${boardId}, ${body.columnId}, ${body.content}, ${body.authorId}, NOW())
    RETURNING *
  `;

  // 2. Publish event to Ably
  const channel = ably.channels.get(`retro-board:${boardId}`);
  await channel.publish('card-created', {
    card,
    authorId: body.authorId,
  });

  return Response.json({ card });
}
```

```typescript
// components/Board.tsx (client-side listener)
import { useChannel } from 'ably/react';

function Board({ boardId }: { boardId: string }) {
  const [cards, setCards] = useState<Card[]>(initialCards);

  // Subscribe to card events
  useChannel({ channelName: `retro-board:${boardId}` }, 'card-created', (message) => {
    setCards(prev => [...prev, message.data.card]);
  });

  useChannel({ channelName: `retro-board:${boardId}` }, 'card-updated', (message) => {
    setCards(prev =>
      prev.map(c => c.id === message.data.card.id ? message.data.card : c)
    );
  });

  useChannel({ channelName: `retro-board:${boardId}` }, 'card-deleted', (message) => {
    setCards(prev => prev.filter(c => c.id !== message.data.cardId));
  });

  // Optimistic create
  const createCard = async (columnId: string, content: string) => {
    const tempId = crypto.randomUUID();
    const optimistic = { id: tempId, column_id: columnId, content, author_id: userId };

    setCards(prev => [...prev, optimistic]); // instant UI update

    const res = await fetch(`/api/boards/${boardId}/cards`, {
      method: 'POST',
      body: JSON.stringify({ columnId, content, authorId: userId }),
    });
    const { card } = await res.json();

    // Replace optimistic with real
    setCards(prev => prev.map(c => c.id === tempId ? card : c));
    // Other users get the card via the Ably subscription above
  };

  return (/* render columns and cards */);
}
```

### Feature 3: Voting

Same pattern as cards. Write to Neon, publish to Ably.

```typescript
// API route publishes:
await channel.publish('vote-cast', { cardId, userId, voteCount: newCount });

// Client subscribes:
useChannel({ channelName: `retro-board:${boardId}` }, 'vote-cast', (message) => {
  setCards(prev =>
    prev.map(c => c.id === message.data.cardId
      ? { ...c, votes: message.data.voteCount }
      : c
    )
  );
});
```

### Feature 4: Card reveal/obfuscation

```typescript
// Admin toggles reveal → API route:
await channel.publish('cards-revealed', { revealed: true, revealedColumns: ['all'] });

// All clients:
useChannel({ channelName: `retro-board:${boardId}` }, 'cards-revealed', (message) => {
  setRevealed(message.data.revealed);
  setRevealedColumns(message.data.revealedColumns);
});
```

### Feature 5: Timer sync

Timer is high-frequency (ticks every second). Use a separate channel and broadcast from the admin only.

```typescript
// Admin's browser runs the timer and publishes ticks
function useTimerAdmin(boardId: string) {
  const { channel } = useChannel({ channelName: `retro-board:${boardId}:timer` });

  const startTimer = (durationSeconds: number) => {
    let remaining = durationSeconds;

    const interval = setInterval(() => {
      remaining--;
      channel?.publish('tick', { remaining, total: durationSeconds });

      if (remaining <= 0) {
        clearInterval(interval);
        channel?.publish('timer-complete', {});
      }
    }, 1000);
  };

  return { startTimer };
}

// All participants receive ticks
function useTimerListener(boardId: string) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useChannel({ channelName: `retro-board:${boardId}:timer` }, 'tick', (message) => {
    setRemaining(message.data.remaining);
    setTotal(message.data.total);
  });

  useChannel({ channelName: `retro-board:${boardId}:timer` }, 'timer-complete', () => {
    setRemaining(0);
  });

  return { remaining, total };
}
```

### Feature 6: Board lock/unlock

```typescript
// Admin locks/unlocks:
await channel.publish('board-state', { locked: true });

// All participants:
useChannel({ channelName: `retro-board:${boardId}` }, 'board-state', (message) => {
  setBoardLocked(message.data.locked);
});
```

---

## Migration order (do it in this sequence)

### Phase 1: Database (30 min)
1. Create Neon project
2. Run Prisma migrate or pg_dump/restore
3. Update DATABASE_URL in Vercel env vars
4. Verify board data loads correctly

### Phase 2: Auth (1-2 hours)
1. Install Better Auth
2. Create auth config, API route, and client
3. Build login/signup page (or adapt existing)
4. Update middleware for route protection
5. Replace all `supabase.auth.getUser()` calls with Better Auth session checks
6. Test: can users log in and see their boards?

### Phase 3: Realtime - Presence (1 hour)
1. Create Ably account + get API key
2. Install ably SDK
3. Set up AblyProvider + token auth route
4. Replace Supabase presence with usePresence/usePresenceListener
5. Open two browser tabs. Verify both users see each other in the avatar stack.
6. This is your confidence checkpoint. If presence works, everything else will too.

### Phase 4: Realtime - Cards (1-2 hours)
1. Create API routes for card CRUD that write to Neon + publish to Ably
2. Replace Supabase realtime card subscriptions with useChannel hooks
3. Add optimistic updates for card creation
4. Test: create a card in one tab, verify it appears in the other tab instantly

### Phase 5: Realtime - Voting, Reveal, Lock (1 hour)
1. Same pattern as cards for each feature
2. API route writes to Neon + publishes to Ably
3. Client subscribes via useChannel
4. Test each one in two browser tabs

### Phase 6: Realtime - Timer (30 min)
1. Admin broadcasts ticks via useChannel publish
2. Participants receive via useChannel subscribe
3. Test: start timer in admin tab, verify countdown in participant tab

### Phase 7: Cleanup (30 min)
1. Remove all `@supabase/supabase-js` imports
2. Remove all Supabase env vars
3. Uninstall `@supabase/supabase-js` and `@supabase/ssr`
4. Delete the Supabase project (or pause it)
5. Deploy to Vercel

---

## Environment variables (final state)

```env
# Neon
DATABASE_URL="postgresql://[user]:[password]@[endpoint].neon.tech/neondb?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET="generate-a-random-secret-here"
BETTER_AUTH_URL="https://your-retro-board.vercel.app"

# Ably
ABLY_API_KEY="your-ably-api-key"  # server-side (full key with capabilities)
# Note: client uses token auth via /api/ably-token, no client-side key needed

# Google OAuth (if using social login)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Resend (for email verification / magic links)
RESEND_API_KEY="..."
```

---

## Cost after migration

| Service | Cost |
|---|---|
| Neon (12 MB database) | $0 |
| Better Auth | $0 |
| Ably (team retro tool, <10 concurrent users) | $0 |
| Vercel (hosting) | $0 (part of existing Pro plan) |
| **Total** | **$0** |

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Ably free tier: 200 concurrent connections | Your retro board has <20 concurrent users. Not a concern. |
| Ably free tier: 6M messages/month | A 1-hour retro with 10 users generates ~36K messages (timer ticks + card events + presence). You'd need 166 retros/month to hit the limit. |
| Neon cold start (~500ms) | First query after idle takes half a second. Board loads fast on subsequent queries. Acceptable for an internal tool. |
| Neon 0.5 GB storage | Current DB is 12 MB. You'd need 40x growth to hit this. |
| Better Auth is newer than Supabase Auth | For an internal team tool with <50 users, this is fine. Not enterprise auth complexity. |
| No Supabase dashboard for user management | Build a simple /admin page or query Neon directly. For a team tool, this is low priority. |

---

## CLAUDE.md context for Claude Code

Add this to your project's CLAUDE.md so Claude Code has the full picture:

```markdown
## Architecture

- **Database**: Neon (serverless Postgres, free tier)
- **Auth**: Better Auth (open source, sessions in Neon)
- **Realtime**: Ably (pub/sub + presence, free tier)
- **Hosting**: Vercel (Next.js App Router)
- **ORM**: [Prisma or Drizzle - whichever you're using]

## Realtime pattern

All realtime events flow through Ably channels.
- Channel naming: `retro-board:{boardId}` for card/vote/state events
- Timer channel: `retro-board:{boardId}:timer` for high-frequency ticks
- Presence: Ably's built-in presence on the board channel

Every mutation follows this pattern:
1. Client calls API route (optimistic update on client)
2. API route writes to Neon
3. API route publishes event to Ably channel
4. All subscribed clients receive the event via useChannel hook

## Auth pattern

Better Auth handles sessions. All API routes verify session via:
```typescript
const session = await auth.api.getSession({ headers: request.headers });
```

## Key files

- `lib/auth.ts` - Better Auth server config
- `lib/auth-client.ts` - Better Auth client
- `app/api/auth/[...all]/route.ts` - Auth API routes
- `app/api/ably-token/route.ts` - Ably token auth
- `components/providers/AblyProvider.tsx` - Ably React provider
```
