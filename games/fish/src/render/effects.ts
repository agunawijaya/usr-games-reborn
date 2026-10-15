import { type CardId, type CardSprites, type Rank } from '@usr-games/kit/cards';
import { arcPoint } from '@usr-games/kit/cards';
import { drawCardAt } from './cards';
import { drawFish } from './fish/draw';
import { speciesFor } from './fish/species';
import type { Point, PondLayout } from './layout';
import type { Look } from './look';
import { star } from './rivals/common';

/**
 * The moving pieces of play that are not the signature cast and leap: cards flying between
 * seats or out of the pond, a rival's book leaping as its fish and diving back into the water,
 * and the end of the game, when every player's fish swim one lap of the pond. Each is a pure
 * function of its age.
 */

type Ctx = CanvasRenderingContext2D;

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export interface Flight {
  /** `null` flies face down the whole way. */
  card: CardId | null;
  from: Point;
  to: Point;
  age: number;
  duration: number;
  /** Turn face up on the way (a card arriving in your hand, a lucky catch shown). */
  turnUp?: boolean;
  /** Start and end size, 1 being the hand's. */
  fromScale?: number;
  toScale?: number;
  glow?: string;
  /** Wait this long before setting off, so a handful flies one after another. */
  delay?: number;
}

export function drawFlight(ctx: Ctx, sprites: CardSprites, flight: Flight, s: number): void {
  const t = easeInOut(clamp01((flight.age - (flight.delay ?? 0)) / flight.duration));
  if (flight.age < (flight.delay ?? 0)) return;
  const lift =
    Math.min(160, Math.hypot(flight.to.x - flight.from.x, flight.to.y - flight.from.y) * 0.25) * s;
  const at = arcPoint(flight.from, flight.to, lift, t);
  const scale = (flight.fromScale ?? 0.6) + ((flight.toScale ?? 1) - (flight.fromScale ?? 0.6)) * t;
  drawCardAt(ctx, sprites, flight.card, {
    x: at.x,
    y: at.y,
    angle: Math.sin(t * Math.PI) * 0.35 * Math.sign(flight.to.x - flight.from.x || 1),
    scale,
    turn: flight.card === null ? 0 : flight.turnUp ? t : 1,
    lift: Math.sin(t * Math.PI),
    glow: flight.glow,
  });
}

export interface RivalLeap {
  rank: Rank;
  golden: boolean;
  /** Where the rival holds its cards; the fish springs from there. */
  from: Point;
  /** Where it dives back into the pond. */
  to: Point;
  age: number;
}

export const RIVAL_LEAP_TIME = 1.3;

/** A rival's book springs up as its fish and dives into the water in front of them. */
export function drawRivalLeap(ctx: Ctx, leap: RivalLeap, look: Look, s: number): void {
  const t = clamp01(leap.age / RIVAL_LEAP_TIME);
  if (t >= 1) return;
  const height = 120 * s;
  const x = leap.from.x + (leap.to.x - leap.from.x) * t;
  const y = leap.from.y + (leap.to.y - leap.from.y) * t - Math.sin(t * Math.PI) * height;
  const dx = leap.to.x - leap.from.x;
  const dy = leap.to.y - leap.from.y - Math.cos(t * Math.PI) * Math.PI * height;
  const angle = Math.atan2(dy, dx);
  const facingLeft = Math.cos(angle) < 0;
  const species = speciesFor(leap.rank);
  const grow = clamp01(t / 0.2);
  if (t < 0.25) {
    // The flash of the book becoming its fish.
    const glow = ctx.createRadialGradient(
      leap.from.x,
      leap.from.y,
      0,
      leap.from.x,
      leap.from.y,
      70 * s,
    );
    glow.addColorStop(0, leap.golden ? 'rgba(255, 220, 120, 0.9)' : 'rgba(255, 255, 255, 0.85)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.globalAlpha = 1 - t / 0.25;
    ctx.fillStyle = glow;
    ctx.fillRect(leap.from.x - 70 * s, leap.from.y - 70 * s, 140 * s, 140 * s);
    ctx.globalAlpha = 1;
  }
  drawFish(ctx, species, {
    x,
    y,
    length: (110 + species.size * 30) * s * (0.4 + grow * 0.6),
    angle: facingLeft ? angle - Math.PI : angle,
    flip: facingLeft,
    pose: { arch: 0.6 - t * 1.1, wiggle: 0.5, phase: leap.age * 14 },
    golden: leap.golden,
    gold: look.gold,
    time: leap.age,
  });
  if (leap.golden) {
    ctx.fillStyle = look.gold.light;
    for (let i = 0; i < 4; i++) {
      star(
        ctx,
        x + Math.sin(i * 2.4 + leap.age * 6) * 40 * s,
        y + Math.cos(i * 1.7) * 30 * s,
        4 * s,
      );
      ctx.fill();
    }
  }
}

export interface LapFish {
  rank: Rank;
  golden: boolean;
  /** 0 for you, 1–3 for the rivals: each player's fish swim together. */
  owner: number;
}

export const LAP_TIME = 4.2;

/**
 * The end of the game: every fish caught swims one lap round the pond, each player's together,
 * yours leading, then the results.
 */
export function drawLap(
  ctx: Ctx,
  layout: PondLayout,
  fish: readonly LapFish[],
  age: number,
  look: Look,
): void {
  if (fish.length === 0) return;
  const { pond, s } = layout;
  const lap = clamp01(age / LAP_TIME);
  const rx = pond.rx * 0.74;
  const ry = pond.ry * 0.62;
  const cy = pond.cy + pond.ry * 0.06;
  // Fade in and out, so the procession surfaces and sinks rather than popping.
  const fade = Math.min(1, age / 0.4, (LAP_TIME - age) / 0.5);
  const spacing = 0.05;
  const groupGap = 0.05;
  let offset = 0;
  let previousOwner = fish[0]!.owner;
  fish.forEach((one, i) => {
    if (one.owner !== previousOwner) {
      offset += groupGap;
      previousOwner = one.owner;
    }
    const along = lap - i * spacing - offset;
    const angle = Math.PI / 2 + along * Math.PI * 2;
    const x = pond.cx + Math.cos(angle) * rx;
    const y = cy + Math.sin(angle) * ry;
    const vx = -Math.sin(angle) * rx;
    const vy = Math.cos(angle) * ry;
    const heading = Math.atan2(vy, vx);
    const facingLeft = vx < 0;
    const species = speciesFor(one.rank);
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    drawFish(ctx, species, {
      x,
      y,
      length: (60 + species.size * 26) * s,
      angle: facingLeft ? heading - Math.PI : heading,
      flip: facingLeft,
      pose: { arch: 0, wiggle: 0.8, phase: age * 9 + i },
      golden: one.golden,
      gold: look.gold,
      time: age + i,
    });
    ctx.restore();
  });
}
