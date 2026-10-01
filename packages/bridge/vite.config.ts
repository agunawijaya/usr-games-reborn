import { fileURLToPath } from 'node:url';
import { defineConfig, type UserConfig } from 'vite';

const packageDir = fileURLToPath(new URL('.', import.meta.url));

/**
 * The bridge ships as two files built from `src/game.ts`: `bridge.mjs` for games with their own
 * bundler, and `bridge.js`, a classic script exposing `window.UsrGamesBridge`, for static games
 * that include it with a single script tag. Both stay unminified: they are tiny, and a game
 * author reading them in dev tools should see real names.
 */
export function bridgeLibraryConfig(outDir = `${packageDir}dist`, write = true): UserConfig {
  return {
    root: packageDir,
    publicDir: false,
    logLevel: 'warn',
    build: {
      outDir,
      emptyOutDir: write,
      write,
      minify: false,
      sourcemap: false,
      target: 'es2022',
      reportCompressedSize: false,
      lib: {
        entry: `${packageDir}src/game.ts`,
        name: 'UsrGamesBridge',
        formats: ['es', 'iife'],
        fileName: (format) => (format === 'es' ? 'bridge.mjs' : 'bridge.js'),
      },
    },
  };
}

export default defineConfig(bridgeLibraryConfig());
