// Escape the Gallows inside /usr/games Reborn. The Hall runs this page in a frame and listens over
// the bridge, loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge
// script is missing or reports `hosted: false`, and every call below does nothing.
//
// The game page announces each cipher with `gallows:start` and each ending with `gallows:end`
// (index.html); this module turns those into the Hall's results and packages.

const ROOMS = ['pirate', 'lab', 'temple', 'crypt', 'void'];
const PACKAGE_OF_ROOM = {
  pirate: 'out-of-the-hold',
  lab: 'out-of-the-lab',
  temple: 'out-of-the-tomb',
  crypt: 'out-of-the-crypt',
  void: 'out-of-the-void',
};
const XP_ESCAPE = 8;
const XP_CLEAN = 4;
const MAX_MISSES = 6;
const PREFIX = 'usr-games:hangman-classic:';

const pauseHandlers = { pause: () => {}, resume: () => {} };
const motionHandlers = { follow: () => {} };
const hall =
  globalThis.UsrGamesBridge?.connectToHall({
    id: 'hangman-classic',
    pauseWhenHidden: true,
    onPause: () => pauseHandlers.pause(),
    onResume: () => pauseHandlers.resume(),
    onReducedMotion: (reduced) => motionHandlers.follow(reduced),
  }) ?? null;
const installed = new Set();

/** True inside the Hall's frame. */
export const hostedInHall = Boolean(hall?.hosted);

/** @param {() => void} pause @param {() => void} resume */
export function onHallPause(pause, resume) {
  pauseHandlers.pause = pause;
  pauseHandlers.resume = resume;
}

/** @param {(reduced: boolean) => void} follow  called with the Hall's reduced-motion setting */
export function onHallMotion(follow) {
  motionHandlers.follow = follow;
}

/** Rooms escaped at least once, kept on this device. */
function escapedRooms() {
  try {
    const raw = globalThis.localStorage?.getItem(`${PREFIX}escaped`);
    const data = raw ? JSON.parse(raw).data : [];
    return new Set(Array.isArray(data) ? data.filter((room) => ROOMS.includes(room)) : []);
  } catch {
    return new Set();
  }
}

function rememberEscape(room) {
  const rooms = escapedRooms();
  rooms.add(room);
  try {
    globalThis.localStorage?.setItem(`${PREFIX}escaped`, JSON.stringify({ v: 1, data: [...rooms] }));
  } catch {
    // Storage may be full or blocked; the rooms escaped this visit still count for the Hall.
  }
  return rooms;
}

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

/**
 * One cipher finished.
 * @param {{ outcome: 'win' | 'loss', theme: string, word: string, errors: number }} end
 * @param {number} seconds  how long the cipher took
 */
export function reportCipher(end, seconds) {
  const won = end.outcome === 'win';
  const missesLeft = MAX_MISSES - end.errors;
  if (won) {
    install(PACKAGE_OF_ROOM[end.theme]);
    if (end.errors === 0) install('clean-escape');
    if (missesLeft === 1) install('by-a-thread');
    if (end.word.length >= 9) install('long-cipher');
    if (rememberEscape(end.theme).size === ROOMS.length) install('every-door');
  }
  if (!hall) return;
  const xpEvents = [];
  if (won) {
    xpEvents.push({ id: 'escape', xp: XP_ESCAPE });
    if (end.errors === 0) xpEvents.push({ id: 'clean', xp: XP_CLEAN });
  }
  hall.result({
    outcome: won ? 'win' : 'loss',
    // An escape is worth 50 and every miss still in hand 10 more.
    score: won ? 50 + missesLeft * 10 : 0,
    stats: { ciphers: won ? 1 : 0, misses: end.errors, letters: end.word.length },
    xpEvents,
    durationSeconds: Math.max(1, Math.round(seconds)),
  });
}

/** Key art for the Hall, drawn once on a canvas. */
export function offerPoster(canvas) {
  if (!hall?.hosted) return;
  hall.posterFromCanvas(canvas);
}
