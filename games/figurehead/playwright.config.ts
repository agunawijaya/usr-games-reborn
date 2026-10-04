import { defineConfig, devices } from '@playwright/test';
import { hostedSuiteConfig } from '../../packages/bridge/testing/hall';

/**
 * Figurehead inside the Hall. Run with `pnpm exec playwright test -c games/figurehead`. The suite
 * starts its own Hall dev server on port 5321 (or `HALL_PORT`), so it never shares one with
 * another session. `SHOTS=1` runs only the documentation screenshots (shots.spec.ts).
 */
process.env.HALL_PORT ??= '5321';
const { baseURL, webServer } = hostedSuiteConfig();
const shots = Boolean(process.env.SHOTS);

export default defineConfig({
  testDir: './e2e',
  testMatch: shots ? '**/shots.spec.ts' : '**/*.spec.ts',
  testIgnore: shots ? [] : ['**/shots.spec.ts'],
  outputDir: 'test-results',
  timeout: 120_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
  },
  webServer,
});
