import { type Garden, groundAt } from '../engine/garden';
import type { Cell } from '../engine/geometry';
import { type BoardFrame, RIM } from './frame';
import { type GardenPalette, type Look, PALETTES } from './look';
import { hash, mix, painter, rgba } from './noise';
import { type Point, softPolygon } from './shapes';

/**
 * The still part of a chamber, painted once into an offscreen canvas: the terrace above, the
 * stone rim, the flagstones with moss in their joints, the pool basins, the hedges and the
 * door's stone ring. Light comes from the north-west, so the north and west walls throw their
 * shade onto the chamber floor and everything standing casts a shadow to the south-east.
 */

export interface GroundScene {
  readonly garden: Garden;
  readonly frame: BoardFrame;
  readonly width: number;
  readonly height: number;
  readonly look: Look;
  readonly seed: number;
}

export function paintGround(ctx: CanvasRenderingContext2D, scene: GroundScene) {
  const palette = PALETTES[scene.look];
  paintTerrace(ctx, scene, palette);
  paintRim(ctx, scene, palette);
  paintFloor(ctx, scene, palette);
  paintPools(ctx, scene, palette);
  paintWallShade(ctx, scene, palette);
  paintHedges(ctx, scene, palette);
  paintDoorRing(ctx, scene, palette);
  paintIvy(ctx, scene, palette);
}

function boardRect(frame: BoardFrame) {
  return { x: frame.x, y: frame.y, w: frame.columns * frame.cell, h: frame.rows * frame.cell };
}

// ---------------------------------------------------------------------------------- terrace

function paintTerrace(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const { width, height, frame } = scene;
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, p.terrace);
  base.addColorStop(1, p.terraceDeep);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Big paving slabs in a running bond, each a shade apart, with a lit north-west lip.
  const slab = Math.max(frame.cell * 2.1, 64);
  const rows = Math.ceil(height / slab) + 1;
  const columns = Math.ceil(width / (slab * 1.6)) + 2;
  for (let r = 0; r < rows; r++) {
    for (let c = -1; c < columns; c++) {
      const x = c * slab * 1.6 + (r % 2) * slab * 0.8;
      const y = r * slab;
      const tone = hash(c, r, scene.seed + 11);
      ctx.fillStyle = mix(p.terrace, p.terraceDeep, 0.1 + tone * 0.6);
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, slab * 1.6 - 6, slab - 6, slab * 0.06);
      ctx.fill();
      ctx.strokeStyle = rgba(p.wallLight, scene.look === 'sun' ? 0.4 : 0.1);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + slab - 6);
      ctx.lineTo(x + 5, y + 5);
      ctx.lineTo(x + slab * 1.6 - 7, y + 5);
      ctx.stroke();
    }
  }
  paintPlanters(ctx, scene, p);
}

/** Terracotta planters with bushy herbs at the chamber's corners, out on the terrace. */
function paintPlanters(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const { frame } = scene;
  const board = boardRect(frame);
  const rim = RIM * frame.cell;
  const s = frame.cell;
  const spots = [
    { x: board.x - rim - s * 0.9, y: board.y - rim - s * 0.6 },
    { x: board.x + board.w + rim + s * 0.9, y: board.y - rim - s * 0.6 },
    { x: board.x - rim - s * 0.9, y: board.y + board.h + rim + s * 0.4 },
    { x: board.x + board.w + rim + s * 0.9, y: board.y + board.h + rim + s * 0.4 },
  ];
  spots.forEach((spot, i) => {
    if (spot.x < -s || spot.y < -s || spot.x > scene.width + s || spot.y > scene.height + s) return;
    const r = s * (0.7 + hash(i, 4, scene.seed) * 0.2);
    ctx.fillStyle = rgba('#000000', scene.look === 'sun' ? 0.22 : 0.4);
    ctx.beginPath();
    ctx.ellipse(spot.x + r * 0.25, spot.y + r * 0.35, r * 1.05, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const pot = ctx.createRadialGradient(spot.x - r * 0.3, spot.y - r * 0.3, 0, spot.x, spot.y, r);
    pot.addColorStop(0, scene.look === 'sun' ? '#e08a5a' : '#8a5a4a');
    pot.addColorStop(1, scene.look === 'sun' ? '#a8532c' : '#4f3028');
    ctx.fillStyle = pot;
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = scene.look === 'sun' ? '#5a3a1e' : '#2a1c14';
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, r * 0.82, 0, Math.PI * 2);
    ctx.fill();
    bush(ctx, spot.x, spot.y - r * 0.05, r * 0.95, p, painter(scene.seed * 31 + i), scene.look);
  });
}

function bush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  p: GardenPalette,
  random: () => number,
  look: Look,
) {
  for (let k = 0; k < 34; k++) {
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * r * 0.8;
    const lx = x + Math.cos(a) * d;
    const ly = y + Math.sin(a) * d;
    const lit = Math.max(0, 1 - (lx - x + ly - y + r) / (2 * r));
    ctx.fillStyle = mix(p.hedge[1], p.hedge[2], lit);
    leaf(ctx, lx, ly, r * (0.2 + random() * 0.12), random() * Math.PI * 2);
  }
  const flower =
    look === 'sun' ? ['#f7d64a', '#f59bb0', '#ffffff'] : [p.blossom, '#ffe08a', '#d8e8ff'];
  for (let k = 0; k < 7; k++) {
    const a = random() * Math.PI * 2;
    const d = random() * r * 0.65;
    ctx.fillStyle = flower[k % flower.length]!;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A single leaf, pointed at both ends. */
function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-length / 2, 0);
  ctx.quadraticCurveTo(0, -length * 0.38, length / 2, 0);
  ctx.quadraticCurveTo(0, length * 0.38, -length / 2, 0);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------- rim

function paintRim(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const { frame } = scene;
  const board = boardRect(frame);
  const rim = RIM * frame.cell;

  ctx.save();
  ctx.shadowColor = p.shadow;
  ctx.shadowBlur = rim * 0.8;
  ctx.shadowOffsetX = rim * 0.2;
  ctx.shadowOffsetY = rim * 0.3;
  ctx.fillStyle = p.wallFace;
  ctx.beginPath();
  ctx.roundRect(board.x - rim, board.y - rim, board.w + rim * 2, board.h + rim * 2, rim * 0.4);
  ctx.fill();
  ctx.restore();

  // Coping blocks all the way round, lit from the north-west.
  const random = painter(scene.seed + 101);
  const blockLength = frame.cell * 1.5;
  const sides = [
    { x: board.x - rim, y: board.y - rim, dx: 1, dy: 0, length: board.w + rim * 2 },
    { x: board.x - rim, y: board.y + board.h, dx: 1, dy: 0, length: board.w + rim * 2 },
    { x: board.x - rim, y: board.y, dx: 0, dy: 1, length: board.h },
    { x: board.x + board.w, y: board.y, dx: 0, dy: 1, length: board.h },
  ];
  for (const side of sides) {
    let offset = 0;
    while (offset < side.length - 1) {
      const length = Math.min(blockLength * (0.7 + random() * 0.6), side.length - offset);
      const bx = side.x + side.dx * offset;
      const by = side.y + side.dy * offset;
      const w = side.dx ? length : rim;
      const h = side.dy ? length : rim;
      ctx.fillStyle = mix(p.wallFace, p.wallLight, 0.2 + random() * 0.45);
      ctx.beginPath();
      ctx.roundRect(bx + 1.5, by + 1.5, w - 3, h - 3, Math.min(w, h) * 0.16);
      ctx.fill();
      ctx.strokeStyle = rgba(p.wallLight, scene.look === 'sun' ? 0.7 : 0.25);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx + 3, by + h - 4);
      ctx.lineTo(bx + 3, by + 3);
      ctx.lineTo(bx + w - 4, by + 3);
      ctx.stroke();
      ctx.strokeStyle = rgba(p.wallShade, 0.55);
      ctx.beginPath();
      ctx.moveTo(bx + w - 3, by + 4);
      ctx.lineTo(bx + w - 3, by + h - 3);
      ctx.lineTo(bx + 4, by + h - 3);
      ctx.stroke();
      offset += length;
    }
  }

  // The inner face of the north wall, seen from above and in its own shade.
  const face = rim * 0.45;
  const faceGradient = ctx.createLinearGradient(0, board.y - face, 0, board.y);
  faceGradient.addColorStop(0, p.wallFace);
  faceGradient.addColorStop(1, p.wallShade);
  ctx.fillStyle = faceGradient;
  ctx.fillRect(board.x, board.y - face, board.w, face);
  ctx.strokeStyle = rgba(p.wallShade, 0.7);
  ctx.lineWidth = 1.5;
  for (let x = board.x + frame.cell * 0.9; x < board.x + board.w; x += frame.cell * 1.5) {
    ctx.beginPath();
    ctx.moveTo(x, board.y - face);
    ctx.lineTo(x, board.y);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------------- floor

function stoneCorners(scene: GroundScene, cell: Cell): Point[] {
  const { frame, seed } = scene;
  const s = frame.cell;
  const gap = Math.max(1.5, s * 0.04);
  const jitter = s * 0.06;
  const x0 = frame.x + cell.x * s;
  const y0 = frame.y + cell.y * s;
  const j = (k: number) => Math.abs(hash(cell.x, cell.y, seed + k) - 0.5) * 2 * jitter;
  return [
    { x: x0 + gap + j(1), y: y0 + gap + j(2) },
    { x: x0 + s - gap - j(3), y: y0 + gap + j(4) },
    { x: x0 + s - gap - j(5), y: y0 + s - gap - j(6) },
    { x: x0 + gap + j(7), y: y0 + s - gap - j(8) },
  ];
}

function paintFloor(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const { frame, garden } = scene;
  const board = boardRect(frame);
  // Earth and grit between the stones.
  const earth = ctx.createLinearGradient(board.x, board.y, board.x + board.w, board.y + board.h);
  earth.addColorStop(0, mix(p.mortar, p.moss[1], 0.35));
  earth.addColorStop(1, p.mortar);
  ctx.fillStyle = earth;
  ctx.fillRect(board.x, board.y, board.w, board.h);
  for (let y = 0; y < garden.height; y++) {
    for (let x = 0; x < garden.width; x++) {
      if (groundAt(garden, { x, y }) === 'pool') continue;
      paintStone(ctx, scene, p, { x, y });
    }
  }
  paintMoss(ctx, scene, p);
  paintLitter(ctx, scene, p);
}

function paintStone(
  ctx: CanvasRenderingContext2D,
  scene: GroundScene,
  p: GardenPalette,
  cell: Cell,
) {
  const { frame, seed, look } = scene;
  const s = frame.cell;
  const corners = stoneCorners(scene, cell);
  const tone = hash(cell.x, cell.y, seed + 21);
  const pick = hash(cell.x, cell.y, seed + 22);
  let base =
    tone < 0.5
      ? mix(p.stone[0], p.stone[1], tone * 2)
      : mix(p.stone[0], p.stone[2], (tone - 0.5) * 2);
  // Now and then a stone of another quarry: greener, or warmer.
  if (pick < 0.08) base = mix(base, p.moss[0], look === 'sun' ? 0.22 : 0.18);
  else if (pick > 0.93) base = mix(base, look === 'sun' ? '#d39a6a' : '#5d5a7e', 0.25);
  const radius = s * 0.14;

  ctx.save();
  ctx.translate(s * 0.025, s * 0.04);
  ctx.beginPath();
  softPolygon(ctx, corners, radius);
  ctx.fillStyle = p.stoneShade;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  softPolygon(ctx, corners, radius);
  const x0 = frame.x + cell.x * s;
  const y0 = frame.y + cell.y * s;
  const face = ctx.createLinearGradient(x0, y0, x0 + s, y0 + s);
  face.addColorStop(0, mix(base, '#ffffff', look === 'sun' ? 0.14 : 0.07));
  face.addColorStop(1, mix(base, '#000000', look === 'sun' ? 0.08 : 0.16));
  ctx.fillStyle = face;
  ctx.fill();

  ctx.save();
  ctx.clip();
  const random = painter(Math.floor(hash(cell.x, cell.y, seed + 5) * 1e9));
  // A cloudy texture: soft blotches a shade lighter and darker.
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = rgba(
      random() < 0.5 ? mix(base, '#000000', 0.25) : mix(base, '#ffffff', 0.35),
      0.16,
    );
    ctx.beginPath();
    ctx.ellipse(
      x0 + random() * s,
      y0 + random() * s,
      s * (0.12 + random() * 0.2),
      s * (0.08 + random() * 0.14),
      random() * 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  for (let k = 0; k < 14; k++) {
    ctx.fillStyle =
      random() < 0.6
        ? rgba(mix(base, '#000000', 0.4), 0.3)
        : rgba(mix(base, '#ffffff', 0.55), 0.35);
    ctx.beginPath();
    ctx.arc(x0 + random() * s, y0 + random() * s, s * (0.006 + random() * 0.012), 0, Math.PI * 2);
    ctx.fill();
  }
  if (random() < 0.18) {
    ctx.strokeStyle = rgba(mix(base, '#000000', 0.5), 0.45);
    ctx.lineWidth = Math.max(1, s * 0.014);
    ctx.beginPath();
    let cx = x0 + s * (0.2 + random() * 0.6);
    let cy = y0 + s * 0.08;
    ctx.moveTo(cx, cy);
    for (let k = 0; k < 4; k++) {
      cx += (random() - 0.5) * s * 0.3;
      cy += s * (0.12 + random() * 0.1);
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = p.stoneLight;
  ctx.lineWidth = s * 0.055;
  ctx.beginPath();
  ctx.moveTo(corners[3]!.x, corners[3]!.y);
  ctx.lineTo(corners[0]!.x, corners[0]!.y);
  ctx.lineTo(corners[1]!.x, corners[1]!.y);
  ctx.stroke();
  ctx.restore();
}

/** Moss creeping along the joints: thick in the shade of the walls and hedges, thin in the open. */
function paintMoss(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const { frame, garden, seed } = scene;
  const s = frame.cell;
  const random = painter(seed + 37);
  const shadeAt = (x: number, y: number) => {
    const wall = Math.max(0, 1 - Math.min(x, y) / 3);
    let hedge = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (groundAt(garden, { x: x + dx, y: y + dy }) === 'hedge') hedge = 0.7;
      }
    }
    return Math.max(wall, hedge);
  };
  for (let y = 0; y < garden.height; y++) {
    for (let x = 0; x < garden.width; x++) {
      for (const horizontal of [true, false]) {
        const shade = shadeAt(x, y);
        if (random() > 0.12 + shade * 0.45) continue;
        const ax = frame.x + (horizontal ? x : x + 1) * s;
        const ay = frame.y + (horizontal ? y + 1 : y) * s;
        const length = s * (0.3 + random() * 0.7);
        const start = random() * (s - length);
        for (let t = 0; t < length; t += s * 0.035) {
          const along = start + t;
          const px = horizontal ? ax + along : ax + (random() - 0.5) * s * 0.03;
          const py = horizontal ? ay + (random() - 0.5) * s * 0.03 : ay + along;
          const swell = Math.sin((t / length) * Math.PI);
          ctx.fillStyle = random() < 0.5 ? p.moss[0] : p.moss[1];
          ctx.beginPath();
          ctx.arc(px, py, s * (0.02 + swell * 0.035 * (0.6 + random() * 0.6)), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

/** Fallen petals and leaves, a few pebbles: life on the floor that never gets in the way. */
function paintLitter(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const { frame, garden, seed, look } = scene;
  const s = frame.cell;
  const random = painter(seed + 73);
  const count = Math.round(garden.width * garden.height * 0.12);
  for (let i = 0; i < count; i++) {
    const x = frame.x + random() * garden.width * s;
    const y = frame.y + random() * garden.height * s;
    const cell = { x: Math.floor((x - frame.x) / s), y: Math.floor((y - frame.y) / s) };
    if (groundAt(garden, cell) !== 'stone') continue;
    const kind = random();
    if (kind < 0.45) {
      ctx.fillStyle =
        look === 'sun' ? (random() < 0.5 ? '#f3a6b8' : '#fbe3ea') : rgba(p.blossom, 0.7);
      leaf(ctx, x, y, s * 0.1, random() * Math.PI * 2);
    } else if (kind < 0.8) {
      ctx.fillStyle = look === 'sun' ? (random() < 0.5 ? '#c9a24a' : '#8fae4a') : '#3f6b5c';
      leaf(ctx, x, y, s * (0.12 + random() * 0.08), random() * Math.PI * 2);
    } else {
      ctx.fillStyle = rgba(mix(p.stone[1], '#000000', 0.3), 0.8);
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.035, s * 0.028, random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------------- masks

/**
 * Hedges and pools are unions of squares. Stroking a union strokes every square's own edge
 * too, so their rims and inner shadows are made from masks instead: a layer cut to the shape,
 * minus the same shape shifted, leaves a crescent exactly along the outer edge.
 */
function layerLike(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  const layer = document.createElement('canvas');
  layer.width = ctx.canvas.width;
  layer.height = ctx.canvas.height;
  const lctx = layer.getContext('2d')!;
  lctx.setTransform(ctx.getTransform());
  return lctx;
}

/** Fills the band of `shape` that its copy shifted by (dx, dy) does not cover. */
function edgeBand(
  ctx: CanvasRenderingContext2D,
  shape: Path2D,
  dx: number,
  dy: number,
  colour: string,
) {
  const band = layerLike(ctx);
  band.fillStyle = colour;
  band.fill(shape);
  band.globalCompositeOperation = 'destination-out';
  band.translate(dx, dy);
  band.fillStyle = '#000';
  band.fill(shape);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(band.canvas, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------------- pools

/** The union of a set of squares as one rounded shape, for hedges and pools. */
export function blobPath(
  frame: BoardFrame,
  cells: readonly Cell[],
  inset: number,
  radius: number,
): Path2D {
  const path = new Path2D();
  const s = frame.cell;
  const has = new Set(cells.map((c) => `${c.x},${c.y}`));
  for (const c of cells) {
    path.roundRect(
      frame.x + c.x * s + inset,
      frame.y + c.y * s + inset,
      s - inset * 2,
      s - inset * 2,
      radius,
    );
    if (has.has(`${c.x + 1},${c.y}`)) {
      path.rect(frame.x + c.x * s + s / 2, frame.y + c.y * s + inset, s, s - inset * 2);
    }
    if (has.has(`${c.x},${c.y + 1}`)) {
      path.rect(frame.x + c.x * s + inset, frame.y + c.y * s + s / 2, s - inset * 2, s);
    }
    if (
      has.has(`${c.x + 1},${c.y}`) &&
      has.has(`${c.x},${c.y + 1}`) &&
      has.has(`${c.x + 1},${c.y + 1}`)
    ) {
      path.rect(frame.x + c.x * s + s / 2, frame.y + c.y * s + s / 2, s, s);
    }
  }
  return path;
}

export function cellsOf(garden: Garden, kind: 'pool' | 'hedge'): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < garden.height; y++) {
    for (let x = 0; x < garden.width; x++)
      if (groundAt(garden, { x, y }) === kind) cells.push({ x, y });
  }
  return cells;
}

function paintPools(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const cells = cellsOf(scene.garden, 'pool');
  if (cells.length === 0) return;
  const { frame } = scene;
  const s = frame.cell;
  const outline = blobPath(frame, cells, s * 0.0, s * 0.34);
  const water = blobPath(frame, cells, s * 0.13, s * 0.26);

  ctx.save();
  ctx.translate(s * 0.03, s * 0.05);
  ctx.fillStyle = p.stoneShade;
  ctx.fill(outline);
  ctx.restore();
  const coping = ctx.createLinearGradient(
    frame.x,
    frame.y,
    frame.x + frame.columns * s,
    frame.y + frame.rows * s,
  );
  coping.addColorStop(0, mix(p.stone[2], p.wallLight, 0.5));
  coping.addColorStop(1, p.stone[1]);
  ctx.fillStyle = coping;
  ctx.fill(outline);

  ctx.save();
  ctx.clip(water);
  const bounds = cells.reduce(
    (b, c) => ({
      x0: Math.min(b.x0, c.x),
      y0: Math.min(b.y0, c.y),
      x1: Math.max(b.x1, c.x + 1),
      y1: Math.max(b.y1, c.y + 1),
    }),
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
  );
  const gradient = ctx.createLinearGradient(0, frame.y + bounds.y0 * s, 0, frame.y + bounds.y1 * s);
  gradient.addColorStop(0, p.water[1]);
  gradient.addColorStop(0.35, p.water[0]);
  gradient.addColorStop(1, mix(p.water[0], '#ffffff', 0.15));
  ctx.fillStyle = gradient;
  ctx.fillRect(
    frame.x + bounds.x0 * s,
    frame.y + bounds.y0 * s,
    (bounds.x1 - bounds.x0) * s,
    (bounds.y1 - bounds.y0) * s,
  );
  ctx.restore();
  // The coping's shadow falls across the water's north-west edge.
  edgeBand(ctx, water, s * 0.12, s * 0.16, rgba(p.water[1], 0.75));

  ctx.save();
  ctx.clip(water);
  const random = painter(scene.seed + 61);
  for (const c of cells) {
    if (random() < 0.4) continue;
    const x = frame.x + (c.x + 0.25 + random() * 0.5) * s;
    const y = frame.y + (c.y + 0.25 + random() * 0.5) * s;
    const r = s * (0.15 + random() * 0.08);
    lilyPad(ctx, x, y, r, random() * Math.PI * 2, p);
    if (random() < 0.35) blossom(ctx, x + r * 0.2, y - r * 0.2, r * 0.6, p.blossom);
  }
  ctx.restore();
}

function lilyPad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  turn: number,
  p: GardenPalette,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.fillStyle = rgba('#000000', 0.2);
  ctx.beginPath();
  ctx.ellipse(r * 0.08, r * 0.14, r, r * 0.92, 0, 0.35, Math.PI * 2 - 0.35);
  ctx.lineTo(r * 0.08, r * 0.14);
  ctx.fill();
  const pad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
  pad.addColorStop(0, p.lily[0]);
  pad.addColorStop(1, p.lily[1]);
  ctx.fillStyle = pad;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.92, 0, 0.35, Math.PI * 2 - 0.35);
  ctx.lineTo(0, 0);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.22);
  ctx.lineWidth = Math.max(1, r * 0.06);
  for (let k = 0; k < 5; k++) {
    const a = 0.7 + k * 1.1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.78);
    ctx.stroke();
  }
  ctx.restore();
}

function blossom(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.fillStyle = k % 2 ? colour : mix(colour, '#ffffff', 0.4);
    ctx.beginPath();
    ctx.ellipse(
      x + Math.cos(a) * r * 0.42,
      y + Math.sin(a) * r * 0.42,
      r * 0.48,
      r * 0.24,
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------------- shade

function paintWallShade(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const board = boardRect(scene.frame);
  const depth = scene.frame.cell * (scene.look === 'sun' ? 0.7 : 1.1);
  const north = ctx.createLinearGradient(0, board.y, 0, board.y + depth);
  north.addColorStop(0, p.shadow);
  north.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = north;
  ctx.fillRect(board.x, board.y, board.w, depth);
  const west = ctx.createLinearGradient(board.x, 0, board.x + depth * 0.7, 0);
  west.addColorStop(0, p.shadow);
  west.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = west;
  ctx.fillRect(board.x, board.y, depth * 0.7, board.h);
}

// ---------------------------------------------------------------------------------- hedges

function paintHedges(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const cells = cellsOf(scene.garden, 'hedge');
  if (cells.length === 0) return;
  const { frame, seed, look } = scene;
  const s = frame.cell;
  const mass = blobPath(frame, cells, s * 0.03, s * 0.36);

  // A crisp cast shadow to the south-east: hedges stand about knee high.
  ctx.save();
  ctx.translate(s * 0.2, s * 0.28);
  ctx.fillStyle = p.shadow;
  ctx.filter = `blur(${Math.max(1, s * 0.03)}px)`;
  ctx.fill(mass);
  ctx.restore();

  const body = ctx.createLinearGradient(
    frame.x,
    frame.y,
    frame.x + frame.columns * s,
    frame.y + frame.rows * s,
  );
  body.addColorStop(0, p.hedge[0]);
  body.addColorStop(1, p.hedge[1]);
  ctx.fillStyle = body;
  ctx.fill(mass);

  ctx.save();
  ctx.clip(mass);
  const random = painter(seed + 77);
  // Leaves in three tones, lighter toward each square's north-west where the sun falls.
  for (const c of cells) {
    const x0 = frame.x + c.x * s;
    const y0 = frame.y + c.y * s;
    for (let k = 0; k < 70; k++) {
      const u = random();
      const v = random();
      const lit = Math.max(0, 1 - (u + v) * 0.75) + random() * 0.25;
      ctx.fillStyle = lit > 0.75 ? p.hedge[2] : lit > 0.35 ? p.hedge[0] : p.hedge[1];
      leaf(ctx, x0 + u * s, y0 + v * s, s * (0.1 + random() * 0.08), random() * Math.PI * 2);
    }
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = rgba(p.hedgeLight, look === 'sun' ? 0.7 : 0.45);
      leaf(
        ctx,
        x0 + s * (0.08 + random() * 0.5),
        y0 + s * (0.08 + random() * 0.5),
        s * (0.06 + random() * 0.05),
        random() * Math.PI * 2,
      );
    }
  }
  ctx.restore();
  // Rounded tops: dark under the south-east edge, lit along the north-west one.
  edgeBand(ctx, mass, -s * 0.1, -s * 0.12, rgba('#000000', look === 'sun' ? 0.3 : 0.42));
  edgeBand(ctx, mass, s * 0.06, s * 0.06, rgba(p.hedgeLight, look === 'sun' ? 0.55 : 0.3));
}

// ---------------------------------------------------------------------------------- ivy

/** Ivy spilling over the rim into the chamber at a few places, for a lived-in garden. */
function paintIvy(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const { frame, seed, look } = scene;
  const board = boardRect(frame);
  const rim = RIM * frame.cell;
  const s = frame.cell;
  const random = painter(seed + 211);
  const strands = Math.max(4, Math.round((frame.columns + frame.rows) / 5));
  for (let i = 0; i < strands; i++) {
    const onTop = random() < 0.6;
    const along = 0.08 + random() * 0.84;
    let x = onTop ? board.x + along * board.w : board.x - rim * 0.5;
    let y = onTop ? board.y - rim * 0.6 : board.y + along * board.h;
    const steps = 6 + Math.floor(random() * 6);
    ctx.strokeStyle = look === 'sun' ? '#6b5a2e' : '#2c3a3a';
    ctx.lineWidth = Math.max(1, s * 0.025);
    const points: Point[] = [{ x, y }];
    for (let k = 0; k < steps; k++) {
      x += onTop ? (random() - 0.5) * s * 0.35 : s * (0.12 + random() * 0.08);
      y += onTop ? s * (0.12 + random() * 0.08) : (random() - 0.5) * s * 0.35;
      points.push({ x, y });
    }
    ctx.beginPath();
    points.forEach((pt, k) => (k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
    ctx.stroke();
    points.forEach((pt, k) => {
      const size = s * (0.2 - (k / points.length) * 0.08);
      for (const side of [-1, 1]) {
        if (random() < 0.25) continue;
        ctx.fillStyle = random() < 0.4 ? p.hedge[2] : p.hedge[0];
        ivyLeaf(ctx, pt.x + side * size * 0.45, pt.y, size, random() * Math.PI * 2);
      }
    });
  }
}

function ivyLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.quadraticCurveTo(-size * 0.55, size * 0.1, -size * 0.35, -size * 0.25);
  ctx.quadraticCurveTo(0, -size * 0.1, 0, -size * 0.5);
  ctx.quadraticCurveTo(0, -size * 0.1, size * 0.35, -size * 0.25);
  ctx.quadraticCurveTo(size * 0.55, size * 0.1, 0, size * 0.5);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------- door

function paintDoorRing(ctx: CanvasRenderingContext2D, scene: GroundScene, p: GardenPalette) {
  const { frame, garden } = scene;
  const s = frame.cell;
  const x = frame.x + (garden.door.x + 0.5) * s;
  const y = frame.y + (garden.door.y + 0.5) * s;
  ctx.fillStyle = p.stoneShade;
  ctx.beginPath();
  ctx.arc(x + s * 0.04, y + s * 0.06, s * 0.56, 0, Math.PI * 2);
  ctx.fill();
  const ring = ctx.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2);
  ring.addColorStop(0, mix(p.wallLight, p.stone[2], 0.2));
  ring.addColorStop(1, p.wallFace);
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.56, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(p.wallShade, 0.75);
  ctx.lineWidth = Math.max(1, s * 0.018);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * s * 0.44, y + Math.sin(a) * s * 0.44);
    ctx.lineTo(x + Math.cos(a) * s * 0.56, y + Math.sin(a) * s * 0.56);
    ctx.stroke();
  }
}
