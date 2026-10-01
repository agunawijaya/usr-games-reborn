import type { Order } from './orders';
import { automaticBeamsAvailable, hailChance, harbourIsNear } from './orders';
import {
  clearCourseTo,
  type Course,
  courseTo,
  driveCost,
  knownCalls,
  plotCourse,
  previewFlare,
  suggestedBeamEnergy,
} from './preview';
import { type Point, REACH_SIZE, type SystemId, type WatchState, ZONE_SIZE } from './types';

/**
 * A steady captain for simulations and the attract mode. It is no genius: it answers the most
 * urgent call it can reach, fights with beams at a lowered shield and flares when the shot is
 * clean, hails a worn-down gleaner, and goes home to a harbour when it runs low.
 */

export interface BotStyle {
  cruiseDrive: number;
  hurryDrive: number;
  /** Below this the captain heads for a harbour. */
  homeEnergy: number;
  hail: boolean;
  /** Arrive with the shield raised (the computer's offer) or come in ready to fire beams. */
  arriveShielded: boolean;
  /** Extra energy put into a volley over the automatic estimate. */
  beamMargin: number;
  /** Keep the shield up between zones, paying double for the drive. */
  travelShielded: boolean;
}

export const STEADY_CAPTAIN: BotStyle = {
  cruiseDrive: 6,
  hurryDrive: 8,
  homeEnergy: 1800,
  hail: true,
  arriveShielded: true,
  beamMargin: 1.15,
  travelShielded: false,
};

/** Bold against a weak swarm, careful against a strong one: how the steady captain adapts. */
export function captainFor(s: WatchState): BotStyle {
  if (s.params.gleanerPower < 650) return { ...STEADY_CAPTAIN, arriveShielded: false };
  return { ...STEADY_CAPTAIN, travelShielded: true, homeEnergy: 2200 };
}

/** Systems the captain will not sail without; anything else waits for the next mooring. */
const VITAL: readonly SystemId[] = ['drive', 'life-support'];
/** Systems worth a short wait in harbour, when the repair is nearly done anyway. */
const USEFUL: readonly SystemId[] = ['beams', 'near-sensors', 'computer', 'flare-tubes'];

function isDown(s: WatchState, system: SystemId) {
  return s.events.some((e) => e.kind === 'repair' && e.system === system);
}

export function botOrder(s: WatchState, style: BotStyle = captainFor(s)): Order {
  if (s.ship.condition === 'moored') return whileMoored(s, style);
  if (s.gleaners.length > 0) return fight(s, style);
  return between(s, style);
}

function whileMoored(s: WatchState, style: BotStyle): Order {
  const waits = s.events
    .filter((e) => e.kind === 'repair')
    .filter(
      (e) => VITAL.includes(e.system!) || (USEFUL.includes(e.system!) && e.date - s.now.date < 0.6),
    )
    .map((e) => e.date - s.now.date);
  if (waits.length > 0) {
    const longest = Math.max(...waits);
    if (longest < s.now.time * 0.4) return { type: 'rest', days: Math.min(longest + 0.05, 2) };
  }
  return between(s, style);
}

function fight(s: WatchState, style: BotStyle): Order {
  if (style.hail && s.params.rules.hail && !isDown(s, 'radio')) {
    const willing = s.gleaners.find((g) => hailChance(s, g.power) >= 60);
    if (willing) return { type: 'hail', target: { row: willing.row, col: willing.col } };
  }
  const flare = cleanFlare(s);
  const strongest = Math.max(...s.gleaners.map((g) => g.power));
  if (flare && (s.ship.shieldUp || isDown(s, 'beams') || strongest > s.params.gleanerPower * 0.6)) {
    return { type: 'flare', bearing: flare.bearing };
  }
  if (isDown(s, 'beams') || !automaticBeamsAvailable(s)) {
    if (flare) return { type: 'flare', bearing: flare.bearing };
    return retreat(s, style);
  }
  if (s.ship.shieldUp) {
    if (isDown(s, 'shield')) return retreat(s, style);
    return { type: 'shield', up: false };
  }
  const energy = Math.min(
    Math.trunc(suggestedBeamEnergy(s) * style.beamMargin),
    s.ship.energy - homeFare(s),
  );
  if (energy < 150) return flare ? { type: 'flare', bearing: flare.bearing } : retreat(s, style);
  return { type: 'beams', energy };
}

/** Energy kept back for the trip to the nearest harbour, so a volley never strands the ship. */
function homeFare(s: WatchState): number {
  let nearest = Infinity;
  for (const harbour of s.now.harbours) {
    nearest = Math.min(
      nearest,
      Math.hypot(harbour.row - s.ship.zone.row, harbour.col - s.ship.zone.col),
    );
  }
  if (!Number.isFinite(nearest)) return 300;
  return Math.round(driveCost(s, nearest + 0.5, 6, false).energy + 300);
}

/** A flare bearing whose straight path meets a gleaner first, nearest first. */
function cleanFlare(s: WatchState): { bearing: number } | null {
  if (s.ship.flares <= 0 || isDown(s, 'flare-tubes')) return null;
  for (const gleaner of s.gleaners) {
    const course = courseTo(s, s.ship.zone, gleaner);
    const preview = previewFlare(s, course.bearing);
    if (
      preview.end === 'gleaner' &&
      preview.at?.row === gleaner.row &&
      preview.at.col === gleaner.col
    ) {
      if (gleaner.dist <= (s.ship.shieldUp ? 2.5 : 4)) return { bearing: course.bearing };
    }
  }
  return null;
}

function retreat(s: WatchState, style: BotStyle): Order {
  return (
    towardHarbour(s, style) ?? travelTo(s, pickZone(s), style.cruiseDrive, style) ?? stranded(s)
  );
}

/** Too little energy to go anywhere: wait for it to come back, or call a harbour. */
function stranded(s: WatchState): Order {
  if (s.params.regen > 0 && s.gleaners.length === 0) return { type: 'rest', days: 1 };
  if (!isDown(s, 'radio') && s.now.harbours.length > 0) return { type: 'beacon' };
  return { type: 'rest', days: 0.5 };
}

function between(s: WatchState, style: BotStyle): Order {
  if (isDown(s, 'life-support') && s.ship.condition !== 'moored') {
    const order = towardHarbour(s, { ...style, cruiseDrive: style.hurryDrive });
    if (order) return order;
  }
  const needsHarbour =
    s.ship.energy < style.homeEnergy ||
    s.ship.flares < 2 ||
    VITAL.some((system) => isDown(s, system)) ||
    s.ship.navigationUncalibrated;
  if (needsHarbour && s.ship.condition !== 'moored') {
    const order = towardHarbour(s, style);
    if (order) return order;
  }
  const target = pickZone(s);
  const known = s.zones[target.row]![target.col]!.seen?.gleaners ?? 0;
  // The arrival volley comes before the captain can act; go in with enough energy to take it.
  const arrivalHit = known * s.params.gleanerPower * 0.35;
  if (known > 0 && s.ship.condition !== 'moored' && s.ship.energy - arrivalHit < style.homeEnergy) {
    const order = towardHarbour(s, style);
    if (order) return order;
  }
  if (
    known > 0 &&
    style.travelShielded &&
    !s.ship.shieldUp &&
    !isDown(s, 'shield') &&
    s.ship.condition !== 'moored'
  ) {
    return { type: 'shield', up: true };
  }
  const urgent = knownCalls(s).some(
    (call) =>
      call.zone.row === target.row && call.zone.col === target.col && call.deadline !== null,
  );
  const order = travelTo(s, target, urgent ? style.hurryDrive : style.cruiseDrive, {
    ...style,
    travelShielded: style.travelShielded && known > 0,
  });
  return order ?? towardHarbour(s, style) ?? stranded(s);
}

function setDriveFirst(s: WatchState, factor: number, then: Order): Order {
  if (s.ship.drive !== factor) return { type: 'drive', factor };
  return then;
}

function travelTo(s: WatchState, zone: Point, wanted: number, style?: BotStyle): Order | null {
  if (isDown(s, 'drive')) return null;
  const course = clearCourseTo(s, zone) ?? sidestep(s);
  if (!course || course.distance <= 0.05) return null;
  // The shield doubles the drive's cost; with nobody around, it travels down.
  if (
    s.ship.shieldUp &&
    !style?.travelShielded &&
    s.gleaners.length === 0 &&
    !isDown(s, 'shield')
  ) {
    return { type: 'shield', up: false };
  }
  let factor = wanted;
  const cost = (f: number) => driveCost(s, course.distance, f, s.ship.shieldUp);
  while (factor < 8 && cost(factor).days > 0.45 * s.now.time) factor++;
  while (factor > 4 && cost(factor).energy > s.ship.energy - 300) factor--;
  if (cost(factor).energy > s.ship.energy - 100) return null;
  return setDriveFirst(s, factor, {
    type: 'travel',
    bearing: course.bearing,
    distance: course.distance,
    raiseShield: style?.arriveShielded ?? true,
  });
}

/** Every line out is blocked: hop to some other free cell in the zone first. */
function sidestep(s: WatchState): Course | null {
  for (let row = 0; row < ZONE_SIZE; row++) {
    for (let col = 0; col < ZONE_SIZE; col++) {
      if (s.cells[row]![col] !== 'empty') continue;
      const course = courseTo(s, s.ship.zone, { row, col });
      const plot = plotCourse(s, course);
      if (!plot.blockedBy && course.distance > 0.15) return course;
    }
  }
  return null;
}

function towardHarbour(s: WatchState, style: BotStyle): Order | null {
  if (s.now.harbours.length === 0) return null;
  if (harbourIsNear(s)) return { type: 'moor' };
  const zoneHasHarbour = s.harbourCell !== null;
  if (zoneHasHarbour) return approachHarbour(s);
  let nearest: Point | null = null;
  let best = Infinity;
  for (const harbour of s.now.harbours) {
    const known = s.zones[harbour.row]![harbour.col]!.seen?.harbour;
    if (!known) continue;
    const d = Math.hypot(harbour.row - s.ship.zone.row, harbour.col - s.ship.zone.col);
    if (d < best) {
      best = d;
      nearest = harbour;
    }
  }
  return nearest ? travelTo(s, nearest, style.cruiseDrive, style) : null;
}

/** A short hop inside the zone to a cell beside the harbour. */
function approachHarbour(s: WatchState): Order | null {
  const harbour = s.harbourCell!;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const cell = { row: harbour.row + dr, col: harbour.col + dc };
      if (cell.row < 0 || cell.row >= ZONE_SIZE || cell.col < 0 || cell.col >= ZONE_SIZE) continue;
      if (s.cells[cell.row]![cell.col] !== 'empty') continue;
      const course: Course = courseTo(s, s.ship.zone, cell);
      const plot = plotCourse(s, course);
      if (plot.blockedBy || plot.leaves) continue;
      if (plot.stop.row !== cell.row || plot.stop.col !== cell.col) continue;
      if (isDown(s, 'drive')) {
        if (isDown(s, 'thrusters')) return null;
        return { type: 'thrusters', bearing: course.bearing, distance: course.distance };
      }
      return { type: 'travel', bearing: course.bearing, distance: course.distance };
    }
  }
  return null;
}

/** The zone most worth the trip: live calls first, then known gleaners, then the unknown. */
function pickZone(s: WatchState): Point {
  const calls = knownCalls(s);
  let best: Point = { row: 0, col: 0 };
  let bestValue = -Infinity;
  for (let row = 0; row < REACH_SIZE; row++) {
    for (let col = 0; col < REACH_SIZE; col++) {
      if (row === s.ship.zone.row && col === s.ship.zone.col) continue;
      const zone = s.zones[row]![col]!;
      if (zone.stars < 0 || zone.seen?.collapsed) continue;
      let value = zone.seen === null || zone.seen.gleaners === null ? 0.6 : zone.seen.gleaners;
      for (const call of calls) {
        if (call.zone.row !== row || call.zone.col !== col) continue;
        if (call.kind === 'threatened') {
          const cost = driveCost(s, Math.hypot(row - s.ship.zone.row, col - s.ship.zone.col), 8);
          if (s.now.date + cost.days < (call.deadline ?? 0)) value += 6;
        } else {
          value += 4;
        }
      }
      if (value <= 0) continue;
      const distance = Math.hypot(row - s.ship.zone.row, col - s.ship.zone.col);
      const score = value / (1 + distance);
      if (score > bestValue) {
        bestValue = score;
        best = { row, col };
      }
    }
  }
  return best;
}
