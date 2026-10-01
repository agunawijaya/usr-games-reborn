import type { RngState } from '@usr-games/kit';

/**
 * The whole state of one watch, as plain JSON so it can be saved, resumed and replayed.
 *
 * Coordinates follow the 1976 program: a zone is addressed by `row` (north to south) and `col`
 * (west to east), and so is a cell inside a zone. Bearings are whole degrees clockwise from
 * north, the way the original read a course. Distances are measured in zones: one cell is 0.1.
 */

export const REACH_SIZE = 8;
export const ZONE_SIZE = 10;
/** The most gleaners one zone can hold, as in the original. */
export const ZONE_CAPACITY = 9;
export const BEAM_BANKS = 6;

export interface Point {
  row: number;
  col: number;
}

export type RankId = 1 | 2 | 3 | 4 | 5 | 6;
/** Short, medium and long watches; the number multiplies the clock and the swarm, as it did. */
export type WatchLength = 1 | 2 | 4;

/** Which rules a watch plays by: the career's gentle curve, or every event of 1976. */
export type RuleSet = 'commission' | 'classic';

export type SystemId =
  | 'drive'
  | 'near-sensors'
  | 'far-sensors'
  | 'beams'
  | 'flare-tubes'
  | 'thrusters'
  | 'shield'
  | 'computer'
  | 'radio'
  | 'life-support'
  | 'navigation'
  | 'shroud'
  | 'ferry'
  | 'launch';

export type CellContent =
  'empty' | 'star' | 'hole' | 'world' | 'harbour' | 'gleaner' | 'lantern' | 'ember';

/** What the chart remembers about a zone; null fields have never been scanned. */
export interface ZoneMemory {
  gleaners: number | null;
  harbour: boolean;
  stars: number | null;
  collapsed: boolean;
}

/** Where the fixed things of a zone sit, decided the first time anyone looks. */
export interface ZoneLayout {
  stars: Point[];
  holes: Point[];
  world: Point | null;
  harbour: Point | null;
}

export interface Zone {
  /** Stars, counting a world's sun; -1 once the zone has collapsed in a star's death. */
  stars: number;
  holes: number;
  gleaners: number;
  harbour: boolean;
  /** Index into the gazetteer, or null for an empty zone. */
  world: number | null;
  /** Gleaners are attacking the world: the id of the event that decides its fate. */
  distress: number | null;
  layout: ZoneLayout | null;
  /** The chart's memory of this zone; null until scanned. */
  seen: ZoneMemory | null;
}

export type EventKind =
  | 'collapse'
  | 'snare'
  | 'siege-begins'
  | 'harbour-falls'
  | 'call'
  | 'world-falls'
  | 'swarm-grows'
  | 'repair'
  | 'raid'
  | 'snapshot';

export interface ScheduledEvent {
  id: number;
  kind: EventKind;
  date: number;
  zone: Point;
  /** The world a call is about, or the system a repair is for. */
  world: number | null;
  system: SystemId | null;
  /** Happened while the radio was out: the crew has not heard about it yet. */
  hidden: boolean;
  /** Already over, but the crew will only learn that once the radio is back. */
  ghost: boolean;
}

export interface GleanerInZone {
  row: number;
  col: number;
  power: number;
  dist: number;
  avgDist: number;
  hailed: number;
}

export type Condition = 'green' | 'yellow' | 'red' | 'moored';
export type Vessel = 'lantern' | 'ember';

export interface Ship {
  vessel: Vessel;
  energy: number;
  shield: number;
  shieldUp: boolean;
  shrouded: boolean;
  /** The shroud only hides the ship once some time has passed with it on. */
  shroudSettled: boolean;
  /** Days of air left while life support is down. */
  reserves: number;
  crew: number;
  holdFree: number;
  flares: number;
  zone: Point;
  cell: Point;
  condition: Condition;
  /** Repaired navigation needs a harbour to recalibrate; until then courses wander a little. */
  navigationUncalibrated: boolean;
  drive: number;
  /** Calls issued over the whole watch; the original never counted them back down. */
  callsIssued: number;
}

export interface Tally {
  stopped: number;
  injured: number;
  rimTouches: number;
  harboursLostByUs: number;
  starsLost: number;
  worldsLostByUs: number;
  beaconCalls: number;
  salvage: number;
  relit: number;
  callsAnswered: number;
  hailsAccepted: number;
  novas: number;
  portals: number;
  /** Zones charted at least once this watch. */
  charted: number;
}

export interface Now {
  harbours: Point[];
  gleaners: number;
  date: number;
  /** Days left at the swarm's present size: the reserve divided by the gleaners. */
  time: number;
  reserve: number;
}

/** The galaxy as it was at the last snapshot, for the time portal. */
export interface Snapshot {
  zones: Zone[][];
  events: ScheduledEvent[];
  now: Now;
}

export interface Rules {
  calls: boolean;
  sieges: boolean;
  hail: boolean;
  radioHidesNews: boolean;
  snare: boolean;
  collapses: boolean;
  bursts: boolean;
  shroud: boolean;
  redline: boolean;
  /** The original stopped issuing calls after five in a whole game; the career counts live ones. */
  callCapCountsLiveOnly: boolean;
}

export interface Params {
  rank: RankId;
  /** The original's skill number behind the swarm's strength; the career eases its climb. */
  skill: number;
  length: WatchLength;
  ruleSet: RuleSet;
  rules: Rules;
  harbours: number;
  gleaners: number;
  date: number;
  time: number;
  reserve: number;
  energy: number;
  shield: number;
  reserves: number;
  crew: number;
  holdFree: number;
  flares: number;
  damageFactor: number;
  mooredRepairFactor: number;
  regen: number;
  driveTime: number;
  stopEnergy: number;
  shieldUpEnergy: number;
  gleanerPower: number;
  gleanerFatigue: number;
  moveChance: [number, number, number, number, number, number];
  moveFactor: [number, number, number, number, number, number];
  eventDelay: Record<EventKind, number>;
  navigationDrift: [uncalibrated: number, damaged: number];
  shroudEnergy: number;
  damageOdds: Record<SystemId, number>;
  hitFactor: number;
  gleanerCargo: number;
  hailChance: number;
  lowEnergy: number;
}

export type Outcome = { kind: 'won' } | { kind: 'lost'; reason: LossReason } | { kind: 'ended' };

export type LossReason =
  | 'reserve-ran-dry'
  | 'power-ran-out'
  | 'lantern-disabled'
  | 'rim'
  | 'own-flare-up'
  | 'collapse'
  | 'air'
  | 'beacon-failed'
  | 'redline'
  | 'into-a-star'
  | 'no-harbour-left'
  | 'no-crew';

export interface WatchState {
  version: 1;
  seed: string;
  code: string | null;
  params: Params;
  rng: RngState;
  zones: Zone[][];
  /** The zone the ship is in, cell by cell. */
  cells: CellContent[][];
  gleaners: GleanerInZone[];
  /** True while the computer hurls the ship out of a collapsing zone. */
  override: boolean;
  harbourCell: Point | null;
  worldCell: Point | null;
  ship: Ship;
  now: Now;
  events: ScheduledEvent[];
  nextEventId: number;
  snapshot: Snapshot | null;
  /** Worlds gone for good, to a flare-up or a dying star; their lights cannot be relit. */
  lostWorlds: { world: number; zone: Point }[];
  tally: Tally;
  /** Cells revealed by a lantern sweep while the near sensors are down. */
  swept: Point[];
  outcome: Outcome | null;
  actions: number;
}
