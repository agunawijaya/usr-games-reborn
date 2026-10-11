import { defineConfig, devices } from '@playwright/test';
import { hostedSuiteConfig } from '../../packages/bridge/testing/hall';
import { GPU_LAUNCH_ARGS } from '../../packages/bridge/testing/shots';

/**
 * Number Sprint's browser runs. `workbench` plays the game on its own workbench (port 5292);
 * `--grep @hero` renders the hero frames and `SHOTS=1 … --project shots` the documentation
 * screenshots. `hall` opens it inside a Hall dev server on port 5332 (or `HALL_PORT`), never
 * shared with another session. One worker: other sessions often share the machine.
 */
process.env.HALL_PORT ??= '5332';
const hall = hostedSuiteConfig();
const shots = Boolean(process.env.SHOTS);

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
      testMatch: ['**/game.spec.ts', '**/hero.spec.ts'],
      use: { baseURL: 'http://localhost:5292', viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'hall',
      testMatch: ['**/hall.spec.ts'],
      use: { baseURL: hall.baseURL, viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'hall-shots',
      testMatch: shots ? ['**/hall-shots.spec.ts'] : [],
      use: { baseURL: hall.baseURL, viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'shots',
      testMatch: shots ? ['**/shots.spec.ts'] : [],
      use: { baseURL: 'http://localhost:5292', viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @usr-games/game-arithmetic dev',
      url: 'http://localhost:5292',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    hall.webServer,
  ],
});
