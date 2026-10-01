import { defineConfig } from 'vite';

// The base comes from the Hall's build (`--base /play/fixture-vite/`). The modulepreload
// polyfill is left out: it is a `fetch` call the network guard would rightly question, and
// every browser the collection supports preloads modules natively.
export default defineConfig({
  build: {
    modulePreload: { polyfill: false },
  },
});
