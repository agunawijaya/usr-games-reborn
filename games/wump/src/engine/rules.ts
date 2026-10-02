import { DEFAULT_ROOMS, DEFAULT_TUNNELS } from './cave';

/**
 * Two rule sets share one engine. **Classic** plays as the BSD program does, its crooked parts
 * included; **Standard** keeps every rule but plays each one as its author meant it. The
 * differences are listed field by field below and in docs/CHANGES-FROM-ORIGINAL.md.
 */
export type RuleSet = 'standard' | 'classic';

export interface CaveRecipe {
  rooms: number;
  tunnelsPerRoom: number;
  bats: number;
  pits: number;
  darts: number;
  /** The original's `-h`: more bats and pits, and a start out of smelling range. */
  hard: boolean;
  /** Gregory Yob's own fixed cave instead of a dug one. */
  dodecahedron?: boolean;
  /** Standard only: extra tunnels turned into magic ones. */
  magicTunnels?: number;
  /** A wall bump wakes the wumpus with one chance in this many (the original: 6). */
  wakeOneIn?: number;
  /** Yob's wish: the wumpus steps round pits, and bats can carry it one room. */
  yobsWish?: boolean;
  /** Standard only: a miss wakes the wumpus with a growing chance out of this (the original: 12, or 9 when hard). */
  temperOutOf?: number;
}

export const CLASSIC_RECIPE: CaveRecipe = {
  rooms: DEFAULT_ROOMS,
  tunnelsPerRoom: DEFAULT_TUNNELS,
  bats: 3,
  pits: 3,
  darts: 5,
  hard: false,
};

export const WAKE_ONE_IN = 6;
/** A pit lets you go two times in twelve. */
export const LEDGE_CHANCE = { saved: 2, of: 12 } as const;
/** A dart flies through at most five rooms. */
export const MAX_DART_ROOMS = 5;
/** After its third room the string may break; after its fourth the dart may waver and drop. */
export const STRING_BREAKS = { afterRoom: 3, outOfTen: 2 } as const;
export const DART_WAVERS = { afterRoom: 4, outOfTen: 6 } as const;
/** The wumpus's temper starts here and grows by two with every miss. */
export const TEMPER_START = 2;
