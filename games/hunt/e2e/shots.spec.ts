import { fileURLToPath } from 'node:url';
import { describeScenes } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Hunt — Ricochet inside the Hall: its title, a moment of play and its
 * signature moment, at 1280×720. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

describeScenes({ id: 'hunt', ready: 'window.__ready === true' }, MEDIA, [
  { name: 'title', waitMs: 1500 },
  { name: 'play', query: 'autostart=1&seed=1985', waitMs: 6000 },
  {
    name: 'signature',
    query: 'autostart=1&coach=1&seed=7&arena=ricochet&camera=follow',
    waitMs: 4000,
  },
]);
