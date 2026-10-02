// Broadside inside /usr/games Reborn. The Hall runs this page in a frame and listens over the
// bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge script
// is missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from what the game already knows: the events each turn resolves to,
// the result the engine settles on when a battle ends (engine/turn.js, checkEnd), and the battle
// as settled into the Sea Service and the Daily Engagement (career/progress.js).
//
// What the game hears from the Hall: its sound, its reduced-motion setting and its pause, handed
// to the game through followHall (called once by main.js) and hallPaused.

import { MASTER_LEVEL } from './audio/audio.js';

const bridge = globalThis.UsrGamesBridge;
const hall =
  bridge?.connectToHall({
    id: 'sail',
    onSound: followHallSound,
    onReducedMotion: followHallMotion,
    pauseWhenHidden: true,
    onPause: holdStill,
    onResume: carryOn,
  }) ?? null;
const installed = new Set();
const XP_PER_SHIP_TAKEN = 8;
const XP_PER_COMMENDATION = 3;
const GALE = 5;
const FLEET_ACTION = 10;

// The Hall's Game menu reloads this page. The game keeps a battle in sessionStorage so that its
// own quality switch (a navigation, not a reload) can carry on; after a reload asked for by the
// Hall, the player wants the scenario list instead.
if (hall?.hosted && performance.getEntriesByType('navigation')[0]?.type === 'reload') {
  try {
    sessionStorage.removeItem('broadside.battle');
  } catch {
    // Storage may be unavailable; the game then never resumes anyway.
  }
}

/** True inside the Hall's frame; on its own the game has no Hall to go back to. */
export const hostedInHall = Boolean(hall?.hosted);

/** The game menu's and the report's "Back to the Hall". */
export function leaveForHall() {
  hall?.navigate('hall');
}

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

// The game menu's first page (career/deck.js) is the title screen: Escape there leads back to the
// Hall. The same overlay also shows the menu's other pages, the historical actions, the ship
// choice and the top ten, which are steps inside the game and keep Escape for going back; the
// help overlay can open over it (Escape then closes the help, not the game).
const menu = document.getElementById('menu');
const help = document.getElementById('help');
let onTitle = null;
function watchTitle() {
  const helpOpen = !!help?.classList.contains('open');
  const active = !helpOpen && menu.classList.contains('open') && !!menu.querySelector('[data-deck="menu"]');
  if (active === onTitle) return;
  onTitle = active;
  hall?.setTitleScreen(active);
}
if (hall?.hosted && menu) {
  const observer = new MutationObserver(watchTitle);
  observer.observe(menu, { attributes: true, attributeFilter: ['class'], childList: true });
  if (help) observer.observe(help, { attributes: true, attributeFilter: ['class'] });
  watchTitle();
  // The help closes on Escape without marking the key as used; mark it here, before anything
  // else sees it, so the bridge does not also take it as a trip back to the Hall.
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && help?.classList.contains('open')) event.preventDefault();
    },
    { capture: true },
  );
}

let battle = null;

export function noteBattleStarted() {
  battle = {
    startedAt: performance.now(),
    heldMs: 0,
    heldSince: paused ? performance.now() : null,
    shipsTaken: 0,
    broadsidesFired: 0,
  };
}

/** How long the battle has been fought, leaving out the time it was held still. */
function battleMs() {
  const now = performance.now();
  const holding = battle.heldSince === null ? 0 : now - battle.heldSince;
  return now - battle.startedAt - battle.heldMs - holding;
}

/** The events of one resolved turn; `me` is the player's ship index. */
export function noteTurn(events, me) {
  if (!battle) return;
  for (const event of events) {
    if (event.t === 'fire' && event.from === me) {
      battle.broadsidesFired += 1;
      install('open-fire');
      if (event.rake) install('down-her-length');
      if (event.sternrake) install('stern-rake');
    }
    if ((event.t === 'strike' || event.t === 'capture') && event.by === me) {
      battle.shipsTaken += 1;
      install(event.t === 'strike' ? 'colours-come-down' : 'prize-crew');
      if (battle.shipsTaken >= 2) install('a-brace-of-prizes');
    }
  }
}

const OUTCOMES = {
  victory: 'win',
  captured: 'loss',
  lost: 'loss',
  struck: 'loss',
  nightfall: 'draw',
  hurricane: 'draw',
  quit: 'quit',
};

function installCareerPackages(plan, summary, won) {
  if (summary.earned.length && summary.earned.every(Boolean)) install('full-marks');
  if (plan.mode === 'service' && won) install('first-action');
  if (plan.mode === 'daily' && won) install('daily-engagement');
  if (summary.rankAfter !== 'Midshipman') install('promoted');
  if (summary.serviceWon) install('sea-service');
}

/** The end of a battle. `plan` is what was fought, `summary` what settling it saved. */
export function reportBattle(st, me, plan, summary) {
  if (!hall || !battle) return;
  const reason = st.result?.reason;
  const outcome = OUTCOMES[reason] ?? 'complete';
  if (outcome === 'win') {
    install('the-day-is-yours');
    if (st.windspeed >= GALE) install('heavy-weather');
    if (st.ships.length >= FLEET_ACTION) install('line-of-battle');
  }
  if (outcome !== 'quit') install('see-it-through');
  installCareerPackages(plan, summary, outcome === 'win');
  const { shipsTaken, broadsidesFired } = battle;
  const commendations = summary.earned.filter(Boolean).length;
  const xpEvents = [];
  if (shipsTaken > 0) xpEvents.push({ id: 'ships-taken', xp: Math.min(25, shipsTaken * XP_PER_SHIP_TAKEN) });
  if (commendations > 0) xpEvents.push({ id: 'commendations', xp: commendations * XP_PER_COMMENDATION });
  hall.result({
    outcome,
    score: Math.max(0, Math.round(st.ships[me]?.points ?? 0)),
    stats: { shipsTaken, broadsidesFired, turns: st.turn, commendations },
    xpEvents,
    daily: plan.mode === 'daily',
    durationSeconds: Math.round(battleMs() / 1000),
  });
  battle = null;
}

// Key art for the Hall: the fleets at sea a few seconds into the first battle, once the opening
// sweep has settled. Before any battle the Hall shows its own key art for the game.
const POSTER_AFTER_MS = 7000;
let posterSent = false;

export function posterWanted() {
  return !!hall?.hosted && !posterSent && !!battle && battleMs() > POSTER_AFTER_MS;
}

/** Call right after drawing the canvas, in the same task (see the bridge's posterFromCanvas). */
export function offerPoster(canvas) {
  posterSent = true;
  hall.posterFromCanvas(canvas);
}

// ---------------------------------------------------------------------------
// The Hall's sound, reduced motion and pause
// ---------------------------------------------------------------------------
let game = null; // { audio, soundButton, setReducedMotion }, from followHall
let hallSound = null;
let hallReducedMotion = null;
let paused = false;
let suspendedAudio = false;

/** main.js hands over what the Hall's settings reach; anything already heard applies at once. */
export function followHall(handles) {
  game = handles;
  if (hallSound) followHallSound(hallSound);
  if (hallReducedMotion !== null) followHallMotion(hallReducedMotion);
}

// On its own the game starts with sound on and remembers its switch. In the Hall the Hall's sound
// wins: muted there is silent here, and its volume slider scales the master level. The game's own
// switch still works during the visit, until the next change in the Hall; what the Hall sets is
// not written into the switch the game remembers. The AudioContext still waits for a gesture.
function followHallSound(sound) {
  hallSound = sound;
  if (!game) return;
  game.audio.setLevel(bridge.soundLevel(sound, MASTER_LEVEL));
  game.audio.setMuted(sound.muted);
  game.soundButton.setAttribute('aria-pressed', String(!sound.muted));
}

// The Hall's setting (its own, or the system's when the player chose that) takes over from the
// game's read of the system at start-up, and keeps following it.
function followHallMotion(reduced) {
  hallReducedMotion = reduced;
  document.documentElement.toggleAttribute('data-reduced-motion', reduced);
  game?.setReducedMotion(reduced);
}

/** True while the Hall holds the game still: main.js draws no frames then. */
export function hallPaused() {
  return paused;
}

// The Hall's pause (its tab hidden, or its own question over the game) and this page hidden hold
// the game still. The game has no pause of its own, but everything that moves in it runs on the
// frame loop (the sea, the fleet's cinematic and its timed beats, the camera, the creaks), so the
// held loop stops it where it is; the ambience stops with its AudioContext. Resume carries on
// from exactly there, and the battle's time leaves the pause out.
function holdStill() {
  paused = true;
  if (battle) battle.heldSince = performance.now();
  const context = game?.audio.context;
  suspendedAudio = context?.state === 'running';
  if (suspendedAudio) context.suspend();
}

function carryOn() {
  paused = false;
  if (battle && battle.heldSince !== null) {
    battle.heldMs += performance.now() - battle.heldSince;
    battle.heldSince = null;
  }
  if (suspendedAudio) game.audio.context.resume();
  suspendedAudio = false;
}
