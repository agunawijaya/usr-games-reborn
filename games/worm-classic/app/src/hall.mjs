// Orchard Crawl inside /usr/games Reborn. The Hall runs this page in a frame and listens over the
// bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge script is
// missing or reports `hosted: false`, and every call below does nothing.
//
// What the Hall hears comes from the desk (desk.mjs): a crawl that reaches its burrow is a win, a
// crash is a loss, and a free crawl (which only ever ends in a crash, as worm always did) counts as
// a win from its first milestone of points. Leaving mid-crawl is not reported.

const handlers = {
  pause: () => {},
  resume: () => {},
  motion: () => {},
  sound: () => {},
  appearance: () => {},
};
let reducedMotion = null;
let hallSound = null;
let appearance = null;
const hall =
  globalThis.UsrGamesBridge?.connectToHall({
    id: 'worm-classic',
    pauseWhenHidden: true,
    onPause: () => handlers.pause(),
    onResume: () => handlers.resume(),
    onReducedMotion: (reduced) => {
      reducedMotion = reduced;
      handlers.motion(reduced);
    },
    onSound: (sound) => {
      hallSound = sound;
      handlers.sound();
    },
    onHello: (hello) => {
      appearance = hello.appearance;
      handlers.appearance(appearance);
    },
    onAppearanceChange: (change) => {
      appearance = change.appearance;
      handlers.appearance(appearance);
    },
  }) ?? null;
const installed = new Set();
const XP_PER_STAR = 3;
const XP_FOR_AN_ORCHARD = 5;
const XP_PER_CHALLENGE_POINT = 2;

/** True inside the Hall's frame; on its own the game has no Hall to go back to. */
export const hostedInHall = Boolean(hall?.hosted);

/**
 * The desk's answers to the Hall: its pause (the Hall's menu, a hidden tab), its reduced-motion
 * setting, its sound and its appearance. Each is called once at once if the Hall has already said.
 */
export function followHall({ pause, resume, motion, sound, appearance: look }) {
  Object.assign(handlers, { pause, resume, motion, sound, appearance: look });
  if (reducedMotion !== null) motion(reducedMotion);
  if (hallSound !== null) sound();
  if (appearance !== null) look(appearance);
}

/**
 * How loud a sound designed at `level` plays: as designed on its own, and in the Hall as its
 * volume slider allows (exactly as designed at the Hall's default volume), 0 while it is muted.
 */
export function hallLevel(level) {
  return hallSound ? globalThis.UsrGamesBridge.soundLevel(hallSound, level) : level;
}

/** "Back to the Hall" on the report and in the pause menu. */
export function leaveForHall() {
  hall?.navigate('hall');
}

/** The orchards page is the title screen: there Escape leads back to the Hall. */
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
 * @param {import('./stars.mjs').CrawlSummary} summary
 * @param {{ kind: 'orchard' | 'daily' | 'free' | 'challenge', stars: number, firstClear: boolean,
 *   daily: boolean, win: boolean, challengePoints?: number }} details
 */
export function reportCrawl(summary, details) {
  if (!hall) return;
  const xpEvents = [];
  if (details.stars > 0) xpEvents.push({ id: 'stars', xp: details.stars * XP_PER_STAR });
  if (details.firstClear) xpEvents.push({ id: 'new-orchard', xp: XP_FOR_AN_ORCHARD });
  if (details.challengePoints) xpEvents.push({ id: 'challenge', xp: details.challengePoints * XP_PER_CHALLENGE_POINT });
  hall.result({
    outcome: details.win ? 'win' : 'loss',
    score: summary.score,
    stats: {
      apples: summary.harvested,
      homes: summary.home ? 1 : 0,
      frogs: summary.frogs,
      points: summary.score,
      stars: details.stars,
    },
    xpEvents,
    daily: details.daily,
    durationSeconds: Math.round(summary.seconds),
  });
}

/** Key art for the Hall: the orchard behind the desk, with a worm crawling in it. */
export function offerPoster(canvas) {
  if (!hall?.hosted) return;
  hall.posterFromCanvas(canvas);
}
