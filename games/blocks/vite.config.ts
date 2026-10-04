import { defineConfig } from 'vite';

/**
 * The game's own workbench on port 5285: `dev/` stages scenes (hero frames, screens) with the
 * real renderer, outside the Hall. The Hall bundles the game from `src/index.ts` instead.
 */
export default defineConfig({
  root: 'dev',
  server: { port: 5285, strictPort: true, fs: { allow: ['../../..'] } },
});
