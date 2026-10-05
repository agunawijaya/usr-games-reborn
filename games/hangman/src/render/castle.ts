import {
  type CastleState,
  DECORATION_SLOTS,
  type DecorationSlot,
  type SectionId,
} from './castle-model';
import { paintScallop, paintSeaGlass, paintStarfish } from './ornaments';
import type { BeachPalette } from './palette';
import { mixHex, rgba } from './palette';

/**
 * Paints the sandcastle in Canvas 2D, seen from the beach a little above.
 *
 * Everything is placed on the terrace's ground plane in castle units (one unit is the castle's
 * width): `x` across from the centre, `depth` towards the viewer, `height` above the terrace.
 * Depth is squashed onto the screen, so round towers stand on ellipses.
 *
 * The castle, back to front: a rear wall between two back towers; the keep in the courtyard, a
 * wide bucket with a narrower bucket on top and the flag above; the front wall with its
 * walkway and arrow slits; two big front towers with ridged bucket sides, notched rims and
 * dribbled spires; a gatehouse of two round bastions and an arch, with a causeway over the
 * moat. All of it stands on a raised terrace ringed by the moat and its bank.
 *
 * When the sea takes a section, the whole structure sinks into a growing heap of wet sand at
 * its own foot, leaning a little as it goes. Nothing is ever left standing on sand that is gone.
 */
const SQUASH = 0.3;
const TERRACE_Y = -0.205;
const BEACH = -0.05;

const TERRACE = { rx: 0.5, rd: 0.4 };
const MOAT = { water: { rx: 0.63, rd: 0.5 }, bank: { rx: 0.71, rd: 0.58 } };

const FRONT_TOWER = { x: 0.31, depth: 0.12, r0: 0.105, r1: 0.094, height: 0.36 };
const BACK_TOWER = { x: 0.25, depth: -0.25, r0: 0.074, r1: 0.066, height: 0.25 };
const KEEP = {
  depth: -0.06,
  r0: 0.135,
  r1: 0.123,
  height: 0.27,
  top: { r0: 0.086, r1: 0.076, height: 0.15 },
};
const FRONT_WALL = { x1: -0.29, x2: 0.29, depth: 0.12, thickness: 0.07, height: 0.17 };
const BACK_WALL = { x1: -0.24, x2: 0.24, depth: -0.25, thickness: 0.06, height: 0.15 };
const GATE = {
  depth: 0.23,
  half: 0.055,
  height: 0.19,
  bastion: { x: 0.085, depth: 0.255, r0: 0.05, r1: 0.045, height: 0.22 },
};
const FLAG_POLE = 0.19;

type Point = [number, number];

export interface CastlePlacement {
  x: number;
  baseY: number;
  width: number;
}

interface Painter {
  ctx: CanvasRenderingContext2D;
  palette: BeachPalette;
  unit: number;
  night: boolean;
  time: number;
  /** Reduced motion: sections cross-fade into their heaps instead of sinking. */
  still: boolean;
  /** Castle units on the screen plane (y up is negative) to pixels. */
  at: (x: number, y: number) => Point;
  /** A point on or above the terrace: across, towards the viewer, up. */
  p: (x: number, depth: number, height?: number) => Point;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Smooth, repeatable noise in −1…1 for hand-made, crumbly edges. */
function wobble(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

function sandTone(painter: Painter, base: string, wet: number): string {
  return mixHex(base, painter.palette.castleWet, clamp01(wet) * 0.75);
}

function trace(painter: Painter, points: Point[], close = true) {
  const { ctx } = painter;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (close) ctx.closePath();
}

/** Points round a flat circle at a height, from angle a0 to a1 (0 faces right, π/2 the viewer). */
function ring(
  painter: Painter,
  x: number,
  depth: number,
  height: number,
  rx: number,
  rd: number,
  a0: number,
  a1: number,
  steps = 24,
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    points.push(painter.p(x + Math.cos(a) * rx, depth + Math.sin(a) * rd, height));
  }
  return points;
}

/** Light comes from the sun at the upper left, or the moon at the upper right. */
function sideShade(painter: Painter, left: number, right: number, wet: number) {
  const { ctx, palette, night } = painter;
  const [x0] = painter.at(left, 0);
  const [x1] = painter.at(right, 0);
  const gradient = ctx.createLinearGradient(x0, 0, x1, 0);
  const lit = sandTone(painter, palette.castleLight, wet);
  const mid = sandTone(painter, palette.castleMid, wet);
  const shade = sandTone(painter, palette.castleShadow, wet);
  if (night) {
    gradient.addColorStop(0, shade);
    gradient.addColorStop(0.5, mid);
    gradient.addColorStop(0.82, lit);
    gradient.addColorStop(1, mid);
  } else {
    gradient.addColorStop(0, mid);
    gradient.addColorStop(0.18, lit);
    gradient.addColorStop(0.6, mid);
    gradient.addColorStop(1, shade);
  }
  return gradient;
}

function outline(painter: Painter, points: Point[]) {
  const { ctx, palette, unit } = painter;
  trace(painter, points);
  ctx.strokeStyle = rgba(palette.castleDeep, painter.night ? 0.5 : 0.32);
  ctx.lineWidth = Math.max(1, unit * 0.0028);
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Sand grains and pat marks pressed into a shape, the same every frame. */
function texture(painter: Painter, shape: Point[], seed: number, patted = true) {
  const { ctx, palette, unit } = painter;
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  const count = Math.min(220, Math.round(((width * height) / (unit * unit)) * 3500));
  const size = Math.max(1, unit * 0.0035);
  ctx.save();
  trace(painter, shape);
  ctx.clip();
  // Two batched fills (light grains, dark grains) rather than one call per grain.
  const light = new Path2D();
  const dark = new Path2D();
  for (let i = 0; i < count; i++) {
    const x = left + ((wobble(seed, i) + 1) / 2) * width;
    const y = top + ((wobble(seed + 7, i) + 1) / 2) * height;
    (i % 3 === 0 ? light : dark).rect(x, y, size, size);
  }
  ctx.fillStyle = rgba(palette.castleLight, 0.45);
  ctx.fill(light);
  ctx.fillStyle = rgba(palette.castleDeep, 0.16);
  ctx.fill(dark);
  if (!patted) {
    ctx.restore();
    return;
  }
  // A few soft vertical pat marks where hands smoothed the sand.
  ctx.strokeStyle = rgba(palette.castleDeep, 0.08);
  ctx.lineWidth = unit * 0.006;
  for (let i = 0; i < 4; i++) {
    const x = left + ((wobble(seed + 3, i) + 1) / 2) * width;
    ctx.beginPath();
    ctx.moveTo(x, top + height * 0.15);
    ctx.lineTo(x + unit * 0.004, top + height * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

/** Damp sand wicking up from the foot of a structure after the waves. */
function dampBand(painter: Painter, shape: Point[], footY: number, rise: number, wet: number) {
  if (wet <= 0.01) return;
  const { ctx, palette } = painter;
  ctx.save();
  trace(painter, shape);
  ctx.clip();
  const gradient = ctx.createLinearGradient(0, footY - rise, 0, footY);
  gradient.addColorStop(0, rgba(palette.castleWet, 0));
  gradient.addColorStop(1, rgba(palette.castleWet, 0.6 * wet));
  ctx.fillStyle = gradient;
  ctx.fillRect(-1e5, footY - rise, 2e5, rise + painter.unit * 0.05);
  ctx.restore();
}

// ——— collapse: sinking into a heap ———

/**
 * Draws a structure as it gives way: the whole of it sinks by up to its own height, leaning a
 * little, and is hidden below the line of its foot, while the heap it becomes rises there.
 */
function collapsing(
  painter: Painter,
  slump: number,
  sink: number,
  foot: Point,
  lean: number,
  draw: () => void,
) {
  const s = ease(slump);
  if (s >= 1) return;
  const { ctx, unit } = painter;
  ctx.save();
  if (painter.still) {
    ctx.globalAlpha *= 1 - s;
  } else if (s > 0) {
    ctx.beginPath();
    ctx.rect(-1e5, -1e5, 2e5, 1e5 + foot[1]);
    ctx.clip();
    ctx.translate(foot[0], foot[1] + s * sink * unit);
    ctx.rotate(lean * s * 0.12);
    ctx.translate(-foot[0], -foot[1]);
    ctx.globalAlpha = 1 - clamp01((s - 0.8) / 0.2);
  }
  draw();
  ctx.restore();
}

/** A heap of slumped sand: a lumpy dome, damp at the foot, with broken pieces lying on it. */
function heap(
  painter: Painter,
  x: number,
  depth: number,
  radius: number,
  height: number,
  growth: number,
  wet: number,
  seed: number,
  base = 0,
) {
  if (growth <= 0.01) return;
  // Under reduced motion the heap does not grow: it fades in at its full size.
  const g = painter.still ? 1 : ease(growth);
  const { ctx } = painter;
  ctx.save();
  if (painter.still) ctx.globalAlpha *= ease(growth);
  paintHeapShape(painter, x, depth, radius * (0.55 + 0.45 * g), height * g, g, wet, seed, base);
  ctx.restore();
}

function paintHeapShape(
  painter: Painter,
  x: number,
  depth: number,
  rx: number,
  h: number,
  g: number,
  wet: number,
  seed: number,
  base: number,
) {
  const { ctx, palette, unit } = painter;
  const top: Point[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = -1 + (2 * i) / 24;
    const lump = 1 + 0.12 * wobble(seed, i) * g;
    top.push(painter.p(x + u * rx, depth, base + h * Math.pow(1 - u * u, 0.75) * lump));
  }
  const shape = [...top, ...ring(painter, x, depth, base, rx, rx * 0.75, 0, Math.PI, 16)];
  // A contact shadow first, so the heap sits in the sand.
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  trace(painter, ring(painter, x, depth + 0.01, base, rx * 1.08, rx * 0.8, 0, Math.PI * 2, 28));
  ctx.fill();
  trace(painter, shape);
  const [, y0] = painter.p(x, depth, base + h);
  const [, y1] = painter.p(x, depth + rx * 0.75, base);
  const fill = ctx.createLinearGradient(0, y0, 0, y1);
  fill.addColorStop(0, sandTone(painter, palette.castleLight, wet * 0.5));
  fill.addColorStop(0.5, sandTone(painter, palette.castleMid, wet * 0.8));
  fill.addColorStop(1, sandTone(painter, palette.castleShadow, wet + 0.2));
  ctx.fillStyle = fill;
  ctx.fill();
  texture(painter, shape, seed + 40, false);
  outline(painter, shape);
  if (h < 0.03) return;
  // Broken merlons and lumps lying on the slope.
  for (let i = 0; i < 4; i++) {
    const u = wobble(seed + 2, i) * 0.7;
    const along = h * Math.pow(1 - u * u, 0.75) * (0.35 + 0.4 * ((wobble(seed + 5, i) + 1) / 2));
    const [cx, cy] = painter.p(x + u * rx, depth + 0.02, base + along);
    const size = unit * (0.012 + 0.008 * ((wobble(seed + 9, i) + 1) / 2)) * g;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wobble(seed + 11, i) * 0.6);
    ctx.fillStyle = sandTone(painter, palette.castleMid, wet);
    ctx.fillRect(-size, -size * 0.8, size * 2, size * 1.6);
    ctx.fillStyle = sandTone(painter, palette.castleLight, wet * 0.5);
    ctx.fillRect(-size, -size * 0.8, size * 2, size * 0.5);
    ctx.restore();
  }
}

/** A long low ridge where a wall slumped along its own line. */
function ridge(
  painter: Painter,
  x1: number,
  x2: number,
  depth: number,
  height: number,
  growth: number,
  wet: number,
  seed: number,
) {
  if (growth <= 0.01) return;
  const { ctx, palette } = painter;
  const g = painter.still ? 1 : ease(growth);
  ctx.save();
  if (painter.still) ctx.globalAlpha *= ease(growth);
  const spread = 0.035 * g;
  const top: Point[] = [];
  const steps = 32;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 - spread + (x2 - x1 + 2 * spread) * t;
    const ends = Math.sin(Math.PI * t) ** 0.35;
    const lump = 1 + 0.18 * wobble(seed, i);
    top.push(painter.p(x, depth, height * g * ends * lump));
  }
  const shape = [
    ...top,
    painter.p(x2 + spread, depth + 0.05, 0),
    painter.p(x1 - spread, depth + 0.05, 0),
  ];
  trace(painter, shape);
  const [, y0] = painter.p(0, depth, height * g);
  const [, y1] = painter.p(0, depth + 0.05, 0);
  const fill = ctx.createLinearGradient(0, y0, 0, y1);
  fill.addColorStop(0, sandTone(painter, palette.castleLight, wet * 0.5));
  fill.addColorStop(1, sandTone(painter, palette.castleShadow, wet + 0.2));
  ctx.fillStyle = fill;
  ctx.fill();
  texture(painter, shape, seed + 60, false);
  outline(painter, shape);
  ctx.restore();
}

// ——— bucket towers ———

interface Bucket {
  x: number;
  depth: number;
  /** Height of its foot above the terrace (the keep's top bucket stands on the lower one). */
  foot: number;
  r0: number;
  r1: number;
  height: number;
  ridges: number[];
  merlons: number;
  spires: number[];
  wet: number;
  seed: number;
}

function bucketRadius(bucket: Bucket, t: number) {
  return bucket.r0 + (bucket.r1 - bucket.r0) * t;
}

function bucketShape(painter: Painter, bucket: Bucket): Point[] {
  const { x, depth, foot, height } = bucket;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = bucketRadius(bucket, t);
    left.push(painter.p(x - r, depth, foot + height * t));
    right.push(painter.p(x + r, depth, foot + height * t));
  }
  return [
    ...left,
    ...ring(painter, x, depth, foot + height, bucket.r1, bucket.r1, Math.PI, Math.PI * 2, 16),
    ...right.reverse(),
    ...ring(painter, x, depth, foot, bucket.r0, bucket.r0, 0, Math.PI, 16),
  ];
}

function paintBucket(painter: Painter, bucket: Bucket) {
  const { ctx, palette, unit } = painter;
  const shape = bucketShape(painter, bucket);
  trace(painter, shape);
  ctx.fillStyle = sideShade(painter, bucket.x - bucket.r0, bucket.x + bucket.r0, bucket.wet);
  ctx.fill();
  texture(painter, shape, bucket.seed);

  // Ridges left by the bucket's mould: a shadow under each, a highlight on top.
  for (const t of bucket.ridges) {
    const r = bucketRadius(bucket, t);
    const h = bucket.foot + bucket.height * t;
    ctx.lineCap = 'round';
    ctx.lineWidth = unit * 0.006;
    ctx.strokeStyle = rgba(sandTone(painter, palette.castleDeep, bucket.wet), 0.45);
    trace(
      painter,
      ring(painter, bucket.x, bucket.depth, h - 0.004, r * 1.01, r, 0.1, Math.PI - 0.1, 18),
      false,
    );
    ctx.stroke();
    ctx.lineWidth = unit * 0.004;
    ctx.strokeStyle = rgba(palette.castleLight, painter.night ? 0.3 : 0.75);
    trace(
      painter,
      ring(painter, bucket.x, bucket.depth, h + 0.004, r * 1.01, r, 0.2, Math.PI - 0.2, 18),
      false,
    );
    ctx.stroke();
  }
  const [, footY] = painter.p(bucket.x, bucket.depth + bucket.r0, bucket.foot);
  dampBand(painter, shape, footY, unit * bucket.height * 0.45, bucket.wet);
  outline(painter, shape);
  paintRim(painter, bucket);
}

/** The notched rim a bucket leaves, the floor inside it, and any dribbled spires. */
function paintRim(painter: Painter, bucket: Bucket) {
  const { ctx, palette, unit } = painter;
  const top = bucket.foot + bucket.height;
  const r = bucket.r1;
  const merlonHeight = Math.min(0.04, bucket.height * 0.13);
  const width = (Math.PI * 2) / bucket.merlons / 1.9;

  const merlon = (center: number, front: boolean) => {
    const arc = ring(
      painter,
      bucket.x,
      bucket.depth,
      top,
      r,
      r,
      center - width / 2,
      center + width / 2,
      6,
    );
    const raised = arc.map(([x, y]) => [x, y - merlonHeight * unit] as Point).reverse();
    trace(painter, [...arc, ...raised]);
    ctx.fillStyle = front
      ? sideShade(painter, bucket.x - r, bucket.x + r, bucket.wet)
      : sandTone(painter, palette.castleShadow, bucket.wet);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.castleDeep, painter.night ? 0.45 : 0.25);
    ctx.lineWidth = Math.max(1, unit * 0.0022);
    ctx.stroke();
    ctx.strokeStyle = sandTone(painter, palette.castleLight, bucket.wet);
    ctx.lineWidth = unit * 0.004;
    trace(painter, raised, false);
    ctx.stroke();
  };

  const centers = Array.from(
    { length: bucket.merlons },
    (_, i) => (i / bucket.merlons) * Math.PI * 2 + 0.2,
  );
  for (const center of centers) if (Math.sin(center) < 0) merlon(center, false);
  trace(
    painter,
    ring(painter, bucket.x, bucket.depth, top, r * 0.93, r * 0.93, 0, Math.PI * 2, 28),
  );
  ctx.fillStyle = sandTone(
    painter,
    mixHex(palette.castleShadow, palette.castleMid, 0.45),
    bucket.wet,
  );
  ctx.fill();
  for (const offset of bucket.spires) {
    paintSpire(painter, bucket.x + offset * r, bucket.depth, top, r * 0.42, bucket.seed + offset);
  }
  for (const center of centers) if (Math.sin(center) >= 0) merlon(center, true);
}

/** A dribbled spire: wet sand dripped from a fist into a stack of shrinking blobs. */
function paintSpire(
  painter: Painter,
  x: number,
  depth: number,
  foot: number,
  radius: number,
  seed: number,
) {
  const { ctx, palette, unit } = painter;
  let height = foot;
  for (let k = 0; k < 6; k++) {
    const r = radius * (1 - k * 0.15);
    const blobHeight = r * 0.9;
    const [cx, cy] = painter.p(x + wobble(seed, k) * r * 0.12, depth, height + blobHeight * 0.5);
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const lump = 1 + 0.12 * wobble(seed + k, i);
      const px = cx + Math.cos(a) * r * unit * lump;
      const py = cy + Math.sin(a) * blobHeight * 0.55 * unit * lump;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const lightX = painter.night ? 0.3 : -0.3;
    const fill = ctx.createRadialGradient(
      cx + lightX * r * unit,
      cy - r * unit * 0.3,
      0,
      cx,
      cy,
      r * unit * 1.1,
    );
    fill.addColorStop(0, sandTone(painter, palette.castleLight, 0));
    fill.addColorStop(1, sandTone(painter, palette.castleShadow, 0.2));
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = rgba(palette.castleDeep, painter.night ? 0.4 : 0.25);
    ctx.lineWidth = Math.max(1, unit * 0.002);
    ctx.stroke();
    height += blobHeight * 0.62;
  }
}

// ——— walls ———

interface Wall {
  x1: number;
  x2: number;
  depth: number;
  thickness: number;
  height: number;
  merlons: number;
  slits: number[];
  /** 0 to 1: how much of each end has crumbled where the tower beside it came down. */
  brokenLeft: number;
  brokenRight: number;
  wet: number;
  seed: number;
  doorway: boolean;
}

const END_BITE = 0.07;

/** The wall's top line: slumped down at an end whose tower came away. */
function wallTop(wall: Wall, x: number): number {
  const fromLeft = (x - wall.x1) / END_BITE;
  const fromRight = (wall.x2 - x) / END_BITE;
  let top = wall.height;
  if (fromLeft < 1) top -= wall.height * 0.55 * wall.brokenLeft * (1 - fromLeft) ** 1.5;
  if (fromRight < 1) top -= wall.height * 0.55 * wall.brokenRight * (1 - fromRight) ** 1.5;
  return top;
}

function paintWall(painter: Painter, wall: Wall) {
  const { ctx, palette, unit } = painter;
  const front = wall.depth + wall.thickness / 2;
  const back = wall.depth - wall.thickness / 2;
  const steps = 30;
  const topFront: Point[] = [];
  const topBack: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = wall.x1 + ((wall.x2 - wall.x1) * i) / steps;
    const crumble = wallTop(wall, x) < wall.height - 0.001 ? wobble(wall.seed, i) * 0.006 : 0;
    topFront.push(painter.p(x, front, wallTop(wall, x) + crumble));
    topBack.push(painter.p(x, back, wallTop(wall, x) + crumble));
  }
  // The walkway along the top.
  trace(painter, [...topFront, ...topBack.slice().reverse()]);
  ctx.fillStyle = sandTone(painter, mixHex(palette.castleMid, palette.castleLight, 0.35), wall.wet);
  ctx.fill();

  const merlonHeight = 0.034;
  const span = (wall.x2 - wall.x1) / (wall.merlons * 2 - 1);
  const merlonsAlong = (depth: number, inner: boolean) => {
    for (let i = 0; i < wall.merlons; i++) {
      const x = wall.x1 + i * 2 * span;
      const h = Math.min(wallTop(wall, x), wallTop(wall, x + span));
      if (h < wall.height - 0.001) continue;
      const face: Point[] = [
        painter.p(x, depth, h),
        painter.p(x + span, depth, h),
        painter.p(x + span, depth, h + merlonHeight),
        painter.p(x, depth, h + merlonHeight),
      ];
      trace(painter, face);
      ctx.fillStyle = inner
        ? sandTone(painter, palette.castleShadow, wall.wet)
        : sandTone(painter, painter.night ? palette.castleMid : palette.castleLight, wall.wet);
      ctx.fill();
      trace(painter, [
        painter.p(x, depth, h + merlonHeight),
        painter.p(x + span, depth, h + merlonHeight),
        painter.p(x + span, depth - 0.025, h + merlonHeight),
        painter.p(x, depth - 0.025, h + merlonHeight),
      ]);
      ctx.fillStyle = sandTone(painter, palette.castleLight, wall.wet);
      ctx.fill();
      outline(painter, face);
    }
  };
  merlonsAlong(back + 0.025, true);

  const face: Point[] = [...topFront, painter.p(wall.x2, front, 0), painter.p(wall.x1, front, 0)];
  trace(painter, face);
  const [, y0] = painter.p(0, front, wall.height);
  const [, y1] = painter.p(0, front, 0);
  const fill = ctx.createLinearGradient(0, y0, 0, y1);
  fill.addColorStop(
    0,
    sandTone(painter, painter.night ? palette.castleMid : palette.castleLight, wall.wet),
  );
  fill.addColorStop(1, sandTone(painter, palette.castleShadow, wall.wet + 0.1));
  ctx.fillStyle = fill;
  ctx.fill();
  texture(painter, face, wall.seed);

  ctx.save();
  trace(painter, face);
  ctx.clip();
  // Courses scored with a stick, and arrow slits.
  ctx.strokeStyle = rgba(palette.castleDeep, painter.night ? 0.35 : 0.2);
  ctx.lineWidth = unit * 0.003;
  for (let h = wall.height * 0.3; h < wall.height; h += wall.height * 0.3) {
    trace(painter, [painter.p(wall.x1, front, h), painter.p(wall.x2, front, h)], false);
    ctx.stroke();
  }
  ctx.fillStyle = painter.night ? '#22182a' : mixHex(palette.castleDeep, palette.window, 0.5);
  for (const x of wall.slits) {
    const [sx, sy] = painter.p(x, front, wall.height * 0.62);
    ctx.beginPath();
    ctx.roundRect(sx - unit * 0.007, sy - unit * 0.028, unit * 0.014, unit * 0.056, unit * 0.007);
    ctx.fill();
  }
  if (wall.doorway) paintArch(painter, 0, front, 0.032, 0.085, painter.night ? 0.6 : 0);
  ctx.restore();
  dampBand(painter, face, y1, unit * wall.height * 0.5, wall.wet);
  outline(painter, face);
  merlonsAlong(front, false);
}

/** An arched opening, lit by the lantern at night. */
function paintArch(
  painter: Painter,
  x: number,
  depth: number,
  half: number,
  height: number,
  glow: number,
) {
  const { ctx, palette, unit } = painter;
  const springing = height - half;
  const shape: Point[] = [
    painter.p(x - half, depth, 0),
    painter.p(x - half, depth, springing),
    ...Array.from({ length: 13 }, (_, i) => {
      const a = Math.PI - (i / 12) * Math.PI;
      return painter.p(x + Math.cos(a) * half, depth, springing + Math.sin(a) * half);
    }),
    painter.p(x + half, depth, 0),
  ];
  trace(painter, shape);
  const [, top] = painter.p(x, depth, height);
  const [, bottom] = painter.p(x, depth, 0);
  const inside = ctx.createLinearGradient(0, top, 0, bottom);
  if (painter.night) {
    inside.addColorStop(0, mixHex('#3a1f10', palette.lantern, glow * 0.6));
    inside.addColorStop(1, mixHex('#3a1f10', palette.lantern, glow));
  } else {
    inside.addColorStop(0, palette.castleDeep);
    inside.addColorStop(1, mixHex(palette.castleDeep, palette.castleShadow, 0.6));
  }
  ctx.fillStyle = inside;
  ctx.fill();
  ctx.strokeStyle = sandTone(painter, palette.castleLight, 0);
  ctx.lineWidth = unit * 0.006;
  ctx.stroke();
}

// ——— the moat, the terrace and the causeway ———

function paintMoat(painter: Painter, state: CastleState) {
  const { ctx, palette, unit } = painter;
  const { slump, wet } = state.sections.moat;
  const melt = ease(slump);
  const bank = ring(
    painter,
    0,
    0,
    BEACH,
    MOAT.bank.rx + 0.03 * melt,
    MOAT.bank.rd + 0.03 * melt,
    0,
    Math.PI * 2,
    72,
  ).map(
    ([x, y], i) =>
      [x + wobble(5, i) * melt * unit * 0.012, y + wobble(6, i) * melt * unit * 0.008] as Point,
  );
  trace(painter, bank);
  ctx.fillStyle = sandTone(
    painter,
    mixHex(palette.castleMid, palette.castleShadow, melt * 0.5),
    wet + melt * 0.5,
  );
  ctx.fill();
  if (melt < 1) {
    // The bank's crest, catching the light.
    ctx.save();
    ctx.globalAlpha = 1 - melt;
    ctx.lineWidth = unit * 0.016;
    ctx.lineCap = 'round';
    ctx.strokeStyle = sandTone(painter, palette.castleLight, wet);
    trace(
      painter,
      ring(
        painter,
        0,
        -0.02,
        BEACH + 0.01,
        MOAT.bank.rx - 0.025,
        MOAT.bank.rd - 0.025,
        0.12,
        Math.PI - 0.12,
        40,
      ),
      false,
    );
    ctx.stroke();
    ctx.restore();
  }
  const water = ring(
    painter,
    0,
    0,
    BEACH,
    MOAT.water.rx + 0.05 * melt,
    MOAT.water.rd + 0.05 * melt,
    0,
    Math.PI * 2,
    64,
  );
  trace(painter, water);
  const murky = mixHex(palette.moatWater, palette.sandWet, melt * 0.45);
  const [, top] = painter.p(0, -MOAT.water.rd, BEACH);
  const [, bottom] = painter.p(0, MOAT.water.rd, BEACH);
  const fill = ctx.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, rgba(murky, 0.95 - melt * 0.25));
  fill.addColorStop(1, rgba(mixHex(murky, palette.foam, 0.2 * (1 - melt)), 0.9 - melt * 0.25));
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = painter.night ? 0.35 : 0.5;
  ctx.strokeStyle = painter.night ? palette.glow : palette.foam;
  ctx.lineWidth = unit * 0.004;
  const shimmer = Math.sin(painter.time * 1.3) * 0.02;
  trace(
    painter,
    ring(
      painter,
      0,
      0.02,
      BEACH,
      MOAT.water.rx - 0.04,
      MOAT.water.rd - 0.04,
      0.6 + shimmer,
      1.1 + shimmer,
      10,
    ),
    false,
  );
  ctx.stroke();
  ctx.restore();
  if (melt > 0) {
    // What is left of the bank: low damp lumps.
    for (let i = 0; i < 6; i++) {
      const a = 0.35 + (i / 5) * (Math.PI - 0.7) + wobble(i, 4) * 0.08;
      heap(painter, Math.cos(a) * 0.67, Math.sin(a) * 0.54, 0.06, 0.02, melt, wet, 70 + i, BEACH);
    }
  }
}

function paintTerrace(painter: Painter, state: CastleState) {
  const { ctx, palette, unit } = painter;
  const { wet } = state.sections.base;
  const skirt = [
    ...ring(painter, 0, 0, 0, TERRACE.rx, TERRACE.rd, 0, Math.PI, 32),
    ...ring(painter, 0, 0.02, BEACH, TERRACE.rx + 0.03, TERRACE.rd + 0.03, Math.PI, 0, 32),
  ];
  trace(painter, skirt);
  const [, y0] = painter.p(0, TERRACE.rd, 0);
  const [, y1] = painter.p(0, TERRACE.rd + 0.05, BEACH);
  const front = ctx.createLinearGradient(0, y0, 0, y1);
  front.addColorStop(0, sandTone(painter, palette.castleMid, wet));
  front.addColorStop(1, sandTone(painter, palette.castleShadow, wet + 0.25));
  ctx.fillStyle = front;
  ctx.fill();
  texture(painter, skirt, 90, false);
  const top = ring(painter, 0, 0, 0, TERRACE.rx, TERRACE.rd, 0, Math.PI * 2, 48);
  trace(painter, top);
  ctx.fillStyle = sandTone(painter, mixHex(palette.castleLight, palette.castleMid, 0.3), wet);
  ctx.fill();
  texture(painter, top, 91, false);
  // A ledge patted round the edge.
  ctx.strokeStyle = rgba(palette.castleLight, painter.night ? 0.25 : 0.8);
  ctx.lineWidth = unit * 0.004;
  trace(
    painter,
    ring(painter, 0, 0, 0, TERRACE.rx - 0.035, TERRACE.rd - 0.03, 0.2, Math.PI - 0.2, 30),
    false,
  );
  ctx.stroke();
  outline(painter, [...top]);
  outline(painter, skirt);
}

function paintCauseway(painter: Painter, state: CastleState) {
  const { ctx, palette } = painter;
  const { slump, wet } = state.sections.gate;
  ctx.save();
  ctx.globalAlpha = 1 - 0.65 * ease(slump);
  const shape: Point[] = [
    painter.p(-0.045, 0.28, 0),
    painter.p(0.045, 0.28, 0),
    painter.p(0.05, TERRACE.rd, 0),
    painter.p(0.07, MOAT.bank.rd + 0.02, BEACH),
    painter.p(-0.07, MOAT.bank.rd + 0.02, BEACH),
    painter.p(-0.05, TERRACE.rd, 0),
  ];
  trace(painter, shape);
  const [, y0] = painter.p(0, 0.28, 0);
  const [, y1] = painter.p(0, MOAT.bank.rd, BEACH);
  const fill = ctx.createLinearGradient(0, y0, 0, y1);
  fill.addColorStop(0, sandTone(painter, palette.castleLight, wet));
  fill.addColorStop(1, sandTone(painter, palette.castleMid, wet + 0.15));
  ctx.fillStyle = fill;
  ctx.fill();
  // Steps pressed in with the edge of a spade.
  ctx.strokeStyle = rgba(palette.castleDeep, 0.25 * (1 - ease(slump)));
  ctx.lineWidth = painter.unit * 0.003;
  for (let i = 1; i <= 4; i++) {
    const d = TERRACE.rd + ((MOAT.bank.rd - TERRACE.rd) * i) / 5;
    const h = BEACH * (i / 5);
    trace(
      painter,
      [painter.p(-0.055 - 0.004 * i, d, h), painter.p(0.055 + 0.004 * i, d, h)],
      false,
    );
    ctx.stroke();
  }
  outline(painter, shape);
  ctx.restore();
}

// ——— shadows ———

function paintShadows(painter: Painter, state: CastleState) {
  const { ctx } = painter;
  const away = painter.night ? -1 : 1;
  const casters: { id: SectionId; x: number; depth: number; r: number }[] = [
    { id: 'wall', x: -BACK_TOWER.x, depth: BACK_TOWER.depth, r: BACK_TOWER.r0 },
    { id: 'wall', x: BACK_TOWER.x, depth: BACK_TOWER.depth, r: BACK_TOWER.r0 },
    { id: 'flag', x: 0, depth: KEEP.depth, r: KEEP.r0 },
    { id: 'leftTower', x: -FRONT_TOWER.x, depth: FRONT_TOWER.depth, r: FRONT_TOWER.r0 },
    { id: 'rightTower', x: FRONT_TOWER.x, depth: FRONT_TOWER.depth, r: FRONT_TOWER.r0 },
    { id: 'gate', x: 0, depth: GATE.depth, r: 0.1 },
  ];
  ctx.save();
  ctx.fillStyle = painter.night ? 'rgba(4,6,20,0.28)' : 'rgba(110,70,30,0.16)';
  for (const caster of casters) {
    const presence = 1 - ease(state.sections[caster.id].slump);
    if (presence <= 0) continue;
    ctx.globalAlpha = presence;
    const shift = caster.r * 0.8 * away;
    trace(
      painter,
      ring(
        painter,
        caster.x + shift,
        caster.depth + caster.r * 0.25,
        0,
        caster.r * 1.35,
        caster.r * 0.9,
        0,
        Math.PI * 2,
        24,
      ),
    );
    ctx.fill();
  }
  ctx.restore();
}

// ——— the flag ———

function paintPoleAndPennant(painter: Painter, length: number, unfurl: number, breeze: number) {
  const { ctx, palette, unit, time, night } = painter;
  ctx.strokeStyle = palette.pole;
  ctx.lineCap = 'round';
  ctx.lineWidth = unit * 0.01;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(unit * 0.005, -length * 0.5, -unit * 0.002, -length);
  ctx.stroke();
  ctx.strokeStyle = rgba('#ffffff', night ? 0.12 : 0.3);
  ctx.lineWidth = unit * 0.0035;
  ctx.beginPath();
  ctx.moveTo(-unit * 0.003, -length * 0.1);
  ctx.quadraticCurveTo(unit * 0.002, -length * 0.5, -unit * 0.005, -length * 0.95);
  ctx.stroke();

  const flagLength = unit * (0.13 + 0.05 * unfurl);
  const flagHeight = unit * (0.075 + 0.015 * unfurl);
  const speed = 3 + unfurl * 2.5;
  const top: Point[] = [];
  const bottom: Point[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = t * flagLength * (0.4 + 0.6 * breeze);
    const sag = (1 - breeze) * t * flagHeight * 1.6;
    const wave = Math.sin(time * speed - t * 5.5) * unit * 0.011 * t * (1 + unfurl) * breeze;
    const taper = flagHeight * (1 - t * 0.85);
    top.push([x, -length + wave + sag + (flagHeight - taper) * 0.5]);
    bottom.push([x, -length + wave + sag + flagHeight - (flagHeight - taper) * 0.5]);
  }
  ctx.beginPath();
  [...top, ...bottom.reverse()].forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
  );
  ctx.closePath();
  const cloth = ctx.createLinearGradient(0, -length, flagLength, -length);
  cloth.addColorStop(0, palette.flagShade);
  cloth.addColorStop(0.35, palette.flag);
  cloth.addColorStop(1, mixHex(palette.flag, '#ffffff', 0.2));
  ctx.fillStyle = cloth;
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.85);
  ctx.beginPath();
  ctx.arc(
    flagLength * 0.3 * (0.4 + 0.6 * breeze),
    -length + flagHeight * 0.5 + (1 - breeze) * flagHeight * 0.4,
    unit * 0.011,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function paintFlag(painter: Painter, state: CastleState, footHeight: number) {
  const { ctx, unit } = painter;
  const [fx, fy] = painter.p(0.004, KEEP.depth, footHeight);
  ctx.save();
  ctx.translate(fx, fy);
  paintPoleAndPennant(painter, FLAG_POLE * unit, state.flagUnfurl, 1);
  ctx.restore();
}

/** After the keep comes down, its flag sticks out of the heap at a tilt, limp and damp. */
function paintFlagInHeap(painter: Painter, presence: number) {
  if (presence <= 0) return;
  const { ctx, unit } = painter;
  const [fx, fy] = painter.p(0.05, KEEP.depth + 0.02, 0.1);
  ctx.save();
  ctx.globalAlpha = presence;
  ctx.translate(fx, fy);
  ctx.rotate(0.55);
  paintPoleAndPennant(painter, FLAG_POLE * unit * 0.8, 0, 0.15);
  ctx.restore();
}

// ——— decorations ———

/** How far a section's decorations ride down as it sinks. */
const SECTION_SINK: Record<SectionId, number> = {
  moat: 0,
  gate: GATE.bastion.height,
  leftTower: FRONT_TOWER.height,
  rightTower: FRONT_TOWER.height,
  wall: FRONT_WALL.height,
  flag: KEEP.height + KEEP.top.height,
  base: 0,
};

function paintDecoration(
  painter: Painter,
  state: CastleState,
  slot: DecorationSlot,
  grown: number,
) {
  if (grown <= 0) return;
  const section = state.sections[slot.section];
  const presence = 1 - clamp01(section.slump / 0.35);
  if (presence <= 0) return;
  const { ctx, palette, unit } = painter;
  const pop = grown < 1 ? ease(grown) * (1 + 0.25 * Math.sin(grown * Math.PI)) : 1;
  const sink = ease(section.slump) * SECTION_SINK[slot.section];
  const [x, y] = painter.p(slot.x, slot.depth, slot.height - sink);
  ctx.save();
  ctx.globalAlpha *= presence;
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  switch (slot.kind) {
    case 'window':
      paintWindow(painter, state.windowsLit);
      break;
    case 'scallop':
      paintScallop(ctx, unit * 0.024, palette.shellPink, palette);
      break;
    case 'cockle':
      paintScallop(ctx, unit * 0.019, palette.shellCream, palette);
      break;
    case 'starfish':
      paintStarfish(ctx, unit * 0.03, palette);
      break;
    case 'glass':
      paintSeaGlass(ctx, unit * 0.017, palette);
      break;
  }
  ctx.restore();
}

function paintWindow(painter: Painter, lit: number) {
  const { ctx, palette, unit, night } = painter;
  const w = unit * 0.026;
  const h = unit * 0.046;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(-w / 2, -h / 2 + w / 2);
  ctx.arc(0, -h / 2 + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(w / 2, h / 2);
  ctx.closePath();
  // At night a lantern burns inside; by day a lit window is a warm glint, not a lamp.
  const glow = night ? 0.65 + 0.35 * lit : lit * 0.55;
  ctx.fillStyle = mixHex(night ? '#2a1a10' : palette.window, palette.lantern, glow);
  ctx.fill();
  ctx.strokeStyle = rgba(palette.castleLight, night ? 0.35 : 0.85);
  ctx.lineWidth = unit * 0.0035;
  ctx.stroke();
  if (!night && lit > 0) {
    ctx.fillStyle = rgba('#ffffff', 0.9 * lit);
    ctx.beginPath();
    ctx.ellipse(-w * 0.15, -h * 0.18, w * 0.12, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (night && glow > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, unit * 0.055);
    halo.addColorStop(0, rgba(palette.lantern, 0.45 * glow));
    halo.addColorStop(1, rgba(palette.lantern, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(-unit * 0.055, -unit * 0.055, unit * 0.11, unit * 0.11);
    ctx.restore();
  }
}

function decorationsOf(painter: Painter, state: CastleState, section: SectionId) {
  DECORATION_SLOTS.forEach((slot, i) => {
    if (slot.section === section) paintDecoration(painter, state, slot, state.decorations[i] ?? 0);
  });
}

// ——— the sections, back to front ———

function paintBackOfCastle(painter: Painter, state: CastleState) {
  const { slump, wet } = state.sections.wall;
  const foot = painter.p(0, BACK_WALL.depth + 0.05, 0);
  collapsing(painter, slump, BACK_TOWER.height, foot, 0, () => {
    paintWall(painter, {
      ...BACK_WALL,
      merlons: 8,
      slits: [],
      brokenLeft: 0,
      brokenRight: 0,
      wet,
      seed: 21,
      doorway: false,
    });
    for (const side of [-1, 1]) {
      paintBucket(painter, {
        x: side * BACK_TOWER.x,
        depth: BACK_TOWER.depth,
        foot: 0,
        r0: BACK_TOWER.r0,
        r1: BACK_TOWER.r1,
        height: BACK_TOWER.height,
        ridges: [0.45],
        merlons: 6,
        spires: [0],
        wet,
        seed: 30 + side,
      });
    }
  });
  ridge(painter, BACK_WALL.x1, BACK_WALL.x2, BACK_WALL.depth, 0.055, slump, wet + 0.3, 23);
  for (const side of [-1, 1]) {
    heap(painter, side * BACK_TOWER.x, BACK_TOWER.depth, 0.1, 0.08, slump, wet + 0.3, 33 + side);
  }
}

function paintKeep(painter: Painter, state: CastleState) {
  const { slump, wet } = state.sections.flag;
  const foot = painter.p(0, KEEP.depth + KEEP.r0, 0);
  collapsing(painter, slump, KEEP.height + KEEP.top.height, foot, 1, () => {
    paintBucket(painter, {
      x: 0,
      depth: KEEP.depth,
      foot: 0,
      r0: KEEP.r0,
      r1: KEEP.r1,
      height: KEEP.height,
      ridges: [0.3, 0.6],
      merlons: 11,
      spires: [-0.72, 0.72],
      wet,
      seed: 50,
    });
    paintBucket(painter, {
      x: 0,
      depth: KEEP.depth,
      foot: KEEP.height,
      r0: KEEP.top.r0,
      r1: KEEP.top.r1,
      height: KEEP.top.height,
      ridges: [0.45],
      merlons: 7,
      spires: [],
      wet,
      seed: 52,
    });
    paintFlag(painter, state, KEEP.height + KEEP.top.height + 0.03);
    decorationsOf(painter, state, 'flag');
  });
  heap(painter, 0, KEEP.depth, 0.22, 0.15, slump, wet + 0.3, 55);
  paintFlagInHeap(painter, clamp01((slump - 0.7) / 0.3));
}

function paintFrontWall(painter: Painter, state: CastleState) {
  const { slump, wet } = state.sections.wall;
  const foot = painter.p(0, FRONT_WALL.depth + FRONT_WALL.thickness / 2, 0);
  collapsing(painter, slump, FRONT_WALL.height, foot, 0, () => {
    paintWall(painter, {
      ...FRONT_WALL,
      merlons: 10,
      slits: [-0.2, -0.1, 0.1, 0.2],
      brokenLeft: clamp01((state.sections.leftTower.slump - 0.5) * 2),
      brokenRight: clamp01((state.sections.rightTower.slump - 0.5) * 2),
      wet,
      seed: 11,
      doorway: true,
    });
    decorationsOf(painter, state, 'wall');
  });
  ridge(painter, FRONT_WALL.x1, FRONT_WALL.x2, FRONT_WALL.depth, 0.075, slump, wet + 0.3, 13);
}

function paintFrontTower(painter: Painter, state: CastleState, id: 'leftTower' | 'rightTower') {
  const side = id === 'leftTower' ? -1 : 1;
  const { slump, wet } = state.sections[id];
  const x = side * FRONT_TOWER.x;
  const foot = painter.p(x, FRONT_TOWER.depth + FRONT_TOWER.r0, 0);
  collapsing(painter, slump, FRONT_TOWER.height, foot, side, () => {
    paintBucket(painter, {
      x,
      depth: FRONT_TOWER.depth,
      foot: 0,
      r0: FRONT_TOWER.r0,
      r1: FRONT_TOWER.r1,
      height: FRONT_TOWER.height,
      ridges: [0.22, 0.5, 0.78],
      merlons: 9,
      spires: [0],
      wet,
      seed: 60 + side,
    });
    decorationsOf(painter, state, id);
  });
  heap(painter, x, FRONT_TOWER.depth + 0.03, 0.16, 0.13, slump, wet + 0.3, 65 + side);
}

function paintGatehouse(painter: Painter, state: CastleState) {
  const { slump, wet } = state.sections.gate;
  const foot = painter.p(0, GATE.bastion.depth + GATE.bastion.r0, 0);
  collapsing(painter, slump, GATE.bastion.height, foot, 0, () => {
    paintWall(painter, {
      x1: -GATE.half,
      x2: GATE.half,
      depth: GATE.depth,
      thickness: 0.08,
      height: GATE.height,
      merlons: 3,
      slits: [],
      brokenLeft: 0,
      brokenRight: 0,
      wet,
      seed: 81,
      doorway: false,
    });
    paintArch(
      painter,
      0,
      GATE.depth + 0.04,
      0.032,
      0.12,
      painter.night ? 0.6 + 0.4 * state.windowsLit : 0,
    );
    for (const s of [-1, 1]) {
      paintBucket(painter, {
        x: s * GATE.bastion.x,
        depth: GATE.bastion.depth,
        foot: 0,
        r0: GATE.bastion.r0,
        r1: GATE.bastion.r1,
        height: GATE.bastion.height,
        ridges: [0.5],
        merlons: 5,
        spires: [],
        wet,
        seed: 84 + s,
      });
    }
    decorationsOf(painter, state, 'gate');
  });
  heap(painter, 0, GATE.depth + 0.04, 0.15, 0.09, slump, wet + 0.3, 88);
}

// ——— light from inside ———

function paintLanternSpill(painter: Painter, state: CastleState) {
  const { ctx, palette, unit } = painter;
  const gate = 1 - ease(state.sections.gate.slump);
  const strength = (0.5 + 0.5 * state.windowsLit) * (1 - state.dune) * gate;
  if (strength <= 0.01) return;
  const [x, y] = painter.p(0, GATE.depth + 0.14, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pool = ctx.createRadialGradient(x, y, 0, x, y, unit * 0.3);
  pool.addColorStop(0, rgba(palette.lantern, 0.3 * strength));
  pool.addColorStop(1, rgba(palette.lantern, 0));
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(x, y, unit * 0.32, unit * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ——— the last wave: one dune ———

function paintDune(painter: Painter, amount: number) {
  const { ctx, palette, unit } = painter;
  const g = ease(amount);
  const height = 0.2 * g;
  const top: Point[] = [];
  for (let i = 0; i <= 48; i++) {
    const u = -1 + (2 * i) / 48;
    // A soft mound with the ghosts of the heaps still in it, highest where the keep stood.
    const body = Math.pow(1 - u * u, 1.8) * height * 0.75;
    const ghosts =
      Math.exp(-(((u + 0.52) / 0.15) ** 2)) * 0.28 +
      Math.exp(-(((u + 0.05) / 0.22) ** 2)) * 0.5 +
      Math.exp(-(((u - 0.5) / 0.15) ** 2)) * 0.24;
    const lift = body + ghosts * height * 0.5 * Math.pow(1 - u * u, 0.5);
    top.push(painter.p(u * 0.6, 0.02, BEACH + lift + wobble(97, i) * 0.002 * g));
  }
  const dune = [...top, ...ring(painter, 0, 0.06, BEACH, 0.6, 0.34, 0, Math.PI, 36)];
  ctx.save();
  ctx.globalAlpha = clamp01(amount * 1.4);
  trace(painter, dune);
  const [, y0] = painter.p(0, 0, BEACH + height * 1.3);
  const [, y1] = painter.p(0, 0.56, BEACH);
  const fill = ctx.createLinearGradient(0, y0, 0, y1);
  fill.addColorStop(0, sandTone(painter, palette.castleLight, 0.25));
  fill.addColorStop(0.45, sandTone(painter, palette.castleMid, 0.55));
  fill.addColorStop(1, sandTone(painter, palette.castleShadow, 0.9));
  ctx.fillStyle = fill;
  ctx.fill();
  texture(painter, dune, 99, false);
  // The retreating water's last wet sheen along the foot.
  ctx.strokeStyle = rgba(painter.night ? palette.glow : palette.foam, painter.night ? 0.35 : 0.55);
  ctx.lineWidth = unit * 0.004;
  trace(painter, ring(painter, 0, 0.08, BEACH, 0.62, 0.34, 0.2, Math.PI - 0.2, 30), false);
  ctx.stroke();
  outline(painter, dune);
  // The flag, lying where the last wave left it.
  const [fx, fy] = painter.p(0.16, 0.14, BEACH + height * 0.45);
  ctx.translate(fx, fy);
  ctx.rotate(1.38);
  paintPoleAndPennant(painter, FLAG_POLE * unit * 0.8, 0, 0);
  ctx.restore();
}

/** Paints the whole castle, back to front. */
export function paintCastle(
  ctx: CanvasRenderingContext2D,
  placement: CastlePlacement,
  palette: BeachPalette,
  state: CastleState,
  time: number,
  still = false,
) {
  const unit = placement.width;
  const at = (x: number, y: number): Point => [placement.x + x * unit, placement.baseY + y * unit];
  const painter: Painter = {
    ctx,
    palette,
    unit,
    night: palette.look === 'moonlit',
    time,
    still,
    at,
    p: (x, depth, height = 0) => at(x, TERRACE_Y + depth * SQUASH - height),
  };
  const standing = 1 - ease(state.dune);
  if (standing > 0.01) {
    ctx.save();
    ctx.globalAlpha = standing;
    paintMoat(painter, state);
    decorationsOf(painter, state, 'moat');
    paintTerrace(painter, state);
    decorationsOf(painter, state, 'base');
    paintShadows(painter, state);
    paintBackOfCastle(painter, state);
    paintKeep(painter, state);
    paintFrontWall(painter, state);
    paintFrontTower(painter, state, 'leftTower');
    paintFrontTower(painter, state, 'rightTower');
    paintCauseway(painter, state);
    paintGatehouse(painter, state);
    if (painter.night) paintLanternSpill(painter, state);
    ctx.restore();
  }
  if (state.dune > 0) paintDune(painter, state.dune);
}

/** Where a section stands on screen, for sand slides and spray. */
export function sectionAnchor(placement: CastlePlacement, id: SectionId): Point {
  const unit = placement.width;
  const local: Record<SectionId, [number, number, number]> = {
    moat: [0.35, MOAT.water.rd, BEACH],
    gate: [0, GATE.depth, GATE.height],
    leftTower: [-FRONT_TOWER.x, FRONT_TOWER.depth, FRONT_TOWER.height * 0.8],
    rightTower: [FRONT_TOWER.x, FRONT_TOWER.depth, FRONT_TOWER.height * 0.8],
    wall: [0, FRONT_WALL.depth, FRONT_WALL.height],
    flag: [0, KEEP.depth, KEEP.height + KEEP.top.height],
    base: [0, 0, 0],
  };
  const [x, depth, height] = local[id];
  return [placement.x + x * unit, placement.baseY + (TERRACE_Y + depth * SQUASH - height) * unit];
}

/** Where a decoration sits on screen when its section stands, for the sparkle as it appears. */
export function decorationAnchor(placement: CastlePlacement, index: number): Point {
  const slot = DECORATION_SLOTS[index]!;
  const unit = placement.width;
  return [
    placement.x + slot.x * unit,
    placement.baseY + (TERRACE_Y + slot.depth * SQUASH - slot.height) * unit,
  ];
}
