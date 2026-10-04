import type { Rng } from '@usr-games/kit';
import {
  CORAL,
  countKind,
  createGame,
  type Current,
  type Game,
  SEAWEED,
  setCell,
} from '../engine/game';

/**
 * The twelve Dives: tanks with one idea each, in order. A dive is won by its goal — burst so many
 * rows, or clear every piece of coral — and lost if the tank fills first. Stars: the first for
 * the goal; the second and third for a score (row dives) or for using few sinkers (coral dives),
 * set from the house diver's play so that most players earn one and a good dive earns three.
 *
 * Tank pictures are written top to bottom for the rows at the bottom of the tank: `.` water,
 * `c` coral, `s` seaweed. Touching cells of one kind form one clump. Every column is filled from
 * the floor up with no gaps under coral or seaweed, and no row starts full, so every floor can be
 * cleared (a test holds every dive to that).
 */

export const TANK_WIDTH = 11;
export const TANK_HEIGHT = 18;

export type DiveGoal = { kind: 'rows'; rows: number } | { kind: 'coral' };

export interface DiveSpec {
  id: string;
  number: number;
  title: string;
  /** One line on the dive's idea, shown on its card. */
  idea: string;
  level: number;
  goal: DiveGoal;
  /** The bottom rows of the tank, top to bottom. */
  floor?: readonly string[];
  currents?: readonly Current[];
  /** The tank is dark but for the falling sinker's own glow. */
  dark?: boolean;
  /** Second and third stars: a score to reach (rows) or a most sinkers to use (coral). */
  stars: readonly [number, number];
}

export const DIVES: readonly DiveSpec[] = [
  {
    id: 'shallows',
    number: 1,
    title: 'Shallows',
    idea: 'Slide, turn and plunge in clear water. Burst eight rows.',
    level: 1,
    goal: { kind: 'rows', rows: 8 },
    stars: [1240, 1350],
  },
  {
    id: 'coral-garden',
    number: 2,
    title: 'Coral Garden',
    idea: 'Coral grows on the floor. Fill the rows round it to burst it free.',
    level: 2,
    goal: { kind: 'coral' },
    floor: ['c....c....c', 'cc..ccc..cc', 'ccc.ccc.ccc'],
    stars: [11, 7],
  },
  {
    id: 'the-drift',
    number: 3,
    title: 'The Drift',
    idea: 'A current runs across the middle and pushes every sinker one cell right.',
    level: 2,
    goal: { kind: 'rows', rows: 12 },
    currents: [{ row: 8, dir: 1 }],
    stars: [2300, 2560],
  },
  {
    id: 'kelp-forest',
    number: 4,
    title: 'Kelp Forest',
    idea: 'Seaweed stands along the walls. Burst its rows to clear it away.',
    level: 2,
    goal: { kind: 'rows', rows: 12 },
    floor: ['s.........s', 'ss........s', 'ss.......ss', 'ss.......ss', 'sss.....sss'],
    stars: [3160, 3390],
  },
  {
    id: 'deep-plunge',
    number: 5,
    title: 'Deep Plunge',
    idea: 'Plunges in a row build the depth combo. Let a burst cash it in.',
    level: 3,
    goal: { kind: 'rows', rows: 15 },
    stars: [6500, 6920],
  },
  {
    id: 'crosscurrents',
    number: 6,
    title: 'Crosscurrents',
    idea: 'Two currents, two ways: right near the top, left lower down.',
    level: 3,
    goal: { kind: 'rows', rows: 15 },
    currents: [
      { row: 5, dir: 1 },
      { row: 11, dir: -1 },
    ],
    stars: [3550, 3880],
  },
  {
    id: 'night-dive',
    number: 7,
    title: 'Night Dive',
    idea: 'No light in the tank but your sinker’s own glow. Watch the sonar.',
    level: 3,
    goal: { kind: 'rows', rows: 12 },
    dark: true,
    stars: [5310, 5680],
  },
  {
    id: 'reef-wall',
    number: 8,
    title: 'Reef Wall',
    idea: 'A wall of coral six rows deep. Work it down row by row.',
    level: 3,
    goal: { kind: 'coral' },
    floor: [
      'c..c...c..c',
      'cc.c..cc..c',
      'cc.cc.cc.cc',
      'ccccc.cc.cc',
      'ccccc.ccccc',
      'ccccc.ccccc',
    ],
    stars: [26, 13],
  },
  {
    id: 'riptide',
    number: 9,
    title: 'Riptide',
    idea: 'Three currents. A plunge zigzags; the sonar shows where it ends.',
    level: 4,
    goal: { kind: 'rows', rows: 15 },
    currents: [
      { row: 4, dir: 1 },
      { row: 8, dir: 1 },
      { row: 12, dir: -1 },
    ],
    stars: [4210, 4720],
  },
  {
    id: 'fast-water',
    number: 10,
    title: 'Fast Water',
    idea: 'Level eight from the start. Sinkers do not wait long.',
    level: 8,
    goal: { kind: 'rows', rows: 12 },
    stars: [14180, 15230],
  },
  {
    id: 'sunken-garden',
    number: 11,
    title: 'Sunken Garden',
    idea: 'Coral among the seaweed, and a current over both.',
    level: 4,
    goal: { kind: 'coral' },
    floor: ['s.........s', 'ss..c.c..ss', 'ssc.c.c.css', 'ssccc.cccss'],
    currents: [{ row: 7, dir: -1 }],
    stars: [9, 5],
  },
  {
    id: 'the-trench',
    number: 12,
    title: 'The Trench',
    idea: 'Dark, deep and moving. Clear the coral at the bottom of it all.',
    level: 5,
    goal: { kind: 'coral' },
    floor: ['c.........c', 'cc..c.c..cc', 'cc.cc.cc.cc', 'ccccc.ccccc'],
    currents: [
      { row: 6, dir: 1 },
      { row: 10, dir: -1 },
    ],
    dark: true,
    stars: [12, 8],
  },
];

export function diveById(id: string): DiveSpec | undefined {
  return DIVES.find((d) => d.id === id);
}

/** The dive's tank, set up and ready for its first sinker. */
export function diveGame(dive: DiveSpec, random: Rng): Game {
  const game = createGame({
    rules: 'standard',
    width: TANK_WIDTH,
    height: TANK_HEIGHT,
    level: dive.level,
    random,
    currents: dive.currents,
  });
  setFloor(game, dive.floor ?? []);
  return game;
}

/** Writes a floor picture into the bottom rows, each touching clump its own group. */
export function setFloor(game: Game, floor: readonly string[]): void {
  const top = game.height - floor.length;
  const kindAt = (x: number, y: number): number | null => {
    const ch = floor[y - top]?.[x];
    return ch === 'c' ? CORAL : ch === 's' ? SEAWEED : null;
  };
  const group = new Map<string, number>();
  let next = 10_000;
  for (let y = top; y < game.height; y++)
    for (let x = 0; x < game.width; x++) {
      const kind = kindAt(x, y);
      if (kind === null || group.has(`${x},${y}`)) continue;
      // Flood the clump so its cells share a group.
      const id = next++;
      const stack = [{ x, y }];
      group.set(`${x},${y}`, id);
      while (stack.length > 0) {
        const at = stack.pop()!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const n = { x: at.x + dx, y: at.y + dy };
          if (n.y < top || n.y >= game.height || n.x < 0 || n.x >= game.width) continue;
          if (kindAt(n.x, n.y) !== kind || group.has(`${n.x},${n.y}`)) continue;
          group.set(`${n.x},${n.y}`, id);
          stack.push(n);
        }
      }
    }
  for (const [key, id] of group) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    setCell(game, x, y, { group: id, kind: kindAt(x, y)!, depth: y });
  }
}

export type DiveState = 'playing' | 'won' | 'lost';

/** Where a dive stands now. */
export function diveState(dive: DiveSpec, game: Game): DiveState {
  if (dive.goal.kind === 'rows' ? game.rowsCleared >= dive.goal.rows : countKind(game, CORAL) === 0)
    return 'won';
  return game.over ? 'lost' : 'playing';
}

/** How far along the goal is, for the bar: done and of how many. */
export function diveProgress(dive: DiveSpec, game: Game, coralAtStart: number): [number, number] {
  if (dive.goal.kind === 'rows')
    return [Math.min(game.rowsCleared, dive.goal.rows), dive.goal.rows];
  return [coralAtStart - countKind(game, CORAL), coralAtStart];
}

/** Stars earned by a finished dive. */
export function diveStars(dive: DiveSpec, game: Game): number {
  if (diveState(dive, game) !== 'won') return 0;
  const [two, three] = dive.stars;
  if (dive.goal.kind === 'rows') return game.points >= three ? 3 : game.points >= two ? 2 : 1;
  return game.landings <= three ? 3 : game.landings <= two ? 2 : 1;
}

/** The line under each star on the results card and the dive's tile. */
export function starLabels(dive: DiveSpec): [string, string, string] {
  const goal = dive.goal.kind === 'rows' ? `Burst ${dive.goal.rows} rows` : 'Clear all the coral';
  const [two, three] = dive.stars;
  if (dive.goal.kind === 'rows')
    return [goal, `Score ${two.toLocaleString('en-GB')}`, `Score ${three.toLocaleString('en-GB')}`];
  return [goal, `In ${two} sinkers or fewer`, `In ${three} sinkers or fewer`];
}
