import { defineConfig, devices } from '@playwright/test';
import { hostedSuiteConfig } from '../../packages/bridge/testing/hall';
import { GPU_LAUNCH_ARGS } from '../../packages/bridge/testing/shots';

/**
 * Chain Letter's browser runs, in two projects. `workbench` plays the game on its own workbench
 * (port 5291); `hall` opens it inside a Hall dev server on port 5341 (or `HALL_PORT`), never
 * shared with another session. The hero frames and documentation screenshots run only with
 * `MEDIA=1` and `--grep @hero` or `--grep @shots`. One worker: other sessions share the machine.
 */
process.env.HALL_PORT ??= '5341';
const hall = hostedSuiteConfig();
const media = Boolean(process.env.MEDIA);

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  grepInvert: media ? undefined : /@hero|@shots/,
  use: {
    ...devices['Desktop Chrome'],
    deviceScaleFactor: 1,
    launchOptions: { args: GPU_LAUNCH_ARGS },
  },
  projects: [
    {
      name: 'workbench',
      testMatch: ['**/game.spec.ts', '**/hero.spec.ts', '**/shots.spec.ts'],
      use: { baseURL: 'http://localhost:5291', viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'hall',
      testMatch: ['**/hall.spec.ts'],
      use: { baseURL: hall.baseURL, viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @usr-games/game-letters dev',
      url: 'http://localhost:5291',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    hall.webServer,
  ],
});
