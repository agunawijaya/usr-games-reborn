import { defineConfig } from 'vite';
import { catalogDevPlugin } from '../../scripts/lib/catalog-dev-plugin.ts';
import { hostedGamesDevPlugin } from '../../scripts/lib/hosted-dev-plugin.ts';

export default defineConfig({
  // GitHub Pages serves the project under /<repo>/; the Pages workflow sets SITE_BASE.
  base: process.env.SITE_BASE ?? '/',
  plugins: [catalogDevPlugin(), hostedGamesDevPlugin()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'es2022',
    // Vite's preload polyfill carries a fetch() call; every browser we target has modulepreload.
    modulePreload: { polyfill: false },
    manifest: true,
  },
});
