// Control Room 1986 — the testing aid's planner. For every plane on the radar it finds a route
// the engine will accept: to its exit, arriving at 9,000 feet, or onto its runway, touching down
// at 0 on the runway's heading. The search runs over the moves a plane can make (a quarter turn
// and 1,000 feet a move at most), counted in ticks, since props move only every other tick.
// Planes are planned one after another, the shortest on fuel first; each keeps clear of the
// routes already planned (within one cell and 1,000 feet at the same tick is a loss), so
// following the suggestions brings a shift home. A plane with no route found gets hints.js's
// rules of thumb instead, and a plane on the ground waits until its climb-out is clear.
// Pure; main.js shows the result in the hidden cheat panel.

import { clampDirDelta, DIR_KEYS, DIR_NAMES, DISPLACEMENT, FEATURE, MAXDIR } from './engine.js';
import { hintForPlane, sortHintsByPriority } from './hints.js';

const KEY_FOR_DIR = [];
for (const [key, dir] of Object.entries(DIR_KEYS)) KEY_FOR_DIR[dir] = key;

/** A search stops after this many states, so the panel never stalls on a crowded board. */
const SEARCH_LIMIT = 8000;
/** A plane not planned yet is expected to hold its present orders this many ticks. */
const DRIFT_TICKS = 3;
/** Fuel left over at arrival below which a route's first order is shown as urgent. */
const TIGHT_FUEL = 3;
// Among routes of the same length, the one a controller would fly: the orders already given kept
// when they fit, few turns, altitude changed only towards where the plane needs it, and a plane
// leaving the sector up at 9,000 feet early. Kept small enough that they never make a route
// longer: forty moves of all of them add up to less than one move.
const KEEP_ORDERS_COST = 0.002;
const TURN_COST = 0.003;
const CLIMB_COST = 0.002;
const WRONG_WAY_COST = 0.006;
const LOW_FOR_EXIT_COST = 0.001;

/** The tick of a plane's `step`-th move from now: jets move every tick, props on even ticks. */
function moveTick(plane, clock, step) {
  if (plane.planeType === 1) return clock + step;
  const first = (clock + 1) % 2 === 0 ? clock + 1 : clock + 2;
  return first + 2 * (step - 1);
}

/** Where every plane is expected, tick by tick: tick → [{ x, y, alt }]. */
function createReservations() {
  return new Map();
}

function reserve(reservations, tick, x, y, alt) {
  if (!reservations.has(tick)) reservations.set(tick, []);
  reservations.get(tick).push({ x, y, alt });
}

/** True when a plane there at that tick would be within one cell and 1,000 feet of another. */
function clashes(reservations, tick, x, y, alt) {
  const others = reservations.get(tick);
  return Boolean(others?.some((o) => Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1 && Math.abs(o.alt - alt) <= 1));
}

/** A small binary heap ordered by `rank`. */
function createQueue() {
  const items = [];
  return {
    get size() {
      return items.length;
    },
    push(item) {
      items.push(item);
      let i = items.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (items[parent].rank <= items[i].rank) break;
        [items[parent], items[i]] = [items[i], items[parent]];
        i = parent;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const left = 2 * i + 1;
          const right = left + 1;
          let least = i;
          if (left < items.length && items[left].rank < items[least].rank) least = left;
          if (right < items.length && items[right].rank < items[least].rank) least = right;
          if (least === i) break;
          [items[least], items[i]] = [items[i], items[least]];
          i = least;
        }
      }
      return top;
    },
  };
}

/**
 * The shortest route for one plane that keeps clear of the reservations, as a list of moves
 * { x, y, alt, dir, tick } ending with the arrival; null when none is found within the limits.
 */
function findRoute(plane, playfield, clock, reservations, onGround) {
  const toExit = plane.destType === FEATURE.EXIT;
  const goal = toExit ? playfield.exits[plane.destNo] : playfield.airports[plane.destNo];
  const estimate = (x, y, alt) =>
    Math.max(Math.abs(goal.x - x), Math.abs(goal.y - y), toExit ? 9 - alt : alt);
  const seen = new Map();
  const queue = createQueue();
  const goalAlt = toExit ? 9 : 0;
  // Where the plane's present orders take it on its next move.
  const orderedAlt = onGround ? 1 : plane.altitude + Math.sign(plane.newAltitude - plane.altitude);
  const orderedDir = plane.delayed
    ? plane.dir
    : plane.newDir === MAXDIR
      ? (plane.dir + 2) % MAXDIR
      : (plane.dir + clampDirDelta(plane.dir, plane.newDir) + MAXDIR) % MAXDIR;
  queue.push({ x: plane.xpos, y: plane.ypos, alt: plane.altitude, dir: plane.dir, step: 0, cost: 0, parent: null, rank: 0 });
  let expanded = 0;
  while (queue.size && expanded < SEARCH_LIMIT) {
    const state = queue.pop();
    // An arrival taken from the queue is the cheapest route there is.
    if (state.arrived) return unwind(state);
    expanded += 1;
    const step = state.step + 1;
    if (step > plane.fuel) continue;
    const tick = moveTick(plane, clock, step);
    const nextTick = moveTick(plane, clock, step + 1);
    // From the ground the first move can only climb.
    const climbs = onGround && state.step === 0 ? [1] : [-1, 0, 1];
    for (const turn of [0, -1, 1, -2, 2]) {
      const dir = (state.dir + turn + MAXDIR) % MAXDIR;
      const x = state.x + DISPLACEMENT[dir].dx;
      const y = state.y + DISPLACEMENT[dir].dy;
      for (const climb of climbs) {
        const alt = state.alt + climb;
        if (alt < 0 || alt > 9) continue;
        const awayFromGoal = climb !== 0 && Math.abs(goalAlt - alt) > Math.abs(goalAlt - state.alt);
        const newOrders = step === 1 && (alt !== orderedAlt || dir !== orderedDir);
        const cost =
          state.cost + 1 +
          Math.abs(turn) * TURN_COST +
          Math.abs(climb) * CLIMB_COST +
          (awayFromGoal ? WRONG_WAY_COST : 0) +
          (newOrders ? KEEP_ORDERS_COST : 0) +
          (toExit ? (9 - alt) * LOW_FOR_EXIT_COST : 0);
        const move = { x, y, alt, dir, tick, step, cost, parent: state };
        const arrives = toExit
          ? x === goal.x && y === goal.y && alt === 9
          : x === goal.x && y === goal.y && alt === 0 && dir === goal.dir;
        if (arrives) {
          queue.push({ ...move, arrived: true, rank: cost });
          continue;
        }
        if (alt === 0) continue; // the ground anywhere else ends the shift
        if (x < 0 || y < 0 || x >= playfield.width || y >= playfield.height) continue;
        if (toExit && x === goal.x && y === goal.y) continue; // its exit, but not at 9
        let blocked = false;
        for (let t = tick; t < nextTick && !blocked; t++) blocked = clashes(reservations, t, x, y, alt);
        if (blocked) continue;
        const key = `${x},${y},${alt},${dir}`;
        if ((seen.get(key) ?? Infinity) <= cost) continue;
        seen.set(key, cost);
        queue.push({ ...move, rank: cost + estimate(x, y, alt) });
      }
    }
  }
  return null;
}

function unwind(move) {
  const moves = [];
  for (let m = move; m && m.step > 0; m = m.parent) moves.push({ x: m.x, y: m.y, alt: m.alt, dir: m.dir, tick: m.tick });
  return moves.reverse();
}

/**
 * Keeps a planned route's place free for the planes planned after it: where the plane waits
 * before its first move (a prop sits out every other tick), then each move until the next, but
 * not its arrival.
 */
function reserveRoute(reservations, plane, clock, route) {
  for (let t = clock + 1; t < route[0].tick; t++) reserve(reservations, t, plane.xpos, plane.ypos, plane.altitude);
  route.slice(0, -1).forEach((move, i) => {
    const until = moveTick(plane, clock, i + 2);
    for (let t = move.tick; t < until; t++) reserve(reservations, t, move.x, move.y, move.alt);
  });
}

/** A plane not planned yet: where its present orders take it over the next few ticks. */
function reserveDrift(reservations, plane, clock) {
  let { xpos: x, ypos: y, altitude: alt, dir } = plane;
  for (let t = clock + 1; t <= clock + DRIFT_TICKS; t++) {
    if (plane.planeType === 1 || t % 2 === 0) {
      alt += Math.sign(plane.newAltitude - alt);
      if (!plane.delayed) dir = plane.newDir === MAXDIR ? (dir + 2) % MAXDIR : (dir + clampDirDelta(dir, plane.newDir) + MAXDIR) % MAXDIR;
      x += DISPLACEMENT[dir].dx;
      y += DISPLACEMENT[dir].dy;
    }
    reserve(reservations, t, x, y, alt);
  }
}

/**
 * The fewest orders that fly the start of a route exactly: one heading the engine's own turning
 * reaches move by move, and one altitude at the end of the climb or descent that begins now.
 */
function ordersForRoute(plane, route) {
  let heading = route[0].dir;
  for (let k = route.length - 1; k > 0; k--) {
    const target = route[k].dir;
    let dir = plane.dir;
    let follows = true;
    for (let i = 0; i <= k && follows; i++) {
      dir = (dir + clampDirDelta(dir, target) + MAXDIR) % MAXDIR;
      follows = dir === route[i].dir;
    }
    if (follows) {
      heading = target;
      break;
    }
  }
  const change = route[0].alt - plane.altitude;
  let altitude = route[0].alt;
  for (let i = 1; change !== 0 && i < route.length && route[i].alt - route[i - 1].alt === change; i++) altitude = route[i].alt;
  const orders = [];
  if (plane.delayed || plane.newDir !== heading) orders.push(`${plane.letter}t${KEY_FOR_DIR[heading]}`);
  if (plane.newAltitude !== altitude) orders.push(`${plane.letter}a${altitude}`);
  return orders;
}

function describeRoute(plane, playfield, route) {
  if (plane.destType === FEATURE.EXIT) {
    return `Route to exit ${playfield.exits[plane.destNo].label}: ${route.length} moves, out at 9,000 ft.`;
  }
  const airport = playfield.airports[plane.destNo];
  return `Approach to airport ${airport.label}: ${route.length} moves, down at 0 heading ${DIR_NAMES[airport.dir]}.`;
}

/**
 * The cheat panel's rows for the whole board: [{ letter, hint }], urgent first. A hint carries
 * `commands` (none, one or two orders to type, in order) and `command`, the first of them.
 * @param {{ playfield: object, clock: number, air: object[], ground: object[] }} game
 */
export function planTraffic(game) {
  const { playfield, clock } = game;
  const reservations = createReservations();
  const air = [...game.air].sort((a, b) => a.fuel - b.fuel || a.letter.localeCompare(b.letter));
  const rows = [];
  const planned = new Set();
  for (const plane of air) {
    // First keeping clear of where the planes still to plan are heading too; failing that, of
    // the planned routes only, and the planes planned later find their way round this one.
    const ahead = withDrift(reservations, game.air.filter((other) => other !== plane && !planned.has(other)), clock);
    const route = findRoute(plane, playfield, clock, ahead, false) ?? findRoute(plane, playfield, clock, reservations, false);
    planned.add(plane);
    if (!route) {
      const escape = safestMove(plane, playfield, clock, reservations);
      if (escape) {
        reserveRoute(reservations, plane, clock, [escape, escape]);
        const commands = ordersForRoute(plane, [escape]);
        rows.push({
          letter: plane.letter,
          hint: { priority: 'urgent', tag: 'GIVE WAY', command: commands[0] ?? null, commands, explain: 'No clear route yet: this move keeps clear of the traffic around it.' },
        });
        continue;
      }
      reserveDrift(reservations, plane, clock);
      const hint = hintForPlane(plane, playfield, false, game.air);
      if (hint) rows.push({ letter: plane.letter, hint: { ...hint, commands: hint.command ? [hint.command] : [] } });
      continue;
    }
    reserveRoute(reservations, plane, clock, route);
    const commands = ordersForRoute(plane, route);
    const tight = plane.fuel - route.length <= TIGHT_FUEL || route.length <= 2;
    rows.push({
      letter: plane.letter,
      hint: {
        priority: commands.length ? (tight ? 'urgent' : 'normal') : 'ok',
        tag: commands.length ? 'ROUTE' : 'ON COURSE',
        command: commands[0] ?? null,
        commands,
        explain: describeRoute(plane, playfield, route),
      },
    });
  }

  for (const plane of game.ground) {
    const route = findRoute(plane, playfield, clock, reservations, true);
    if (route) {
      reserveRoute(reservations, plane, clock, route);
      const commands = ordersForRoute(plane, route);
      rows.push({
        letter: plane.letter,
        hint: { priority: 'normal', tag: 'TAKEOFF', command: commands[0] ?? null, commands, explain: `Climb-out is clear. ${describeRoute(plane, playfield, route)}` },
      });
    } else {
      rows.push({
        letter: plane.letter,
        hint: { priority: 'ok', tag: 'HOLD SHORT', command: null, commands: [], explain: 'Traffic over the field: wait on the ground for a clear climb-out.' },
      });
    }
  }
  return sortHintsByPriority(rows);
}

/**
 * When no whole route is clear: the next move that stays in the sector and off the ground, keeps
 * clear of every reservation for the next two moves if it can, and otherwise gets as far from the
 * nearest traffic as it can, closer to the destination breaking ties.
 */
function safestMove(plane, playfield, clock, reservations) {
  const goal = plane.destType === FEATURE.EXIT ? playfield.exits[plane.destNo] : playfield.airports[plane.destNo];
  const tick = moveTick(plane, clock, 1);
  const nearest = (x, y, alt, t) =>
    Math.min(9, ...(reservations.get(t) ?? []).map((o) => Math.max(Math.abs(o.x - x), Math.abs(o.y - y), Math.abs(o.alt - alt) - 0.5)));
  let best = null;
  for (const turn of [0, -1, 1, -2, 2]) {
    const dir = (plane.dir + turn + MAXDIR) % MAXDIR;
    const x = plane.xpos + DISPLACEMENT[dir].dx;
    const y = plane.ypos + DISPLACEMENT[dir].dy;
    if (!inside(playfield, x, y) || !hasWayOn(playfield, x, y, dir)) continue;
    for (const climb of [-1, 0, 1]) {
      const alt = plane.altitude + climb;
      if (alt < 1 || alt > 9) continue;
      if (plane.destType === FEATURE.EXIT && x === goal.x && y === goal.y && alt !== 9) continue;
      const room = Math.min(nearest(x, y, alt, tick), nearest(x, y, alt, tick + 1));
      const score = room * 100 - Math.max(Math.abs(goal.x - x), Math.abs(goal.y - y));
      if (!best || score > best.score) best = { x, y, alt, dir, tick, score };
    }
  }
  return best && best.score > 100 ? best : null;
}

function inside(playfield, x, y) {
  return x >= 0 && y >= 0 && x < playfield.width && y < playfield.height;
}

/** True when a plane there can still turn (a quarter turn at most) onto a move that stays inside. */
function hasWayOn(playfield, x, y, dir) {
  return [-2, -1, 0, 1, 2].some((turn) => {
    const next = DISPLACEMENT[(dir + turn + MAXDIR) % MAXDIR];
    return inside(playfield, x + next.dx, y + next.dy);
  });
}

/** The routes planned so far, plus where the planes still to plan are drifting. */
function withDrift(planned, unplanned, clock) {
  const merged = new Map();
  for (const [tick, list] of planned) merged.set(tick, [...list]);
  for (const other of unplanned) reserveDrift(merged, other, clock);
  return merged;
}
