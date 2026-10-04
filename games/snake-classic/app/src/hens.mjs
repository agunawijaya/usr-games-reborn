// Talon's Shadow — the ground hunters. Every region has a bird that hunts on foot, chosen for the
// place: a secretary bird on the savanna, a heron by the river, a jungle fowl, a courser in the
// desert, a circuit hen on the neon grid, a wild turkey in the Aztec yard, a paper hen, and two
// night herons at Midnight. A hunter walks after the nearest snake, round the fences; close
// enough, it stops, bobs its head (the warning) and pecks. A fruit it knocks loose it goes after
// at once, which is the snake's moment to get away. It freezes while the flying bird's shadow is
// over it, and stops to peck up fruit lying in its way. Pure: the page decides what a peck hits
// and draws the hunters.

import { pushOut } from './fences.mjs';
import { farthestInSight, routeTo } from './paths.mjs';

/** How close (to any part of a snake) a hunter must be before it winds up to peck. */
export const PECK_RANGE = 36;
/** The warning: the hunter stops and bobs its head this long before the peck. */
export const WINDUP_MS = 460;
/** The peck itself: a lunge of LUNGE pixels towards where it aimed. */
export const PECK_MS = 140;
export const LUNGE = 24;
/** How far in front of the hunter, after the lunge, the beak lands. */
export const BEAK_REACH = 14;
const RECOVER_MS = 800;
/** Frozen under the flying bird's shadow, and how soon it can freeze again. */
const FREEZE_MS = 1100;
const FREEZE_AGAIN_MS = 2600;
const SHADOW_REACH = 70;
/** A fruit this close to its feet is pecked up on the way. */
const GRAZE_REACH = 20;
const GRAZE_MS = 450;
const ROUTE_MS = 600;
const EDGE_MARGIN = 16;

/** Where hunters come in: the south-west corner, then the middle of the east side. */
const ENTRIES = [
  { x: 70, y: 530 },
  { x: 840, y: 300 },
];

const unit = (x, y) => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

/**
 * A hunter at its way in, waiting `delayMs` before it starts.
 * @param {number} index 0 or 1
 * @param {number} speed pixels a millisecond
 */
export function makeHunter(index, speed, delayMs = 2500) {
  const entry = ENTRIES[index % ENTRIES.length];
  return {
    index,
    x: entry.x,
    y: entry.y,
    speed,
    facing: entry.x < 450 ? 1 : -1,
    state: 'waiting',
    stateTime: -delayMs,
    walk: 0,
    aim: null,
    clock: 0,
    frozenUntil: 0,
    canFreezeAt: 0,
    route: [],
    routeFor: '',
    routeUntil: 0,
    // A fruit it knocked loose, to go and eat before anything else.
    lure: null,
  };
}

/**
 * @typedef {{ quarry: unknown, head: { x: number, y: number }, body: { x: number, y: number }[] }} Snake
 * @typedef {{ snakes: Snake[], apples: { x: number, y: number }[],
 *   fences: import('./fences.mjs').Rect[], width: number, height: number,
 *   shadow: { x: number, y: number } | null }} HuntWorld
 *   `snakes`: those it may hunt (heads and bodies); `shadow`: where the flying bird is low enough
 *   to frighten it, if it is
 */

function nearestSnake(hunter, snakes) {
  let best = null;
  for (const snake of snakes) {
    const d = Math.hypot(snake.head.x - hunter.x, snake.head.y - hunter.y);
    if (!best || d < best.d) best = { snake, d };
  }
  return best?.snake ?? null;
}

/** The nearest point of any snake (head or body) within reach, to aim a peck at. */
function pointInReach(hunter, snakes) {
  let best = null;
  for (const snake of snakes) {
    for (const point of [snake.head, ...snake.body]) {
      const d = Math.hypot(point.x - hunter.x, point.y - hunter.y);
      if (d < PECK_RANGE && (!best || d < best.d)) best = { x: point.x, y: point.y, d };
    }
  }
  return best;
}

function walkTowards(hunter, goal, world, dt) {
  const key = `${Math.round(goal.x / 20)},${Math.round(goal.y / 20)}`;
  if (hunter.routeFor !== key || hunter.clock >= hunter.routeUntil) {
    hunter.route = routeTo(hunter, goal, world.fences);
    hunter.routeFor = key;
    hunter.routeUntil = hunter.clock + ROUTE_MS;
  }
  while (hunter.route.length > 1 && Math.hypot(hunter.route[0].x - hunter.x, hunter.route[0].y - hunter.y) < 14) {
    hunter.route.shift();
  }
  const aim = hunter.route.length ? farthestInSight(hunter, hunter.route.slice(0, 10), world.fences) : goal;
  const way = unit(aim.x - hunter.x, aim.y - hunter.y);
  hunter.x += way.x * hunter.speed * dt;
  hunter.y += way.y * hunter.speed * dt;
  pushOut(hunter, 8, world.fences);
  hunter.x = Math.min(world.width - EDGE_MARGIN, Math.max(EDGE_MARGIN, hunter.x));
  hunter.y = Math.min(world.height - EDGE_MARGIN, Math.max(EDGE_MARGIN, hunter.y));
  if (Math.abs(way.x) > 0.15) hunter.facing = way.x > 0 ? 1 : -1;
  hunter.walk += dt * hunter.speed * 0.09;
}

function enter(hunter, state) {
  hunter.state = state;
  hunter.stateTime = 0;
}

/**
 * One step of a hunter. Returns what it did that the page must settle: a peck landing (where
 * the beak came down) or a fruit pecked up (its index), or null.
 * @param {ReturnType<typeof makeHunter>} hunter
 * @param {HuntWorld} world
 * @param {number} dt milliseconds
 * @returns {{ peck: { x: number, y: number } } | { graze: number } | null}
 */
export function stepHunter(hunter, world, dt) {
  hunter.clock += dt;
  hunter.stateTime += dt;
  if (hunter.state === 'waiting') {
    if (hunter.stateTime >= 0) enter(hunter, 'stalk');
    return null;
  }

  const shadowOver = world.shadow && Math.hypot(world.shadow.x - hunter.x, world.shadow.y - hunter.y) < SHADOW_REACH;
  if (shadowOver && hunter.clock >= hunter.canFreezeAt && hunter.state !== 'peck') {
    enter(hunter, 'frozen');
    hunter.frozenUntil = hunter.clock + FREEZE_MS;
    hunter.canFreezeAt = hunter.clock + FREEZE_AGAIN_MS;
  }

  switch (hunter.state) {
    case 'frozen':
      if (hunter.clock >= hunter.frozenUntil) enter(hunter, 'stalk');
      return null;
    case 'recover':
      if (hunter.stateTime >= RECOVER_MS) enter(hunter, 'stalk');
      return null;
    case 'graze':
      if (hunter.stateTime < GRAZE_MS) return null;
      enter(hunter, 'stalk');
      {
        const index = world.apples.findIndex((a) => Math.hypot(a.x - hunter.x, a.y - hunter.y) < GRAZE_REACH + 6);
        return index >= 0 ? { graze: index } : null;
      }
    case 'windup':
      if (hunter.stateTime >= WINDUP_MS) enter(hunter, 'peck');
      return null;
    case 'peck': {
      const t = Math.min(1, hunter.stateTime / PECK_MS);
      const way = unit(hunter.aim.x - hunter.from.x, hunter.aim.y - hunter.from.y);
      const reach = Math.min(LUNGE, Math.hypot(hunter.aim.x - hunter.from.x, hunter.aim.y - hunter.from.y));
      hunter.x = hunter.from.x + way.x * reach * t;
      hunter.y = hunter.from.y + way.y * reach * t;
      pushOut(hunter, 8, world.fences);
      if (t < 1) return null;
      enter(hunter, 'recover');
      return { peck: { x: hunter.x + way.x * BEAK_REACH, y: hunter.y + way.y * BEAK_REACH } };
    }
    default: {
      // A fruit it knocked loose comes first: it walks over and eats it, snakes or no snakes.
      if (hunter.lure) {
        if (Math.hypot(hunter.lure.x - hunter.x, hunter.lure.y - hunter.y) < GRAZE_REACH) {
          hunter.lure = null;
          enter(hunter, 'graze');
          return null;
        }
        if (!world.apples.some((a) => a.x === hunter.lure.x && a.y === hunter.lure.y)) hunter.lure = null;
        else {
          walkTowards(hunter, hunter.lure, world, dt);
          return null;
        }
      }
      // Stalking: peck what is in reach, peck up fruit underfoot, or walk after the nearest snake.
      const target = pointInReach(hunter, world.snakes);
      if (target) {
        hunter.aim = { x: target.x, y: target.y };
        hunter.from = { x: hunter.x, y: hunter.y };
        if (Math.abs(target.x - hunter.x) > 2) hunter.facing = target.x > hunter.x ? 1 : -1;
        enter(hunter, 'windup');
        return null;
      }
      if (world.apples.some((a) => Math.hypot(a.x - hunter.x, a.y - hunter.y) < GRAZE_REACH)) {
        enter(hunter, 'graze');
        return null;
      }
      const quarry = nearestSnake(hunter, world.snakes);
      if (quarry) walkTowards(hunter, quarry.head, world, dt);
      return null;
    }
  }
}
