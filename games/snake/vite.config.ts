import { defineConfig } from 'vite';

/**
 * The game's own workbench on port 5276: `dev/` mounts the game with a stand-in for the Hall's
 * context and stages single scenes for the hero frames and screenshots. The Hall bundles the
 * game from `src/index.ts` instead.
 */
export default defineConfig({
  root: 'dev',
  server: { port: 5276, strictPort: true, fs: { allow: ['../../..'] } },
});
