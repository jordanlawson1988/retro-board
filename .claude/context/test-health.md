# Test Health — Retro Board

> Auto-updated snapshot of test suite status. Last updated: 2026-03-22

## Unit Tests

| Metric | Count |
|--------|-------|
| **Passed** | 0 |
| **Failed** | 0 |
| **Total** | 0 |
| **Test Files** | 0 |

### Status: No Test Framework Configured

There is **no test framework** installed in this project. The `package.json` has no test-related dependencies (no Vitest, Jest, Playwright, or Testing Library). There is no `test` script in `package.json`. The only scripts available are: `dev`, `build`, `start`, `lint`.

### Recommended Setup

To add testing capability:
1. **Unit tests:** Install Vitest (`vitest`, `@testing-library/react`, `jsdom`)
2. **E2E tests:** Install Playwright (`@playwright/test`)
3. **Priority test targets:**
   - `stores/boardStore.ts` (837 lines of business logic, optimistic updates, rollback)
   - `utils/cardColors.ts` (WCAG contrast calculation)
   - `utils/templates.ts` (board template definitions)
   - `utils/export.ts` (Markdown + CSV export)
   - `hooks/useBoardChannel.ts` (Ably event deduplication logic)
   - `hooks/useTimer.ts` (countdown accuracy)

## E2E Tests

- **Status:** Not configured
- **Framework:** None installed
- **Priority flows:** Board creation, card CRUD, voting, facilitator controls, admin login

## Production Gate

No production gate exists — there are no tests to gate on. The current deployment process relies on `npm run build` succeeding and manual testing.
