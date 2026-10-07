// Draws every picture of the five rooms into the page, starts the scene animations and joins the
// Hall. The game itself (index.html's script) runs as the port shipped it; it reaches the few
// pictures it swaps at the end of a cipher through window.HoldArt and TombArt, and sets the
// bridge's air monitors through window.VoidArt.

import { alchemist } from './art/alchemist.mjs';
import { captain } from './art/captain.mjs';
import { templeCourt, templeCourtBowed } from './art/court.mjs';
import { bat, candelabrum, cloaked, count, cryptWall, werewolf } from './art/crypt.mjs';
import { barrel, chest, flotsam, FLOTSAM, holdWall, wallTorch } from './art/hold.mjs';
import { atom, distillation, droppingFunnel, labWall, periodicChart, proportions, teslaCoil } from './art/lab.mjs';
import { startArcs } from './art/lightning.mjs';
import { paintPoster } from './poster.mjs';
import { remains, REMAINS } from './art/remains.mjs';
import { apis, deity, lotusTorch, mummy, sarcophagus, sphinx } from './art/tomb.mjs';
import { waterSurface } from './art/water.mjs';
import { astronaut, bridge, showGasLevels, spaceBackdrop, spaceplane, trussStation, wheelStation } from './art/void.mjs';
import { hostedInHall, offerPoster, onHallMotion, onHallPause, reportCipher } from './hall.mjs';

const painters = {
  captain, holdWall, wallTorch, barrel, chest,
  labWall, periodicChart, proportions, atom, teslaCoil, distillation, droppingFunnel, alchemist,
  sarcophagus, sphinx, apis, mummy, templeCourt, lotusTorch,
  cryptWall, count, werewolf, cloaked, candelabrum,
  spaceBackdrop, bridge, trussStation, wheelStation, spaceplane, astronaut,
  deity: ({ id }, el) => deity(el.dataset.kind, { id }),
  bat: ({ id }, el) => bat({ id, phase: Number(el.dataset.phase ?? 0) }),
};

let serial = 0;
document.querySelectorAll('[data-art]').forEach((el) => {
  el.innerHTML = painters[el.dataset.art]({ id: `${el.dataset.art}-${serial++}` }, el);
});
globalThis.HoldArt = { flotsam, FLOTSAM, remains, REMAINS, waterSurface };
globalThis.TombArt = { templeCourt, templeCourtBowed };
globalThis.VoidArt = { showGasLevels };

// —— motion: the player's (or the Hall's) reduced-motion setting, and the Hall's pause ——
const root = document.documentElement;
const motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
let reduced = Boolean(motionQuery?.matches);
let paused = false;

const arcs = startArcs({
  scene: document.querySelector('.scene-lab'),
  coil: document.querySelector('.lab-tesla'),
  layer: document.getElementById('labArcs'),
});

function applyMotion() {
  root.classList.toggle('reduced-motion', reduced);
  root.classList.toggle('is-paused', paused);
  const still = reduced || paused;
  for (const svgEl of document.querySelectorAll('svg')) {
    if (still) svgEl.pauseAnimations?.();
    else svgEl.unpauseAnimations?.();
  }
  arcs.setRunning(!still);
}
motionQuery?.addEventListener?.('change', (event) => {
  reduced = event.matches;
  applyMotion();
});
onHallMotion((value) => {
  reduced = value;
  applyMotion();
});
onHallPause(
  () => {
    paused = true;
    applyMotion();
  },
  () => {
    paused = false;
    applyMotion();
  },
);
applyMotion();

// —— the Hall hears every cipher ——
let startedAt = performance.now();
document.addEventListener('gallows:start', () => {
  startedAt = performance.now();
});
document.addEventListener('gallows:end', (event) => {
  reportCipher(event.detail, (performance.now() - startedAt) / 1000);
});

// —— key art for the Hall: the hold, the captain and his lantern ——
if (hostedInHall) {
  paintPoster()
    .then(offerPoster)
    .catch(() => {
      // The build-time still stands in when the poster cannot be painted.
    });
}

root.dataset.artReady = 'true';
document.dispatchEvent(new CustomEvent('gallows:art-ready'));
