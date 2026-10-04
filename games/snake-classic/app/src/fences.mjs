// Talon's Shadow — fences. From the River on, a region puts a fence across the field in the
// shape of a letter. Neither the snake nor its rivals can slither through one: a head that meets
// a fence slides along it. The bird flies over. Pure geometry on the 900 × 600 field.

export const FIELD = Object.freeze({ width: 900, height: 600 });

/** How thick a fence is, in pixels. */
const THICK = 12;

/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */

/** A horizontal stretch of fence from x1 to x2 at height y. */
const across = (x1, x2, y) => ({ x: x1, y: y - THICK / 2, w: x2 - x1, h: THICK });
/** A vertical stretch of fence from y1 to y2 at x. */
const down = (x, y1, y2) => ({ x: x - THICK / 2, y: y1, w: THICK, h: y2 - y1 });

/**
 * The layouts by name: each letter is drawn round the middle of the field, with room to pass
 * between it and every edge.
 * @type {Readonly<Record<string, readonly Rect[]>>}
 */
export const LAYOUTS = Object.freeze({
  none: [],
  I: [down(450, 170, 430)],
  T: [across(290, 610, 190), down(450, 190, 440)],
  H: [down(330, 170, 430), down(570, 170, 430), across(330, 570, 300)],
  plus: [across(280, 620, 300), down(450, 160, 440)],
  // A walled yard with a gate in its west and east walls.
  O: [
    across(320, 580, 190),
    across(320, 580, 410),
    down(320, 190, 250),
    down(320, 350, 410),
    down(580, 190, 250),
    down(580, 350, 410),
  ],
  U: [down(320, 180, 420), down(580, 180, 420), across(320, 580, 420)],
  HH: [
    down(200, 180, 420),
    down(360, 180, 420),
    across(200, 360, 300),
    down(540, 180, 420),
    down(700, 180, 420),
    across(540, 700, 300),
  ],
});

/** How each layout reads in a briefing. */
export const LAYOUT_NAMES = Object.freeze({
  none: 'open ground, no fence',
  I: 'a fence like an I down the middle',
  T: 'a fence like a T',
  H: 'a fence like an H',
  plus: 'a fence like a plus sign',
  O: 'a walled yard with a gate east and west',
  U: 'a fence like a U, open to the north',
  HH: 'two H-shaped fences',
});

/**
 * Where the snake starts: the middle of the field as in the port, or below the fence when there
 * is one, so its body never starts across a fence.
 */
export function startFor(layout) {
  return layout === 'none' ? { x: 450, y: 300 } : { x: 450, y: 515 };
}

/** The distance from (x, y) to the nearest fence; 0 inside one. */
export function clearance(x, y, rects) {
  let nearest = Infinity;
  for (const r of rects) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
    nearest = Math.min(nearest, Math.hypot(dx, dy));
  }
  return nearest;
}

/** True when (x, y) is at least `margin` from every fence. */
export function isClear(x, y, margin, rects) {
  return clearance(x, y, rects) >= margin;
}

/**
 * Moves a point (a head of `radius`) out of any fence it has run into, by the shortest way, so
 * a head driven into a fence slides along it. Returns true when it touched one.
 * @param {{ x: number, y: number }} point
 */
export function pushOut(point, radius, rects) {
  let touched = false;
  for (const r of rects) {
    const left = r.x - radius;
    const right = r.x + r.w + radius;
    const top = r.y - radius;
    const bottom = r.y + r.h + radius;
    if (point.x <= left || point.x >= right || point.y <= top || point.y >= bottom) continue;
    const ways = [
      { d: point.x - left, x: left, y: point.y },
      { d: right - point.x, x: right, y: point.y },
      { d: point.y - top, x: point.x, y: top },
      { d: bottom - point.y, x: point.x, y: bottom },
    ];
    const shortest = ways.reduce((best, way) => (way.d < best.d ? way : best));
    point.x = shortest.x;
    point.y = shortest.y;
    touched = true;
  }
  return touched;
}

/** True when the straight line from (x1, y1) to (x2, y2) passes within `margin` of a fence. */
export function crossesFence(x1, y1, x2, y2, margin, rects) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isClear(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, margin, rects)) return true;
  }
  return false;
}
