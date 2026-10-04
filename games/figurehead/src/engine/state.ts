import { createRng, type Rng } from '@usr-games/kit';
import { DESIGNS, type DesignId, type ShipSpec } from './tables';
import {
  type Battle,
  type BattleEvent,
  type Load,
  type Nation,
  PARTY_SLOTS,
  type Party,
  type Phase,
  R_INITIAL,
  R_LOADED,
  type Role,
  ROUND,
  type Ship,
} from './types';

/**
 * Making a battle, and the small bookkeeping the rules share: who holds a ship, grapples and
 * fouls, and boarding parties. Ported from sail/sync.c (the writes), sail/assorted.c:239-262
 * (cleansnag) and sail/parties.c (meleeing, boarding, unboard).
 */

export interface ShipSetup {
  name: string;
  nation: Nation;
  design: DesignId;
  role: Role;
  row: number;
  col: number;
  dir: number;
  /** Crew quality, 1 to 5; the design's own when left out. */
  qual?: number;
  /** Refits, hands away with prizes, battle damage carried over: changes to the design. */
  specs?: Partial<ShipSpec>;
  goal?: { row: number; col: number } | null;
  loads?: { L: Load; R: Load };
  /** Held by another ship's prize crew from the start: index of the holder, and its hands. */
  heldBy?: { ship: number; prizeCrew: number };
}

export interface BattleSetup {
  seed: string;
  ships: ShipSetup[];
  /** Index of the player's ship in `ships`, or -1. */
  player: number;
  wind: { dir: number; speed: number; change: number };
  rows: number;
  cols: number;
  maxTurns: number;
  harbour?: { row: number; col: number; radius: number } | null;
  /** Index of a ship the player must take back by boarding. */
  retake?: number;
}

const freeParty = (): Party => ({ turnsent: 0, toship: -1, mensent: 0 });

function makeShip(setup: ShipSetup, index: number, count: number): Ship {
  const specs: ShipSpec = { ...DESIGNS[setup.design].spec, ...setup.specs };
  if (setup.qual !== undefined) specs.qual = setup.qual;
  const loads = setup.loads ?? { L: ROUND, R: ROUND };
  return {
    index,
    name: setup.name,
    nation: setup.nation,
    design: setup.design,
    specs,
    max: { ...specs },
    role: setup.role,
    points: 0,
    loadL: loads.L,
    loadR: loads.R,
    readyL: loads.L ? R_LOADED | R_INITIAL : 0,
    readyR: loads.R ? R_LOADED | R_INITIAL : 0,
    OBP: Array.from({ length: PARTY_SLOTS }, freeParty),
    DBP: Array.from({ length: PARTY_SLOTS }, freeParty),
    struck: false,
    yielded: false,
    captured: setup.heldBy?.ship ?? -1,
    pcrew: setup.heldBy?.prizeCrew ?? 0,
    movebuf: '',
    drift: 0,
    nfoul: 0,
    ngrap: 0,
    foul: Array.from({ length: count }, () => ({ count: 0, turn: 0 })),
    grap: Array.from({ length: count }, () => ({ count: 0, turn: 0 })),
    RH: 0,
    RG: 0,
    RR: 0,
    FS: 0,
    explode: 0,
    sink: 0,
    escaped: false,
    row: setup.row,
    col: setup.col,
    dir: setup.dir,
    loadwith: 0,
    goal: setup.goal ?? null,
    startCrew: specs.crew1 + specs.crew2 + specs.crew3,
  };
}

export function createBattle(setup: BattleSetup): Battle {
  const count = setup.ships.length;
  return {
    v: 1,
    seed: setup.seed,
    rng: createRng(`figurehead:battle:${setup.seed}`).state(),
    turn: 0,
    winddir: setup.wind.dir,
    windspeed: setup.wind.speed,
    windchange: setup.wind.change,
    ships: setup.ships.map((ship, index) => makeShip(ship, index, count)),
    player: setup.player,
    rows: setup.rows,
    cols: setup.cols,
    maxTurns: setup.maxTurns,
    harbour: setup.harbour ?? null,
    retake: setup.retake ?? -1,
    signal: 'engage',
    safe: [],
    over: false,
    end: null,
  };
}

export const cloneBattle = (battle: Battle): Battle => structuredClone(battle);

// --- the rules' working context ----------------------------------------------------------

export interface Ctx {
  st: Battle;
  rng: Rng;
  events: BattleEvent[];
  phase: Phase;
}

/** A d6: the only die sail ever rolls. */
export const dieroll = (ctx: Ctx): number => ctx.rng.int(1, 6);

type WithoutStamp<E> = E extends unknown ? Omit<E, 'seq' | 'phase'> : never;
type Payload = WithoutStamp<BattleEvent>;

export function emit(ctx: Ctx, event: Payload): void {
  ctx.events.push({ ...event, seq: ctx.events.length, phase: ctx.phase } as BattleEvent);
}

export function ship(st: Battle, index: number): Ship {
  const found = st.ships[index];
  if (!found) throw new RangeError(`no ship ${index}`);
  return found;
}

// --- who holds a ship ----------------------------------------------------------------------

/** The ship whose flag she now flies: her captor if she was taken, else herself. */
export const capship = (st: Battle, sp: Ship): Ship =>
  sp.captured >= 0 ? ship(st, sp.captured) : sp;
export const sideOf = (st: Battle, sp: Ship): Nation => capship(st, sp).nation;
export const friends = (st: Battle, a: Ship, b: Ship): boolean => sideOf(st, a) === sideOf(st, b);
/** Still fighting: on the chart and her flag still flying. */
export const isActive = (sp: Ship): boolean => sp.dir !== 0 && !sp.struck;

export const crewOf = (sp: Ship): number => sp.specs.crew1 + sp.specs.crew2 + sp.specs.crew3;
export const isDismasted = (sp: Ship): boolean =>
  sp.specs.rig1 <= 0 && sp.specs.rig2 <= 0 && sp.specs.rig3 <= 0 && sp.specs.rig4 <= 0;

// --- grapples and fouls (sail/extern.h:67-69, sail/sync.c:323-366) ------------------------

export const grappled2 = (a: Ship, b: Ship): number => a.grap[b.index]!.count;
export const fouled2 = (a: Ship, b: Ship): number => a.foul[b.index]!.count;
export const snagged = (sp: Ship): number => sp.ngrap + sp.nfoul;
export const snagged2 = (a: Ship, b: Ship): number => grappled2(a, b) + fouled2(a, b);

/** The "X" counts: only snags older than one turn, so boarders cannot cross at once. */
export function oldSnags(st: Battle, a: Ship, b: Ship): number {
  const g = a.grap[b.index]!;
  const f = a.foul[b.index]!;
  return (g.turn < st.turn - 1 ? g.count : 0) + (f.turn < st.turn - 1 ? f.count : 0);
}

export function addFoul(st: Battle, sp: Ship, other: Ship): void {
  if (other.dir === 0) return;
  const snag = sp.foul[other.index]!;
  if (snag.count++ === 0) snag.turn = st.turn;
  sp.nfoul++;
}

export function addGrapple(st: Battle, sp: Ship, other: Ship): void {
  if (other.dir === 0) return;
  const snag = sp.grap[other.index]!;
  if (snag.count++ === 0) snag.turn = st.turn;
  sp.ngrap++;
}

function removeSnag(sp: Ship, kind: 'grap' | 'foul', other: Ship, all: boolean): void {
  const snag = sp[kind][other.index]!;
  if (snag.count <= 0) return;
  const removed = all ? snag.count : 1;
  snag.count -= removed;
  if (kind === 'grap') sp.ngrap -= removed;
  else sp.nfoul -= removed;
}

/** flag 1 grapples, 2 fouls, 3 both. Once two ships part, their boarders come home. */
export function cleanSnag(from: Ship, to: Ship, all: boolean, flag: number): void {
  if (flag & 1) {
    removeSnag(from, 'grap', to, all);
    removeSnag(to, 'grap', from, all);
  }
  if (flag & 2) {
    removeSnag(from, 'foul', to, all);
    removeSnag(to, 'foul', from, all);
  }
  if (snagged2(from, to)) return;
  for (const [a, b] of [
    [from, to],
    [to, from],
  ] as const) {
    if (!snagged(a)) {
      unboard(a, a, true);
      unboard(a, a, false);
    } else unboard(a, b, false);
  }
}

// --- boarding parties (sail/parties.c) ---------------------------------------------------

export const meleeing = (from: Ship, to: Ship): boolean =>
  from.OBP.some((p) => p.turnsent > 0 && p.toship === to.index);

export function unboard(sp: Ship, to: Ship, defence: boolean): void {
  const parties = defence ? sp.DBP : sp.OBP;
  for (let n = 0; n < PARTY_SLOTS; n++) {
    const p = parties[n]!;
    if (p.turnsent && (p.toship === to.index || defence || sp === to)) parties[n] = freeParty();
  }
}

/**
 * Crew sections still aboard and free (not away in a party), as 0 or 1 flags. Sections with
 * no hands left count as absent. sail/pl_3.c:60-75.
 */
export function freeSections(sp: Ship): [number, number, number] {
  let men = 0;
  for (const p of sp.OBP) if (p.turnsent) men += p.mensent;
  for (const p of sp.DBP) if (p.turnsent) men += p.mensent;
  const c = [sp.specs.crew1, sp.specs.crew2, sp.specs.crew3];
  const has = (k: number) => (c[k] !== 0 ? 1 : 0);
  if (!men) return [has(0), has(1), has(2)];
  return [
    Math.trunc(men / 100) ? 0 : has(0),
    Math.trunc((men % 100) / 10) ? 0 : has(1),
    men % 10 ? 0 : has(2),
  ];
}
