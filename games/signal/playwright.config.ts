import { defineConfig, devices } from '@playwright/test';
import { hostedSuiteConfig } from '../../packages/bridge/testing/hall';
import { GPU_LAUNCH_ARGS } from '../../packages/bridge/testing/shots';

/**
 * Dits & Daws in the browser. `workbench` plays the game on its own workbench (port 5293);
 * `--grep @hero` renders the hero frames and `--grep @shots` the screenshots into docs/media.
 * `hall` opens it inside a Hall dev server on port 5333 (or `HALL_PORT`), never shared with
 * another session. One worker: other sessions often share the machine.
 */
process.env.HALL_PORT ??= '5333';
const hall = hostedSuiteConfig();

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    deviceScaleFactor: 1,
    launchOptions: { args: GPU_LAUNCH_ARGS },
  },
  projects: [
    {
      name: 'workbench',
      testMatch: ['**/game.spec.ts', '**/hero.spec.ts', '**/shots.spec.ts'],
      use: { baseURL: 'http://localhost:5293', viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'hall',
      testMatch: ['**/hall.spec.ts'],
      use: { baseURL: hall.baseURL, viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @usr-games/game-signal dev',
      url: 'http://localhost:5293',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    hall.webServer,
  ],
});
