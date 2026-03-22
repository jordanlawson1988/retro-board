# /context-refresh — Refresh All Living Context Files

Re-read the current state of the project and update all `.claude/context/` files to reflect reality. Run this when context files are stale or at the start of a new session.

## Step 1: Refresh Test Health

Check whether a test framework is installed:

```bash
grep -E '"vitest"|"jest"|"@playwright/test"' package.json
```

If a test framework exists, run the test suite:
```bash
npm run test:unit -- --reporter=verbose 2>&1
```

Parse results and rewrite `.claude/context/test-health.md` following the format established in that file. Include:
- Pass/fail/todo counts
- Failing files with error details
- Passing files with test counts
- E2E test status
- Production gate status

If no test framework exists, update the file to reflect "not configured" with today's date.

## Step 2: Refresh Feature Status

Scan the codebase to verify feature completion:

1. Check `app/` routes for all active pages and API endpoints
2. Check `components/` for feature completeness
3. Check `stores/` for state management coverage
4. Check `hooks/` for realtime/timer/presence functionality
5. Compare against `.claude/context/feature-status.md` and update any changes

Update the feature tracker with:
- Any new features added
- Status changes
- New gaps or future work items discovered

## Step 3: Refresh Architecture Notes

### Dependencies
Read `package.json` and compare against the dependency versions listed in `.claude/context/architecture-notes.md`. Update any that have changed.

### Tech Debt
Scan for new tech debt:
```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" app/ lib/ components/ stores/ hooks/ utils/ | head -30
```

Update the tech debt table in architecture-notes.md:
- Add new items discovered
- Remove items that have been resolved
- Update severity if conditions changed

### Infrastructure
Verify infrastructure details are still accurate (Vercel, Neon, Ably, Better Auth status).

### File Sizes
Check for large files:
```bash
wc -l stores/boardStore.ts
find app lib components stores hooks utils -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -10
```

## Step 4: Refresh Business Context

Read `.claude/context/business-context.md` and verify it's still accurate. This file changes rarely — only update if:
- Project scope has changed
- New stakeholders or users added
- Technical relationship to other projects changed

If no changes are needed, just update the "Last updated" timestamp.

## Step 5: Output Refresh Report

```
======================================================
              CONTEXT REFRESH COMPLETE
======================================================

  Files Updated:
    test-health.md        [UPDATED / NO CHANGE]
    feature-status.md     [UPDATED / NO CHANGE]
    architecture-notes.md [UPDATED / NO CHANGE]
    business-context.md   [UPDATED / NO CHANGE]

  Key Changes:
    - [bullet list of notable changes, or "All files were current"]

  Staleness Before Refresh:
    [which files were stale and by how many days]

  All context files now reflect project state as of [DATE].

======================================================
```

## Important
- This command ONLY updates `.claude/context/` files — it does not modify source code
- If a context file doesn't exist, create it following the patterns of existing ones
- Always update the "Last updated" date in each file's header
- If tests fail to run (build error, missing deps), note the failure in test-health.md rather than leaving it stale
