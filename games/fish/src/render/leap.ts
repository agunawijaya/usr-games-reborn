import { type CardId, type CardSprites, type Rank } from '@usr-games/kit/cards';
import { drawCardAt } from './cards';
import { drawFish } from './fish/draw';
import { speciesFor } from './fish/species';
import type { Point } from './layout';
import type { Look } from './look';
import { star } from './rivals/common';

/**
 * A book becoming its fish: the four cards fly up from the hand and gather in a fan, light runs
 * between them, they fold together into the rank's fish, and the fish leaps in an arc into the
 * bucket. A golden fish leaps higher, trailing more sparkle. Pure in its age, like every effect.
 */

type Ctx = CanvasRenderingContext2D;

export const LEAP = {
  gathered: 0.5,
  fused: 0.82,
  /** The cards linger, fading, while the fish springs out of them. */
  faded: 1.25,
  landed: 2.0,
  done: 2.3,
} as const;

export interface LeapPicture {
  rank: Rank;
  golden: boolean;
  cards: readonly CardId[];
  /** Where each card started, in the hand. */
  from: readonly Point[];
  /** The gathering point above the hand. */
  gather: Point;
  /** The bucket's mouth. */
  to: Point;
  age: number;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function drawLeap(
  ctx: Ctx,
  sprites: CardSprites,
  leap: LeapPicture,
  look: Look,
  s: number,
): void {
  const { age, gather } = leap;
  const fanAngle = (i: number) => (i - 1.5) * 0.24;
  if (age < LEAP.faded) {
    const fly = easeOut(clamp01(age / LEAP.gathered));
    const fuse = clamp01((age - LEAP.gathered) / (LEAP.fused - LEAP.gathered));
    const fade = clamp01((age - LEAP.fused) / (LEAP.faded - LEAP.fused));
    drawGlow(ctx, gather, (80 + fuse * 70) * s, fuse * (1 - fade * 0.7), look);
    drawBurst(ctx, gather, age - LEAP.fused, look, s, leap.golden);
    leap.cards.forEach((card, i) => {
      const start = leap.from[i] ?? gather;
      // A fan of the four, drawing together as they fuse but never hiding one another.
      const spread = (34 + (1 - fuse) * 22) * s;
      const target = { x: gather.x + (i - 1.5) * spread, y: gather.y + Math.abs(i - 1.5) * 8 * s };
      drawCardAt(ctx, sprites, card, {
        x: start.x + (target.x - start.x) * fly,
        y: start.y + (target.y - start.y) * fly - Math.sin(fly * Math.PI) * 40 * s,
        angle: fanAngle(i) * (1 - fuse * 0.35),
        scale: 0.96,
        lift: 0.7,
        alpha: 1 - fade * 0.9,
        glow:
          fuse > 0.2
            ? leap.golden
              ? 'rgba(255, 210, 90, 0.95)'
              : 'rgba(255, 255, 255, 0.95)'
            : undefined,
      });
    });
  }
  if (age < LEAP.fused) return;
  drawFishFlight(ctx, leap, look, s);
}

/** The moment of fusing: a ring of light flying out from the four cards. */
function drawBurst(ctx: Ctx, at: Point, age: number, look: Look, s: number, golden: boolean): void {
  if (age < 0 || age > 0.5) return;
  const t = age / 0.5;
  const colour = golden ? look.gold.light : look.dark ? '#fff1c4' : '#ffffff';
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.globalAlpha = 1 - t;
  ctx.lineWidth = (8 - t * 6) * s;
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, (40 + t * 150) * s, (30 + t * 110) * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const r = (60 + t * 170) * s;
    star(ctx, at.x + Math.cos(a) * r, at.y + Math.sin(a) * r * 0.75, (6 - t * 4) * s);
    ctx.fill();
  }
  ctx.restore();
}

function drawGlow(ctx: Ctx, at: Point, radius: number, strength: number, look: Look): void {
  if (strength <= 0) return;
  const glow = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, radius);
  glow.addColorStop(
    0,
    look.dark
      ? `rgba(255, 236, 170, ${0.9 * strength})`
      : `rgba(255, 255, 255, ${0.95 * strength})`,
  );
  glow.addColorStop(
    0.5,
    look.dark
      ? `rgba(255, 210, 110, ${0.35 * strength})`
      : `rgba(255, 246, 210, ${0.45 * strength})`,
  );
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(at.x - radius, at.y - radius, radius * 2, radius * 2);
}

/** Where the leaping fish is: a high arc from the gathering point to the bucket. */
export function fishFlight(
  leap: LeapPicture,
  s: number,
): { x: number; y: number; angle: number; t: number } {
  // Steady across, rising and falling: a real leap's parabola, sped a little at both ends.
  const t = clamp01((leap.age - LEAP.fused) / (LEAP.landed - LEAP.fused));
  const height = (leap.golden ? 300 : 230) * s;
  // It springs from just above the fan, so the cards it came from stay in view.
  const from = { x: leap.gather.x, y: leap.gather.y - 80 * s };
  const x = from.x + (leap.to.x - from.x) * t;
  const y = from.y + (leap.to.y - from.y) * t - Math.sin(t * Math.PI) * height;
  const dx = leap.to.x - from.x;
  const dy = leap.to.y - from.y - Math.cos(t * Math.PI) * Math.PI * height;
  return { x, y, angle: Math.atan2(dy, dx), t };
}

function drawFishFlight(ctx: Ctx, leap: LeapPicture, look: Look, s: number): void {
  const flight = fishFlight(leap, s);
  if (flight.t >= 1) return;
  const species = speciesFor(leap.rank);
  const grow = easeOut(clamp01((leap.age - LEAP.fused) / 0.22));
  const length = (190 + species.size * 60) * s * (0.4 + grow * 0.6);
  // Droplets and sparkles trailing behind, along the path already flown.
  for (let k = 1; k <= 10; k++) {
    const back = { ...leap, age: leap.age - k * 0.045 };
    if (back.age < LEAP.fused) break;
    const p = fishFlight(back, s);
    ctx.globalAlpha = (1 - k / 11) * 0.85;
    ctx.fillStyle = leap.golden ? look.gold.light : look.spray;
    if (k % 2 === 0 || leap.golden) {
      star(
        ctx,
        p.x + Math.sin(k * 3.1) * 12 * s,
        p.y + Math.cos(k * 2.3) * 10 * s,
        (3 + (k % 3) * 2) * s,
      );
    } else {
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(k * 5.7) * 14 * s, p.y + 8 * s, 3.2 * s, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (leap.golden) drawGlow(ctx, flight, length * 0.9, 0.8, look);
  const facingLeft = Math.cos(flight.angle) < 0;
  drawFish(ctx, species, {
    x: flight.x,
    y: flight.y,
    length,
    angle: facingLeft ? flight.angle - Math.PI : flight.angle,
    flip: facingLeft,
    // Head up as it rises, a curl at the top, head down as it dives for the bucket.
    pose: { arch: 0.75 - flight.t * 1.2, wiggle: 0.55, phase: leap.age * 14 },
    golden: leap.golden,
    gold: look.gold,
    time: leap.age * 1.3,
  });
}
