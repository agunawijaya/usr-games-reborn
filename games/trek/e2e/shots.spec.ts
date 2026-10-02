import { fileURLToPath } from 'node:url';
import { describeScenes } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Trek — Deep Space inside the Hall: its game menu, the Frontier Tour,
 * a moment of play, its signature moment and a mission report, at 1280×720. Run with `SHOTS=1`,
 * see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

describeScenes({ id: 'trek', ready: 'window.__trek?.ready === true' }, MEDIA, [
  { name: 'title', waitMs: 2500 },
  {
    name: 'tour',
    stage: async (page) => {
      await page.keyboard.press('t');
    },
    waitMs: 1500,
  },
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
  {
    // Sortie 1 flown by the bridge computer's first suggestion each turn, to its report.
    name: 'report',
    query:
      'help=0&autostart=1&mission=shakedown&cmds=move 10.5 1;shields up;phaser 576;phaser 100;move 1.5 1;phaser 930;phaser 100;move 9.9 2;phaser 929',
    ready: "window.__trek?.ready === true && window.__trek.page === 'report'",
    waitMs: 1500,
  },
]);
