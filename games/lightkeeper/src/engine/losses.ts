import { type Ctx, emit, win } from './context';
import { isDown, unschedule } from './schedule';
import type { GleanerInZone, Point } from './types';
import { here, rememberZone, setCell, zoneAt } from './zone';

/**
 * Things leaving the Reach: a gleaner stopped, a harbour lost, a world gone, a call answered.
 * These are the original's `kill.c`, kept together because novas, flares, rams and dying stars
 * all end up here.
 */

function samePoint(a: Point, b: Point) {
  return a.row === b.row && a.col === b.col;
}

/** Stretches the clock: the reserve now has one gleaner fewer to last against. */
export function stopGleaner(ctx: Ctx, at: Point, by: 'beams' | 'flare' | 'nova' | 'ram' | 'hail') {
  const { s } = ctx;
  s.now.gleaners -= 1;
  setCell(s, at, 'empty');
  here(s).gleaners -= 1;
  s.tally.stopped += 1;
  if (by === 'hail') s.tally.hailsAccepted += 1;
  s.gleaners = s.gleaners.filter((g: GleanerInZone) => !(g.row === at.row && g.col === at.col));
  emit(ctx, { type: 'gleaner-stopped', at: { ...at }, by });
  if (s.now.gleaners <= 0) win(ctx);
  const before = s.now.time;
  s.now.time = s.now.reserve / s.now.gleaners;
  emit(ctx, { type: 'clock', before, after: s.now.time });
}

export function harbourLost(ctx: Ctx, zoneAtPoint: Point, byUs: boolean) {
  const { s } = ctx;
  const zone = zoneAt(s, zoneAtPoint);
  if (!zone.harbour) return;
  const radio = !isDown(ctx, 'radio');
  zone.harbour = false;
  if (zone.layout) zone.layout.harbour = null;
  s.now.harbours = s.now.harbours.filter((h) => !samePoint(h, zoneAtPoint));
  if (byUs) s.tally.harboursLostByUs += 1;
  const isHere = samePoint(zoneAtPoint, s.ship.zone);
  if (isHere || radio) rememberZone(s, zone);
  if (isHere) {
    if (s.harbourCell) setCell(s, s.harbourCell, 'empty');
    s.harbourCell = null;
    if (s.ship.condition === 'moored') {
      s.ship.condition = 'green';
      emit(ctx, { type: 'unmoored' });
    }
  }
  emit(ctx, { type: 'harbour-lost', zone: { ...zoneAtPoint }, byUs, heard: isHere || radio });
}

/** A world gone for good. `cell` is set when it happened in the ship's own zone. */
export function worldDestroyed(ctx: Ctx, zoneAtPoint: Point, byUs: boolean, cell?: Point) {
  const { s } = ctx;
  const zone = zoneAt(s, zoneAtPoint);
  if (zone.world === null) return;
  const world = zone.world;
  if (cell) {
    setCell(s, cell, 'empty');
    s.worldCell = null;
  }
  if (zone.layout) zone.layout.world = null;
  if (byUs) s.tally.worldsLostByUs += 1;
  if (zone.distress !== null) {
    const pending = s.events.find((e) => e.id === zone.distress);
    if (pending) unschedule(ctx, pending);
    zone.distress = null;
  }
  zone.world = null;
  zone.stars -= 1;
  s.lostWorlds.push({ world, zone: { ...zoneAtPoint } });
  emit(ctx, { type: 'world-destroyed', world, zone: { ...zoneAtPoint }, byUs });
}

/**
 * Calls about a zone end when its gleaners are gone. Told is false when the zone emptied out of
 * the crew's sight; the event then lingers as a ghost the radio will clear up later.
 */
export function endCallsAt(ctx: Ctx, zoneAtPoint: Point, told: boolean) {
  const { s } = ctx;
  const zone = zoneAt(s, zoneAtPoint);
  for (const event of [...s.events]) {
    if (!samePoint(event.zone, zoneAtPoint)) continue;
    if (event.kind === 'harbour-falls') {
      if (told) {
        emit(ctx, { type: 'siege-lifted', zone: { ...zoneAtPoint } });
        unschedule(ctx, event);
      }
    } else if (event.kind === 'world-falls' || event.kind === 'swarm-grows') {
      if (told) {
        const wasDark = event.kind === 'swarm-grows';
        if (wasDark) s.tally.relit += 1;
        else s.tally.callsAnswered += 1;
        zone.distress = null;
        unschedule(ctx, event);
        if (event.world !== null)
          emit(ctx, {
            type: 'world-relit',
            world: event.world,
            zone: { ...zoneAtPoint },
            wasDark,
            byUs: true,
          });
      } else {
        event.ghost = true;
      }
    }
  }
}
