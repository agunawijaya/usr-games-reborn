// Talon's Shadow inside /usr/games Reborn. The Hall runs this page in a frame and listens over
// the bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from the desk (desk.mjs): an escape is a win (even empty-handed, as
// the original counted it), being caught is a loss, and leaving mid-flight is not reported.

const handlers = { pause: () => {}, resume: () => {}, motion: () => {} };
let reducedMotion = null;
const hall =
  globalThis.UsrGamesBridge?.connectToHall({
    id: 'snake-classic',
    pauseWhenHidden: true,
    onPause: () => handlers.pause(),
    onResume: () => handlers.resume(),
    onReducedMotion: (reduced) => {
      reducedMotion = reduced;
      handlers.motion(reduced);
    },
  }) ?? null;
const installed = new Set();
const XP_PER_STAMP = 3;
const XP_FOR_A_REGION = 5;

/** True inside the Hall's frame; on its own the game has no Hall to go back to. */
export const hostedInHall = Boolean(hall?.hosted);

/** @param {() => void} pause @param {() => void} resume @param {(reduced: boolean) => void} motion */
export function followHall(pause, resume, motion) {
  handlers.pause = pause;
  handlers.resume = resume;
  handlers.motion = motion;
  if (reducedMotion !== null) motion(reducedMotion);
}

/** The report's "Back to the Hall". */
export function leaveForHall() {
  hall?.navigate('hall');
}

/** The expedition desk is the title screen: there Escape leads back to the Hall. */
export function setOnDesk(active) {
  hall?.setTitleScreen(active);
}

/** One of the packages in manifest.json; each is offered to the Hall once per visit. */
export function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

/**
 * @param {import('./contracts.mjs').FlightSummary} summary
 * @param {{ stamps: number, opened: boolean, daily: boolean }} details
 */
export function reportFlight(summary, details) {
  if (!hall) return;
  const xpEvents = [];
  if (details.stamps > 0) xpEvents.push({ id: 'stamps', xp: details.stamps * XP_PER_STAMP });
  if (details.opened) xpEvents.push({ id: 'new-region', xp: XP_FOR_A_REGION });
  hall.result({
    outcome: summary.escaped ? 'win' : 'loss',
    score: summary.escaped ? summary.fruit : 0,
    stats: {
      fruitSecured: summary.escaped ? summary.fruit : 0,
      divesDodged: summary.dodges,
      escapes: summary.escaped ? 1 : 0,
      stamps: details.stamps,
    },
    xpEvents,
    daily: details.daily,
    durationSeconds: Math.round(summary.seconds),
  });
}

/**
 * A challenge played: a complete session with its score; new stars earn a little XP.
 * @param {{ score: number, newStars: number, seconds: number }} played
 */
export function reportChallenge({ score, newStars, seconds }) {
  if (!hall) return;
  hall.result({
    outcome: 'complete',
    score,
    stats: { challengeStars: newStars, challengesPlayed: 1 },
    xpEvents: newStars > 0 ? [{ id: 'challenge-stars', xp: newStars * XP_PER_STAMP }] : [],
    durationSeconds: Math.round(seconds),
  });
}

/** Key art for the Hall: the scene behind the desk, with the bird circling. */
export function offerPoster(canvas) {
  if (!hall?.hosted) return;
  hall.posterFromCanvas(canvas);
}
