# WS5-WS6: Dashboard Polish & Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the dashboard with usage tracking and onboarding. Redesign the landing page for conversion — preserving zero-friction entry while guiding engaged users toward accounts.

**Architecture:** Landing page serves both anonymous visitors (try instantly) and conversion (sign up to save). Dashboard becomes the authenticated home with board management, usage tracking, and upgrade prompts.

**Tech Stack:** Next.js 16 App Router, Zustand, Tailwind CSS 4, Lucide React

**Depends on:** WS1 (user accounts), WS2 (board ownership), WS3 (billing)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `components/Landing/Hero.tsx` | Hero section with dual CTA (try free + sign up) |
| `components/Landing/Features.tsx` | Feature showcase grid |
| `components/Landing/Pricing.tsx` | Inline pricing comparison (reuses PricingPage data) |
| `components/Landing/index.ts` | Barrel export |
| `components/Dashboard/BoardActions.tsx` | Per-board action menu (archive, delete, export) |
| `components/Dashboard/EmptyState.tsx` | Empty state with onboarding CTA |
| `components/common/Avatar.tsx` | User avatar component (initials-based) |

### Modified Files
| File | Changes |
|------|---------|
| `components/pages/HomePage.tsx` | Complete redesign for conversion landing page |
| `components/pages/DashboardPage.tsx` | Add board actions, search, bulk operations, upgraded banner |
| `app/page.tsx` | Conditional render: landing (anonymous) vs redirect (auth'd) |

---

### Task 1: Landing Page Hero Section

**Files:**
- Create: `components/Landing/Hero.tsx`

- [ ] **Step 1: Create the hero component**

```typescript
// components/Landing/Hero.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/common';
import { APP_NAME } from '@/utils/constants';

export function Hero() {
  const router = useRouter();

  return (
    <section className="flex min-h-[70vh] items-center justify-center px-4 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-gray-8)] sm:text-5xl">
          Run better retros with{' '}
          <span className="text-[var(--color-primary)]">{APP_NAME}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-gray-5)]">
          Real-time retrospective boards for teams. Create columns, add cards, vote, and turn
          insights into action items — all without requiring your team to create accounts.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={() => router.push('/signup')}>
            <Plus size={20} /> Get Started Free
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              // Scroll to create board section or open create modal
              document.getElementById('try-it')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Try Without Account <ArrowRight size={18} />
          </Button>
        </div>
        <p className="mt-4 text-sm text-[var(--color-gray-4)]">
          Free for up to 3 boards. No credit card required.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Landing/Hero.tsx
git commit -m "feat: add landing page hero section with dual CTA"
```

---

### Task 2: Features Section

**Files:**
- Create: `components/Landing/Features.tsx`

- [ ] **Step 1: Create the features showcase**

```typescript
// components/Landing/Features.tsx
'use client';

import { MessageSquare, Vote, Clock, Eye, Zap, Download } from 'lucide-react';

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Real-Time Cards',
    description: 'Add, edit, and organize cards in real-time. Everyone sees updates instantly.',
  },
  {
    icon: Vote,
    title: 'Voting & Prioritization',
    description: 'Vote on what matters most. Configurable vote limits and secret voting.',
  },
  {
    icon: Clock,
    title: 'Built-In Timer',
    description: 'Timebox discussions with a shared timer that syncs across all participants.',
  },
  {
    icon: Eye,
    title: 'Card Obfuscation',
    description: 'Hide cards until the facilitator reveals them — prevent groupthink.',
  },
  {
    icon: Zap,
    title: 'Zero-Friction Joining',
    description: 'Participants join via link. No accounts, no sign-up, no friction.',
  },
  {
    icon: Download,
    title: 'Export Anywhere',
    description: 'Download your retro as Markdown, CSV, PDF, or a screenshot image.',
  },
];

export function Features() {
  return (
    <section className="bg-[var(--color-surface)] py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-[var(--color-gray-8)]">
          Everything you need for great retros
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-navy)]/10 text-[var(--color-navy)]">
                <feature.icon size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-gray-8)]">{feature.title}</h3>
                <p className="mt-1 text-sm text-[var(--color-gray-5)]">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Landing/Features.tsx
git commit -m "feat: add features showcase section for landing page"
```

---

### Task 3: Landing Pricing Section

**Files:**
- Create: `components/Landing/Pricing.tsx`
- Create: `components/Landing/index.ts`

- [ ] **Step 1: Create inline pricing section**

```typescript
// components/Landing/Pricing.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Check, X, Zap } from 'lucide-react';
import { Button } from '@/components/common';

export function Pricing() {
  const router = useRouter();

  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-[var(--color-gray-8)]">
          Simple, transparent pricing
        </h2>
        <p className="mt-2 text-center text-[var(--color-gray-5)]">
          Start free. Upgrade when you need more.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {/* Free */}
          <div className="rounded-2xl border border-[var(--color-gray-1)] p-8">
            <h3 className="text-xl font-bold text-[var(--color-gray-8)]">Free</h3>
            <p className="mt-2 text-3xl font-bold text-[var(--color-gray-8)]">$0 <span className="text-base font-normal text-[var(--color-gray-5)]">forever</span></p>
            <ul className="mt-6 space-y-2 text-sm">
              <li className="flex items-center gap-2 text-[var(--color-gray-7)]"><Check size={14} className="text-[var(--color-success)]" /> 3 active boards</li>
              <li className="flex items-center gap-2 text-[var(--color-gray-7)]"><Check size={14} className="text-[var(--color-success)]" /> Unlimited participants</li>
              <li className="flex items-center gap-2 text-[var(--color-gray-7)]"><Check size={14} className="text-[var(--color-success)]" /> Markdown & CSV export</li>
              <li className="flex items-center gap-2 text-[var(--color-gray-4)]"><X size={14} className="text-[var(--color-gray-3)]" /> PDF & image export</li>
            </ul>
            <Button variant="secondary" className="mt-6 w-full" onClick={() => router.push('/signup')}>
              Get Started
            </Button>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-[var(--color-navy)] p-8 shadow-lg">
            <h3 className="text-xl font-bold text-[var(--color-navy)]">Pro</h3>
            <p className="mt-2 text-3xl font-bold text-[var(--color-gray-8)]">$4.99 <span className="text-base font-normal text-[var(--color-gray-5)]">/month</span></p>
            <ul className="mt-6 space-y-2 text-sm">
              <li className="flex items-center gap-2 text-[var(--color-gray-7)]"><Check size={14} className="text-[var(--color-success)]" /> Unlimited boards</li>
              <li className="flex items-center gap-2 text-[var(--color-gray-7)]"><Check size={14} className="text-[var(--color-success)]" /> Unlimited participants</li>
              <li className="flex items-center gap-2 text-[var(--color-gray-7)]"><Check size={14} className="text-[var(--color-success)]" /> All export formats</li>
              <li className="flex items-center gap-2 text-[var(--color-gray-7)]"><Check size={14} className="text-[var(--color-success)]" /> Priority support</li>
            </ul>
            <Button className="mt-6 w-full" onClick={() => router.push('/pricing')}>
              <Zap size={16} /> Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create barrel export**

```typescript
// components/Landing/index.ts
export { Hero } from './Hero';
export { Features } from './Features';
export { Pricing } from './Pricing';
```

- [ ] **Step 3: Commit**

```bash
git add components/Landing/Pricing.tsx components/Landing/index.ts
git commit -m "feat: add landing page pricing section and barrel export"
```

---

### Task 4: Redesign HomePage for Conversion

**Files:**
- Modify: `components/pages/HomePage.tsx`

- [ ] **Step 1: Redesign as conversion landing page**

Replace the entire file:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/Layout';
import { Button, Input, Textarea, Modal } from '@/components/common';
import { Hero, Features, Pricing } from '@/components/Landing';
import { BOARD_TEMPLATES } from '@/utils';
import { useBoardStore } from '@/stores/boardStore';
import { useAppSettingsStore } from '@/stores/appSettingsStore';
import { useAuthStore } from '@/stores/authStore';
import type { BoardTemplate } from '@/types';

export function HomePage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate>('mad-sad-glad');
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const createBoard = useBoardStore((s) => s.createBoard);
  const appSettings = useAppSettingsStore((s) => s.settings);
  const fetchAppSettings = useAppSettingsStore((s) => s.fetchSettings);
  const { isAuthenticated, initialize } = useAuthStore();

  useEffect(() => {
    fetchAppSettings();
    initialize();
  }, [fetchAppSettings, initialize]);

  useEffect(() => {
    if (appSettings?.default_template) {
      setSelectedTemplate(appSettings.default_template);
    }
  }, [appSettings]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const boardId = await createBoard(title.trim(), description.trim() || null, selectedTemplate);
      router.push(`/board/${boardId}`);
    } catch (err) {
      console.error('Failed to create board:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell>
      {/* Hero */}
      <Hero />

      {/* Try It Section — anonymous board creation */}
      <section id="try-it" className="bg-[var(--color-gray-0)] py-16">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <h2 className="text-xl font-bold text-[var(--color-gray-8)]">Try it now — no account needed</h2>
          <p className="mt-2 text-sm text-[var(--color-gray-5)]">
            Create a quick retro board. Sign up later to save and manage your boards.
          </p>
          <div className="mt-6">
            <Button size="lg" onClick={() => setShowCreateModal(true)}>
              <Plus size={20} /> Quick Start a Retro
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <Features />

      {/* Pricing */}
      <Pricing />

      {/* Footer */}
      <footer className="border-t border-[var(--color-gray-1)] bg-[var(--color-surface)] py-8 text-center text-sm text-[var(--color-gray-4)]">
        Built with care. Powered by real-time collaboration.
      </footer>

      {/* Create Board Modal (unchanged from original) */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create a Retro Board"
        size="lg"
      >
        <div className="flex flex-col gap-5">
          <Input
            id="board-title"
            label="Board Title"
            placeholder="e.g., Sprint 47 Retrospective"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            id="board-description"
            label="Description (optional)"
            placeholder="Add context or prompts for your team..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          {/* Template Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--color-gray-7)]">
              Choose a Template
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {BOARD_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`rounded-[var(--radius-md)] border-2 p-3 sm:p-4 text-left transition-all ${
                    selectedTemplate === t.id
                      ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/5'
                      : 'border-[var(--color-gray-1)] bg-[var(--color-surface)] hover:border-[var(--color-gray-2)]'
                  }`}
                >
                  <p className="font-semibold text-[var(--color-gray-8)]">{t.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-gray-5)]">{t.description}</p>
                  {t.columns.length > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      {t.columns.map((col) => (
                        <span
                          key={col.title}
                          className="inline-block rounded-[var(--radius-full)] px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: col.color }}
                        >
                          {col.title}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-[var(--color-gray-1)] pt-4">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating} disabled={!title.trim()}>
              Create Board
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/pages/HomePage.tsx
git commit -m "feat: redesign homepage as conversion landing page with hero, features, pricing"
```

---

### Task 5: Smart Root Page Routing

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Read the current file**

- [ ] **Step 2: Keep it simple — the HomePage component handles both states**

The HomePage already renders for everyone. Authenticated users see the sign-in indicator in the header and can navigate to `/dashboard`. No server-side redirect needed — this keeps the landing page indexable by search engines.

No change needed to `app/page.tsx`.

- [ ] **Step 3: Commit (if any changes were made)**

---

### Task 6: Dashboard Enhancements

**Files:**
- Create: `components/Dashboard/EmptyState.tsx`
- Modify: `components/pages/DashboardPage.tsx`

- [ ] **Step 1: Create empty state component**

```typescript
// components/Dashboard/EmptyState.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Plus, Layout } from 'lucide-react';
import { Button } from '@/components/common';

export function EmptyState() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-gray-1)] py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-navy)]/10 text-[var(--color-navy)]">
        <Layout size={28} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[var(--color-gray-8)]">No boards yet</h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--color-gray-5)]">
        Create your first retrospective board and invite your team to collaborate in real-time.
      </p>
      <Button className="mt-6" onClick={() => router.push('/')}>
        <Plus size={18} /> Create Your First Retro
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Update DashboardPage with upgraded banner and empty state**

Add the following to `components/pages/DashboardPage.tsx`:

Import `EmptyState` from `@/components/Dashboard` and add to the barrel export.

In the useEffect, check for `?upgraded=true` in URL params and show a success banner:

```typescript
import { useSearchParams } from 'next/navigation';

const searchParams = useSearchParams();
const justUpgraded = searchParams.get('upgraded') === 'true';

// At the top of the page content, add:
{justUpgraded && (
  <div className="rounded-lg bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
    Welcome to Pro! You now have unlimited boards and enhanced export.
  </div>
)}
```

Replace the inline empty state with `<EmptyState />`.

- [ ] **Step 3: Update barrel export**

```typescript
// components/Dashboard/index.ts
export { BoardCard } from './BoardCard';
export { EmptyState } from './EmptyState';
```

- [ ] **Step 4: Commit**

```bash
git add components/Dashboard/EmptyState.tsx components/Dashboard/index.ts components/pages/DashboardPage.tsx
git commit -m "feat: add dashboard empty state and upgrade success banner"
```

---

### Task 7: Verify and Test

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual smoke test checklist**

1. Visit `/` (not logged in) → see hero, features, pricing sections
2. Click "Get Started Free" → goes to /signup
3. Click "Quick Start a Retro" → opens board creation modal (anonymous)
4. Scroll down → features grid, pricing cards visible
5. Sign in → header shows avatar dropdown
6. Visit `/dashboard` → boards listed, usage meter shown
7. Empty dashboard → shows empty state with CTA
8. Click "Create Your First Retro" → goes to homepage board creation
9. After Stripe upgrade → `/dashboard?upgraded=true` shows success banner

- [ ] **Step 4: Commit any fixes**
