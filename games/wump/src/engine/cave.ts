import { anyRoom, type Random, roll } from './random';

/**
 * The cave: numbered rooms and the tunnels leading out of each. Tunnels are one-way records, as
 * in the original: room 4 may lead to room 9 while room 9 has no way back. A tunnel that leads to
 * `size + 1` is a magic tunnel, the original's never-used marker for "somewhere else entirely".
 *
 * The digging algorithm is the BSD game's (wump.c, Dave Taylor): a ring through every room, made
 * with a hop that shares no factor with the room count, then random extra tunnels, each answered
 * by a tunnel back only half of the time.
 */

export const MIN_ROOMS = 10;
export const MAX_ROOMS = 250;
export const DEFAULT_ROOMS = 20;
export const MIN_TUNNELS = 2;
export const MAX_TUNNELS = 25;
export const DEFAULT_TUNNELS = 3;

export interface Cave {
  /** Rooms are numbered 1…size, as the original printed them. */
  size: number;
  tunnelsPerRoom: number;
  /** `tunnels[room]`: where each tunnel leads, in ascending order. Index 0 is unused. */
  tunnels: readonly (readonly number[])[];
}

export type CaveProblem = 'too-few-rooms' | 'too-many-rooms' | 'too-few-tunnels' | 'collapses';

/** The original's limits on a custom cave, in its own order of checking. */
export function caveProblem(rooms: number, tunnels: number): CaveProblem | null {
  if (rooms < MIN_ROOMS) return 'too-few-rooms';
  if (rooms > MAX_ROOMS) return 'too-many-rooms';
  if (tunnels < MIN_TUNNELS) return 'too-few-tunnels';
  if (tunnels > MAX_TUNNELS || tunnels > rooms - Math.floor(rooms / 4)) return 'collapses';
  return null;
}

export function magicRoom(cave: Pick<Cave, 'size'>): number {
  return cave.size + 1;
}

export function isMagic(cave: Pick<Cave, 'size'>, to: number): boolean {
  return to === cave.size + 1;
}

export function tunnelsFrom(cave: Cave, room: number): readonly number[] {
  return cave.tunnels[room] ?? [];
}

export function hasTunnel(cave: Cave, from: number, to: number): boolean {
  return tunnelsFrom(cave, from).includes(to);
}

function gcd(a: number, b: number): number {
  const r = a % b;
  return r === 0 ? b : gcd(b, r);
}

export interface DigOptions {
  size: number;
  tunnelsPerRoom: number;
  /** Classic rules let a random tunnel lead back into its own room, as the original could. */
  allowLoops: boolean;
  /** Standard rules can turn this many extra tunnels into magic ones. */
  magicTunnels?: number;
}

const OPEN = -1;

export function digCave(options: DigOptions, random: Random): Cave {
  const { size, tunnelsPerRoom: links } = options;
  const slots: number[][] = Array.from({ length: size + 1 }, () =>
    new Array<number>(links).fill(OPEN),
  );

  // The ring: room i leads forward by delta + 1, and every room hears back from its predecessor.
  let delta: number;
  do delta = roll(random, size - 1) + 1;
  while (gcd(size, delta + 1) !== 1);
  for (let room = 1; room <= size; room++) {
    const next = ((room + delta) % size) + 1;
    slots[room]![0] = next;
    slots[next]![1] = room;
  }

  for (let room = 1; room <= size; room++) {
    const own = slots[room]!;
    for (let j = 2; j < links; j++) {
      if (own[j] !== OPEN) continue;
      let to: number;
      do to = anyRoom(random, size);
      while (own.slice(0, j).includes(to) || (!options.allowLoops && to === room));
      own[j] = to;
      // Half of the extra tunnels get an answering tunnel back, if the far room has a free slot.
      if (roll(random, 2) === 1) continue;
      answer(slots[to]!, room);
    }
  }

  if (options.magicTunnels) enchant(slots, size, options.magicTunnels, random);
  return {
    size,
    tunnelsPerRoom: links,
    tunnels: slots.map((own) => [...own].sort((a, b) => a - b)),
  };
}

function answer(far: number[], room: number): void {
  for (let k = 0; k < far.length; k++) {
    if (far[k] === room) return;
    if (far[k] === OPEN) {
      far[k] = room;
      return;
    }
  }
}

/**
 * Turns extra tunnels (never the ring, which keeps every room reachable) into magic ones, each
 * in a different room. A tunnel answered from the far side leaves that answer one-way.
 */
function enchant(slots: number[][], size: number, count: number, random: Random): void {
  const chosen = new Set<number>();
  for (let tries = 0; chosen.size < count && tries < size * 20; tries++) {
    const room = anyRoom(random, size);
    const own = slots[room]!;
    if (chosen.has(room) || own.length < 3) continue;
    const slot = 2 + roll(random, own.length - 2);
    own[slot] = size + 1;
    chosen.add(room);
  }
}

/**
 * The regular dodecahedron, Gregory Yob's 1973 cave: twenty rooms, three two-way tunnels each.
 * Numbered our own way, ring by ring: the outer five, the middle ten, the inner five.
 */
export function dodecahedron(): Cave {
  const edges: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const outer = 1 + i;
    const middleA = 6 + 2 * i;
    const middleB = 7 + 2 * i;
    const inner = 16 + i;
    edges.push([outer, 1 + ((i + 1) % 5)]);
    edges.push([outer, middleA]);
    edges.push([middleA, middleB]);
    edges.push([middleB, 6 + ((2 * i + 2) % 10)]);
    edges.push([middleB, inner]);
    edges.push([inner, 16 + ((i + 1) % 5)]);
  }
  const tunnels: number[][] = Array.from({ length: 21 }, () => []);
  for (const [a, b] of edges) {
    tunnels[a]!.push(b);
    tunnels[b]!.push(a);
  }
  return { size: 20, tunnelsPerRoom: 3, tunnels: tunnels.map((t) => t.sort((a, b) => a - b)) };
}

/** Rooms reachable from `start` along tunnels (magic tunnels reach everywhere). */
export function reachable(cave: Cave, start: number): Set<number> {
  const seen = new Set<number>([start]);
  const queue = [start];
  const visit = (room: number) => {
    if (seen.has(room)) return;
    seen.add(room);
    queue.push(room);
  };
  while (queue.length > 0) {
    const room = queue.shift()!;
    for (const to of tunnelsFrom(cave, room)) {
      if (!isMagic(cave, to)) visit(to);
      else for (let anywhere = 1; anywhere <= cave.size; anywhere++) visit(anywhere);
    }
  }
  return seen;
}

/** Tunnels counted both ways, for drawing and for distances on the map. */
export function neighbours(cave: Cave): Set<number>[] {
  const around: Set<number>[] = Array.from({ length: cave.size + 1 }, () => new Set<number>());
  for (let room = 1; room <= cave.size; room++) {
    for (const to of tunnelsFrom(cave, room)) {
      if (isMagic(cave, to) || to === room) continue;
      around[room]!.add(to);
      around[to]!.add(room);
    }
  }
  return around;
}

/** Tunnel steps from `start` to every room, following tunnels only the way they run. */
export function stepsFrom(cave: Cave, start: number): number[] {
  const steps = new Array<number>(cave.size + 1).fill(Infinity);
  steps[start] = 0;
  const queue = [start];
  while (queue.length > 0) {
    const room = queue.shift()!;
    for (const to of tunnelsFrom(cave, room)) {
      if (isMagic(cave, to) || steps[to]! <= steps[room]! + 1) continue;
      steps[to] = steps[room]! + 1;
      queue.push(to);
    }
  }
  return steps;
}
