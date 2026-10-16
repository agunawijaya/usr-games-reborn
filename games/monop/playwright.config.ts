import { defineConfig, devices } from '@playwright/test';
import { GPU_LAUNCH_ARGS } from '../../packages/bridge/testing/shots';
import { HALL_PORT, WORKBENCH_PORT } from './e2e/ports';

/**
 * Deeds & Dice's browser runs: the game on its own workbench (port 5294) and inside a Hall of
 * its own (port 5314, `MONOP_HALL_PORT` to move it), both started if they are not running. The
 * hero frames run only with `--grep @hero`. One worker: other sessions share the machine, and
 * the world is GPU-heavy.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${WORKBENCH_PORT}`,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    launchOptions: { args: GPU_LAUNCH_ARGS },
  },
  webServer: [
    {
      command: 'pnpm --filter @usr-games/game-monop dev',
      url: `http://localhost:${WORKBENCH_PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @usr-games/hall exec vite --port ${HALL_PORT} --strictPort`,
      url: `http://localhost:${HALL_PORT}/`,
      reuseExistingServer: true,
      timeout: 90_000,
    },
  ],
});
