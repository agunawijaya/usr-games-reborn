import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/kit',
      'packages/bridge',
      'packages/words',
      'apps/hall',
      'scripts',
      // Native games join automatically once they ship a vitest config.
      'games/*/vitest.config.ts',
    ],
  },
});
