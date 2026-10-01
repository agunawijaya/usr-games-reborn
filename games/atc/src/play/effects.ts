import { sameCell } from '../engine/geometry';
import { movesOnTick, type Plane, type SkyEvent, type World } from '../engine/world';
import type { Burst, Pearl, Ripple } from '../render/radar';

/**
 * What the radar shows on top of the sky after things happen: approach lights rippling for a
 * landing, the pearls of a string of landings, the burst of a loss. It also keeps count of the
 * string itself: landings on consecutive ticks.
 */

const RIPPLE_SECONDS = 3.5;

export class SkyEffects {
  ripples: Ripple[] = [];
  bursts: Burst[] = [];
  /** Landings in the string still going: the last landing was on the last tick, or this one. */
  pearls: Pearl[] = [];
  stringLength = 0;
  longestString = 0;
  private lastLandingTick = -10;

  /** Records the tick's events at animation time `now` (seconds); returns the string length if a landing joined it. */
  apply(events: readonly SkyEvent[], world: World, now: number): { landed: number | null } {
    this.forget(now);
    let landed: number | null = null;
    for (const event of events) {
      if (event.kind === 'arrived' && event.at.kind === 'runway') {
        this.ripples.push({ runway: event.at.index, start: now, order: this.stringLength });
        if (event.tick === this.lastLandingTick + 1) this.stringLength += 1;
        else if (event.tick !== this.lastLandingTick) {
          this.stringLength = 1;
          this.pearls = [];
        } else this.stringLength += 1;
        this.lastLandingTick = event.tick;
        this.longestString = Math.max(this.longestString, this.stringLength);
        this.pearls.push({ runway: event.at.index, start: now });
        landed = this.stringLength;
      }
      if (event.kind === 'lost') {
        const plane = world.air.find((p) => p.letter === event.loss.letter);
        const other =
          event.loss.reason.kind === 'separation'
            ? world.air.find((p) => p.letter === (event.loss.reason as { other: number }).other)
            : undefined;
        if (plane) {
          const x = other ? (plane.x + other.x) / 2 : plane.x;
          const y = other ? (plane.y + other.y) / 2 : plane.y;
          const altitude = other ? (plane.altitude + other.altitude) / 2 : plane.altitude;
          this.bursts.push({ x: x + 0.5, y: y + 0.5, altitude, start: now });
        }
      }
    }
    // A tick without a landing ends the string.
    if (landed === null && world.clock > this.lastLandingTick) {
      this.stringLength = 0;
      this.pearls = [];
    }
    return { landed };
  }

  private forget(now: number): void {
    this.ripples = this.ripples.filter((r) => now - r.start < RIPPLE_SECONDS);
  }
}

/** The tick a plane on a route to its own runway will touch down, if it keeps flying it. */
export function landingTick(world: World, plane: Plane): number | null {
  if (plane.destination.kind !== 'runway' || plane.route.length === 0 || plane.onGround)
    return null;
  const runway = world.arena.runways[plane.destination.index]!;
  if (!sameCell(plane.route[plane.route.length - 1]!, runway)) return null;
  if (plane.altitude > plane.route.length) return null;
  let moves = plane.route.length;
  let t = world.clock;
  while (moves > 0) {
    t += 1;
    if (movesOnTick(plane, t)) moves -= 1;
  }
  return t;
}

/**
 * The planes lined up to keep the string going: one landing on each tick after the last landing,
 * in order, for as long as there is one.
 */
export function stringQueue(world: World, effects: SkyEffects): number[] {
  if (effects.stringLength === 0) return [];
  const byTick = new Map<number, number>();
  for (const plane of world.air) {
    const t = landingTick(world, plane);
    if (t !== null && !byTick.has(t)) byTick.set(t, plane.letter);
  }
  const queue: number[] = [];
  for (let t = world.clock + 1; byTick.has(t); t++) queue.push(byTick.get(t)!);
  return queue;
}
