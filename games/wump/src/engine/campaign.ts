import type { Cave } from './cave';
import type { Expedition, Preset } from './expedition';
import { CLASSIC_RECIPE, type CaveRecipe, type RuleSet } from './rules';

/**
 * The expeditions: a tutorial, then twelve caves, each adding one idea. Names and blurbs are ours;
 * the recipes are tuned so the Scout bot's results land where docs/NOTES.md says they should.
 */

export type ThirdStar = 'no-bat-rides' | 'darts-to-spare';

export interface CaveDefinition {
  id: string;
  /** 0 for the tutorial, then 1–12. */
  number: number;
  name: string;
  /** One line on what this cave adds. */
  idea: string;
  recipe: CaveRecipe;
  rules: RuleSet;
  /** Hush it in this many moves or fewer for the second star. */
  moveTarget: number;
  thirdStar: ThirdStar;
  /** The map does not draw itself: the notebook is the only map. */
  darkness?: boolean;
  /** A cave laid out by hand instead of dug. */
  preset?: 'prism';
}

const BSD: CaveRecipe = { ...CLASSIC_RECIPE };

export const TUTORIAL: CaveDefinition = {
  id: 'tutorial',
  number: 0,
  name: 'First steps',
  idea: 'A draft, a flutter, a whiff, and one well-aimed dart.',
  recipe: { ...BSD, rooms: 10, bats: 1, pits: 1, darts: 3 },
  rules: 'standard',
  moveTarget: 6,
  thirdStar: 'darts-to-spare',
  preset: 'prism',
};

export const CAMPAIGN: readonly CaveDefinition[] = [
  {
    id: 'dodecahedron',
    number: 1,
    name: 'The 1973 cave',
    idea: 'Twenty rooms on the faces of a dodecahedron, every tunnel two-way, as in the first Wumpus.',
    recipe: { ...BSD, dodecahedron: true, bats: 2, pits: 2 },
    rules: 'standard',
    moveTarget: 14,
    thirdStar: 'darts-to-spare',
  },
  {
    id: 'crooked',
    number: 2,
    name: 'Crooked tunnels',
    idea: 'A cave dug the BSD way: some tunnels only run one way.',
    recipe: BSD,
    rules: 'standard',
    moveTarget: 16,
    thirdStar: 'no-bat-rides',
  },
  {
    id: 'bat-roost',
    number: 3,
    name: 'Bat roost',
    idea: 'More bats than you would like. Flutters everywhere, and free rides to anywhere.',
    recipe: { ...BSD, bats: 5, pits: 2 },
    rules: 'standard',
    moveTarget: 16,
    thirdStar: 'no-bat-rides',
  },
  {
    id: 'pitfalls',
    number: 4,
    name: 'Pitfalls',
    idea: 'More pits than you would like. Every draft matters.',
    recipe: { ...BSD, bats: 2, pits: 5 },
    rules: 'standard',
    moveTarget: 16,
    thirdStar: 'darts-to-spare',
  },
  {
    id: 'shimmer',
    number: 5,
    name: 'Shimmering tunnels',
    idea: 'The magic tunnels the original never dug: step in, come out anywhere.',
    recipe: { ...BSD, rooms: 25, magicTunnels: 4 },
    rules: 'standard',
    moveTarget: 18,
    thirdStar: 'no-bat-rides',
  },
  {
    id: 'four-ways',
    number: 6,
    name: 'Four ways out',
    idea: 'Thirty rooms with four tunnels each: more choices, more to rule out.',
    recipe: { ...BSD, rooms: 30, tunnelsPerRoom: 4, bats: 4, pits: 4 },
    rules: 'standard',
    moveTarget: 20,
    thirdStar: 'darts-to-spare',
  },
  {
    id: 'hard',
    number: 7,
    name: 'The hard cave',
    idea: 'The original’s hard level: bats and pits by the handful, and a start out of smelling range.',
    recipe: { ...BSD, hard: true, bats: 0, pits: 0, darts: 6 },
    rules: 'standard',
    moveTarget: 18,
    thirdStar: 'no-bat-rides',
  },
  {
    id: 'restless',
    number: 8,
    name: 'A restless wumpus',
    idea: 'A light sleeper: bumps and misses wake it far more easily.',
    recipe: { ...BSD, wakeOneIn: 3, temperOutOf: 6 },
    rules: 'standard',
    moveTarget: 16,
    thirdStar: 'darts-to-spare',
  },
  {
    id: 'yobs-wish',
    number: 9,
    name: 'Yob’s wish',
    idea: 'Named for Gregory Yob. This wumpus steps round pits, and bats can carry it a room, maybe into yours.',
    recipe: { ...BSD, yobsWish: true },
    rules: 'standard',
    moveTarget: 18,
    thirdStar: 'no-bat-rides',
  },
  {
    id: 'labyrinth',
    number: 10,
    name: 'The labyrinth',
    idea: 'Sixty rooms. Keep good notes.',
    recipe: { ...BSD, rooms: 60, bats: 7, pits: 7, darts: 6 },
    rules: 'standard',
    moveTarget: 40,
    thirdStar: 'darts-to-spare',
  },
  {
    id: 'darkness',
    number: 11,
    name: 'Lights out',
    idea: 'The map does not draw itself. Your notebook is the only map.',
    recipe: { ...BSD, rooms: 30, bats: 4, pits: 4 },
    rules: 'standard',
    moveTarget: 24,
    thirdStar: 'no-bat-rides',
    darkness: true,
  },
  {
    id: 'deep',
    number: 12,
    name: 'The deep cave',
    idea: 'A hundred and twenty rooms, and the wumpus somewhere at the bottom of them.',
    recipe: { ...BSD, rooms: 120, bats: 12, pits: 12, darts: 8 },
    rules: 'standard',
    moveTarget: 70,
    thirdStar: 'darts-to-spare',
  },
];

/**
 * The tutorial's cave: a pentagonal prism, two rings of five rooms joined by spokes, every tunnel
 * two-way. Starting in room 1, the explorer meets a draft in room 2, a flutter in room 6 and a
 * strong whiff in room 7, and the notes leave room 8 as the only place the wumpus can be.
 */
export function prismCave(): Cave {
  const tunnels: number[][] = [[]];
  for (let i = 1; i <= 5; i++) tunnels[i] = [(i % 5) + 1, ((i + 3) % 5) + 1, i + 5];
  for (let i = 6; i <= 10; i++) tunnels[i] = [((i - 5) % 5) + 6, ((i - 5 + 3) % 5) + 6, i - 5];
  return { size: 10, tunnelsPerRoom: 3, tunnels: tunnels.map((t) => [...t].sort((a, b) => a - b)) };
}

export function presetFor(cave: CaveDefinition): Preset | undefined {
  if (cave.preset !== 'prism') return undefined;
  return { cave: prismCave(), pits: [3], bats: [10], wumpus: 8, start: 1 };
}

export interface Stars {
  hushed: boolean;
  quick: boolean;
  third: boolean;
}

/** The three stars of a finished expedition. */
export function starsFor(cave: CaveDefinition, expedition: Expedition): Stars {
  const hushed = expedition.ending?.kind === 'hushed';
  return {
    hushed,
    quick: hushed && expedition.moves <= cave.moveTarget,
    third:
      hushed &&
      (cave.thirdStar === 'no-bat-rides'
        ? expedition.batRides === 0
        : expedition.darts >= Math.ceil(expedition.recipe.darts / 2)),
  };
}

/**
 * The score: a hushed wumpus is worth 100, each dart left 15, each room never entered 2; each move
 * costs 2 and each bat ride 5. A lost expedition scores nothing. Records keep the best.
 */
export function scoreFor(expedition: Expedition): number {
  if (expedition.ending?.kind !== 'hushed') return 0;
  const unexplored = expedition.cave.size - expedition.visited.length;
  const score =
    100 + expedition.darts * 15 + unexplored * 2 - expedition.moves * 2 - expedition.batRides * 5;
  return Math.max(10, score);
}
