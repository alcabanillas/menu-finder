import { defineConfig, devices } from '@playwright/test';
import { currentE2eEnvironment, E2E_PORT } from './e2e/support/e2e-environment';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  // `.test.ts` files in e2e/support/ belong to Vitest (MF-49 design D2).
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/support/global-setup.ts',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Production build and start, locally and in CI: a second `next dev` cannot run in this directory (MF-49 design D2).
  // Its own port and never a server already running: a `pnpm dev` on 3000 points to the app database (MF-49).
  webServer: {
    command: `pnpm build && pnpm start -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { ...currentE2eEnvironment() },
  },
});
