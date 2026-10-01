import { defineConfig, devices } from '@playwright/test';
import { GPU_LAUNCH_ARGS } from '../../packages/bridge/testing/shots';

/**
 * Skyloom's own browser runs, against its workbench on port 5273. `--grep @hero` renders the
 * hero frames into docs/media/hero/. One worker: the machine is often busy with other sessions.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5273',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    launchOptions: { args: GPU_LAUNCH_ARGS },
  },
  webServer: {
    command: 'pnpm --filter @usr-games/game-atc dev',
    url: 'http://localhost:5273',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
