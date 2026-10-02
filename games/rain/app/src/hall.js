// Rain inside /usr/games Reborn. The Hall runs this page in a frame and listens over the
// bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge script
// is missing or reports `hosted: false`, and every call below does nothing.
//
// A screensaver is a toy: the Hall grants a small amount of XP once a day for a visit in which
// the player did something (a key or a click), never for leaving it running, plus six small
// packages for things the player chooses to do with the pond.
//
// In the Hall the pond follows the Hall's sound and reduced motion (followHall), and it holds
// still, frozen and silent, while the Hall pauses or the tab is hidden, in the Hall or not.

const bridge = globalThis.UsrGamesBridge;
/** The pond's own master level (audio/audio.js), which the Hall's default volume keeps. */
const POND_LEVEL = 0.9;
let game = null; // { audio, setSoundOn, setReducedMotion } from main.js, once the pond is up
let soundToApply = null; // the Hall's latest { volume, muted }, until it reaches the pond
let hallReducedMotion = null;
// The bridge starts out paused, without telling, when the page opens in a hidden tab.
let heldStill = Boolean(bridge) && document.hidden;
let resumeAudioAfterHold = false;

const hall =
  bridge?.connectToHall({
    id: 'rain',
    pauseWhenHidden: true,
    onSound: (sound) => { soundToApply = sound; applyHallSound(); },
    onReducedMotion: (reduced) => { hallReducedMotion = reduced; applyHallMotion(); },
    onPause: holdStill,
    onResume: carryOn,
  }) ?? null;
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

/** main.js hands over its audio and two setters once the pond is up. */
export function followHall(handles) {
  game = handles;
  applyHallSound();
  applyHallMotion();
}

// Unmuted, the Hall turns the rain's sound on at its own volume; muted, it turns it off. The
// game's own sound button and M key keep working during the visit, until the Hall's sound
// changes again. Outside the Hall no sound arrives and the pond starts silent, as it always has.
// Only the player's own button counts towards hear-the-pond (noteSound).
function applyHallSound() {
  if (!game || !soundToApply || heldStill) return;
  const level = bridge.soundLevel(soundToApply, POND_LEVEL);
  soundToApply = null;
  game.audio.setVolume(level);
  game.setSoundOn(level > 0);
}

function applyHallMotion() {
  if (!game || hallReducedMotion === null) return;
  game.setReducedMotion(hallReducedMotion);
  // style.css repeats its prefers-reduced-motion rule for this attribute
  document.documentElement.toggleAttribute('data-reduced-motion', hallReducedMotion);
}

function holdStill() {
  heldStill = true;
  const context = game?.audio.context();
  resumeAudioAfterHold = context?.state === 'running';
  if (resumeAudioAfterHold) context.suspend();
}

function carryOn() {
  heldStill = false;
  if (resumeAudioAfterHold) game.audio.context().resume();
  resumeAudioAfterHold = false;
  applyHallSound(); // a change that came in while the pond held still
}

/** The frame loop stands still while this is true. */
export function isHeldStill() {
  return heldStill;
}

// A browser lets a page start sound only after a gesture in it or in the Hall around it. If the
// Hall turned the sound on before there was one (the game opened from a link, say), the first key
// or click here starts it; setting the level again afterwards keeps it in step with the button.
function startSoundOnGesture() {
  const context = game?.audio.context();
  if (context?.state !== 'suspended' || game.audio.isMuted() || heldStill) return;
  context.resume().then(() => game.audio.setMuted(game.audio.isMuted()));
}
if (hall?.hosted) {
  for (const type of ['keydown', 'pointerdown']) {
    window.addEventListener(type, startSoundOnGesture, { capture: true, passive: true });
  }
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
