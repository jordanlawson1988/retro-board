# /status-check — Quick Project Health Dashboard

Run a fast assessment of current project state across git, build, tests, and context files.

## Step 1: Gather Data (run in parallel)

### Git State
- `git branch --show-current`
- `git status --short`
- `git log --oneline -5`
- `git stash list`
- Count commits ahead of main: `git rev-list --count main..HEAD` (if not on main)

### Build Health
- `npm run build 2>&1 | tail -5` — does the build succeed?

### Test Health
- Read `.claude/context/test-health.md` — when was it last updated?
- If stale (>24 hours or doesn't exist), suggest running `/test-report`

### Context Freshness
- Check modification dates of all files in `.claude/context/`
- Flag any that are older than 7 days as potentially stale

## Step 2: Output Dashboard

```
======================================================
                PROJECT STATUS CHECK
======================================================

  Project:  Retro Board
  Branch:   [branch] ([N] commits ahead of main)
  Status:   [clean / uncommitted changes / stashed work]
  Last:     [most recent commit message]

  Build:    [PASS / FAIL]
  Tests:    [N passed, N failed] (as of [date]) OR [not configured]
  Gate:     [CLEAR / BLOCKED — reason] OR [no gate configured]

  Context Files:
    test-health.md        [fresh / stale / missing]
    feature-status.md     [fresh / stale / missing]
    architecture-notes.md [fresh / stale / missing]
    business-context.md   [fresh / stale / missing]

======================================================
```

## Step 3: Recommendations

Based on the dashboard, suggest next actions:
- If tests are not configured: "Consider adding Vitest for unit testing"
- If context is stale: "Run `/context-refresh` to update living context files"
- If build is broken: identify the error
- If uncommitted changes exist: note them
- If on migration branch and not merged to main: note the branch status

## Important
- This is a read-only diagnostic — do not modify any files
- Keep the output concise — this should complete in under 30 seconds
- If build takes too long, skip it and note "build check skipped"
