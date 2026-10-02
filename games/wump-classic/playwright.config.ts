import { defineConfig, devices } from '@playwright/test';
import { hostedSuiteConfig } from '../../packages/bridge/testing/hall';
import { GPU_LAUNCH_ARGS } from '../../packages/bridge/testing/shots';

/**
 * The Rune Gates (wump-classic) inside the Hall. Run with
 * `pnpm exec playwright test -c games/wump-classic`. The suite starts its own Hall dev server on
 * port 5296 (or `HALL_PORT`), so it never shares one with another session. One worker: the
 * machine running these suites is often busy with other work.
 */
process.env.HALL_PORT ??= '5296';
const { baseURL, webServer } = hostedSuiteConfig();

// `SHOTS=1` runs only the documentation screenshots.
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
    // The cave's glow and wind are Canvas 2D; the flags keep this suite launched like the other
    // hosted games', whose screenshots need the machine's GPU.
    launchOptions: { args: GPU_LAUNCH_ARGS },
  },
  webServer,
});
