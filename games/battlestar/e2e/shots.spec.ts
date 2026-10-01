import { fileURLToPath } from 'node:url';
import { inGame } from '../../../packages/bridge/testing/hall';
import { describeScenes } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Pajamas to Paradise inside the Hall: its title, a moment of play and its
 * signature moment, at 1280×720. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

describeScenes({ id: 'battlestar', ready: 'window.__ready === true' }, MEDIA, [
  { name: 'title', waitMs: 2000 },
  {
    name: 'play',
    query: 'fresh=1&seed=7',
    stage: (page) =>
      inGame(
        page,
        "window.__bs.place({ room: 92, facing: 'n', time: 40, worn: [15] }); window.__bs.send('look')",
      ),
    waitMs: 3000,
  },
  {
    name: 'signature',
    query: 'fresh=1&seed=7',
    stage: (page) => inGame(page, "window.__bs.place({ room: 68, facing: 'n', time: 30 })"),
    waitMs: 3000,
  },
]);
