import type { RngState } from '@usr-games/kit';
import type { DesignId, ShipSpec } from './tables';

/**
 * The battle as one plain, JSON-safe object: it can be saved mid-fight, replayed from its seed
 * and orders, and compared in tests. Grid and codes follow the original sail: rows grow
 * southwards, columns eastwards, and a heading is 1 (north) to 8 (north-west), clockwise.
 */

/** What a broadside is loaded with. EXPLODE is only used for the blast of a ship blowing up. */
export const EMPTY = 0;
export const GRAPE = 1;
export const CHAIN = 2;
export const ROUND = 3;
export const DOUBLE = 4;
export const EXPLODE = 5;
export type Load = 0 | 1 | 2 | 3 | 4 | 5;

/** Readiness bits of a broadside. */
export const R_EMPTY = 0;
export const R_LOADING = 1;
export const R_DOUBLE = 2;
export const R_LOADED = 4;
/** The broadside loaded with care before the battle: it hits a little harder the first time. */
export const R_INITIAL = 8;

/** How far each shot carries, indexed by Load. */
export const SHOT_RANGE: readonly number[] = [0, 1, 3, 10, 1];

/** Crew sections that can be sent across or kept back: the original's three. */
export const PARTY_SLOTS = 3;

export type Nation = 0 | 1 | 2;
/** Our flag, the rival fleet, and the raiders of the outer islands. */
export const ALDER: Nation = 0;
export const VESK: Nation = 1;
export const RAIDERS: Nation = 2;

/**
 * How a ship is sailed. `human` takes orders from the player; the rest are computer captains:
 * `attack` is the original's (close the nearest enemy), the others are Figurehead's own.
 */
export type Role = 'human' | 'attack' | 'flee' | 'merchant' | 'follow' | 'holdoff' | 'anchored';

/** Squadron signals the player can hoist for the ships that follow her. */
export type Signal = 'engage' | 'follow' | 'holdoff';

export interface Party {
  /** The turn the party went across; 0 = this slot is free. */
  turnsent: number;
  toship: number;
  /** Sections as decimal digits, as the original kept them: 100 = first, 10 = second, 1 = third. */
  mensent: number;
}

export interface Snag {
  count: number;
  turn: number;
}

export interface Pose {
  row: number;
  col: number;
  dir: number;
}

export interface Ship {
  index: number;
  name: string;
  nation: Nation;
  design: DesignId;
  /** The ship as she is now; damage and repairs change these numbers. */
  specs: ShipSpec;
  /** The ship as she came into the battle. */
  max: ShipSpec;
  role: Role;
  points: number;
  loadL: Load;
  loadR: Load;
  readyL: number;
  readyR: number;
  OBP: Party[];
  DBP: Party[];
  struck: boolean;
  /** Struck by choice, with her hull still sound: she does not sink or burn afterwards. */
  yielded: boolean;
  /** Index of the ship whose crew holds her, or -1. */
  captured: number;
  /** Hands of the prize crew aboard her when captured. */
  pcrew: number;
  movebuf: string;
  drift: number;
  nfoul: number;
  ngrap: number;
  foul: Snag[];
  grap: Snag[];
  /** Turns of repair work on hull, guns and rigging. */
  RH: number;
  RG: number;
  RR: number;
  /** 0 battle sails, 1 full sails set this turn, 2 full sails. */
  FS: 0 | 1 | 2;
  /** 1 on fire, 2 blown up. */
  explode: 0 | 1 | 2;
  /** 1 sinking, 2 gone down. */
  sink: 0 | 1 | 2;
  /** Sailed off the chart: out of the battle without being taken. */
  escaped: boolean;
  /** Bow square and heading; dir 0 means she has left the battle. */
  row: number;
  col: number;
  dir: number;
  /** A computer captain's wish to fire grape at the next ship alongside. */
  loadwith: Load;
  /** Where a fleeing or trading ship is bound: a point off the chart's edge. */
  goal: { row: number; col: number } | null;
  /** Crew at the start of the battle, for the rule that a beaten ship yields. */
  startCrew: number;
}

export type EndReason =
  | 'victory'
  | 'struck'
  | 'captured'
  | 'sunk'
  | 'burnt'
  | 'nightfall'
  | 'weather'
  | 'withdrew'
  | 'escaped'
  | 'harbour'
  | 'convoy-lost';

export interface BattleEnd {
  reason: EndReason;
  /** true won, false lost, null neither (nightfall, weather, broke off). */
  win: boolean | null;
}

export interface Battle {
  v: 1;
  seed: string;
  rng: RngState;
  turn: number;
  winddir: number;
  windspeed: number;
  /** The higher, the steadier: the weather changes on a d6 at or above it, every seventh turn. */
  windchange: number;
  ships: Ship[];
  /** The player's ship, or -1 when computer captains sail every ship. */
  player: number;
  /** The chart: rows 0 to rows - 1, columns 0 to cols - 1. Leaving it leaves the battle. */
  rows: number;
  cols: number;
  maxTurns: number;
  /** For a passage home: the anchorage the player must reach. */
  harbour: { row: number; col: number; radius: number } | null;
  /** For a cutting-out: the ship the player must take back; -1 otherwise. */
  retake: number;
  signal: Signal;
  /** Merchantmen that reached safety. */
  safe: number[];
  over: boolean;
  end: BattleEnd | null;
}

/** Orders for the player's ship for one turn. Every field is optional. */
export interface Orders {
  grapple?: { target: number; action: 'grapple' | 'cast-off' }[];
  unfoul?: number[];
  sails?: 'full' | 'battle';
  recall?: boolean;
  board?: { target: number; sections: number }[];
  repel?: number;
  fire?: { L?: 'hull' | 'rigging'; R?: 'hull' | 'rigging' };
  unload?: boolean;
  load?: { L?: Load; R?: Load };
  repair?: 'hull' | 'guns' | 'rigging';
  /** A helm string in the original's grammar: digits sail ahead, l and r turn, d drifts. */
  helm?: string;
  signal?: Signal;
  /** Lower the flag: the player gives the ship up. */
  strike?: boolean;
}

export interface Condition {
  hull: number;
  crew: [number, number, number];
  rig: [number, number, number, number];
  gunL: number;
  gunR: number;
  carL: number;
  carR: number;
  pcrew: number;
}

export interface Damage {
  before: Condition;
  after: Condition;
  /** The table's hull, guns, crew and rigging hits. */
  hits: { hull: number; guns: number; crew: number; rig: number };
  dismasted: boolean;
  rudder: boolean;
  /** A six on the die marks a memorable hit; the UI words it. */
  special: string | null;
  struck: 'struck' | 'sink' | 'fire' | null;
}

export type Phase = 'orders' | 'weather' | 'move' | 'engage' | 'melee' | 'end';

export type HelmProblem =
  'too-fast-turn' | 'too-fast-move' | 'bad-key' | 'overrun' | 'drifting' | 'no-hands-full-sails';

export type Note =
  | 'cannot-fire'
  | 'no-hands-repair'
  | 'sails-torn'
  | 'no-crew-to-load'
  | 'too-far-to-grapple'
  | 'grapple-failed'
  | 'cast-off-failed'
  | 'unfoul-failed'
  | 'hands-to-stations'
  | 'unloaded'
  | 'unable-to-move'
  | 'hurricane'
  | 'yielded';

type At = { seq: number; phase: Phase };

export type BattleEvent = At &
  (
    | { t: 'turn'; turn: number }
    | { t: 'helm'; ship: number; helm: string; problems: HelmProblem[] }
    | { t: 'sails'; ship: number; full: boolean; forced: boolean }
    | { t: 'load'; ship: number; side: 'L' | 'R'; load: Load }
    | {
        t: 'fire';
        from: number;
        to: number;
        side: 'L' | 'R';
        load: Load;
        aim: 'hull' | 'rigging';
        range: number;
        rake: boolean;
        sternRake: boolean;
        hit: number;
        initial: boolean;
        roll: number | null;
        damage: Damage | null;
      }
    | { t: 'strike'; ship: number; by: number; fate: 'sink' | 'fire' | null; yielded: boolean }
    | { t: 'wind'; dir: number; speed: number; prevDir: number; prevSpeed: number }
    | { t: 'move'; paths: Record<number, (Pose & { step: number })[]>; drifted: number[] }
    | { t: 'collision'; a: number; b: number }
    | { t: 'foul'; a: number; b: number }
    | { t: 'unfoul'; a: number; b: number }
    | { t: 'grapple'; a: number; b: number; ok: boolean }
    | { t: 'cast-off'; a: number; b: number }
    | { t: 'board'; ship: number; to: number; sections: number }
    | { t: 'repel'; ship: number; sections: number }
    | {
        t: 'melee';
        a: number;
        b: number;
        defending: boolean;
        rounds: { lostA: number; lostB: number }[];
        lostA: number;
        lostB: number;
        outcome: 'repelled' | 'captured' | 'beaten' | 'undecided';
      }
    | { t: 'capture'; ship: number; by: number; prizeCrew: number }
    | { t: 'overthrown'; ship: number; from: number }
    | { t: 'sink'; ship: number; row: number; col: number; dir: number }
    | { t: 'explode'; ship: number; row: number; col: number; dir: number }
    | { t: 'blast'; from: number; to: number; damage: Damage }
    | {
        t: 'repair';
        ship: number;
        kind: 'hull' | 'guns' | 'rigging';
        progress: number;
        done: boolean;
      }
    | { t: 'escape'; ship: number }
    | { t: 'safe'; ship: number }
    | { t: 'harbour'; ship: number }
    | { t: 'signal'; signal: Signal }
    | { t: 'note'; ship: number; note: Note; other?: number }
    | { t: 'end'; end: BattleEnd }
  );

export type EventOf<T extends BattleEvent['t']> = Extract<BattleEvent, { t: T }>;
