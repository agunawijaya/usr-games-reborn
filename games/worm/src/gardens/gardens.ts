import type { PlannedDigit } from '../engine/game';
import type { Cell, Dir } from '../engine/geometry';

/**
 * The gardens: the campaign of twelve, each bringing in one idea, plus the tutorial box, the
 * Endless box and the attract garden behind the game menu. A map is drawn in the board's
 * characters (see `engine/board.ts`): `.` soil, `#` rock, `r` root, `~` mud, `> < ^ v` one-way
 * soil, letters for tunnel mouths.
 *
 * A garden is grown when the noodle reaches its goal length. Its three stars: grow it, reach the
 * best chain it asks for, and grow it without a dash. The goals and chain targets are set from
 * the house noodle's runs (`scripts/balance.ts`, recorded in NOTES.md).
 */

export interface GardenSpec {
  id: string;
  number: number;
  title: string;
  /** The idea this garden introduces, one short line for its card. */
  idea: string;
  map: readonly string[];
  /** Head first. */
  start: readonly Cell[];
  heading: Dir;
  /** The length that grows the garden; null for a bed played until the noodle bonks. */
  goal: number | null;
  /** The best chain for the second star. */
  chainTarget: number;
  /** Random digits come from this range; 1 to 9 when not given. */
  digits?: { min: number; max: number };
  /** A fixed run of digits (values only: they land at random). */
  plan?: readonly PlannedDigit[];
  countUpBonus?: boolean;
  /** Dark but for the noodle's own glow and the digits. */
  night?: boolean;
}

/** Builds a map from a size and a list of features, so rows never come out the wrong width. */
export function mapOf(
  width: number,
  height: number,
  features: Record<string, readonly [number, number][]>,
): string[] {
  const rows = Array.from({ length: height }, () => Array.from({ length: width }, () => '.'));
  for (const [ch, cells] of Object.entries(features)) {
    for (const [x, y] of cells) {
      if (x < 0 || y < 0 || x >= width || y >= height)
        throw new Error(`Feature ${ch} at ${x},${y} is outside ${width} × ${height}`);
      rows[y]![x] = ch;
    }
  }
  return rows.map((r) => r.join(''));
}

/** A straight noodle of `length` cells with its head at `head`, the body trailing away from `heading`. */
export function straightStart(head: Cell, heading: Dir, length: number): Cell[] {
  const back = {
    up: { x: 0, y: 1 },
    down: { x: 0, y: -1 },
    left: { x: 1, y: 0 },
    right: { x: -1, y: 0 },
  }[heading];
  return Array.from({ length }, (_, i) => ({ x: head.x + back.x * i, y: head.y + back.y * i }));
}

const START_LENGTH = 6;

export const GARDENS: readonly GardenSpec[] = [
  {
    id: 'sunny-patch',
    number: 1,
    title: 'Sunny Patch',
    idea: 'Rocks stay put. Steer round them.',
    map: [
      '................',
      '................',
      '...##.......#...',
      '...#........##..',
      '................',
      '................',
      '..........#.....',
      '.##.......##....',
      '................',
      '................',
    ],
    start: straightStart({ x: 7, y: 5 }, 'right', START_LENGTH),
    heading: 'right',
    goal: 38,
    chainTarget: 3,
    digits: { min: 2, max: 9 },
  },
  {
    id: 'tangle-roots',
    number: 2,
    title: 'Tangle Roots',
    idea: 'Chew through roots. They grow back, and a mouthful ends a chain.',
    map: [
      '...r.......r....',
      '...r.......rr...',
      '..rr........r...',
      '................',
      '................',
      '................',
      '.....r..........',
      '.....rr.......r.',
      '......r......rr.',
      '......r......r..',
    ],
    start: straightStart({ x: 8, y: 4 }, 'right', START_LENGTH),
    heading: 'right',
    goal: 36,
    chainTarget: 3,
  },
  {
    id: 'rabbit-hole',
    number: 3,
    title: 'Rabbit Hole',
    idea: 'In one tunnel mouth, out of the other.',
    map: [
      '..................',
      '..A...............',
      '..................',
      '......##..........',
      '......#...........',
      '..................',
      '..................',
      '...........##.....',
      '............#..A..',
      '..................',
    ],
    start: straightStart({ x: 9, y: 6 }, 'right', START_LENGTH),
    heading: 'right',
    goal: 40,
    chainTarget: 3,
  },
  {
    id: 'mud-pie',
    number: 4,
    title: 'Mud Pie',
    idea: 'Mud is slow going, and it stops a dash.',
    map: [
      '..................',
      '..~~..............',
      '..~~~.......#.....',
      '...~........##....',
      '..................',
      '..................',
      '..........~~~.....',
      '.....#....~~~~....',
      '....##.....~~.....',
      '..................',
    ],
    start: straightStart({ x: 8, y: 5 }, 'right', START_LENGTH),
    heading: 'right',
    goal: 36,
    chainTarget: 3,
  },
  {
    id: 'counting-row',
    number: 5,
    title: 'Counting Row',
    idea: 'One to nine, in order, for a bonus.',
    map: [
      '....................',
      '....................',
      '.....#........#.....',
      '.....#........#.....',
      '....................',
      '....................',
      '.....#........#.....',
      '.....#........#.....',
      '....................',
      '....................',
    ],
    start: straightStart({ x: 10, y: 5 }, 'right', START_LENGTH),
    heading: 'right',
    // Exactly the nine digits: 6 + 1 + 2 + … + 9.
    goal: START_LENGTH + 45,
    chainTarget: 3,
    plan: Array.from({ length: 9 }, (_, i) => ({ value: i + 1 })),
    countUpBonus: true,
  },
  {
    id: 'root-cellar',
    number: 6,
    title: 'The Root Cellar',
    idea: 'Rocks, roots, mud and a tunnel, all at once.',
    map: mapOf(22, 12, {
      '#': [
        [8, 4],
        [9, 4],
        [8, 5],
        [18, 8],
        [19, 8],
        [18, 9],
        [2, 9],
        [3, 9],
      ],
      r: [
        [15, 0],
        [15, 1],
        [16, 1],
        [16, 2],
        [4, 0],
        [4, 1],
        [5, 1],
      ],
      '~': [
        [11, 7],
        [12, 7],
        [13, 7],
        [12, 8],
        [13, 8],
      ],
      A: [
        [2, 4],
        [19, 3],
      ],
    }),
    start: straightStart({ x: 9, y: 7 }, 'right', 7),
    heading: 'right',
    goal: 54,
    chainTarget: 3,
    digits: { min: 2, max: 9 },
  },
  {
    id: 'night-bed',
    number: 7,
    title: 'Night Bed',
    idea: 'Lights out: only your own glow, and the numbers.',
    map: [
      '....................',
      '..#.......#.........',
      '..#.......#.....#...',
      '................#...',
      '.....#..............',
      '.....#.....###......',
      '....................',
      '.#.............#....',
      '.#....##.......#....',
      '..............##....',
      '....................',
    ],
    start: straightStart({ x: 9, y: 6 }, 'right', START_LENGTH),
    heading: 'right',
    goal: 52,
    chainTarget: 3,
    night: true,
  },
  {
    id: 'big-bites',
    number: 8,
    title: 'Big Bites',
    idea: 'Only fives to nines: you grow fast.',
    map: [
      '....................',
      '....................',
      '...###........###...',
      '....................',
      '....................',
      '....................',
      '....................',
      '...###........###...',
      '....................',
      '....................',
      '....................',
    ],
    start: straightStart({ x: 9, y: 5 }, 'right', START_LENGTH),
    heading: 'right',
    goal: 56,
    chainTarget: 3,
    digits: { min: 5, max: 9 },
  },
  {
    id: 'downstream',
    number: 9,
    title: 'Downstream',
    idea: 'One-way soil: ride it the way it flows, never against it.',
    map: [
      '....................',
      '....................',
      '.................v..',
      '.....>>>>>>......v..',
      '.................v..',
      '.................v..',
      '....................',
      '.......<<<<<<.......',
      '..^.................',
      '..^.................',
      '....................',
    ],
    start: straightStart({ x: 8, y: 5 }, 'right', START_LENGTH),
    heading: 'right',
    goal: 48,
    chainTarget: 3,
  },
  {
    id: 'rock-garden',
    number: 10,
    title: 'Rock Garden',
    idea: 'A garden of stones, and the gaps between them.',
    map: [
      '......................',
      '.##....#.....##.......',
      '.#.....#..............',
      '..........##.......#..',
      '....#..............#..',
      '....##...........#....',
      '......................',
      '..#.......##.....#....',
      '..#........#..........',
      '.......#..........#...',
      '.......#.....##...#...',
      '......................',
    ],
    start: straightStart({ x: 10, y: 6 }, 'right', START_LENGTH),
    heading: 'right',
    goal: 50,
    chainTarget: 3,
    digits: { min: 3, max: 9 },
  },
  {
    id: 'two-burrows',
    number: 11,
    title: 'Two Burrows',
    idea: 'Two pairs of tunnels, and roots in between.',
    map: [
      '..........r...........',
      '..A.......r.......B...',
      '..........rr..........',
      '......................',
      '.....#..........#.....',
      '.....##........##.....',
      '......................',
      '......................',
      '...........r..........',
      '..B........r......A...',
      '..........rr..........',
      '......................',
    ],
    start: straightStart({ x: 8, y: 6 }, 'right', START_LENGTH),
    heading: 'right',
    goal: 52,
    chainTarget: 3,
  },
  {
    id: 'deep-end',
    number: 12,
    title: 'The Deep End',
    idea: 'Everything the garden has, in its biggest bed.',
    map: [
      '.....r..........r.......',
      '.A...r..........r.......',
      '....rr.....##...rr...B..',
      '...........#............',
      '..~~....................',
      '..~~~.....>>>>>>.....#..',
      '...~.................##.',
      '........................',
      '..##........~~~.........',
      '...#.......~~~~.....v...',
      '.......B............v...',
      '..............##....v.A.',
      '...............#........',
    ],
    start: straightStart({ x: 9, y: 7 }, 'right', START_LENGTH),
    heading: 'right',
    goal: 62,
    chainTarget: 3,
  },
];

export const ROOT_CELLAR = GARDENS[5]!;

/** The tutorial's little box. Its digits come one lesson at a time (see `modes/tutorial.ts`). */
export const TUTORIAL_MAP: readonly string[] = mapOf(14, 7, {});

/** The Endless box: the 1980 rules in an open bed, sized so the noodle stays readable. */
export const ENDLESS_SIZE = { width: 30, height: 15 } as const;

/** The garden behind the game menu, where the house noodle plays. */
export const ATTRACT: GardenSpec = {
  id: 'attract',
  number: 0,
  title: 'Sunny Patch',
  idea: '',
  map: mapOf(16, 9, {
    '#': [
      [2, 1],
      [3, 1],
      [2, 2],
      [13, 7],
      [14, 7],
    ],
    r: [
      [11, 0],
      [11, 1],
      [12, 1],
    ],
    '~': [
      [6, 7],
      [7, 7],
      [7, 8],
    ],
  }),
  start: straightStart({ x: 7, y: 4 }, 'right', 6),
  heading: 'right',
  goal: null,
  chainTarget: 0,
};
