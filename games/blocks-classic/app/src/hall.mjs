// Broken Well inside /usr/games Reborn. The Hall runs this page in a frame and listens over the
// bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge script is
// missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from the desk (desk.mjs): a shift is won when its line or flood target
// is reached, lost when the stack tops out first, and a quit is reported for leaving one half-way.

const pauseHandlers = { pause: () => {}, resume: () => {} };
let hallSound = null;
let setSoundLevel = () => {};
let setAppearance = () => {};
let setReducedMotion = () => {};
const hall =
  globalThis.UsrGamesBridge?.connectToHall({
    id: 'blocks-classic',
    onPause: () => pauseHandlers.pause(),
    onResume: () => pauseHandlers.resume(),
    onSound: (sound) => {
      hallSound = sound;
      setSoundLevel(globalThis.UsrGamesBridge.soundLevel(sound));
    },
    onReducedMotion: (reduced) => setReducedMotion(reduced),
    pauseWhenHidden: true,
    onHello: (hello) => setAppearance(hello.appearance),
    onAppearanceChange: (appearance) => setAppearance(appearance.appearance),
  }) ?? null;
const installed = new Set();
const XP_CLEARED = 10;
const XP_PER_SEAL = 3;
const PROMOTION_XP = 6;

/** True inside the Hall's frame; on its own the game has no Hall to go back to. */
export const hostedInHall = Boolean(hall?.hosted);

/** @param {() => void} pause @param {() => void} resume */
export function onHallPause(pause, resume) {
  pauseHandlers.pause = pause;
  pauseHandlers.resume = resume;
}

/**
 * `follow(level)` hears the Hall's sound as a master level for the game's mixer: once when the
 * Hall greets the game, then whenever its volume or mute changes.
 * @param {(level: number) => void} follow
 */
export function onHallSound(follow) {
  setSoundLevel = follow;
  if (hallSound) follow(globalThis.UsrGamesBridge.soundLevel(hallSound));
}

/**
 * `follow('light'|'dark')` hears the Hall's appearance once when it greets the game, then on
 * every later change, so the well's own light and dark looks (index.html's `data-theme`) track
 * the Hall's switch live. On its own the game stays in its dark look.
 * @param {(appearance: 'light'|'dark') => void} follow
 */
export function onHallAppearance(follow) {
  setAppearance = follow;
}

/** `follow(reduced)` hears the Hall's reduced-motion setting, once up front and on every change. */
export function onHallReducedMotion(follow) {
  setReducedMotion = follow;
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
 * @param {'win'|'loss'|'quit'} outcome
 * @param {{ cleared: boolean, lines: number, score: number, piecesLocked: number, quads: number, rubbleRowsSurvived: number }} summary
 * @param {{ contractsMet: number, promoted: boolean, daily: boolean, seconds: number }} details
 */
export function reportShift(outcome, summary, details) {
  if (!hall) return;
  const xpEvents = [];
  if (outcome === 'win') {
    xpEvents.push({ id: 'cleared', xp: XP_CLEARED });
    if (details.contractsMet > 0) xpEvents.push({ id: 'contracts', xp: details.contractsMet * XP_PER_SEAL });
    if (details.promoted) xpEvents.push({ id: 'promotion', xp: PROMOTION_XP });
  }
  hall.result({
    outcome,
    score: summary.score,
    stats: {
      shiftsCleared: outcome === 'win' ? 1 : 0,
      linesCleared: summary.lines,
      piecesLocked: summary.piecesLocked,
      quads: summary.quads,
      rubbleRowsSurvived: summary.rubbleRowsSurvived,
      contractsMet: details.contractsMet,
    },
    xpEvents,
    daily: details.daily,
    durationSeconds: details.seconds,
  });
}

/** Key art for the Hall: the well as the game menu left it drawn. */
export function offerPoster(canvas) {
  if (!hall?.hosted || !canvas) return;
  hall.posterFromCanvas(canvas);
}
