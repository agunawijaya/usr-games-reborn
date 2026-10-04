import { clamp01, easeInOut, easeOutCubic } from './shapes';

/**
 * The room-cleared payoff, as a timeline in milliseconds from the moment the last vacuum has
 * arrived. The camera eases in on the cat and the pile, the cat stretches proudly with a "mrrp",
 * the pile bounces under dizzy stars, then the view eases back and the trails draw onto the rug.
 * The panel's counter changes only when it is over. Every value here is a pure function of time,
 * so skipping simply jumps to `PAYOFF.end`.
 */

export const PAYOFF = {
  /** The camera starts after a breath, once the bonk has landed. */
  zoomIn: [120, 700],
  zoomOut: [1400, 2000],
  bounce: [420, 1120],
  stars: [420, 1900],
  /** The cat's turn comes once the bonk's word has faded, so the two never talk at once. */
  stretch: [700, 1450],
  mrrp: 820,
  trails: [1300, 2150],
  dim: [1300, 1800],
  end: 2250,
} as const;

/** How far along `range` the time `t` is, 0…1. */
function along(t: number, [from, to]: readonly [number, number]): number {
  return clamp01((t - from) / (to - from));
}

/** 0 → 1 as the camera eases in, 1 while it holds, back to 0 as it eases out. */
export function closeness(t: number): number {
  return easeInOut(along(t, PAYOFF.zoomIn)) * (1 - easeInOut(along(t, PAYOFF.zoomOut)));
}

/** The cat's proud stretch: taller and a touch narrower, then back. */
export function stretch(t: number): { sx: number; sy: number } {
  const u = along(t, PAYOFF.stretch);
  const bump = u > 0 && u < 1 ? Math.sin(u * Math.PI) : 0;
  return { sx: 1 - 0.06 * bump, sy: 1 + 0.16 * bump };
}

/** Two small hops for the pile, the second lower, squashing a little as it lands. */
export function bounce(t: number): { lift: number; sx: number; sy: number } {
  const u = along(t, PAYOFF.bounce);
  if (u <= 0 || u >= 1) return { lift: 0, sx: 1, sy: 1 };
  const hop = Math.abs(Math.sin(u * Math.PI * 2)) * (1 - u * 0.55);
  const squash = 1 - hop;
  return { lift: hop * 0.22, sx: 1 + squash * 0.08 * (1 - u), sy: 1 - squash * 0.08 * (1 - u) };
}

/** How visible the dizzy stars are: they fade in with the first hop and out at the end. */
export function starsAlpha(t: number): number {
  const u = along(t, PAYOFF.stars);
  if (u <= 0 || u >= 1) return 0;
  return Math.min(1, u * 6, (1 - u) * 4);
}

export function trailProgress(t: number): number {
  return easeOutCubic(along(t, PAYOFF.trails));
}

/** Everything but the cat and the pile dims as the trails come forward. */
export function dimming(t: number): number {
  return easeInOut(along(t, PAYOFF.dim));
}
