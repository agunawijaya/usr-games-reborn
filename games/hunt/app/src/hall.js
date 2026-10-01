// Hunt inside /usr/games Reborn. The Hall runs this page in a frame and listens over the bridge,
// loaded by index.html from ../../bridge/bridge.js. Opened on its own the bridge script is
// missing or reports `hosted: false`, and every call below does nothing.
//
// A match never ends by itself (players drop in and out, as on the original's server), so a
// match counts as a session when the player ends it from the pause menu: New match or Restart.
// Everything else is read from the events each engine step already returns. Overridden
// (cheated) matches earn no packages, no XP events and no score.

import { SLIME } from './engine/constants.js';
import { scoreboard } from './engine/match.js';

const hall = globalThis.UsrGamesBridge?.connectToHall({ id: 'hunt' }) ?? null;
const installed = new Set();
const WALL_BREAKER_CHARGE = 49; // a 7×7 charge
const XP_PER_TAG = 3;
const TOP_OF_BOARD = { tags: 5, players: 5 };

function install(id) {
  if (!hall || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

// The match setup is the game menu: Escape there (with nothing open over it) leads back to the
// Hall. Hunt's own key handling consumes Escape, so main.js asks for the trip itself.
const setup = document.getElementById('setup');
if (hall?.hosted && setup) {
  const report = () => hall.setTitleScreen(setup.classList.contains('on'));
  new MutationObserver(report).observe(setup, { attributes: true, attributeFilter: ['class'] });
  report();
}

/** Escape on the match setup. Returns whether the Hall took over. */
export function leaveFromSetup() {
  if (!hall?.hosted) return false;
  hall.navigate('hall');
  return true;
}

let match = null;

const scoreOf = (g, name) => g.scores.find((row) => row.name === name);

export function noteMatchStarted() {
  match = { startedAt: performance.now(), myShots: new Set(), bankShots: 0, defused: 0, tagsAtEntry: 0 };
}

function noteEvent(event, me, name, mine) {
  const isMe = (id) => me !== null && id === me.id;
  switch (event.t) {
    case 'fire':
      if (!isMe(event.id)) return;
      match.myShots.add(event.bid);
      if (event.charge >= WALL_BREAKER_CHARGE) install('wall-breaker');
      if (event.type === SLIME) install('green-tide');
      return;
    case 'bounce':
      if (!match.myShots.has(event.id)) return;
      install('bank-shot');
      if (event.n === 1) match.bankShots += 1;
      if (event.n >= 3) install('hall-of-mirrors');
      return;
    case 'defuse':
      if (!isMe(event.id)) return;
      match.defused += 1;
      install('defuser');
      return;
    case 'absorb':
      if (isMe(event.who)) install('good-shield');
      return;
    case 'boots':
      if (isMe(event.id) && event.n === 2) install('two-boots');
      return;
    case 'thrown':
      if (isMe(event.id)) install('lift-off');
      return;
    case 'death':
      if (event.name.startsWith('ace') && event.text.endsWith(`by ${name} |`)) install('ace-tamer');
      return;
    case 'enter':
      if (event.name === name) match.tagsAtEntry = mine?.gkills ?? 0;
      return;
  }
}

/** Every engine step's events; `me` is the player's live entry (null while hit out). */
export function noteEvents(g, me, events, name) {
  if (!match || g.cheated) return;
  const mine = scoreOf(g, name);
  for (const event of events) noteEvent(event, me, name, mine);
  const tags = mine?.gkills ?? 0;
  if (tags >= 1) install('first-tag');
  if (tags - match.tagsAtEntry >= 3) install('hat-trick');
  const leader = scoreboard(g)[0];
  if (leader?.name === name && tags >= TOP_OF_BOARD.tags && g.np >= TOP_OF_BOARD.players) {
    install('top-board');
  }
}

/** The player ended the match (New match or Restart). */
export function reportMatchEnded(g, name) {
  if (!hall || !match || !g) return;
  const mine = scoreOf(g, name);
  const clean = !g.cheated;
  const tags = clean ? (mine?.gkills ?? 0) : 0;
  hall.result({
    outcome: 'complete',
    ...(clean ? { score: tags } : {}),
    stats: {
      tags,
      entries: mine?.entries ?? 0,
      bankShots: clean ? match.bankShots : 0,
      defused: clean ? match.defused : 0,
    },
    xpEvents: tags > 0 ? [{ id: 'tags', xp: Math.min(25, tags * XP_PER_TAG) }] : [],
    durationSeconds: Math.round((performance.now() - match.startedAt) / 1000),
  });
  match = null;
}

// Key art for the Hall: the arena some seconds into the first match, after the entry flight.
const POSTER_AFTER_MS = 8000;
let posterSent = false;

export function posterWanted() {
  return (
    !!hall?.hosted && !posterSent && !!match && performance.now() - match.startedAt > POSTER_AFTER_MS
  );
}

/** Call right after drawing the canvas, in the same task (see the bridge's posterFromCanvas). */
export function offerPoster(canvas) {
  posterSent = true;
  hall.posterFromCanvas(canvas);
}
