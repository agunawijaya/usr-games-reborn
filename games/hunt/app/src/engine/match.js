// A match: the arena, the human(s) and the bots, set up the way a hunt
// session filled up — one `hunt` client per player connecting to huntd.
// Pure and DOM-free: the browser host and a future Node/WebSocket server
// both create matches here and drive them with step().

import * as H from './hunt.js';
import * as K from './constants.js';
import { addBot, runBots, BOT_KINDS } from '../bots/index.js';

export { BOT_KINDS };

export const ARENAS = {
  classic: 'Classic — makemaze.c as is: no mirrors until walls regrow',
  veteran: 'Veteran — as if every wall had regrown once (≈1% mirrors, ≈1% doors)',
  ricochet: 'Ricochet — a braided maze: its lone pillars become mirrors (remap), bank shots everywhere',
};

const BOT_NAMES = {
  otto: ['otto', 'otto2', 'otto3', 'otto4', 'otto5', 'otto6', 'otto7', 'otto8'],
  novice: ['rookie', 'rookie2', 'rookie3', 'rookie4', 'rookie5', 'rookie6', 'rookie7', 'rookie8'],
  sharp: ['ace', 'ace2', 'ace3', 'ace4', 'ace5', 'ace6', 'ace7', 'ace8'],
};

// config: { seed, arena, mode: 'ffa'|'teams', bots: n, difficulty:
//   'otto'|'novice'|'sharp'|'mixed', human: name|null, enter: 'c'|'s'|'f',
//   rejoinDelay: steps, roster: [kind, …] (overrides bots and difficulty),
//   botSpeed: 'fast'|'medium'|'slow' }
export function createMatch(config = {}) {
  const cfg = {
    seed: 1, arena: 'classic', mode: 'ffa', bots: 4, difficulty: 'otto',
    human: 'you', enter: 'c', rejoinDelay: 20, botSpeed: 'fast', ...config,
  };
  const g = H.newGame({ seed: cfg.seed, arena: cfg.arena });
  H.initArena(g);
  g.autorejoin = true;
  g.rejoinDelay = cfg.rejoinDelay;
  g.mode = cfg.mode;
  g.config = cfg;
  g.botSpeed = cfg.botSpeed;
  const status = { c: K.Q_CLOAK, s: K.Q_SCAN, f: K.Q_FLY }[cfg.enter] ?? K.Q_CLOAK;
  // Team mode: hunt teams are single digits (hunt.c:150-156).
  const teamOf = (i) => (cfg.mode === 'teams' ? (i % 2 === 0 ? '1' : '2') : ' ');
  let slot = 0;
  if (cfg.human) {
    const pp = H.connect(g, cfg.human, teamOf(slot++), status);
    pp.enter = status;
    g.humans = [cfg.human];
  }
  const kinds = ['otto', 'novice', 'sharp'];
  const used = { otto: 0, novice: 0, sharp: 0 };
  const roster = cfg.roster ?? Array.from({ length: cfg.bots }, (_, i) => (cfg.difficulty === 'mixed' ? kinds[i % 3] : cfg.difficulty));
  for (let i = 0; i < roster.length; i++) {
    const kind = roster[i];
    const name = BOT_NAMES[kind][used[kind]++];
    H.connect(g, name, teamOf(slot++), K.Q_CLOAK);
    // otto.c never seeds random(); give each bot its own stream from the match seed
    addBot(g, name, kind, (cfg.seed * 31 + i * 7919) >>> 0 || 1);
  }
  return g;
}

// Bot speed, an addition of this collection: Fast is huntd as it was, every
// bot acting on every step; Medium lets them act on two steps in three and
// Slow on one in three. The world (shots, slime, blasts) and the human keep
// the full pace.
export const BOT_SPEEDS = {
  fast: [true],
  medium: [true, true, false],
  slow: [true, false, false],
};

// One step of the match: humans' queued keys, the world, bots' next keys.
export function tick(g) {
  const pattern = BOT_SPEEDS[g.botSpeed] ?? BOT_SPEEDS.fast;
  if (pattern[g.step % pattern.length]) return H.step(g, runBots);
  return stepWhileBotsRest(g);
}

// A step the bots sit out: the keys they already typed wait in their queues,
// and they type nothing new.
function stepWhileBotsRest(g) {
  const resting = [];
  for (let n = 0; n < g.np; n++) {
    const pp = g.slots[n];
    const name = H.nameOf(g, pp);
    if (!g.bots[name] || g.humans.includes(name)) continue;
    resting.push([pp, pp.q]);
    pp.q = [];
  }
  const events = H.step(g);
  for (const [pp, queue] of resting) pp.q = queue.concat(pp.q);
  return events;
}

// Scoreboard rows as the status panel lists them (draw.c drawstatus).
export function scoreboard(g) {
  const rows = [];
  for (const s of g.scores) {
    const pp = H.findPlayer(g, s.name);
    rows.push({
      name: s.name,
      team: s.team === K.SPACE ? '' : String.fromCharCode(s.team),
      score: s.score,
      kills: s.gkills,
      bad: s.bkills,
      deaths: s.deaths,
      entries: s.entries,
      alive: !!pp,
      stat: pp ? K.statChar(pp) : ' ',
      bot: !!g.bots[s.name],
      kind: g.bots[s.name]?.kind ?? 'human',
      id: pp?.id ?? null,
      cheated: g.cheated && g.humans.includes(s.name),
    });
  }
  rows.sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
  return rows;
}
