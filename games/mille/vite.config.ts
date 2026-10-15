import { defineConfig } from 'vite';

/**
 * Detour's own workbench on port 5296: `dev/` stages scenes (hero frames, screens) with the real
 * engine and renderer, outside the Hall. The Hall bundles the game from `src/index.ts` instead.
 */
export default defineConfig({
  root: 'dev',
  server: { port: 5296, strictPort: true, fs: { allow: ['../../..'] } },
});
