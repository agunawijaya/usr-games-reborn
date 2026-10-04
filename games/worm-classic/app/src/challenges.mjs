// Orchard Crawl — the challenges: single crawls with one clear goal each, apart from the season.
// Families of three or four tiers, each tier opening the next; every tier is worth points, more
// for the harder ones, and the three King Drift families are weighted against each other (the
// zigzag shape 1, the zigzag lane 2, no long straights 3, per tier). Pure: the page plays the
// rules, the desk asks these functions what a move or a bite means.

import { placeBurrow } from './burrow.mjs';

/**
 * @typedef {{ x: number, y: number }} Cell
 * @typedef {{ kind: 'success' | 'fail', reason: string } | null} Verdict
 * @typedef {'home' | 'filled' | 'success' | 'crash'} Ending
 * @typedef {{ id: string, family: string, tier: number, name: string, goal: string,
 *   points: number | number[], theme: string, rules: () => object, begin: () => object,
 *   onBite?: (run: object, bite: { value: number, points: number, length: number }) => Verdict,
 *   onMove?: (run: object, peek: object) => Verdict, status: (run: object, peek: object) => string,
 *   outcome: (run: object, ending: Ending) => { success: boolean, medal?: number } }} Challenge
 */

/** The port's own pace, three moves a second, unless a tier says otherwise. */
const CLASSIC = 'classic';

/**
 * The King Drift families' weights: a tier is worth its family's weight plus its place in the
 * family, so the zigzag shape gives 1, 2, 3 points, the lane 2, 3, 4 and no long straights 3, 4, 5.
 */
const DRIFT_WEIGHT = { zigzag: 1, lane: 2, drift: 3 };

const QUIET = { enemyBird: false, enemyWasps: false, enemyRival: false, enemyGardener: false };

/** A random number from 5 to 9: apples worth chaining. */
const bigNumber = (random) => 5 + Math.floor(random() * 5);

// ------------------------------------------------------------------ shapes and measures

/**
 * The longest run of bends in the worm's body that turn left and right by turns, from head to
 * tail. Straight stretches between the bends may be any length.
 * @param {readonly Cell[]} segments head first
 */
export function longestZigzag(segments) {
  const moves = [];
  for (let i = segments.length - 1; i > 0; i--) {
    const dx = segments[i - 1].x - segments[i].x;
    const dy = segments[i - 1].y - segments[i].y;
    if (dx || dy) moves.push({ dx, dy });
  }
  let best = 0;
  let run = 0;
  let lastTurn = 0;
  for (let i = 1; i < moves.length; i++) {
    const turn = Math.sign(moves[i - 1].dx * moves[i].dy - moves[i - 1].dy * moves[i].dx);
    if (turn === 0) continue;
    run = turn === -lastTurn ? run + 1 : 1;
    lastTurn = turn;
    best = Math.max(best, run);
  }
  return best;
}

/** How much of the board the worm fills: its length over the cells not taken by fences. */
export function filled(peek) {
  return peek.length / Math.max(1, peek.freeCells);
}

/**
 * A zigzag lane across the 30 by 20 orchard: legs running up and down, joined along the top and
 * the bottom, `width` cells wide; everything off the lane is hedge. The worm starts at its left
 * end, heading right; the burrow waits at its right end.
 * @param {number} width 1, 2 or 3
 */
export function zigzagLane(width, cols = 30, rows = 20) {
  const low = rows - 4;
  const high = 3;
  const path = [];
  const add = (x, y) => path.push({ x, y });
  let x = 1;
  for (; x <= 6; x++) add(x, low);
  x = 6;
  let up = true;
  while (x < cols - 6) {
    const [from, to] = up ? [low - 1, high] : [high + 1, low];
    for (let y = from; up ? y >= to : y <= to; y += up ? -1 : 1) add(x, y);
    for (let step = 1; step <= 5; step++) add(x + step, up ? high : low);
    x += 5;
    up = !up;
  }
  const y = up ? low : high;
  for (let step = 1; x + step <= cols - 2; step++) add(x + step, y);
  const lo = -Math.floor((width - 1) / 2);
  const lane = new Set();
  for (const cell of path) {
    for (let ox = lo; ox < lo + width; ox++) {
      for (let oy = lo; oy < lo + width; oy++) {
        const cx = cell.x + ox;
        const cy = cell.y + oy;
        if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) lane.add(`${cx},${cy}`);
      }
    }
  }
  const fenceCells = [];
  for (let fy = 0; fy < rows; fy++) {
    for (let fx = 0; fx < cols; fx++) if (!lane.has(`${fx},${fy}`)) fenceCells.push({ x: fx, y: fy });
  }
  return { path, fenceCells, start: { x: 3, y: low, length: 3 }, exit: path[path.length - 1] };
}

// ------------------------------------------------------------------ the families

const FILL_BEDS = [
  { cols: 8, rows: 6, posts: [], name: 'Seed tray' },
  { cols: 10, rows: 8, posts: [], name: 'Herb bed' },
  { cols: 12, rows: 9, posts: [{ x: 4, y: 4 }, { x: 7, y: 4 }], name: 'Bean bed' },
  { cols: 14, rows: 10, posts: [{ x: 6, y: 4 }, { x: 7, y: 4 }, { x: 6, y: 5 }, { x: 7, y: 5 }], name: 'Pumpkin patch', bird: true },
];

/** @type {readonly Challenge[]} */
const fillBed = FILL_BEDS.map((bed, index) => ({
  id: `fill-bed-${index + 1}`,
  family: 'fill-bed',
  tier: index + 1,
  name: `${bed.name}, ${bed.cols}×${bed.rows}`,
  goal: `Grow until you fill the whole ${bed.cols}×${bed.rows} bed${bed.posts.length ? ' round its posts' : ''}${bed.bird ? ', with the thief bird about' : ''}.`,
  points: index + 1,
  theme: ['savanna', 'river', 'jungle', 'origami'][index],
  rules: () => ({
    ...QUIET,
    mode: bed.bird ? 'wild' : 'pure',
    poolSize: 1,
    speed: CLASSIC,
    board: { cols: bed.cols, rows: bed.rows },
    fenceCells: bed.posts,
    start: { x: 3, y: Math.floor(bed.rows / 2), length: 3 },
    enemyBird: Boolean(bed.bird),
  }),
  begin: () => ({}),
  status: (run, peek) => `Filled ${Math.floor(filled(peek) * 100)}% · ${peek.length} of ${peek.freeCells} cells`,
  outcome: (run, ending) => ({ success: ending === 'filled' }),
}));

const MEDALS = [0.25, 0.5, 0.75, 1];
export const MEDAL_NAMES = ['bronze', 'silver', 'gold', 'the whole orchard'];

/** @type {Challenge} */
const fillOrchard = {
  id: 'fill-orchard',
  family: 'fill-orchard',
  tier: 1,
  name: 'The whole orchard, 30×20',
  goal: 'One apple at a time on the full orchard: bronze at a quarter of it, silver at half, gold at three quarters, and the whole orchard at all of it.',
  points: [1, 2, 4, 8],
  theme: 'neon-grid',
  rules: () => ({ ...QUIET, mode: 'pure', speed: CLASSIC, start: { x: 5, y: 10, length: 5 } }),
  begin: () => ({ best: 0 }),
  onMove: (run, peek) => {
    run.best = Math.max(run.best, filled(peek));
    return null;
  },
  status: (run, peek) => {
    const now = filled(peek);
    const next = MEDALS.find((m) => m > now);
    return next ? `Filled ${Math.floor(now * 100)}% · next medal at ${next * 100}%` : 'Filled the lot!';
  },
  outcome: (run, ending) => {
    const best = ending === 'filled' ? 1 : run.best;
    const medal = MEDALS.filter((m) => best >= m).length;
    return { success: medal > 0, medal };
  },
};

/** @type {readonly Challenge[]} */
const zigzag = [5, 9, 13].map((bends, index) => ({
  id: `zigzag-${index + 1}`,
  family: 'zigzag',
  tier: index + 1,
  name: `A zigzag of ${bends}`,
  goal: `Bend your body into a zigzag of ${bends} bends turning left and right by turns, all at once.`,
  points: DRIFT_WEIGHT.zigzag + index,
  theme: 'neon-grid',
  rules: () => ({ ...QUIET, mode: 'pure', speed: CLASSIC }),
  begin: () => ({ best: 0 }),
  onMove: (run, peek) => {
    const now = longestZigzag(peek.segments);
    run.best = Math.max(run.best, now);
    return now >= bends ? { kind: 'success', reason: 'zigzag' } : null;
  },
  status: (run, peek) => `Zigzag now ${longestZigzag(peek.segments)} of ${bends} bends · best ${run.best}`,
  outcome: (run, ending) => ({ success: ending === 'success' }),
}));

const LANES = [
  { width: 3, speed: CLASSIC, name: 'The wide lane' },
  { width: 1, speed: CLASSIC, name: 'The narrow lane' },
  { width: 2, speed: 'fast', name: 'The quick lane' },
];

/** @type {readonly Challenge[]} */
const lane = LANES.map((spec, index) => ({
  id: `lane-${index + 1}`,
  family: 'lane',
  tier: index + 1,
  name: spec.name,
  goal: `Follow the zigzag lane, ${spec.width === 1 ? 'one cell' : `${spec.width} cells`} wide${spec.speed === 'fast' ? ' at the fast pace' : ''}, to the burrow at its far end without touching the hedge.`,
  points: DRIFT_WEIGHT.lane + index,
  // Sand under a dark hedge: the lane reads at a glance.
  theme: 'desert',
  rules: () => {
    const built = zigzagLane(spec.width);
    return {
      ...QUIET,
      mode: 'pure',
      poolSize: 0,
      speed: spec.speed,
      fenceCells: built.fenceCells,
      fenceStyle: 'hedge',
      start: built.start,
      burrowAt: built.exit,
    };
  },
  begin: () => ({}),
  status: () => 'Find your way along the lane to the burrow',
  outcome: (run, ending) => ({ success: ending === 'home' }),
}));

/** @type {readonly Challenge[]} */
const drift = [5, 4, 3].map((most, index) => ({
  id: `drift-${index + 1}`,
  family: 'drift',
  tier: index + 1,
  name: `Never more than ${most} straight`,
  goal: `Eat 8 apples and crawl home, never moving more than ${most} cells in a row in one direction.`,
  points: DRIFT_WEIGHT.drift + index,
  theme: 'savanna',
  rules: () => ({ ...QUIET, mode: 'wild', speed: CLASSIC, maxStraight: most, harvest: 8, placeBurrow }),
  begin: () => ({}),
  status: (run, peek) => `Straight now ${peek.straightRun} of ${most} · ${peek.harvested} of 8 apples`,
  outcome: (run, ending) => ({ success: ending === 'home' }),
}));

/** @type {readonly Challenge[]} */
const exact = [20, 35, 50].map((target, index) => ({
  id: `exact-${index + 1}`,
  family: 'exact',
  tier: index + 1,
  name: `Exactly ${target}`,
  goal: `Grow to a length of exactly ${target}: one cell too many and the challenge is lost.${index === 2 ? ' The thief bird is about.' : ''}`,
  points: 2 + index,
  theme: 'aztec',
  rules: () => ({ ...QUIET, mode: 'wild', speed: CLASSIC, evenApples: true, enemyBird: index === 2 }),
  begin: () => ({}),
  onBite: (run, bite) => {
    if (bite.length > target) return { kind: 'fail', reason: 'over' };
    if (bite.length === target) return { kind: 'success', reason: 'exact' };
    return null;
  },
  status: (run, peek) => `Length to come ${peek.length + peek.growing} · ${target - peek.length - peek.growing} to go`,
  outcome: (run, ending) => ({ success: ending === 'success' }),
}));

const ORDERS = [
  { values: [1, 2, 3, 4, 5, 6, 7, 8, 9], fence: 'none', bird: false, name: 'One to nine' },
  { values: [1, 2, 3, 4, 5, 6, 7, 8, 9], fence: 'cross', bird: false, name: 'One to nine, round the cross' },
  { values: [9, 8, 7, 6, 5, 4, 3, 2, 1], fence: 'none', bird: true, name: 'Nine down to one' },
];

/** @type {readonly Challenge[]} */
const order = ORDERS.map((spec, index) => ({
  id: `order-${index + 1}`,
  family: 'order',
  tier: index + 1,
  name: spec.name,
  goal: `Eat the apples in order, ${spec.values[0]} first and ${spec.values[8]} last; any other number ends it.${spec.bird ? ' The bird may take one, but it comes back.' : ''}`,
  points: 2 + index,
  theme: 'savanna',
  rules: () => ({
    ...QUIET,
    mode: 'wild',
    speed: CLASSIC,
    evenApples: true,
    fence: spec.fence,
    poolSize: 9,
    initialValues: spec.values,
    respawn: 'never',
    keepStolen: true,
    enemyBird: spec.bird,
  }),
  begin: () => ({ next: 0 }),
  onBite: (run, bite) => {
    if (bite.value !== spec.values[run.next]) return { kind: 'fail', reason: 'order' };
    run.next++;
    return run.next === spec.values.length ? { kind: 'success', reason: 'order' } : null;
  },
  status: (run) => (run.next < spec.values.length ? `Next: ${spec.values[run.next]} · ${run.next} of 9 eaten` : 'All nine!'),
  outcome: (run, ending) => ({ success: ending === 'success' }),
}));

const RIGHTS = [
  { harvest: 6, fence: 'none' },
  { harvest: 10, fence: 'none' },
  { harvest: 10, fence: 'h' },
];

/** @type {readonly Challenge[]} */
const right = RIGHTS.map((spec, index) => ({
  id: `right-${index + 1}`,
  family: 'right',
  tier: index + 1,
  name: `Right turns, ${spec.harvest} apples${spec.fence === 'h' ? ' round the H' : ''}`,
  goal: `The worm can only turn right. Eat ${spec.harvest} apples and crawl home.`,
  points: 2 + index,
  theme: 'river',
  rules: () => ({ ...QUIET, mode: 'wild', speed: CLASSIC, fence: spec.fence, turns: 'right', harvest: spec.harvest, placeBurrow }),
  begin: () => ({}),
  status: (run, peek) => `${peek.harvested} of ${spec.harvest} apples · right turns only`,
  outcome: (run, ending) => ({ success: ending === 'home' }),
}));

/** @type {readonly Challenge[]} */
const chain = [20, 30, 40].map((target, index) => ({
  id: `chain-${index + 1}`,
  family: 'chain',
  tier: index + 1,
  name: `A bite of ${target}`,
  goal: `Score ${target} points in a single bite: eat one apple after another while still growing. The apples here are all 5 to 9.`,
  points: 2 + index,
  theme: 'midnight',
  rules: () => ({ ...QUIET, mode: 'wild', speed: CLASSIC, poolSize: 14, appleValue: bigNumber }),
  begin: () => ({ best: 0 }),
  onBite: (run, bite) => {
    run.best = Math.max(run.best, bite.points);
    return bite.points >= target ? { kind: 'success', reason: 'chain' } : null;
  },
  status: (run, peek) => `Best bite ${run.best} of ${target} · still growing ${peek.growing}`,
  outcome: (run, ending) => ({ success: ending === 'success' }),
}));

/** The families in the order the challenges page shows them; the King Drift three together. */
export const FAMILIES = [
  { id: 'fill-bed', name: 'Fill the bed', group: null, lead: 'A small bed and one apple at a time, as in 1980: grow until the worm fills every cell.', challenges: fillBed },
  { id: 'fill-orchard', name: 'Fill the orchard', group: null, lead: 'The same on the whole orchard, as far as you can: a medal at every quarter.', challenges: [fillOrchard] },
  { id: 'zigzag', name: 'The zigzag', group: 'King Drift', lead: 'Draw a zigzag with your own body.', challenges: zigzag },
  { id: 'lane', name: 'The zigzag lane', group: 'King Drift', lead: 'A lane through the hedge, up and down and up again.', challenges: lane },
  { id: 'drift', name: 'No long straights', group: 'King Drift', lead: 'Keep turning: the worm may only go so far in a straight line.', challenges: drift },
  { id: 'exact', name: 'Just the length', group: null, lead: 'Count your numbers: grow to an exact length, not one cell more.', challenges: exact },
  { id: 'order', name: 'In order', group: null, lead: 'Nine apples, one of each number, eaten in order.', challenges: order },
  { id: 'right', name: 'Right turns only', group: null, lead: 'Three rights make a left.', challenges: right },
  { id: 'chain', name: 'The big bite', group: null, lead: 'Chain bite after bite for one huge score.', challenges: chain },
];

export const CHALLENGES = FAMILIES.flatMap((family) => family.challenges);

export function challengeById(id) {
  return CHALLENGES.find((c) => c.id === id) ?? null;
}

/** The most points a challenge can give (the best medal, for the whole orchard). */
export function maxPoints(challenge) {
  return Array.isArray(challenge.points) ? challenge.points[challenge.points.length - 1] : challenge.points;
}

/** Points for a result: a medal's worth, or the tier's points when it is done. */
export function pointsFor(challenge, result) {
  if (!result) return 0;
  if (Array.isArray(challenge.points)) return result.medal ? challenge.points[result.medal - 1] : 0;
  return result.done ? challenge.points : 0;
}

export const CHALLENGE_POINTS_IN_ALL = CHALLENGES.reduce((sum, c) => sum + maxPoints(c), 0);

/** A tier is open once the one before it in its family is done. */
export function challengeOpen(challenge, results) {
  if (challenge.tier === 1) return true;
  const before = CHALLENGES.find((c) => c.family === challenge.family && c.tier === challenge.tier - 1);
  return Boolean(before && results[before.id]?.done);
}
