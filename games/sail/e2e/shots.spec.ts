import { fileURLToPath } from 'node:url';
import { describeScenes } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Broadside inside the Hall: its game menu, the Sea Service, a
 * moment of play, its signature moment, a battered ship and a battle report, at 1280×720. Run
 * with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

describeScenes(
  {
    id: 'sail',
    ready: "window.__ready === true && !!document.querySelector('#menu.open [data-deck=\"menu\"]')",
  },
  MEDIA,
  [
    { name: 'title', waitMs: 2500 },
    {
      name: 'service',
      stage: async (page) => {
        await page.keyboard.press('s');
      },
      waitMs: 1200,
    },
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
    {
      // the Chesapeake after a hard fight: shot holes, a topgallant gone, sails holed, guns lost
      name: 'damage',
      query:
        'scenario=13&ship=1&seed=3&intro=0&hud=0&focus=0&yaw=200&pitch=8&dist=62' +
        '&stage=0:hull=4,rig1=4,rig2=1,rig3=2,gunL=2,gunR=2,carL=2,carR=2',
      ready: 'window.__ready === true',
      waitMs: 3500,
    },
    {
      // the first action of the Sea Service, fought by the counsel to its report
      name: 'report',
      query: 'mission=first-command&intro=0&cine=0&auto=14&autoorders=counsel',
      ready: "window.__ready === true && !!document.querySelector('#end.open')",
      waitMs: 1500,
    },
  ],
);
