// Abyssal Worms inside /usr/games Reborn. The Hall runs this page in a frame and listens over
// the bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// A screensaver is a toy: the Hall grants a small amount of XP once a day for a visit in which
// the player did something (a key or a click), never for leaving it running, plus six small
// packages for moments the controller already knows about.

const hall = globalThis.UsrGamesBridge?.connectToHall({ id: 'worms' }) ?? null;
const openedAt = performance.now();
const installed = new Set();
const LETTERS_FOR_A_FEAST = 1000;
let visitReported = false;
let lettersEaten = 0;

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

function reportVisit() {
  if (!hall || visitReported) return;
  visitReported = true;
  hall.result({
    outcome: 'complete',
    durationSeconds: Math.round((performance.now() - openedAt) / 1000),
  });
}

// Moving the pointer only wakes the controls; a key or a click is a real visit.
for (const type of ['keydown', 'pointerdown']) {
  window.addEventListener(type, reportVisit, { capture: true, passive: true });
}

export function noteView(view) {
  if (view === 'classic') install('back-to-the-terminal');
}

export function noteSplitMoved() {
  install('side-by-side');
}

export function noteOptions(previous, next) {
  if (next.trail && !previous.trail) install('luminous-trail');
  if (next.number >= 8) install('full-spectrum');
}

export function noteCommandLine() {
  install('command-line');
}

/** Called after every engine step while the letter field is on. */
export function noteLettersEaten(count) {
  if (!hall || count === 0) return;
  lettersEaten += count;
  if (lettersEaten >= LETTERS_FOR_A_FEAST) install('plankton-feast');
}

// Key art for the Hall: the abyss once the worms have had a few seconds to spread out.
const POSTER_AFTER_MS = 5000;
let posterSent = false;

export function posterWanted() {
  return !!hall?.hosted && !posterSent && performance.now() - openedAt > POSTER_AFTER_MS;
}

/** Call right after drawing the canvas, in the same task (see the bridge's posterFromCanvas). */
export function offerPoster(canvas) {
  posterSent = true;
  hall.posterFromCanvas(canvas);
}
