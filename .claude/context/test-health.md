# Test Health — Retro Board

> Snapshot of test suite status. Last updated: 2026-09-04

## Unit Tests (Vitest 4.1.7)

| Metric | Count |
|--------|-------|
| **Passed** | 82 |
| **Failed** | 0 |
| **Total** | 82 |
| **Test Files** | 13 |

Run: `npx vitest run` (also `npm test`). Duration under 1 s. Covered areas include `lib/entitlements.ts` (on the billing branch), board roles/authority helpers, and utilities. The `stores/boardStore.ts` optimistic-update logic and `hooks/useBoardChannel.ts` dedup remain largely untested.

## E2E Tests

- **Status:** Not configured (no Playwright).
- **Priority flows:** board creation → signup gate (post-paywall), checkout → webhook → entitled, anonymous join on an existing board, voting, facilitator controls, admin login.

## Production Gate

`/deploy-check` runs `tsc --noEmit`, `npm run build`, and the unit tests before arming the push gate. UI changes still ship without automated browser verification; a human eyeball (or the Chrome tools) is required for customer-visible work.
