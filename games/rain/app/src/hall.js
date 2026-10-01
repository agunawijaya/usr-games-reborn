// Rain inside /usr/games Reborn. The Hall runs this page in a frame and listens over the
// bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge script
// is missing or reports `hosted: false`, and every call below does nothing.
//
// A screensaver is a toy: the Hall grants a small amount of XP once a day for a visit in which
// the player did something (a key or a click), never for leaving it running, plus six small
// packages for things the player chooses to do with the pond.

const hall = globalThis.UsrGamesBridge?.connectToHall({ id: 'rain' }) ?? null;
const openedAt = performance.now();
const installed = new Set();
/** Delays (ms between frames) at or below this are a downpour; 0 paces like a 9600-baud line. */
const DOWNPOUR_DELAY = 10;
let visitReported = false;

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

// The H key hides every control (a class on <body>); watching for it keeps controls.js as it was.
new MutationObserver(() => {
  if (document.body.classList.contains('hidden-ui')) install('lights-out');
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

export function noteDelay(delay) {
  if (delay === 0) install('nine-six-hundred');
  else if (delay <= DOWNPOUR_DELAY) install('downpour');
}

/** A view the player asked for (not the one chosen at start-up). */
export function noteView(view) {
  if (view === 'split') install('side-by-side');
  if (view === 'classic') install('back-to-1980');
}

export function noteSound(on) {
  if (on) install('hear-the-pond');
}

// Key art for the Hall: the pond once the first rings have spread across it.
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
