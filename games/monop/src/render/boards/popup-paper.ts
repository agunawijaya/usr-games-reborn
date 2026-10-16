import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { createRng } from '@usr-games/kit';

/**
 * Paper drawn in code for the pop-up book: cream stock with a faint grain, and pictures in the
 * manner of an Edwardian children's book, an ink line round watercolour washes. Every shop
 * front, roof, tree and passer-by on the board is one of these, printed onto card.
 */

export const INK = '#2b2118';
export const PAPER = '#f6ecd6';

function surface(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return [element, element.getContext('2d')!];
}

function finish(element: HTMLCanvasElement, repeat = false): CanvasTexture {
  const map = new CanvasTexture(element);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  map.minFilter = LinearMipmapLinearFilter;
  if (repeat) map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

/** A faint speckle and fibre over everything painted so far. */
function grain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: string,
  strength = 0.06,
): void {
  const rng = createRng(seed);
  for (let i = 0; i < (width * height) / 90; i++) {
    ctx.fillStyle = rng.chance(0.5)
      ? `rgba(90,60,30,${strength * rng.next()})`
      : `rgba(255,255,240,${strength * rng.next()})`;
    ctx.fillRect(rng.next() * width, rng.next() * height, 1 + rng.next() * 2, 1);
  }
}

/** A watercolour wash: the fill, darker at its edge where the pigment pooled. */
function wash(ctx: CanvasRenderingContext2D, path: Path2D, colour: string): void {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.85;
  ctx.fill(path);
  ctx.clip(path);
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 10;
  ctx.filter = 'brightness(0.75)';
  ctx.stroke(path);
  ctx.restore();
}

function ink(ctx: CanvasRenderingContext2D, path: Path2D, width = 3): void {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(path);
  ctx.restore();
}

export function paperTexture(seed: string, colour = PAPER, size = 512): CanvasTexture {
  const [element, ctx] = surface(size, size);
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, size, size);
  grain(ctx, size, size, seed, 0.08);
  return finish(element, true);
}

export interface FacadeStyle {
  wall: string;
  trim: string;
  /** 0 brick, 1 timber frame, 2 stucco, 3 iron and glass. */
  kind: number;
}

/**
 * One storey of a shop front or house front, as a tile 256 wide by 128 high: two windows (or a
 * shop window and a door on the ground floor), drawn in ink and washed in the district's colours.
 */
export function facadeTile(
  style: FacadeStyle,
  ground: boolean,
  seed: string,
  lamplit: boolean,
): CanvasTexture {
  const [element, ctx] = surface(256, 128);
  const rng = createRng(seed);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 256, 128);
  wash(ctx, rect(4, 4, 248, 120), style.wall);
  if (style.kind === 0) {
    ctx.strokeStyle = 'rgba(60,30,20,0.35)';
    ctx.lineWidth = 1.2;
    for (let y = 10; y < 124; y += 9) {
      ctx.beginPath();
      ctx.moveTo(6, y);
      ctx.lineTo(250, y);
      ctx.stroke();
    }
  } else if (style.kind === 1) {
    ctx.strokeStyle = '#5a3a24';
    ctx.lineWidth = 6;
    for (const x of [8, 128, 248]) {
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.lineTo(x, 122);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(8, 64);
    ctx.lineTo(60, 10);
    ctx.moveTo(248, 64);
    ctx.lineTo(196, 10);
    ctx.stroke();
  }
  const glass = lamplit ? '#ffd27a' : '#9fb6c6';
  if (ground) {
    const shop = rect(18, 30, 140, 84);
    wash(ctx, shop, glass);
    ink(ctx, shop);
    ink(ctx, line(88, 30, 88, 114), 2);
    const door = rect(176, 36, 52, 84);
    wash(ctx, door, style.trim);
    ink(ctx, door);
    // The shop's name board above the window.
    const board = rect(14, 8, 228, 18);
    wash(ctx, board, style.trim);
    ink(ctx, board, 2);
    ctx.fillStyle = PAPER;
    ctx.font = "italic 700 13px 'Fraunces Variable', Georgia, serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      rng.pick(['Provisions', 'Tea & Cakes', 'Ironmonger', 'Drapers', 'Books', 'Bakery', 'Grocer']),
      128,
      18,
    );
  } else {
    for (const x of [36, 150]) {
      const pane = rect(x, 26, 70, 78);
      wash(ctx, pane, glass);
      ink(ctx, pane);
      ink(ctx, line(x + 35, 26, x + 35, 104), 2);
      ink(ctx, line(x, 64, x + 70, 64), 2);
      const sill = rect(x - 6, 104, 82, 7);
      wash(ctx, sill, style.trim);
      ink(ctx, sill, 2);
    }
  }
  ink(ctx, rect(4, 4, 248, 120), 3.5);
  grain(ctx, 256, 128, seed);
  return finish(element);
}

/** A roof face: rows of slates or tiles in ink over a wash. */
export function roofTile(colour: string, seed: string): CanvasTexture {
  const [element, ctx] = surface(256, 128);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 256, 128);
  wash(ctx, rect(2, 2, 252, 124), colour);
  ctx.strokeStyle = 'rgba(40,25,15,0.55)';
  ctx.lineWidth = 1.6;
  for (let y = 14; y < 128; y += 14) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 16) {
      ctx.moveTo(x + ((y / 14) % 2) * 8, y);
      ctx.arc(x + ((y / 14) % 2) * 8 + 8, y, 8, Math.PI, 0, true);
    }
    ctx.stroke();
  }
  grain(ctx, 256, 128, seed);
  return finish(element);
}

const labels = new Map<string, CanvasTexture>();

/**
 * A tent card's face: the space's name in a period serif, with the group's colour as a rule.
 * Painted once per name and kept, since lots are rebuilt as they change.
 */
export function labelTexture(name: string, band: string, note: string | null): CanvasTexture {
  const key = `${name}|${band}|${note ?? ''}`;
  let map = labels.get(key);
  if (!map) {
    map = paintLabel(name, band, note);
    labels.set(key, map);
  }
  return map;
}

function paintLabel(name: string, band: string, note: string | null): CanvasTexture {
  const [element, ctx] = surface(512, 200);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 512, 200);
  ctx.fillStyle = band;
  ctx.fillRect(16, 16, 480, 30);
  if (note) {
    ctx.fillStyle = PAPER;
    ctx.font = "700 22px 'Fraunces Variable', Georgia, serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(note.toUpperCase(), 256, 32);
  }
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 62;
  do {
    ctx.font = `italic 700 ${size}px 'Fraunces Variable', Georgia, serif`;
    size -= 2;
  } while (ctx.measureText(name).width > 460 && size > 24);
  ctx.fillText(name, 256, 120);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 496, 184);
  grain(ctx, 512, 200, name);
  return finish(element);
}

/** A cut-out silhouette: a tree, a lamp-post, a passer-by or a carriage, in ink and wash. */
export function cutout(
  kind: 'tree' | 'poplar' | 'person' | 'carriage' | 'cart',
  colour: string,
  seed: string,
): CanvasTexture {
  const [element, ctx] = surface(128, 160);
  const rng = createRng(seed);
  ctx.clearRect(0, 0, 128, 160);
  if (kind === 'tree' || kind === 'poplar') {
    const trunk = rect(58, 100, 12, 56);
    wash(ctx, trunk, '#7a5434');
    ink(ctx, trunk, 2.5);
    const crown = new Path2D();
    if (kind === 'tree') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        crown.moveTo(64 + Math.cos(a) * 30 + 22, 62 + Math.sin(a) * 26);
        crown.arc(64 + Math.cos(a) * 30, 62 + Math.sin(a) * 26, 22, 0, Math.PI * 2);
      }
      crown.moveTo(64 + 34, 62);
      crown.arc(64, 62, 34, 0, Math.PI * 2);
    } else {
      crown.ellipse(64, 66, 24, 58, 0, 0, Math.PI * 2);
    }
    wash(ctx, crown, colour);
    ink(ctx, crown, 2.5);
  } else if (kind === 'person') {
    const body = new Path2D();
    body.moveTo(50, 150);
    body.lineTo(54, 74);
    body.quadraticCurveTo(64, 64, 74, 74);
    body.lineTo(80, 150);
    body.closePath();
    wash(ctx, body, colour);
    ink(ctx, body, 2.5);
    const head = new Path2D();
    head.arc(64, 54, 12, 0, Math.PI * 2);
    wash(ctx, head, '#f1c7a3');
    ink(ctx, head, 2.5);
    const hat = new Path2D(
      rng.chance(0.5) ? 'M46 44h36M52 44c0-14 24-14 24 0' : 'M50 44c2-12 26-12 28 0z',
    );
    wash(ctx, hat, '#3a3442');
    ink(ctx, hat, 2.5);
  } else {
    const body = rect(18, 60, 92, 52);
    wash(ctx, body, colour);
    ink(ctx, body, 3);
    const window = rect(30, 70, 34, 26);
    wash(ctx, window, '#9fb6c6');
    ink(ctx, window, 2);
    for (const x of [36, 92]) {
      const wheel = new Path2D();
      wheel.arc(x, 122, 18, 0, Math.PI * 2);
      ink(ctx, wheel, 4);
      ink(ctx, line(x - 18, 122, x + 18, 122), 1.5);
      ink(ctx, line(x, 104, x, 140), 1.5);
    }
    if (kind === 'carriage') ink(ctx, line(110, 86, 126, 96), 3);
  }
  return finish(element);
}

function rect(x: number, y: number, w: number, h: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, w, h);
  return path;
}

function line(x1: number, y1: number, x2: number, y2: number): Path2D {
  const path = new Path2D();
  path.moveTo(x1, y1);
  path.lineTo(x2, y2);
  return path;
}

/**
 * The board printed across the spread, 2048 pixels over the 60 × 60 square the board fills:
 * a cream ground, the ring road as a sandy lane with a dashed centre line, each lot's plot
 * outlined in ink with its group's colour washed along the road edge, the park's lawns and pond,
 * and an engraved border.
 */
export function printedBoard(
  plots: readonly { corners: readonly [number, number][]; colour: string | null }[],
  toPixel: (x: number, z: number) => [number, number],
  roadPath: (offset: number) => [number, number][],
  lamplit: boolean,
): CanvasTexture {
  const size = 2048;
  const [element, ctx] = surface(size, size);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);
  // Engraved border.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, size - 80, size - 80);
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 58, size - 116, size - 116);
  // The lanes.
  const ring = (offset: number) => {
    const path = new Path2D();
    roadPath(offset).forEach(([x, z], i) => {
      const [px, py] = toPixel(x, z);
      if (i === 0) path.moveTo(px, py);
      else path.lineTo(px, py);
    });
    path.closePath();
    return path;
  };
  const outer = ring(1.75);
  const inner = ring(-1.75);
  ctx.save();
  ctx.fillStyle = lamplit ? '#d9c08f' : '#e4cf9f';
  ctx.fill(outer);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(inner);
  ctx.restore();
  ink(ctx, outer, 4);
  ink(ctx, inner, 4);
  ctx.save();
  ctx.setLineDash([18, 22]);
  ink(ctx, ring(0), 2.5);
  ctx.restore();
  // The park inside the lane: lawn, paths and a pond.
  ctx.save();
  ctx.clip(inner);
  ctx.fillStyle = '#b9cf8a';
  ctx.globalAlpha = 0.85;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;
  const [cx, cy] = toPixel(0, 0);
  ctx.strokeStyle = '#e8d8b0';
  ctx.lineWidth = 46;
  for (const angle of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(angle) * 900, cy - Math.sin(angle) * 900);
    ctx.lineTo(cx + Math.cos(angle) * 900, cy + Math.sin(angle) * 900);
    ctx.stroke();
  }
  const pond = new Path2D();
  const [px, py] = toPixel(-8.5, -8.5);
  pond.ellipse(px, py, 150, 105, 0.4, 0, Math.PI * 2);
  wash(ctx, pond, '#7fa9c4');
  ink(ctx, pond, 3);
  const plaza = new Path2D();
  plaza.arc(cx, cy, 200, 0, Math.PI * 2);
  wash(ctx, plaza, '#eadbb6');
  ink(ctx, plaza, 3);
  ctx.restore();
  // Each lot: an inked plot, its group's colour along the road edge.
  for (const plot of plots) {
    const path = new Path2D();
    plot.corners.forEach(([x, z], i) => {
      const [qx, qy] = toPixel(x, z);
      if (i === 0) path.moveTo(qx, qy);
      else path.lineTo(qx, qy);
    });
    path.closePath();
    if (plot.colour) {
      ctx.save();
      ctx.clip(path);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = plot.colour;
      ctx.fill(path);
      ctx.restore();
    }
    ink(ctx, path, 2.5);
  }
  grain(ctx, size, size, 'popup-board', 0.07);
  return finish(element);
}
