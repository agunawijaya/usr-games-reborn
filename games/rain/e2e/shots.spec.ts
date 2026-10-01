import { fileURLToPath } from 'node:url';
import { describeScenes } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Rain on Still Water inside the Hall: its title, a moment of play and its
 * signature moment, at 1280×720. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

describeScenes({ id: 'rain', ready: 'window.__ready === true' }, MEDIA, [
  { name: 'title', waitMs: 1500 },
  { name: 'play', waitMs: 7000 },
  { name: 'signature', stage: (page) => page.keyboard.press('2'), waitMs: 6000 },
]);
