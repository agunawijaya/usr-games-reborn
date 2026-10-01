import { gleanersAttack, ram } from './combat';
import { type Ctx, emit, franf, lose, ranf } from './context';
import { runEvents } from './events';
import { endCallsAt } from './losses';
import { SYSTEM_ORDER } from './params';
import { damage, firstOf, isDown } from './schedule';
import { REACH_SIZE, ZONE_SIZE } from './types';
import { enterZone, here, measureGleaners, setCell, shipMark } from './zone';

/**
 * Getting around: the drive between zones, the thrusters inside one, and everything that can
 * go wrong on the way (a star in the path, the Rim, a black hole, a snare, the redline).
 */

const THRUSTER_SPEED = 0.095;

/** Drive speed in zones per day at a factor; cost grows with its cube. */
export function driveSpeed(factor: number, driveTime: number): number {
  return (factor * factor) / driveTime;
}

/**
 * The original's `move`. The course is checked cell by cell inside the ship's zone; past its
 * edge, space bends and the ship drops in wherever the line ends. Returns the days used.
 */
export function moveShip(
  ctx: Ctx,
  ramFlag: number,
  course: number,
  plannedTime: number,
  speed: number,
  raiseShield: boolean,
): number {
  const { s } = ctx;
  let angle = (course * Math.PI) / 180;
  if (isDown(ctx, 'navigation')) angle += s.params.navigationDrift[1] * (franf(ctx) - 0.5);
  else if (s.ship.navigationUncalibrated) angle += s.params.navigationDrift[0] * (franf(ctx) - 0.5);
  let dRow = -Math.cos(angle);
  let dCol = Math.sin(angle);
  const bigger = Math.max(Math.abs(dRow), Math.abs(dCol));
  dRow /= bigger;
  dCol /= bigger;

  let time = plannedTime;
  const snare = firstOf(ctx, 'snare');
  let snareTime = snare ? snare.date - s.now.date : Number.POSITIVE_INFINITY;
  if (time > snareTime && s.gleaners.length < 3) {
    snareTime += 0.005;
    time = snareTime;
  } else {
    snareTime = -1e50;
  }

  const start = { zone: { ...s.ship.zone }, cell: { ...s.ship.cell } };
  const distance = time * speed;
  setCell(s, s.ship.cell, 'empty');
  let row = s.ship.cell.row + 0.5;
  let col = s.ship.cell.col + 0.5;
  const span = ZONE_SIZE * distance * bigger;
  let steps = Math.trunc(span + 0.5);
  ctx.order.free = false;
  let stopRow = s.ship.cell.row;
  let stopCol = s.ship.cell.col;
  for (let i = 0; i < steps; i++) {
    row += dRow;
    col += dCol;
    stopRow = Math.trunc(row);
    stopCol = Math.trunc(col);
    if (row < 0 || col < 0 || row >= ZONE_SIZE || col >= ZONE_SIZE) {
      crossIntoNewZone(ctx, { row, col }, { dRow: dRow * span, dCol: dCol * span }, raiseShield);
      steps = 0;
      break;
    }
    const content = s.cells[stopRow]![stopCol];
    if (content !== 'empty') {
      if (!isDown(ctx, 'computer') && ramFlag <= 0) {
        stopRow = Math.trunc(row - dRow);
        stopCol = Math.trunc(col - dCol);
        s.ship.energy -= s.params.stopEnergy * speed;
        emit(ctx, { type: 'stopped-short', at: { row: stopRow, col: stopCol } });
        break;
      }
      if (content === 'hole') {
        throwElsewhere(ctx, 'black-hole');
        enterZone(ctx, { raiseShield });
        steps = 0;
        break;
      }
      ram(ctx, { row: stopRow, col: stopCol });
      break;
    }
  }
  if (steps > 0) {
    const travelled = Math.hypot(s.ship.cell.row - stopRow, s.ship.cell.col - stopCol) / ZONE_SIZE;
    time = travelled / speed;
    if (snareTime > time) time = snareTime;
    s.ship.cell = { row: stopRow, col: stopCol };
  }
  setCell(s, s.ship.cell, shipMark(s));
  measureGleaners(s, false);
  emit(ctx, {
    type: 'travel',
    from: start,
    to: { zone: { ...s.ship.zone }, cell: { ...s.ship.cell } },
    engine: s.override ? 'override' : speed === THRUSTER_SPEED ? 'thrusters' : 'drive',
    days: time,
    energy: 0,
  });
  return time;
}

/** Leaving the zone: the gleaners get their parting shot, then the ship drops in elsewhere. */
function crossIntoNewZone(
  ctx: Ctx,
  edge: { row: number; col: number },
  along: { dRow: number; dCol: number },
  raiseShield: boolean,
) {
  const { s } = ctx;
  const absRow = s.ship.zone.row * ZONE_SIZE + s.ship.cell.row + along.dRow;
  const absCol = s.ship.zone.col * ZONE_SIZE + s.ship.cell.col + along.dCol;
  const targetRow = absRow < 0 ? -1 : Math.trunc(absRow + 0.5);
  const targetCol = absCol < 0 ? -1 : Math.trunc(absCol + 0.5);
  s.ship.cell = { row: Math.trunc(edge.row), col: Math.trunc(edge.col) };
  measureGleaners(s, false);
  ctx.order.zoneMoment = 2;
  gleanersAttack(ctx, false);
  checkCondition(ctx);
  const zoneRow = Math.trunc(targetRow / ZONE_SIZE);
  const zoneCol = Math.trunc(targetCol / ZONE_SIZE);
  if (targetRow < 0 || zoneRow >= REACH_SIZE || targetCol < 0 || zoneCol >= REACH_SIZE) {
    s.tally.rimTouches += 1;
    if (isDown(ctx, 'computer')) lose(ctx, 'rim');
    throwElsewhere(ctx, 'rim');
  } else {
    s.ship.zone = { row: zoneRow, col: zoneCol };
    s.ship.cell = { row: targetRow % ZONE_SIZE, col: targetCol % ZONE_SIZE };
  }
  enterZone(ctx, { raiseShield });
}

/** A black hole or the computer's full reverse at the Rim: somewhere random, a little later. */
function throwElsewhere(ctx: Ctx, why: 'black-hole' | 'rim') {
  const { s } = ctx;
  s.ship.zone = { row: ranf(ctx, REACH_SIZE), col: ranf(ctx, REACH_SIZE) };
  s.ship.cell = { row: ranf(ctx, ZONE_SIZE), col: ranf(ctx, ZONE_SIZE) };
  const lost = 1.5 * franf(ctx);
  ctx.order.time += lost;
  emit(ctx, { type: why, to: { ...s.ship.zone } });
  for (const event of s.events) if (event.kind === 'repair') event.date += lost;
  runEvents(ctx, true);
  ctx.order.time = 0;
}

/** The drive, with the strain above factor 6 and the redline above 9. */
export function driveTo(
  ctx: Ctx,
  ramFlag: number,
  course: number,
  plannedDistance: number,
  raiseShield: boolean,
) {
  const { s } = ctx;
  const factor = s.ship.drive;
  const speed = driveSpeed(factor, s.params.driveTime);
  let time = plannedDistance / speed;
  if (factor > 6 && ranf(ctx, 100) < 20 + 15 * (factor - 6)) {
    // A strained drive cuts out part of the way there.
    const frac = franf(ctx);
    time *= frac;
    const days = (frac + 1) * factor * (franf(ctx) + 0.25) * 0.2;
    emit(ctx, { type: 'drive-strained', days });
    damage(ctx, 'drive', days);
  }
  ctx.order.time = moveShip(ctx, ramFlag, course, time, speed, raiseShield);
  const covered = ctx.order.time * speed;
  const energy = covered * factor ** 3 * (s.ship.shieldUp ? 2 : 1);
  s.ship.energy = Math.trunc(s.ship.energy - energy);
  stampTravelCost(ctx, energy);
  if (factor > 9) redline(ctx, covered);
}

export function thrustersTo(ctx: Ctx, course: number, distance: number) {
  const { s } = ctx;
  ctx.order.time = moveShip(ctx, 0, course, distance / THRUSTER_SPEED, THRUSTER_SPEED, true);
  const energy = 20 + 100 * ctx.order.time * THRUSTER_SPEED;
  s.ship.energy = Math.trunc(s.ship.energy - energy);
  stampTravelCost(ctx, energy);
}

function stampTravelCost(ctx: Ctx, energy: number) {
  for (let i = ctx.beats.length - 1; i >= 0; i--) {
    const beat = ctx.beats[i]!;
    if (beat.type === 'travel') {
      beat.energy = Math.round(energy);
      return;
    }
  }
}

/**
 * Past factor 9 the safety systems give out. Most often nothing happens; otherwise the ship
 * may slip forward in time, slip back to the galaxy's last snapshot, shake, or come apart.
 */
function redline(ctx: Ctx, covered: number) {
  const { s } = ctx;
  if (ranf(ctx, 100) >= 100 * covered) {
    emit(ctx, { type: 'redline', event: 'calm', days: 0 });
    return;
  }
  const roll = ranf(ctx, 100);
  if (roll < 70) {
    if (roll < 35 || !s.snapshot) slipForward(ctx, covered);
    else slipBack(ctx);
    return;
  }
  if (roll < 80) {
    emit(ctx, { type: 'redline', event: 'torn-apart', days: 0 });
    lose(ctx, 'redline');
  }
  emit(ctx, { type: 'redline', event: 'shaken', days: 0 });
  for (const system of SYSTEM_ORDER) {
    damage(ctx, system, (3 * (franf(ctx) + franf(ctx)) + 1) * s.params.damageFactor);
  }
  s.ship.shieldUp = false;
}

/**
 * The galaxy lives through the skipped days while the ship's repairs and the next snare wait.
 * The original only moved the date; draining the reserve keeps the clock honest.
 */
function slipForward(ctx: Ctx, covered: number) {
  const { s } = ctx;
  const days = (s.ship.drive - 8) * covered * (franf(ctx) + 1);
  s.tally.portals += 1;
  emit(ctx, { type: 'redline', event: 'forward', days });
  for (const event of s.events) {
    if (event.kind === 'repair' || event.kind === 'snare') event.date += days;
  }
  const own = ctx.order.time;
  ctx.order.time = days;
  runEvents(ctx, true);
  ctx.order.time = own;
}

/**
 * The lucky portal: the Reach rewinds to its last snapshot (gleaners, harbours, calls, the
 * date and the reserve), while the ship and its record stay as they are. In the BSD port this
 * did nothing, because the copy ran the wrong way; this is what the 1976 code meant.
 */
function slipBack(ctx: Ctx) {
  const { s } = ctx;
  const snapshot = s.snapshot!;
  const days = s.now.date - snapshot.now.date;
  const repairs = s.events.filter((event) => event.kind === 'repair');
  s.zones = structuredClone(snapshot.zones);
  s.now = structuredClone(snapshot.now);
  s.events = [
    ...structuredClone(snapshot.events).filter((event) => event.kind !== 'repair'),
    ...repairs.map((event) => ({ ...event, date: event.date - days })),
  ];
  s.tally.portals += 1;
  emit(ctx, { type: 'redline', event: 'back', days });
  enterZone(ctx, { quiet: true });
}

/** Thrown clear of a dying star's zone by the computer, as fast as the energy allows. */
function emergencyOverride(ctx: Ctx) {
  const { s } = ctx;
  const factor = 6 + 2 * franf(ctx);
  s.ship.drive = factor;
  const cube = factor ** 3;
  const distance = Math.min(1.4142, (0.75 * s.ship.energy) / (cube * (s.ship.shieldUp ? 2 : 1)));
  const course = ranf(ctx, 360);
  s.override = true;
  s.ship.condition = 'red';
  driveTo(ctx, -1, course, distance, true);
  gleanersAttack(ctx, false);
}

/** The original's `checkcond`, run after every order. */
export function checkCondition(ctx: Ctx) {
  const { s } = ctx;
  if (s.ship.reserves < 0) lose(ctx, 'air');
  if (s.ship.energy <= 0) lose(ctx, 'power-ran-out');
  if (s.ship.crew <= 0) lose(ctx, 'no-crew');
  if (s.override) return;
  if (here(s).stars < 0) emergencyOverride(ctx);
  if (here(s).stars < 0) lose(ctx, 'collapse');
  if (s.gleaners.length <= 0) endCallsAt(ctx, s.ship.zone, true);
  if (s.ship.condition === 'moored') return;
  if (s.gleaners.length > 0) s.ship.condition = 'red';
  else if (s.ship.energy < s.params.lowEnergy) s.ship.condition = 'yellow';
  else s.ship.condition = 'green';
}
