# /project-health — Comprehensive Project Health Dashboard

Deep health assessment across all project dimensions. More thorough than `/status-check` — use this for periodic check-ins or before major milestones.

## Step 1: Gather All Data (run in parallel where possible)

### Git Health
- `git log --oneline -20` — recent commit history
- `git branch -a` — all branches (local + remote)
- `git branch --merged main` — branches safe to clean up
- `git stash list` — stashed work
- `git log --oneline --since="7 days ago" | wc -l` — weekly commit velocity
- Check for divergence between local and remote branches

### Build Health
```bash
npm run build 2>&1
```
Capture full output. Note any warnings (not just errors).

### Test Health
Check if test framework is installed. If so:
```bash
npm run test:unit -- --reporter=verbose 2>&1
```
Full test suite results — update `.claude/context/test-health.md` with fresh data.

If no test framework, note "not configured" and skip.

### Dependency Health
```bash
npm outdated 2>&1
```
Categorize outdated packages:
- **Critical:** Major version behind (breaking changes likely)
- **Moderate:** Minor version behind
- **Low:** Patch version behind

### Code Quality
```bash
npm run lint 2>&1
```
Count lint warnings and errors.

```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" app/ lib/ components/ stores/ hooks/ utils/ | wc -l
```
Total TODO/FIXME count.

### Database Health
- Check `scripts/migrate.sql` exists and is readable
- Count tables defined in migration

### File Metrics
- `find app lib components stores hooks utils types -name "*.ts" -o -name "*.tsx" | wc -l` — total source files
- Check for unusually large files (>500 lines)

## Step 2: Output Dashboard

```
==============================================================
                    PROJECT HEALTH REPORT
                       Retro Board
                       [DATE]
==============================================================

  GIT
  ------------------------------------------------------------
  Branch:          [current branch]
  Commits (7d):    [N]
  Total branches:  [N] local, [N] remote
  Stale branches:  [list any merged branches to clean up]
  Stashed work:    [N] stashes
  Uncommitted:     [clean / N files modified]

  BUILD
  ------------------------------------------------------------
  Status:          [PASS / FAIL]
  Warnings:        [N]
  Build time:      [~Ns]

  TESTS
  ------------------------------------------------------------
  Unit:            [N passed, N failed] OR [not configured]
  E2E:             [configured / not configured]
  Production Gate: [CLEAR / BLOCKED / no gate configured]

  DEPENDENCIES
  ------------------------------------------------------------
  Outdated:        [N] critical, [N] moderate, [N] patch
  Notable:         [list any critical outdated packages]

  CODE QUALITY
  ------------------------------------------------------------
  Lint errors:     [N]
  Lint warnings:   [N]
  TODO/FIXME:      [N] across codebase
  Source files:    [N] (.ts/.tsx)
  Large files:     [list any >500 lines]

  DATABASE
  ------------------------------------------------------------
  Tables:          [N] defined in scripts/migrate.sql
  Migration file:  [present / missing]

  FEATURE PROGRESS
  ------------------------------------------------------------
  Core features:   [N]/[N] complete
  Admin features:  [N]/[N] complete
  Blockers:        [list or "none"]

  TECH DEBT
  ------------------------------------------------------------
  [Table from architecture-notes.md, refreshed]

==============================================================

  RECOMMENDATIONS
  ------------------------------------------------------------
  [Prioritized list of actions based on findings]

==============================================================
```

## Step 3: Update Context Files

After gathering all this data, update the relevant `.claude/context/` files:
- `test-health.md` — with fresh test results (or "not configured" status)
- `architecture-notes.md` — with dependency versions and tech debt changes

## Important
- This is a read-only + context-update command — do not fix issues, just report them
- Prioritize recommendations by impact: blockers first, then high-severity debt, then housekeeping
- If any step times out (especially build), note it and continue with other checks
- Expected runtime: 2-5 minutes depending on build speed
