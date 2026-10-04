// Talon's Shadow — rival snakes. Smaller, slower snakes slither in from the corners after the
// same harvest: each goes for the fruit nearest to it, finds its way round fences (paths.mjs),
// and once the field is bare leaves over the nearest edge. They never harm the player, and the
// bird hunts only the player. Pure: the page draws them and keeps the harvest's count.

import { pushOut } from './fences.mjs';
import { farthestInSight, routeTo } from './paths.mjs';

const SEGMENTS = 22;
const SEGMENT_LENGTH = 7;
/** How quickly a rival swings round to the way it wants to go, per millisecond. */
const TURN = 0.005;
/** A rival works out its route again this often, in case the fruit it was after has gone. */
const ROUTE_MS = 700;
/** How far from the edges a rival keeps until it leaves. */
const EDGE_MARGIN = 26;
const EAT_RADIUS = 14;
/** How far ahead a rival looks for another snake's body, and the turns it tries to miss one. */
const BODY_LOOK = 34;
const SWERVES = [40, -40, 80, -80, 120, -120, 160, -160];
/** A rival the bird has locked on to keeps straight on, faster, as the player would. */
const STARTLED_PACE = 1.5;
/** After a fruit a rival slows to a crawl for a while, swallowing. */
const DIGEST_MS = 2000;
const DIGEST_PACE = 0.35;
/** Every so often a rival checks it has got somewhere; if not, it tries another way for a while. */
const STUCK_CHECK_MS = 600;
const DETOUR_MS = 900;

/** Where rivals come in: the far corners, heading for the middle. */
const ENTRIES = [
  { x: 820, y: 90 },
  { x: 80, y: 90 },
  { x: 820, y: 520 },
];

const unit = (x, y) => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

const rotate = (v, degrees) => {
  const a = (degrees * Math.PI) / 180;
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) };
};

/**
 * A rival at its corner, its body trailing behind it.
 * @param {number} index 0, 1 or 2
 * @param {number} speed pixels a millisecond
 */
export function makeRival(index, speed) {
  const entry = ENTRIES[index % ENTRIES.length];
  const heading = unit(450 - entry.x, 300 - entry.y);
  const segments = [];
  for (let i = 0; i < SEGMENTS; i++) {
    segments.push({
      x: entry.x - heading.x * i * SEGMENT_LENGTH,
      y: entry.y - heading.y * i * SEGMENT_LENGTH,
    });
  }
  return {
    index,
    segments,
    dx: heading.x,
    dy: heading.y,
    speed,
    ate: 0,
    leaving: false,
    gone: false,
    side: index % 2 === 0 ? 1 : -1,
    clock: 0,
    mark: { x: entry.x, y: entry.y, at: 0 },
    detour: null,
    route: [],
    routeFor: '',
    routeUntil: 0,
    fullUntil: 0,
  };
}

function nearestFruit(head, apples) {
  let best = null;
  for (const apple of apples) {
    const d = Math.hypot(apple.x - head.x, apple.y - head.y);
    if (!best || d < best.d) best = { x: apple.x, y: apple.y, d };
  }
  return best;
}

/** A point just beyond the edge nearest to the head. */
function wayOut(head, width, height) {
  const ways = [
    { d: head.x, x: -60, y: head.y },
    { d: width - head.x, x: width + 60, y: head.y },
    { d: head.y, x: head.x, y: -60 },
    { d: height - head.y, x: head.x, y: height + 60 },
  ];
  return ways.reduce((best, way) => (way.d < best.d ? way : best));
}

/** The way to head for `goal`: along a route round the fences, towards its farthest point in sight. */
function aimAt(rival, head, goal, fences) {
  const key = `${Math.round(goal.x)},${Math.round(goal.y)}`;
  if (rival.routeFor !== key || rival.clock >= rival.routeUntil) {
    rival.route = routeTo(head, goal, fences);
    rival.routeFor = key;
    rival.routeUntil = rival.clock + ROUTE_MS;
  }
  while (rival.route.length > 1 && Math.hypot(rival.route[0].x - head.x, rival.route[0].y - head.y) < 16) {
    rival.route.shift();
  }
  const aim = rival.route.length ? farthestInSight(head, rival.route.slice(0, 10), fences) : goal;
  return unit(aim.x - head.x, aim.y - head.y);
}

/** True when heading `dir` from `head` would run into another snake's body soon. */
function bodyAhead(rival, head, dir, bodies) {
  for (const t of [0.35, 0.7, 1]) {
    const x = head.x + dir.x * BODY_LOOK * t;
    const y = head.y + dir.y * BODY_LOOK * t;
    for (const body of bodies) {
      if (body.owner === rival) continue;
      const reach = body.r + 8;
      const dx = body.x - x;
      const dy = body.y - y;
      if (dx * dx + dy * dy < reach * reach) return true;
    }
  }
  return false;
}

/** The way it wants, or the nearest turn from it that misses every other snake's body. */
function missBodies(rival, head, want, bodies) {
  if (!bodies.length || !bodyAhead(rival, head, want, bodies)) return want;
  for (const degrees of SWERVES) {
    const dir = rotate(want, degrees * rival.side);
    if (!bodyAhead(rival, head, dir, bodies)) return dir;
  }
  return want;
}

/** A rival that has hardly moved for a while picks a way off to one side for a moment. */
function watchForStuck(rival, head, want, random) {
  if (rival.clock - rival.mark.at < STUCK_CHECK_MS) return;
  const moved = Math.hypot(head.x - rival.mark.x, head.y - rival.mark.y);
  if (moved < 12) {
    rival.side = -rival.side;
    rival.detour = { dir: rotate(want, (random() < 0.5 ? 90 : -90) * rival.side), until: rival.clock + DETOUR_MS };
  }
  rival.mark = { x: head.x, y: head.y, at: rival.clock };
}

/**
 * One step of a rival. Returns the index of the fruit it ate, or -1.
 * @param {ReturnType<typeof makeRival>} rival
 * @param {{ apples: { x: number, y: number }[], fences: import('./fences.mjs').Rect[],
 *   bare: boolean, width: number, height: number, random: () => number, hunted?: boolean,
 *   bodies?: { owner: unknown, x: number, y: number, r: number }[] }} world
 *   `hunted`: the bird has locked on to this rival; `bodies`: every snake's body, to steer round
 * @param {number} dt milliseconds
 */
export function stepRival(rival, world, dt) {
  if (rival.gone) return -1;
  rival.clock += dt;
  if (world.bare) rival.leaving = true;
  const head = rival.segments[0];
  const goal = rival.leaving ? wayOut(head, world.width, world.height) : nearestFruit(head, world.apples);
  let want = goal ? aimAt(rival, head, goal, world.fences) : { x: rival.dx, y: rival.dy };
  if (rival.detour && rival.clock < rival.detour.until) want = rival.detour.dir;
  if (world.hunted) want = { x: rival.dx, y: rival.dy };
  else watchForStuck(rival, head, want, world.random);
  want = missBodies(rival, head, want, world.bodies ?? []);

  const swing = Math.min(1, TURN * dt);
  const turned = unit(rival.dx + (want.x - rival.dx) * swing, rival.dy + (want.y - rival.dy) * swing);
  rival.dx = turned.x;
  rival.dy = turned.y;
  const pace = (rival.clock < rival.fullUntil ? DIGEST_PACE : 1) * (world.hunted ? STARTLED_PACE : 1);
  head.x += rival.dx * rival.speed * pace * dt;
  head.y += rival.dy * rival.speed * pace * dt;
  pushOut(head, 7, world.fences);
  if (!rival.leaving) {
    head.x = Math.min(world.width - EDGE_MARGIN / 2, Math.max(EDGE_MARGIN / 2, head.x));
    head.y = Math.min(world.height - EDGE_MARGIN / 2, Math.max(EDGE_MARGIN / 2, head.y));
  }
  for (let i = 1; i < rival.segments.length; i++) {
    const before = rival.segments[i - 1];
    const segment = rival.segments[i];
    const d = Math.hypot(segment.x - before.x, segment.y - before.y) || 1;
    if (d > SEGMENT_LENGTH) {
      const t = SEGMENT_LENGTH / d;
      segment.x = before.x + (segment.x - before.x) * t;
      segment.y = before.y + (segment.y - before.y) * t;
    }
  }

  if (rival.leaving) {
    const tail = rival.segments[rival.segments.length - 1];
    const off = (p) => p.x < -20 || p.x > world.width + 20 || p.y < -20 || p.y > world.height + 20;
    if (off(head) && off(tail)) rival.gone = true;
    return -1;
  }
  const eaten = world.apples.findIndex((apple) => Math.hypot(apple.x - head.x, apple.y - head.y) < EAT_RADIUS);
  if (eaten >= 0) {
    rival.ate++;
    rival.fullUntil = rival.clock + DIGEST_MS;
  }
  return eaten;
}
