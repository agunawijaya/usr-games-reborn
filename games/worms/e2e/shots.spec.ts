import { fileURLToPath } from 'node:url';
import { describeScenes } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Abyssal Worms inside the Hall: its title, a moment of play and its
 * signature moment, at 1280×720. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

// The worms' own staging parameters: `warm` runs that many steps before the first frame.
describeScenes({ id: 'worms', ready: 'window.__abyss?.ready === true' }, MEDIA, [
  { name: 'title', query: 'args=-n 8 -l 28 -d 90&cell=24&warm=60', waitMs: 1200 },
  { name: 'play', query: 'args=-t -n 8 -l 28 -d 35&cell=22&warm=260', waitMs: 4500 },
  {
    name: 'signature',
    query: 'args=-f -n 6 -l 24 -d 35&view=split&warm=180',
    waitMs: 1500,
  },
]);
