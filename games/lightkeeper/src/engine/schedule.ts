import { type Ctx, emit, franfOpen } from './context';
import type { EventKind, Point, ScheduledEvent, SystemId } from './types';

/**
 * The event list: every future happening in the Reach has a date. The original kept 25 fixed
 * slots; a list does the same job. Delays are exponential, so the Reach never keeps a rhythm
 * the player could learn by heart.
 */

const NOWHERE: Point = { row: 0, col: 0 };

export function schedule(
  ctx: Ctx,
  kind: EventKind,
  offset: number,
  zone: Point = NOWHERE,
  extra: { world?: number | null; system?: SystemId | null } = {},
): ScheduledEvent {
  const event: ScheduledEvent = {
    id: ctx.s.nextEventId++,
    kind,
    date: ctx.s.now.date + offset,
    zone: { ...zone },
    world: extra.world ?? null,
    system: extra.system ?? null,
    hidden: false,
    ghost: false,
  };
  ctx.s.events.push(event);
  return event;
}

export function reschedule(ctx: Ctx, event: ScheduledEvent, offset: number) {
  event.date = ctx.s.now.date + offset;
}

export function unschedule(ctx: Ctx, event: ScheduledEvent) {
  ctx.s.events = ctx.s.events.filter((other) => other.id !== event.id);
}

/** A delay drawn the way the original drew them: the kind's multiplier, the watch length, chance. */
export function randomDelay(ctx: Ctx, kind: EventKind, divisor: number): number {
  const { eventDelay, time } = ctx.s.params;
  return (-eventDelay[kind] * time * Math.log(franfOpen(ctx))) / Math.max(1, divisor);
}

export function scheduleRandom(
  ctx: Ctx,
  kind: EventKind,
  divisor: number,
  zone?: Point,
  extra?: { world?: number | null; system?: SystemId | null },
): ScheduledEvent {
  return schedule(ctx, kind, randomDelay(ctx, kind, divisor), zone, extra);
}

export function rescheduleRandom(ctx: Ctx, event: ScheduledEvent, divisor: number) {
  reschedule(ctx, event, randomDelay(ctx, event.kind, divisor));
}

export function firstOf(ctx: Ctx, kind: EventKind): ScheduledEvent | undefined {
  let found: ScheduledEvent | undefined;
  for (const event of ctx.s.events) {
    if (event.kind === kind && (!found || event.date < found.date)) found = event;
  }
  return found;
}

export function isDown(ctx: Ctx, system: SystemId): boolean {
  return ctx.s.events.some((event) => event.kind === 'repair' && event.system === system);
}

/** Adds repair time to a system, scheduling the repair if it was working. */
export function damage(ctx: Ctx, system: SystemId, days: number) {
  if (days <= 0) return;
  const repairDays =
    ctx.s.ship.condition === 'moored' ? days * ctx.s.params.mooredRepairFactor : days;
  const existing = ctx.s.events.find((event) => event.kind === 'repair' && event.system === system);
  if (existing) existing.date += repairDays;
  else schedule(ctx, 'repair', repairDays, NOWHERE, { system });
  emit(ctx, { type: 'damaged', system, days: repairDays });
}

/** Scales every pending repair, as mooring and leaving a harbour did. */
export function scaleRepairs(ctx: Ctx, factor: number) {
  for (const event of ctx.s.events) {
    if (event.kind === 'repair') reschedule(ctx, event, (event.date - ctx.s.now.date) * factor);
  }
}
