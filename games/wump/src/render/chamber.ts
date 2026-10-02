import type { Senses } from '../engine/expedition';
import {
  type ChamberShape,
  chamberShape,
  insideWall,
  type MouthPlan,
  wallPoint,
} from './chamber-shape';
import { type Arch, type Box, layoutArches, lightRim, paintArch } from './mouths';
import {
  drawDroppedLantern,
  drawExplorer,
  drawStandingLantern,
  type ExplorerPose,
  lanternPoint,
} from './explorer';
import { letter, type Point, stroke } from './hand';
import type { Look } from './look';
import { drawMark, type NotebookMark } from './map';
import { clamp, fbm, hash2, scatter } from './noise';
import { drawWumpus, type WumpusDrawing, type WumpusPose, wumpusEyes } from './wumpus';

/**
 * The room view: the chamber the explorer stands in, as a cross-section through the rock. In
 * Scrap Paper it is a watercolour field sketch painted straight onto the notebook page, with inked
 * edges and hatched tunnels; in Lantern Dark it is the cave itself, black except where the lantern
 * reaches. Each tunnel mouth carries a sign with the room it leads to and the notebook marks for
 * that room. What the explorer senses comes out of every mouth alike, because the original never
 * says which tunnel a feeling comes through.
 */

export interface MouthView extends MouthPlan {
  marks: ReadonlySet<NotebookMark>;
  magic: boolean;
  /** The keyboard number shown beside the sign. */
  key: number;
  /** Stood in already. */
  visited: boolean;
}

export interface ChamberScene {
  room: number;
  mouths: readonly MouthView[];
  senses: Senses;
  /** Standard rules show how strong the smell is; Classic keeps one faint whiff. */
  strongSmell: boolean;
  /**
   * Standing here; away (the dart's chamber); fled, the lantern left tipped on the floor; or camp,
   * only a lantern set down upright (the title and the poster).
   */
  explorer: 'here' | 'away' | 'fled' | 'camp';
  wumpus?: {
    pose: WumpusPose;
    progress?: number;
    dart?: boolean;
    /** Offset from the centre, in chamber half-widths. */ shift?: number;
  };
  /** Number plaques over the mouths; hidden once the expedition is over. */
  signs?: boolean;
  /** The explorer has stood here and chalked the room's number on the wall. */
  chalked?: boolean;
  /** 1 = a full lantern; towards 0 it gutters out. */
  lantern: number;
  /** The light of the sleep dart, for a chamber without the lantern. */
  dartLight?: number;
  time: number;
}

/** Where each mouth's sign hangs, for the clickable buttons laid over the canvas. */
export interface MouthSpot {
  to: number;
  sign: Point;
  signSize: { w: number; h: number };
  opening: Point;
  /** Radius of the clickable area around the opening. */
  reach: number;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Draws the chamber into a canvas of the given size and returns where its mouths are. */
export function drawChamber(
  ctx: CanvasRenderingContext2D,
  scene: ChamberScene,
  look: Look,
  width: number,
  height: number,
): MouthSpot[] {
  const shape = chamberShape(width, height, scene.room * 101 + 7);
  const mouthWidth =
    Math.min(width, height * 1.3) * clamp(0.16 - scene.mouths.length * 0.01, 0.08, 0.14);
  const signSize = signDimensions(height);
  const arches = layoutArches(
    shape,
    scene.mouths.map((m) => ({ to: m.to, angle: m.angle, magic: m.magic, marks: m.marks.size })),
    mouthWidth,
    signSize,
    keptClear(shape, scene, width, height),
    { x0: 6, y0: 6, x1: width - 6, y1: height - 6 },
  );
  const spots = arches.map((arch) => mouthSpot(arch, signSize));

  ctx.drawImage(rockLayer(shape, look, width, height, scene, arches), 0, 0);
  if (scene.chalked !== false) drawWallMark(ctx, shape, scene, look, arches);
  drawDetails(ctx, shape, look, scene, height, arches);
  if (scene.senses.pit) drawDraft(ctx, shape, scene, look);
  if (scene.senses.bats) drawBatShadows(ctx, shape, scene, look);
  // A hushed wumpus glows in its own dart-light; any other is left to whatever light there is.
  const glowing = look.dark && scene.explorer === 'away';
  if (scene.wumpus && !glowing) sleeper(ctx, shape, scene, look, width, height);
  const pose = explorerPose(shape, height, scene.time);
  if (scene.explorer === 'here') drawExplorer(ctx, pose, look);
  if (scene.explorer === 'fled') {
    const spot = droppedLantern(shape);
    drawDroppedLantern(ctx, spot.x, spot.y, height * 0.42, look, scene.time, scene.lantern);
  }
  if (scene.explorer === 'camp') {
    const spot = droppedLantern(shape);
    drawStandingLantern(ctx, spot.x, spot.y, height * 0.42, look, scene.time);
  }
  if (look.dark) {
    light(ctx, shape, scene, width, height, pose);
    const source = lightSource(scene, pose, shape);
    for (const arch of arches) lightRim(ctx, arch, source, lightStrength(scene));
    if (scene.wumpus && glowing) sleeper(ctx, shape, scene, look, width, height);
    if (scene.wumpus && !glowing) eyesInTheDark(ctx, shape, scene, width, height);
  } else {
    warmSketch(ctx, shape, scene);
  }
  if (scene.senses.wumpus > 0) {
    const strong = scene.strongSmell && scene.senses.wumpus === 1;
    for (const arch of arches) drawStink(ctx, arch, look, scene.time, strong);
  }
  if (scene.signs !== false) drawSigns(ctx, scene, look, spots, lightSource(scene, pose, shape));
  return spots;
}

function sleeperDrawing(
  shape: ChamberShape,
  scene: ChamberScene,
  width: number,
  height: number,
): WumpusDrawing {
  const wumpus = scene.wumpus!;
  return {
    x: shape.center.x + (wumpus.shift ?? 0) * shape.rx,
    y: shape.floorY,
    size: Math.min(width * 0.3, height * 0.44),
    pose: wumpus.pose,
    progress: wumpus.progress,
    dart: wumpus.dart,
    time: scene.time,
    lightFrom: -Math.PI * 0.7,
  };
}

function sleeper(
  ctx: CanvasRenderingContext2D,
  shape: ChamberShape,
  scene: ChamberScene,
  look: Look,
  width: number,
  height: number,
): void {
  drawWumpus(ctx, sleeperDrawing(shape, scene, width, height), look);
}

/** In a dying light only the wumpus's sleepy eyes still show: two pale half-moons in the dark. */
function eyesInTheDark(
  ctx: CanvasRenderingContext2D,
  shape: ChamberShape,
  scene: ChamberScene,
  width: number,
  height: number,
): void {
  const drawing = sleeperDrawing(shape, scene, width, height);
  if (drawing.pose === 'asleep') return;
  ctx.save();
  for (const eye of wumpusEyes(drawing)) {
    const glow = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, eye.r * 2.4);
    glow.addColorStop(0, 'rgba(255, 214, 150, 0.22)');
    glow.addColorStop(1, 'rgba(255, 214, 150, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(eye.x - eye.r * 2.5, eye.y - eye.r * 2.5, eye.r * 5, eye.r * 5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(eye.x - eye.r * 1.2, eye.y, eye.r * 2.4, eye.r * 1.3);
    ctx.clip();
    ctx.fillStyle = 'rgba(240, 232, 214, 0.85)';
    ctx.beginPath();
    ctx.ellipse(eye.x, eye.y, eye.r * 0.95, eye.r * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#120e0b';
    ctx.beginPath();
    ctx.ellipse(eye.x, eye.y + eye.r * 0.25, eye.r * 0.45, eye.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function explorerPose(shape: ChamberShape, height: number, time: number): ExplorerPose {
  return {
    x: shape.center.x + shape.rx * 0.02,
    y: shape.floorY + 2,
    height: height * 0.24,
    lift: 1,
    lean: 0,
    facing: 1,
    time,
  };
}

function droppedLantern(shape: ChamberShape): Point {
  return { x: shape.center.x - shape.rx * 0.46, y: shape.floorY };
}

function lightSource(scene: ChamberScene, pose: ExplorerPose, shape: ChamberShape): Point {
  if (scene.explorer === 'here') return lanternPoint(pose);
  if (scene.explorer === 'fled' || scene.explorer === 'camp') {
    const spot = droppedLantern(shape);
    return { x: spot.x, y: spot.y - (scene.explorer === 'camp' ? 40 : 14) };
  }
  return { x: shape.center.x, y: shape.center.y - shape.ry * 0.05 };
}

function lightStrength(scene: ChamberScene): number {
  return scene.explorer === 'away' ? (scene.dartLight ?? 0.6) : scene.lantern;
}

/** Where no mouth may open: in front of the explorer, and round a wumpus in the room. */
function keptClear(shape: ChamberShape, scene: ChamberScene, width: number, height: number): Box[] {
  const boxes: Box[] = [];
  if (scene.explorer === 'here') {
    const pose = explorerPose(shape, height, 0);
    const reach = pose.height * 0.36;
    boxes.push({ x0: pose.x - reach, y0: pose.y - pose.height, x1: pose.x + reach, y1: pose.y });
  }
  if (scene.wumpus) {
    const drawing = sleeperDrawing(shape, scene, width, height);
    const half = drawing.size * 0.66;
    boxes.push({
      x0: drawing.x - half,
      y0: drawing.y - drawing.size * 0.9,
      x1: drawing.x + half,
      y1: drawing.y,
    });
  }
  return boxes;
}

function signDimensions(height: number): { w: number; h: number } {
  const h = clamp(height * 0.058, 26, 56);
  return { w: h * 1.75, h };
}

/** The number plaque hangs above the mouth, like a house number over a door. */
function mouthSpot(arch: Arch, signSize: { w: number; h: number }): MouthSpot {
  const sign = { x: arch.center.x, y: arch.center.y - arch.height * 0.5 - signSize.h * 0.95 };
  return { to: arch.to, sign, signSize, opening: arch.center, reach: arch.width * 0.6 };
}

// —— the rock, the hollow and the passages, painted once per room and look ——

function rockLayer(
  shape: ChamberShape,
  look: Look,
  width: number,
  height: number,
  scene: ChamberScene,
  arches: Arch[],
): HTMLCanvasElement {
  const key = `${look.name}:${scene.room}:${width}x${height}:${scene.mouths.map((m) => `${m.to}@${m.angle.toFixed(2)}${m.magic ? 'm' : ''}`).join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  paintRock(ctx, shape, look, width, height);
  if (!look.dark) hatchRock(ctx, shape, look);
  paintCracks(ctx, shape, look, width, height);
  paintHollow(ctx, shape, look);
  if (!look.dark) {
    stroke(ctx, [...shape.wall, shape.wall[0]!], {
      medium: 'ink',
      color: look.outline,
      width: 2.6,
      seed: shape.seed,
      wobble: 1.3,
    });
  }
  for (const arch of arches) paintArch(ctx, arch, look);
  if (cache.size > 24) cache.delete(cache.keys().next().value!);
  cache.set(key, canvas);
  return canvas;
}

function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Bands of rock. On paper they are a watercolour wash whose ragged edge lets the page show
 * through, with the pigment pooling darker along that edge; in the dark they fill the frame.
 */
function paintRock(
  ctx: CanvasRenderingContext2D,
  shape: ChamberShape,
  look: Look,
  width: number,
  height: number,
): void {
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const seed = shape.seed;
  const bands = look.strata.map(rgb);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const warp = fbm(x / 240, y / 240, seed, 3) * 110;
      const layer = (y + warp + Math.sin(x / 300 + seed) * 34) / (height * 0.09);
      const band = bands[Math.abs(Math.floor(layer)) % bands.length]!;
      const grain = fbm(x / 6, y / 6, seed + 2, 2) - 0.5;
      const mottle = fbm(x / 80, y / 80, seed + 5, 3) - 0.5;
      let alpha = 1;
      let pool = 0;
      if (!look.dark) {
        const inset = Math.min(
          Math.min(x, width - x) / (width * 0.5),
          Math.min(y, height - y) / (height * 0.5),
        );
        const ragged = fbm(x / 120, y / 120, seed + 11, 3) - 0.5;
        const m = inset * 3.3 + ragged * 1.1;
        alpha = smoothstep(0.42, 0.5, m);
        pool = alpha * (1 - smoothstep(0.5, 0.66, m));
      }
      const shade =
        (1 + grain * (look.dark ? 0.4 : 0.1) + mottle * (look.dark ? 0.45 : 0.2)) *
        (1 - pool * 0.24);
      const i = (y * width + x) * 4;
      data[i] = clamp(band[0] * shade, 0, 255);
      data[i + 1] = clamp(band[1] * shade, 0, 255);
      data[i + 2] = clamp(band[2] * shade, 0, 255);
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** Paper look: hatching where the rock turns away from the light, only where paint has gone. */
function hatchRock(ctx: CanvasRenderingContext2D, shape: ChamberShape, look: Look): void {
  const random = scatter(shape.seed + 41);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = look.outline;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const angle = Math.PI * (0.9 + random() * 1.25);
    const wall = wallPoint(shape, angle);
    const out = 10 + random() * 110;
    const cx = wall.x + Math.cos(angle) * out;
    const cy = wall.y + Math.sin(angle) * out * 0.9;
    if (insideWall(shape, { x: cx, y: cy })) continue;
    const length = 6 + random() * 10;
    ctx.globalAlpha = 0.34 * (1 - out / 130);
    ctx.beginPath();
    ctx.moveTo(cx - length * 0.55, cy + length * 0.45);
    ctx.lineTo(cx + length * 0.55, cy - length * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

function paintCracks(
  ctx: CanvasRenderingContext2D,
  shape: ChamberShape,
  look: Look,
  width: number,
  height: number,
): void {
  const random = scatter(shape.seed + 17);
  ctx.save();
  if (!look.dark) ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 18; i++) {
    let x = random() * width;
    let y = random() * height;
    if (insideWall(shape, { x, y })) continue;
    const points: Point[] = [{ x, y }];
    let angle = random() * Math.PI * 2;
    for (let k = 0; k < 9; k++) {
      angle += (random() - 0.5) * 1.1;
      x += Math.cos(angle) * (8 + random() * 16);
      y += Math.sin(angle) * (8 + random() * 16);
      points.push({ x, y });
    }
    stroke(ctx, points, {
      medium: 'ink',
      color: look.dark ? 'rgba(0,0,0,0.8)' : look.rockDark,
      width: look.dark ? 1.8 : 1.2,
      seed: i,
      wobble: 0.5,
      alpha: look.dark ? 0.9 : 0.75,
    });
  }
  ctx.restore();
}

function tracePolygon(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

/** The hollow: paper (or lit rock) with a few soft washes for the far wall. */
function paintHollow(ctx: CanvasRenderingContext2D, shape: ChamberShape, look: Look): void {
  ctx.save();
  tracePolygon(ctx, shape.wall);
  if (look.dark) {
    const gradient = ctx.createRadialGradient(
      shape.center.x,
      shape.floorY - shape.ry * 0.4,
      shape.ry * 0.1,
      shape.center.x,
      shape.center.y,
      Math.max(shape.rx, shape.ry) * 1.2,
    );
    gradient.addColorStop(0, look.cavity);
    gradient.addColorStop(1, look.cavityShade);
    ctx.fillStyle = gradient;
    ctx.fill();
  } else {
    ctx.fillStyle = look.cavity;
    ctx.fill();
  }
  ctx.clip();
  // The far wall: a few long horizontal washes, like rock layers seen across the chamber.
  const random = scatter(shape.seed + 3);
  if (!look.dark) sketchFarWall(ctx, shape, look, random);
  for (let i = 0; i < (look.dark ? 5 : 0); i++) {
    const y = shape.center.y - shape.ry * 0.7 + i * shape.ry * 0.32 + random() * 20;
    const band = ctx.createLinearGradient(0, y - 30, 0, y + 30);
    const tint = look.dark
      ? 'rgba(0,0,0,0.18)'
      : i % 2 === 0
        ? 'rgba(201, 154, 106, 0.16)'
        : 'rgba(150, 160, 170, 0.12)';
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.5, tint);
    band.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = band;
    ctx.fillRect(shape.center.x - shape.rx * 1.3, y - 30, shape.rx * 2.6, 60);
  }
  // Shade gathering under the overhang, so the hollow reads as a hollow and not a hole in the page.
  ctx.save();
  ctx.filter = `blur(${Math.round(shape.ry * 0.07)}px)`;
  ctx.strokeStyle = look.dark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(150, 112, 70, 0.3)';
  ctx.lineWidth = shape.ry * 0.16;
  tracePolygon(ctx, shape.wall);
  ctx.stroke();
  ctx.restore();
  // Packed earth along the floor.
  const floor = ctx.createLinearGradient(0, shape.floorY - shape.ry * 0.3, 0, shape.floorY + 6);
  floor.addColorStop(0, 'rgba(0,0,0,0)');
  floor.addColorStop(1, look.dark ? 'rgba(48, 34, 22, 0.95)' : 'rgba(185, 112, 63, 0.38)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, shape.floorY - shape.ry * 0.32, ctx.canvas.width, shape.ry * 0.42);
  ctx.restore();
}

/** A sketcher's suggestion of the far wall: a few faint contour strokes and dabs of colour. */
function sketchFarWall(
  ctx: CanvasRenderingContext2D,
  shape: ChamberShape,
  look: Look,
  random: () => number,
): void {
  for (let i = 0; i < 7; i++) {
    const y = shape.center.y - shape.ry * 0.62 + i * shape.ry * 0.2 + (random() - 0.5) * 16;
    const x0 = shape.center.x - shape.rx * (0.4 + random() * 0.5);
    const x1 = shape.center.x + shape.rx * (0.3 + random() * 0.55);
    const points: Point[] = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      points.push({ x: x0 + (x1 - x0) * t, y: y + Math.sin(t * Math.PI * 1.5 + i) * 8 });
    }
    stroke(ctx, points, {
      medium: 'pencil',
      color: look.rockDark,
      width: 1.1,
      seed: i + shape.seed,
      wobble: 2,
      alpha: 0.35,
    });
  }
  for (let i = 0; i < 9; i++) {
    const x = shape.center.x + (random() - 0.5) * shape.rx * 1.5;
    const y = shape.center.y + (random() - 0.6) * shape.ry * 1.1;
    const r = 28 + random() * 60;
    const dab = ctx.createRadialGradient(x, y, 0, x, y, r);
    dab.addColorStop(0, i % 3 === 0 ? 'rgba(201, 154, 106, 0.14)' : 'rgba(170, 160, 150, 0.1)');
    dab.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dab;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// —— things in the chamber ——

/** Places on the far wall for the chalk mark, best first: up out of the way, then lower down. */
const WALL_MARK_SPOTS: readonly [number, number][] = [
  [0.42, -0.46],
  [-0.42, -0.46],
  [0, -0.58],
  [0.6, -0.12],
  [-0.6, -0.12],
];

/** The explorer's own chalk mark: the room's number on bare wall, never across a tunnel mouth. */
function drawWallMark(
  ctx: CanvasRenderingContext2D,
  shape: ChamberShape,
  scene: ChamberScene,
  look: Look,
  arches: readonly Arch[],
): void {
  const size = shape.ry * 0.14;
  const room = (spot: readonly [number, number]) => {
    const x = shape.center.x + shape.rx * spot[0];
    const y = shape.center.y + shape.ry * spot[1];
    // Each mouth with its sign above it, as a box the mark keeps away from.
    const clearance = Math.min(
      ...arches.map((arch) => {
        const top = arch.center.y - arch.height * 1.2;
        const bottom = arch.center.y + arch.height * 0.6;
        const dx = Math.max(0, Math.abs(x - arch.center.x) - arch.width * 0.7);
        const dy = Math.max(0, top - y, y - bottom);
        return Math.hypot(dx, dy);
      }),
    );
    return { x, y, clearance };
  };
  const spots = WALL_MARK_SPOTS.map(room);
  const { x, y } =
    spots.find((spot) => spot.clearance > size * 1.4) ??
    spots.reduce((best, spot) => (spot.clearance > best.clearance ? spot : best));
  const color = look.dark ? 'rgba(240, 232, 214, 0.7)' : 'rgba(42, 42, 51, 0.45)';
  letter(ctx, String(scene.room), x, y, {
    medium: 'chalk',
    color,
    size,
    seed: scene.room * 3,
    weight: 0.12,
  });
  const width = size * (String(scene.room).length * 0.62 + 0.4);
  stroke(
    ctx,
    [
      { x: x - width / 2, y: y + size * 0.75 },
      { x: x + width / 2 + 6, y: y + size * 0.68 },
    ],
    { medium: 'chalk', color, width: 3, seed: scene.room + 1, wobble: 0.6 },
  );
}

function drawDetails(
  ctx: CanvasRenderingContext2D,
  shape: ChamberShape,
  look: Look,
  scene: ChamberScene,
  height: number,
  arches: readonly Arch[],
): void {
  const random = scatter(shape.seed + 77);
  // Nothing hangs or grows in front of a tunnel mouth.
  const inFront = (x0: number, x1: number, y0: number, y1: number) =>
    arches.some(
      (a) =>
        x0 < a.center.x + a.width * 0.75 &&
        a.center.x - a.width * 0.75 < x1 &&
        y0 < a.center.y + a.height * 0.65 &&
        a.center.y - a.height * 0.65 < y1,
    );
  for (let i = 0; i < 12; i++) {
    const angle = Math.PI * (1.1 + random() * 0.8);
    const base = wallPoint(shape, angle);
    const length = height * (0.035 + random() * 0.075);
    const half = 5 + random() * 10;
    if (inFront(base.x - half, base.x + half, base.y - 4, base.y + length)) continue;
    spike(ctx, base, half, length, 1, look, i);
  }
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = shape.center.x + side * shape.rx * (0.5 + random() * 0.4);
    const base = { x, y: shape.floorY + 3 };
    const half = 6 + random() * 10;
    const length = height * (0.03 + random() * 0.06);
    if (!insideWall(shape, { x, y: shape.floorY - 6 })) continue;
    if (inFront(x - half, x + half, base.y - length, base.y)) continue;
    spike(ctx, base, half, length, -1, look, i + 20);
  }
  // A puddle catching the light, and a scatter of pebbles.
  const puddle = { x: shape.center.x + shape.rx * 0.3, y: shape.floorY - 4 };
  ctx.save();
  ctx.fillStyle = look.dark ? 'rgba(40, 62, 72, 0.9)' : 'rgba(110, 135, 160, 0.42)';
  ctx.beginPath();
  ctx.ellipse(puddle.x, puddle.y, shape.rx * 0.17, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.dark ? 'rgba(255, 210, 140, 0.55)' : 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(puddle.x - shape.rx * 0.05, puddle.y - 1, shape.rx * 0.05, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 22; i++) {
    const x = shape.center.x + (random() - 0.5) * shape.rx * 1.7;
    const p = { x, y: shape.floorY - random() * 5 };
    if (!insideWall(shape, { x, y: p.y - 4 })) continue;
    ctx.fillStyle = look.dark ? '#5a4a3b' : look.rockDark;
    ctx.globalAlpha = look.dark ? 1 : 0.8;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 3 + random() * 6, 2 + random() * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // A drip falling from the vault, once every couple of seconds.
  const drop = (scene.time * 0.45) % 1;
  const tip = wallPoint(shape, -Math.PI / 2 + 0.35);
  ctx.fillStyle = look.dark ? 'rgba(170, 210, 230, 0.8)' : 'rgba(80, 110, 140, 0.7)';
  ctx.beginPath();
  ctx.ellipse(
    tip.x,
    tip.y + 10 + drop * drop * (shape.floorY - tip.y - 10),
    2.5,
    4,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function spike(
  ctx: CanvasRenderingContext2D,
  base: Point,
  half: number,
  length: number,
  direction: 1 | -1,
  look: Look,
  seed: number,
): void {
  const lean = (hash2(seed, 2) - 0.5) * half;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(base.x - half, base.y - direction * 3);
  ctx.quadraticCurveTo(
    base.x - half * 0.25,
    base.y + direction * length * 0.5,
    base.x + lean,
    base.y + direction * length,
  );
  ctx.quadraticCurveTo(
    base.x + half * 0.35,
    base.y + direction * length * 0.5,
    base.x + half,
    base.y - direction * 3,
  );
  ctx.closePath();
  const fill = ctx.createLinearGradient(base.x - half, 0, base.x + half, 0);
  fill.addColorStop(0, look.dark ? '#5e4c3c' : look.rockLight);
  fill.addColorStop(1, look.dark ? '#2e251d' : look.rock);
  ctx.fillStyle = fill;
  ctx.fill();
  if (!look.dark) {
    ctx.strokeStyle = look.outline;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

// —— senses ——

/**
 * The wumpus's smell: hazy green breath drifting out of every tunnel mouth, with a few wavering
 * stink lines on top. A strong smell (one room away, Standard rules) is thicker.
 */
function drawStink(
  ctx: CanvasRenderingContext2D,
  arch: Arch,
  look: Look,
  time: number,
  strong: boolean,
): void {
  const n = arch.inward;
  const side = { x: -n.y, y: n.x };
  const w = arch.width;
  const origin = { x: arch.center.x, y: arch.center.y + arch.height * 0.12 };
  const along = (t: number, offset: number, phase: number): Point => ({
    x:
      origin.x +
      n.x * t * w * 1.3 +
      side.x * (offset + Math.sin(t * 7 + phase) * w * 0.12 * (0.3 + t)),
    y:
      origin.y +
      n.y * t * w * 1.3 +
      side.y * (offset + Math.sin(t * 7 + phase) * w * 0.12 * (0.3 + t)) -
      t * t * w * 1.2,
  });

  ctx.save();
  ctx.globalCompositeOperation = look.dark ? 'lighter' : 'multiply';
  ctx.filter = `blur(${Math.round(w * 0.1)}px)`;
  const puffs = strong ? 9 : 6;
  for (let k = 0; k < puffs; k++) {
    const phase = (time * 0.13 + k / puffs + hash2(arch.to, k) * 0.2) % 1;
    const c = along(phase, (hash2(k, arch.to) - 0.5) * w * 0.5, k);
    const radius = w * (0.16 + phase * 0.28) * (strong ? 1.2 : 1);
    ctx.globalAlpha = Math.sin(phase * Math.PI) * (strong ? 0.55 : 0.4) * (look.dark ? 1 : 0.9);
    ctx.fillStyle = look.dark ? 'rgba(140, 220, 80, 0.6)' : 'rgba(150, 190, 70, 0.8)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  if (look.dark) ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const lines = strong ? 3 : 2;
  for (let k = 0; k < lines; k++) {
    const phase = (time * 0.18 + k / lines) % 1;
    const offset = (k - (lines - 1) / 2) * w * 0.26;
    const fade = Math.sin(phase * Math.PI);
    for (let i = 0; i < 14; i++) {
      const t0 = phase * 0.55 + (i / 14) * 0.75;
      const t1 = phase * 0.55 + ((i + 1) / 14) * 0.75;
      const a = along(t0, offset, k * 2 + time * 1.4);
      const b = along(t1, offset, k * 2 + time * 1.4);
      ctx.globalAlpha = fade * (1 - i / 16) * (look.dark ? 0.55 : 0.9);
      ctx.strokeStyle = look.dark ? '#b8f070' : '#4f7d1f';
      ctx.lineWidth = (strong ? 4.2 : 3.2) * (1 - i / 18);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * A draft: a few long curling wind lines through the chamber and dust carried along them, all
 * blowing the same way, so it reads as moving air rather than as marks on the rock.
 */
function drawDraft(
  ctx: CanvasRenderingContext2D,
  shape: ChamberShape,
  scene: ChamberScene,
  look: Look,
): void {
  const random = scatter(scene.room * 13);
  const direction = hash2(scene.room, 4) > 0.5 ? 1 : -1;
  const span = shape.rx * 2.2;
  ctx.save();
  tracePolygon(ctx, shape.wall);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.strokeStyle = look.dark ? 'rgba(255, 230, 190, 1)' : 'rgba(84, 72, 60, 1)';
  for (let i = 0; i < 9; i++) {
    const phase = (scene.time * (0.16 + random() * 0.08) + random()) % 1;
    const y = shape.floorY - shape.ry * (0.15 + random() * 0.9);
    const length = shape.rx * (0.35 + random() * 0.3);
    const head = shape.center.x - (direction * span) / 2 + direction * phase * (span + length);
    const points: Point[] = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const x = head - direction * length * t;
      points.push({ x, y: y + Math.sin(t * Math.PI * 1.4 + i) * 10 * t });
    }
    // A curl at the head of every other line, the cartoon sign for a gust.
    if (i % 2 === 0) {
      for (let k = 1; k <= 10; k++) {
        const a = (k / 10) * Math.PI * 1.5;
        points.unshift({ x: head + direction * Math.sin(a) * 12, y: y - 12 + Math.cos(a) * 12 });
      }
    }
    ctx.globalAlpha = Math.sin(phase * Math.PI) * (look.dark ? 0.5 : 0.55);
    ctx.lineWidth = look.dark ? 1.6 : 1.8;
    ctx.beginPath();
    points.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }
  ctx.fillStyle = look.dark ? 'rgba(255, 226, 180, 1)' : 'rgba(96, 82, 66, 1)';
  for (let i = 0; i < 60; i++) {
    const speed = 0.12 + random() * 0.18;
    const phase = (scene.time * speed + random()) % 1;
    const x = shape.center.x - (direction * span) / 2 + direction * phase * span;
    const y = shape.floorY - Math.pow(random(), 1.4) * shape.ry * 1.2 + Math.sin(phase * 9 + i) * 5;
    ctx.globalAlpha = Math.sin(phase * Math.PI) * (0.35 + random() * 0.4);
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + random() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Bats heard, not seen: their shadows flicker across the vault. */
function drawBatShadows(
  ctx: CanvasRenderingContext2D,
  shape: ChamberShape,
  scene: ChamberScene,
  look: Look,
): void {
  ctx.save();
  ctx.fillStyle = look.dark ? 'rgba(0,0,0,0.75)' : 'rgba(59, 53, 66, 0.5)';
  for (let i = 0; i < 6; i++) {
    const phase = (scene.time * (0.08 + i * 0.02) + i * 0.21) % 1;
    const x = shape.center.x + Math.cos(phase * Math.PI * 2 + i) * shape.rx * 0.6;
    const y = shape.center.y - shape.ry * (0.45 + 0.2 * Math.sin(phase * Math.PI * 4 + i));
    const flap = Math.sin(scene.time * 14 + i * 2);
    batShape(ctx, x, y, 9 + (i % 3) * 5, flap);
  }
  ctx.restore();
}

export function batShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  flap: number,
): void {
  const lift = flap * size * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - size * 0.6, y - size * 0.3 - lift, x - size * 1.4, y - lift * 0.6);
  ctx.quadraticCurveTo(x - size * 1.0, y + size * 0.1, x - size * 0.8, y + size * 0.35);
  ctx.quadraticCurveTo(x - size * 0.5, y + size * 0.1, x - size * 0.25, y + size * 0.3);
  ctx.quadraticCurveTo(x, y + size * 0.1, x + size * 0.25, y + size * 0.3);
  ctx.quadraticCurveTo(x + size * 0.5, y + size * 0.1, x + size * 0.8, y + size * 0.35);
  ctx.quadraticCurveTo(x + size * 1.0, y + size * 0.1, x + size * 1.4, y - lift * 0.6);
  ctx.quadraticCurveTo(x + size * 0.6, y - size * 0.3 - lift, x, y);
  ctx.fill();
}

// —— signs ——

function drawSigns(
  ctx: CanvasRenderingContext2D,
  scene: ChamberScene,
  look: Look,
  spots: MouthSpot[],
  source: Point,
): void {
  for (const [i, mouth] of scene.mouths.entries()) {
    const spot = spots[i]!;
    const { w, h } = spot.signSize;
    const label = String(mouth.to);
    const tilt = (hash2(mouth.to, 2) - 0.5) * 0.12;
    ctx.save();
    ctx.translate(spot.sign.x, spot.sign.y);
    ctx.rotate(tilt);
    // The string it hangs from, and the peg in the rock.
    ctx.strokeStyle = look.dark ? '#a8977d' : look.outline;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h / 2);
    ctx.lineTo(0, -h / 2 - h * 0.34);
    ctx.lineTo(w * 0.3, -h / 2);
    ctx.stroke();
    ctx.fillStyle = look.dark ? '#cbb89a' : '#5a4a3a';
    ctx.beginPath();
    ctx.arc(0, -h / 2 - h * 0.34, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mouth.magic ? '#a48fe0' : look.sign;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = look.dark ? 'rgba(0,0,0,0.7)' : look.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(70, 40, 20, 0.25)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 3; g++) {
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 4, -h / 2 + h * (0.28 + g * 0.24));
      ctx.quadraticCurveTo(
        0,
        -h / 2 + h * (0.24 + g * 0.24),
        w / 2 - 4,
        -h / 2 + h * (0.3 + g * 0.24),
      );
      ctx.stroke();
    }
    letter(ctx, label, 0, 1, {
      medium: 'ink',
      color: look.signInk,
      size: h * 0.64,
      seed: mouth.to * 7,
      weight: 0.14,
    });
    if (look.dark) {
      // Signs far from the lantern sit in its fading edge, but never so dark they cannot be read.
      const distance = Math.hypot(spot.sign.x - source.x, spot.sign.y - source.y);
      ctx.fillStyle = `rgba(10, 6, 2, ${clamp((distance - 160) / 900, 0, 0.32)})`;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 5);
      ctx.fill();
    }
    ctx.restore();
    const markSize = h * 0.62;
    [...mouth.marks].forEach((mark, k) => {
      const x = spot.sign.x + w / 2 + markSize * 0.95 + k * markSize * 1.35;
      drawMark(ctx, look, mark, { x, y: spot.sign.y }, markSize, mouth.to * 13 + k);
    });
  }
}

// —— light ——

/**
 * Lantern Dark: the chamber is drawn lit, then darkness is laid over it everywhere the lantern
 * does not reach. The lantern breathes a little; as it gutters, its pool shrinks and reddens.
 */
function light(
  ctx: CanvasRenderingContext2D,
  shape: ChamberShape,
  scene: ChamberScene,
  width: number,
  height: number,
  pose: ExplorerPose,
): void {
  const flicker = 1 + Math.sin(scene.time * 9.1) * 0.025 + Math.sin(scene.time * 13.7) * 0.02;
  const source = lightSource(scene, pose, shape);
  const strength = lightStrength(scene);
  const reach = Math.max(width, height) * (0.12 + 0.38 * strength) * flicker;
  // The sleep dart glows lavender; the lantern glows warm, reddening as it gutters.
  const dartLit = scene.explorer === 'away';

  const darkness = scratchCanvas('darkness', width, height);
  const d = darkness.getContext('2d')!;
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, width, height);
  d.fillStyle = 'rgba(3, 2, 1, 0.985)';
  d.fillRect(0, 0, width, height);
  d.globalCompositeOperation = 'destination-out';
  const pool = d.createRadialGradient(source.x, source.y, reach * 0.04, source.x, source.y, reach);
  pool.addColorStop(0, 'rgba(0,0,0,1)');
  pool.addColorStop(0.3, 'rgba(0,0,0,0.9)');
  pool.addColorStop(0.65, 'rgba(0,0,0,0.42)');
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  d.fillStyle = pool;
  d.fillRect(0, 0, width, height);
  ctx.drawImage(darkness, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const red = 1 - strength;
  const warmth = ctx.createRadialGradient(source.x, source.y, 0, source.x, source.y, reach * 0.85);
  warmth.addColorStop(
    0,
    dartLit
      ? `rgba(170, 155, 255, ${0.3 * strength})`
      : `rgba(255, ${Math.round(160 - red * 80)}, ${Math.round(60 - red * 40)}, ${0.3 * strength})`,
  );
  warmth.addColorStop(1, dartLit ? 'rgba(150, 130, 255, 0)' : 'rgba(255, 140, 40, 0)');
  ctx.fillStyle = warmth;
  ctx.fillRect(0, 0, width, height);
  const halo = ctx.createRadialGradient(source.x, source.y, 0, source.x, source.y, height * 0.075);
  halo.addColorStop(0, dartLit ? 'rgba(0, 0, 0, 0)' : `rgba(255, 236, 190, ${0.9 * strength})`);
  halo.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(source.x - height * 0.08, source.y - height * 0.08, height * 0.16, height * 0.16);
  ctx.restore();
}

/**
 * Scrap Paper: a warm lantern wash pooled round the explorer, as a sketcher would dab it in; a
 * lavender hush round a sleeping wumpus; and when the lantern is dropped, the colour drains out of
 * the sketch as its light dies.
 */
function warmSketch(ctx: CanvasRenderingContext2D, shape: ChamberShape, scene: ChamberScene): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  if (scene.explorer === 'fled') {
    // Grey only what has been painted, not the page around the sketch.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(118, 124, 134, ${(1 - scene.lantern) * 0.45})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
  const at =
    scene.explorer === 'here'
      ? { x: shape.center.x + shape.rx * 0.12, y: shape.floorY - shape.ry * 0.62 }
      : scene.explorer === 'fled' || scene.explorer === 'camp'
        ? { x: droppedLantern(shape).x, y: shape.floorY - 12 }
        : { x: shape.center.x, y: shape.floorY - shape.ry * 0.5 };
  const tint = scene.explorer === 'away' ? '186, 176, 240' : '246, 196, 92';
  const strength = scene.explorer === 'away' ? 0.8 : scene.lantern;
  const glow = ctx.createRadialGradient(
    at.x,
    at.y,
    shape.ry * 0.05,
    at.x,
    at.y,
    shape.ry * (0.35 + 0.6 * strength),
  );
  glow.addColorStop(0, `rgba(${tint}, ${0.42 * strength})`);
  glow.addColorStop(0.6, `rgba(${tint}, ${0.14 * strength})`);
  glow.addColorStop(1, `rgba(${tint}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

const scratch = new Map<string, HTMLCanvasElement>();

function scratchCanvas(name: string, width: number, height: number): HTMLCanvasElement {
  const key = `${name}:${width}x${height}`;
  let canvas = scratch.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    scratch.set(key, canvas);
  }
  return canvas;
}
