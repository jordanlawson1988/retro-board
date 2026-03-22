# /test-report — Run Tests and Update Health Snapshot

Run the full test suite and update the persistent test health file so future sessions have accurate test status.

## Step 1: Check for Test Framework

```bash
grep -E '"vitest"|"jest"|"@playwright/test"' package.json
```

If no test framework is installed, update `.claude/context/test-health.md` with:
- Status: No test framework configured
- Date: today's date
- Recommend installing Vitest + Playwright

Then skip to Step 4 and report "No tests to run — framework not yet configured."

## Step 2: Run Tests (if framework exists)

```bash
npm run test:unit -- --reporter=verbose 2>&1
```

If no `test:unit` script, try:
```bash
npm test -- --run --reporter=verbose 2>&1
```

Capture the full output including pass/fail counts and error messages.

## Step 3: Update Test Health File

Write the results to `.claude/context/test-health.md` with this structure:

```markdown
# Test Health — Retro Board

> Auto-updated snapshot of test suite status. Last updated: [TODAY'S DATE]

## Unit Tests

| Metric | Count |
|--------|-------|
| **Passed** | [N] |
| **Failed** | [N] |
| **Total** | [N] |
| **Test Files** | [N] ([N] failing) |

### Failing Files
[For each failing file, include file name, error type, affected tests, and root cause if identifiable]

### Passing Files
[Table of passing files with test counts]

## E2E Tests
[Status — configured/not configured, blockers]

## Production Gate
[Whether the test suite currently passes any merge requirements]
```

## Step 4: Report

Output a brief summary:
- Pass/fail ratio (or "no tests configured")
- Whether any production gate exists and its status
- Any new failures since the last snapshot (compare with previous `.claude/context/test-health.md` if it exists)

## Important
- Do NOT fix test failures — just report them
- Do NOT install test frameworks — just report their absence
- Compare against the previous test-health.md to identify regressions
- If all tests pass, confirm the gate is clear
