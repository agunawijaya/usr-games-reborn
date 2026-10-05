/**
 * Small pieces of card physics, independent of any renderer: springs that settle a card where
 * it belongs, the tilt a card takes from the speed it is dragged at, the arc a dealt card flies
 * along, and the squash of a card turning over.
 */

export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export const ease = {
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number) => {
    const c = 1.5;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  },
  outQuint: (t: number) => 1 - (1 - t) ** 5,
};

/** A value pulled towards a target by a spring; `step` advances it by `dt` seconds. */
export interface Spring {
  value: number;
  velocity: number;
}

/**
 * Advances a damped spring. `stiffness` around 200–400 settles a card in a quarter second;
 * `damping` near 2·√stiffness stops it without a wobble, lower lets it overshoot a little.
 */
export function stepSpring(
  spring: Spring,
  target: number,
  dt: number,
  stiffness = 320,
  damping = 2 * Math.sqrt(320) * 0.9,
): void {
  // Small fixed sub-steps keep the spring stable when a frame arrives late.
  let left = Math.min(dt, 0.1);
  while (left > 0) {
    const h = Math.min(left, 1 / 120);
    const force = (target - spring.value) * stiffness - spring.velocity * damping;
    spring.velocity += force * h;
    spring.value += spring.velocity * h;
    left -= h;
  }
}

export function isSettled(spring: Spring, target: number, epsilon = 0.05): boolean {
  return Math.abs(spring.value - target) < epsilon && Math.abs(spring.velocity) < epsilon * 10;
}

/**
 * The lean of a card dragged at this horizontal speed (pixels a second): the bottom trails, so
 * a card pulled right leans right, up to about eleven degrees.
 */
export function dragTilt(velocityX: number, maxRadians = 0.19): number {
  return clamp(velocityX / 2600, -1, 1) * maxRadians;
}

/** A point on the arc a dealt card flies along, rising by `lift` pixels at its height. */
export function arcPoint(from: Point, to: Point, lift: number, t: number): Point {
  const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

/**
 * A card turning over, `t` from 0 (back up) to 1 (face up): how wide it looks, which side shows,
 * and how much light its surface catches as it passes edge-on.
 */
export function flip(t: number): { scaleX: number; faceUp: boolean; sheen: number } {
  const angle = clamp(t, 0, 1) * Math.PI;
  return {
    scaleX: Math.max(0.02, Math.abs(Math.cos(angle))),
    faceUp: angle > Math.PI / 2,
    sheen: Math.sin(angle),
  };
}

/** How far apart two points are. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
