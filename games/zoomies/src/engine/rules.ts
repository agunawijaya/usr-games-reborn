import { restoreRng } from '@usr-games/kit';
import { isBlocked, sign } from './layout';
import type {
  Action,
  Dock,
  Layout,
  Legality,
  Point,
  RoomState,
  Step,
  Tangle,
  TangleKind,
  TurnEvent,
  TurnResult,
  Vacuum,
  VacuumKind,
} from './types';

/**
 * One turn of Zoomies, as the original played one turn of robots: the cat acts, then every
 * vacuum takes one step straight at the cat. Two vacuums on one square bonk and tangle, and a
 * vacuum that rolls into a tangle is stuck too. Everything is pure: a state goes in, a new
 * state and a list of what happened come out.
 */

export const MAX_SAFE_ZOOMS = 3;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface Working {
  readonly layout: Layout;
  readonly rules: RoomState['rules'];
  cat: Point;
  vacuums: Mutable<Vacuum>[];
  tangles: Tangle[];
  dock: Mutable<Dock> | null;
  turn: number;
  safeZooms: number;
  zooms: number;
  tangled: number;
  napBonus: number;
  napping: boolean;
  loafing: boolean;
  status: RoomState['status'];
  rng: RoomState['rng'];
  events: TurnEvent[];
}

function working(state: RoomState): Working {
  return {
    layout: state.layout,
    rules: state.rules,
    cat: state.cat,
    vacuums: state.vacuums.map((v) => ({ ...v })),
    tangles: [...state.tangles],
    dock: state.dock ? { ...state.dock } : null,
    turn: state.turn,
    safeZooms: state.safeZooms,
    zooms: state.zooms,
    tangled: state.tangled,
    napBonus: state.napBonus,
    napping: state.napping,
    loafing: false,
    status: state.status,
    rng: state.rng,
    events: [],
  };
}

function frozen(w: Working): RoomState {
  return {
    layout: w.layout,
    rules: w.rules,
    cat: w.cat,
    vacuums: w.vacuums,
    tangles: w.tangles,
    dock: w.dock,
    turn: w.turn,
    safeZooms: w.safeZooms,
    zooms: w.zooms,
    tangled: w.tangled,
    napBonus: w.napBonus,
    napping: w.napping,
    status: w.status,
    rng: w.rng,
  };
}

export function tangleAt(tangles: readonly Tangle[], x: number, y: number): Tangle | undefined {
  return tangles.find((t) => t.x === x && t.y === y);
}

export function vacuumAt(vacuums: readonly Vacuum[], x: number, y: number): Vacuum | undefined {
  return vacuums.find((v) => v.alive && v.x === x && v.y === y);
}

/** A square the cat could stand on: on the rug, not under furniture, not taken. */
export function isFree(
  state: Pick<RoomState, 'layout' | 'vacuums' | 'tangles'>,
  x: number,
  y: number,
) {
  return (
    !isBlocked(state.layout, x, y) &&
    !vacuumAt(state.vacuums, x, y) &&
    !tangleAt(state.tangles, x, y)
  );
}

export function aliveCount(state: Pick<RoomState, 'vacuums'>): number {
  let count = 0;
  for (const v of state.vacuums) if (v.alive) count++;
  return count;
}

// ---------------------------------------------------------------------------------------------
// How each kind of vacuum picks its step

type Offset = readonly [Step, Step];

/**
 * The steps a vacuum would like to take, best first. The original robot moves by the sign of
 * the distance on both axes; furniture (which the original never had) sends it along one axis
 * instead, the longer one first.
 */
export function preferredSteps(kind: VacuumKind, dx: number, dy: number): Offset[] {
  const sx = sign(dx);
  const sy = sign(dy);
  const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
  if (kind === 'mop') {
    // Mops only travel along the floorboards: one axis at a time, the longer one first.
    const steps: Offset[] = [];
    const along: Offset = [sx, 0];
    const across: Offset = [0, sy];
    for (const step of horizontalFirst ? [along, across] : [across, along]) {
      if (step[0] !== 0 || step[1] !== 0) steps.push(step);
    }
    return steps;
  }
  if (sx === 0 && sy === 0) return [];
  if (sx === 0 || sy === 0) return [[sx, sy]];
  return horizontalFirst
    ? [
        [sx, sy],
        [sx, 0],
        [0, sy],
      ]
    : [
        [sx, sy],
        [0, sy],
        [sx, 0],
      ];
}

export function nextStep(layout: Layout, vacuum: Point & { kind: VacuumKind }, cat: Point): Point {
  for (const [sx, sy] of preferredSteps(vacuum.kind, cat.x - vacuum.x, cat.y - vacuum.y)) {
    const x = vacuum.x + sx;
    const y = vacuum.y + sy;
    if (!isBlocked(layout, x, y)) return { x, y };
  }
  return { x: vacuum.x, y: vacuum.y };
}

// ---------------------------------------------------------------------------------------------
// Bonks, tangles and the end of a turn

function tangleGroup(w: Working, group: Mutable<Vacuum>[], phase: 1 | 2) {
  const { x, y } = group[0]!;
  const index = w.tangles.findIndex((t) => t.x === x && t.y === y);
  const existing = index >= 0 ? w.tangles[index]! : undefined;
  for (const v of group) v.alive = false;
  if (existing) w.tangles[index] = { ...existing, size: existing.size + group.length };
  else w.tangles.push({ x, y, kind: 'wreck', size: group.length });
  w.tangled += group.length;
  if (w.napping) w.napBonus += group.length;
  if (w.loafing && w.rules === 'house' && w.safeZooms < MAX_SAFE_ZOOMS) {
    w.safeZooms = Math.min(MAX_SAFE_ZOOMS, w.safeZooms + group.length);
    w.events.push({ type: 'safe-zoom-earned', total: w.safeZooms });
  }
  w.events.push({
    type: 'bonk',
    at: { x, y },
    ids: group.map((v) => v.id),
    onTangle: existing ? existing.kind : null,
    phase,
  });
}

function swallow(w: Working, sweeper: Mutable<Vacuum>, tangleIndex: number) {
  const swallowed: TangleKind = w.tangles[tangleIndex]!.kind;
  w.tangles.splice(tangleIndex, 1);
  sweeper.full = true;
  w.events.push({ type: 'gulp', id: sweeper.id, at: { x: sweeper.x, y: sweeper.y }, swallowed });
}

/**
 * After vacuums move: anything on the cat's square catches it; two or more on one square bonk;
 * a lone vacuum on a tangle is stuck, unless it is a hungry sweeper, which swallows the tangle.
 * The original checked for the catch first, so a pile-up on the cat still counts as a catch.
 */
function resolve(w: Working, phase: 1 | 2) {
  const caughtBy: number[] = [];
  const groups = new Map<number, Mutable<Vacuum>[]>();
  for (const v of w.vacuums) {
    if (!v.alive) continue;
    if (v.x === w.cat.x && v.y === w.cat.y) {
      caughtBy.push(v.id);
      continue;
    }
    const key = v.y * w.layout.width + v.x;
    const group = groups.get(key);
    if (group) group.push(v);
    else groups.set(key, [v]);
  }
  for (const group of groups.values()) {
    const { x, y } = group[0]!;
    const tangleIndex = w.tangles.findIndex((t) => t.x === x && t.y === y);
    if (group.length >= 2) tangleGroup(w, group, phase);
    else if (tangleIndex >= 0) {
      const lone = group[0]!;
      if (w.rules === 'house' && lone.kind === 'sweeper' && !lone.full)
        swallow(w, lone, tangleIndex);
      else tangleGroup(w, group, phase);
    }
  }
  if (w.dock && !w.dock.jammed && tangleAt(w.tangles, w.dock.x, w.dock.y)) {
    w.dock.jammed = true;
    w.events.push({ type: 'dock-jammed', at: { x: w.dock.x, y: w.dock.y } });
  }
  if (caughtBy.length > 0) {
    w.status = 'caught';
    w.events.push({ type: 'caught', at: w.cat, by: caughtBy });
  }
}

function moveAll(w: Working, movers: Mutable<Vacuum>[], phase: 1 | 2) {
  const targets = movers.map((v) => nextStep(w.layout, v, w.cat));
  movers.forEach((v, i) => {
    const to = targets[i]!;
    if (to.x === v.x && to.y === v.y) return;
    w.events.push({ type: 'vacuum-move', id: v.id, from: { x: v.x, y: v.y }, to, phase });
    v.x = to.x;
    v.y = to.y;
  });
  resolve(w, phase);
}

function vacuumsMove(w: Working) {
  const movers: Mutable<Vacuum>[] = [];
  for (const v of w.vacuums) {
    if (!v.alive) continue;
    if (v.kind === 'slow' && v.resting) w.events.push({ type: 'vacuum-rest', id: v.id });
    else movers.push(v);
  }
  moveAll(w, movers, 1);
  for (const v of w.vacuums) if (v.alive && v.kind === 'slow') v.resting = !v.resting;
  if (w.status !== 'playing') return;
  const turbos = w.vacuums.filter((v) => v.alive && v.kind === 'turbo');
  if (turbos.length > 0) moveAll(w, turbos, 2);
}

function dockSends(w: Working) {
  const dock = w.dock;
  if (!dock || dock.jammed || dock.remaining <= 0 || w.turn % dock.every !== 0) return;
  const taken =
    (w.cat.x === dock.x && w.cat.y === dock.y) ||
    vacuumAt(w.vacuums, dock.x, dock.y) ||
    tangleAt(w.tangles, dock.x, dock.y);
  if (taken) return;
  const id = w.vacuums.length;
  w.vacuums.push({
    id,
    kind: 'basic',
    x: dock.x,
    y: dock.y,
    alive: true,
    resting: false,
    full: false,
  });
  dock.remaining -= 1;
  w.events.push({ type: 'dock-spawn', id, at: { x: dock.x, y: dock.y } });
}

function checkCleared(w: Working) {
  if (w.status !== 'playing') return;
  if (w.vacuums.some((v) => v.alive)) return;
  if (w.dock && !w.dock.jammed && w.dock.remaining > 0) return;
  w.status = 'cleared';
  w.events.push({ type: 'cleared' });
}

// ---------------------------------------------------------------------------------------------
// The cat's side of the turn

function zoomLanding(w: Working): { to: Point; safe: boolean } {
  const rng = restoreRng(w.rng);
  const { width, height } = w.layout;
  let landing: { to: Point; safe: boolean } | null = null;
  if (w.rules === 'house' && w.safeZooms > 0) {
    const quiet = quietSquares(frozen(w));
    if (quiet.length > 0) landing = { to: quiet[rng.int(0, quiet.length - 1)]!, safe: true };
  }
  if (!landing) {
    // The original picks random squares until one is empty, even one next to a robot.
    for (;;) {
      const x = rng.int(0, width - 1);
      const y = rng.int(0, height - 1);
      if (isFree(w, x, y)) {
        landing = { to: { x, y }, safe: false };
        break;
      }
    }
  }
  w.rng = rng.state();
  return landing;
}

function catActs(w: Working, action: Action) {
  if (action.type === 'step') {
    if (action.dx === 0 && action.dy === 0) {
      w.events.push({ type: 'cat-wait', mode: 'stay' });
      return;
    }
    const to = { x: w.cat.x + action.dx, y: w.cat.y + action.dy };
    if (!isFree(w, to.x, to.y)) throw new Error(`Blocked step to ${to.x},${to.y}`);
    w.events.push({ type: 'cat-step', from: w.cat, to });
    w.cat = to;
    return;
  }
  if (action.type === 'wait') {
    if (action.mode === 'nap') w.napping = true;
    else w.loafing = true;
    w.events.push({ type: 'cat-wait', mode: action.mode });
    return;
  }
  const { to, safe } = zoomLanding(w);
  if (safe) w.safeZooms -= 1;
  w.zooms += 1;
  w.events.push({ type: 'cat-zoom', from: w.cat, to, safe });
  w.cat = to;
}

/** Plays one turn. Throws on a blocked step; check `legality` first. */
export function applyAction(state: RoomState, action: Action): TurnResult {
  if (state.status !== 'playing') return { state, events: [] };
  const w = working(state);
  w.turn += 1;
  catActs(w, action);
  vacuumsMove(w);
  if (w.status === 'playing') dockSends(w);
  checkCleared(w);
  return { state: frozen(w), events: w.events };
}

export function legality(state: RoomState, action: Action): Legality {
  if (state.status !== 'playing') return 'over';
  if (action.type === 'zoom') return 'ok';
  if (action.type === 'wait' && action.mode === 'nap') return 'ok';
  if (action.type === 'step' && (action.dx !== 0 || action.dy !== 0)) {
    if (!isFree(state, state.cat.x + action.dx, state.cat.y + action.dy)) return 'blocked';
  }
  return applyAction(state, action).state.status === 'caught' ? 'unsafe' : 'ok';
}

/** True if a cat standing on this square for the coming turn would be caught. */
export function isDangerous(state: RoomState, x: number, y: number): boolean {
  const moved: RoomState = { ...state, cat: { x, y } };
  return applyAction(moved, { type: 'step', dx: 0, dy: 0 }).state.status === 'caught';
}

/** Every free square where a cat could sit out the coming turn untouched. */
export function quietSquares(state: RoomState): Point[] {
  const squares: Point[] = [];
  for (let y = 0; y < state.layout.height; y++) {
    for (let x = 0; x < state.layout.width; x++) {
      if (isFree(state, x, y) && !isDangerous(state, x, y)) squares.push({ x, y });
    }
  }
  return squares;
}

export const STEPS: readonly (readonly [Step, Step])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** The cat's nine options this turn (the eight neighbours and staying put), judged. */
export function whiskers(state: RoomState): { dx: Step; dy: Step; verdict: Legality }[] {
  return STEPS.map(([dx, dy]) => ({
    dx,
    dy,
    verdict: legality(state, { type: 'step', dx, dy }),
  }));
}

/** Nowhere to step or stay without being caught: only a zoom (or a risky nap) is left. */
export function mustZoom(state: RoomState): boolean {
  return state.status === 'playing' && whiskers(state).every((w) => w.verdict !== 'ok');
}
