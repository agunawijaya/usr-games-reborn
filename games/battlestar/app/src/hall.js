// The starship adventure inside /usr/games Reborn. The Hall runs this page in a frame and listens
// over the bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from the events each command already returns (engine/battlestar.js)
// and from the score the engine posts when the game ends. Games begun under a wizard's name,
// played with the override panel or handed to the autoplay earn no packages, no XP events and no
// score. (Becoming a wizard in play, by holding the three charms, is part of the game and counts.)
//
// What the game hears from the Hall: its sound, its reduced-motion setting and its pause, handed
// to the game through followHall (called once by ui/app.js) and hallPaused.

import { MASTER_LEVEL } from './audio/audio.js';

const bridge = globalThis.UsrGamesBridge;
const hall =
  bridge?.connectToHall({
    id: 'battlestar',
    onSound: followHallSound,
    onReducedMotion: followHallMotion,
    pauseWhenHidden: true,
    onPause: holdStill,
    onResume: carryOn,
  }) ?? null;
const installed = new Set();
const FAR_TRAVELLER = 150;
const GENEROUS = 20;
const ROOMS_PER_XP = 10;
const XP_PER_FIGHT = 5;

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

// The title dialog is the game menu. Closing it any way starts a game, so on the Hall's behalf
// Escape there (with nothing open over it) is taken before the dialog sees it, and leads back to
// the Hall instead.
const title = document.getElementById('dlg-title');
if (hall?.hosted && title) {
  const report = () => hall.setTitleScreen(title.open);
  new MutationObserver(report).observe(title, { attributes: true, attributeFilter: ['open'] });
  report();
  window.addEventListener(
    'keydown',
    (event) => {
      const onTop = [...document.querySelectorAll('dialog[open]')].pop();
      if (event.key !== 'Escape' || onTop !== title) return;
      event.preventDefault();
      event.stopPropagation();
      hall.navigate('hall');
    },
    { capture: true },
  );
}

let run = null;

const honest = (game) => !game.cheated && !game.wiz && !run?.autoplayed;
const roomsVisited = (game) => game.card(game.beenthere, game.beenthere.length);

export function noteGameStarted() {
  run = {
    startedAt: performance.now(),
    heldMs: 0,
    heldSince: paused ? performance.now() : null,
    fightsWon: 0,
    autoplayed: false,
  };
}

/** How long this game has been played, leaving out the time it was held still. */
function runMs() {
  const now = performance.now();
  const holding = run.heldSince === null ? 0 : now - run.heldSince;
  return now - run.startedAt - run.heldMs - holding;
}

/** The hint panel's autoplay was switched on: the rest of this game plays itself. */
export function noteAutoplayUsed() {
  if (run) run.autoplayed = true;
}

const PACKAGE_FOR_EVENT = {
  land: 'touchdown',
  napkinMap: 'napkin-map',
  darkLordFlees: 'outwitted',
  wedding: 'prince-liverwort',
  cylonDestroyed: 'clean-shot',
  seaCaveOpens: 'low-tide',
  wizard: 'three-charms',
  dusk: 'island-night',
};

/** The events of one command. */
export function noteEvents(game, events) {
  if (!run || !game || !honest(game)) return;
  for (const event of events) {
    const id = PACKAGE_FOR_EVENT[event.type];
    if (id) install(id);
    if (event.type === 'launch' && event.from === 7) install('out-of-pajamas');
    if (event.type === 'teleport' && event.how === 'amulet') install('amulet-hop');
    if (event.type === 'fightWon') run.fightsWon += 1;
  }
  if (roomsVisited(game) >= FAR_TRAVELLER) install('surveyor');
  if (game.ego >= GENEROUS) install('generous-heart');
}

const OUTCOMES = { won: 'win', died: 'loss', quit: 'quit' };

/** The game ended: `endKind` is won, died or quit. */
export function reportGameOver(game, endKind) {
  if (!hall || !run) return;
  const clean = honest(game);
  const rooms = roomsVisited(game);
  const xpEvents = [];
  if (clean && rooms >= ROOMS_PER_XP) {
    xpEvents.push({ id: 'places-explored', xp: Math.min(25, Math.floor(rooms / ROOMS_PER_XP)) });
  }
  if (clean && run.fightsWon > 0) {
    xpEvents.push({ id: 'fights-won', xp: Math.min(25, run.fightsWon * XP_PER_FIGHT) });
  }
  hall.result({
    outcome: OUTCOMES[endKind] ?? 'complete',
    ...(clean ? { score: Math.max(game.pleasure, game.power, game.ego) } : {}),
    stats: { placesExplored: clean ? rooms : 0, turns: game.ourtime },
    xpEvents,
    durationSeconds: Math.round(runMs() / 1000),
  });
  run = null;
}

// Key art for the Hall: the scene some seconds into the first game.
const POSTER_AFTER_MS = 8000;
let posterSent = false;

/** The stage calls this after drawing each frame, in the same task as the drawing. */
export function afterStageFrame(canvas) {
  if (!hall?.hosted || posterSent || !run || runMs() < POSTER_AFTER_MS) return;
  posterSent = true;
  hall.posterFromCanvas(canvas);
}

// ---------------------------------------------------------------- the Hall's sound, motion and pause
let app = null; // { settings, sound, soundButton, stage, flight, setReducedMotion }, from ui/app.js
let hallSound = null;
let hallReducedMotion = null;
let switchWanted = null; // where the Hall wants the game's Sound switch, until it gets there
let gestured = false;
let paused = false;
let held = null; // what holdStill stopped, so that carryOn restarts exactly that

/** app.js hands over what the Hall's settings reach; anything already heard applies at once. */
export function followHall(handles) {
  app = handles;
  if (!hall?.hosted) return;
  // A switch remembered as on has made the AudioContext before any gesture, where the browser
  // keeps it suspended while the button still reads "Sound off". Off first, so that the Hall's
  // sound comes on through the switch at the first gesture, as the game's own unmute does.
  if (app.settings.sound && app.sound.ctx?.state !== 'running') app.soundButton.click();
  window.addEventListener('pointerdown', onGesture, { capture: true });
  window.addEventListener('keydown', onGesture, { capture: true });
  if (hallSound) followHallSound(hallSound);
  if (hallReducedMotion !== null) followHallMotion(hallReducedMotion);
}

// On its own the game starts silent and its Sound switch makes the AudioContext. In the Hall the
// Hall's sound wins: muted there is silent here; unmuted there turns the switch on at the Hall's
// volume, at the first gesture. The game's own switch still works during the visit, until the next
// change in the Hall.
function followHallSound(sound) {
  hallSound = sound;
  if (!app) return;
  app.sound.setMasterLevel(bridge.soundLevel(sound, MASTER_LEVEL));
  switchWanted = !sound.muted;
  syncSwitch();
}

// The switch itself does all a change needs: the flag, the mixer, the button's look and the room's
// ambience. Turning it on waits for a gesture (the browser keeps a context made before one silent)
// and for the end of a pause.
function syncSwitch() {
  if (switchWanted === null) return;
  if (switchWanted === app.settings.sound) {
    switchWanted = null;
    return;
  }
  if (switchWanted && (paused || !hadGesture())) return;
  switchWanted = null;
  app.soundButton.click();
}

function hadGesture() {
  return navigator.userActivation?.hasBeenActive ?? gestured;
}

function onGesture(event) {
  if (event.key !== 'Escape') gestured = true;
  // The player working the game's own switch decides for themselves.
  if (app.soundButton.contains(event.target)) switchWanted = null;
  else syncSwitch();
}

// The Hall's setting (its own, or the system's when the player chose that) takes over from the
// game's motion setting, and keeps following it.
function followHallMotion(reduced) {
  hallReducedMotion = reduced;
  app?.setReducedMotion(reduced);
}

/** True while the Hall holds the game still: the hint panel's autoplay waits then. */
export function hallPaused() {
  return paused;
}

// The Hall's pause (its tab hidden, or its own question over the game) and this page hidden hold
// the game still. The adventure waits for commands and never ticks; what runs in time is the
// scene's frame loop, the dogfight's one-second clock and its autopilot, the hint panel's autoplay
// (see hallPaused) and the sound. Each stops where it is and carries on from exactly there, and
// the game's time leaves the pause out.
function holdStill() {
  paused = true;
  if (run) run.heldSince = performance.now();
  if (!app) return;
  held = {
    stage: holdStage(app.stage),
    flight: holdFlight(app.flight()),
    sound: holdSound(app.sound),
  };
}

function carryOn() {
  paused = false;
  if (run && run.heldSince !== null) {
    run.heldMs += performance.now() - run.heldSince;
    run.heldSince = null;
  }
  if (!app) return;
  if (held) {
    releaseSound(app.sound, held.sound);
    releaseStage(held.stage);
    releaseFlight(held.flight);
    held = null;
  }
  syncSwitch();
}

// The scene's frame loop (render/stage.js) stops between frames, and restarts with the held time
// dropped from its clock, so that no transition jumps ahead.
function holdStage(stage) {
  if (!stage?.running) return null;
  stage.running = false;
  cancelAnimationFrame(stage._raf);
  return stage;
}

function releaseStage(stage) {
  if (!stage) return;
  stage.running = true;
  stage.clock.getDelta();
  stage.loop();
}

// The dogfight (ui/flight.js) runs on its one-second clock and, when the hint panel's autoplay
// flies, on its autopilot. On resume the clock starts its second afresh, as it does when the
// player fires.
const AUTOPILOT_STEP_MS = 380; // as in ui/flight.js

function holdFlight(flight) {
  if (!flight || flight.finished) return null;
  clearInterval(flight.timer);
  clearInterval(flight.auto);
  return flight;
}

function releaseFlight(flight) {
  if (!flight || flight.finished) return;
  flight.resetClock();
  if (flight.autopilot) flight.auto = setInterval(() => flight.autoStep(), AUTOPILOT_STEP_MS);
}

// Muting stops the room's incidental sounds and fades the mix, and the suspended context stops the
// rest. Unmuting rebuilds the room's ambience, as the game's own switch does.
function holdSound(sound) {
  const wasOn = !sound.muted;
  if (wasOn) sound.setMuted(true);
  const suspended = sound.ctx?.state === 'running';
  if (suspended) sound.ctx.suspend();
  return { wasOn, suspended };
}

function releaseSound(sound, { wasOn, suspended }) {
  if (suspended) sound.ctx.resume();
  if (wasOn && app.settings.sound) sound.setMuted(false);
}
