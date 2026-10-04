import { defineConfig } from 'vite';

/**
 * The game's own workbench on port 5320: `dev/` mounts the game with a stand-in for the Hall's
 * context, and stages single scenes (the ship's portrait, the chart) for the art. The Hall
 * bundles the game from `src/index.ts` instead.
 */
export default defineConfig({
  root: 'dev',
  server: { port: 5320, strictPort: true, fs: { allow: ['../../..'] } },
});
