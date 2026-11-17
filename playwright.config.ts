import { defineConfig, devices } from '@playwright/test';

// Load .env.local the way Next does so the safety check below sees NEON_BRANCH.
try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local: the NEON_BRANCH check below fails with a clear message.
}

// These tests create boards and write to the database the dev server points at.
// Refuse to run unless that database is the Neon dev branch.
if (process.env.NEON_BRANCH !== 'dev') {
  throw new Error(
    `Refusing to run e2e: NEON_BRANCH is "${process.env.NEON_BRANCH ?? ''}", expected "dev". ` +
      'Point .env.local at the Neon dev branch and set NEON_BRANCH=dev.'
  );
}

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
const port = new URL(baseURL).port || '3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
