import { defineConfig, devices } from '@playwright/test';
import { hostedSuiteConfig } from '../../packages/bridge/testing/hall';
import { GPU_LAUNCH_ARGS } from '../../packages/bridge/testing/shots';

/**
 * Before the Tide's browser runs, in two projects. `workbench` plays the game on its own
 * workbench (port 5290); `--grep @hero` renders the hero frames. `hall` opens it inside a Hall
 * dev server on port 5330 (or `HALL_PORT`), never shared with another session; `SHOTS=1` takes
 * the documentation screenshots there. One worker: other sessions often share the machine.
 */
process.env.HALL_PORT ??= '5330';
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
      use: { baseURL: 'http://localhost:5290', viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'hall',
      testMatch: shots ? ['**/shots.spec.ts'] : ['**/hall.spec.ts'],
      use: { baseURL: hall.baseURL, viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @usr-games/game-hangman dev',
      url: 'http://localhost:5290',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    hall.webServer,
  ],
});
