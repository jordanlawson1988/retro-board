# Migration Learnings: Supabase → Neon + Better Auth + Ably

**Project:** RetroBoard
**Date:** 2026-03-19
**Scope:** Full-stack migration — Vite SPA to Next.js App Router, Supabase to Neon/Better Auth/Ably

---

## 1. The Ably Echo Duplication Problem

**The single biggest issue in this migration.** Affected cards, columns, votes, and action items.

### What happened

When a client performs a mutation (e.g., create a card), the flow is:

1. Client sends `fetch()` to API route
2. API route writes to Neon DB
3. API route publishes event to Ably channel
4. **All clients** on that channel receive the event — including the originator

If the originating client adds the item to local state **after** the fetch returns, the Ably echo arrives first and adds it, then the post-fetch state update adds it again. Result: every item appears twice.

### The fix pattern

**All optimistic updates must happen BEFORE the fetch, not after.**

```typescript
// WRONG — causes duplication
const res = await fetch('/api/cards', { method: 'POST', body });
set((state) => ({ cards: [...state.cards, newCard] })); // Ably already added it!

// RIGHT — Ably dedup guard catches the echo
set((state) => ({ cards: [...state.cards, newCard] })); // Add immediately
const res = await fetch('/api/cards', { method: 'POST', body });
if (!res.ok) {
  set((state) => ({ cards: state.cards.filter(c => c.id !== newCard.id) })); // Revert
}
```

The Ably channel listener must have a dedup guard:
```typescript
case 'card-created':
  store.setState((state) => {
    if (state.cards.some((c) => c.id === data.card.id)) return state; // Dedup!
    return { cards: [...state.cards, data.card] };
  });
```

### Critical: IDs must match between client and server

For dedup to work, the client-generated ID must be the same ID stored in the database. If the server generates a different ID (e.g., `gen_random_uuid()` for votes), the dedup guard compares different IDs and fails.

**Rule:** Always send the client-generated ID to the server. Let the client own ID generation.

```typescript
// Client
const voteId = crypto.randomUUID();
set((state) => ({ votes: [...state.votes, { id: voteId, ... }] }));
await fetch('/api/votes', { body: JSON.stringify({ voteId, ... }) });

// Server
await sql`INSERT INTO votes (id, ...) VALUES (${voteId}, ...)`;
await channel.publish('vote-cast', { vote }); // vote.id === voteId
```

For entities where the server must generate the ID (e.g., action items with no client-side add), skip the optimistic add entirely and rely on the Ably event to add it.

### Applicability to other projects

**This applies to ANY architecture where:**
- Mutations go through a server
- The server publishes events to a realtime channel
- The originating client is subscribed to that channel

This includes: Ably, Pusher, Socket.IO, any WebSocket pub/sub, Firebase Realtime Database, Supabase Realtime with explicit publish.

---

## 2. Next.js SSR + Client State (Zustand/useSyncExternalStore)

### Problem

`useSyncExternalStore` requires a `getServerSnapshot` parameter for SSR. Without it, Next.js throws `Missing getServerSnapshot`. This affects any custom hook using `useSyncExternalStore` directly (not through Zustand — Zustand handles this internally).

### Fix

```typescript
// WRONG
const theme = useSyncExternalStore(subscribe, getSnapshot);

// RIGHT
const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'system' as Theme);
```

### The theme flash problem

Even with `getServerSnapshot`, the server renders one theme (e.g., `system`) but the client may have `dark` in localStorage. This causes a flash of wrong theme and a hydration mismatch.

**Fix:** Use a blocking inline `<script>` in `<head>` that reads localStorage before React hydrates:

```typescript
// app/layout.tsx
<html lang="en" data-theme="system" suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{ __html: `
      (function(){try{var t=localStorage.getItem('retro-theme');
      if(t==='light'||t==='dark'||t==='system')
      document.documentElement.setAttribute('data-theme',t)}catch(e){}})()
    `}} />
  </head>
```

### Applicability

Any Next.js App Router project with client-side theme switching. This is the standard pattern used by next-themes and similar libraries.

---

## 3. Ably Provider Scoping

### Problem

Ably React hooks (`useChannel`, `usePresence`) require an `AblyProvider` ancestor in the component tree. If a component using these hooks renders outside the provider, it crashes with `Cannot read properties of undefined (reading 'client')`.

### What happened

The BoardPage component used `useTimer` (which calls `useChannel`) but rendered both inside and outside the AblyProvider:
- Pre-join (no participant ID yet): no AblyProvider, crash
- Post-join: AblyProvider present, works

### Fix

Split the page into a wrapper that handles pre-join state (loading, join modal) WITHOUT Ably, and an inner component that renders inside the provider:

```typescript
function BoardPageWrapper({ boardId }) {
  const participantId = useBoardStore(s => s.currentParticipantId);

  if (!participantId) {
    return <JoinModal />; // No Ably hooks here
  }

  return (
    <AblyProvider clientId={participantId}>
      <ChannelProvider channelName={`board:${boardId}`}>
        <BoardPageInner boardId={boardId} /> {/* Ably hooks safe here */}
      </ChannelProvider>
    </AblyProvider>
  );
}
```

### Applicability

Any project using Ably (or similar provider-based realtime libraries) where components have conditional rendering states. The provider must only wrap the tree where hooks are actually called.

---

## 4. Vite → Next.js Path Alias Timing

### Problem

Vite uses `@/` → `./src/*`. Next.js convention is `@/` → `./*`. If you change the alias before moving the files, every import breaks.

### Fix

Move files from `src/` to project root EARLY in the migration (Task 2), not at the end. The sequence:

1. Install Next.js, keep `@/` → `./src/*` temporarily
2. Move all files from `src/` to root
3. Update alias to `@/` → `./*`
4. Continue with remaining tasks

### Applicability

Any Vite → Next.js migration. Plan the file moves as the first structural change.

---

## 5. `'use client'` Directives at Scale

### What to know

When moving from Vite (everything is client by default) to Next.js App Router (everything is server by default), you need `'use client'` on:

- Every component that uses hooks (useState, useEffect, useCallback, etc.)
- Every file that uses browser APIs (localStorage, window, document)
- Every Zustand store
- Every custom hook

You do NOT need it on:
- Type definition files (`types/index.ts`)
- Pure utility functions (`utils/cn.ts`, `utils/export.ts`)
- Barrel export files (`index.ts` that just re-export)
- CSS files

### Tip

Run this after the migration to find missed directives:
```bash
npm run build 2>&1 | grep "useState\|useEffect\|useCallback"
```

---

## 6. Next.js Pages Router Conflict

### Problem

Next.js detected `src/pages/` as a Pages Router directory and threw a fatal error because `app/` (App Router) existed alongside it.

### Fix

Renamed `src/pages/` → `src/views/` before any Next.js code ran. Then deleted it entirely when moving files to root.

### Applicability

Any migration where the source code has a `pages/` directory that isn't meant for Next.js Pages Router.

---

## 7. Better Auth in Middleware (Edge Runtime)

### Problem

Better Auth's `auth.api.getSession()` uses `@neondatabase/serverless` which requires Node.js runtime. Next.js middleware runs in Edge Runtime by default, which doesn't support all Node.js APIs.

### Fix

Use a lightweight cookie-presence check in middleware instead of full session validation:

```typescript
export async function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('better-auth.session_token');
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}
```

Full session validation happens in each API route handler (Node.js runtime).

### Applicability

Any auth library that needs database access won't work in Edge Runtime middleware. Use cookie checks for redirects, full validation in API routes.

---

## 8. Migration Execution Strategy

### What worked well

- **Subagent-driven development** — fresh context per task, no confusion accumulation
- **Spec compliance reviews** after each task caught gaps early
- **Moving files early** (Task 2) prevented path resolution issues throughout
- **API routes first, then store rewrite** — the API surface was stable before the client was rewritten
- **Smoke testing after each chunk** found the SSR and Ably provider issues before they compounded

### What to do differently next time

- **Write the optimistic update pattern ONCE** and apply it consistently. The "fetch then set" pattern was the single biggest source of bugs.
- **Audit ID generation immediately** — any entity with server-generated IDs will have dedup problems with realtime echo. Decide upfront: client generates all IDs, or skip optimistic add for server-generated entities.
- **Test with Ably connected from the start**, not just API routes. The duplication bugs only appeared when Ably was actually delivering events.

---

## Summary: Rules for Realtime + Optimistic Updates

1. **Optimistic update BEFORE fetch, revert on failure**
2. **Client generates all IDs** (or skip optimistic add for server-generated IDs)
3. **Dedup guard in every realtime event handler** — check by ID before adding
4. **Ably provider only wraps components that use Ably hooks**
5. **Test with realtime connected** — API-only testing won't catch echo duplication
