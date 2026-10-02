// The Rune Gates — the delver's career. Twelve delves descend through the halls, each one adding
// something: more bats, more pits, the wandering procedural caves, the original's hard level,
// fewer arrows, bigger caves. Clearing a delve (slaying its wumpus) opens the next; its stars are
// the most seals ever earned there; the rank follows the delves cleared. Pure.

/**
 * @typedef {object} Delve
 * @property {string} id
 * @property {number} number
 * @property {string} name
 * @property {string} hall      the part of the deep it lies in
 * @property {string} idea      what is new about it, in one line
 * @property {object} options   the engine's own options (src/engine.js)
 * @property {import('./quests.mjs').Task[]} tasks
 */

/** @type {Delve[]} */
export const DELVES = [
  {
    id: 'threshold',
    number: 1,
    name: 'The Threshold Hall',
    hall: 'The Upper Gates',
    idea: 'Twenty chambers on the old twelve-faced plan, three tunnels from each.',
    options: { mode: 'dodecahedron', level: 'EASY', arrowNum: 5, batNum: 2, pitNum: 2 },
    tasks: [['swift', 16], ['spare', 3], ['no-bats']],
  },
  {
    id: 'pillars',
    number: 2,
    name: 'The Twelve-Pillared Hall',
    hall: 'The Upper Gates',
    idea: 'The same plan with more of everything that lurks in it.',
    options: { mode: 'dodecahedron', level: 'EASY', arrowNum: 5, batNum: 3, pitNum: 3 },
    tasks: [['first-arrow'], ['no-bumps'], ['few-chambers', 9]],
  },
  {
    id: 'bat-vaults',
    number: 3,
    name: 'The Bat Vaults',
    hall: 'The Upper Gates',
    idea: 'Five colonies of super-bats roost under these vaults.',
    options: { mode: 'dodecahedron', level: 'EASY', arrowNum: 5, batNum: 5, pitNum: 2 },
    tasks: [['no-bats'], ['swift', 18], ['spare', 3]],
  },
  {
    id: 'chasm-stair',
    number: 4,
    name: 'The Chasm Stair',
    hall: 'The Upper Gates',
    idea: 'Five bottomless pits; every cold draft matters.',
    options: { mode: 'dodecahedron', level: 'EASY', arrowNum: 5, batNum: 2, pitNum: 5 },
    tasks: [['no-chart'], ['few-chambers', 10], ['quiet']],
  },
  {
    id: 'first-delving',
    number: 5,
    name: 'The First Delving',
    hall: 'The Wandering Deep',
    idea: 'Twenty-five chambers dug by chance, and some tunnels run one way only.',
    options: { mode: 'procedural', roomNum: 25, level: 'EASY', arrowNum: 5, batNum: 3, pitNum: 3 },
    tasks: [['crooked', 2], ['no-bats'], ['swift', 20]],
  },
  {
    id: 'winding-deep',
    number: 6,
    name: 'The Winding Deep',
    hall: 'The Wandering Deep',
    idea: 'Thirty chambers, four colonies of bats and four pits.',
    options: { mode: 'procedural', roomNum: 30, level: 'EASY', arrowNum: 5, batNum: 4, pitNum: 4 },
    tasks: [['no-bumps'], ['spare', 2], ['few-chambers', 14]],
  },
  {
    id: 'hard-gate',
    number: 7,
    name: 'The Hard Gate',
    hall: 'The Iron Halls',
    idea: 'The old hard level: extra bats and pits, and a wumpus quick to stir.',
    options: { mode: 'dodecahedron', level: 'HARD', arrowNum: 5, batNum: 3, pitNum: 3 },
    tasks: [['first-arrow'], ['quiet'], ['swift', 16]],
  },
  {
    id: 'galleries',
    number: 8,
    name: 'The Echoing Galleries',
    hall: 'The Iron Halls',
    idea: 'Forty chambers where every sound carries.',
    options: { mode: 'procedural', roomNum: 40, level: 'EASY', arrowNum: 5, batNum: 5, pitNum: 5 },
    tasks: [['no-chart'], ['crooked', 3], ['spare', 2]],
  },
  {
    id: 'restless',
    number: 9,
    name: 'The Restless Hall',
    hall: 'The Iron Halls',
    idea: 'The hard level again, with only four arrows.',
    options: { mode: 'dodecahedron', level: 'HARD', arrowNum: 4, batNum: 4, pitNum: 4 },
    tasks: [['no-bats'], ['no-bumps'], ['quiet']],
  },
  {
    id: 'long-dark',
    number: 10,
    name: 'The Long Dark',
    hall: 'The Deepest Roads',
    idea: 'Sixty chambers. Bring patience, and six arrows.',
    options: { mode: 'procedural', roomNum: 60, level: 'EASY', arrowNum: 6, batNum: 6, pitNum: 6 },
    tasks: [['swift', 30], ['spare', 3], ['crooked', 2]],
  },
  {
    id: 'delvers-depths',
    number: 11,
    name: 'Depths of the Delvers',
    hall: 'The Deepest Roads',
    idea: 'Eighty chambers on the hard level.',
    options: { mode: 'procedural', roomNum: 80, level: 'HARD', arrowNum: 6, batNum: 6, pitNum: 6 },
    tasks: [['no-bats'], ['few-chambers', 25], ['first-arrow']],
  },
  {
    id: 'last-gate',
    number: 12,
    name: 'The Last Gate',
    hall: 'The Deepest Roads',
    idea: 'A hundred chambers, the hard level, and the oldest wumpus of all.',
    options: { mode: 'procedural', roomNum: 100, level: 'HARD', arrowNum: 7, batNum: 8, pitNum: 8 },
    tasks: [['quiet'], ['spare', 3], ['no-chart']],
  },
];

/** Ranks by delves cleared. */
export const RANKS = [
  { name: 'Lamp-bearer', cleared: 0 },
  { name: 'Tunnel-walker', cleared: 2 },
  { name: 'Rune-reader', cleared: 4 },
  { name: 'Gate-warden', cleared: 6 },
  { name: 'Deep-delver', cleared: 9 },
  { name: 'Master of the Rune Gates', cleared: 12 },
];

/**
 * @typedef {object} DelveRecord
 * @property {number} tries
 * @property {boolean} cleared
 * @property {number} stars   the most seals earned in one delve
 * @property {number} bestMoves
 */

/** @returns {{ delves: Record<string, DelveRecord> }} */
export function emptyCareer() {
  return { delves: {} };
}

export function delveById(id) {
  return DELVES.find((d) => d.id === id) ?? null;
}

export function clearedCount(career) {
  return DELVES.filter((d) => career.delves[d.id]?.cleared).length;
}

export function totalStars(career) {
  return DELVES.reduce((sum, d) => sum + (career.delves[d.id]?.stars ?? 0), 0);
}

/** The first delve is always open; each other opens when the one before it is cleared. */
export function isOpen(career, index) {
  if (index === 0) return true;
  const before = DELVES[index - 1];
  return Boolean(before && career.delves[before.id]?.cleared);
}

export function rankOf(career) {
  const cleared = clearedCount(career);
  let rank = RANKS[0];
  for (const r of RANKS) if (cleared >= r.cleared) rank = r;
  return rank;
}

/** The delve "Continue" leads to: the first not yet cleared, or the last one once all are. */
export function nextDelve(career) {
  return DELVES.find((d, i) => isOpen(career, i) && !career.delves[d.id]?.cleared) ?? DELVES[DELVES.length - 1];
}

/**
 * Records a finished delve. Returns the new career and what changed.
 * @param {{ delves: Record<string, DelveRecord> }} career
 * @param {string} delveId
 * @param {{ slain: boolean, seals: number, moves: number }} outcome
 */
export function recordDelve(career, delveId, outcome) {
  const before = career.delves[delveId] ?? { tries: 0, cleared: false, stars: 0, bestMoves: 0 };
  const rankBefore = rankOf(career);
  const record = {
    tries: before.tries + 1,
    cleared: before.cleared || outcome.slain,
    stars: Math.max(before.stars, outcome.slain ? outcome.seals : 0),
    bestMoves: outcome.slain && (!before.bestMoves || outcome.moves < before.bestMoves) ? outcome.moves : before.bestMoves,
  };
  const next = { ...career, delves: { ...career.delves, [delveId]: record } };
  const rankAfter = rankOf(next);
  return {
    career: next,
    firstClear: outcome.slain && !before.cleared,
    newStars: record.stars - before.stars,
    promoted: rankAfter !== rankBefore,
    rank: rankAfter,
  };
}
