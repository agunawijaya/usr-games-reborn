import { defineConfig, devices } from '@playwright/test';
import { GPU_LAUNCH_ARGS } from '../../packages/bridge/testing/shots';
import { HALL_PORT, WORKBENCH_PORT } from './e2e/ports';

/**
 * Gone Fishing's own browser runs: the game on its workbench (port 5295) and inside a Hall of
 * its own (port 5335, `FISH_HALL_PORT` to move it), both started if they are not running. The
 * hero frames (`--grep @hero`), the documentation screens (`--grep @shots`) and the close-up
 * checks (`--grep @look`) write pictures, so they run only when asked for by name. One worker:
 * other sessions often share the machine.
 */
const media = process.argv.some((arg) => /@hero|@shots|@look/.test(arg));

export default defineConfig({
  testDir: './e2e',
  grepInvert: media ? undefined : /@hero|@shots|@look/,
  outputDir: 'test-results',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${WORKBENCH_PORT}`,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    launchOptions: { args: GPU_LAUNCH_ARGS },
  },
  webServer: [
    {
      command: 'pnpm --filter @usr-games/game-fish dev',
      url: `http://localhost:${WORKBENCH_PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    // Pictures come from the workbench alone; only the play-through runs need a Hall.
    ...(media
      ? []
      : [
          {
            command: `pnpm --filter @usr-games/hall exec vite --port ${HALL_PORT} --strictPort`,
            url: `http://localhost:${HALL_PORT}/`,
            reuseExistingServer: true,
            timeout: 90_000,
          },
        ]),
  ],
});
