import { type CarModel, type CarPose, drawCar } from './car';
import type { CarInk } from './look';
import {
  type Ctx,
  DISPLAY_FONT,
  alpha,
  circle,
  fillWith,
  hash01,
  mix,
  poly,
  roundRect,
  strokeWith,
} from './paint';
import type { Route, RoutePalette } from './routes';
import { layerShift, paintRail, paintScenery, paintVergeProps } from './scenery';

/**
 * The road strip: a coast road seen side on, in flat poster layers that slide past at their own
 * pace as the camera follows the cars. Miles are the road's own unit: a car stands at its
 * mileage, the posts mark every hundred, and a chequered flag waits at the trip's end.
 */

export type Trouble = 'noFuel' | 'flatTyre' | 'fenderBender' | 'redLight' | 'slowZone' | null;

export interface RoadCar {
  model: CarModel;
  ink: CarInk;
  /** Where the car stands, in miles (fractional while it drives). */
  miles: number;
  /** The mileage shown on its tag, which counts up as the car drives. */
  shownMiles: number;
  pose: CarPose;
  /** What stops it, drawn beside the car: a lit signal, a sign, a cone. */
  trouble: Trouble;
  /** A slow-zone sign stands by its lane. */
  slowed: boolean;
  /** A green signal lights for a moment after a green light is laid: 0–1. */
  greenFlash: number;
  /** The car tag's text, e.g. "You". */
  tag: string;
  /** 0 parked, 1 at full pace: speed lines stream behind it. */
  speed: number;
  /** 0–1: a gold glow behind the car, for a parry. */
  glow?: number;
  /** The menus' endless drive shows no tags. */
  hideTag?: boolean;
}

export interface Puff {
  x: number;
  y: number;
  r: number;
  alpha: number;
  colour: string;
}

export interface RoadFrame {
  route: Route;
  night: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The mile at the left edge, and how many miles fit across. */
  left: number;
  span: number;
  end: number;
  /** A finish already passed (700, after an extension). */
  passedFlag: number | null;
  time: number;
  /** [your car in the near lane, the rival's in the far lane]. */
  cars: [RoadCar, RoadCar];
  puffs: readonly Puff[];
  /** 0–1: the world slows and greys for the coup fourré. */
  slowMo: number;
  /** Larger cars than the strip's width allows (the poster's close-up). */
  carScale?: number;
}

/** Where things sit, as shares of the strip's height. */
const GEOMETRY = {
  horizon: 0.29,
  shore: 0.36,
  rail: 0.6,
  roadTop: 0.62,
  farGround: 0.745,
  nearGround: 0.885,
  roadBottom: 0.915,
};

export interface RoadGeometry {
  horizon: number;
  rail: number;
  roadTop: number;
  roadBottom: number;
  farGround: number;
  nearGround: number;
  carScale: number;
  pxPerMile: number;
}

export function roadGeometry(
  frame: Pick<RoadFrame, 'y' | 'h' | 'w' | 'span' | 'carScale'>,
): RoadGeometry {
  const { y, h } = frame;
  return {
    horizon: y + h * GEOMETRY.horizon,
    rail: y + h * GEOMETRY.rail,
    roadTop: y + h * GEOMETRY.roadTop,
    roadBottom: y + h * GEOMETRY.roadBottom,
    farGround: y + h * GEOMETRY.farGround,
    nearGround: y + h * GEOMETRY.nearGround,
    carScale: frame.carScale ?? Math.min(h * 0.0046, frame.w * 0.00105),
    pxPerMile: frame.w / frame.span,
  };
}

export function mileToX(
  frame: Pick<RoadFrame, 'x' | 'w' | 'left' | 'span'>,
  miles: number,
): number {
  return frame.x + ((miles - frame.left) / frame.span) * frame.w;
}

export function drawRoad(ctx: Ctx, frame: RoadFrame): void {
  const p = frame.night ? frame.route.night : frame.route.day;
  const g = roadGeometry(frame);
  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x, frame.y, frame.w, frame.h);
  ctx.clip();
  sky(ctx, frame, p, g);
  clouds(ctx, frame, p, g);
  if (frame.route.id === 'coast') {
    farIslands(ctx, frame, p, g);
    sea(ctx, frame, p, g);
    headlands(ctx, frame, p, g);
    if (frame.night) roadsideNeon(ctx, frame, p, g);
  } else {
    paintScenery(ctx, frame, p, g);
  }
  paintRail(ctx, frame, p, g, () => rail(ctx, frame, p, g));
  road(ctx, frame, p, g);
  verge(ctx, frame, p, g);
  // Each route's own verge props stand behind the mile posts so the numbers stay readable.
  const ownProps = paintVergeProps(ctx, frame, p);
  posts(ctx, frame, p, g);
  finish(ctx, frame, p, g);
  lanes(ctx, frame, g);
  for (const puff of frame.puffs) {
    circle(ctx, puff.x, puff.y, puff.r);
    fillWith(ctx, alpha(puff.colour, puff.alpha));
  }
  if (!ownProps) foreground(ctx, frame, p);
  if (frame.slowMo > 0) {
    // Time slows: the colour drains and the light dims, all but the cars' own glow.
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = alpha('#808080', 0.75 * frame.slowMo);
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
    ctx.restore();
    ctx.fillStyle = alpha(frame.night ? '#05070f' : '#1d2838', 0.22 * frame.slowMo);
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
    glowingCars(ctx, frame, g);
  }
  ctx.restore();
}

function sky(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const grad = ctx.createLinearGradient(0, frame.y, 0, g.horizon);
  grad.addColorStop(0, p.skyTop);
  grad.addColorStop(1, p.skyLow);
  ctx.fillStyle = grad;
  ctx.fillRect(frame.x, frame.y, frame.w, g.horizon - frame.y + 2);
  if (frame.night) {
    for (let i = 0; i < 140; i++) {
      const sx = frame.x + hash01(i, 3) * frame.w;
      const sy = frame.y + hash01(i, 5) ** 1.6 * (g.horizon - frame.y) * 0.9;
      const twinkle = 0.55 + 0.45 * Math.sin(frame.time * (0.8 + hash01(i, 7) * 2) + i);
      circle(ctx, sx, sy, 0.6 + hash01(i, 9) * 1.1);
      fillWith(ctx, alpha('#fdf6dc', 0.35 + 0.55 * twinkle * hash01(i, 11)));
    }
  }
  // The sun (or moon) sits still: it is far enough away not to drift.
  const cx = frame.x + frame.w * 0.8;
  const cy = frame.y + (g.horizon - frame.y) * (frame.night ? 0.3 : 0.48);
  const r = (g.horizon - frame.y) * 0.17;
  for (let ring = 3; ring >= 1; ring--) {
    circle(ctx, cx, cy, r * (1 + ring * 0.42));
    fillWith(ctx, alpha(p.sun, frame.night ? 0.05 * ring * 0.6 : 0.09 * (4 - ring)));
  }
  circle(ctx, cx, cy, r);
  fillWith(ctx, p.sun);
  if (frame.night) {
    // A few craters, flat, like a poster moon.
    for (const [dx, dy, rr] of [
      [-0.3, -0.2, 0.18],
      [0.25, 0.15, 0.13],
      [-0.05, 0.4, 0.1],
    ] as const) {
      circle(ctx, cx + dx * r, cy + dy * r, rr * r);
      fillWith(ctx, alpha('#c9c0a6', 0.55));
    }
  }
}

function cloudShape(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, s * 1.6, s * 0.42, 0, 0, Math.PI * 2);
  ctx.ellipse(x - s * 0.5, y - s * 0.28, s * 0.6, s * 0.42, 0, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.35, y - s * 0.38, s * 0.72, s * 0.52, 0, 0, Math.PI * 2);
}

function clouds(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const tile = frame.w * 0.42;
  const shift = layerShift(frame, 0.05) + frame.time * 6;
  const first = Math.floor(shift / tile) - 1;
  for (let i = first; i < first + 5; i++) {
    const x = frame.x + i * tile - shift + hash01(i, 21) * tile * 0.6;
    const y = frame.y + (g.horizon - frame.y) * (0.18 + hash01(i, 22) * 0.4);
    const s = (g.horizon - frame.y) * (0.16 + hash01(i, 23) * 0.12);
    cloudShape(ctx, x, y, s);
    fillWith(ctx, alpha(p.cloud, frame.night ? 0.55 : 0.92));
  }
}

function farIslands(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const tile = frame.w * 0.6;
  const shift = layerShift(frame, 0.08);
  const first = Math.floor(shift / tile) - 1;
  for (let i = first; i < first + 4; i++) {
    const x = frame.x + i * tile - shift + hash01(i, 31) * tile * 0.4;
    const w = tile * (0.35 + hash01(i, 32) * 0.3);
    const hgt = (g.horizon - frame.y) * (0.08 + hash01(i, 33) * 0.1);
    ctx.beginPath();
    ctx.moveTo(x, g.horizon + 1);
    ctx.bezierCurveTo(
      x + w * 0.2,
      g.horizon - hgt,
      x + w * 0.55,
      g.horizon - hgt * 1.2,
      x + w * 0.7,
      g.horizon - hgt * 0.5,
    );
    ctx.quadraticCurveTo(x + w * 0.85, g.horizon - hgt * 0.2, x + w, g.horizon + 1);
    ctx.closePath();
    fillWith(ctx, hash01(i, 34) > 0.5 ? p.far : p.farDeep);
  }
}

function sea(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const shore = frame.y + frame.h * GEOMETRY.shore;
  const grad = ctx.createLinearGradient(0, g.horizon, 0, g.rail);
  grad.addColorStop(0, mix(p.sea, p.seaLight, frame.night ? 0.12 : 0.35));
  grad.addColorStop(1, p.sea);
  ctx.fillStyle = grad;
  ctx.fillRect(frame.x, g.horizon, frame.w, g.rail - g.horizon);
  // Light lying on the water in short strokes.
  const shift = layerShift(frame, 0.16);
  ctx.strokeStyle = alpha(p.seaLight, frame.night ? 0.5 : 0.7);
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const row = hash01(i, 41);
    const y = g.horizon + 4 + row * (shore - g.horizon + 18);
    const len = 10 + hash01(i, 42) * 36 * (0.4 + row);
    const drift = Math.sin(frame.time * 0.8 + i) * 4;
    const x =
      frame.x +
      ((((hash01(i, 43) * frame.w * 1.3 - shift * (0.5 + row)) % (frame.w * 1.3)) + frame.w * 1.3) %
        (frame.w * 1.3)) -
      frame.w * 0.15 +
      drift;
    ctx.lineWidth = 1 + row * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  if (frame.night) {
    // The moon's road across the water: broken strokes that widen toward the shore.
    const mx = frame.x + frame.w * 0.8;
    for (let i = 0; i < 26; i++) {
      const row = i / 26;
      const y = g.horizon + 3 + row * (shore - g.horizon + 14);
      if (hash01(i, 49) < 0.3) continue;
      const half = (3 + row * 30) * (0.3 + hash01(i, 47));
      const wobble =
        Math.sin(frame.time * 1.4 + i * 1.7) * (3 + row * 8) +
        (hash01(i, 48) - 0.5) * (12 + row * 70);
      ctx.lineWidth = 1.2 + row * 1.6;
      ctx.strokeStyle = alpha('#f5ecd0', 0.7 - row * 0.35);
      ctx.beginPath();
      ctx.moveTo(mx - half + wobble, y);
      ctx.lineTo(mx + half * 0.6 + wobble, y);
      ctx.stroke();
    }
  }
  // A sail or two.
  const tile = frame.w * 0.7;
  const first = Math.floor(shift / tile) - 1;
  for (let i = first; i < first + 3; i++) {
    if (hash01(i, 44) < 0.35) continue;
    const x = frame.x + i * tile - shift + hash01(i, 45) * tile;
    const y = g.horizon + (shore - g.horizon) * (0.25 + hash01(i, 46) * 0.4);
    const s = frame.h * 0.03;
    poly(ctx, [x, y, x, y - s * 1.8, x + s * 1.1, y]);
    fillWith(ctx, frame.night ? '#c9cfe0' : '#fffaf0');
    poly(ctx, [x - s * 0.1, y - s * 1.2, x - s * 0.9, y]);
    ctx.lineTo(x - s * 0.1, y);
    fillWith(ctx, frame.night ? '#9aa3bf' : '#f2d8b0');
    ctx.fillStyle = frame.night ? '#141a2c' : '#3a3f4a';
    ctx.fillRect(x - s * 1.1, y, s * 2.4, s * 0.3);
  }
}

/** The cliffs and hills between the sea and the road, with cypresses, villas and a lighthouse. */
function headlands(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const shift = layerShift(frame, 0.5);
  const base = g.rail + 2;
  const top = frame.y + frame.h * GEOMETRY.shore;
  const band = base - top;
  const tile = frame.w * 0.2;
  const first = Math.floor(shift / tile) - 1;
  const count = Math.ceil(frame.w / tile) + 3;
  const ridge = (px: number) => {
    const u = (px + shift) / tile;
    const h = 0.5 + 0.25 * Math.sin(u * 1.3) + 0.25 * Math.sin(u * 0.47 + 1.1);
    return top + (1 - h) * band * 0.62;
  };
  // Back ridge: the hills the villas stand on.
  ctx.beginPath();
  ctx.moveTo(frame.x - 10, base);
  for (let px = -10; px <= frame.w + 10; px += 8) ctx.lineTo(frame.x + px, ridge(px));
  ctx.lineTo(frame.x + frame.w + 10, base);
  ctx.closePath();
  fillWith(ctx, p.hill);
  // Terraces: soft bands of shade across the slope.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = alpha(p.hillDeep, 0.35);
  for (let k = 0; k < 3; k++) {
    const y0 = top + band * (0.45 + k * 0.17);
    ctx.beginPath();
    ctx.moveTo(frame.x - 10, y0);
    for (let px = -10; px <= frame.w + 10; px += 16) {
      ctx.lineTo(frame.x + px, y0 + Math.sin((px + shift) / 90 + k) * band * 0.04);
    }
    ctx.lineTo(frame.x + frame.w + 10, y0 + band * 0.05);
    ctx.lineTo(frame.x - 10, y0 + band * 0.05);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Scrub along the slope: round bushes in two greens.
  for (let i = first * 4; i < (first + count) * 4; i++) {
    const px = (i * tile) / 4 - shift + hash01(i, 81) * tile * 0.25;
    const y = ridge(px) + band * (0.25 + hash01(i, 82) * 0.45);
    const r = band * (0.05 + hash01(i, 83) * 0.05);
    ctx.beginPath();
    ctx.ellipse(frame.x + px, y, r * 1.4, r, 0, Math.PI, 0);
    fillWith(ctx, hash01(i, 84) < 0.5 ? p.foliage : p.foliageDeep);
  }
  // A lighthouse now and then, never two in sight.
  const beaconGap = frame.w * 1.7;
  const firstBeacon = Math.floor(shift / beaconGap) - 1;
  const beacons: number[] = [];
  for (let k = firstBeacon; k < firstBeacon + 3; k++)
    beacons.push(k * beaconGap + beaconGap * 0.62 - shift);
  for (let i = first; i < first + count; i++) {
    const px = i * tile - shift + hash01(i, 52) * tile * 0.3;
    if (beacons.some((bx) => Math.abs(bx - px - tile * 0.3) < tile * 0.7)) continue;
    village(ctx, frame, p, px, ridge, band, i, tile);
  }
  for (const bx of beacons) lighthouse(ctx, frame, frame.x + bx, ridge(bx) + band * 0.07, band);
  // Front cliff edge, darker, right behind the rail.
  ctx.beginPath();
  ctx.moveTo(frame.x - 10, base + 2);
  for (let px = -10; px <= frame.w + 10; px += 10) {
    const u = (px + shift * 1.2) / (tile * 0.7);
    ctx.lineTo(frame.x + px, base - band * (0.16 + 0.07 * Math.sin(u * 2.3)));
  }
  ctx.lineTo(frame.x + frame.w + 10, base + 2);
  ctx.closePath();
  fillWith(ctx, p.hillDeep);
}

/** A cluster of houses on the slope, a cypress or two between them. */
function village(
  ctx: Ctx,
  frame: RoadFrame,
  p: RoutePalette,
  px: number,
  ridge: (px: number) => number,
  band: number,
  i: number,
  tile: number,
): void {
  const houses = 2 + Math.floor(hash01(i, 58) * 3);
  let at = px;
  for (let k = 0; k < houses; k++) {
    const seed = i * 17 + k;
    const s = band * (0.18 + hash01(seed, 53) * 0.1);
    const wide = s * (1 + hash01(seed, 56) * 0.7);
    const tall = s * (hash01(seed, 60) < 0.3 ? 1.6 : 1);
    const ground = ridge(at + wide / 2) + band * (0.08 + hash01(seed, 61) * 0.12);
    house(ctx, frame, p, frame.x + at, ground, wide, tall, s, seed);
    at += wide + band * (0.02 + hash01(seed, 62) * 0.06);
    if (hash01(seed, 63) < 0.35) {
      groves(ctx, p, frame.x + at + band * 0.04, ridge(at) + band * 0.18, band * 0.8, seed);
      at += band * 0.18;
    }
  }
  groves(ctx, p, frame.x + px + tile * 0.62, ridge(px + tile * 0.62) + band * 0.1, band, i);
}

function house(
  ctx: Ctx,
  frame: RoadFrame,
  p: RoutePalette,
  x: number,
  ground: number,
  wide: number,
  tall: number,
  s: number,
  seed: number,
): void {
  ctx.fillStyle = p.wall;
  ctx.fillRect(x, ground - tall, wide, tall);
  ctx.fillStyle = alpha('#000000', frame.night ? 0.18 : 0.08);
  ctx.fillRect(x + wide * 0.72, ground - tall, wide * 0.28, tall);
  poly(ctx, [
    x - s * 0.08,
    ground - tall,
    x + wide * 0.5,
    ground - tall - s * 0.32,
    x + wide + s * 0.08,
    ground - tall,
  ]);
  fillWith(ctx, p.roof);
  ctx.save();
  if (frame.night) {
    ctx.shadowColor = 'rgba(255, 200, 120, 0.9)';
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = p.window;
  const cols = Math.max(1, Math.round(wide / (s * 0.45)));
  const rows = tall > s * 1.2 ? 2 : 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (frame.night && hash01(seed * 31 + r * 7 + c, 57) < 0.35) continue;
      ctx.fillRect(
        x + (c + 0.3) * (wide / cols),
        ground - tall + s * (0.25 + r * 0.6),
        s * 0.18,
        s * 0.26,
      );
    }
  }
  ctx.restore();
}

function groves(
  ctx: Ctx,
  p: RoutePalette,
  x: number,
  ground: number,
  band: number,
  i: number,
): void {
  const n = 2 + Math.floor(hash01(i, 54) * 3);
  for (let k = 0; k < n; k++) {
    const tx = x + k * band * 0.11;
    const hgt = band * (0.42 + hash01(i * 7 + k, 55) * 0.3);
    ctx.beginPath();
    ctx.moveTo(tx, ground - hgt);
    ctx.bezierCurveTo(
      tx + hgt * 0.17,
      ground - hgt * 0.7,
      tx + hgt * 0.16,
      ground - hgt * 0.15,
      tx,
      ground,
    );
    ctx.bezierCurveTo(
      tx - hgt * 0.16,
      ground - hgt * 0.15,
      tx - hgt * 0.17,
      ground - hgt * 0.7,
      tx,
      ground - hgt,
    );
    fillWith(ctx, k % 2 ? p.foliageDeep : p.foliage);
  }
}

function lighthouse(ctx: Ctx, frame: RoadFrame, x: number, ground: number, band: number): void {
  const hgt = band * 1.05;
  const w = hgt * 0.17;
  const y = ground;
  if (frame.night) {
    // The lamp turns: its beam flashes out over the water, left and right, as it comes round.
    const angle = (frame.time * 0.9) % (Math.PI * 2);
    const facing = Math.cos(angle);
    const strength = Math.max(0, Math.abs(facing) - 0.35) / 0.65;
    if (strength > 0) {
      const lx = x + w * 0.5;
      const ly = y - hgt - w * 0.4;
      const reach = frame.w * 0.4 * strength;
      const dir = facing > 0 ? 0 : Math.PI;
      const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, reach);
      grad.addColorStop(0, alpha('#fff0be', 0.42 * strength));
      grad.addColorStop(1, alpha('#fff0be', 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.arc(lx, ly, reach, dir - 0.06, dir + 0.06);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * 0.18, y - hgt);
  ctx.lineTo(x + w * 0.82, y - hgt);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  fillWith(ctx, frame.night ? '#c7cbe0' : '#fbf6ea');
  ctx.save();
  ctx.clip();
  ctx.fillStyle = frame.night ? '#8d4a5a' : '#d4573c';
  for (let k = 0; k < 3; k++) ctx.fillRect(x - 2, y - hgt * (0.25 + k * 0.28), w + 4, hgt * 0.12);
  ctx.restore();
  ctx.fillStyle = frame.night ? '#2c2f45' : '#2f3a4a';
  ctx.fillRect(x - w * 0.1, y - hgt - w * 0.12, w * 1.2, w * 0.14);
  ctx.save();
  if (frame.night) {
    ctx.shadowColor = alpha('#ffeca8', 1);
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = frame.night ? '#fff1b8' : '#f6d66b';
  ctx.fillRect(x + w * 0.15, y - hgt - w * 0.7, w * 0.7, w * 0.6);
  ctx.restore();
  poly(ctx, [
    x + w * 0.05,
    y - hgt - w * 0.7,
    x + w * 0.5,
    y - hgt - w * 1.25,
    x + w * 0.95,
    y - hgt - w * 0.7,
  ]);
  fillWith(ctx, frame.night ? '#2c2f45' : '#2f3a4a');
}

/** At night: a motel's neon and a lit petrol station stand along the road. */
function roadsideNeon(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const spots = [
    { miles: 180, kind: 'motel' as const },
    { miles: 560, kind: 'station' as const },
    { miles: 780, kind: 'motel' as const },
  ];
  const s = frame.h * 0.1;
  for (const spot of spots) {
    const x = mileToX(frame, spot.miles);
    if (x < frame.x - s * 6 || x > frame.x + frame.w + s * 6) continue;
    const y = g.rail;
    ctx.save();
    if (spot.kind === 'motel') {
      ctx.fillStyle = '#2a2f48';
      ctx.fillRect(x - s * 0.05, y - s * 2.1, s * 0.1, s * 2.1);
      roundRect(ctx, x - s * 0.9, y - s * 2.6, s * 1.8, s * 0.62, s * 0.12);
      fillWith(ctx, '#1b1f33');
      ctx.shadowColor = '#ff6fb1';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff8fc4';
      ctx.font = `800 ${s * 0.42}px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MOTEL', x, y - s * 2.27);
      ctx.shadowColor = '#5ff2e6';
      ctx.strokeStyle = '#7ff7ee';
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.6, y - s * 1.75);
      ctx.lineTo(x + s * 0.4, y - s * 1.75);
      ctx.lineTo(x + s * 0.2, y - s * 1.9);
      ctx.moveTo(x + s * 0.4, y - s * 1.75);
      ctx.lineTo(x + s * 0.2, y - s * 1.6);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = p.wall;
      ctx.fillRect(x + s * 0.6, y - s * 0.9, s * 2.6, s * 0.9);
      ctx.shadowColor = 'rgba(255, 200, 120, 0.9)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffcf7a';
      for (let k = 0; k < 4; k++)
        ctx.fillRect(x + s * (0.8 + k * 0.6), y - s * 0.66, s * 0.3, s * 0.32);
    } else {
      ctx.fillStyle = '#2a2f48';
      ctx.fillRect(x - s * 1.4, y - s * 1.2, s * 0.12, s * 1.2);
      ctx.fillRect(x + s * 1.3, y - s * 1.2, s * 0.12, s * 1.2);
      ctx.shadowColor = '#7ff7ee';
      ctx.shadowBlur = 16;
      roundRect(ctx, x - s * 1.6, y - s * 1.45, s * 3.2, s * 0.32, s * 0.08);
      fillWith(ctx, '#e8fffb');
      ctx.shadowBlur = 0;
      const glow = ctx.createLinearGradient(0, y - s * 1.15, 0, y);
      glow.addColorStop(0, 'rgba(220, 255, 250, 0.32)');
      glow.addColorStop(1, 'rgba(220, 255, 250, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - s * 1.5, y - s * 1.15, s * 3, s * 1.15);
      roundRect(ctx, x - s * 0.25, y - s * 0.7, s * 0.5, s * 0.7, s * 0.1);
      fillWith(ctx, '#ff7a5c');
    }
    ctx.restore();
  }
}

function rail(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const shift = layerShift(frame, 1);
  const gap = frame.h * 0.075;
  const postH = g.roadTop - g.rail + frame.h * 0.03;
  ctx.fillStyle = p.rail;
  ctx.fillRect(frame.x, g.rail - postH * 0.55, frame.w, postH * 0.22);
  ctx.fillStyle = alpha('#000000', 0.12);
  ctx.fillRect(frame.x, g.rail - postH * 0.34, frame.w, postH * 0.05);
  const first = Math.floor(shift / gap);
  for (let i = first; i < first + frame.w / gap + 2; i++) {
    const x = frame.x + i * gap - shift;
    ctx.fillStyle = p.rail;
    ctx.fillRect(x, g.rail - postH * 0.6, frame.h * 0.008, postH);
    if (frame.night && i % 3 === 0) {
      circle(ctx, x + frame.h * 0.004, g.rail - postH * 0.44, frame.h * 0.005);
      fillWith(ctx, '#ffb547');
    }
  }
}

function road(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  ctx.fillStyle = p.asphalt;
  ctx.fillRect(frame.x, g.roadTop, frame.w, g.roadBottom - g.roadTop);
  ctx.fillStyle = p.asphaltEdge;
  ctx.fillRect(frame.x, g.roadTop, frame.w, frame.h * 0.012);
  ctx.fillStyle = alpha(p.lane, 0.9);
  ctx.fillRect(frame.x, g.roadTop + frame.h * 0.018, frame.w, frame.h * 0.006);
  ctx.fillRect(frame.x, g.roadBottom - frame.h * 0.016, frame.w, frame.h * 0.006);
  // Centre dashes, one every 25 miles, so the road's own scale shows.
  const mid = (g.farGround + g.nearGround) / 2 - frame.h * 0.045;
  const dash = Math.max(10, g.pxPerMile * 12);
  const firstMile = Math.floor(frame.left / 25) * 25;
  ctx.fillStyle = p.lane;
  for (let m = firstMile; m < frame.left + frame.span + 25; m += 25) {
    const x = mileToX(frame, m);
    ctx.fillRect(x, mid, dash, frame.h * 0.01);
  }
  // A little grain in the tarmac.
  ctx.fillStyle = alpha('#000000', 0.06);
  for (let i = 0; i < 90; i++) {
    const x =
      frame.x +
      ((((hash01(i, 61) * frame.w * 2 - layerShift(frame, 1)) % frame.w) + frame.w) % frame.w);
    const y = g.roadTop + hash01(i, 62) * (g.roadBottom - g.roadTop);
    ctx.fillRect(x, y, 2, 1);
  }
}

function finish(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const drawFlag = (miles: number, live: boolean) => {
    const x = mileToX(frame, miles);
    if (x < frame.x - 200 || x > frame.x + frame.w + 200) return;
    const sq = frame.h * 0.022;
    if (live) {
      // A chequered strip across both lanes.
      const rows = Math.ceil((g.roadBottom - g.roadTop) / sq);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = (r + c) % 2 ? '#1d2028' : '#f4f1e8';
          ctx.fillRect(
            x + c * sq,
            g.roadTop + r * sq,
            sq,
            Math.min(sq, g.roadBottom - g.roadTop - r * sq),
          );
        }
      }
    }
    // A tall pole on the near verge with a flag and the trip's number.
    const poleTop = g.rail - frame.h * 0.33;
    ctx.fillStyle = frame.night ? '#c8ccd8' : '#2f3540';
    ctx.fillRect(x + sq * 2 + 2, poleTop, frame.h * 0.01, g.roadBottom - poleTop + frame.h * 0.03);
    const fx = x + sq * 2 + 2 + frame.h * 0.01;
    const fw = frame.h * 0.16;
    const fh = frame.h * 0.1;
    const wave = (t: number) => Math.sin(frame.time * 4 + t * 6) * fh * 0.08;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(fx, poleTop + wave(0));
    for (let t = 0; t <= 1.001; t += 0.1) ctx.lineTo(fx + fw * t, poleTop + wave(t));
    for (let t = 1; t >= -0.001; t -= 0.1) ctx.lineTo(fx + fw * t, poleTop + fh + wave(t));
    ctx.closePath();
    ctx.clip();
    const cell = fh / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < Math.ceil(fw / cell) + 1; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#1d2028' : '#f4f1e8';
        ctx.fillRect(fx + c * cell, poleTop + r * cell - fh * 0.1, cell, cell + fh * 0.2);
      }
    }
    ctx.restore();
    if (!live) {
      ctx.save();
      ctx.globalAlpha = 0.6;
    }
    const label = String(miles);
    ctx.font = `800 ${frame.h * 0.06}px ${DISPLAY_FONT}`;
    const tw = ctx.measureText(label).width + frame.h * 0.04;
    roundRect(ctx, fx, poleTop + fh + frame.h * 0.015, tw, frame.h * 0.075, frame.h * 0.015);
    fillWith(ctx, live ? '#d6462f' : p.post);
    ctx.fillStyle = live ? '#fff4e8' : p.postInk;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, fx + frame.h * 0.02, poleTop + fh + frame.h * 0.053);
    if (!live) ctx.restore();
  };
  if (frame.passedFlag !== null) drawFlag(frame.passedFlag, false);
  drawFlag(frame.end, true);
}

/** A stone post at every hundred miles on the near verge, numbered; white stakes in between. */
function posts(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const base = g.roadBottom + frame.h * 0.05;
  const first = Math.floor(frame.left / 25) * 25;
  for (let m = Math.max(0, first); m < frame.left + frame.span + 25; m += 25) {
    if (m === frame.end) continue;
    const x = mileToX(frame, m);
    if (m % 100 === 0) {
      const w = frame.h * 0.05;
      const hgt = frame.h * 0.085;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, base);
      ctx.lineTo(x - w / 2, base - hgt + w / 2);
      ctx.arc(x, base - hgt + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(x + w / 2, base);
      ctx.closePath();
      fillWith(ctx, p.post);
      ctx.beginPath();
      ctx.moveTo(x - w / 2, base);
      ctx.lineTo(x - w / 2, base - hgt + w / 2);
      ctx.arc(x, base - hgt + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(x + w / 2, base);
      strokeWith(ctx, alpha('#000000', 0.25), 1);
      ctx.fillStyle = p.postInk;
      ctx.font = `800 ${frame.h * (m >= 1000 ? 0.024 : 0.028)}px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(m), x, base - hgt * 0.55);
    } else {
      ctx.fillStyle = alpha(p.post, 0.85);
      ctx.fillRect(x - 1.5, base - frame.h * 0.04, 3, frame.h * 0.04);
      ctx.fillStyle = frame.night ? '#ff9b3d' : '#d6462f';
      ctx.fillRect(x - 1.5, base - frame.h * 0.04, 3, frame.h * 0.008);
    }
  }
}

function verge(ctx: Ctx, frame: RoadFrame, p: RoutePalette, g: RoadGeometry): void {
  const top = g.roadBottom;
  ctx.fillStyle = p.verge;
  ctx.fillRect(frame.x, top, frame.w, frame.y + frame.h - top);
  ctx.fillStyle = p.vergeDeep;
  ctx.fillRect(frame.x, top, frame.w, frame.h * 0.012);
}

/** Agaves and stones on the near verge slide past faster than the road: they are nearer. */
function foreground(ctx: Ctx, frame: RoadFrame, p: RoutePalette): void {
  const shift = layerShift(frame, 1.3);
  const tile = frame.h * 0.5;
  const first = Math.floor(shift / tile) - 1;
  for (let i = first; i < first + frame.w / tile + 3; i++) {
    if (hash01(i, 70) < 0.3) continue;
    const x = frame.x + i * tile - shift + hash01(i, 71) * tile * 0.7;
    const y = frame.y + frame.h + frame.h * 0.02;
    const s = frame.h * (0.05 + hash01(i, 72) * 0.04);
    if (hash01(i, 73) < 0.55) {
      for (let k = -3; k <= 3; k++) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(k * 0.28);
        ctx.beginPath();
        ctx.moveTo(-s * 0.12, 0);
        ctx.quadraticCurveTo(-s * 0.1, -s * 1.1, 0, -s * 1.5);
        ctx.quadraticCurveTo(s * 0.1, -s * 1.1, s * 0.12, 0);
        fillWith(ctx, k % 2 ? p.foliage : p.foliageDeep);
        ctx.restore();
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.1, s * 0.9, s * 0.55, 0, Math.PI, 0);
      fillWith(ctx, p.vergeDeep);
    }
  }
}

/** Cars that glow are drawn again over the slow-motion veil, so they stay in colour. */
function glowingCars(ctx: Ctx, frame: RoadFrame, g: RoadGeometry): void {
  const lanesAt: [RoadCar, number, number][] = [
    [frame.cars[1], g.farGround, 0.86],
    [frame.cars[0], g.nearGround, 1],
  ];
  for (const [car, ground, depth] of lanesAt) {
    if (!car.glow) continue;
    const x = mileToX(frame, car.miles);
    const scale = g.carScale * depth;
    halo(ctx, x, ground, scale, car.glow);
    drawCar(ctx, car.model, car.ink, x, ground, scale, car.pose, frame.night);
    tag(ctx, frame, car, x, ground - scale * 50, scale);
  }
}

function halo(ctx: Ctx, x: number, ground: number, scale: number, strength: number): void {
  const cy = ground - scale * 26;
  const grad = ctx.createRadialGradient(x, cy, 0, x, cy, scale * 95);
  grad.addColorStop(0, alpha('#ffd24d', 0.7 * strength));
  grad.addColorStop(0.6, alpha('#ffd24d', 0.25 * strength));
  grad.addColorStop(1, alpha('#ffd24d', 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, cy, scale * 95, scale * 62, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** The cars and the trouble each is in, far lane first. */
function lanes(ctx: Ctx, frame: RoadFrame, g: RoadGeometry): void {
  const order: [RoadCar, number, number][] = [
    [frame.cars[1], g.farGround, 0.86],
    [frame.cars[0], g.nearGround, 1],
  ];
  for (const [car, ground, depth] of order) {
    const x = mileToX(frame, car.miles);
    const scale = g.carScale * depth;
    trouble(ctx, frame, car, x, ground, scale);
    if (car.glow) halo(ctx, x, ground, scale, car.glow);
    if (car.speed > 0) speedLines(ctx, frame, x, ground, scale, car.speed);
    drawCar(ctx, car.model, car.ink, x, ground, scale, car.pose, frame.night);
    troubleLife(ctx, frame, car, x, ground, scale);
    if (!car.hideTag) tag(ctx, frame, car, x, ground - scale * 50, scale);
  }
}

/** The stuck car is not still: a flat hisses, an empty tank coughs, a bump leaves stars. */
function troubleLife(
  ctx: Ctx,
  frame: RoadFrame,
  car: RoadCar,
  x: number,
  ground: number,
  scale: number,
): void {
  const t = frame.time;
  const white = frame.night ? '#c9cfe0' : '#ffffff';
  if (car.trouble === 'flatTyre') {
    for (let k = 0; k < 3; k++) {
      const phase = (t * 0.9 + k / 3) % 1;
      const r = scale * (3 + phase * 7);
      puffAt(
        ctx,
        x - scale * (36 + phase * 26),
        ground - scale * (3 + phase * 16),
        r,
        (1 - phase) * 0.75,
        white,
      );
    }
  } else if (car.trouble === 'noFuel') {
    for (let k = 0; k < 3; k++) {
      const phase = (t * 0.6 + k / 3) % 1;
      puffAt(
        ctx,
        x - scale * (58 + phase * 18),
        ground - scale * (10 + phase * 22),
        scale * (2.5 + phase * 6),
        (1 - phase) * 0.55,
        frame.night ? '#9aa3bf' : '#8a8f98',
      );
    }
  } else if (car.trouble === 'fenderBender') {
    for (let k = 0; k < 3; k++) {
      const a = t * 3 + (k * Math.PI * 2) / 3;
      const sx = x + scale * 40 + Math.cos(a) * scale * 12;
      const sy = ground - scale * 36 + Math.sin(a) * scale * 4;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? scale * 1.6 : scale * 4;
        const aa = (i * Math.PI) / 5;
        ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
      }
      ctx.closePath();
      fillWith(ctx, '#ffd24d');
      ctx.restore();
    }
  }
}

function puffAt(ctx: Ctx, x: number, y: number, r: number, a: number, colour: string): void {
  ctx.fillStyle = alpha(colour, a);
  circle(ctx, x, y, r);
  ctx.fill();
  circle(ctx, x + r * 0.8, y + r * 0.25, r * 0.7);
  ctx.fill();
  circle(ctx, x - r * 0.7, y + r * 0.3, r * 0.6);
  ctx.fill();
}

function speedLines(
  ctx: Ctx,
  frame: RoadFrame,
  x: number,
  ground: number,
  scale: number,
  speed: number,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const y = ground - scale * (8 + k * 7.5);
    const len = scale * (30 + hash01(k, 91) * 40) * speed;
    const start = x - scale * (58 + hash01(k, 92) * 14);
    const flicker = 0.6 + 0.4 * Math.sin(frame.time * 20 + k * 2);
    ctx.strokeStyle = alpha(frame.night ? '#c9d6ff' : '#ffffff', 0.55 * speed * flicker);
    ctx.lineWidth = scale * 1.6;
    ctx.beginPath();
    ctx.moveTo(start, y);
    ctx.lineTo(start - len, y);
    ctx.stroke();
  }
  ctx.restore();
}

function trouble(
  ctx: Ctx,
  frame: RoadFrame,
  car: RoadCar,
  x: number,
  ground: number,
  scale: number,
): void {
  const ahead = x + scale * 74;
  if (car.slowed) speedSign(ctx, frame, ahead + scale * 26, ground, scale);
  if (car.trouble === 'redLight' || car.greenFlash > 0) {
    signal(
      ctx,
      frame,
      ahead,
      ground,
      scale,
      car.trouble === 'redLight' ? 'red' : 'green',
      car.greenFlash,
    );
  }
  if (car.trouble === 'fenderBender') cone(ctx, ahead - scale * 10, ground, scale);
  if (car.trouble === 'noFuel') fuelCan(ctx, ahead - scale * 14, ground, scale);
}

/** An empty can by the roadside, tipped over: out of fuel. */
function fuelCan(ctx: Ctx, x: number, ground: number, scale: number): void {
  ctx.save();
  ctx.translate(x, ground);
  ctx.rotate(-0.35);
  roundRect(ctx, -scale * 6, -scale * 14, scale * 12, scale * 14, scale * 2);
  fillWith(ctx, '#d6462f');
  ctx.strokeStyle = '#1d2838';
  ctx.lineWidth = scale * 1.6;
  ctx.beginPath();
  ctx.moveTo(-scale * 4, -scale * 12);
  ctx.lineTo(scale * 4, -scale * 2);
  ctx.moveTo(scale * 4, -scale * 12);
  ctx.lineTo(-scale * 4, -scale * 2);
  ctx.stroke();
  ctx.fillStyle = '#c5ccd3';
  ctx.fillRect(scale * 2, -scale * 17, scale * 3, scale * 3);
  ctx.restore();
}

function signal(
  ctx: Ctx,
  frame: RoadFrame,
  x: number,
  ground: number,
  scale: number,
  lit: 'red' | 'green',
  flash: number,
): void {
  ctx.save();
  if (lit === 'green') ctx.globalAlpha = Math.min(1, flash * 1.5);
  ctx.fillStyle = frame.night ? '#7a8195' : '#3a404c';
  ctx.fillRect(x - scale * 1.4, ground - scale * 58, scale * 2.8, scale * 58);
  roundRect(ctx, x - scale * 6.5, ground - scale * 84, scale * 13, scale * 30, scale * 3);
  fillWith(ctx, '#1d222c');
  const lamps: ['red' | 'green', number][] = [
    ['red', ground - scale * 76],
    ['green', ground - scale * 62],
  ];
  for (const [which, ly] of lamps) {
    const on = which === lit;
    ctx.save();
    if (on) {
      ctx.shadowColor = which === 'red' ? '#ff4a32' : '#3fe08a';
      ctx.shadowBlur = scale * 14;
    }
    circle(ctx, x, ly, scale * 4.6);
    fillWith(ctx, on ? (which === 'red' ? '#ff5a3c' : '#3fe08a') : '#3a3f4a');
    ctx.restore();
  }
  ctx.restore();
}

function speedSign(ctx: Ctx, frame: RoadFrame, x: number, ground: number, scale: number): void {
  ctx.fillStyle = frame.night ? '#7a8195' : '#3a404c';
  ctx.fillRect(x - scale * 1.2, ground - scale * 48, scale * 2.4, scale * 48);
  circle(ctx, x, ground - scale * 56, scale * 12);
  fillWith(ctx, '#d6462f');
  circle(ctx, x, ground - scale * 56, scale * 8.8);
  fillWith(ctx, '#fffaf0');
  ctx.fillStyle = '#1d2838';
  ctx.font = `800 ${scale * 10}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('50', x, ground - scale * 55.4);
}

function cone(ctx: Ctx, x: number, ground: number, scale: number): void {
  ctx.save();
  ctx.translate(x, ground);
  ctx.rotate(0.9);
  poly(ctx, [-scale * 5, 0, 0, -scale * 16, scale * 5, 0]);
  fillWith(ctx, '#ff7a2f');
  ctx.fillStyle = '#fff3e6';
  ctx.fillRect(-scale * 2.6, -scale * 9, scale * 5.2, scale * 2.6);
  ctx.restore();
}

/** The car's tag: its name and miles, above it, with a pointer down to the car. */
function tag(ctx: Ctx, frame: RoadFrame, car: RoadCar, x: number, y: number, scale: number): void {
  const text = `${car.tag}  ${Math.round(car.shownMiles)}`;
  const size = Math.max(12, frame.h * 0.042 * (scale / roadGeometry(frame).carScale));
  ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.55;
  const bx = x - w / 2;
  const by = y - h - size * 0.45;
  ctx.save();
  ctx.shadowColor = alpha('#000000', frame.night ? 0.5 : 0.22);
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, bx, by, w, h, h / 2);
  fillWith(ctx, car.ink.bodyDeep);
  ctx.restore();
  poly(ctx, [x - size * 0.35, by + h - 1, x + size * 0.35, by + h - 1, x, by + h + size * 0.42]);
  fillWith(ctx, car.ink.bodyDeep);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, by + h / 2 + 1);
}
