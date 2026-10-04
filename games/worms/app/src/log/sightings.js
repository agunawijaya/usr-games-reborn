// Abyssal Worms — sightings. Now and then the abyss does something worth noticing: two worms'
// paths cross, a worm curls over itself, one noses into a corner of the floor, or one blooms with
// light. A sighting is marked on the floor for a few seconds; click it (or press L) while it
// lasts to put it in the log. Nobody is rewarded for leaving the abyss running unwatched.
//
// Pure: it reads the engine's world after each step and never touches it, and its own chance and
// timing come from a separate generator, so the worms still move exactly as the original's did.

import { bodyCells } from '../engine/worms.js';

export const KINDS = Object.freeze({
  crossing: { name: 'Paths cross', note: 'Two worms passed over the same patch of floor.' },
  curl: { name: 'A curl', note: 'A worm crossed its own body, tying a loose knot of light.' },
  corner: { name: 'Corner dweller', note: 'A worm nosed into one of the far corners of the floor.' },
  bloom: { name: 'A bloom', note: 'A worm flared with light for a few heartbeats, then dimmed.' },
});
export const KIND_IDS = Object.freeze(Object.keys(KINDS));

/** How long a sighting stays to be clicked, and the quiet between two of them. */
export const SHOW_SECONDS = 4.5;
const QUIET_SECONDS = [7, 16];
const BLOOM_EVERY = [35, 80];

/** A small seeded generator (mulberry32), separate from the engine's own random(). */
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (random, [low, high]) => low + random() * (high - low);

/** A worm's head cell, or null before it has entered the floor. */
export function headOf(world, n) {
  const worm = world.worms[n];
  const x = worm?.xpos[worm.head];
  return x === undefined || x < 0 ? null : [x, worm.ypos[worm.head]];
}

/**
 * @typedef {{ kind: string, x: number, y: number, worm: number, born: number, until: number }} Sighting
 */
export class SightingWatch {
  /** @param {number} seed */
  constructor(seed, now = 0) {
    this.random = seeded(seed ^ 0x51ab1e);
    /** @type {Sighting | null} */
    this.active = null;
    this.quietUntil = now + between(this.random, QUIET_SECONDS);
    this.nextBloom = now + between(this.random, BLOOM_EVERY);
  }

  /**
   * Looks at the step just taken. Returns a new sighting when one begins.
   * @param {ReturnType<import('../engine/worms.js').createWorld>} world
   * @param {number} now seconds on the page's clock
   */
  afterStep(world, now) {
    if (this.active && now > this.active.until) this.active = null;
    if (this.active || now < this.quietUntil) return null;
    const found = now >= this.nextBloom ? this.bloom(world) : this.notice(world);
    if (!found) return null;
    if (found.kind === 'bloom') this.nextBloom = now + between(this.random, BLOOM_EVERY);
    this.active = { ...found, born: now, until: now + SHOW_SECONDS };
    this.quietUntil = this.active.until + between(this.random, QUIET_SECONDS);
    return this.active;
  }

  /** A worm to bloom: any one of them, chosen by our own chance. */
  bloom(world) {
    if (!world.worms.length) return null;
    const worm = Math.floor(this.random() * world.worms.length);
    const head = headOf(world, worm);
    return head ? { kind: 'bloom', x: head[0], y: head[1], worm } : null;
  }

  /** A bloom travels with its worm; the other sightings stay where they happened. */
  follow(world) {
    if (this.active?.kind !== 'bloom') return;
    const head = headOf(world, this.active.worm);
    if (head) [this.active.x, this.active.y] = head;
  }

  /** The rarer things a step can do, checked head by head. */
  notice(world) {
    // Every worm enters at the bottom-left corner (worms.c), so only the other three count.
    const corners = new Set([0, world.last, world.bottom * world.cols + world.last]);
    for (let worm = 0; worm < world.worms.length; worm++) {
      const head = headOf(world, worm);
      if (!head) continue;
      const [x, y] = head;
      const here = y * world.cols + x;
      if (corners.has(here) && this.random() < 0.6) return { kind: 'corner', x, y, worm };
      if (world.ref[here] < 2) continue;
      // bodyCells runs from the tail to the head: everything but the last cell is body.
      const ownBody = bodyCells(world, worm).slice(0, -1).some(([bx, by]) => bx === x && by === y);
      if (ownBody && this.random() < 0.7) return { kind: 'curl', x, y, worm };
      if (!ownBody && this.random() < 0.12) return { kind: 'crossing', x, y, worm };
    }
    return null;
  }

  /**
   * A click at cell (x, y): logs the active sighting if the click is close enough to it.
   * @returns {Sighting | null}
   */
  tryLog(x, y, now) {
    const s = this.active;
    if (!s || now > s.until) return null;
    if (x !== null && (Math.abs(x - s.x) > 3 || Math.abs(y - s.y) > 3)) return null;
    this.active = null;
    return s;
  }
}
