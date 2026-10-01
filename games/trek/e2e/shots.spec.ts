import { fileURLToPath } from 'node:url';
import { describeScenes } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Trek — Deep Space inside the Hall: its title, a moment of play and its
 * signature moment, at 1280×720. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

describeScenes({ id: 'trek', ready: 'window.__trek?.ready === true' }, MEDIA, [
  { name: 'title', waitMs: 2500 },
  {
    name: 'play',
    query: 'seed=428&difficulty=standard&help=0&autostart=1&cmds=shields up;move 1.5 1;phaser 400',
    waitMs: 3500,
  },
  {
    name: 'signature',
    query: 'seed=428&difficulty=standard&help=0&autostart=1&cmds=shields up;move 1.5 1;lrscan;view',
    waitMs: 7000,
  },
]);
