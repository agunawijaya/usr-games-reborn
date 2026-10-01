/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /usr/games Reborn: the Hall's build sets the base (`--base <site>/play/robots/`), so the game
// works both at /play/robots/ and on its own dev server at /. The modulepreload polyfill is
// left out because it is a `fetch` call, and the collection makes no network requests.
export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
