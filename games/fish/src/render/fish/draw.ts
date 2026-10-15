import {
  type Ctx,
  curveThrough,
  type FishPose,
  type Point,
  STILL,
  warp,
  WarpPath,
} from './painter';
import type { Detail, Fin, Mark, Species } from './species';

/**
 * Paints one fish. The golden variant keeps the species' shape and every marking, cast in
 * gold: each colour becomes a gold of the same lightness, so the bars and spots still read,
 * and a band of light sweeps along the body.
 */

export interface GoldColours {
  light: string;
  mid: string;
  deep: string;
  shine: string;
}

export interface FishPlacement {
  x: number;
  y: number;
  /** Tail tip to snout, in pixels. */
  length: number;
  /** Radians; 0 faces right. */
  angle?: number;
  /** Face left instead of right. */
  flip?: boolean;
  pose?: FishPose;
  golden?: boolean;
  gold: GoldColours;
  /** Seconds, for the golden shimmer. */
  time?: number;
  alpha?: number;
}

export function drawFish(ctx: Ctx, species: Species, place: FishPlacement): void {
  const pose = place.pose ?? STILL;
  const scale = place.length / 100;
  const tint = place.golden ? (colour: string) => toGold(colour, place.gold) : (c: string) => c;
  const outlineColour = place.golden ? place.gold.deep : species.colours.outline;
  ctx.save();
  ctx.translate(place.x, place.y);
  ctx.rotate(place.angle ?? 0);
  ctx.scale(place.flip ? -scale : scale, scale);
  if (place.alpha !== undefined) ctx.globalAlpha *= place.alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const body = new FishBody(species, pose);
  for (const fin of species.fins) if (!fin.front) drawFin(ctx, fin, pose, species, tint);

  const outline = body.outline();
  outline.trace(ctx);
  ctx.fillStyle = bodyGradient(ctx, species, body, tint);
  ctx.fill();

  ctx.save();
  outline.trace(ctx);
  ctx.clip();
  for (const mark of species.marks) drawMark(ctx, mark, pose, tint);
  if (species.scales) drawScales(ctx, body, pose, tint(species.scales));
  drawSheen(ctx, body, pose, place.golden ? 0.22 : 0.16);
  if (place.golden) drawShimmer(ctx, place.time ?? 0, place.gold.shine);
  if (species.gill !== null) drawGill(ctx, body, species.gill, pose, tint(species.colours.outline));
  ctx.restore();

  // Left open at the tail's root, where the tail grows out of the body without a seam.
  outline.trace(ctx, false);
  ctx.strokeStyle = outlineColour;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  for (const fin of species.fins) if (fin.front) drawFin(ctx, fin, pose, species, tint);
  for (const detail of species.details) drawDetail(ctx, detail, pose, tint);
  drawEye(ctx, species, pose, tint);
  drawMouth(ctx, body, pose, tint(species.colours.outline));
  ctx.restore();
}

/** The body's outline from its profile: back from tail root to snout, round the nose, belly back. */
class FishBody {
  readonly top: (x: number) => number;
  readonly bottom: (x: number) => number;
  readonly root: number;
  readonly snout: number;
  readonly nose: number;
  readonly tallest: number;
  readonly deepest: number;

  constructor(
    species: Species,
    private readonly pose: FishPose,
  ) {
    this.top = curveThrough(species.profile.map(([x, top]) => [x, top] as const));
    this.bottom = curveThrough(species.profile.map(([x, , bottom]) => [x, bottom] as const));
    this.root = species.profile[0]![0];
    this.snout = species.profile[species.profile.length - 1]![0];
    this.nose = species.nose;
    this.tallest = Math.max(...species.profile.map(([, top]) => top));
    this.deepest = Math.max(...species.profile.map(([, , bottom]) => bottom));
  }

  outline(): WarpPath {
    const path = new WarpPath(this.pose);
    const { root, snout, nose } = this;
    path.moveTo(root, -this.top(root));
    for (let x = root + 2; x < snout; x += 2) path.lineTo(x, -this.top(x), 1);
    const topEnd = -this.top(snout);
    const bottomEnd = this.bottom(snout);
    const middle = (topEnd + bottomEnd) / 2;
    path.lineTo(snout, topEnd, 1);
    path.quadTo(snout + nose, topEnd, snout + nose, middle);
    path.quadTo(snout + nose, bottomEnd, snout, bottomEnd);
    for (let x = snout - 2; x > root; x -= 2) path.lineTo(x, this.bottom(x), 1);
    path.lineTo(root, this.bottom(root), 1);
    return path;
  }
}

function bodyGradient(
  ctx: Ctx,
  species: Species,
  body: FishBody,
  tint: (c: string) => string,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, -body.tallest, 0, body.deepest);
  gradient.addColorStop(0, tint(species.colours.back));
  gradient.addColorStop(0.42, tint(species.colours.side));
  gradient.addColorStop(1, tint(species.colours.belly));
  return gradient;
}

function drawFin(
  ctx: Ctx,
  fin: Fin,
  pose: FishPose,
  species: Species,
  tint: (c: string) => string,
): void {
  const points = rootedFin(fin);
  const last = points.length - 1;
  // The root stays sharp and tucked under the body, so a fin grows out of the fish, never sits on it.
  const path = new WarpPath(pose).shapedLoop(points, [0, last, ...(fin.sharp ?? [])]);
  path.trace(ctx);
  ctx.fillStyle = tint(fin.colour);
  ctx.fill();
  if (fin.rays) {
    ctx.save();
    path.trace(ctx);
    ctx.clip();
    const first = points[0]!;
    const root = points[last]!;
    const outer = points.slice(1, -1);
    // Rays fan from the fin's root to its edge, more of them on a broad fin.
    const count = Math.max(4, outer.length * 2);
    ctx.strokeStyle = tint('rgba(30, 30, 40, 0.2)');
    ctx.lineWidth = 0.45;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const base: Point = [
        first[0] + (root[0] - first[0]) * t,
        first[1] + (root[1] - first[1]) * t,
      ];
      const tip = pointAlong(outer, t);
      const ray = new WarpPath(pose).moveTo(base[0], base[1]);
      ray.lineTo(base[0] + (tip[0] - base[0]) * 1.15, base[1] + (tip[1] - base[1]) * 1.15, 6);
      ray.trace(ctx, false);
      ctx.stroke();
    }
    ctx.restore();
  }
  path.trace(ctx);
  ctx.strokeStyle = tint(withAlpha(species.colours.outline, 0.5));
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

/** A fin behind the body has its two root points pushed a little into the body. */
function rootedFin(fin: Fin): Point[] {
  const points = fin.points.map((p): Point => [p[0], p[1]]);
  if (fin.front) return points;
  const tuck = (p: Point): Point => [p[0], p[1] - Math.sign(p[1]) * Math.min(2, Math.abs(p[1]))];
  points[0] = tuck(points[0]!);
  points[points.length - 1] = tuck(points[points.length - 1]!);
  return points;
}

/** A point a fraction of the way along a polyline. */
function pointAlong(points: readonly Point[], t: number): Point {
  if (points.length === 1) return points[0]!;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
    lengths.push(d);
    total += d;
  }
  let target = t * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i]!) {
      const u = target / (lengths[i]! || 1);
      const a = points[i]!;
      const b = points[i + 1]!;
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    }
    target -= lengths[i]!;
  }
  return points[points.length - 1]!;
}

function drawMark(ctx: Ctx, mark: Mark, pose: FishPose, tint: (c: string) => string): void {
  const shape = mark.shape;
  ctx.save();
  ctx.globalAlpha *= mark.alpha ?? 1;
  ctx.fillStyle = tint(mark.colour);
  ctx.strokeStyle = tint(mark.colour);
  const path = new WarpPath(pose);
  switch (shape.kind) {
    case 'band': {
      const slant = shape.slant ?? 0;
      const half = shape.width / 2;
      path.moveTo(shape.x - half + slant * shape.from, shape.from);
      path.lineTo(shape.x + half + slant * shape.from, shape.from, 1);
      path.lineTo(shape.x + half + slant * shape.to, shape.to, 10);
      path.lineTo(shape.x - half + slant * shape.to, shape.to, 1);
      path.lineTo(shape.x - half + slant * shape.from, shape.from, 10);
      path.trace(ctx);
      ctx.fill();
      break;
    }
    case 'stripe': {
      const thickness = (x: number) => {
        const t = (x - shape.from) / (shape.to - shape.from);
        return (shape.width / 2) * (shape.taper ? Math.sin(Math.PI * t) ** 0.6 : 1);
      };
      path.moveTo(shape.from, shape.y);
      for (let x = shape.from + 2; x <= shape.to; x += 2) path.lineTo(x, shape.y - thickness(x), 1);
      for (let x = shape.to; x >= shape.from; x -= 2) path.lineTo(x, shape.y + thickness(x), 1);
      path.trace(ctx);
      ctx.fill();
      break;
    }
    case 'spot': {
      const ry = shape.ry ?? shape.r;
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const x = shape.x + Math.cos(a) * shape.r;
        const y = shape.y + Math.sin(a) * ry;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y, 1);
      }
      path.trace(ctx);
      ctx.fill();
      break;
    }
    case 'blob':
      path.smoothLoop(shape.points);
      path.trace(ctx);
      ctx.fill();
      break;
    case 'wave': {
      path.moveTo(shape.x, shape.y);
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        path.lineTo(shape.x + shape.length * t, shape.y + Math.sin(t * Math.PI * 3) * 1.1, 1);
      }
      ctx.lineWidth = shape.width;
      path.trace(ctx, false);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawDetail(ctx: Ctx, detail: Detail, pose: FishPose, tint: (c: string) => string): void {
  const [first, ...rest] = detail.path;
  const path = new WarpPath(pose).moveTo(first![0], first![1]);
  if (detail.fill) {
    for (const [x, y] of rest) path.lineTo(x, y, 3);
    path.trace(ctx);
    ctx.fillStyle = tint(detail.colour);
    ctx.fill();
    return;
  }
  // Long strokes (whiskers) curve through their points; short ones are dots of colour.
  for (let i = 0; i < rest.length; i++) {
    const p = rest[i]!;
    const next = rest[i + 1];
    if (next) path.quadTo(p[0], p[1], (p[0] + next[0]) / 2, (p[1] + next[1]) / 2, 6);
    else path.lineTo(p[0], p[1], 3);
  }
  path.trace(ctx, false);
  ctx.strokeStyle = tint(detail.colour);
  ctx.lineWidth = detail.width;
  ctx.stroke();
}

function drawScales(ctx: Ctx, body: FishBody, pose: FishPose, colour: string): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 0.5;
  let row = 0;
  for (let y = -body.tallest; y < body.deepest; y += 3.4, row++) {
    for (let x = body.root + 4 + (row % 2) * 2; x < body.snout - 12; x += 4) {
      const arc = new WarpPath(pose).moveTo(x, y - 1.7);
      arc.quadTo(x - 2.2, y, x, y + 1.7, 4);
      arc.trace(ctx, false);
      ctx.stroke();
    }
  }
}

/** Light on the upper flank: a soft band following the back. */
function drawSheen(ctx: Ctx, body: FishBody, pose: FishPose, strength: number): void {
  const path = new WarpPath(pose);
  const from = body.root + 6;
  const to = body.snout - 3;
  path.moveTo(from, -body.top(from) * 0.6);
  for (let x = from; x <= to; x += 3) path.lineTo(x, -body.top(x) * 0.78, 1);
  for (let x = to; x >= from; x -= 3) path.lineTo(x, -body.top(x) * 0.36, 1);
  path.trace(ctx);
  ctx.fillStyle = `rgba(255, 255, 255, ${strength})`;
  ctx.fill();
}

/** The golden fish's band of light, sweeping from head to tail every two and a half seconds. */
function drawShimmer(ctx: Ctx, time: number, shine: string): void {
  const sweep = ((time % 2.5) / 2.5) * 180 - 90;
  const gradient = ctx.createLinearGradient(sweep + 6, -14, sweep - 6, 14);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.5, withAlpha(shine, 0.7));
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(-60, -60, 120, 120);
}

function drawGill(ctx: Ctx, body: FishBody, x: number, pose: FishPose, colour: string): void {
  const path = new WarpPath(pose).moveTo(x, -body.top(x) * 0.7);
  path.quadTo(x - 5, (body.bottom(x) - body.top(x)) / 2, x, body.bottom(x) * 0.7, 10);
  path.trace(ctx, false);
  ctx.strokeStyle = withAlpha(colour, 0.5);
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

function drawEye(ctx: Ctx, species: Species, pose: FishPose, tint: (c: string) => string): void {
  const { x, y, r } = species.eye;
  const [ex, ey] = warp(x, y, pose);
  ctx.beginPath();
  ctx.arc(ex, ey, r, 0, Math.PI * 2);
  ctx.fillStyle = tint(species.colours.iris);
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = tint(withAlpha(species.colours.outline, 0.8));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ex + r * 0.1, ey + r * 0.02, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = '#0c0e12';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex - r * 0.18, ey - r * 0.28, r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fill();
}

function drawMouth(ctx: Ctx, body: FishBody, pose: FishPose, colour: string): void {
  const tip = body.snout + body.nose;
  const middle = (body.bottom(body.snout) - body.top(body.snout)) / 2;
  const path = new WarpPath(pose).moveTo(tip - 0.4, middle + 1);
  path.quadTo(tip - 2.5, middle + 2.2, tip - 4.5, middle + 1.6, 5);
  path.trace(ctx, false);
  ctx.strokeStyle = withAlpha(colour, 0.75);
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColour(colour: string): Rgba {
  if (colour.startsWith('#')) {
    const hex = colour.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  const [r = 0, g = 0, b = 0, a = 1] = (colour.match(/[\d.]+/g) ?? []).map(Number);
  return { r, g, b, a };
}

export function withAlpha(colour: string, alpha: number): string {
  const { r, g, b, a } = parseColour(colour);
  return `rgba(${r}, ${g}, ${b}, ${a * alpha})`;
}

function mix(a: Rgba, b: Rgba, t: number): Rgba {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 };
}

/** The same colour in gold: dark colours become deep gold, light ones pale gold. */
export function toGold(colour: string, gold: GoldColours): string {
  const source = parseColour(colour);
  const lightness = (0.3 * source.r + 0.59 * source.g + 0.11 * source.b) / 255;
  const deep = parseColour(gold.deep);
  const mid = parseColour(gold.mid);
  const light = parseColour(gold.light);
  // Even white scales turn a warm gold, never cream: the lightest colours stop short of pale.
  const result =
    lightness < 0.45
      ? mix(deep, mid, lightness / 0.45)
      : mix(mid, light, ((lightness - 0.45) / 0.55) * 0.5);
  return `rgba(${Math.round(result.r)}, ${Math.round(result.g)}, ${Math.round(result.b)}, ${source.a})`;
}

/** Where a point of the straight fish lands, for effects drawn around it (sparkles, splashes). */
export function fishPoint(place: FishPlacement, x: number, y: number): [number, number] {
  const [bx, by] = warp(x, y, place.pose ?? STILL);
  const scale = place.length / 100;
  const sx = (place.flip ? -bx : bx) * scale;
  const sy = by * scale;
  const angle = place.angle ?? 0;
  return [
    place.x + sx * Math.cos(angle) - sy * Math.sin(angle),
    place.y + sx * Math.sin(angle) + sy * Math.cos(angle),
  ];
}
