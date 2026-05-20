# Visual Refresh ("Quiet Modern") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Claude Design "Quiet Modern" visual refresh (`design_handoff_visual_refresh/`) to RetroBoard across tokens, typography, primitives, board surface, shell, marketing pages, and mobile board route — preserving every existing capability and adding zero new features.

**Architecture:** Hybrid token migration (new OKLCH tokens + compat shim re-pointing `--color-*` names). Five sequential PRs on a single `feature/visual-refresh` branch, each deployed to a Vercel preview and verified via ui-feature-verify before merging back to the feature branch. After PR 5, one merge from `feature/visual-refresh` → `develop` → `main`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS v4 (`@theme {}`), OKLCH color space, Geist + Geist Mono via `next/font/google`, lucide-react, dnd-kit, Ably, Zustand.

**Spec:** [`docs/superpowers/specs/2026-05-19-visual-refresh-design.md`](../specs/2026-05-19-visual-refresh-design.md)

**Convention note:** This repo has no automated tests by design (`CLAUDE.md`: "No tests"). The TDD red-green-refactor cycle is replaced with `implement → tsc --noEmit → npm run build → local verification → commit`. Each PR's verification uses ui-feature-verify with the checklist in spec §7–§8.

**Verification model (corrected 2026-05-19):** `vercel.json` only enables auto-deploy for `main` and `develop` — **feature branches do NOT get a Vercel preview**. So per-PR verification is done **locally** (`npm run dev` + walk the checklist), not on a preview URL. Any "Vercel preview" / "preview walkthrough" phrasing in the per-task steps below should be read as "local `npm run dev` walkthrough." A real Vercel preview only appears once the feature branch is merged to `develop`.

**Commit message convention (per project memory):**
```
feat/fix/docs: description

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Pre-flight (run once)

### Task P.1: Confirm baseline builds

**Files:** none (verification only)

- [ ] **Step 1: Confirm `develop` builds cleanly before any changes**

Run:
```bash
git checkout develop
git pull
npx tsc --noEmit
npm run build
```

Expected: typecheck passes, build succeeds. If either fails, stop and surface the failure to Jordan before starting.

### Task P.2: Create feature branch

**Files:** none

- [ ] **Step 1: Create and switch to feature branch**

Run:
```bash
git checkout -b feature/visual-refresh
git push -u origin feature/visual-refresh
```

Expected: branch exists locally and on origin.

---

## PR 1 — Foundation (tokens, type, shim)

**Scope:** Token swap, type scale, Tailwind `@theme {}` rewrite, compatibility shim, Geist fonts, global base rules. No component edits.

**Risk:** Low. Compat shim means existing components render unchanged with new palette.

### File Structure
- Modify: `styles/index.css` — token blocks, type scale, radius scale, `@theme {}`, compat shim, base rules
- Modify: `app/layout.tsx` — Geist + Geist Mono via `next/font/google`

### Task 1.1: Wire Geist + Geist Mono via next/font

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Import Geist fonts and apply as CSS variables**

Replace the contents of `app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '@/styles/index.css';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RetroBoard',
  description: 'Real-time retrospective board for team collaboration',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="system"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('retro-theme');if(t==='light'||t==='dark'||t==='system')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "$(cat <<'EOF'
feat: wire Geist + Geist Mono via next/font

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 1.2: Replace styles/index.css with new token system

**Files:**
- Modify: `styles/index.css` (full rewrite)

- [ ] **Step 1: Write the new index.css**

Replace the entire file contents with:

```css
@import "tailwindcss";

/*
 * RetroBoard — "Quiet Modern" tokens
 * Per design_handoff_visual_refresh/README.md (Claude Design handoff, 2026-05-19)
 *
 * Adoption: new OKLCH tokens (--bg, --ink, --accent, tints) +
 * compatibility shim re-pointing legacy --color-* names so unchanged
 * components keep working.
 */

/* ------------------------------------------------------------------ */
/* 1. Shape + type scale (theme-agnostic)                              */
/* ------------------------------------------------------------------ */
:root {
  --font-sans: var(--font-sans, ui-sans-serif, system-ui, -apple-system, sans-serif);
  --font-mono: var(--font-mono, ui-monospace, 'SF Mono', Menlo, monospace);

  /* Radius scale */
  --r-xs: 6px;
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 14px;
  --r-xl: 18px;
  --r-2xl: 22px;
  --r-pill: 999px;

  /* Type scale */
  --t-display: clamp(2.4rem, 5vw, 3.5rem);
  --t-h1: 2.1rem;
  --t-h2: 1.5rem;
  --t-h3: 1.125rem;
  --t-body: 0.9375rem;
  --t-sm: 0.8125rem;
  --t-xs: 0.6875rem;

  /* Legacy radius names (used by existing components via shim) */
  --radius-sm: var(--r-sm);
  --radius-md: var(--r-md);
  --radius-lg: var(--r-lg);
  --radius-xl: var(--r-xl);
  --radius-2xl: var(--r-2xl);
  --radius-full: var(--r-pill);
}

/* ------------------------------------------------------------------ */
/* 2. Light mode tokens                                                */
/* ------------------------------------------------------------------ */
:root,
[data-theme="light"] {
  color-scheme: light;

  /* Surfaces */
  --bg:            oklch(0.985 0.004 80);
  --bg-elev:       oklch(1     0     0);
  --bg-sunken:     oklch(0.965 0.005 80);
  --surface:       oklch(1     0     0);
  --surface-hover: oklch(0.98  0.004 80);
  --surface-muted: oklch(0.965 0.005 80);

  /* Ink */
  --ink:   oklch(0.18 0.015 260);
  --ink-2: oklch(0.32 0.012 260);
  --ink-3: oklch(0.50 0.012 260);
  --ink-4: oklch(0.65 0.010 260);
  --ink-5: oklch(0.80 0.008 260);

  /* Lines */
  --line:        oklch(0.93 0.005 260);
  --line-strong: oklch(0.88 0.006 260);

  /* Accent */
  --accent:        oklch(0.55 0.18 280);
  --accent-hover:  oklch(0.50 0.20 280);
  --accent-soft:   oklch(0.95 0.04 280);
  --accent-soft-2: oklch(0.92 0.06 280);
  --on-accent:     oklch(0.99 0.003 280);

  /* Column tints */
  --rose:         oklch(0.70 0.13 18);
  --rose-soft:    oklch(0.96 0.025 18);
  --amber:        oklch(0.78 0.13 70);
  --amber-soft:   oklch(0.96 0.04 70);
  --emerald:      oklch(0.65 0.13 160);
  --emerald-soft: oklch(0.95 0.04 160);
  --sky:          oklch(0.70 0.12 230);
  --sky-soft:     oklch(0.95 0.03 230);
  --violet:       oklch(0.62 0.15 290);
  --violet-soft:  oklch(0.95 0.03 290);

  /* Semantic */
  --danger:  oklch(0.58 0.20 25);
  --success: oklch(0.55 0.14 155);
  --warning: oklch(0.78 0.14 75);
  --info:    oklch(0.60 0.13 230);

  /* Shadows (ink-tinted in light) */
  --shadow-xs:  0 1px 2px  oklch(0.18 0.015 260 / 0.06);
  --shadow-sm:  0 1px 3px  oklch(0.18 0.015 260 / 0.04),
                0 1px 2px  oklch(0.18 0.015 260 / 0.06);
  --shadow-md:  0 4px 12px oklch(0.18 0.015 260 / 0.06),
                0 2px 4px  oklch(0.18 0.015 260 / 0.04);
  --shadow-lg:  0 16px 40px oklch(0.18 0.015 260 / 0.10),
                0 4px 12px  oklch(0.18 0.015 260 / 0.06);
  --shadow-pop: 0 24px 60px oklch(0.30 0.06 280 / 0.18);
}

/* ------------------------------------------------------------------ */
/* 3. Dark mode tokens                                                 */
/* ------------------------------------------------------------------ */
[data-theme="dark"] {
  color-scheme: dark;

  --bg:            oklch(0.155 0.012 260);
  --bg-elev:       oklch(0.20  0.012 260);
  --bg-sunken:     oklch(0.13  0.012 260);
  --surface:       oklch(0.20  0.012 260);
  --surface-hover: oklch(0.235 0.013 260);
  --surface-muted: oklch(0.18  0.012 260);

  --ink:   oklch(0.97 0.005 80);
  --ink-2: oklch(0.88 0.008 80);
  --ink-3: oklch(0.72 0.008 260);
  --ink-4: oklch(0.58 0.010 260);
  --ink-5: oklch(0.42 0.012 260);

  --line:        oklch(0.27 0.012 260);
  --line-strong: oklch(0.34 0.014 260);

  --accent:        oklch(0.72 0.16 280);
  --accent-hover:  oklch(0.78 0.17 280);
  --accent-soft:   oklch(0.30 0.08 280);
  --accent-soft-2: oklch(0.36 0.10 280);
  --on-accent:     oklch(0.14 0.02 280);

  --rose:         oklch(0.74 0.13 18);
  --rose-soft:    oklch(0.32 0.06 18);
  --amber:        oklch(0.80 0.13 70);
  --amber-soft:   oklch(0.34 0.06 70);
  --emerald:      oklch(0.74 0.13 160);
  --emerald-soft: oklch(0.30 0.06 160);
  --sky:          oklch(0.75 0.12 230);
  --sky-soft:     oklch(0.30 0.06 230);
  --violet:       oklch(0.72 0.14 290);
  --violet-soft:  oklch(0.32 0.06 290);

  --danger:  oklch(0.68 0.18 25);
  --success: oklch(0.72 0.14 155);
  --warning: oklch(0.82 0.13 75);
  --info:    oklch(0.74 0.12 230);

  --shadow-xs:  0 1px 2px  oklch(0 0 0 / 0.30);
  --shadow-sm:  0 1px 3px  oklch(0 0 0 / 0.30),
                0 1px 2px  oklch(0 0 0 / 0.40);
  --shadow-md:  0 4px 12px oklch(0 0 0 / 0.35),
                0 2px 4px  oklch(0 0 0 / 0.30);
  --shadow-lg:  0 16px 40px oklch(0 0 0 / 0.45),
                0 4px 12px  oklch(0 0 0 / 0.30);
  --shadow-pop: 0 24px 60px oklch(0 0 0 / 0.55);
}

/* ------------------------------------------------------------------ */
/* 4. System mode auto-dark                                            */
/* ------------------------------------------------------------------ */
@media (prefers-color-scheme: dark) {
  [data-theme="system"] {
    color-scheme: dark;

    --bg:            oklch(0.155 0.012 260);
    --bg-elev:       oklch(0.20  0.012 260);
    --bg-sunken:     oklch(0.13  0.012 260);
    --surface:       oklch(0.20  0.012 260);
    --surface-hover: oklch(0.235 0.013 260);
    --surface-muted: oklch(0.18  0.012 260);

    --ink:   oklch(0.97 0.005 80);
    --ink-2: oklch(0.88 0.008 80);
    --ink-3: oklch(0.72 0.008 260);
    --ink-4: oklch(0.58 0.010 260);
    --ink-5: oklch(0.42 0.012 260);

    --line:        oklch(0.27 0.012 260);
    --line-strong: oklch(0.34 0.014 260);

    --accent:        oklch(0.72 0.16 280);
    --accent-hover:  oklch(0.78 0.17 280);
    --accent-soft:   oklch(0.30 0.08 280);
    --accent-soft-2: oklch(0.36 0.10 280);
    --on-accent:     oklch(0.14 0.02 280);

    --rose:         oklch(0.74 0.13 18);
    --rose-soft:    oklch(0.32 0.06 18);
    --amber:        oklch(0.80 0.13 70);
    --amber-soft:   oklch(0.34 0.06 70);
    --emerald:      oklch(0.74 0.13 160);
    --emerald-soft: oklch(0.30 0.06 160);
    --sky:          oklch(0.75 0.12 230);
    --sky-soft:     oklch(0.30 0.06 230);
    --violet:       oklch(0.72 0.14 290);
    --violet-soft:  oklch(0.32 0.06 290);

    --danger:  oklch(0.68 0.18 25);
    --success: oklch(0.72 0.14 155);
    --warning: oklch(0.82 0.13 75);
    --info:    oklch(0.74 0.12 230);

    --shadow-xs:  0 1px 2px  oklch(0 0 0 / 0.30);
    --shadow-sm:  0 1px 3px  oklch(0 0 0 / 0.30),
                  0 1px 2px  oklch(0 0 0 / 0.40);
    --shadow-md:  0 4px 12px oklch(0 0 0 / 0.35),
                  0 2px 4px  oklch(0 0 0 / 0.30);
    --shadow-lg:  0 16px 40px oklch(0 0 0 / 0.45),
                  0 4px 12px  oklch(0 0 0 / 0.30);
    --shadow-pop: 0 24px 60px oklch(0 0 0 / 0.55);
  }
}

/* ------------------------------------------------------------------ */
/* 5. Compatibility shim — legacy --color-* → new tokens               */
/*    Lets unchanged components render with new palette w/o edits.     */
/* ------------------------------------------------------------------ */
:root,
[data-theme="light"],
[data-theme="dark"],
[data-theme="system"] {
  /* Primary now indigo accent */
  --color-primary:         var(--accent);
  --color-primary-hover:   var(--accent-hover);
  --color-primary-pressed: var(--accent-hover);
  --color-white:           var(--bg-elev);

  /* Navy now ink (used for filled "secondary" buttons) */
  --color-navy:         var(--ink);
  --color-navy-hover:   var(--ink-2);
  --color-navy-pressed: var(--ink-2);

  --color-warm-white: var(--bg);
  --color-warm-gray:  var(--surface-muted);
  --color-dark-gray:  var(--ink-3);
  --color-dark-red:   var(--danger);

  /* Grayscale ramp */
  --color-gray-1: var(--surface-muted);
  --color-gray-2: var(--line);
  --color-gray-3: var(--line-strong);
  --color-gray-4: var(--ink-5);
  --color-gray-5: var(--ink-4);
  --color-gray-6: var(--ink-3);
  --color-gray-7: var(--ink-2);
  --color-gray-8: var(--ink);

  --color-error:   var(--danger);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info:    var(--info);

  --color-text-default:   var(--ink-3);
  --color-text-disabled:  var(--ink-5);
  --color-text-primary:   var(--accent);
  --color-text-secondary: var(--ink-2);
  --color-text-dark-bg:   var(--on-accent);

  --color-surface:             var(--surface);
  --color-surface-translucent: color-mix(in oklab, var(--bg) 90%, transparent);
  --color-surface-dim:         var(--bg-elev);
  --color-surface-subtle:      var(--surface-muted);
}

/* ------------------------------------------------------------------ */
/* 6. Tailwind v4 @theme — utilities map to new tokens                 */
/* ------------------------------------------------------------------ */
@theme {
  /* New canonical names */
  --color-bg:            var(--bg);
  --color-bg-elev:       var(--bg-elev);
  --color-bg-sunken:     var(--bg-sunken);
  --color-surface:       var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-ink:           var(--ink);
  --color-ink-2:         var(--ink-2);
  --color-ink-3:         var(--ink-3);
  --color-ink-4:         var(--ink-4);
  --color-ink-5:         var(--ink-5);
  --color-line:          var(--line);
  --color-line-strong:   var(--line-strong);
  --color-accent:        var(--accent);
  --color-accent-hover:  var(--accent-hover);
  --color-accent-soft:   var(--accent-soft);
  --color-on-accent:     var(--on-accent);

  --color-rose:    var(--rose);
  --color-amber:   var(--amber);
  --color-emerald: var(--emerald);
  --color-sky:     var(--sky);
  --color-violet:  var(--violet);

  /* Legacy names kept so existing utility classes still resolve */
  --color-primary:       var(--accent);
  --color-primary-hover: var(--accent-hover);
  --color-navy:          var(--ink);
  --color-navy-hover:    var(--ink-2);
  --color-warm-white:    var(--bg);
  --color-warm-gray:     var(--surface-muted);
  --color-gray-1:        var(--surface-muted);
  --color-gray-2:        var(--line);
  --color-gray-3:        var(--line-strong);
  --color-gray-4:        var(--ink-5);
  --color-gray-5:        var(--ink-4);
  --color-gray-6:        var(--ink-3);
  --color-gray-7:        var(--ink-2);
  --color-gray-8:        var(--ink);
  --color-error:         var(--danger);
  --color-success:       var(--success);
  --color-warning:       var(--warning);
  --color-info:          var(--info);

  /* Fonts */
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);

  /* Shadows */
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-pop: var(--shadow-pop);

  /* Radius */
  --radius-xs:   var(--r-xs);
  --radius-sm:   var(--r-sm);
  --radius-md:   var(--r-md);
  --radius-lg:   var(--r-lg);
  --radius-xl:   var(--r-xl);
  --radius-2xl:  var(--r-2xl);
  --radius-full: var(--r-pill);
}

/* ------------------------------------------------------------------ */
/* 7. Base                                                              */
/* ------------------------------------------------------------------ */
@layer base {
  *, *::before, *::after { box-sizing: border-box; }

  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    font-family: var(--font-sans);
    font-size: var(--t-body);
    line-height: 1.5;
    letter-spacing: -0.005em;
    color: var(--ink);
    background-color: var(--bg);
    margin: 0;
  }

  h1, h2, h3, h4 {
    font-family: var(--font-sans);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--ink);
    margin: 0;
    line-height: 1.15;
  }
  h1 { font-size: var(--t-h1); letter-spacing: -0.025em; }
  h2 { font-size: var(--t-h2); }
  h3 { font-size: var(--t-h3); }

  a { color: var(--accent); text-decoration: none; }
  a:hover { color: var(--accent-hover); text-decoration: underline; }

  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}

/* ------------------------------------------------------------------ */
/* 8. Utility helpers                                                   */
/* ------------------------------------------------------------------ */
.mono { font-family: var(--font-mono); font-feature-settings: 'tnum' 1; }
.tnum { font-variant-numeric: tabular-nums; }

@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes scale-in { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds. Tailwind v4 picks up `@theme {}` and regenerates utilities to point at new tokens.

- [ ] **Step 4: Local smoke**

Run: `npm run dev` (or use existing port from `.env.local`).
Open the homepage in browser. Expected: colors look noticeably calmer (warm off-white bg, indigo accent visible on links/buttons). Type renders Geist. No console errors. Toggle theme via existing toggle — light/dark/system all render. Open an existing board — board renders (cards may look slightly different but no broken layouts).

If any page crashes or any visually broken layout: stop, debug, fix before committing.

- [ ] **Step 5: Commit**

```bash
git add styles/index.css
git commit -m "$(cat <<'EOF'
feat: replace token system with OKLCH Quiet Modern palette + compat shim

Adopts the Claude Design visual-refresh handoff: new --bg/--ink/--accent
tokens in OKLCH, indigo accent, column tints (rose/amber/emerald/sky/violet),
type and radius scales. Legacy --color-* names re-pointed via shim so
unchanged components render with new palette. Tailwind v4 @theme updated
to map utilities to new tokens.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 1.3: Push branch and verify PR 1 on Vercel preview

**Files:** none

- [ ] **Step 1: Push**

Run:
```bash
git push origin feature/visual-refresh
```

- [ ] **Step 2: Wait for Vercel preview, walk verification**

Open the Vercel preview URL (Vercel comments it on the branch). Walk through spec §7 always-on regression smoke + spec §8 PR 1 additions:
- Sign in → dashboard renders → open existing board
- From second window, add card → both windows show it within 2s
- Vote on card → counts sync
- Drag-combine works
- Presence shows both sessions
- Complete retro → board locks
- Light/dark toggle persists across reload
- App boots in both themes, no console errors
- Type is Geist (Inspect → Computed → font-family contains "Geist")
- Compat shim renders unchanged components correctly (board cards, header, dashboard tiles all look intact)
- LCP eyeball check — page feels at least as fast

Drop a short summary on the GitHub PR (or branch) with screenshots of light + dark home + dashboard + board.

- [ ] **Step 3: Get Jordan's sign-off**

Wait for "go ahead with PR 2" before continuing.

---

## PR 2 — Primitives (Button, Pill, Chip, IconButton, Badge wrapper)

**Scope:** Rewrite `Button.tsx` to new variants + sizes. Add `Pill`, `Chip`, `IconButton`. Rewrite `Badge` as wrapper around `Pill`. Add temporary review route at `/__refresh-primitives`. Migrate all existing Button call-sites to the new variant naming.

**Risk:** Low-medium. Variant rename touches every call site but is mechanical.

### File Structure
- Modify: `components/common/Button.tsx` — new variants + sizes
- Create: `components/common/Pill.tsx`
- Create: `components/common/Chip.tsx`
- Create: `components/common/IconButton.tsx`
- Modify: `components/common/Badge.tsx` — wraps Pill
- Modify: `components/common/index.ts` — export new primitives
- Create: `app/__refresh-primitives/page.tsx` — temporary visual review route (deleted before merge)

### Task 2.1: Create Pill component

**Files:**
- Create: `components/common/Pill.tsx`

- [ ] **Step 1: Write Pill.tsx**

```tsx
'use client';

import { cn } from '@/utils/cn';
import type { HTMLAttributes, ReactNode } from 'react';

type PillVariant = 'default' | 'tinted' | 'bare';

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  children: ReactNode;
}

const variantStyles: Record<PillVariant, string> = {
  default:
    'bg-[var(--surface-muted)] text-[var(--ink-2)] border border-[var(--line)]',
  tinted:
    'bg-[var(--accent-soft)] text-[var(--accent)] border border-transparent',
  bare:
    'bg-transparent text-[var(--ink-3)] border-transparent px-1.5',
};

export function Pill({ variant = 'default', className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 2.2: Create Chip component

**Files:**
- Create: `components/common/Chip.tsx`

- [ ] **Step 1: Write Chip.tsx**

```tsx
'use client';

import { cn } from '@/utils/cn';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export function Chip({ active = false, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium',
        'transition-[background-color,color,border-color] duration-150',
        active
          ? 'bg-[var(--ink)] text-[var(--bg-elev)] border border-transparent'
          : 'bg-[var(--bg-elev)] text-[var(--ink-3)] border border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 2.3: Create IconButton component

**Files:**
- Create: `components/common/IconButton.tsx`

- [ ] **Step 1: Write IconButton.tsx**

```tsx
'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  children: ReactNode;
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-7 h-7 rounded-[var(--r-sm)]',
  md: 'w-8 h-8 rounded-[var(--r-sm)]',
  lg: 'w-10 h-10 rounded-[var(--r-md)]',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center justify-center bg-transparent border-transparent text-[var(--ink-3)]',
          'transition-[background-color,color] duration-150',
          'hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 2.4: Rewrite Button component

**Files:**
- Modify: `components/common/Button.tsx` (full rewrite)

- [ ] **Step 1: Rewrite Button.tsx**

```tsx
'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type ButtonVariant = 'default' | 'primary' | 'accent' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  default:
    'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--surface-hover)] hover:border-[var(--line-strong)]',
  primary:
    'bg-[var(--ink)] text-[var(--bg-elev)] border border-transparent hover:bg-[var(--ink-2)]',
  accent:
    'bg-[var(--accent)] text-[var(--on-accent)] border border-transparent hover:bg-[var(--accent-hover)]',
  ghost:
    'bg-transparent text-[var(--ink-3)] border border-transparent hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]',
  danger:
    'bg-[var(--danger)] text-white border border-transparent hover:opacity-90',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-[7px] text-[11px] rounded-[var(--r-sm)] gap-1.5',
  md: 'px-3.5 py-2.5 text-[13px] rounded-[var(--r-md)] gap-2',
  lg: 'px-[22px] py-3.5 text-[15px] rounded-[var(--r-lg)] gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium leading-none whitespace-nowrap',
          'transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: ERROR — every existing `<Button variant="primary" />` and `<Button variant="secondary" />` now refers to different visuals (`primary` was crimson, is now ink-fill; `secondary` no longer exists). We address this in Task 2.5.

### Task 2.5: Migrate Button call-sites to new variant names

**Files:**
- Modify: all files using `<Button variant="…">` — discover via grep.

Migration map:
- Old `variant="primary"` (crimson CTA) → new `variant="accent"`
- Old `variant="secondary"` (navy filled) → new `variant="primary"` (ink filled)
- Old `variant="ghost"` → unchanged (`variant="ghost"`)
- Old `variant="danger"` → unchanged

- [ ] **Step 1: Find call sites**

Run:
```bash
grep -rn 'variant="primary"' components/ app/
grep -rn 'variant="secondary"' components/ app/
```

Note every match. Expected: a handful of locations across home, dashboard, login/signup, board pages.

- [ ] **Step 2: Migrate `variant="primary"` → `variant="accent"`**

For each match from Step 1, edit the file and rename. Example:

```diff
- <Button variant="primary" onClick={createBoard}>Create Board</Button>
+ <Button variant="accent" onClick={createBoard}>Create Board</Button>
```

- [ ] **Step 3: Migrate `variant="secondary"` → `variant="primary"`**

For each match:

```diff
- <Button variant="secondary" onClick={handleSubmit}>Submit</Button>
+ <Button variant="primary" onClick={handleSubmit}>Submit</Button>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. The variant union `'default' | 'primary' | 'accent' | 'ghost' | 'danger'` now matches all call sites.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS.

### Task 2.6: Rewrite Badge as Pill wrapper

**Files:**
- Modify: `components/common/Badge.tsx`

- [ ] **Step 1: Rewrite Badge.tsx**

```tsx
'use client';

import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';
import { Pill } from './Pill';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantAccent: Record<BadgeVariant, string | undefined> = {
  default: undefined,
  success: 'bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)] border-transparent',
  warning: 'bg-[color-mix(in_oklab,var(--warning)_22%,transparent)] text-[var(--ink-2)] border-transparent',
  error:   'bg-[color-mix(in_oklab,var(--danger)_18%,transparent)] text-[var(--danger)] border-transparent',
  info:    'bg-[color-mix(in_oklab,var(--info)_18%,transparent)] text-[var(--info)] border-transparent',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const accent = variantAccent[variant];
  return (
    <Pill
      variant={variant === 'default' ? 'default' : 'tinted'}
      className={cn(accent, className)}
    >
      {children}
    </Pill>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 2.7: Update common/index.ts exports

**Files:**
- Modify: `components/common/index.ts`

- [ ] **Step 1: Open the file and add the new exports**

```bash
cat components/common/index.ts
```

Add exports for the new primitives:

```tsx
export { Button } from './Button';
export { Badge } from './Badge';
export { Input } from './Input';
export { Modal } from './Modal';
export { Textarea } from './Textarea';
export { Turnstile } from './Turnstile';
export { Pill } from './Pill';
export { Chip } from './Chip';
export { IconButton } from './IconButton';
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 2.8: Create temporary primitives review route

**Files:**
- Create: `app/__refresh-primitives/page.tsx`

- [ ] **Step 1: Write the review route**

```tsx
'use client';

import { Button, Pill, Chip, IconButton, Badge } from '@/components/common';
import { Plus, Settings, Trash2, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

export default function PrimitivesReview() {
  const [activeChip, setActiveChip] = useState<'all' | 'active' | 'completed'>('all');
  return (
    <div className="p-8 space-y-10 max-w-4xl mx-auto">
      <section>
        <h2 className="mb-3">Button — variants</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <Button variant="default">Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="accent" loading>Loading</Button>
          <Button variant="accent" disabled>Disabled</Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3">Button — sizes</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <Button variant="accent" size="sm">Small</Button>
          <Button variant="accent" size="md">Medium</Button>
          <Button variant="accent" size="lg">Large</Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3">Pill</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <Pill>Default</Pill>
          <Pill variant="tinted">Tinted</Pill>
          <Pill variant="bare">Bare</Pill>
        </div>
      </section>

      <section>
        <h2 className="mb-3">Chip (filter)</h2>
        <div className="flex gap-2 flex-wrap items-center">
          {(['all', 'active', 'completed'] as const).map((k) => (
            <Chip key={k} active={activeChip === k} onClick={() => setActiveChip(k)}>
              {k}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3">IconButton</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <IconButton size="sm" aria-label="Add"><Plus size={14} /></IconButton>
          <IconButton aria-label="Settings"><Settings size={16} /></IconButton>
          <IconButton size="lg" aria-label="Delete"><Trash2 size={18} /></IconButton>
        </div>
      </section>

      <section>
        <h2 className="mb-3">Badge (legacy → Pill wrapper)</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </section>

      <section>
        <h2 className="mb-3">Vote-style (preview for PR 3)</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <Pill variant="tinted"><ThumbsUp size={12} /> 3</Pill>
          <Pill><ThumbsUp size={12} /> 0</Pill>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 3: Dev smoke**

Run dev, visit `/__refresh-primitives`. Verify every variant renders in both themes, focus rings present (Tab through controls), disabled and loading states work.

- [ ] **Step 4: Commit**

```bash
git add components/common/Button.tsx components/common/Pill.tsx components/common/Chip.tsx \
        components/common/IconButton.tsx components/common/Badge.tsx components/common/index.ts \
        app/__refresh-primitives/page.tsx
# also stage call-site renames from Task 2.5
git add -p   # interactive: include the variant renames
git commit -m "$(cat <<'EOF'
feat: refresh primitives (Button, Pill, Chip, IconButton) + Badge wrapper

Button gains default/primary/accent/ghost/danger variants at sm/md/lg per
Quiet Modern handoff. Call sites migrated: existing primary→accent (crimson
CTA → indigo accent), existing secondary→primary (navy→ink filled).
New Pill/Chip/IconButton primitives added. Badge becomes thin Pill wrapper.
Temporary /__refresh-primitives review route added (removed before merge).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 2.9: Push and verify PR 2

**Files:** none

- [ ] **Step 1: Push**

Run: `git push origin feature/visual-refresh`

- [ ] **Step 2: Preview walkthrough**

Visit Vercel preview `/__refresh-primitives` (light + dark). Confirm every variant renders correctly. Also re-run the always-on smoke from spec §7 — sign in, board flow, voting, etc., to confirm Button rename didn't break any CTA.

- [ ] **Step 3: Sign-off, then remove the review route**

Once Jordan approves, delete the temporary route:

```bash
rm -r app/__refresh-primitives
git add -A
git commit -m "$(cat <<'EOF'
chore: remove /__refresh-primitives review route

Primitives signed off in PR 2 preview; route no longer needed.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
git push
```

---

## PR 3 — Board surface (biggest surface area)

**Scope:** RetroCard (drop fill, left border, new vote pill, accent reactions, IconButton hover row), BoardColumn (r-2xl, top tint stripe, overflow menu), AddCardForm (dashed ghost row), ViewToggle (tray-with-pill), FacilitatorToolbar (icon buttons + accent Complete), CardColorPicker (new swatches), ConnectionStatusBanner + ParticipantPopover (token swap + avatar hue), board page (bg-sunken + accent combine overlay).

**Risk:** Medium — touches the most user-visible surface area.

### File Structure
- Modify: `components/Board/RetroCard.tsx`
- Modify: `components/Board/BoardColumn.tsx`
- Modify: `components/Board/AddCardForm.tsx`
- Modify: `components/Board/ViewToggle.tsx`
- Modify: `components/Board/FacilitatorToolbar.tsx`
- Modify: `components/Board/ConnectionStatusBanner.tsx`
- Modify: `components/Board/ParticipantPopover.tsx`
- Modify: `components/Board/CardColorPicker.tsx`
- Modify: `app/board/[boardId]/page.tsx`
- Create: `utils/avatarHue.ts` — shared hue helper used by ParticipantPopover (PR 3) and Header (PR 4)

### Task 3.1: Create avatarHue helper

**Files:**
- Create: `utils/avatarHue.ts`

- [ ] **Step 1: Write avatarHue.ts**

```tsx
/**
 * Stable per-user hue derived from user ID.
 * 11 distinct hues spaced 32° apart for clear visual separation.
 */
export function userHue(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return (h % 11) * 32;
}

export function avatarBackground(userId: string): string {
  return `oklch(0.62 0.13 ${userHue(userId)})`;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 3.2: Read current RetroCard.tsx to understand existing structure

**Files:** none (read-only)

- [ ] **Step 1: Read the current implementation**

Run: `cat components/Board/RetroCard.tsx`

Note the current props, the colored-fill rendering, `getCardTextColor`, the hover row, vote pill, reaction logic. Re-read before editing so the rewrite preserves every existing capability.

### Task 3.3: Rewrite RetroCard for new visual

**Files:**
- Modify: `components/Board/RetroCard.tsx`

- [ ] **Step 1: Update RetroCard rendering**

Make the following changes (preserve every existing prop, callback, state, and effect):

1. Remove the `getCardTextColor` import and any use of it. Card text color is always `var(--ink)`.
2. Card root container className becomes:
   ```
   bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-lg)]
   shadow-[var(--shadow-xs)] hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-sm)]
   transition-[border-color,box-shadow] duration-150
   ```
   Remove any `style={{ background: card.color }}`.
3. When `card.color` is set, render a 3px left border via inline style:
   ```tsx
   style={card.color ? { borderLeftWidth: 3, borderLeftColor: card.color } : undefined}
   ```
4. Combined-card parent (when `card.isCombinedParent` or similar — preserve the existing combine flag — is true):
   ```tsx
   style={{ borderLeftWidth: 3, borderLeftColor: 'var(--accent)' }}
   ```
   Add a `<Pill variant="tinted">merged · +{childCount}</Pill>` next to the author line.
5. Vote pill — replace existing markup with:
   ```tsx
   <button
     type="button"
     onClick={handleVote}
     aria-pressed={hasVoted}
     className={cn(
       'inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 font-mono tabular-nums text-[11px] border transition-[background-color,color,border-color] duration-150',
       hasVoted
         ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent'
         : 'bg-[var(--bg-elev)] text-[var(--ink-3)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
     )}
   >
     <ThumbsUp size={12} />
     <span>{voteCount}</span>
   </button>
   ```
6. Reactions — apply accent-soft styling when the current user reacted:
   ```tsx
   className={cn(
     'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono cursor-pointer border transition-[background-color,border-color] duration-150',
     userReacted
       ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent'
       : 'bg-[var(--surface-muted)] text-[var(--ink-3)] border-transparent hover:bg-[var(--bg-elev)] hover:border-[var(--line)]'
   )}
   ```
7. Hover row (Edit/Color/Trash) — wrap each in `<IconButton size="sm">`:
   ```tsx
   import { IconButton } from '@/components/common';
   ...
   <IconButton size="sm" aria-label="Edit"><Pencil size={14} /></IconButton>
   <IconButton size="sm" aria-label="Color"><Palette size={14} /></IconButton>
   <IconButton size="sm" aria-label="Delete"><Trash2 size={14} /></IconButton>
   ```
8. Card text className: `text-[var(--ink)] text-[15px] leading-[1.45]`. Author meta: `text-[11px] text-[var(--ink-4)]`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Local smoke**

Run dev, open a board with existing cards. Verify:
- Cards render on white surface with hairline border, not colored fill.
- Cards with stored `color` show as 3px left stripe.
- Vote pill toggles; voted state is indigo-tinted.
- Hover shows edit/color/trash icon row.
- Combined cards (if any in test board) show accent left border + "merged · +N" pill.

If any path breaks: debug, do not commit until clean.

- [ ] **Step 4: Commit**

```bash
git add components/Board/RetroCard.tsx utils/avatarHue.ts
git commit -m "$(cat <<'EOF'
feat(board): refresh RetroCard — neutral surface + left-border color accent

Drops colored-fill mode. card.color renders as 3px left border on a
neutral surface; text always --ink. New vote pill (mono, accent-soft
when voted). Reactions become accent-soft when current user reacted.
Hover row uses IconButton primitives. Combined-card parent gets
accent left border + 'merged · +N' tinted pill.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 3.4: Rewrite BoardColumn

**Files:**
- Modify: `components/Board/BoardColumn.tsx`

- [ ] **Step 1: Update column rendering**

Changes (preserve every existing prop, dnd-kit wiring, presence handling, and admin permissions):

1. Container className:
   ```
   bg-[var(--bg-elev)] border border-[var(--line)] rounded-[var(--r-2xl)]
   flex flex-col min-w-[280px] overflow-hidden transition-[border-color] duration-150
   ```
2. At the very top of the container (before header), add a 3px tint stripe:
   ```tsx
   <div
     aria-hidden
     className="h-[3px] opacity-85"
     style={{ background: column.color || 'var(--accent)' }}
   />
   ```
3. Header row: `px-[18px] pt-4 pb-3 flex items-center gap-2.5`. Add an 8×8 squared tint dot before the title:
   ```tsx
   <span
     aria-hidden
     className="w-2 h-2 rounded-[3px] shrink-0"
     style={{ background: column.color || 'var(--accent)' }}
   />
   ```
4. Title className: `text-[15px] font-semibold tracking-tight text-[var(--ink)] flex-1`.
5. Count badge:
   ```tsx
   <span className="font-mono tabular-nums text-[12px] text-[var(--ink-4)]">{cards.length}</span>
   ```
6. Description className (if shown): `px-[18px] pb-1 text-[13px] text-[var(--ink-4)]` — no border separator.
7. Body className: `p-3 flex flex-col gap-2 flex-1`.
8. Admin actions (Color / Delete) — move into a `<DropdownMenu>` triggered by `<IconButton><MoreHorizontal size={16} /></IconButton>` in the header (or, if the project doesn't have a DropdownMenu primitive, use a simple absolute-positioned panel toggled by local state).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Local smoke**

Run dev, open a board. Verify columns are rounded-2xl, top tint stripe matches column color, header shows tint dot + title + count, no border separator above description, admin actions accessible via overflow menu.

- [ ] **Step 4: Commit**

```bash
git add components/Board/BoardColumn.tsx
git commit -m "$(cat <<'EOF'
feat(board): refresh BoardColumn — r-2xl, top tint stripe, overflow menu

Container is now rounded-2xl on bg-elev with a 3px tint stripe at top.
Header shows tint dot + title (15px/600) + mono count. Description sits
in header area with no separator. Admin actions (Color/Delete) move
into a header overflow menu.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 3.5: Refresh AddCardForm as dashed ghost row

**Files:**
- Modify: `components/Board/AddCardForm.tsx`

- [ ] **Step 1: Update form rendering**

Resting state — a row that looks like a placeholder until focused:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/utils/cn';

interface AddCardFormProps {
  onAdd: (text: string) => Promise<void> | void;
  placeholder?: string;
}

export function AddCardForm({ onAdd, placeholder = 'Add a card…' }: AddCardFormProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focused) textareaRef.current?.focus();
  }, [focused]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setFocused(false);
      return;
    }
    await onAdd(trimmed);
    setText('');
    setFocused(false);
  };

  if (!focused) {
    return (
      <button
        type="button"
        onClick={() => setFocused(true)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-[var(--r-md)]',
          'bg-[var(--surface-muted)] border border-dashed border-[var(--line-strong)] text-[var(--ink-4)] text-[13px]',
          'hover:border-[var(--accent)] hover:text-[var(--ink-3)] transition-colors duration-150 cursor-text text-left'
        )}
      >
        <Plus size={14} />
        <span>{placeholder}</span>
      </button>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        } else if (e.key === 'Escape') {
          setText('');
          setFocused(false);
        }
      }}
      rows={2}
      placeholder={placeholder}
      className={cn(
        'w-full px-3 py-2.5 rounded-[var(--r-md)] resize-none text-[15px]',
        'bg-[var(--surface)] border border-[var(--accent)] text-[var(--ink)]',
        'outline-none shadow-[0_0_0_3px_var(--accent-soft)] transition-colors duration-150',
        'placeholder:text-[var(--ink-4)]'
      )}
    />
  );
}
```

**Important:** the props (`onAdd`, optional `placeholder`) match what existing call sites pass. If `BoardColumn.tsx` passes additional props, preserve them — extend the interface accordingly.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Local smoke**

In dev, click the dashed row in any column → it converts to a focused textarea → type a card → press Enter → card is added → row collapses back to dashed state.

- [ ] **Step 4: Commit**

```bash
git add components/Board/AddCardForm.tsx
git commit -m "$(cat <<'EOF'
feat(board): AddCardForm becomes dashed ghost row, expands on focus

Resting state is a dashed placeholder row that matches the Quiet Modern
column-body pattern. Click/focus reveals a textarea with accent focus
ring; Enter submits, Escape cancels.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 3.6: Refresh ViewToggle as tray-with-pill

**Files:**
- Modify: `components/Board/ViewToggle.tsx`

- [ ] **Step 1: Rewrite ViewToggle**

```tsx
'use client';

import { cn } from '@/utils/cn';
import { LayoutGrid, Rows3, List, Clock } from 'lucide-react';
import type { BoardView } from '@/types';

interface ViewToggleProps {
  value: BoardView;
  onChange: (view: BoardView) => void;
}

const OPTIONS: Array<{ value: BoardView; icon: typeof LayoutGrid; label: string }> = [
  { value: 'grid', icon: LayoutGrid, label: 'Grid' },
  { value: 'swimlane', icon: Rows3, label: 'Swimlane' },
  { value: 'list', icon: List, label: 'List' },
  { value: 'timeline', icon: Clock, label: 'Timeline' },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      className="inline-flex p-[3px] gap-0.5 rounded-[10px] bg-[var(--surface-muted)] border border-[var(--line)]"
      role="tablist"
      aria-label="Board view"
    >
      {OPTIONS.map(({ value: v, icon: Icon, label }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[12px] font-medium transition-[background-color,color,box-shadow] duration-150',
              active
                ? 'bg-[var(--bg-elev)] text-[var(--ink)] shadow-[var(--shadow-xs)]'
                : 'bg-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
            )}
          >
            <Icon size={12} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

Verify the `BoardView` type values match (`'grid' | 'swimlane' | 'list' | 'timeline'` per the project memory).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/Board/ViewToggle.tsx
git commit -m "$(cat <<'EOF'
feat(board): ViewToggle becomes tray-with-pill

Inline pill group inside a soft tray (surface-muted bg, 3px padding,
10px radius). Active option gets bg-elev + shadow-xs.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 3.7: Refresh FacilitatorToolbar

**Files:**
- Modify: `components/Board/FacilitatorToolbar.tsx`

- [ ] **Step 1: Rewrite the toolbar**

Pattern: ghost icon buttons with text labels at `sm` size, separator pipe, accent "Complete retro" CTA.

Read the current file first to preserve props/callbacks:

```bash
cat components/Board/FacilitatorToolbar.tsx
```

Then rewrite using `Button` and `IconButton` primitives:

```tsx
'use client';

import { Button } from '@/components/common';
import { Timer as TimerIcon, EyeOff, Settings, CheckCircle2 } from 'lucide-react';

interface FacilitatorToolbarProps {
  onOpenTimer: () => void;
  onToggleHideCards: () => void;
  onOpenSettings: () => void;
  onCompleteRetro: () => void;
  hideCardsActive?: boolean;
  canComplete?: boolean;
}

export function FacilitatorToolbar({
  onOpenTimer,
  onToggleHideCards,
  onOpenSettings,
  onCompleteRetro,
  hideCardsActive = false,
  canComplete = true,
}: FacilitatorToolbarProps) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <Button variant="ghost" size="sm" onClick={onOpenTimer}>
        <TimerIcon size={14} /> Timer
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleHideCards}
        aria-pressed={hideCardsActive}
      >
        <EyeOff size={14} /> {hideCardsActive ? 'Show cards' : 'Hide cards'}
      </Button>
      <Button variant="ghost" size="sm" onClick={onOpenSettings}>
        <Settings size={14} /> Settings
      </Button>
      <span aria-hidden className="w-px h-[22px] bg-[var(--line)] mx-1" />
      <Button variant="accent" size="sm" onClick={onCompleteRetro} disabled={!canComplete}>
        <CheckCircle2 size={14} /> Complete retro
      </Button>
    </div>
  );
}
```

**Match the existing prop names** the board page is passing — if any differ, keep the existing names and only swap the rendering.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/Board/FacilitatorToolbar.tsx
git commit -m "$(cat <<'EOF'
feat(board): FacilitatorToolbar uses ghost buttons + accent Complete CTA

Order: Timer · Hide cards · Settings · │ · Complete retro (accent).
The separator is a 1px × 22px line divider.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 3.8: Update CardColorPicker swatches

**Files:**
- Modify: `components/Board/CardColorPicker.tsx`

- [ ] **Step 1: Replace swatch palette**

Read the current file to find the swatch array, then replace it with the new tint palette (resolved sRGB hex from the handoff):

```tsx
const SWATCHES: Array<{ value: string; label: string }> = [
  { value: '#DD8C84', label: 'Rose' },
  { value: '#E0B265', label: 'Amber' },
  { value: '#2DA37F', label: 'Emerald' },
  { value: '#5FA3CC', label: 'Sky' },
  { value: '#8270C8', label: 'Violet' },
  { value: '',       label: 'None' }, // clears the color
];
```

Render each swatch as a 24px circle:

```tsx
<button
  type="button"
  onClick={() => onSelect(s.value)}
  aria-label={s.label}
  className="w-6 h-6 rounded-full border border-[var(--line)] hover:border-[var(--line-strong)] transition-colors duration-150"
  style={s.value ? { background: s.value } : { background: 'transparent' }}
/>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/Board/CardColorPicker.tsx
git commit -m "$(cat <<'EOF'
feat(board): CardColorPicker swatches use Quiet Modern tint palette

New picks (rose/amber/emerald/sky/violet) match column tints so cards
and columns share a coherent color vocabulary.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 3.9: Refresh ConnectionStatusBanner + ParticipantPopover

**Files:**
- Modify: `components/Board/ConnectionStatusBanner.tsx`
- Modify: `components/Board/ParticipantPopover.tsx`

- [ ] **Step 1: ConnectionStatusBanner — token swap**

Read the current file. Replace any hard-coded color references with token equivalents:
- `bg-yellow-100` → `bg-[color-mix(in_oklab,var(--warning)_18%,transparent)]`
- `bg-red-100` → `bg-[color-mix(in_oklab,var(--danger)_18%,transparent)]`
- `text-yellow-800` → `text-[var(--ink-2)]`
- `text-red-800` → `text-[var(--danger)]`

If the banner uses Tailwind utility classes that already point at shim-mapped colors, no change is needed.

- [ ] **Step 2: ParticipantPopover — avatar hue**

Wherever participant avatars render, replace any existing `bg-[var(--color-navy)]` or hard-coded color with:

```tsx
import { avatarBackground } from '@/utils/avatarHue';
...
<div
  className="w-8 h-8 rounded-full grid place-items-center text-[13px] font-medium text-[var(--bg-elev)]"
  style={{ background: avatarBackground(participant.id) }}
>
  {participant.name.charAt(0).toUpperCase()}
</div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/Board/ConnectionStatusBanner.tsx components/Board/ParticipantPopover.tsx
git commit -m "$(cat <<'EOF'
feat(board): banner/popover token swap + per-user avatar hues

ConnectionStatusBanner uses semantic --warning/--danger tokens.
ParticipantPopover avatars use stable per-user hue via userHue()
(11 hues × 32° apart) for clear visual separation.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 3.10: Update board page background + combine drop overlay

**Files:**
- Modify: `app/board/[boardId]/page.tsx`

- [ ] **Step 1: Update page background**

Replace the page wrapper background color with `bg-[var(--bg-sunken)]`. Find the outermost board-page container and change its bg class.

- [ ] **Step 2: Update dnd-kit combine drop overlay**

Locate the combine drop indicator (likely a conditional element rendered when a draggable is over a droppable). Update its className to:

```
bg-[var(--accent-soft)] border-2 border-dashed border-[var(--accent)]
```

This replaces the previous navy/dark overlay.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Local smoke**

Run dev, open a board with multiple cards. Drag one card over another → combine drop zone should show as accent-soft fill + dashed accent border (not navy). Drop → combine works. Background of the board page is bg-sunken (slightly darker than card surfaces).

- [ ] **Step 5: Commit**

```bash
git add "app/board/[boardId]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(board): page bg uses --bg-sunken; combine overlay is accent-soft + dashed

Visually clearer combine target than the previous navy block; matches
the Quiet Modern surface hierarchy (bg-sunken sits behind elevated
columns).

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 3.11: Build, push, verify PR 3

**Files:** none

- [ ] **Step 1: Final typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 2: Push**

Run: `git push origin feature/visual-refresh`

- [ ] **Step 3: Preview walkthrough (spec §7 + §8 PR 3)**

On the Vercel preview, walk:
- Sign in → board page renders.
- All four views (Grid / Swimlane / List / Timeline) — switch between them via ViewToggle. Each renders without layout breakage.
- Voting works in single + two-window sync.
- Secret voting setting hides counts (open settings, toggle, verify).
- Drag-combine flow: drop indicator is accent-soft dashed. Combined parent shows accent left border + "merged · +N" pill. Expand/collapse works.
- Color picker per card: new tint palette swatches; selected color renders as left border, not fill.
- Hide-cards mode (facilitator toggle).
- Completed-retro read-only state: open a completed board, no editing controls.
- Light + dark themes both look intentional.

- [ ] **Step 4: Sign-off**

Wait for Jordan's go-ahead before starting PR 4.

---

## PR 4 — Shell + marketing

**Scope:** Header (logo mark, avatar hue, blur backdrop), ThemeToggle (re-style), AppShell (token swap), Modal/Input/Textarea (focus ring + shadow update), Home page (hero + CTA tiles + create modal), Dashboard page (welcome + stat strip + filter chips + board tiles), `utils/templates.ts` (column colors), login/signup token swap.

**Risk:** Medium — Home and Dashboard are visible to every user.

### File Structure
- Modify: `components/Layout/Header.tsx`
- Modify: `components/Layout/ThemeToggle.tsx`
- Modify: `components/Layout/AppShell.tsx`
- Modify: `components/common/Modal.tsx`
- Modify: `components/common/Input.tsx`
- Modify: `components/common/Textarea.tsx`
- Modify: `app/page.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `utils/templates.ts`
- Modify: `app/login/page.tsx`
- Modify: `app/signup/page.tsx`

### Task 4.1: Refresh Header

**Files:**
- Modify: `components/Layout/Header.tsx`

- [ ] **Step 1: Replace SVG logo with CSS mark**

Edit Header.tsx, locate the existing `<svg>` mark inside the `<Link href="/">`, and replace with:

```tsx
<Link href="/" className="rb-logo flex items-center gap-2.5 hover:no-underline">
  <span className="rb-logo-mark" aria-hidden>R</span>
  <span className="text-[16px] font-semibold tracking-tight text-[var(--ink)]">
    {APP_NAME}
  </span>
</Link>
```

Add the supporting CSS to `styles/index.css` (append at end of file):

```css
.rb-logo-mark {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: var(--ink);
  color: var(--bg-elev);
  display: grid; place-items: center;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 14px;
  position: relative;
  flex-shrink: 0;
}
.rb-logo-mark::after {
  content: '';
  position: absolute;
  width: 6px; height: 6px;
  border-radius: 999px;
  background: var(--accent);
  bottom: 4px; right: 4px;
}
```

- [ ] **Step 2: Reduce topbar height + blur backdrop**

Change the header element className:

```tsx
<header
  className="sticky top-0 z-40 h-[60px] border-b border-[var(--line)] backdrop-blur-[8px]"
  style={{ background: 'color-mix(in oklab, var(--bg) 90%, transparent)' }}
>
  <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
    {/* ... */}
  </div>
</header>
```

- [ ] **Step 3: Avatar with per-user hue**

Replace the avatar button:

```tsx
import { avatarBackground } from '@/utils/avatarHue';
...
<button
  onClick={() => setDropdownOpen(!dropdownOpen)}
  className="flex w-8 h-8 items-center justify-center rounded-full text-[13px] font-medium text-[var(--bg-elev)]"
  style={{ background: avatarBackground(user.id) }}
  title={user.name || user.email}
>
  {(user.name || user.email).charAt(0).toUpperCase()}
</button>
```

- [ ] **Step 4: Sign-in CTA → default Button**

```tsx
import { Button } from '@/components/common';
...
<Link href="/login">
  <Button variant="default" size="sm">
    <User size={14} /> Sign In
  </Button>
</Link>
```

- [ ] **Step 5: Update dropdown styling (token swap)**

The dropdown panel: `bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-md)] shadow-[var(--shadow-md)]`. Item rows: `hover:bg-[var(--surface-muted)] text-[var(--ink-2)]`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/Layout/Header.tsx styles/index.css
git commit -m "$(cat <<'EOF'
feat(header): Quiet Modern shell — 60px blur topbar, CSS logo mark, hue avatars

Replaces red/navy SVG with CSS-rendered logo (dark square + 'R' + accent
dot). Topbar drops to 60px with blurred surface. Avatars use stable
per-user hue. Sign-in becomes default Button.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 4.2: Restyle ThemeToggle as rb-icon-btn

**Files:**
- Modify: `components/Layout/ThemeToggle.tsx`

- [ ] **Step 1: Update className**

```tsx
'use client';

import { Monitor, Sun, Moon } from 'lucide-react';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { IconButton } from '@/components/common';

const THEME_META: Record<Theme, { icon: typeof Monitor; label: string }> = {
  system: { icon: Monitor, label: 'System theme' },
  light: { icon: Sun, label: 'Light theme' },
  dark: { icon: Moon, label: 'Dark theme' },
};

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const { icon: Icon, label } = THEME_META[theme];

  return (
    <IconButton onClick={cycleTheme} aria-label={label} title={label}>
      <Icon size={16} />
    </IconButton>
  );
}
```

3-state cycle (`system → light → dark`) is preserved — only the visual chrome changes.

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/Layout/ThemeToggle.tsx
git commit -m "$(cat <<'EOF'
feat(header): ThemeToggle uses IconButton chrome; 3-state cycle preserved

Single 32×32 icon button cycling system → light → dark, matching the
Quiet Modern topbar density. Preserves 'system' capability.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 4.3: Refresh Modal, Input, Textarea (focus ring + shadow)

**Files:**
- Modify: `components/common/Modal.tsx`
- Modify: `components/common/Input.tsx`
- Modify: `components/common/Textarea.tsx`

- [ ] **Step 1: Modal — shadow-pop, r-2xl**

Read the current file. Update outermost dialog container className:

```
bg-[var(--bg-elev)] border border-[var(--line)] rounded-[var(--r-2xl)]
shadow-[var(--shadow-pop)] p-6
```

Backdrop: `bg-[oklch(0.15_0.01_260/0.40)] backdrop-blur-[4px]` (light) — the same color works in dark via the dim alpha.

- [ ] **Step 2: Input — accent focus ring**

```
w-full px-3 py-2.5 rounded-[var(--r-md)] text-[15px]
bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)]
placeholder:text-[var(--ink-4)] outline-none
focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]
transition-[border-color,box-shadow] duration-150
```

- [ ] **Step 3: Textarea — same focus pattern**

Apply the same focus ring pattern to Textarea, with `resize-none` retained if it was present.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/common/Modal.tsx components/common/Input.tsx components/common/Textarea.tsx
git commit -m "$(cat <<'EOF'
feat(common): Modal/Input/Textarea pick up Quiet Modern shadows + focus

Modal uses --shadow-pop on r-2xl. Input/Textarea use --accent focus
border + soft accent ring on focus.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 4.4: Refresh Home page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Read the current Home implementation**

Run: `cat app/page.tsx`

Inventory: what does it render today (hero, CTA, modal trigger, etc.)? Preserve every interaction (create-board, join-board, any modal triggers).

- [ ] **Step 2: Rewrite hero section**

Hero structure (preserve any existing onClick handlers for create/join):

```tsx
<section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
  <Pill className="mb-6">
    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
    Real-time, no install, ready in 5 seconds
  </Pill>
  <h1 className="text-[var(--t-display)] leading-[1.05] font-semibold tracking-[-0.025em] text-[var(--ink)]">
    Retros your team actually <span className="text-[var(--accent)]">finishes</span>
  </h1>
  <p className="mt-5 max-w-2xl mx-auto text-[var(--ink-3)] text-[16px] leading-relaxed">
    Shared boards. Live voting. Action items. No login required for participants.
  </p>
</section>
```

- [ ] **Step 3: Two CTA tiles**

```tsx
<section className="max-w-4xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-4">
  <button
    onClick={openCreateModal}
    className="text-left tile rounded-[var(--r-xl)] bg-[var(--surface)] border border-[var(--line)] p-5 hover:border-[var(--line-strong)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] transition-all duration-150"
  >
    <div className="w-10 h-10 rounded-[var(--r-md)] bg-[var(--accent-soft)] grid place-items-center mb-4">
      <Plus className="text-[var(--accent)]" size={20} />
    </div>
    <h3 className="mb-1.5">Start a new retro</h3>
    <p className="text-[var(--ink-4)] text-[13px]">
      Pick a template, share the link.
    </p>
    <div className="mt-4 text-[11px] text-[var(--ink-4)]">
      <kbd className="font-mono px-1.5 py-0.5 rounded bg-[var(--surface-muted)] border border-[var(--line)]">⌘N</kbd>
    </div>
  </button>

  <button
    onClick={() => router.push('/join')}
    className="text-left tile rounded-[var(--r-xl)] bg-[var(--surface)] border border-[var(--line)] p-5 hover:border-[var(--line-strong)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] transition-all duration-150"
  >
    <div className="w-10 h-10 rounded-[var(--r-md)] bg-[var(--surface-muted)] grid place-items-center mb-4">
      <LogIn size={20} className="text-[var(--ink-3)]" />
    </div>
    <h3 className="mb-1.5">Join with a code</h3>
    <p className="text-[var(--ink-4)] text-[13px]">
      Got a board code from a teammate? Drop it in.
    </p>
    <div className="mt-4 font-mono text-[11px] text-[var(--ink-4)] tracking-[0.2em]">
      ──── ────
    </div>
  </button>
</section>
```

If the existing Home doesn't currently route to `/join` for code entry, preserve whatever path/modal it uses — only swap the visuals.

- [ ] **Step 4: 4-up feature row**

```tsx
<section className="max-w-5xl mx-auto px-6 mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
  {[
    { icon: Zap,        label: 'Real-time',      desc: 'Cards and votes sync across every participant.' },
    { icon: Vote,       label: 'Live voting',    desc: 'See the team’s priorities form in real time.' },
    { icon: ListChecks, label: 'Action items',   desc: 'Capture next steps without losing context.' },
    { icon: Eye,        label: 'Hide cards',     desc: 'Brainstorm privately, then reveal together.' },
  ].map(({ icon: Icon, label, desc }) => (
    <div key={label} className="flex flex-col gap-2">
      <Icon size={20} className="text-[var(--accent)]" />
      <h3 className="text-[15px]">{label}</h3>
      <p className="text-[13px] text-[var(--ink-4)] leading-relaxed">{desc}</p>
    </div>
  ))}
</section>
```

- [ ] **Step 5: Update Create modal contents to template grid**

If the create modal uses a `Modal` component, inside it render a title input + 2×2 template grid:

```tsx
<div className="grid grid-cols-2 gap-3">
  {BOARD_TEMPLATES.map((t) => (
    <button
      key={t.id}
      onClick={() => setSelectedTemplate(t.id)}
      className={cn(
        'text-left p-4 rounded-[var(--r-lg)] border transition-all duration-150',
        selectedTemplate === t.id
          ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]'
          : 'border-[var(--line)] hover:border-[var(--line-strong)]'
      )}
    >
      <div className="flex gap-1 mb-3">
        {t.columns.map((c, i) => (
          <span key={i} className="h-[3px] flex-1 rounded-full opacity-85" style={{ background: c.color }} />
        ))}
      </div>
      <h4 className="text-[14px] font-semibold mb-1">{t.name}</h4>
      <p className="text-[12px] text-[var(--ink-4)] leading-snug">{t.description}</p>
    </button>
  ))}
</div>
```

- [ ] **Step 6: Typecheck + dev smoke**

```bash
npx tsc --noEmit
```

Then run dev, open `/`, walk: hero renders, pill renders, click Start a new retro → modal opens → templates render with tint stripes → choose one → create → land on board page. Click Join → existing flow works.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
feat(home): Quiet Modern hero, CTA tiles, feature row, template-grid modal

Hero with pill badge + display headline ('finishes' in accent). Two
hover-lift tiles for create/join, with kbd hint and code preview.
4-up feature strip. Create modal shows 2×2 template grid with tint
stripes at top of each template button.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 4.5: Refresh Dashboard page

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Read current Dashboard**

Run: `cat app/dashboard/page.tsx`

Inventory existing state, data fetches, filter logic.

- [ ] **Step 2: Welcome line + 4-up stat strip**

```tsx
<section className="max-w-6xl mx-auto px-6 pt-10">
  <p className="text-[13px] text-[var(--ink-4)] mb-1.5">
    Welcome back, {user?.name?.split(' ')[0] ?? 'there'}
  </p>
  <h1>Your boards</h1>

  <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
    {[
      { label: 'Active boards', value: stats.active, accent: true },
      { label: 'Action items',  value: stats.actions },
      { label: 'Cards shared',  value: stats.cards },
      { label: 'Votes cast',    value: stats.votes },
    ].map((s) => (
      <div key={s.label} className="bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-xl)] p-4">
        <p className="text-[11px] text-[var(--ink-4)] uppercase tracking-wide mb-2">{s.label}</p>
        <p className={cn(
          'font-mono tabular-nums text-[28px] font-semibold',
          s.accent ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
        )}>
          {s.value}
        </p>
      </div>
    ))}
  </div>
</section>
```

`stats` will need to be derived from whatever the current dashboard already fetches — wire to the existing data source. If the stat fields don't exist yet, surface `0` placeholders rather than removing the cards.

- [ ] **Step 3: Filter chip tray**

```tsx
import { Chip } from '@/components/common';
...
<div className="mt-10 flex items-center gap-2">
  {(['all', 'active', 'completed'] as const).map((k) => (
    <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
      {k}
    </Chip>
  ))}
</div>
```

- [ ] **Step 4: Board grid with tint-stripe row**

```tsx
<div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {filteredBoards.map((b) => (
    <Link
      key={b.id}
      href={`/board/${b.id}`}
      className="block bg-[var(--surface)] border border-[var(--line)] rounded-[var(--r-xl)] overflow-hidden hover:border-[var(--line-strong)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] transition-all duration-150"
    >
      <div className="flex gap-px h-1.5">
        {b.columns.map((c, i) => (
          <span key={i} className="flex-1 opacity-85" style={{ background: c.color || 'var(--accent)' }} />
        ))}
      </div>
      <div className="p-4">
        <h3 className="text-[15px] mb-1">{b.title}</h3>
        <p className="text-[12px] text-[var(--ink-4)] mb-4">
          {b.description ?? 'No description'} · {b.templateName ?? 'Custom'}
        </p>
        <div className="flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-3 font-mono tabular-nums text-[var(--ink-3)]">
            <span>{b.cardCount} cards</span>
            <span>{b.voteCount} votes</span>
            <span>{b.participantCount} ppl</span>
          </div>
          <span className="text-[var(--ink-4)]">{relativeTime(b.updatedAt)}</span>
        </div>
      </div>
    </Link>
  ))}
</div>
```

Use whatever shape the current dashboard data already exposes; the keys above are illustrative. Preserve all existing routes and data sources.

- [ ] **Step 5: Typecheck + dev smoke**

```bash
npx tsc --noEmit
```

Run dev, open `/dashboard`. Verify stats render, filter chips toggle, board grid renders with tint stripe row, each board links to `/board/[id]`.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): welcome + 4-up stats + filter chips + tinted board tiles

Stats use mono tabular numerals; active count in accent. Filter tray uses
Chip primitives. Board cards show a 6px tint-stripe row representing
columns, then title + description + mono counts.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 4.6: Update template column colors

**Files:**
- Modify: `utils/templates.ts`

- [ ] **Step 1: Rewrite the template list with new tint hex values**

```tsx
import type { TemplateDefinition } from '@/types';

const ROSE    = '#DD8C84';
const AMBER   = '#E0B265';
const EMERALD = '#2DA37F';
const SKY     = '#5FA3CC';
const VIOLET  = '#8270C8';

export const BOARD_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'mad-sad-glad',
    name: 'Mad / Sad / Glad',
    description: 'Classic emotional check-in format for team retrospectives',
    columns: [
      { title: 'Mad',  color: ROSE,    description: 'What frustrated you?' },
      { title: 'Sad',  color: SKY,     description: 'What disappointed you?' },
      { title: 'Glad', color: EMERALD, description: 'What made you happy?' },
    ],
  },
  {
    id: 'liked-learned-lacked',
    name: 'Liked / Learned / Lacked',
    description: 'Reflect on positives, growth, and gaps',
    columns: [
      { title: 'Liked',   color: EMERALD, description: 'What did you enjoy?' },
      { title: 'Learned', color: SKY,     description: 'What did you learn?' },
      { title: 'Lacked',  color: AMBER,   description: 'What was missing?' },
    ],
  },
  {
    id: 'start-stop-continue',
    name: 'Start / Stop / Continue',
    description: 'Action-oriented format for process improvement',
    columns: [
      { title: 'Start',    color: EMERALD, description: 'What should we begin doing?' },
      { title: 'Stop',     color: ROSE,    description: 'What should we stop doing?' },
      { title: 'Continue', color: SKY,     description: 'What should we keep doing?' },
    ],
  },
  {
    id: 'went-well-didnt-action',
    name: "Went Well / Didn't Go Well / Action Items",
    description: 'Simple review with built-in action planning',
    columns: [
      { title: 'What Went Well',       color: EMERALD, description: 'Celebrate successes' },
      { title: "What Didn't Go Well",  color: ROSE,    description: 'Identify challenges' },
      { title: 'Action Items',         color: VIOLET,  description: 'Plan improvements' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Board',
    description: 'Start with three columns you can rename and customize',
    columns: [
      { title: 'Column 1', color: SKY },
      { title: 'Column 2', color: EMERALD },
      { title: 'Column 3', color: ROSE },
    ],
  },
];
```

Existing boards in the database keep their stored color values — only new boards created from these templates pick up the new palette.

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add utils/templates.ts
git commit -m "$(cat <<'EOF'
feat(templates): column colors → Quiet Modern tint palette

Mad/Sad/Glad → rose/sky/emerald; Liked/Learned/Lacked → emerald/sky/amber;
Start/Stop/Continue → emerald/rose/sky; Went Well/Didn't/Action →
emerald/rose/violet; Custom → sky/emerald/rose. Existing boards keep
stored colors.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 4.7: Refresh login + signup pages (token swap)

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/signup/page.tsx`

- [ ] **Step 1: Read current pages**

```bash
cat app/login/page.tsx
cat app/signup/page.tsx
```

- [ ] **Step 2: Token swap + Button variant migration**

Replace hard-coded color classes with token equivalents. Existing `<Button variant="primary">` (already swept in PR 2) is now ink-fill — for the auth CTAs, switch to `variant="accent"` so the primary CTA is indigo:

```diff
- <Button variant="primary">Sign in</Button>
+ <Button variant="accent" size="lg">Sign in</Button>
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add app/login/page.tsx app/signup/page.tsx
git commit -m "$(cat <<'EOF'
feat(auth): login + signup pick up Quiet Modern tokens; accent CTAs

Primary CTAs switch to accent variant. Token swap only — no flow changes.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 4.8: Build, push, verify PR 4

**Files:** none

- [ ] **Step 1: Final typecheck + build**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 2: Push**

```bash
git push origin feature/visual-refresh
```

- [ ] **Step 3: Preview walkthrough (spec §7 + §8 PR 4)**

On preview:
- Sign out + back in via the new login page.
- Home `/` — hero, CTA tiles, feature row all render in both themes. Create modal opens, templates show tint stripes. Create a new board → lands on board page.
- Verify the new board's columns use the new tint palette (e.g., Mad/Sad/Glad shows rose/sky/emerald).
- `/dashboard` — welcome line + stats + filter chips + board grid all render.
- Header dropdown items all navigate (My Boards, Settings, Admin if admin, Sign Out).
- Avatar hue is stable across reload.

- [ ] **Step 4: Sign-off**

Wait for Jordan's go-ahead before starting PR 5.

---

## PR 5 — Mobile + polish

**Scope:** Mobile board route (snap-tab nav, vote tracker, FAB, bottom nav, bottom-sheet composer). Floating Timer capsule. Final motion + focus polish. Optional favicon update.

**Risk:** Medium-high — biggest structural change of the refresh.

### File Structure
- Create: `components/Board/MobileBoardShell.tsx`
- Create: `components/Board/MobileFAB.tsx`
- Create: `components/Board/MobileBottomNav.tsx`
- Create: `components/Board/MobileColumnTabs.tsx`
- Create: `components/Board/MobileVoteTracker.tsx`
- Create: `components/Board/MobileCardComposerSheet.tsx`
- Modify: `app/board/[boardId]/page.tsx` — render mobile shell below 768px
- Modify: `components/Timer/TimerFloating.tsx`
- Modify: `public/favicon.svg` (optional, decide via side-by-side)

### Task 5.1: Create MobileColumnTabs

**Files:**
- Create: `components/Board/MobileColumnTabs.tsx`

- [ ] **Step 1: Write component**

```tsx
'use client';

import { cn } from '@/utils/cn';
import type { Column } from '@/types';

interface MobileColumnTabsProps {
  columns: Column[];
  activeColumnId: string;
  onSelect: (columnId: string) => void;
}

export function MobileColumnTabs({ columns, activeColumnId, onSelect }: MobileColumnTabsProps) {
  return (
    <div
      className="flex gap-2 px-4 py-3 overflow-x-auto scroll-hide"
      style={{ scrollSnapType: 'x mandatory' }}
      role="tablist"
      aria-label="Board columns"
    >
      {columns.map((c) => {
        const active = c.id === activeColumnId;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(c.id)}
            className={cn(
              'shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-[13px] font-medium',
              'transition-[background-color,color,border-color] duration-150',
              active
                ? 'border-transparent text-white'
                : 'bg-[var(--bg-elev)] border-[var(--line)] text-[var(--ink-3)]'
            )}
            style={active ? { background: c.color || 'var(--accent)' } : undefined}
          >
            <span
              aria-hidden
              className="w-2 h-2 rounded-full"
              style={{ background: active ? 'rgba(255,255,255,0.85)' : (c.color || 'var(--accent)') }}
            />
            {c.title}
          </button>
        );
      })}
    </div>
  );
}
```

Add CSS helper for the scroll bar hide (append to `styles/index.css` if not already present):

```css
.scroll-hide::-webkit-scrollbar { display: none; }
.scroll-hide { scrollbar-width: none; }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 5.2: Create MobileVoteTracker

**Files:**
- Create: `components/Board/MobileVoteTracker.tsx`

- [ ] **Step 1: Write component**

```tsx
'use client';

import { ThumbsUp } from 'lucide-react';

interface MobileVoteTrackerProps {
  used: number;
  total: number;
}

export function MobileVoteTracker({ used, total }: MobileVoteTrackerProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-[var(--accent-soft)] grid place-items-center">
          <ThumbsUp size={14} className="text-[var(--accent)]" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--ink-4)]">Your votes</p>
          <p className="text-[13px] text-[var(--ink-2)]">
            <span className="font-mono tabular-nums">{used}</span> of <span className="font-mono tabular-nums">{total}</span> used
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: i < used ? 'var(--accent)' : 'var(--surface-muted)',
              border: i < used ? 'none' : '1px solid var(--line)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 5.3: Create MobileFAB + composer sheet

**Files:**
- Create: `components/Board/MobileFAB.tsx`
- Create: `components/Board/MobileCardComposerSheet.tsx`

- [ ] **Step 1: Write MobileFAB.tsx**

```tsx
'use client';

import { Plus } from 'lucide-react';

interface MobileFABProps {
  onClick: () => void;
  ariaLabel?: string;
}

export function MobileFAB({ onClick, ariaLabel = 'Add card' }: MobileFABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="fixed right-4 bottom-[84px] w-[52px] h-[52px] rounded-full grid place-items-center border-none cursor-pointer text-[var(--on-accent)] shadow-[var(--shadow-lg)] z-20"
      style={{ background: 'var(--accent)' }}
    >
      <Plus size={22} />
    </button>
  );
}
```

- [ ] **Step 2: Write MobileCardComposerSheet.tsx**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Share2 } from 'lucide-react';
import { Button } from '@/components/common';

interface MobileCardComposerSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<void> | void;
  columnTitle: string;
}

export function MobileCardComposerSheet({ open, onClose, onSubmit, columnTitle }: MobileCardComposerSheetProps) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 100);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
    setText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end" role="dialog" aria-label={`Add card to ${columnTitle}`}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[oklch(0.15_0.01_260/0.40)] backdrop-blur-[2px]"
      />
      <div className="relative w-full bg-[var(--bg-elev)] border-t border-[var(--line)] rounded-t-[var(--r-2xl)] p-5 pb-7 shadow-[var(--shadow-lg)]">
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--line-strong)]" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px]">Add to {columnTitle}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="text-[var(--ink-3)] p-1">
            <X size={18} />
          </button>
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          rows={4}
          className="w-full px-3 py-2.5 text-[16px] rounded-[var(--r-md)] bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        />
        <div className="flex gap-2 mt-4">
          <Button variant="ghost" size="md" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="accent" size="md" onClick={handleSubmit} className="flex-1">
            <Share2 size={14} /> Share
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 5.4: Create MobileBottomNav

**Files:**
- Create: `components/Board/MobileBottomNav.tsx`

- [ ] **Step 1: Write component**

```tsx
'use client';

import { cn } from '@/utils/cn';
import { Columns3, ThumbsUp, ListChecks, MoreHorizontal } from 'lucide-react';

type MobileNavKey = 'board' | 'votes' | 'actions' | 'more';

interface MobileBottomNavProps {
  active: MobileNavKey;
  onSelect: (key: MobileNavKey) => void;
  actionBadgeCount?: number;
}

const ITEMS: Array<{ key: MobileNavKey; icon: typeof Columns3; label: string }> = [
  { key: 'board',   icon: Columns3,        label: 'Board' },
  { key: 'votes',   icon: ThumbsUp,        label: 'Votes' },
  { key: 'actions', icon: ListChecks,      label: 'Actions' },
  { key: 'more',    icon: MoreHorizontal,  label: 'More' },
];

export function MobileBottomNav({ active, onSelect, actionBadgeCount = 0 }: MobileBottomNavProps) {
  return (
    <nav
      className="sticky bottom-0 grid grid-cols-4 gap-1 px-2 pt-2 pb-[18px] border-t border-[var(--line)] z-20"
      style={{ background: 'color-mix(in oklab, var(--bg) 85%, transparent)', backdropFilter: 'blur(10px)' }}
      aria-label="Mobile board navigation"
    >
      {ITEMS.map(({ key, icon: Icon, label }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'relative flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-[10px] font-medium border-none bg-transparent',
              isActive ? 'text-[var(--accent)]' : 'text-[var(--ink-4)] hover:bg-[var(--surface-muted)]'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
            {key === 'actions' && actionBadgeCount > 0 && (
              <span
                aria-hidden
                className="absolute top-1.5 right-1/2 translate-x-3 w-2 h-2 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 5.5: Create MobileBoardShell

**Files:**
- Create: `components/Board/MobileBoardShell.tsx`

- [ ] **Step 1: Write the shell that composes all mobile components**

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useBoardStore } from '@/stores/boardStore'; // adjust to actual import path
import { MobileColumnTabs } from './MobileColumnTabs';
import { MobileVoteTracker } from './MobileVoteTracker';
import { MobileFAB } from './MobileFAB';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileCardComposerSheet } from './MobileCardComposerSheet';
import { RetroCard } from './RetroCard';

interface MobileBoardShellProps {
  boardId: string;
}

export function MobileBoardShell({ boardId }: MobileBoardShellProps) {
  const { board, columns, cards, addCard, votesUsedByMe, votesAllowed } = useBoardStore();
  const [activeColumnId, setActiveColumnId] = useState<string | null>(columns[0]?.id ?? null);
  const [navTab, setNavTab] = useState<'board' | 'votes' | 'actions' | 'more'>('board');
  const [composerOpen, setComposerOpen] = useState(false);

  const activeColumn = useMemo(
    () => columns.find((c) => c.id === activeColumnId) ?? columns[0],
    [columns, activeColumnId]
  );
  const activeCards = useMemo(
    () => cards.filter((c) => c.columnId === activeColumn?.id),
    [cards, activeColumn]
  );

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--bg)]">
      <MobileVoteTracker used={votesUsedByMe} total={votesAllowed} />
      <MobileColumnTabs
        columns={columns}
        activeColumnId={activeColumn?.id ?? ''}
        onSelect={(id) => setActiveColumnId(id)}
      />
      <div className="flex-1 px-4 pb-[120px] flex flex-col gap-2">
        {activeCards.map((card) => (
          <RetroCard key={card.id} card={card} columnColor={activeColumn?.color ?? null} />
        ))}
        {activeCards.length === 0 && (
          <p className="text-center text-[13px] text-[var(--ink-4)] mt-12">
            No cards yet — tap + to add one.
          </p>
        )}
      </div>
      <MobileFAB onClick={() => setComposerOpen(true)} />
      <MobileBottomNav active={navTab} onSelect={setNavTab} />
      {activeColumn && (
        <MobileCardComposerSheet
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          onSubmit={(text) => addCard({ columnId: activeColumn.id, text })}
          columnTitle={activeColumn.title}
        />
      )}
    </div>
  );
}
```

**Note:** the import from `useBoardStore` and the field names (`addCard`, `votesUsedByMe`, `votesAllowed`, `columns`, `cards`) must match the actual store API. Read `stores/boardStore.ts` first and adjust names if they differ. If a field doesn't exist (e.g., `votesUsedByMe`), derive it from existing state or compute it in the shell — do not introduce new store fields in this refresh.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (after wiring to actual store names).

### Task 5.6: Render mobile shell from board page below 768px

**Files:**
- Modify: `app/board/[boardId]/page.tsx`

- [ ] **Step 1: Add media-query branch**

The cleanest pattern with Tailwind is to render both shells and hide one via responsive utilities, so SSR works without a hook:

```tsx
import { MobileBoardShell } from '@/components/Board/MobileBoardShell';
...
return (
  <>
    <div className="hidden md:flex flex-col min-h-dvh bg-[var(--bg-sunken)]">
      {/* existing desktop shell (header, columns, etc.) — unchanged from PR 3 */}
    </div>
    <div className="md:hidden">
      <MobileBoardShell boardId={params.boardId} />
    </div>
  </>
);
```

Both branches read from the same store, so real-time stays consistent across viewport sizes.

- [ ] **Step 2: Typecheck + build**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 3: Local smoke (desktop + mobile breakpoints)**

Run dev. Open a board on desktop — sees existing desktop shell. Resize the window to <768px wide — sees mobile shell: tabs, vote tracker, single-column card list, FAB, bottom nav.

Test:
- Tap a column tab → cards update.
- Tap FAB → composer sheet slides up. Type → Share → card appears in the active column.
- Bottom nav items highlight but only `Board` shows the board view for now (the other tabs are placeholders for current scope).
- In a second window (desktop), confirm the mobile-added card appears in real time.

- [ ] **Step 4: Commit**

```bash
git add components/Board/MobileBoardShell.tsx components/Board/MobileColumnTabs.tsx \
        components/Board/MobileVoteTracker.tsx components/Board/MobileFAB.tsx \
        components/Board/MobileBottomNav.tsx components/Board/MobileCardComposerSheet.tsx \
        "app/board/[boardId]/page.tsx" styles/index.css
git commit -m "$(cat <<'EOF'
feat(board/mobile): snap-tab nav + vote tracker + FAB + bottom nav

Below 768px the board route renders a mobile shell: scroll-snap column
tabs, vote tracker row (used/total + 5 dots), single-column scrolling
view, 52px accent FAB opening a bottom-sheet composer, persistent
4-item bottom nav. Same store and data flow; no new store fields.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 5.7: Refresh floating Timer capsule

**Files:**
- Modify: `components/Timer/TimerFloating.tsx`

- [ ] **Step 1: Read current implementation**

```bash
cat components/Timer/TimerFloating.tsx
```

- [ ] **Step 2: Update rendering**

Container:

```tsx
<div
  className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2.5 px-3.5 py-2 pl-3 rounded-full border border-[var(--line)] shadow-[var(--shadow-lg)] bg-[var(--bg-elev)] text-[var(--ink)]"
>
  <button
    type="button"
    onClick={togglePlay}
    aria-label={running ? 'Pause' : 'Play'}
    className="w-7 h-7 grid place-items-center rounded-full text-[var(--ink-3)] hover:bg-[var(--surface-muted)]"
  >
    {running ? <Pause size={14} /> : <Play size={14} />}
  </button>
  <span className="font-mono tabular-nums text-[14px]">{formatTime(remaining)}</span>
  <span aria-hidden className="w-px h-3.5 bg-[var(--line)]" />
  <span className="text-[11px] text-[var(--ink-4)]">{label ?? 'brainstorm'}</span>
  <button
    type="button"
    onClick={onDismiss}
    aria-label="Dismiss"
    className="ml-1 text-[var(--ink-4)] hover:text-[var(--ink-2)]"
  >
    <X size={14} />
  </button>
</div>
```

Preserve all existing props/state (timer logic, play/pause, dismiss).

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/Timer/TimerFloating.tsx
git commit -m "$(cat <<'EOF'
feat(timer): floating capsule — mono tabular time, accent shadow, dismissable

Floating bottom-right capsule with ghost play/pause, mono time, thin
divider, caption, X dismiss. Visual only — timer logic unchanged.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 5.8: Optional — favicon side-by-side decision

**Files:**
- Maybe modify: `public/favicon.svg`

- [ ] **Step 1: Capture current favicon**

Run: `cat public/favicon.svg | head -20`

- [ ] **Step 2: Propose replacement matching new logo mark**

Draft:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="2" y="2" width="28" height="28" rx="8" fill="oklch(0.18 0.015 260)"/>
  <text x="16" y="20" text-anchor="middle" font-family="Geist Mono, ui-monospace, monospace" font-weight="600" font-size="14" fill="oklch(1 0 0)">R</text>
  <circle cx="24" cy="24" r="3" fill="oklch(0.55 0.18 280)"/>
</svg>
```

(Note: browsers don't all render OKLCH in SVG `fill`. Replace with sRGB hex equivalents: `#1F2937`, `#FFFFFF`, `#6B53D6`.)

- [ ] **Step 3: Side-by-side compare with Jordan**

Drop both SVGs into the PR description as inline previews; he chooses. If declined, leave the existing favicon and skip Step 4.

- [ ] **Step 4: (if approved) replace + commit**

```bash
# write the new favicon.svg
git add public/favicon.svg
git commit -m "$(cat <<'EOF'
feat(brand): favicon matches new logo mark

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 5.9: Final polish sweep

**Files:** any flagged during preview review

- [ ] **Step 1: Focus-ring sweep**

Tab through home, dashboard, board (both viewports), modal, sheet, dropdown. Every focusable element must show the global `:focus-visible` 2px accent outline (set in `styles/index.css` base layer). Any element missing it: add `focus-visible:outline-2 focus-visible:outline-[var(--accent)]` to its className.

- [ ] **Step 2: Motion sweep**

Hover transitions are `transition-[…] duration-120` (or `150` for cards). Press uses `active:translate-y-px duration-80`. Card hover lift is `hover:-translate-y-px transition-transform duration-150`.

Adjust any laggy or overly-snappy transitions found.

- [ ] **Step 3: Typecheck + build**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Commit (only if changes)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: focus + motion polish pass

Adds focus-visible outlines on any controls that were missing them and
normalizes hover/press transition durations per Quiet Modern spec.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
EOF
)"
```

### Task 5.10: Push + mobile verification + sign-off

**Files:** none

- [ ] **Step 1: Push**

```bash
git push origin feature/visual-refresh
```

- [ ] **Step 2: Preview walkthrough (spec §7 + §8 PR 5)**

On Vercel preview, open the board URL on:
- **iOS Safari** (or DevTools iPhone emulation)
- **Android Chrome** (or DevTools Pixel emulation)

For each:
- Tabs switch columns smoothly; active tab visible (auto-scroll into view if needed — note for follow-up if not).
- FAB visible above content; doesn't overlap last card while scrolling (composer-sheet padding above bottom nav is correct).
- Tap FAB → composer slides up → type → Share → card lands in active column → reflected in a second (desktop) window.
- Bottom nav nav items highlight correctly. Actions badge dot appears if there's at least one action item.
- Timer FAB (if active) floats above content and is dismissable.
- No layout shift when switching tabs.
- Light + dark themes both render correctly.

- [ ] **Step 3: Sign-off**

Wait for Jordan to approve PR 5.

---

## Final: Merge to develop, then to main

### Task F.1: Merge feature/visual-refresh → develop

**Files:** none (git only)

- [ ] **Step 1: Update local develop**

```bash
git checkout develop
git pull
```

- [ ] **Step 2: Merge feature branch (no-ff for a clear merge commit)**

```bash
git merge --no-ff feature/visual-refresh -m "feat: Quiet Modern visual refresh (PR 1-5)"
```

- [ ] **Step 3: Pre-push gate**

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 4: Push develop → Vercel develop preview**

```bash
git push origin develop
```

- [ ] **Step 5: Walk full regression smoke on develop preview**

Run spec §7 always-on smoke once more end-to-end. Take screenshots of home, dashboard, board (light + dark, desktop + mobile) for the eventual main PR description.

### Task F.2: Promote develop → main (Jordan-gated)

**Files:** none

- [ ] **Step 1: Wait for Jordan's explicit go-ahead**

Per `CLAUDE.md` axiom #2: "Jordan reviews before promotion to prod." Do not proceed without explicit approval.

- [ ] **Step 2: PR from develop to main**

```bash
gh pr create --base main --head develop --title "Quiet Modern visual refresh" --body "$(cat <<'EOF'
## Summary

Visual + UX refresh of RetroBoard per Claude Design "Quiet Modern" handoff
(see design_handoff_visual_refresh/). 5-phase rollout on feature/visual-refresh:

1. Foundation: OKLCH tokens, Geist via next/font, compat shim, Tailwind @theme
2. Primitives: Button rewrite + Pill + Chip + IconButton + Badge wrapper
3. Board surface: RetroCard, BoardColumn, AddCardForm, ViewToggle, FacilitatorToolbar, ParticipantPopover, CardColorPicker, combine overlay
4. Shell + marketing: Header, ThemeToggle, Modal/Input/Textarea, Home, Dashboard, template column colors, login/signup
5. Mobile + polish: snap-tab column nav, FAB, bottom-sheet composer, persistent bottom nav, floating Timer capsule, focus/motion polish

No features added or removed. Component tree, routes, real-time wiring
(Ably + presence + polling), middleware, auth, API contracts, and store
shapes all unchanged. card.color data preserved (rendered as 3px left
border instead of fill).

## Test plan

- [ ] Sign in → dashboard → open existing board → add card from second window → see it sync within 2s
- [ ] Vote, combine, hide-cards, completed-retro read-only, color picker all work
- [ ] Light/dark/system theme cycle works and persists
- [ ] Mobile (iOS Safari + Android Chrome): tab switching, FAB composer, bottom nav, timer FAB
- [ ] Home and Dashboard render in both themes
- [ ] Header avatar shows stable per-user hue

Spec: docs/superpowers/specs/2026-05-19-visual-refresh-design.md
Plan: docs/superpowers/plans/2026-05-19-visual-refresh.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Once approved, merge via GitHub UI or:**

```bash
gh pr merge --merge --auto
```

---

## Self-review

**Spec coverage check:**
- §1 Goal — covered by overall plan goal statement.
- §2 Non-goals — preserved by leaving auth/middleware/Ably/store untouched (tasks 1.*, 2.*, 3.*, 4.*, 5.* all stop at presentation layer).
- §3 Source of truth — handoff referenced throughout.
- §4.1 Hybrid token strategy — Task 1.2 (tokens + shim) + Task 4 PRs (component migration).
- §4.2 Geist via next/font — Task 1.1.
- §4.3 ThemeToggle 3-state — Task 4.2.
- §5 Phased PR plan — PRs 1–5 in plan are 1:1 with spec.
- §6 Token mapping — Task 1.2 (shim block in styles/index.css).
- §7 Always-on regression smoke — referenced in Tasks 1.3, 3.11, 4.8, 5.10.
- §8 PR-specific verification — referenced per-PR.
- §9 Risk register — addressed by mitigations (shim, hue spacing, build/typecheck gates).
- §10 Implementation details — each subsection has a task (avatarHue 3.1, font loading 1.1, card color 3.3, template colors 4.6, logo 4.1, favicon 5.8).
- §11 Intentional deviations — implemented as designed (ThemeToggle 4.2, Badge wrapper 2.6, card.color preserved 3.3).
- §12 Out of scope — no tasks for /settings page, admin section, action items list view.
- §13 Branch + deploy — Tasks P.2, F.1, F.2.

**Placeholder scan:** no TBDs or vague "add error handling" / "handle edge cases" instructions. Each task has actual code or specific change diffs.

**Type/name consistency:** `Pill` uses variant union `'default' | 'tinted' | 'bare'` consistently. `Button` uses `'default' | 'primary' | 'accent' | 'ghost' | 'danger'` consistently. `IconButton` size union `'sm' | 'md' | 'lg'` consistent. `MobileNavKey` union consistent. `avatarBackground(userId)` signature consistent.

No issues found — plan stands.

---

## Plan complete

Saved to `docs/superpowers/plans/2026-05-19-visual-refresh.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. With Jordan's `agent-approval-gate` rule, I'd brief each subagent's scope before launch.

2. **Inline Execution** — I execute tasks directly in this session using `superpowers:executing-plans`, batching with checkpoints for review.

For a refresh of this size (~40 tasks across 5 PRs), **subagent-driven is the better fit** — keeps the main session context lean, and natural review checkpoints align with PR boundaries.
