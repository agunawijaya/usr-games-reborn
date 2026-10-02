// The Rune Gates inside /usr/games Reborn. The Hall runs this page in a frame and listens over
// the bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from the desk (desk.mjs), which follows every delve: a delve is won
// when its wumpus is slain and lost when the delver is; leaving one half-way reports a quit.

const pauseHandlers = { pause: () => {}, resume: () => {} };
const hall =
  globalThis.UsrGamesBridge?.connectToHall({
    id: 'wump-classic',
    onPause: () => pauseHandlers.pause(),
    onResume: () => pauseHandlers.resume(),
  }) ?? null;
const installed = new Set();
const XP_SLAIN = 10;
const XP_PER_SEAL = 3;
const PROMOTION_XP = 6;

/** True inside the Hall's frame; on its own the game has no Hall to go back to. */
export const hostedInHall = Boolean(hall?.hosted);

/** @param {() => void} pause @param {() => void} resume */
export function onHallPause(pause, resume) {
  pauseHandlers.pause = pause;
  pauseHandlers.resume = resume;
}

/** The report's "Back to the Hall". */
export function leaveForHall() {
  hall?.navigate('hall');
}

/** The game menu is the title screen: there Escape leads back to the Hall. */
export function setOnGameMenu(active) {
  hall?.setTitleScreen(active);
}

/** One of the packages in manifest.json; each is offered to the Hall once per visit. */
export function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

/**
 * @param {'win' | 'loss' | 'quit'} outcome
 * @param {{ slain: boolean, moves: number, arrowsLeft: number, batRides: number }} summary
 * @param {{ seals: number, promoted: boolean, daily: boolean, seconds: number }} details
 */
export function reportDelve(outcome, summary, details) {
  if (!hall) return;
  const xpEvents = [];
  if (outcome === 'win') {
    xpEvents.push({ id: 'slain', xp: XP_SLAIN });
    if (details.seals > 0) xpEvents.push({ id: 'seals', xp: details.seals * XP_PER_SEAL });
    if (details.promoted) xpEvents.push({ id: 'promotion', xp: PROMOTION_XP });
  }
  hall.result({
    outcome,
    // A slain wumpus is worth 50, each arrow kept 10 and each seal 15.
    score: summary.slain ? 50 + summary.arrowsLeft * 10 + details.seals * 15 : 0,
    stats: {
      wumpusesSlain: summary.slain ? 1 : 0,
      moves: summary.moves,
      arrowsLeft: summary.arrowsLeft,
      batRides: summary.batRides,
      seals: details.seals,
    },
    xpEvents,
    daily: details.daily,
    durationSeconds: details.seconds,
  });
}

/**
 * Key art for the Hall: the cave behind the game menu, once its layers have been drawn. The five
 * layers are flattened into one canvas in the same task, as posterFromCanvas asks.
 * @param {HTMLCanvasElement[]} layers
 */
export function offerPoster(layers) {
  if (!hall?.hosted || layers.length === 0) return;
  const flat = document.createElement('canvas');
  flat.width = layers[0].width;
  flat.height = layers[0].height;
  const ctx = flat.getContext('2d');
  ctx.fillStyle = '#04060a';
  ctx.fillRect(0, 0, flat.width, flat.height);
  for (const layer of layers) ctx.drawImage(layer, 0, 0);
  hall.posterFromCanvas(flat);
}
