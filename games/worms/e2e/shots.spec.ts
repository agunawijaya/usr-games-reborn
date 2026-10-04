import { fileURLToPath } from 'node:url';
import { inGame } from '../../../packages/bridge/testing/hall';
import { describeScenes } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Abyssal Worms inside the Hall: its title, a moment of play, its
 * signature moment and the logbook beside a ring on the floor, at 1280×720. Run with `SHOTS=1`,
 * see playwright.config.ts.
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
  {
    name: 'logbook',
    query: 'args=-n 8 -l 26 -d 60&cell=22&warm=200',
    // One crossing already logged, a curl marked on the floor at the head nearest the middle, one
    // species met, and the logbook open beside it.
    stage: async (page) => {
      const mark = (kind: string) =>
        inGame(
          page,
          `(() => {
            const { world, logbook } = window.__abyss;
            const distance = (w) => {
              const x = w.xpos[w.head], y = w.ypos[w.head];
              return x < 0 ? Infinity : Math.hypot(x / world.last - 0.4, y / world.bottom - 0.5);
            };
            const worm = world.worms.reduce((best, w, n) => (distance(w) < distance(world.worms[best]) ? n : best), 0);
            const w = world.worms[worm];
            const [x, y] = [w.xpos[w.head], w.ypos[w.head]];
            logbook.watch.active = { kind: '${kind}', x, y, worm, born: 0, until: 1e12 };
          })()`,
        );
      await mark('crossing');
      await page.keyboard.press('l');
      // Lets the Hall's toasts for that first sighting pass before the picture.
      await page.waitForTimeout(6500);
      await mark('curl');
      await page.keyboard.press('j');
      await page.keyboard.press('b');
    },
    waitMs: 1200,
  },
]);
