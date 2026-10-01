import type { Beat, Refusal } from './beats';
import { automaticBanks, type Bank, fireBanks, fireFlares, gleanersAttack } from './combat';
import { type Ctx, EndOfWatch, emit, franf, lose, makeCtx, ranf } from './context';
import { playRadioBacklog, runEvents } from './events';
import { checkCondition, driveTo, thrustersTo } from './helm';
import { stopGleaner } from './losses';
import { SYSTEM_ORDER } from './params';
import { firstOf, isDown, scaleRepairs, unschedule } from './schedule';
import { BEAM_BANKS, type Point, type SystemId, type WatchState, ZONE_SIZE } from './types';
import {
  cellAt,
  chartAfterOrder,
  enterZone,
  gleanerAt,
  here,
  insideZone,
  measureGleaners,
  setCell,
  shipMark,
} from './zone';

/**
 * The captain's orders. `applyOrder` never touches the state it is given: it works on a copy,
 * runs the order, lets time pass, gives the gleaners their answer and checks the ship, exactly
 * the loop the original ran after every command.
 */

export interface AimedBank {
  units: number;
  /** Degrees clockwise from north. */
  bearing: number;
  spread: number;
}

export type Order =
  | { type: 'drive'; factor: number }
  | { type: 'shield'; up: boolean }
  | { type: 'shroud'; on: boolean }
  | { type: 'beams'; energy: number }
  | { type: 'beams-aimed'; banks: AimedBank[] }
  | { type: 'flare'; bearing: number; burst?: number }
  | { type: 'travel'; bearing: number; distance: number; ram?: boolean; raiseShield?: boolean }
  | { type: 'thrusters'; bearing: number; distance: number }
  | { type: 'hail'; target: Point }
  | { type: 'moor' }
  | { type: 'unmoor' }
  | { type: 'rest'; days: number }
  | { type: 'sweep'; bearing: number }
  | { type: 'beacon' }
  | { type: 'abandon' }
  | { type: 'end-watch' };

export interface OrderResult {
  state: WatchState;
  beats: Beat[];
  /** False when the order was refused and nothing happened. */
  accepted: boolean;
}

class Refused extends Error {
  constructor(
    readonly reason: Refusal,
    readonly system?: SystemId,
  ) {
    super(reason);
  }
}

function refuse(reason: Refusal, system?: SystemId): never {
  throw new Refused(reason, system);
}

function requireWorking(ctx: Ctx, system: SystemId) {
  if (isDown(ctx, system)) refuse('system-down', system);
}

export function applyOrder(state: WatchState, order: Order): OrderResult {
  if (state.outcome) return { state, beats: [], accepted: false };
  const s = structuredClone(state);
  const ctx = makeCtx(s);
  try {
    runOrder(ctx, order);
    runEvents(ctx, false);
    gleanersAttack(ctx, false);
    checkCondition(ctx);
  } catch (error) {
    if (error instanceof Refused) {
      return {
        state,
        beats: [{ type: 'refused', reason: error.reason, system: error.system }],
        accepted: false,
      };
    }
    if (!(error instanceof EndOfWatch)) throw error;
    s.outcome = error.outcome;
  }
  if (!s.outcome) chartAfterOrder(ctx);
  s.rng = ctx.rng.state();
  s.actions += 1;
  return { state: s, beats: ctx.beats, accepted: true };
}

function runOrder(ctx: Ctx, order: Order) {
  switch (order.type) {
    case 'drive':
      return setDrive(ctx, order.factor);
    case 'shield':
      return setShield(ctx, order.up);
    case 'shroud':
      return setShroud(ctx, order.on);
    case 'beams':
      return beamsAutomatic(ctx, order.energy);
    case 'beams-aimed':
      return beamsAimed(ctx, order.banks);
    case 'flare':
      return flare(ctx, order.bearing, order.burst ?? 0);
    case 'travel':
      return travel(ctx, order);
    case 'thrusters':
      return thrusters(ctx, order.bearing, order.distance);
    case 'hail':
      return hail(ctx, order.target);
    case 'moor':
      return moor(ctx);
    case 'unmoor':
      return unmoor(ctx);
    case 'rest':
      return rest(ctx, order.days);
    case 'sweep':
      return sweep(ctx, order.bearing);
    case 'beacon':
      return beacon(ctx);
    case 'abandon':
      return abandon(ctx);
    case 'end-watch':
      throw new EndOfWatch({ kind: 'ended' });
  }
}

export function maxDrive(s: WatchState): number {
  return s.params.rules.redline ? 10 : 9;
}

function setDrive(ctx: Ctx, factor: number) {
  if (!(factor >= 1) || factor > maxDrive(ctx.s)) refuse('bad-order');
  ctx.s.ship.drive = factor;
  emit(ctx, { type: 'drive-set', factor });
}

function setShield(ctx: Ctx, up: boolean) {
  const { ship, params } = ctx.s;
  requireWorking(ctx, 'shield');
  if (ship.condition === 'moored') refuse('moored');
  if (ship.shieldUp === up) refuse('bad-order');
  if (up) ship.energy -= params.shieldUpEnergy;
  ctx.order.free = false;
  ctx.order.shieldChanged = true;
  ship.shieldUp = up;
  emit(ctx, { type: 'shield', up, energy: up ? params.shieldUpEnergy : 0 });
}

function setShroud(ctx: Ctx, on: boolean) {
  const { s } = ctx;
  if (!s.params.rules.shroud) refuse('not-unlocked');
  if (s.ship.vessel === 'ember') refuse('ember-has-no-shroud');
  requireWorking(ctx, 'shroud');
  if (s.ship.condition === 'moored') refuse('moored');
  if (s.ship.shrouded === on) refuse('bad-order');
  if (on) s.ship.shroudSettled = false;
  ctx.order.free = false;
  s.ship.shrouded = on;
  emit(ctx, { type: 'shroud', on });
}

function beamsReady(ctx: Ctx) {
  const { ship } = ctx.s;
  if (ship.condition === 'moored') refuse('moored');
  requireWorking(ctx, 'beams');
  if (ship.shieldUp) refuse('shield-up');
  if (ship.shrouded) refuse('shrouded');
}

/** Automatic beams need the computer and the near sensors to find their targets. */
export function automaticBeamsAvailable(s: WatchState): boolean {
  return !s.events.some(
    (e) => e.kind === 'repair' && (e.system === 'computer' || e.system === 'near-sensors'),
  );
}

function beamsAutomatic(ctx: Ctx, energy: number) {
  const { s } = ctx;
  beamsReady(ctx);
  if (!automaticBeamsAvailable(s))
    refuse('system-down', isDown(ctx, 'computer') ? 'computer' : 'near-sensors');
  if (s.gleaners.length <= 0) refuse('no-gleaners');
  if (!(energy > 0)) refuse('bad-order');
  if (energy > s.ship.energy) refuse('no-power');
  const units = Math.trunc(energy);
  s.ship.energy -= units;
  const { banks, overkill } = automaticBanks(s, units);
  fireBanks(ctx, banks, overkill);
}

function beamsAimed(ctx: Ctx, aimed: AimedBank[]) {
  const { s } = ctx;
  beamsReady(ctx);
  if (aimed.length === 0 || aimed.length > BEAM_BANKS) refuse('bad-order');
  const banks: Bank[] = aimed.map((bank) => ({
    units: Math.trunc(bank.units),
    angle: (bank.bearing * Math.PI) / 180,
    spread: Math.min(1, Math.max(0, bank.spread)),
  }));
  const total = banks.reduce((sum, bank) => sum + bank.units, 0);
  if (!(total > 0) || banks.some((bank) => bank.units < 0)) refuse('bad-order');
  if (total > s.ship.energy) refuse('no-power');
  s.ship.energy -= total;
  fireBanks(ctx, banks, 0);
}

function flare(ctx: Ctx, bearing: number, burst: number) {
  const { s } = ctx;
  if (s.ship.shrouded) refuse('shrouded');
  if (isDown(ctx, 'flare-tubes') && s.ship.condition !== 'moored')
    refuse('system-down', 'flare-tubes');
  if (s.ship.flares <= 0) refuse('no-flares');
  const angle = Math.round(bearing);
  if (!(angle >= 0 && angle <= 360)) refuse('bad-order');
  const spread = s.params.rules.bursts && burst >= 1 && burst <= 15 ? Math.round(burst) : 0;
  fireFlares(ctx, angle, spread);
}

/** Leaving a harbour is its own order in the original; moving away implies it here. */
function leaveHarbourFor(ctx: Ctx) {
  if (ctx.s.ship.condition === 'moored') unmoor(ctx);
}

function travel(
  ctx: Ctx,
  order: { bearing: number; distance: number; ram?: boolean; raiseShield?: boolean },
) {
  const course = Math.round(order.bearing);
  if (!(course >= 0 && course <= 360) || !(order.distance > 0 && order.distance <= 15))
    refuse('bad-order');
  requireWorking(ctx, 'drive');
  leaveHarbourFor(ctx);
  driveTo(ctx, order.ram ? 1 : 0, course, order.distance, order.raiseShield !== false);
}

function thrusters(ctx: Ctx, bearing: number, distance: number) {
  const course = Math.round(bearing);
  if (!(course >= 0 && course <= 360) || !(distance > 0 && distance <= 15)) refuse('bad-order');
  requireWorking(ctx, 'thrusters');
  leaveHarbourFor(ctx);
  thrustersTo(ctx, course, distance);
}

/** The surrender odds in percent; the original asked a random gleaner, the captain picks here. */
export function hailChance(s: WatchState, power: number): number {
  const x = (s.params.gleanerPower * s.ship.energy) / (power * s.gleaners.length);
  return Math.max(0, Math.trunc(x * s.params.hailChance));
}

function hail(ctx: Ctx, target: Point) {
  const { s } = ctx;
  if (!s.params.rules.hail) refuse('not-unlocked');
  if (s.ship.shrouded) refuse('shrouded');
  requireWorking(ctx, 'radio');
  if (s.gleaners.length <= 0) refuse('no-gleaners');
  const gleaner = gleanerAt(s, target);
  if (!gleaner) refuse('bad-order');
  ctx.order.free = false;
  ctx.order.time = 0.05;
  gleaner.hailed += 1;
  const chance = hailChance(s, gleaner.power);
  const accepted = chance > ranf(ctx, 100);
  let salvage = 0;
  if (accepted) {
    salvage = Math.min(ranf(ctx, s.params.gleanerCargo), s.ship.holdFree);
    s.ship.holdFree -= salvage;
  }
  emit(ctx, { type: 'hail', at: { ...target }, accepted, chance, salvage });
  if (accepted) stopGleaner(ctx, target, 'hail');
}

export function harbourIsNear(s: WatchState): boolean {
  const { row, col } = s.ship.cell;
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (insideZone(r, c) && s.cells[r]![c] === 'harbour') return true;
    }
  }
  return false;
}

function moor(ctx: Ctx) {
  const { s } = ctx;
  if (s.ship.condition === 'moored') refuse('bad-order');
  if (!harbourIsNear(s)) refuse('no-harbour-near');
  mooringRefit(ctx);
}

/** Everything a harbour gives at once; repairs speed up but still take their time. */
function mooringRefit(ctx: Ctx) {
  const { s } = ctx;
  const { ship, params } = s;
  ship.energy = params.energy;
  ship.flares = params.flares;
  ship.shield = params.shield;
  ship.crew = params.crew;
  const salvage = params.holdFree - ship.holdFree;
  s.tally.salvage += salvage;
  ship.holdFree = params.holdFree;
  ship.shieldUp = false;
  ship.shrouded = false;
  ship.condition = 'moored';
  ship.reserves = params.reserves;
  ship.navigationUncalibrated = false;
  emit(ctx, { type: 'moored', salvage });
  playRadioBacklog(ctx);
  scaleRepairs(ctx, params.mooredRepairFactor);
}

function unmoor(ctx: Ctx) {
  const { s } = ctx;
  if (s.ship.condition !== 'moored') refuse('not-moored');
  s.ship.condition = 'green';
  ctx.order.free = false;
  scaleRepairs(ctx, 1 / s.params.mooredRepairFactor);
  emit(ctx, { type: 'unmoored' });
}

function rest(ctx: Ctx, days: number) {
  const { s } = ctx;
  if (!(days > 0)) refuse('bad-order');
  ctx.order.time = days;
  const snare = firstOf(ctx, 'snare');
  if (snare && s.ship.condition !== 'moored') {
    // Nobody rests through a snare.
    const untilSnare = snare.date - s.now.date;
    if (ctx.order.time > untilSnare) ctx.order.time = untilSnare + 0.0001;
  }
  ctx.order.free = false;
  ctx.order.resting = true;
}

const SWEEP_STEPS: readonly Point[] = [
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: 1 },
  { row: 1, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: -1 },
  { row: 0, col: -1 },
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: 1 },
];

/** With the near sensors down, the lantern lights three neighbouring cells in one direction. */
function sweep(ctx: Ctx, bearing: number) {
  const { s } = ctx;
  const course = Math.round(bearing);
  if (!(course >= 0 && course <= 360)) refuse('bad-order');
  const first = Math.trunc((course + 22) / 45);
  const cells: Point[] = [];
  for (let i = 0; i < 3; i++) {
    const step = SWEEP_STEPS[first + i]!;
    const at = { row: s.ship.cell.row + step.row, col: s.ship.cell.col + step.col };
    if (insideZone(at.row, at.col)) cells.push(at);
  }
  s.swept.push(...cells);
  ctx.order.time = 0.05;
  ctx.order.free = false;
  emit(ctx, { type: 'swept', cells });
}

/**
 * Calling the nearest harbour to beam the ship home. The odds fall with distance; three tries,
 * and a captain who sends for rescue gives up the clean record.
 */
function beacon(ctx: Ctx) {
  const { s } = ctx;
  if (s.ship.condition === 'moored') refuse('moored');
  requireWorking(ctx, 'radio');
  if (s.now.harbours.length <= 0) refuse('no-harbours-left');
  s.tally.beaconCalls += 1;
  let distance = 0;
  if (!here(s).harbour) {
    let best = Number.POSITIVE_INFINITY;
    let nearest = s.now.harbours[0]!;
    for (const harbour of s.now.harbours) {
      const d = Math.hypot(harbour.row - s.ship.zone.row, harbour.col - s.ship.zone.col);
      if (d < best) {
        best = d;
        nearest = harbour;
      }
    }
    distance = best;
    s.ship.zone = { ...nearest };
    enterZone(ctx, { quiet: true });
  }
  setCell(s, s.ship.cell, 'empty');
  const failChance = Math.cbrt(1 - 0.94 ** distance);
  const tries: boolean[] = [];
  const harbour = s.harbourCell;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (franf(ctx) > failChance && harbour) {
      const spot = spotBeside(ctx, harbour);
      if (spot) {
        tries.push(true);
        s.ship.cell = spot;
        setCell(s, spot, shipMark(s));
        emit(ctx, { type: 'beacon', harbour: { ...s.ship.zone }, tries, rescued: true });
        mooringRefit(ctx);
        measureGleaners(s, false);
        return;
      }
    }
    tries.push(false);
  }
  emit(ctx, { type: 'beacon', harbour: { ...s.ship.zone }, tries, rescued: false });
  lose(ctx, 'beacon-failed');
}

/** Five tries at an empty cell beside the harbour, as the original made. */
function spotBeside(ctx: Ctx, harbour: Point): Point | null {
  for (let i = 0; i < 5; i++) {
    const row = harbour.row + ranf(ctx, 3) - 1;
    if (row < 0 || row >= ZONE_SIZE) continue;
    const col = harbour.col + ranf(ctx, 3) - 1;
    if (col < 0 || col >= ZONE_SIZE || cellAt(ctx.s, { row, col }) !== 'empty') continue;
    return { row, col };
  }
  return null;
}

/**
 * Leaving the Lantern for the old tender Ember. The crew goes down to a world if there is one
 * here and the ferry works, or rows home in the boats; the captain takes the launch.
 */
function abandon(ctx: Ctx) {
  const { s } = ctx;
  if (s.ship.vessel === 'ember') refuse('already-aboard-ember');
  let crewSafe = true;
  if (s.ship.condition !== 'moored') {
    requireWorking(ctx, 'launch');
    crewSafe = here(s).world !== null && !isDown(ctx, 'ferry');
  }
  if (s.now.harbours.length === 0) lose(ctx, 'no-harbour-left');
  const { params, ship } = s;
  ship.vessel = 'ember';
  params.energy = ship.energy = 3000;
  params.flares = ship.flares = 6;
  params.shield = ship.shield = 1250;
  ship.shieldUp = false;
  ship.shrouded = false;
  ship.drive = 5;
  ship.condition = 'green';
  for (const event of s.events.filter((e) => e.kind === 'repair')) unschedule(ctx, event);
  redistributeDamageOdds(s, ['launch', 'shroud']);
  ship.zone = { ...s.now.harbours[ranf(ctx, s.now.harbours.length)]! };
  enterZone(ctx, { quiet: true });
  setCell(s, ship.cell, 'empty');
  const spot = s.harbourCell ? spotBeside(ctx, s.harbourCell) : null;
  if (spot) ship.cell = spot;
  setCell(s, ship.cell, shipMark(s));
  emit(ctx, { type: 'abandoned', crewSafe, to: { ...ship.zone } });
  if (spot) mooringRefit(ctx);
  measureGleaners(s, false);
}

/** The Ember has neither launch nor shroud; their share of bad luck goes to everything else. */
function redistributeDamageOdds(s: WatchState, gone: SystemId[]) {
  let share = gone.reduce((sum, system) => sum + s.params.damageOdds[system], 0);
  for (const system of gone) s.params.damageOdds[system] = 0;
  while (share > 0) {
    for (const system of SYSTEM_ORDER) {
      if (s.params.damageOdds[system] === 0) continue;
      s.params.damageOdds[system] += 1;
      share -= 1;
      if (share <= 0) break;
    }
  }
}
