import { defineConfig } from 'vite';

/**
 * Deeds & Dice's own workbench on port 5294: `dev/` mounts the game with a stand-in for the
 * Hall's context and stages single moments for the hero frames and screenshots. The Hall bundles
 * the game from `src/index.ts` instead.
 */
export default defineConfig({
  root: 'dev',
  server: { port: 5294, strictPort: true, fs: { allow: ['../../..'] } },
});
