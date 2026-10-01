import { collapse, gleanersAttack } from './combat';
import { type Ctx, emit, franf, lose, ranf } from './context';
import { harbourLost } from './losses';
import {
  firstOf,
  isDown,
  reschedule,
  rescheduleRandom,
  schedule,
  scheduleRandom,
  unschedule,
} from './schedule';
import { type Point, REACH_SIZE, type ScheduledEvent, ZONE_CAPACITY, ZONE_SIZE } from './types';
import { enterZone, insideReach, measureGleaners, randomEmptyCell, setCell, zoneAt } from './zone';

/**
 * Letting time pass, the original's `events`: the reserve drains by one day per gleaner per
 * day, and whatever was due happens in date order. `throughPortal` is set when the days pass
 * outside the ship (a black hole, a time portal), so nothing aboard drains or recharges.
 */

const MAX_LIVE_CALLS = 5;
/** The original's ceiling on the whole swarm. */
const SWARM_CEILING = 127;

export function runEvents(ctx: Ctx, throughPortal: boolean) {
  const { s } = ctx;
  if (ctx.order.time <= 0) {
    s.now.time = s.now.reserve / s.now.gleaners;
    return;
  }
  s.ship.shroudSettled = true;
  const startDate = s.now.date;
  if (ctx.order.time > 0.5 && ctx.order.resting) schedule(ctx, 'raid', 0.5);
  let restCut = false;

  for (;;) {
    let until = startDate + ctx.order.time;
    let due: ScheduledEvent | undefined;
    for (const event of s.events) {
      if (event.ghost) continue;
      if (event.date < until) {
        until = event.date;
        due = event;
      }
    }
    const elapsed = Math.max(0, until - s.now.date);
    s.now.reserve -= s.now.gleaners * elapsed;
    s.now.time = s.now.reserve / s.now.gleaners;
    s.now.date = Math.max(s.now.date, until);
    if (s.now.time <= 0) lose(ctx, 'reserve-ran-dry');
    if (!due) break;
    const somethingMomentous = happen(ctx, due, startDate);
    if (somethingMomentous && ctx.order.resting) {
      // The original asked whether to cut the rest short; a keeper always does.
      ctx.order.time = s.now.date - startDate;
      restCut = true;
    }
  }

  const raid = firstOf(ctx, 'raid');
  if (raid) unschedule(ctx, raid);
  if (ctx.order.resting) emit(ctx, { type: 'rest', days: ctx.order.time, cut: restCut });
  if (!throughPortal) shipLivesThrough(ctx, ctx.order.time);
}

function shipLivesThrough(ctx: Ctx, days: number) {
  const { ship, params } = ctx.s;
  if (ship.shrouded) ship.energy -= params.shroudEnergy * days;
  const recovered = 1 - Math.exp(-params.regen * days);
  ship.shield = Math.trunc(ship.shield + (params.shield - ship.shield) * recovered);
  ship.energy = Math.trunc(ship.energy + (params.energy - ship.energy) * recovered);
  if (isDown(ctx, 'life-support') && ship.condition !== 'moored') ship.reserves -= days;
}

/** Runs one due event; true when it is news worth waking a resting crew for. */
function happen(ctx: Ctx, event: ScheduledEvent, startDate: number): boolean {
  switch (event.kind) {
    case 'collapse':
      collapse(ctx, null);
      rescheduleRandom(ctx, event, 1);
      return false;
    case 'snare':
      return snare(ctx, event, startDate);
    case 'siege-begins':
      return siegeBegins(ctx, event);
    case 'harbour-falls':
      harbourFalls(ctx, event);
      return false;
    case 'call':
      return callIssued(ctx, event);
    case 'world-falls':
      worldFalls(ctx, event);
      return false;
    case 'swarm-grows':
      swarmGrows(ctx, event);
      return false;
    case 'snapshot':
      rescheduleRandom(ctx, event, 1);
      ctx.s.snapshot = {
        zones: structuredClone(ctx.s.zones),
        events: structuredClone(ctx.s.events),
        now: structuredClone(ctx.s.now),
      };
      return false;
    case 'raid':
      if (!ctx.order.resting) {
        unschedule(ctx, event);
        return false;
      }
      emit(ctx, { type: 'raid' });
      gleanersAttack(ctx, true);
      reschedule(ctx, event, 0.5);
      return false;
    case 'repair':
      return repaired(ctx, event);
  }
}

/** A long-range snare drags the ship into a zone picked by where the swarm is thickest. */
function snare(ctx: Ctx, event: ScheduledEvent, startDate: number): boolean {
  const { s } = ctx;
  rescheduleRandom(ctx, event, s.now.gleaners);
  if (s.ship.condition === 'moored') return false;
  let pick = ranf(ctx, s.now.gleaners) + 1;
  let target: Point | null = null;
  for (let row = 0; row < REACH_SIZE && !target; row++) {
    for (let col = 0; col < REACH_SIZE; col++) {
      const zone = s.zones[row]![col]!;
      if (zone.stars < 0) continue;
      pick -= zone.gleaners;
      if (pick <= 0) {
        target = { row, col };
        break;
      }
    }
  }
  if (!target || (target.row === s.ship.zone.row && target.col === s.ship.zone.col)) return false;
  s.ship.zone = target;
  s.ship.cell = { row: ranf(ctx, ZONE_SIZE), col: ranf(ctx, ZONE_SIZE) };
  emit(ctx, { type: 'snared', to: { ...target } });
  enterZone(ctx);
  ctx.order.time = s.now.date - startDate;
  return false;
}

function siegeBegins(ctx: Ctx, event: ScheduledEvent): boolean {
  const { s } = ctx;
  if (s.now.harbours.length <= 0) {
    unschedule(ctx, event);
    return false;
  }
  const besieged = s.now.harbours.find((at) => {
    if (zoneAt(s, at).gleaners <= 0) return false;
    return !s.events.some(
      (other) =>
        other.kind === 'harbour-falls' && other.zone.row === at.row && other.zone.col === at.col,
    );
  });
  if (!besieged) {
    // Not yet: wait a while and see whether gleaners drift in.
    reschedule(ctx, event, 0.5 + 3 * franf(ctx));
    return false;
  }
  rescheduleRandom(ctx, event, 1);
  const fall = scheduleRandom(ctx, 'harbour-falls', 1, besieged);
  const heard = !isDown(ctx, 'radio');
  if (!heard) fall.hidden = true;
  emit(ctx, { type: 'siege', zone: { ...besieged }, deadline: fall.date, heard });
  return heard;
}

function harbourFalls(ctx: Ctx, event: ScheduledEvent) {
  unschedule(ctx, event);
  const zone = zoneAt(ctx.s, event.zone);
  // The harbour may be gone already, or the gleaners tired of it and left.
  if (!zone.harbour || zone.gleaners <= 0) return;
  harbourLost(ctx, event.zone, false);
}

function callIssued(ctx: Ctx, event: ScheduledEvent): boolean {
  const { s } = ctx;
  rescheduleRandom(ctx, event, 1);
  const live = s.events.filter((e) => e.kind === 'world-falls' || e.kind === 'swarm-grows').length;
  const counted = s.params.rules.callCapCountsLiveOnly ? live : s.ship.callsIssued;
  if (counted >= MAX_LIVE_CALLS) return false;
  let found: Point | null = null;
  for (let tries = 0; tries < 100; tries++) {
    const at = { row: ranf(ctx, REACH_SIZE), col: ranf(ctx, REACH_SIZE) };
    const zone = zoneAt(s, at);
    const isShipZone = at.row === s.ship.zone.row && at.col === s.ship.zone.col;
    if (isShipZone || zone.stars < 0 || zone.distress !== null || zone.world === null) continue;
    if (zone.gleaners <= 0) continue;
    found = at;
    break;
  }
  if (!found) return false;
  const zone = zoneAt(s, found);
  s.ship.callsIssued += 1;
  const fall = scheduleRandom(ctx, 'world-falls', 1, found, { world: zone.world });
  zone.distress = fall.id;
  const heard = !isDown(ctx, 'radio');
  if (!heard) fall.hidden = true;
  emit(ctx, { type: 'call', world: zone.world!, zone: { ...found }, deadline: fall.date, heard });
  return heard;
}

function worldFalls(ctx: Ctx, event: ScheduledEvent) {
  const { s } = ctx;
  unschedule(ctx, event);
  const zone = zoneAt(s, event.zone);
  if (zone.gleaners <= 0) {
    // The gleaners left on their own; the world is safe without anyone's help.
    zone.distress = null;
    if (!event.hidden && event.world !== null) {
      emit(ctx, {
        type: 'world-relit',
        world: event.world,
        zone: { ...event.zone },
        wasDark: false,
        byUs: false,
      });
    }
    return;
  }
  const growth = schedule(
    ctx,
    'swarm-grows',
    s.params.eventDelay['swarm-grows'] * franf(ctx),
    event.zone,
    {
      world: event.world,
    },
  );
  zone.distress = growth.id;
  const heard = !isDown(ctx, 'radio');
  if (!heard) growth.hidden = true;
  emit(ctx, { type: 'world-fell', world: event.world!, zone: { ...event.zone }, heard });
}

/** A fallen world builds one more gleaner; a full zone overflows into a neighbour. */
function swarmGrows(ctx: Ctx, event: ScheduledEvent) {
  const { s } = ctx;
  const origin = zoneAt(s, event.zone);
  if (origin.gleaners <= 0) {
    unschedule(ctx, event);
    origin.distress = null;
    if (!event.hidden && event.world !== null) {
      emit(ctx, {
        type: 'world-relit',
        world: event.world,
        zone: { ...event.zone },
        wasDark: true,
        byUs: false,
      });
    }
    return;
  }
  rescheduleRandom(ctx, event, 1);
  if (s.now.gleaners >= SWARM_CEILING) return;
  let at: Point = { ...event.zone };
  if (origin.gleaners >= ZONE_CAPACITY) {
    const room = neighbourWithRoom(ctx, at);
    if (!room) return;
    at = room;
  }
  const target = zoneAt(s, at);
  target.gleaners += 1;
  s.now.gleaners += 1;
  const isHere = at.row === s.ship.zone.row && at.col === s.ship.zone.col;
  if (isHere) {
    const cell = randomEmptyCell(ctx);
    setCell(s, cell, 'gleaner');
    s.gleaners.push({ ...cell, power: s.params.gleanerPower, dist: 0, avgDist: 0, hailed: 0 });
    measureGleaners(s, false);
    emit(ctx, { type: 'gleaner-arrived', at: cell });
  }
  emit(ctx, { type: 'swarm-grew', zone: at, here: isHere });
  const before = s.now.time;
  s.now.time = s.now.reserve / s.now.gleaners;
  emit(ctx, { type: 'clock', before, after: s.now.time });
}

function neighbourWithRoom(ctx: Ctx, from: Point): Point | null {
  for (let row = from.row - 1; row <= from.row + 1; row++) {
    for (let col = from.col - 1; col <= from.col + 1; col++) {
      if (!insideReach(row, col)) continue;
      const zone = zoneAt(ctx.s, { row, col });
      if (zone.gleaners >= ZONE_CAPACITY || zone.stars < 0) continue;
      return { row, col };
    }
  }
  return null;
}

function repaired(ctx: Ctx, event: ScheduledEvent): boolean {
  const { s } = ctx;
  const system = event.system!;
  unschedule(ctx, event);
  emit(ctx, { type: 'repaired', system });
  if (system === 'life-support') s.ship.reserves = s.params.reserves;
  if (system === 'navigation' && s.ship.condition !== 'moored') {
    s.ship.navigationUncalibrated = true;
    emit(ctx, { type: 'navigation-needs-harbour' });
  }
  if (system === 'radio') return playRadioBacklog(ctx);
  return false;
}

/** Whatever happened while the radio was out comes in at once. True if any of it is live. */
export function playRadioBacklog(ctx: Ctx): boolean {
  const { s } = ctx;
  let count = 0;
  let live = false;
  for (const event of [...s.events]) {
    if (!event.hidden) continue;
    count++;
    if (event.ghost) {
      unschedule(ctx, event);
      if (event.world !== null) {
        emit(ctx, {
          type: 'world-relit',
          world: event.world,
          zone: { ...event.zone },
          wasDark: false,
          byUs: false,
        });
      }
      continue;
    }
    event.hidden = false;
    live = true;
    if (event.kind === 'harbour-falls') {
      emit(ctx, { type: 'siege', zone: { ...event.zone }, deadline: event.date, heard: true });
    } else if (event.kind === 'world-falls' && event.world !== null) {
      emit(ctx, {
        type: 'call',
        world: event.world,
        zone: { ...event.zone },
        deadline: event.date,
        heard: true,
      });
    } else if (event.kind === 'swarm-grows' && event.world !== null) {
      emit(ctx, { type: 'world-fell', world: event.world, zone: { ...event.zone }, heard: true });
    }
  }
  if (count > 0) emit(ctx, { type: 'radio-backlog', count });
  return live;
}
