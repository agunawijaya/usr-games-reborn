import { compassTo, gunsBear, hitsStarboard, range } from './geometry';
import {
  capship,
  cleanSnag,
  type Ctx,
  dieroll,
  emit,
  freeSections,
  snagged,
  unboard,
} from './state';
import { AMMO, HIT_BY_RANGE, HIT_BY_RANGE_RAKING, HULL_TABLE, QUALITY, RIG_TABLE } from './tables';
import {
  type Battle,
  CHAIN,
  type Condition,
  type Damage,
  DOUBLE,
  EMPTY,
  EXPLODE,
  GRAPE,
  type Load,
  R_EMPTY,
  R_INITIAL,
  R_LOADED,
  ROUND,
  SHOT_RANGE,
  type Ship,
} from './types';

/**
 * Gunnery and damage, ported from sail/pl_3.c:46-217 (the player's broadside), sail/dr_1.c:268-398
 * (the computer's), sail/assorted.c:47-287 (the damage table and striking) and sail/dr_2.c:88-117
 * (burning and sinking hulks).
 */

/** The closest ship a battery bears on; `anyShip` includes friends, as a real broadside would. */
export function closestShip(
  st: Battle,
  from: Ship,
  side: 'L' | 'R' | null,
  anyShip: boolean,
): Ship | null {
  const ours = capship(st, from).nation;
  let best: Ship | null = null;
  let bestRange = 30000;
  for (const sp of st.ships) {
    if (sp === from || sp.dir === 0) continue;
    if (!anyShip && ours === capship(st, sp).nation) continue;
    if (side && gunsBear(from, sp) !== side) continue;
    const r = range(from, sp);
    if (r < bestRange) {
      best = sp;
      bestRange = r;
    }
  }
  return best;
}

/** Heavy seas spoil the aim, by class; ships of the line shut their lower ports. */
export function heavySeasPenalty(cls: number, windspeed: number): number {
  let p = 0;
  if ((cls >= 5 || cls === 1) && windspeed === 5) p--;
  if (windspeed === 6 && cls === 4) p -= 2;
  if (windspeed === 6 && cls <= 3) p--;
  return p;
}

export const lowerPortsShut = (cls: number, windspeed: number): boolean =>
  cls <= 2 && heavySeasPenalty(cls, windspeed) < 0;

/** A rake: our guns bear on her but hers cannot bear on us. From astern, it hits hardest. */
export function rakeOf(from: Ship, to: Ship): { rake: boolean; sternRake: boolean } {
  const rake = gunsBear(from, to) !== null && gunsBear(to, from) === null;
  let a = compassTo(to, from) - to.dir + 1;
  if (a < 1) a += 8;
  else if (a > 8) a -= 8;
  return { rake, sternRake: rake && a > 4 && a < 6 };
}

export interface HitReckoning {
  hit: number;
  /** The row of the tables, by the size of the broadside. */
  row: number;
  range: number;
  rake: boolean;
  sternRake: boolean;
  /** Every modifier that went into `hit`, for the orders panel. */
  parts: { label: HitPart; amount: number }[];
}

export type HitPart =
  | 'range'
  | 'rake'
  | 'stern-rake'
  | 'crew-quality'
  | 'section-away'
  | 'first-broadside'
  | 'prize-crew'
  | 'shot'
  | 'heavy-seas';

/** The hits a broadside will do before the die is rolled. Shared by player and computer. */
export function reckonHit(
  st: Battle,
  sp: Ship,
  target: Ship,
  o: { guns: number; car: number; load: Load; ready: number; crew: readonly number[] },
): HitReckoning {
  const r = range(sp, target);
  const { rake, sternRake } = rakeOf(sp, target);
  let index = o.guns;
  if (r < 3) index += o.car;
  index = Math.min(8, Math.trunc((index - 1) / 3));
  const row = Math.max(0, index);
  const parts: HitReckoning['parts'] = [];
  let hit = (rake ? HIT_BY_RANGE_RAKING : HIT_BY_RANGE)[row]![Math.max(1, Math.min(10, r)) - 1]!;
  parts.push({ label: rake ? 'rake' : 'range', amount: hit });
  if (sternRake) {
    hit++;
    parts.push({ label: 'stern-rake', amount: 1 });
  }
  const q = QUALITY[row]![capship(st, sp).specs.qual - 1] ?? 0;
  hit += q;
  if (q) parts.push({ label: 'crew-quality', amount: q });
  if (sp.captured < 0) {
    for (let n = 0; n < 3; n++) {
      if (o.crew[n]) continue;
      const d = index <= 5 ? 1 : 2;
      hit -= d;
      parts.push({ label: 'section-away', amount: -d });
    }
  }
  if (o.ready & R_INITIAL) {
    const d = index <= 3 ? 1 : 2;
    hit += d;
    parts.push({ label: 'first-broadside', amount: d });
  }
  if (sp.captured >= 0) {
    const d = index <= 1 ? 1 : 2;
    hit -= d;
    parts.push({ label: 'prize-crew', amount: -d });
  }
  const a = o.load >= GRAPE && o.load <= DOUBLE ? AMMO[row]![o.load - 1]! : 0;
  hit += a;
  if (a) parts.push({ label: 'shot', amount: a });
  const seas = heavySeasPenalty(sp.specs.cls, st.windspeed);
  hit += seas;
  if (seas) parts.push({ label: 'heavy-seas', amount: seas });
  return { hit, row: index, range: r, rake, sternRake, parts };
}

const conditionOf = (sp: Ship): Condition => ({
  hull: sp.specs.hull,
  crew: [sp.specs.crew1, sp.specs.crew2, sp.specs.crew3],
  rig: [sp.specs.rig1, sp.specs.rig2, sp.specs.rig3, sp.specs.rig4],
  gunL: sp.specs.gunL,
  gunR: sp.specs.gunR,
  carL: sp.specs.carL,
  carR: sp.specs.carR,
  pcrew: sp.pcrew,
});

/** Take hits off a list of sections in order, the way shot and melee both do. */
function takeInOrder(values: number[], hits: number, count = values.length): number {
  for (let n = 0; n < count; n++) {
    if (hits > values[n]!) {
      hits -= values[n]!;
      values[n] = 0;
    } else {
      values[n] = values[n]! - hits;
      hits = 0;
    }
  }
  return hits;
}

/** One broadside's damage to `on` (sail/assorted.c:47-237). */
export function applyHits(
  ctx: Ctx,
  from: Ship,
  on: Ship,
  aim: 'hull' | 'rigging',
  shot: Load,
  hittable: number,
  roll: number,
): Damage {
  const s = on.specs;
  const before = conditionOf(on);
  let crewHits: number;
  let gunHits = 0;
  let hullHits = 0;
  let rigHits = 0;
  if (shot === GRAPE) {
    crewHits = hittable;
  } else {
    const h = Math.max(0, Math.min(10, hittable));
    const [H, G, C, R] = (aim === 'rigging' ? RIG_TABLE : HULL_TABLE)[h]![roll - 1]!;
    crewHits = C!;
    rigHits = R!;
    hullHits = H!;
    gunHits = G!;
    if (shot === CHAIN) {
      gunHits = 0;
      hullHits = 0;
    }
  }
  const table = { hull: hullHits, guns: gunHits, crew: crewHits, rig: rigHits };
  // Under full sails twice the canvas is aloft to be torn.
  let rhits = on.FS ? rigHits * 2 : rigHits;
  let chits = crewHits;
  let pc = on.pcrew;
  if (on.captured >= 0) {
    pc -= Math.trunc((chits + 1) / 2);
    chits = Math.trunc(chits / 2);
  }
  const crew = [s.crew1, s.crew2, s.crew3];
  takeInOrder(crew, chits);
  const rig = [s.rig1, s.rig2, s.rig3, s.rig4];
  rhits = takeInOrder(rig, rhits, 3);
  if (rig[3] !== -1) {
    if (rhits > rig[3]!) rig[3] = 0;
    else rig[3] = rig[3]! - rhits;
  }
  const dismasted = aim === 'rigging' && !rig[2] && (!rig[3] || rig[3] === -1);
  const starboard = hitsStarboard(from, on);
  const battery = [starboard ? s.carR : s.carL, starboard ? s.gunR : s.gunL];
  const left = takeInOrder(battery, gunHits);
  let hull = s.hull - left - hullHits;
  hull = Math.max(0, hull);
  if (gunHits) {
    if (starboard) [s.carR, s.gunR] = [battery[0]!, battery[1]!];
    else [s.carL, s.gunL] = [battery[0]!, battery[1]!];
  }
  if (on.captured >= 0 && crewHits) on.pcrew = Math.max(0, pc);
  if (hullHits) s.hull = hull;
  if (crewHits) [s.crew1, s.crew2, s.crew3] = [crew[0]!, crew[1]!, crew[2]!];
  if (rigHits) [s.rig1, s.rig2, s.rig3, s.rig4] = [rig[0]!, rig[1]!, rig[2]!, rig[3]!];
  let special: string | null = null;
  let rudder = false;
  if (roll === 6) {
    special = aim === 'rigging' ? `rig-${rigHits}` : `hull-${hullHits}`;
    // A six on the hull table with five hull hits shoots away the steering: no more turning.
    if (aim === 'hull' && hullHits === 5) {
      s.ta = 0;
      rudder = true;
    }
  }
  const damage: Damage = {
    before,
    after: conditionOf(on),
    hits: table,
    dismasted,
    rudder,
    special,
    struck: null,
  };
  if (!hull) damage.struck = strike(ctx, on, from, false);
  return damage;
}

/**
 * A ship strikes her colours (sail/assorted.c:264-287). Beaten to a hulk, one in three starts
 * to sink and one in three catches fire. A ship that yields with her hull sound does neither:
 * that is Figurehead's rule, so a ship taken whole can be brought home whole.
 */
export function strike(ctx: Ctx, sp: Ship, by: Ship, yielded: boolean): Damage['struck'] {
  if (sp.struck) return null;
  sp.struck = true;
  sp.yielded = yielded;
  by.points += sp.specs.pts;
  unboard(sp, sp, false);
  unboard(sp, sp, true);
  let fate: 'sink' | 'fire' | null = null;
  if (!yielded) {
    const roll = dieroll(ctx);
    if (roll === 3 || roll === 4) {
      sp.sink = 1;
      fate = 'sink';
    } else if (roll >= 5) {
      sp.explode = 1;
      fate = 'fire';
    }
  }
  emit(ctx, { t: 'strike', ship: sp.index, by: by.index, fate, yielded });
  return fate ?? 'struck';
}

function broadside(
  ctx: Ctx,
  sp: Ship,
  side: 'L' | 'R',
  o: { target: Ship; load: Load; aim: 'hull' | 'rigging'; human: boolean; crew: readonly number[] },
): void {
  const ready = side === 'R' ? sp.readyR : sp.readyL;
  const guns = side === 'R' ? sp.specs.gunR : sp.specs.gunL;
  const car = side === 'R' ? sp.specs.carR : sp.specs.carL;
  const h = reckonHit(ctx.st, sp, o.target, { guns, car, load: o.load, ready, crew: o.crew });
  if (!o.human && ready & R_INITIAL) {
    if (side === 'R') sp.readyR &= ~R_INITIAL;
    else sp.readyL &= ~R_INITIAL;
  }
  let roll: number | null = null;
  let damage: Damage | null = null;
  if (h.hit >= 0) {
    roll = dieroll(ctx);
    const hit = o.load === GRAPE ? h.hit : Math.min(10, h.hit);
    damage = applyHits(ctx, sp, o.target, o.aim, o.load, hit, roll);
  }
  emit(ctx, {
    t: 'fire',
    from: sp.index,
    to: o.target.index,
    side,
    load: o.load,
    aim: o.aim,
    range: h.range,
    rake: h.rake,
    sternRake: h.sternRake,
    hit: h.hit,
    initial: Boolean(ready & R_INITIAL),
    roll,
    damage,
  });
}

export type FireOption =
  | {
      ok: false;
      why: 'not-loaded' | 'no-gun-crews' | 'nothing-bears' | 'out-of-range' | 'struck';
      target?: number;
      range?: number;
    }
  | {
      ok: true;
      target: number;
      range: number;
      /** Hull shots need round or double shot and a range under six; otherwise rigging. */
      canAimHull: boolean;
      reckoning: HitReckoning;
      friendly: boolean;
    };

/** Can this battery fire now, and at whom? The orders panel previews it before the player commits. */
export function fireOption(st: Battle, sp: Ship, side: 'L' | 'R'): FireOption {
  const load = side === 'R' ? sp.loadR : sp.loadL;
  const ready = side === 'R' ? sp.readyR : sp.readyL;
  const guns = side === 'R' ? sp.specs.gunR : sp.specs.gunL;
  const car = side === 'R' ? sp.specs.carR : sp.specs.carL;
  const crew = freeSections(sp);
  if ((!guns && !car) || load === EMPTY || (ready & R_LOADED) === 0)
    return { ok: false, why: 'not-loaded' };
  if (sp.struck || !crew[2]) return { ok: false, why: 'no-gun-crews' };
  const target = closestShip(st, sp, side, true);
  if (!target) return { ok: false, why: 'nothing-bears' };
  const r = range(sp, target);
  if (target.struck) return { ok: false, why: 'struck', target: target.index, range: r };
  if (r > SHOT_RANGE[load]! || (!guns && r >= 3)) {
    return { ok: false, why: 'out-of-range', target: target.index, range: r };
  }
  return {
    ok: true,
    target: target.index,
    range: r,
    canAimHull: load > CHAIN && r < 6,
    reckoning: reckonHit(st, sp, target, { guns, car, load, ready, crew }),
    friendly: capship(st, target).nation === capship(st, sp).nation,
  };
}

/** The player's broadside (sail/pl_3.c:46-217): fired, the battery stands empty. */
export function playerFire(ctx: Ctx, sp: Ship, side: 'L' | 'R', aim: 'hull' | 'rigging'): boolean {
  const option = fireOption(ctx.st, sp, side);
  if (!option.ok) {
    emit(ctx, { t: 'note', ship: sp.index, note: 'cannot-fire' });
    return false;
  }
  const load = side === 'R' ? sp.loadR : sp.loadL;
  const target = ctx.st.ships[option.target]!;
  broadside(ctx, sp, side, {
    target,
    load,
    aim: option.canAimHull && aim === 'hull' ? 'hull' : 'rigging',
    human: true,
    crew: freeSections(sp),
  });
  if (side === 'R') {
    sp.loadR = EMPTY;
    sp.readyR = R_EMPTY;
  } else {
    sp.loadL = EMPTY;
    sp.readyL = R_EMPTY;
  }
  return true;
}

/**
 * The computer captains' gunnery (sail/dr_1.c:268-398). They never unload: their guns are
 * always ready, double shot alongside, chain at a ship under full sail, grape when boarding.
 * Merchantmen and ships at anchor only fire at what comes close.
 */
export function computerGunnery(ctx: Ctx): void {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.role === 'human' || sp.dir === 0 || sp.struck) continue;
    const crew = freeSections(sp);
    if (!crew[2]) continue;
    for (const side of ['L', 'R'] as const) {
      const ready = side === 'R' ? sp.readyR : sp.readyL;
      const guns = side === 'R' ? sp.specs.gunR : sp.specs.gunL;
      const car = side === 'R' ? sp.specs.carR : sp.specs.carL;
      if ((!guns && !car) || (ready & R_LOADED) === 0) continue;
      const enemy = closestShip(st, sp, side, false);
      if (!enemy) continue;
      const nearest = closestShip(st, sp, side, true);
      // A friend in the line of fire holds the battery.
      if (nearest && range(enemy, sp) > range(sp, nearest)) continue;
      if (enemy.struck) continue;
      const r = range(sp, enemy);
      if (r > 10 || (!guns && r >= 3)) continue;
      if ((sp.role === 'merchant' || sp.role === 'flee') && r > 4) continue;
      let load: Load = ROUND;
      if (r === 1 && sp.loadwith === GRAPE) load = GRAPE;
      if (r <= 3 && enemy.FS) load = CHAIN;
      if (r === 1 && load !== GRAPE) load = DOUBLE;
      const aim = load > CHAIN && r < 6 ? 'hull' : 'rigging';
      broadside(ctx, sp, side, { target: enemy, load, aim, human: false, crew });
    }
  }
}

/** Burning and sinking hulks go on a five or six; a burning one blows up (sail/dr_2.c:88-117). */
export function burnAndSink(ctx: Ctx): void {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.dir === 0 || (sp.explode !== 1 && sp.sink !== 1)) continue;
    if (dieroll(ctx) < 5) continue;
    const sinking = sp.sink === 1;
    if (sinking) sp.sink = 2;
    else sp.explode = 2;
    const where = { row: sp.row, col: sp.col, dir: sp.dir };
    sp.dir = 0;
    if (snagged(sp)) for (const sq of st.ships) cleanSnag(sp, sq, true, 3);
    if (sinking) {
      emit(ctx, { t: 'sink', ship: sp.index, ...where });
      continue;
    }
    emit(ctx, { t: 'explode', ship: sp.index, ...where });
    for (const sq of st.ships) {
      // The original measures from the wreck as a single square: her heading is already gone.
      if (sp === sq || !sq.dir || range({ row: where.row, col: where.col, dir: 0 }, sq) >= 4)
        continue;
      const damage = applyHits(ctx, sp, sq, 'rigging', EXPLODE, Math.trunc(sp.specs.guns / 13), 6);
      emit(ctx, { t: 'blast', from: sp.index, to: sq.index, damage });
    }
  }
}
