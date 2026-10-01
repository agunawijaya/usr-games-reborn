import { fileURLToPath } from 'node:url';
import { describeScenes } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Broadside inside the Hall: its title, a moment of play and its
 * signature moment, at 1280×720. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

describeScenes(
  {
    id: 'sail',
    ready: "window.__ready === true && !!document.querySelector('#menu.open [data-sc]')",
  },
  MEDIA,
  [
    { name: 'title', waitMs: 2500 },
    {
      name: 'play',
      query: 'scenario=13&ship=1&seed=4&intro=0',
      ready: 'window.__ready === true',
      waitMs: 3000,
    },
    {
      name: 'signature',
      query:
        'scenario=13&ship=1&seed=4&intro=0&stage=0:row=10,col=38,dir=3;1:row=13,col=38,dir=3' +
        '&auto=1&cine=0&last=show&readyAt=fire&readyDelay=700',
      ready: 'window.__ready === true',
      waitMs: 500,
    },
  ],
);
