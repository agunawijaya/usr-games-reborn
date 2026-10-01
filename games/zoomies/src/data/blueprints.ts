import type { Blueprint } from '../engine/generate';
import type { VacuumKind } from '../engine/types';

/**
 * The house, room by room. Each room brings one new idea; its blueprint says what lives there,
 * and `scripts/search-rooms.ts` found a seed whose layout the solver can clear within the par
 * range. The found layouts are stored in `house-layouts.ts`.
 */

export type RoomTheme =
  | 'hallway'
  | 'kitchen'
  | 'living'
  | 'laundry'
  | 'study'
  | 'bathroom'
  | 'bedroom'
  | 'kids'
  | 'garage'
  | 'conservatory'
  | 'landing'
  | 'night';

export interface HouseRoom {
  readonly id: RoomTheme;
  readonly name: string;
  /** The one new thing this room teaches, in a line. */
  readonly idea: string;
  /** Shown on the room's intro card. */
  readonly tip: string;
  /** The vacuum kind or object the intro card draws. */
  readonly star: VacuumKind | 'sock' | 'cable' | 'dock' | 'loaf' | 'tangle';
  readonly blueprint: Blueprint;
  readonly searchSeed: string;
}

export const HOUSE: readonly HouseRoom[] = [
  {
    id: 'hallway',
    name: 'The hallway',
    idea: 'Every vacuum rolls one square toward you each turn.',
    tip: 'Stand where two of them will arrive at the same moment. Bonk!',
    star: 'basic',
    blueprint: {
      width: 11,
      height: 6,
      furniture: [{ kind: 'plant', x: 10, y: 0, w: 1, h: 1 }],
      vacuums: { basic: 3 },
      par: [4, 7],
      ease: [0.6, 0.95],
    },
    searchSeed: 'house/hallway',
  },
  {
    id: 'kitchen',
    name: 'The kitchen',
    idea: 'A tangle is a trap: anything that rolls into it is stuck too.',
    tip: 'Keep a tangle between you and the next vacuum.',
    star: 'tangle',
    blueprint: {
      width: 12,
      height: 8,
      furniture: [{ kind: 'counter', x: 0, y: 0, w: 4, h: 1 }],
      vacuums: { basic: 5 },
      par: [6, 10],
      ease: [0.5, 0.85],
    },
    searchSeed: 'house/kitchen',
  },
  {
    id: 'living',
    name: 'The living room',
    idea: 'Loaf, and let them come to you.',
    tip: 'Every vacuum that tangles while you loaf earns a safe zoom.',
    star: 'loaf',
    blueprint: {
      width: 14,
      height: 9,
      furniture: [
        { kind: 'sofa', x: 5, y: 8, w: 4, h: 1 },
        { kind: 'armchair', x: 0, y: 0, w: 2, h: 2 },
      ],
      vacuums: { basic: 7 },
      par: [8, 14],
      ease: [0.45, 0.8],
    },
    searchSeed: 'house/living',
  },
  {
    id: 'laundry',
    name: 'The laundry',
    idea: 'Socks on the floor. Vacuums choke on them.',
    tip: 'A sock works just like a tangle. Lead them over it.',
    star: 'sock',
    blueprint: {
      width: 12,
      height: 8,
      furniture: [{ kind: 'washer', x: 10, y: 0, w: 2, h: 2 }],
      vacuums: { basic: 5 },
      clutter: { sock: 4 },
      par: [6, 11],
      ease: [0.4, 0.75],
    },
    searchSeed: 'house/laundry',
  },
  {
    id: 'study',
    name: 'The study',
    idea: 'Furniture is in the way. Vacuums slide along it.',
    tip: 'A vacuum that cannot go straight at you goes around the long way.',
    star: 'cable',
    blueprint: {
      width: 14,
      height: 9,
      furniture: [
        { kind: 'desk', x: 5, y: 3, w: 3, h: 2 },
        { kind: 'shelf', x: 0, y: 0, w: 4, h: 1 },
        { kind: 'armchair', x: 12, y: 7, w: 2, h: 2 },
      ],
      vacuums: { basic: 6 },
      clutter: { cable: 2 },
      par: [8, 14],
      ease: [0.35, 0.7],
    },
    searchSeed: 'house/study',
  },
  {
    id: 'bathroom',
    name: 'The bathroom',
    idea: 'Mop bots only travel in straight lines.',
    tip: 'A mop cannot cut a corner: a diagonal square next to it is safe.',
    star: 'mop',
    blueprint: {
      width: 11,
      height: 8,
      furniture: [{ kind: 'tub', x: 0, y: 0, w: 4, h: 2 }],
      vacuums: { basic: 2, mop: 3 },
      par: [6, 12],
      ease: [0.35, 0.7],
    },
    searchSeed: 'house/bathroom',
  },
  {
    id: 'bedroom',
    name: 'The bedroom',
    idea: 'The old model rests every other turn.',
    tip: 'Watch its light: when it dims, it will sit the next turn out.',
    star: 'slow',
    blueprint: {
      width: 14,
      height: 9,
      furniture: [{ kind: 'bed', x: 5, y: 0, w: 3, h: 4 }],
      vacuums: { basic: 4, slow: 3 },
      par: [8, 14],
      ease: [0.3, 0.65],
    },
    searchSeed: 'house/bedroom',
  },
  {
    id: 'kids',
    name: 'The playroom',
    idea: 'Turbo bots take two steps a turn.',
    tip: 'Give a turbo twice the room you would give anything else.',
    star: 'turbo',
    blueprint: {
      width: 14,
      height: 9,
      furniture: [{ kind: 'toybox', x: 6, y: 4, w: 2, h: 2 }],
      vacuums: { basic: 4, turbo: 2 },
      clutter: { sock: 2 },
      par: [8, 14],
      ease: [0.25, 0.6],
    },
    searchSeed: 'house/kids',
  },
  {
    id: 'garage',
    name: 'The garage',
    idea: 'The shop vac swallows one tangle whole.',
    tip: 'After its first gulp it is full, and as clumsy as the rest.',
    star: 'sweeper',
    blueprint: {
      width: 15,
      height: 10,
      furniture: [
        { kind: 'crate', x: 3, y: 3, w: 2, h: 2 },
        { kind: 'crate', x: 10, y: 6, w: 2, h: 2 },
      ],
      vacuums: { basic: 5, sweeper: 2 },
      clutter: { cable: 2 },
      par: [10, 16],
      ease: [0.2, 0.55],
    },
    searchSeed: 'house/garage',
  },
  {
    id: 'conservatory',
    name: 'The conservatory',
    idea: 'A charging dock sends out a fresh vacuum every four turns.',
    tip: 'Get a tangle onto the dock and it stops for good.',
    star: 'dock',
    blueprint: {
      width: 15,
      height: 10,
      furniture: [
        { kind: 'plant', x: 4, y: 4, w: 1, h: 1 },
        { kind: 'plant', x: 10, y: 4, w: 1, h: 1 },
        { kind: 'plant', x: 7, y: 7, w: 1, h: 1 },
      ],
      vacuums: { basic: 3 },
      dock: { every: 4, count: 4 },
      par: [12, 20],
      ease: [0.2, 0.55],
    },
    searchSeed: 'house/conservatory',
  },
  {
    id: 'landing',
    name: 'The landing',
    idea: 'A long, narrow runner. Nowhere to hide.',
    tip: 'In a corridor, the vacuums line up for you. Use it.',
    star: 'basic',
    blueprint: {
      width: 19,
      height: 5,
      furniture: [{ kind: 'plant', x: 9, y: 0, w: 1, h: 1 }],
      vacuums: { basic: 5, mop: 1, turbo: 1 },
      par: [10, 16],
      ease: [0.15, 0.5],
    },
    searchSeed: 'house/landing',
  },
  {
    id: 'night',
    name: 'The whole house',
    idea: 'Everyone is out tonight.',
    tip: 'Every kind of vacuum, a dock and the socks. Take your time.',
    star: 'loaf',
    blueprint: {
      width: 17,
      height: 11,
      furniture: [
        { kind: 'sofa', x: 6, y: 10, w: 4, h: 1 },
        { kind: 'table', x: 2, y: 2, w: 2, h: 2 },
        { kind: 'plant', x: 14, y: 2, w: 1, h: 1 },
      ],
      vacuums: { basic: 3, mop: 2, slow: 1, turbo: 1, sweeper: 1 },
      clutter: { sock: 2 },
      dock: { every: 5, count: 3 },
      par: [14, 22],
      ease: [0.1, 0.45],
    },
    searchSeed: 'house/night',
  },
];
