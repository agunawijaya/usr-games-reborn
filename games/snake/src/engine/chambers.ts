import type { Rng } from '@usr-games/kit';
import type { Garden, Ground } from './garden';
import { type Cell, reach } from './geometry';

/**
 * The chambers of a run. Each kind bends one thing: hedges to steer round, pools the snake swims
 * through faster, narrow corridors, two glints at once, a snake that sleeps until your third
 * glint, and a mirror chamber where peeking always shows the way.
 */
export type ChamberKind =
  'lawn' | 'hedges' | 'pools' | 'corridors' | 'twin' | 'sleeping' | 'mirror';

export interface ChamberPlan {
  readonly kind: ChamberKind;
  /** 1 for the first chamber of a run. */
  readonly depth: number;
  readonly name: string;
  readonly traits: readonly string[];
  readonly width: number;
  readonly height: number;
  /** How much more each glint is worth than the original's rate for this board. */
  readonly rate: number;
  /** Boldness the snake brings to this chamber before you pick anything up, in loot. */
  readonly appetite: number;
  readonly glints: 1 | 2;
  readonly wakeAt: number;
  readonly peekAlways: boolean;
}

const NAMES: Readonly<Record<ChamberKind, readonly string[]>> = {
  lawn: ['The Open Lawn', 'The Sunken Court', 'The Quiet Square'],
  hedges: ['The Hedge Walk', 'The Box Garden', 'The Clipped Rows'],
  pools: ['The Lily Court', 'The Still Pools', 'The Water Garden'],
  corridors: ['The Narrow Ways', 'The Long Alleys', 'The Green Halls'],
  twin: ['The Twin Beds', 'The Pair of Plots', 'The Double Lawn'],
  sleeping: ['The Sleeping Terrace', 'The Hush Garden', 'The Siesta Court'],
  mirror: ['The Mirror Pond', 'The Glass Garden', 'The Reflecting Walk'],
};

const TRAITS: Readonly<Record<ChamberKind, readonly string[]>> = {
  lawn: ['Open flagstones'],
  hedges: ['Hedges'],
  pools: ['Lily pools: the snake swims faster', 'Hedges'],
  corridors: ['Narrow corridors'],
  twin: ['Two glints at once', 'Hedges'],
  sleeping: ['Asleep until your third glint', 'Hedges'],
  mirror: ['Peek always shows the way', 'Lily pools'],
};

/** Ten kinds for a full run: the lawn first, the hedges second, the rest shuffled per run. */
const LATER: readonly ChamberKind[] = [
  'pools',
  'corridors',
  'twin',
  'sleeping',
  'mirror',
  'hedges',
  'pools',
  'corridors',
];
const DAILY_LATER: readonly ChamberKind[] = [
  'hedges',
  'pools',
  'corridors',
  'twin',
  'sleeping',
  'mirror',
];

export const RUN_LENGTH = 10;
export const DAILY_LENGTH = 5;

/** The way down narrows: the deeper the chamber, the less room to lead the snake about. */
export function sizeFor(depth: number): { width: number; height: number } {
  if (depth <= 1) return { width: 18, height: 11 };
  if (depth <= 4) return { width: 16, height: 10 };
  return { width: 14, height: 9 };
}

export function planChamber(kind: ChamberKind, depth: number, rng: Rng): ChamberPlan {
  const size = sizeFor(depth);
  const rate = 1 + 0.2 * (depth - 1);
  return {
    kind,
    depth,
    name: rng.pick(NAMES[kind]),
    traits: [...TRAITS[kind], `Glints worth ×${rate.toFixed(1)}`],
    ...size,
    rate,
    appetite: 10 * (depth - 1),
    glints: kind === 'twin' ? 2 : 1,
    wakeAt: kind === 'sleeping' ? 3 : 0,
    peekAlways: kind === 'mirror',
  };
}

/** A run's chambers: the same for every player who starts from the same seed. */
export function planRun(rng: Rng, length: number): ChamberPlan[] {
  const later: ChamberKind[] =
    length === DAILY_LENGTH
      ? rng.shuffle(DAILY_LATER).slice(0, 4)
      : ['hedges', ...rng.shuffle(LATER)];
  const kinds: ChamberKind[] = ['lawn', ...later];
  return kinds.slice(0, length).map((kind, i) => planChamber(kind, i + 1, rng));
}

// ---------------------------------------------------------------------------------- ground

class Plot {
  readonly ground: Ground[];
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.ground = new Array<Ground>(width * height).fill('stone');
  }
  at(x: number, y: number): Ground | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.ground[y * this.width + x]!;
  }
  set(x: number, y: number, kind: Ground) {
    if (this.at(x, y) !== null) this.ground[y * this.width + x] = kind;
  }
  copy(): Plot {
    const plot = new Plot(this.width, this.height);
    plot.ground.splice(0, this.ground.length, ...this.ground);
    return plot;
  }
}

/** Every open square reachable from every other by king's moves: no sealed-off corner. */
export function connected(garden: Pick<Garden, 'width' | 'height' | 'ground'>): boolean {
  const { width, height, ground } = garden;
  const open = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && ground[y * width + x] !== 'hedge';
  let start = -1;
  let total = 0;
  ground.forEach((g, i) => {
    if (g !== 'hedge') {
      total++;
      if (start < 0) start = i;
    }
  });
  if (start < 0) return false;
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % width;
    const y = Math.floor(i / width);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        // Squeezing diagonally between two hedges is not a way through.
        if (dx && dy && !open(nx, y) && !open(x, ny)) continue;
        if (!open(nx, ny)) continue;
        const j = ny * width + nx;
        if (!seen.has(j)) {
          seen.add(j);
          queue.push(j);
        }
      }
    }
  }
  return seen.size === total;
}

/** Tries a feature; keeps it only if the garden stays in one piece. */
function attempt(plot: Plot, place: (trial: Plot) => void): void {
  const trial = plot.copy();
  place(trial);
  if (connected(trial)) plot.ground.splice(0, plot.ground.length, ...trial.ground);
}

function hedgeRun(plot: Plot, rng: Rng, length: number) {
  attempt(plot, (trial) => {
    let x = rng.int(1, plot.width - 2);
    let y = rng.int(1, plot.height - 2);
    const horizontal = rng.chance(0.5);
    const turnAt = rng.chance(0.4) ? rng.int(1, length - 1) : -1;
    for (let k = 0; k < length; k++) {
      trial.set(x, y, 'hedge');
      const turned = turnAt >= 0 && k >= turnAt;
      const eastward = horizontal !== turned;
      if (eastward) x++;
      else y++;
    }
  });
}

function pool(plot: Plot, rng: Rng) {
  attempt(plot, (trial) => {
    const w = rng.int(2, 3);
    const h = 2;
    const x = rng.int(1, plot.width - w - 1);
    const y = rng.int(1, plot.height - h - 1);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) trial.set(x + dx, y + dy, 'pool');
  });
}

/** Hedge walls across the chamber with a few gaps: long lanes the snake can corner you in. */
function corridors(plot: Plot, rng: Rng) {
  for (let y = 3; y < plot.height - 2; y += 3) {
    attempt(plot, (trial) => {
      const gaps = new Set<number>();
      for (let g = 0; g < 3; g++) {
        const at = rng.int(1, plot.width - 3);
        gaps.add(at);
        if (rng.chance(0.5)) gaps.add(at + 1);
      }
      for (let x = 1; x < plot.width - 1; x++) if (!gaps.has(x)) trial.set(x, y, 'hedge');
    });
  }
}

function groundFor(plan: ChamberPlan, rng: Rng): Plot {
  const plot = new Plot(plan.width, plan.height);
  const extra = Math.floor(plan.depth / 3);
  switch (plan.kind) {
    case 'lawn':
      for (let k = 0; k < 2; k++) hedgeRun(plot, rng, 2);
      break;
    case 'hedges':
    case 'sleeping':
      for (let k = 0; k < 5 + extra; k++) hedgeRun(plot, rng, rng.int(2, 4));
      break;
    case 'twin':
      for (let k = 0; k < 4 + extra; k++) hedgeRun(plot, rng, rng.int(2, 3));
      break;
    case 'pools':
      for (let k = 0; k < 3; k++) pool(plot, rng);
      for (let k = 0; k < 2 + extra; k++) hedgeRun(plot, rng, rng.int(2, 3));
      break;
    case 'mirror':
      for (let k = 0; k < 2; k++) pool(plot, rng);
      for (let k = 0; k < 3 + extra; k++) hedgeRun(plot, rng, rng.int(2, 3));
      break;
    case 'corridors':
      corridors(plot, rng);
      break;
  }
  // Below the first chamber, lily pools creep into every kind of chamber (up to three), and the
  // snake swims through them two squares at a time.
  const deepPools =
    plan.depth === 1
      ? 0
      : Math.min(3, Math.ceil(plan.depth / 2) + 1) - (plan.kind === 'pools' ? 3 : 0);
  for (let k = 0; k < deepPools; k++) pool(plot, rng);
  return plot;
}

export interface ChamberLayout {
  readonly garden: Garden;
  /** Where you come in: on the west side, well away from the door. */
  readonly start: Cell;
}

function openStones(plot: Plot, columns: readonly [number, number]): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < plot.height; y++) {
    for (let x = columns[0]; x <= columns[1]; x++)
      if (plot.at(x, y) === 'stone') cells.push({ x, y });
  }
  return cells;
}

/** The chamber's ground, its door on the east side and your way in on the west. */
export function layOutChamber(plan: ChamberPlan, rng: Rng): ChamberLayout {
  const plot = groundFor(plan, rng);
  const third = Math.floor(plan.width / 3);
  const start = rng.pick(openStones(plot, [0, third - 1]));
  const doors = openStones(plot, [plan.width - third, plan.width - 1]).filter(
    (c) => reach(c, start) >= Math.floor(plan.width / 2),
  );
  const door = rng.pick(doors);
  return { garden: { width: plan.width, height: plan.height, ground: plot.ground, door }, start };
}
