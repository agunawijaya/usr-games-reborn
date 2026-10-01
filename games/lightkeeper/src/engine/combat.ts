import type { FlareEnd } from './beats';
import { type Ctx, emit, franf, lose, ranf, win } from './context';
import { harbourLost, stopGleaner, worldDestroyed } from './losses';
import { SYSTEM_ORDER } from './params';
import { damage, isDown } from './schedule';
import { BEAM_BANKS, type GleanerInZone, type Point, ZONE_CAPACITY, ZONE_SIZE } from './types';
import {
  cellAt,
  here,
  insideReach,
  insideZone,
  measureGleaners,
  rememberZone,
  setCell,
  zoneAt,
} from './zone';

/**
 * Fighting, rule for rule from the 1976 program: the gleaners' volley and their dance around
 * it, the six beam banks, flares and the novas they can set off, and a dying star taking a
 * whole zone with it.
 */

// The beam formula's constants, as the original named and tuned them.
const ALPHA = 3.0;
const BETA = 3.0;
const GAMMA = 0.3;
const EPSILON = 150.0;
const OMEGA = 10.596;

/** The bearing from the ship to a cell, in radians clockwise from north. */
export function bearingTo(from: Point, to: Point): number {
  return Math.atan2(to.col - from.col, from.row - to.row);
}

/** The gleaners' answer to an order: move, fire, tire, move again. */
export function gleanersAttack(ctx: Ctx, resting: boolean) {
  const { s } = ctx;
  if (ctx.order.free) return;
  if (s.override || s.gleaners.length <= 0 || here(s).stars < 0) return;
  if (s.ship.shrouded && s.ship.shroudSettled) return;
  moveGleaners(ctx, 0);
  if (s.ship.condition === 'moored') {
    if (!resting) emit(ctx, { type: 'harbour-shelters' });
    return;
  }
  const { ship, params } = s;
  const shieldEffect = ctx.order.shieldChanged ? 0.25 + 0.5 * franf(ctx) : 1;
  let biggest = 0;
  let total = 0;
  for (const gleaner of s.gleaners) {
    // A gleaner nearly out of charge holds its fire.
    if (gleaner.power < 20) continue;
    const dust = 0.9 + 0.01 * franf(ctx);
    let hit = Math.trunc(gleaner.power * dust ** gleaner.avgDist * params.hitFactor);
    gleaner.power = Math.trunc(
      gleaner.power * params.gleanerFatigue * (1 + (franf(ctx) - 0.5) * 0.2),
    );
    let absorbed = 0;
    if (ship.shieldUp || ctx.order.shieldChanged) {
      absorbed = Math.trunc((ship.shield / params.shield) * shieldEffect * hit);
      absorbed = Math.min(absorbed, ship.shield);
      ship.shield -= absorbed;
    }
    emit(ctx, { type: 'shot', from: { row: gleaner.row, col: gleaner.col }, hit, absorbed });
    hit -= absorbed;
    total += hit;
    biggest = Math.max(biggest, hit);
    ship.energy -= hit;
    if (hit >= (15 - params.skill) * (25 - ranf(ctx, 12))) criticalHit(ctx, hit);
    if (ship.energy <= 0) lose(ctx, 'lantern-disabled');
  }
  if (biggest >= 200 || total >= 500) {
    const injured = Math.trunc(total * 0.015 * franf(ctx));
    if (injured >= 2) {
      s.tally.injured += injured;
      ship.crew -= injured;
      emit(ctx, { type: 'injured', count: injured });
    }
  }
  moveGleaners(ctx, 1);
}

function criticalHit(ctx: Ctx, hit: number) {
  const { s } = ctx;
  let pick = ranf(ctx, 1000);
  let index = 0;
  for (; pick >= 0; index++) pick -= s.params.damageOdds[SYSTEM_ORDER[index]!];
  const system = SYSTEM_ORDER[index - 1]!;
  const days = (hit * s.params.damageFactor) / (75 + ranf(ctx, 25)) + 0.5;
  emit(ctx, { type: 'critical', system, days });
  damage(ctx, system, days);
  if (isDown(ctx, 'shield')) {
    if (s.ship.shieldUp) emit(ctx, { type: 'shield-knocked-down' });
    s.ship.shieldUp = false;
    ctx.order.shieldChanged = false;
  }
}

/**
 * The original's `klmove`, described there as largely incomprehensible and kept faithful
 * here, quirks included: gleaners close in before they fire and drift off after, tired ones
 * are the likeliest to drift, and one that walks off the edge slips into the neighbouring zone.
 */
export function moveGleaners(ctx: Ctx, afterFire: 0 | 1) {
  const { s } = ctx;
  const slot = 2 * ctx.order.zoneMoment + afterFire;
  for (let n = 0; n < s.gleaners.length; n++) {
    const gleaner = s.gleaners[n]!;
    const odds = afterFire ? Math.trunc((100 * gleaner.power) / s.params.gleanerPower) : 100;
    if (ranf(ctx, odds) >= s.params.moveChance[slot]!) continue;
    let motion = Math.trunc((ranf(ctx, 75) - 25) * gleaner.avgDist * s.params.moveFactor[slot]!);
    let dRow = s.ship.cell.row - gleaner.row + ranf(ctx, 3) - 1;
    let dCol = s.ship.cell.col - gleaner.col + ranf(ctx, 3) - 1;
    // The original took the signed larger step, not the absolute one; that quirk shapes the dance.
    let bigger = dRow;
    if (dCol > bigger) bigger = dCol;
    if (bigger === 0) bigger = 1;
    dRow = dRow / bigger + 0.5;
    dCol = dCol / bigger + 0.5;
    if (motion < 0) {
      motion = -motion;
      dRow = -dRow;
      dCol = -dCol;
    }
    stepGleaner(ctx, n, gleaner, motion, dRow, dCol);
  }
  measureGleaners(s, false);
}

function stepGleaner(
  ctx: Ctx,
  index: number,
  gleaner: GleanerInZone,
  motion: number,
  dRow: number,
  dCol: number,
): 'stayed' | 'moved' | 'left' {
  const { s } = ctx;
  let nudgeRow = 1;
  const nudgeCol = 1;
  let nextRow = gleaner.row;
  let nextCol = gleaner.col;
  for (; motion > 0; motion--) {
    let lookRow = Math.trunc(nextRow + dRow);
    let lookCol = Math.trunc(nextCol + dCol);
    if (!insideZone(lookRow, lookCol)) {
      return slipAway(ctx, index, gleaner, lookRow, lookCol) ? 'left' : settle();
    }
    if (s.cells[lookRow]![lookCol] !== 'empty') {
      lookRow = nextRow + nudgeRow;
      if (lookRow < 0 || lookRow >= ZONE_SIZE) lookRow = Math.trunc(nextRow + dRow);
      if (s.cells[lookRow]![lookCol] !== 'empty') {
        nudgeRow = -nudgeRow;
        lookCol = nextCol + nudgeCol;
        if (lookCol < 0 || lookCol >= ZONE_SIZE || s.cells[lookRow]![lookCol] !== 'empty') {
          break;
        }
      }
    }
    nextRow = lookRow;
    nextCol = lookCol;
  }
  return settle();

  function settle(): 'stayed' | 'moved' {
    if (gleaner.row === nextRow && gleaner.col === nextCol) return 'stayed';
    const from = { row: gleaner.row, col: gleaner.col };
    setCell(s, from, 'empty');
    gleaner.row = nextRow;
    gleaner.col = nextCol;
    setCell(s, gleaner, 'gleaner');
    emit(ctx, { type: 'gleaner-moved', from, to: { row: nextRow, col: nextCol } });
    return 'moved';
  }
}

/** A gleaner leaving the ship's zone over its edge, if the neighbour has room. */
function slipAway(
  ctx: Ctx,
  index: number,
  gleaner: GleanerInZone,
  lookRow: number,
  lookCol: number,
): boolean {
  const { s } = ctx;
  let row = s.ship.zone.row;
  let col = s.ship.zone.col;
  if (lookRow < 0) row -= 1;
  else if (lookRow >= ZONE_SIZE) row += 1;
  if (lookCol < 0) col -= 1;
  else if (lookCol >= ZONE_SIZE) col += 1;
  if (!insideReach(row, col)) return false;
  const target = zoneAt(s, { row, col });
  if (target.stars < 0 || target.gleaners > ZONE_CAPACITY - 1) return false;
  setCell(s, gleaner, 'empty');
  target.gleaners += 1;
  here(s).gleaners -= 1;
  // The original moved the last gleaner into the leaver's slot, so that one skips its turn.
  s.gleaners[index] = s.gleaners[s.gleaners.length - 1]!;
  s.gleaners.pop();
  if (!isDown(ctx, 'near-sensors')) {
    if (target.seen) rememberZone(s, target);
  }
  emit(ctx, {
    type: 'gleaner-left',
    from: { row: gleaner.row, col: gleaner.col },
    toZone: { row, col },
  });
  return true;
}

export interface Bank {
  units: number;
  /** Radians clockwise from north. */
  angle: number;
  /** 0 pours a bank through every gleaner nearest first; 1 focuses it along its bearing. */
  spread: number;
}

/** The energy each gleaner needs, by the original's own estimate, to be stopped by a bank. */
export function energyNeeded(gleaner: GleanerInZone): number {
  const effect = ((ALPHA * BETA * OMEGA) / (gleaner.dist * gleaner.dist + EPSILON)) * GAMMA;
  return Math.trunc(gleaner.power / effect + 0.5);
}

/** The original's automatic mode: shares weighted to the nearest, capped at what each needs. */
export function automaticBanks(
  s: { gleaners: GleanerInZone[]; ship: { cell: Point } },
  energy: number,
): { banks: Bank[]; overkill: number } {
  const n = Math.min(s.gleaners.length, BEAM_BANKS);
  const total = (n * (n + 1)) / 2;
  let extra = energy;
  const banks: Bank[] = [];
  const needed: number[] = [];
  for (let i = 0; i < n; i++) {
    const gleaner = s.gleaners[i]!;
    needed[i] = energyNeeded(gleaner);
    const bank: Bank = {
      units: Math.trunc(((n - i) / total) * extra),
      angle: bearingTo(s.ship.cell, gleaner),
      spread: 0,
    };
    extra -= bank.units;
    const surplus = bank.units - needed[i]!;
    if (surplus > 0) {
      extra += surplus;
      bank.units -= surplus;
    }
    banks.push(bank);
  }
  for (let i = 0; i < n && extra > 0; i++) {
    const short = needed[i]! - banks[i]!.units;
    if (short <= 0) continue;
    const give = Math.min(short, extra);
    banks[i]!.units += give;
    extra -= give;
  }
  return { banks, overkill: extra };
}

export function fireBanks(ctx: Ctx, banks: readonly Bank[], alreadyWasted: number) {
  const { s } = ctx;
  ctx.order.free = false;
  let wasted = alreadyWasted;
  banks.forEach((source, bankIndex) => {
    const bank = { ...source };
    if (bank.units <= 0) return;
    const count = s.gleaners.length;
    let k = 0;
    for (let j = 0; j < count; j++) {
      if (bank.units <= 0) break;
      const gleaner = s.gleaners[k];
      if (!gleaner) break;
      let reach = (BETA + franf(ctx)) * (ALPHA + bank.spread) * OMEGA;
      reach /= gleaner.dist * gleaner.dist + EPSILON;
      reach *= bank.units;
      const aim = Math.cos((bearingTo(s.ship.cell, gleaner) - bank.angle) * bank.spread + GAMMA);
      if (aim < 0) {
        k++;
        continue;
      }
      const hit = Math.trunc(aim * reach + 0.5);
      gleaner.power -= hit;
      const target = { row: gleaner.row, col: gleaner.col };
      emit(ctx, { type: 'beam', bank: bankIndex, target, hit });
      bank.units -= hit;
      if (gleaner.power <= 0) {
        stopGleaner(ctx, target, 'beams');
        continue;
      }
      k++;
    }
    wasted += Math.max(0, bank.units);
  });
  if (wasted > 0) emit(ctx, { type: 'beams-wasted', energy: wasted });
}

/** How far a flare strays from its bearing, in degrees, and whether the tube misfired. */
function flareScatter(ctx: Ctx): { degrees: number; misfire: boolean } {
  const { ship, params } = ctx.s;
  let degrees = Math.trunc((franf(ctx) + franf(ctx) - 1) * 20);
  let misfire = false;
  if (Math.abs(degrees) > 12) {
    misfire = true;
    if (ranf(ctx, 2)) damage(ctx, 'flare-tubes', 0.2 * Math.abs(degrees) * (franf(ctx) + 1));
    degrees = Math.trunc(degrees * (1 + 2 * franf(ctx)));
  }
  if (ship.shieldUp || ship.condition === 'moored') {
    const widen = ship.condition === 'moored' ? 2 : 1 + ship.shield / params.shield;
    degrees = Math.trunc(degrees * widen);
  }
  return { degrees, misfire };
}

/** Walks a flare cell by cell from the ship along a bearing in degrees. */
export function flarePath(
  from: Point,
  bearing: number,
  occupied: (at: Point) => string,
): { path: Point[]; end: FlareEnd | 'lantern'; at: Point | null } {
  const angle = (bearing * Math.PI) / 180;
  let dRow = -Math.cos(angle);
  let dCol = Math.sin(angle);
  const bigger = Math.max(Math.abs(dRow), Math.abs(dCol));
  dRow /= bigger;
  dCol /= bigger;
  let row = from.row + 0.5;
  let col = from.col + 0.5;
  const path: Point[] = [];
  for (;;) {
    row += dRow;
    col += dCol;
    if (row < 0 || row >= ZONE_SIZE || col < 0 || col >= ZONE_SIZE) {
      return { path, end: 'missed', at: null };
    }
    const at = { row: Math.trunc(row), col: Math.trunc(col) };
    path.push(at);
    const content = occupied(at);
    if (content === 'empty') continue;
    return { path, end: content as FlareEnd, at };
  }
}

export function fireFlares(ctx: Ctx, bearing: number, burstAngle: number) {
  const { s } = ctx;
  const burst = burstAngle > 0 && s.ship.flares >= 3;
  let course = burst ? bearing - burstAngle : bearing;
  const shots = burst ? 3 : 1;
  for (let index = 0; index < shots; index++) {
    const scatter = flareScatter(ctx);
    if (s.ship.condition !== 'moored') s.ship.flares -= 1;
    const flight = flarePath(s.ship.cell, course + scatter.degrees, (at) => cellAt(s, at));
    const end: FlareEnd = flight.end === 'lantern' ? 'missed' : flight.end;
    emit(ctx, {
      type: 'flare',
      path: flight.path,
      end,
      at: flight.at,
      misfire: scatter.misfire,
      index,
    });
    if (flight.at) flareStrikes(ctx, flight.at, end);
    if (isDown(ctx, 'flare-tubes') || here(s).stars < 0) break;
    course += burstAngle;
  }
  ctx.order.free = false;
}

function flareStrikes(ctx: Ctx, at: Point, end: FlareEnd) {
  const { s } = ctx;
  switch (end) {
    case 'gleaner': {
      const gleaner = s.gleaners.find((g) => g.row === at.row && g.col === at.col);
      if (!gleaner) return;
      const damageDone = 500 + ranf(ctx, 501);
      gleaner.power -= damageDone;
      if (gleaner.power > 0) emit(ctx, { type: 'gleaner-hit', at: { ...at }, damage: damageDone });
      else stopGleaner(ctx, at, 'flare');
      return;
    }
    case 'star':
      nova(ctx, at);
      return;
    case 'world':
      worldDestroyed(ctx, s.ship.zone, true, at);
      return;
    case 'harbour':
      harbourLost(ctx, s.ship.zone, true);
      return;
    default:
  }
}

/** A star struck by a flare: it may hold, flare up, leave a black hole, or die outright. */
export function nova(ctx: Ctx, at: Point) {
  const { s } = ctx;
  const zone = here(s);
  if (cellAt(s, at) !== 'star' || zone.stars < 0) return;
  if (ranf(ctx, 100) < 15) {
    emit(ctx, { type: 'nova-fizzled', at: { ...at } });
    return;
  }
  if (ranf(ctx, 100) < 5) {
    collapse(ctx, at);
    return;
  }
  const leftHole = ranf(ctx, 4) === 0;
  setCell(s, at, leftHole ? 'hole' : 'empty');
  if (zone.layout) {
    zone.layout.stars = zone.layout.stars.filter((p) => p.row !== at.row || p.col !== at.col);
    if (leftHole) zone.layout.holes.push({ ...at });
  }
  if (leftHole) zone.holes += 1;
  zone.stars -= 1;
  s.tally.starsLost += 1;
  s.tally.novas += 1;
  emit(ctx, { type: 'nova', at: { ...at }, leftHole });
  for (let row = at.row - 1; row <= at.row + 1; row++) {
    for (let col = at.col - 1; col <= at.col + 1; col++) {
      if (!insideZone(row, col)) continue;
      novaReaches(ctx, { row, col });
    }
  }
}

function novaReaches(ctx: Ctx, at: Point) {
  const { s } = ctx;
  switch (cellAt(s, at)) {
    case 'gleaner':
      stopGleaner(ctx, at, 'nova');
      return;
    case 'star':
      nova(ctx, at);
      return;
    case 'world':
      worldDestroyed(ctx, s.ship.zone, true, at);
      return;
    case 'harbour':
      harbourLost(ctx, s.ship.zone, true);
      return;
    case 'lantern':
    case 'ember': {
      let scorch = 2000;
      if (s.ship.shieldUp) {
        const taken = Math.min(s.ship.shield, scorch);
        s.ship.shield -= taken;
        scorch -= taken;
      }
      s.ship.energy -= scorch;
      emit(ctx, { type: 'nova-scorch', damage: scorch });
      if (s.ship.energy <= 0) lose(ctx, 'own-flare-up');
      return;
    }
    default:
  }
}

/**
 * A star dying and taking its zone with it. `at` is the star when a flare caused it in the
 * ship's zone; without it, chance picks a zone anywhere in the Reach.
 */
export function collapse(ctx: Ctx, at: Point | null) {
  const { s } = ctx;
  let zonePoint: Point;
  let star: Point | null = at;
  if (at) {
    zonePoint = { ...s.ship.zone };
  } else {
    for (;;) {
      zonePoint = { row: ranf(ctx, 8), col: ranf(ctx, 8) };
      if (zoneAt(s, zonePoint).stars > 0) break;
    }
    if (zonePoint.row === s.ship.zone.row && zonePoint.col === s.ship.zone.col) {
      star = pickStarHere(ctx, zoneAt(s, zonePoint).stars);
    }
  }
  const zone = zoneAt(s, zonePoint);
  const isHere = star !== null;
  const heard = isHere || !isDown(ctx, 'radio');
  emit(ctx, { type: 'collapse', zone: { ...zonePoint }, here: isHere, heard });
  if (isHere && star) {
    const dr = star.row - s.ship.cell.row;
    const dc = star.col - s.ship.cell.col;
    if (dr * dr + dc * dc <= 2) lose(ctx, 'collapse');
  }
  const gleanersLost = zone.gleaners;
  s.now.gleaners -= gleanersLost;
  if (at) {
    s.tally.starsLost += zone.stars;
    s.tally.stopped += gleanersLost;
  }
  if (zone.harbour) harbourLost(ctx, zonePoint, false);
  // Any call about this zone is moot now; the lost world and harbour beats tell the story.
  s.events = s.events.filter(
    (event) =>
      event.kind === 'repair' ||
      event.zone.row !== zonePoint.row ||
      event.zone.col !== zonePoint.col ||
      !['harbour-falls', 'world-falls', 'swarm-grows'].includes(event.kind),
  );
  zone.distress = null;
  if (zone.world !== null) worldDestroyed(ctx, zonePoint, false);
  zone.stars = -1;
  zone.gleaners = 0;
  if (heard) rememberZone(s, zone);
  if (isHere) {
    s.gleaners = [];
    for (const row of s.cells) row.fill('empty');
    s.cells[s.ship.cell.row]![s.ship.cell.col] = s.ship.vessel === 'ember' ? 'ember' : 'lantern';
  }
  if (s.now.gleaners <= 0) win(ctx);
}

function pickStarHere(ctx: Ctx, stars: number): Point {
  let n = ranf(ctx, stars);
  for (let row = 0; row < ZONE_SIZE; row++) {
    for (let col = 0; col < ZONE_SIZE; col++) {
      const content = ctx.s.cells[row]![col];
      if (content === 'star' || content === 'world') {
        n -= 1;
        if (n <= 0) return { row, col };
      }
    }
  }
  return { ...ctx.s.ship.cell };
}

/** Flying into something with the computer down, or on purpose. */
export function ram(ctx: Ctx, at: Point) {
  const { s } = ctx;
  const what = cellAt(s, at);
  if (what === 'gleaner') {
    emit(ctx, { type: 'rammed', what: 'gleaner' });
    stopGleaner(ctx, at, 'ram');
  } else if (what === 'star' || what === 'world') {
    emit(ctx, { type: 'rammed', what: 'star' });
    lose(ctx, 'into-a-star');
  } else if (what === 'harbour') {
    emit(ctx, { type: 'rammed', what: 'harbour' });
    // A ram is only the captain's fault when navigation was working.
    harbourLost(ctx, s.ship.zone, !isDown(ctx, 'navigation'));
  }
  const injured = 10 + ranf(ctx, Math.round(20 * s.params.skill));
  s.tally.injured += injured;
  s.ship.crew -= injured;
  emit(ctx, { type: 'injured', count: injured });
  for (const system of SYSTEM_ORDER) {
    if (ranf(ctx, 100) < 20) continue;
    damage(ctx, system, (2.5 * (franf(ctx) + franf(ctx)) + 1) * s.params.damageFactor);
  }
  s.ship.shieldUp = false;
}
