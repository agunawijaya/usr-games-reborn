import type { Point, PondLayout } from './layout';
import type { Look } from './look';

/**
 * "Go Fish!" as a cast: your rod at the bottom of the screen, its line arcing out to a float
 * that lands by the lily pad with a splash, bobs, dips under, and comes back up with a card on
 * the hook. Every piece is a pure function of the cast's age, so a still frame can show any
 * moment of it.
 */

type Ctx = CanvasRenderingContext2D;

/** The moments of a cast, in seconds from its start. */
export const CAST = {
  windUp: 0.22,
  flight: 0.62,
  landed: 0.84,
  bite: 1.28,
  reeled: 2.05,
  home: 2.5,
} as const;

export interface CastPicture {
  /** Where the line ends: the float, or the hook with its card. */
  end: Point;
  /** The rod's lean back for the cast and forward again, in radians. */
  rodLean: number;
  /** 0 slack … 1 taut. */
  tension: number;
  floatVisible: boolean;
  /** Under the water at the bite, 0 … 1. */
  dip: number;
  /** The card on the hook, once it leaves the water: how far out (0 … 1). */
  cardOut: number;
}

/** The landing water: a little left of the pile's pad, nearer you. */
export function landingPoint(layout: PondLayout): Point {
  return { x: layout.pile.x - 190 * layout.s, y: layout.pile.y + 64 * layout.s };
}

export function rodBase(layout: PondLayout): Point {
  return { x: layout.rodTip.x - 120 * layout.s, y: layout.height + 40 * layout.s };
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function castAt(layout: PondLayout, age: number): CastPicture {
  const landing = landingPoint(layout);
  const tip = layout.rodTip;
  if (age < CAST.windUp) {
    return {
      end: tip,
      rodLean: -0.35 * easeOut(age / CAST.windUp),
      tension: 0.2,
      floatVisible: true,
      dip: 0,
      cardOut: 0,
    };
  }
  if (age < CAST.landed) {
    const t = easeOut(clamp01((age - CAST.windUp) / (CAST.landed - CAST.windUp)));
    // The float's arc: up and over, falling onto the water.
    const x = tip.x + (landing.x - tip.x) * t;
    const y = tip.y + (landing.y - tip.y) * t - Math.sin(t * Math.PI) * 220 * layout.s;
    return {
      end: { x, y },
      rodLean: -0.35 + 0.6 * t,
      tension: 0.1,
      floatVisible: true,
      dip: 0,
      cardOut: 0,
    };
  }
  if (age < CAST.bite) {
    const t = (age - CAST.landed) / (CAST.bite - CAST.landed);
    const bob = Math.sin(t * Math.PI * 3) * 4 * layout.s * (1 - t);
    const dip = t > 0.7 ? (t - 0.7) / 0.3 : 0;
    return {
      end: { x: landing.x, y: landing.y + bob + dip * 8 * layout.s },
      rodLean: 0.25,
      tension: 0.3 + dip * 0.5,
      floatVisible: true,
      dip,
      cardOut: 0,
    };
  }
  // Reeling in: the rod bends back, the card comes up out of the water and swings on the line.
  const t = clamp01((age - CAST.bite) / (CAST.reeled - CAST.bite));
  const rise = easeOut(t);
  return {
    end: {
      x: landing.x + (tip.x - landing.x) * rise * 0.45,
      y: landing.y - rise * 150 * layout.s,
    },
    rodLean: 0.25 - rise * 0.45,
    tension: 1,
    floatVisible: false,
    dip: 0,
    cardOut: rise,
  };
}

/**
 * The rod from its handle at the bottom of the screen; with a fish (or a card) on the line it
 * bends towards the catch, the tip pulled most.
 */
export function drawRod(
  ctx: Ctx,
  layout: PondLayout,
  look: Look,
  lean: number,
  pull: Point | null,
): Point {
  const base = rodBase(layout);
  const length = Math.hypot(layout.rodTip.x - base.x, layout.rodTip.y - base.y);
  const angle = Math.atan2(layout.rodTip.y - base.y, layout.rodTip.x - base.x) + lean;
  const straightTip = {
    x: base.x + Math.cos(angle) * length,
    y: base.y + Math.sin(angle) * length,
  };
  const along = (t: number): Point => {
    if (!pull)
      return { x: base.x + (straightTip.x - base.x) * t, y: base.y + (straightTip.y - base.y) * t };
    const bend = t * t * 0.22 * length;
    const towards = Math.atan2(pull.y - straightTip.y, pull.x - straightTip.x);
    return {
      x: base.x + (straightTip.x - base.x) * t + Math.cos(towards) * bend,
      y: base.y + (straightTip.y - base.y) * t + Math.sin(towards) * bend,
    };
  };
  const tip = along(1);
  ctx.save();
  ctx.lineCap = 'round';
  // A cane rod, thick at the handle and fine at the tip.
  for (let i = 0; i < 16; i++) {
    const a = i / 16;
    const from = along(a);
    const to = along((i + 1) / 16);
    ctx.strokeStyle = i < 4 ? look.wood.shade : look.wood.light;
    ctx.lineWidth = (9 - a * 7) * layout.s;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  // The reel near the handle.
  const reel = along(0.2);
  ctx.fillStyle = look.dark ? '#8a8f99' : '#c5ccd4';
  ctx.beginPath();
  ctx.arc(reel.x + 8 * layout.s, reel.y + 6 * layout.s, 13 * layout.s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = look.dark ? '#5a5f69' : '#7d858e';
  ctx.lineWidth = 2 * layout.s;
  ctx.stroke();
  ctx.restore();
  return tip;
}

/** The line from the rod's tip to its end, sagging when slack and straight when taut. */
export function drawLine(
  ctx: Ctx,
  from: Point,
  to: Point,
  tension: number,
  look: Look,
  s: number,
): void {
  const sag = (1 - tension) * Math.min(160, Math.hypot(to.x - from.x, to.y - from.y) * 0.3) * s;
  ctx.strokeStyle = look.line;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo((from.x + to.x) / 2, (from.y + to.y) / 2 + sag, to.x, to.y);
  ctx.stroke();
}

export function drawFloat(ctx: Ctx, at: Point, dip: number, look: Look, s: number): void {
  const r = 9 * s;
  ctx.save();
  ctx.translate(at.x, at.y);
  // Under the water line only the top shows.
  ctx.beginPath();
  ctx.rect(-r * 2, -r * 3, r * 4, r * 3 + r * (1 - dip) * 0.6);
  ctx.clip();
  ctx.fillStyle = look.float.bottom;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.float.top;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = look.float.band;
  ctx.fillRect(-r, -1.2 * s, r * 2, 2.4 * s);
  ctx.strokeStyle = look.float.band;
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(0, -r - 8 * s);
  ctx.stroke();
  ctx.restore();
}

/**
 * Water thrown up by the float, or by a card leaving the pond: a crown of water round the spot
 * and drops flying out on arcs, falling back as they go.
 */
export function drawSpray(
  ctx: Ctx,
  at: Point,
  age: number,
  look: Look,
  s: number,
  strength = 1,
): void {
  if (age < 0 || age > 0.9) return;
  const fade = Math.max(0, 1 - age / 0.9);
  ctx.save();
  ctx.fillStyle = look.spray;
  ctx.strokeStyle = look.spray;
  ctx.lineCap = 'round';
  // The crown: short jets round an ellipse, rising then sinking back.
  const crown = Math.sin(Math.min(1, age / 0.5) * Math.PI);
  const ring = (14 + age * 40) * s * strength;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = at.x + Math.cos(a) * ring;
    const y = at.y + Math.sin(a) * ring * 0.34;
    const jet = (12 + (i % 3) * 6) * s * crown * strength;
    ctx.globalAlpha = fade * (Math.sin(a) > 0 ? 0.95 : 0.6);
    ctx.lineWidth = 3.4 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * jet * 0.3, y - jet);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * jet * 0.3, y - jet - 2 * s, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 22; i++) {
    const angle = -Math.PI / 2 + (i - 10.5) * 0.12;
    const speed = (110 + (i % 5) * 46) * s * strength;
    const x = at.x + Math.cos(angle) * speed * age;
    const y = at.y + Math.sin(angle) * speed * age + 460 * s * age * age;
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.arc(x, y, (4.2 - (i % 4) * 0.8) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
