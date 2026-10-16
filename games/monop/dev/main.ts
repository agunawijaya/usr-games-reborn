import { fontsReady } from './fonts';
import { mountGame } from './game-host';
import { stageScene } from './scenes';

/**
 * The workbench. `?game` plays the whole game outside the Hall (see `game-host.ts`).
 * `?scene=<name>&board=harbour|colony|popup&look=light|dark` stages one moment with the real
 * renderer and interface for the hero frames (`&t=<seconds>` moves the town on first, `&still`
 * draws one frame and stops).
 */
type Ready = { __ready?: boolean };
const params = new URLSearchParams(location.search);

void fontsReady()
  .then(() =>
    params.has('game') ? mountGame(document.getElementById('stage')!) : stageScene(params),
  )
  .then(() =>
    requestAnimationFrame(() => requestAnimationFrame(() => ((window as Ready).__ready = true))),
  );
