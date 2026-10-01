import { createRng } from '@usr-games/kit';
import { type Ctx, emit, ranf } from './context';
import { isDown } from './schedule';
import {
  type CellContent,
  type GleanerInZone,
  type Point,
  REACH_SIZE,
  type WatchState,
  type Zone,
  ZONE_SIZE,
  type ZoneLayout,
} from './types';

/**
 * Entering a zone and keeping track of what is in it. The original redrew a zone's stars every
 * time the ship came back; here each zone keeps the layout it was given on the first visit,
 * drawn from its own seed, so the same code always shows the same Reach.
 */

export function zoneAt(s: WatchState, at: Point): Zone {
  return s.zones[at.row]![at.col]!;
}

export function here(s: WatchState): Zone {
  return zoneAt(s, s.ship.zone);
}

export function insideZone(row: number, col: number): boolean {
  return row >= 0 && row < ZONE_SIZE && col >= 0 && col < ZONE_SIZE;
}

export function insideReach(row: number, col: number): boolean {
  return row >= 0 && row < REACH_SIZE && col >= 0 && col < REACH_SIZE;
}

export function cellAt(s: WatchState, at: Point): CellContent {
  return s.cells[at.row]![at.col]!;
}

export function setCell(s: WatchState, at: Point, content: CellContent) {
  s.cells[at.row]![at.col] = content;
}

export function emptyCells(): CellContent[][] {
  return Array.from({ length: ZONE_SIZE }, () => Array<CellContent>(ZONE_SIZE).fill('empty'));
}

export function randomEmptyCell(ctx: Ctx): Point {
  for (;;) {
    const row = ranf(ctx, ZONE_SIZE);
    const col = ranf(ctx, ZONE_SIZE);
    if (ctx.s.cells[row]![col] === 'empty') return { row, col };
  }
}

/** The fixed layout of a zone, from a stream seeded by the watch and the zone alone. */
export function layoutFor(s: WatchState, at: Point, zone: Zone): ZoneLayout {
  const rng = createRng(`${s.seed}:zone:${at.row}:${at.col}`);
  const taken = new Set<string>();
  const place = (): Point => {
    for (;;) {
      const point = { row: rng.int(0, ZONE_SIZE - 1), col: rng.int(0, ZONE_SIZE - 1) };
      const key = `${point.row},${point.col}`;
      if (!taken.has(key)) {
        taken.add(key);
        return point;
      }
    }
  };
  const harbour = zone.harbour ? place() : null;
  const world = zone.world !== null ? place() : null;
  const holes = Array.from({ length: Math.max(0, zone.holes) }, place);
  const ownStars = Math.max(0, zone.stars - (zone.world !== null ? 1 : 0));
  const stars = Array.from({ length: ownStars }, place);
  return { stars, holes, world, harbour };
}

function nearestEmpty(s: WatchState, from: Point): Point {
  for (let radius = 1; radius < ZONE_SIZE; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const row = from.row + dr;
        const col = from.col + dc;
        if (insideZone(row, col) && s.cells[row]![col] === 'empty') return { row, col };
      }
    }
  }
  return from;
}

export function shipMark(s: WatchState): CellContent {
  return s.ship.vessel === 'ember' ? 'ember' : 'lantern';
}

/**
 * The original's `initquad`. `quiet` skips the red-alert check, for arrivals the crew knows
 * will end at a harbour (a beacon rescue, a new ship). `raiseShield` stands for the captain
 * answering yes when the computer offers to raise the shield.
 */
export function enterZone(ctx: Ctx, options: { quiet?: boolean; raiseShield?: boolean } = {}) {
  const { s } = ctx;
  const zone = here(s);
  s.cells = emptyCells();
  s.gleaners = [];
  s.harbourCell = null;
  s.worldCell = null;
  s.swept = [];
  // Arriving in a dead zone leaves the override running, so the computer keeps trying.
  if (zone.stars < 0) return;
  s.override = false;

  if (zone.gleaners > 0 && !options.quiet) {
    s.ship.condition = 'red';
    emit(ctx, { type: 'condition-red' });
    if (options.raiseShield !== false && !isDown(ctx, 'computer')) raiseShieldOnAlert(ctx);
  }

  zone.layout ??= layoutFor(s, s.ship.zone, zone);
  const layout = zone.layout;
  const fixed: [Point | null, CellContent][] = [
    [layout.harbour, 'harbour'],
    [layout.world, 'world'],
    ...layout.holes.map((p): [Point, CellContent] => [p, 'hole']),
    ...layout.stars.map((p): [Point, CellContent] => [p, 'star']),
  ];
  for (const [point, content] of fixed) if (point) setCell(s, point, content);
  s.harbourCell = layout.harbour ? { ...layout.harbour } : null;
  s.worldCell = layout.world ? { ...layout.world } : null;

  // Space bends around the ship: it never materialises inside a star.
  if (cellAt(s, s.ship.cell) !== 'empty') s.ship.cell = nearestEmpty(s, s.ship.cell);
  setCell(s, s.ship.cell, shipMark(s));

  for (let i = 0; i < zone.gleaners; i++) {
    const at = randomEmptyCell(ctx);
    setCell(s, at, 'gleaner');
    s.gleaners.push({ ...at, power: s.params.gleanerPower, dist: 0, avgDist: 0, hailed: 0 });
  }
  measureGleaners(s, true);
  ctx.order.zoneMoment = 1;
  emit(ctx, { type: 'entered', zone: { ...s.ship.zone } });
  chartHere(ctx);
  const scanned = chartNeighbours(ctx);
  if (scanned.length > 0) emit(ctx, { type: 'scanned', zones: scanned });
}

/** The computer's offer to raise the shield on a red alert, accepted. */
function raiseShieldOnAlert(ctx: Ctx) {
  const { ship, params } = ctx.s;
  if (ship.shieldUp || ship.condition === 'moored') return;
  if (isDown(ctx, 'near-sensors') || isDown(ctx, 'shield')) return;
  ship.energy -= params.shieldUpEnergy;
  ship.shieldUp = true;
  ctx.order.free = false;
  ctx.order.shieldChanged = true;
  emit(ctx, { type: 'shield', up: true, energy: params.shieldUpEnergy });
}

/** The original's `compkldist`: distances, a running average for this order, nearest first. */
export function measureGleaners(s: WatchState, newZone: boolean) {
  for (const gleaner of s.gleaners) {
    const d = Math.hypot(s.ship.cell.row - gleaner.row, s.ship.cell.col - gleaner.col);
    gleaner.avgDist = newZone ? d : 0.5 * (gleaner.dist + d);
    gleaner.dist = d;
  }
  s.gleaners.sort((a, b) => a.dist - b.dist);
}

export function gleanerAt(s: WatchState, at: Point): GleanerInZone | undefined {
  return s.gleaners.find((g) => g.row === at.row && g.col === at.col);
}

/** What the near sensors can show: the zone as it is, if they work. */
export function chartHere(ctx: Ctx) {
  const { s } = ctx;
  const zone = here(s);
  if (isDown(ctx, 'near-sensors') && s.ship.condition !== 'moored') return;
  rememberZone(s, zone);
}

export function rememberZone(s: WatchState, zone: Zone) {
  const firstLook = zone.seen === null || zone.seen.gleaners === null;
  zone.seen = {
    gleaners: zone.stars < 0 ? 0 : zone.gleaners,
    harbour: zone.harbour,
    stars: Math.max(0, zone.stars),
    collapsed: zone.stars < 0,
  };
  if (firstLook) s.tally.charted++;
}

/** The long-range scan the original made you ask for; here the crew makes it on every arrival. */
export function chartNeighbours(ctx: Ctx): Point[] {
  const { s } = ctx;
  if (isDown(ctx, 'far-sensors') && s.ship.condition !== 'moored') return [];
  const scanned: Point[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const row = s.ship.zone.row + dr;
      const col = s.ship.zone.col + dc;
      if (!insideReach(row, col)) continue;
      rememberZone(s, s.zones[row]![col]!);
      scanned.push({ row, col });
    }
  }
  return scanned;
}

/** Keeps the chart of this zone and its neighbours current after every order. */
export function chartAfterOrder(ctx: Ctx) {
  chartHere(ctx);
  chartNeighbours(ctx);
}
