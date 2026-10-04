// Abyssal Worms inside /usr/games Reborn. The Hall runs this page in a frame and listens over
// the bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// A screensaver is a toy: the Hall grants a small amount of XP once a day for a visit in which
// the player did something (a key or a click), never for leaving it running, plus six small
// packages for moments the controller already knows about.
//
// In the Hall the abyss follows the Hall's sound and reduced motion (followHall), and it holds
// still, frozen and silent, while the Hall pauses or the tab is hidden, in the Hall or not.

const bridge = globalThis.UsrGamesBridge;
/** The ambience's own master level (audio/ambience.js), which the Hall's default volume keeps. */
const AMBIENCE_LEVEL = 0.8;
let game = null; // { audio, setMuted, setReducedMotion } from app.js, once it has built them
let soundToApply = null; // the Hall's latest { volume, muted }, until it reaches the ambience
let hallReducedMotion = null;
// The bridge starts out paused, without telling, when the page opens in a hidden tab.
let heldStill = Boolean(bridge) && document.hidden;
let resumeAudioAfterHold = false;

const hall =
  bridge?.connectToHall({
    id: 'worms',
    pauseWhenHidden: true,
    onSound: (sound) => { soundToApply = sound; applyHallSound(); },
    onReducedMotion: (reduced) => { hallReducedMotion = reduced; applyHallMotion(); },
    onPause: holdStill,
    onResume: carryOn,
  }) ?? null;
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

/** app.js hands over its ambience and two setters once they exist. */
export function followHall(handles) {
  game = handles;
  applyHallSound();
  applyHallMotion();
}

// Unmuted, the Hall turns the ambience on at its own volume; muted, it turns it off. The game's
// own sound button and M key keep working during the visit, until the Hall's sound changes
// again. Outside the Hall no sound arrives and the ambience starts off, as it always has.
function applyHallSound() {
  if (!game || !soundToApply || heldStill) return;
  game.audio.volume = bridge.soundLevel(soundToApply, AMBIENCE_LEVEL);
  soundToApply = null;
  game.setMuted(game.audio.volume === 0);
}

function applyHallMotion() {
  if (!game || hallReducedMotion === null) return;
  game.setReducedMotion(hallReducedMotion);
  // styles.css repeats its prefers-reduced-motion rule for this attribute
  document.documentElement.toggleAttribute('data-reduced-motion', hallReducedMotion);
}

function holdStill() {
  heldStill = true;
  const context = game?.audio.ctx;
  resumeAudioAfterHold = context?.state === 'running';
  if (resumeAudioAfterHold) context.suspend();
}

function carryOn() {
  heldStill = false;
  if (resumeAudioAfterHold) game.audio.ctx.resume();
  resumeAudioAfterHold = false;
  applyHallSound(); // a change that came in while the abyss held still
}

/** The frame loop stands still while this is true. */
export function isHeldStill() {
  return heldStill;
}

// A browser lets a page start sound only after a gesture in it or in the Hall around it. If the
// Hall turned the ambience on before there was one (the game opened from a link, say), the first
// key or click here starts it.
function startAmbienceOnGesture() {
  const context = game?.audio.ctx;
  if (context?.state === 'suspended' && !game.audio.muted && !heldStill) context.resume();
}
if (hall?.hosted) {
  for (const type of ['keydown', 'pointerdown']) {
    window.addEventListener(type, startAmbienceOnGesture, { capture: true, passive: true });
  }
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

/** The logbook's moments (log/logbook.js): sightings, the journal, the Daily Dive. */
export function noteSighting(kindsSeen) {
  install('first-sighting');
  if (kindsSeen >= 4) install('every-sighting');
}

export function noteJournal(speciesMet) {
  if (speciesMet >= 8) install('naturalist');
}

/**
 * The day's dive finished, for the first time today: a daily challenge done, by watching. It is
 * reported once, as the toy's visit is, and only because the player found what it asked.
 */
export function noteDiveFinished(sightingsFound) {
  install('daily-diver');
  if (!hall) return;
  hall.result({
    outcome: 'complete',
    stats: { diveSightings: sightingsFound, divesFinished: 1 },
    daily: true,
    durationSeconds: Math.round((performance.now() - openedAt) / 1000),
  });
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
