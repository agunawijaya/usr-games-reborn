import { createRng, type Rng } from '@usr-games/kit';
import {
  ALDER,
  type BattleSetup,
  CHAIN,
  DESIGNS,
  type DesignId,
  type Nation,
  RAIDERS,
  type Role,
  ROUND,
  type ShipSetup,
  type ShipSpec,
  VESK,
  windAngle,
} from '../engine';
import { freshName, MERCHANT_NAMES, RAIDER_NAMES, STATION_NAMES, VESK_NAMES } from './names';
import type { Ally, EncounterKind, Quality, RefitId } from './types';

/**
 * Each kind of encounter as a battle: who sails, where they start, the weather, the chart and
 * the three mentions a captain can earn. Layouts are seeded, so the same chapter seed always
 * sets the same scene.
 */

export type MentionId =
  | 'won'
  | 'whole'
  | 'masts'
  | 'rake'
  | 'stern-rake'
  | 'quick'
  | 'all-merchants'
  | 'both'
  | 'squadron-whole'
  | 'big-prize'
  | 'three-prizes'
  | 'bare-poles'
  | 'in-company'
  | 'light-losses';

export interface MentionDef {
  id: MentionId;
  /** For 'quick': the turn to win by. */
  turns?: number;
}

export interface Encounter {
  kind: EncounterKind;
  seed: string;
  setup: BattleSetup;
  /** The enemy the log will name. */
  foe: string | null;
  /** Fought by night: ships beyond lantern range are seen only as a last bearing. */
  night: boolean;
  mentions: MentionDef[];
  /** The ship the player sails, when it is not her own: a cutting-out. */
  aboard: string | null;
  /** In a cutting-out, the index of her own ship, held by the enemy. */
  ownShip: number;
}

export interface Flagship {
  name: string;
  qual: Quality;
  refits: readonly RefitId[];
  /** Hands away with prizes from the last chapter. */
  away: number;
}

export interface EncounterContext {
  flagship: Flagship;
  squadron: readonly Ally[];
  /** 0 at her launch, rising through her life: tougher enemies, better crews. */
  pressure: number;
}

/** Changes a refit makes to the frigate's design. */
export function refitSpecs(refits: readonly RefitId[], base: ShipSpec): Partial<ShipSpec> {
  const s = { ...base };
  for (const refit of refits) {
    if (refit === 'carronades') {
      s.carL += 2;
      s.carR += 2;
      s.gunL = Math.max(1, s.gunL - 1);
      s.gunR = Math.max(1, s.gunR - 1);
    } else if (refit === 'long-guns') {
      s.gunL += 2;
      s.gunR += 2;
      s.carL = Math.max(0, s.carL - 2);
      s.carR = Math.max(0, s.carR - 2);
    } else if (refit === 'copper') s.fs += 1;
    else if (refit === 'oak-knees') s.hull += 3;
    else if (refit === 'more-hands') {
      s.crew1 += 1;
      s.crew2 += 1;
    } else if (refit === 'new-canvas') {
      s.rig1 += 1;
      s.rig2 += 1;
      s.rig3 += 1;
      s.rig4 += 1;
    }
  }
  return s;
}

/** Hands away with prizes come out of the first sections; the gun crews of the third stay. */
export function withHandsAway(spec: ShipSpec, away: number): Partial<ShipSpec> {
  let left = away;
  const crew1 = Math.max(0, spec.crew1 - left);
  left -= spec.crew1 - crew1;
  const crew2 = Math.max(1, spec.crew2 - left);
  return { crew1, crew2 };
}

const FRIGATE: ShipSpec = {
  bs: 4,
  fs: 6,
  ta: 3,
  guns: 40,
  cls: 3,
  hull: 15,
  qual: 3,
  crew1: 8,
  crew2: 6,
  crew3: 6,
  gunL: 6,
  gunR: 6,
  carL: 4,
  carR: 4,
  rig1: 5,
  rig2: 5,
  rig3: 5,
  rig4: 5,
  pts: 15,
};

export function flagshipSpecs(flagship: Flagship): Partial<ShipSpec> {
  const refitted = { ...FRIGATE, ...refitSpecs(flagship.refits, FRIGATE) } as ShipSpec;
  return { ...refitted, ...withHandsAway(refitted, flagship.away), qual: flagship.qual };
}

// --- headings and placing --------------------------------------------------------------

/** The compass heading (1–8) from one square towards another. */
function headingTowards(
  from: { row: number; col: number },
  to: { row: number; col: number },
): number {
  const dr = Math.sign(from.row - to.row);
  const dc = Math.sign(to.col - from.col);
  const table: Record<string, number> = {
    '1,0': 1,
    '1,1': 2,
    '0,1': 3,
    '-1,1': 4,
    '-1,0': 5,
    '-1,-1': 6,
    '0,-1': 7,
    '1,-1': 8,
  };
  return table[`${dr},${dc}`] ?? 3;
}

/** Bear away from the wind's eye: no ship starts in irons or pinching close-hauled. */
function sailable(dir: number, winddir: number): number {
  const rel = windAngle(winddir, dir);
  return rel >= 3 && rel <= 5 ? towardsBeam(dir, winddir) : dir;
}

function towardsBeam(dir: number, winddir: number): number {
  const port = ((winddir + 2 - 1) % 8) + 1;
  const starboard = ((winddir + 6 - 1) % 8) + 1;
  const gap = (a: number, b: number) => Math.min((a - b + 8) % 8, (b - a + 8) % 8);
  return gap(dir, port) <= gap(dir, starboard) ? port : starboard;
}

interface Placed {
  row: number;
  col: number;
  dir: number;
}

/** A ship facing a point, on a heading she can sail. */
function facing(
  at: { row: number; col: number },
  towards: { row: number; col: number },
  winddir: number,
): Placed {
  return { ...at, dir: sailable(headingTowards(at, towards), winddir) };
}

// --- building the scene -----------------------------------------------------------------

interface Scene {
  rng: Rng;
  ships: ShipSetup[];
  used: Set<string>;
  winddir: number;
}

function addShip(
  scene: Scene,
  o: {
    name?: string;
    names?: readonly string[];
    nation: Nation;
    design: DesignId;
    role: Role;
    at: Placed;
    qual?: number;
    specs?: Partial<ShipSpec>;
    goal?: { row: number; col: number };
  },
): number {
  const name = o.name ?? freshName(scene.rng, o.names ?? VESK_NAMES, scene.used);
  scene.used.add(name);
  scene.ships.push({
    name,
    nation: o.nation,
    design: o.design,
    role: o.role,
    row: o.at.row,
    col: o.at.col,
    dir: o.at.dir,
    qual: o.qual,
    specs: o.specs,
    goal: o.goal ?? null,
  });
  return scene.ships.length - 1;
}

const clampQual = (q: number): number => Math.max(2, Math.min(5, Math.round(q)));

/** Enemy crews by pressure: green raiders at first, crack crews late in her life. */
const enemyQual = (pressure: number, bonus = 0): number =>
  clampQual([2, 3, 3, 4][Math.min(3, pressure)]! + bonus);

function addFlagship(scene: Scene, ctx: EncounterContext, at: Placed): number {
  return addShip(scene, {
    name: ctx.flagship.name,
    nation: ALDER,
    design: 'frigate',
    role: 'human',
    at,
    specs: flagshipSpecs(ctx.flagship),
  });
}

/**
 * The squadron sails in line abreast of the flagship, on the side towards the middle of the
 * chart; the station sends ships when the squadron is short.
 */
function addSquadron(
  scene: Scene,
  ctx: EncounterContext,
  lead: Placed,
  wanted: number,
  chart: { rows: number; cols: number },
): number[] {
  const indices: number[] = [];
  const allies = ctx.squadron.slice(0, wanted);
  const northSouth = lead.dir === 1 || lead.dir === 5;
  const step = northSouth
    ? { r: 0, c: lead.col < chart.cols / 2 ? 3 : -3 }
    : { r: lead.row < chart.rows / 2 ? 3 : -3, c: 0 };
  for (let i = 0; i < wanted; i++) {
    const at = {
      row: lead.row + step.r * (i + 1),
      col: lead.col + step.c * (i + 1),
      dir: lead.dir,
    };
    const ally = allies[i];
    indices.push(
      ally
        ? addShip(scene, {
            name: ally.shipName,
            nation: ALDER,
            design: ally.design,
            role: 'attack',
            at,
            qual: ally.qual,
          })
        : addShip(scene, {
            names: STATION_NAMES,
            nation: ALDER,
            design: i % 2 ? 'corvette' : 'frigate',
            role: 'attack',
            at,
            qual: 3,
          }),
    );
  }
  return indices;
}

const CHART = {
  small: { rows: 22, cols: 34 },
  medium: { rows: 26, cols: 40 },
  large: { rows: 30, cols: 46 },
} as const;

function newScene(seed: string, winddir?: number): Scene {
  const rng = createRng(`figurehead:encounter:${seed}`);
  return { rng, ships: [], used: new Set(), winddir: winddir ?? rng.int(1, 8) };
}

function finish(
  scene: Scene,
  o: {
    kind: EncounterKind;
    seed: string;
    chart: { rows: number; cols: number };
    speed: number;
    change: number;
    maxTurns: number;
    mentions: MentionDef[];
    foe?: number;
    night?: boolean;
    harbour?: BattleSetup['harbour'];
    retake?: number;
    aboard?: string | null;
  },
): Encounter {
  return {
    kind: o.kind,
    seed: o.seed,
    setup: {
      seed: o.seed,
      ships: scene.ships,
      player: scene.ships.findIndex((s) => s.role === 'human'),
      wind: { dir: scene.winddir, speed: o.speed, change: o.change },
      rows: o.chart.rows,
      cols: o.chart.cols,
      maxTurns: o.maxTurns,
      harbour: o.harbour ?? null,
      retake: o.retake,
    },
    foe: o.foe !== undefined ? (scene.ships[o.foe]?.name ?? null) : null,
    night: o.night ?? false,
    mentions: o.mentions,
    aboard: o.aboard ?? null,
    ownShip: o.retake ?? -1,
  };
}

/** Two sides on a chart: ours to the west, theirs to the east, rows jittered by the seed. */
function sides(scene: Scene, chart: { rows: number; cols: number }) {
  const mid = Math.floor(chart.rows / 2);
  const ours = { row: mid + scene.rng.int(-3, 3), col: 6 };
  const theirs = { row: mid + scene.rng.int(-4, 4), col: chart.cols - 8 };
  return { ours, theirs };
}

// --- the encounters --------------------------------------------------------------------

function maiden(seed: string, ctx: EncounterContext): Encounter {
  // A gentle first action: the wind on the beam for both ships, a small raider, steady weather.
  const scene = newScene(seed, 5);
  const chart = CHART.small;
  const { ours, theirs } = sides(scene, chart);
  addFlagship(scene, ctx, facing(ours, theirs, scene.winddir));
  const foe = addShip(scene, {
    names: RAIDER_NAMES,
    nation: RAIDERS,
    design: 'brig',
    role: 'attack',
    at: facing(theirs, ours, scene.winddir),
    qual: 3,
  });
  return finish(scene, {
    kind: 'maiden',
    seed,
    chart,
    speed: 3,
    change: 99,
    maxTurns: 40,
    foe,
    mentions: [{ id: 'won' }, { id: 'rake' }, { id: 'light-losses' }],
  });
}

function duel(seed: string, ctx: EncounterContext): Encounter {
  const scene = newScene(seed);
  const chart = CHART.small;
  const { ours, theirs } = sides(scene, chart);
  addFlagship(scene, ctx, facing(ours, theirs, scene.winddir));
  const designs: DesignId[] = ['corvette', 'corvette', 'frigate', 'heavy-frigate'];
  const foe = addShip(scene, {
    nation: VESK,
    design: designs[Math.min(designs.length - 1, ctx.pressure)]!,
    role: 'attack',
    at: facing(theirs, ours, scene.winddir),
    qual: enemyQual(ctx.pressure),
  });
  return finish(scene, {
    kind: 'duel',
    seed,
    chart,
    speed: scene.rng.int(2, 4),
    change: 4,
    maxTurns: 45,
    foe,
    mentions: [{ id: 'won' }, { id: 'whole' }, { id: 'masts' }],
  });
}

/**
 * A raider caught close aboard runs east for her haven, the wind on her beam. Deep-laden with
 * what she has taken, she is no faster than you, but she has the start of you and the open sea
 * ahead: bring down her rigging before she reaches the edge of the chart. The gunner has loaded
 * chain on the side she lies, round shot on the other.
 */
function chase(seed: string, ctx: EncounterContext): Encounter {
  const scene = newScene(seed);
  scene.winddir = scene.rng.pick([1, 5]);
  const chart = { rows: 26, cols: 58 };
  const mid = Math.floor(chart.rows / 2);
  const side = scene.rng.chance(0.5) ? 1 : -1;
  const ours = { row: mid + side, col: 6 };
  const theirs = { row: mid - side, col: 7 + scene.rng.int(0, 1) };
  const first = addFlagship(scene, ctx, { ...ours, dir: 3 });
  // Heading east, a raider to the north lies on the port hand.
  scene.ships[first]!.loads = side > 0 ? { L: CHAIN, R: ROUND } : { L: ROUND, R: CHAIN };
  const design: DesignId = ctx.pressure >= 2 ? 'sloop' : 'cutter';
  const foe = addShip(scene, {
    names: RAIDER_NAMES,
    nation: RAIDERS,
    design,
    role: 'flee',
    at: { ...theirs, dir: 3 },
    qual: enemyQual(ctx.pressure),
    specs: { fs: DESIGNS[design].spec.fs - 1 },
    goal: { row: theirs.row, col: chart.cols + 6 },
  });
  return finish(scene, {
    kind: 'chase',
    seed,
    chart,
    speed: 3,
    change: 6,
    maxTurns: 30,
    foe,
    mentions: [{ id: 'won' }, { id: 'bare-poles' }, { id: 'quick', turns: 14 }],
  });
}

/**
 * Two slow merchantmen make for the eastern edge, the wind on their beam. Raiders lie ahead,
 * off to one side, and will be among them in a few turns unless the escort gets there first.
 */
function convoy(seed: string, ctx: EncounterContext): Encounter {
  const scene = newScene(seed);
  scene.winddir = scene.rng.pick([1, 5]);
  const chart = { rows: 26, cols: 52 };
  const mid = Math.floor(chart.rows / 2);
  const fromNorth = scene.rng.chance(0.5);
  const goal = { row: mid, col: chart.cols + 6 };
  const lead = { row: mid + (fromNorth ? -3 : 3), col: 6 };
  addFlagship(scene, ctx, { ...lead, dir: 3 });
  for (let i = 0; i < 2; i++) {
    addShip(scene, {
      names: MERCHANT_NAMES,
      nation: ALDER,
      design: 'merchantman',
      role: 'merchant',
      at: { row: mid + (i ? 2 : -1), col: 4 + i * 3, dir: 3 },
      goal,
    });
  }
  const raidRow = fromNorth ? 3 : chart.rows - 4;
  const designs: DesignId[] = ctx.pressure >= 2 ? ['sloop', 'corvette'] : ['cutter', 'sloop'];
  let foe = -1;
  designs.forEach((design, i) => {
    const at = { row: raidRow, col: 20 + i * 7 + scene.rng.int(0, 3) };
    const index = addShip(scene, {
      names: RAIDER_NAMES,
      nation: RAIDERS,
      design,
      role: 'attack',
      at: facing(at, { row: mid, col: at.col - 6 }, scene.winddir),
      qual: enemyQual(ctx.pressure),
    });
    if (foe < 0) foe = index;
  });
  return finish(scene, {
    kind: 'convoy',
    seed,
    chart,
    speed: 3,
    change: 5,
    maxTurns: 40,
    foe,
    mentions: [{ id: 'won' }, { id: 'all-merchants' }, { id: 'whole' }],
  });
}

function pair(seed: string, ctx: EncounterContext): Encounter {
  const scene = newScene(seed);
  const chart = CHART.medium;
  const { ours, theirs } = sides(scene, chart);
  addFlagship(scene, ctx, facing(ours, theirs, scene.winddir));
  const pairs: DesignId[][] = [
    ['cutter', 'brig'],
    ['cutter', 'brig'],
    ['corvette', 'cutter'],
    ['corvette', 'corvette'],
  ];
  const designs = pairs[Math.min(3, ctx.pressure)]!;
  let foe = -1;
  for (let i = 0; i < 2; i++) {
    const design = designs[i]!;
    const at = { row: theirs.row + (i ? 4 : -2), col: theirs.col - i * 2 };
    const index = addShip(scene, {
      nation: VESK,
      design,
      role: 'attack',
      at: facing(at, ours, scene.winddir),
      qual: enemyQual(ctx.pressure),
    });
    if (foe < 0) foe = index;
  }
  return finish(scene, {
    kind: 'pair',
    seed,
    chart,
    speed: scene.rng.int(2, 4),
    change: 4,
    maxTurns: 50,
    foe,
    mentions: [{ id: 'won' }, { id: 'both' }, { id: 'light-losses' }],
  });
}

function storm(seed: string, ctx: EncounterContext): Encounter {
  // A strong breeze that will not stay put: the glass falls every few turns.
  const scene = newScene(seed);
  const chart = CHART.small;
  const { ours, theirs } = sides(scene, chart);
  addFlagship(scene, ctx, facing(ours, theirs, scene.winddir));
  const foe = addShip(scene, {
    nation: VESK,
    design: ctx.pressure >= 2 ? 'frigate' : 'corvette',
    role: 'attack',
    at: facing(theirs, ours, scene.winddir),
    qual: enemyQual(ctx.pressure),
  });
  return finish(scene, {
    kind: 'storm',
    seed,
    chart,
    speed: 4,
    change: 2,
    maxTurns: 40,
    foe,
    mentions: [{ id: 'won' }, { id: 'whole' }, { id: 'masts' }],
  });
}

function squadron(seed: string, ctx: EncounterContext): Encounter {
  const scene = newScene(seed);
  const chart = CHART.large;
  const { ours, theirs } = sides(scene, chart);
  const lead = facing(ours, theirs, scene.winddir);
  addFlagship(scene, ctx, lead);
  addSquadron(scene, ctx, lead, 2, chart);
  const designs: DesignId[] = ['frigate', 'corvette', 'cutter'];
  let foe = -1;
  designs.forEach((design, i) => {
    const at = { row: theirs.row + (i - 1) * 4, col: theirs.col - Math.abs(i - 1) };
    const index = addShip(scene, {
      nation: VESK,
      design,
      role: 'attack',
      at: facing(at, ours, scene.winddir),
      qual: enemyQual(ctx.pressure),
    });
    if (foe < 0) foe = index;
  });
  return finish(scene, {
    kind: 'squadron',
    seed,
    chart,
    speed: 3,
    change: 4,
    maxTurns: 50,
    foe,
    mentions: [{ id: 'won' }, { id: 'squadron-whole' }, { id: 'whole' }],
  });
}

function night(seed: string, ctx: EncounterContext): Encounter {
  const scene = newScene(seed);
  const chart = CHART.small;
  const { ours, theirs } = sides(scene, chart);
  addFlagship(scene, ctx, facing(ours, theirs, scene.winddir));
  const foe = addShip(scene, {
    nation: VESK,
    design: 'heavy-frigate',
    role: 'attack',
    at: facing(theirs, ours, scene.winddir),
    qual: enemyQual(ctx.pressure),
  });
  return finish(scene, {
    kind: 'night',
    seed,
    chart,
    speed: 2,
    change: 5,
    maxTurns: 40,
    foe,
    night: true,
    mentions: [{ id: 'won' }, { id: 'stern-rake' }, { id: 'whole' }],
  });
}

function line(seed: string, ctx: EncounterContext): Encounter {
  // A two-decker and her escort: too much for one frigate, enough for a squadron.
  const scene = newScene(seed);
  const chart = CHART.large;
  const { ours, theirs } = sides(scene, chart);
  const lead = facing(ours, theirs, scene.winddir);
  addFlagship(scene, ctx, lead);
  addSquadron(scene, ctx, lead, 2, chart);
  const foe = addShip(scene, {
    nation: VESK,
    design: 'seventy-four',
    role: 'attack',
    at: facing(theirs, ours, scene.winddir),
    qual: 3,
  });
  addShip(scene, {
    nation: VESK,
    design: 'cutter',
    role: 'attack',
    at: facing({ row: theirs.row + 4, col: theirs.col + 1 }, ours, scene.winddir),
    qual: 3,
  });
  return finish(scene, {
    kind: 'line',
    seed,
    chart,
    speed: 3,
    change: 4,
    maxTurns: 55,
    foe,
    mentions: [{ id: 'won' }, { id: 'big-prize' }, { id: 'squadron-whole' }],
  });
}

function fleet(seed: string, ctx: EncounterContext): Encounter {
  const scene = newScene(seed);
  const chart = { rows: 32, cols: 50 };
  const { ours, theirs } = sides(scene, chart);
  const lead = facing(ours, theirs, scene.winddir);
  addFlagship(scene, ctx, lead);
  addSquadron(scene, ctx, lead, 3, chart);
  const designs: DesignId[] = ['seventy-four', 'frigate', 'corvette'];
  let foe = -1;
  designs.forEach((design, i) => {
    const at = { row: theirs.row + (i - 1.5) * 4, col: theirs.col - (i % 2) * 2 };
    const index = addShip(scene, {
      nation: VESK,
      design,
      role: 'attack',
      at: facing({ row: Math.round(at.row), col: at.col }, ours, scene.winddir),
      qual: 3,
    });
    if (foe < 0) foe = index;
  });
  return finish(scene, {
    kind: 'fleet',
    seed,
    chart,
    speed: 3,
    change: 4,
    maxTurns: 60,
    foe,
    mentions: [{ id: 'won' }, { id: 'three-prizes' }, { id: 'squadron-whole' }],
  });
}

/**
 * A cutting-out by night. Her own ship lies at anchor with a prize crew aboard and her people
 * below as prisoners; a guard ship stands by. Board her, or thin the prize crew with grape
 * until the prisoners outnumber it six to one and take her back themselves.
 */
function recapture(seed: string, ctx: EncounterContext): Encounter {
  const scene = newScene(seed);
  const chart = CHART.small;
  const mid = Math.floor(chart.rows / 2);
  const ally = ctx.squadron[0];
  const aboard = ally ? ally.shipName : freshName(scene.rng, STATION_NAMES, scene.used);
  const start = { row: mid + scene.rng.int(-3, 3), col: 5 };
  addShip(scene, {
    name: aboard,
    nation: ALDER,
    design: ally ? ally.design : 'corvette',
    role: 'human',
    at: { ...start, dir: sailable(3, scene.winddir) },
    qual: ctx.flagship.qual,
  });
  const anchorage = { row: mid + scene.rng.int(-2, 2), col: chart.cols - 10 };
  const guard = addShip(scene, {
    nation: VESK,
    design: 'cutter',
    role: 'attack',
    at: facing({ row: anchorage.row + 4, col: anchorage.col + 3 }, start, scene.winddir),
    qual: 3,
  });
  const own = addShip(scene, {
    name: ctx.flagship.name,
    nation: ALDER,
    design: 'frigate',
    role: 'anchored',
    at: { ...anchorage, dir: 7 },
    specs: { ...flagshipSpecs({ ...ctx.flagship, away: 0 }), crew1: 3, crew2: 3, crew3: 2 },
  });
  scene.ships[own]!.heldBy = { ship: guard, prizeCrew: 2 };
  return finish(scene, {
    kind: 'recapture',
    seed,
    chart,
    speed: 2,
    change: 6,
    maxTurns: 30,
    foe: guard,
    night: true,
    retake: own,
    aboard,
    mentions: [{ id: 'won' }, { id: 'quick', turns: 14 }, { id: 'light-losses' }],
  });
}

/**
 * Her last passage: home to the anchorage under her own sail, the squadron in company, the
 * wind against her so she must work to windward.
 */
function passage(seed: string, ctx: EncounterContext): Encounter {
  const scene = newScene(seed, 5);
  const chart = CHART.medium;
  const start = { row: chart.rows - 5, col: 5 };
  const harbour = { row: 4, col: chart.cols - 7, radius: 2 };
  const lead = { ...start, dir: 3 };
  addFlagship(scene, ctx, lead);
  addSquadron(scene, ctx, lead, Math.min(3, ctx.squadron.length), chart);
  for (const ship of scene.ships) if (ship.role === 'attack') ship.role = 'follow';
  return finish(scene, {
    kind: 'passage',
    seed,
    chart,
    speed: 4,
    change: 4,
    maxTurns: 26,
    harbour,
    mentions: [{ id: 'won' }, { id: 'in-company' }, { id: 'quick', turns: 18 }],
  });
}

const BUILDERS: Record<EncounterKind, (seed: string, ctx: EncounterContext) => Encounter> = {
  maiden,
  duel,
  chase,
  convoy,
  pair,
  storm,
  squadron,
  night,
  line,
  fleet,
  recapture,
  passage,
};

export function buildEncounter(
  kind: EncounterKind,
  seed: string,
  ctx: EncounterContext,
): Encounter {
  return BUILDERS[kind](seed, ctx);
}
