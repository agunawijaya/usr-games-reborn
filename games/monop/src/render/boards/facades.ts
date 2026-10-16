import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { createRng } from '@usr-games/kit';

/**
 * Building faces drawn in code: a tile of four by four windows that repeats over every wall,
 * and a matching glow map that lights some of them after dark.
 */

export interface WindowStyle {
  wall: string;
  trim: string;
  glass: string;
  shape: 'punched' | 'shuttered' | 'arched' | 'curtain';
  brick?: boolean;
}

const SIZE = 512;
const CELLS = 4;
const LIT = ['#ffd27a', '#ffe7a8', '#fff2cf', '#ffc46b', '#bfe3ff'];
const CURTAINS = ['#d96a5a', '#e8c86a', '#7aa6c9', '#f2efe6', '#8bbf8a'];

function surface(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = element.height = SIZE;
  return [element, element.getContext('2d')!];
}

function finish(element: HTMLCanvasElement, colour: boolean): CanvasTexture {
  const map = new CanvasTexture(element);
  if (colour) map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.anisotropy = 8;
  map.minFilter = LinearMipmapLinearFilter;
  return map;
}

function bricks(ctx: CanvasRenderingContext2D, wall: string): void {
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = 'rgba(60,25,15,0.35)';
  ctx.lineWidth = 1.5;
  for (let y = 0; y < SIZE; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SIZE, y);
    ctx.stroke();
    for (let x = (y / 10) % 2 ? 0 : 11; x < SIZE; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
    }
  }
}

/** The pane: sky-lit at the top by day, dark with a lit share at night. */
function pane(
  ctx: CanvasRenderingContext2D,
  glow: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: WindowStyle,
  dark: boolean,
  rng: ReturnType<typeof createRng>,
  arched = false,
): void {
  const path = new Path2D();
  if (arched) {
    path.moveTo(x, y + h);
    path.lineTo(x, y + w / 2);
    path.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    path.lineTo(x + w, y + h);
    path.closePath();
  } else {
    path.rect(x, y, w, h);
  }
  const gradient = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  if (dark) {
    gradient.addColorStop(0, '#2a3550');
    gradient.addColorStop(1, '#141a2a');
  } else {
    gradient.addColorStop(0, '#e6f3fb');
    gradient.addColorStop(0.35, style.glass);
    gradient.addColorStop(1, shade(style.glass, -0.25));
  }
  ctx.fillStyle = gradient;
  ctx.fill(path);
  if (!dark && rng.chance(0.35)) {
    ctx.fillStyle = rng.pick(CURTAINS);
    ctx.globalAlpha = 0.75;
    ctx.fillRect(x + (rng.chance(0.5) ? 0 : w * 0.55), y + h * 0.15, w * 0.45, h * 0.85);
    ctx.globalAlpha = 1;
  }
  if (dark && rng.chance(0.42)) {
    glow.fillStyle = rng.pick(LIT);
    glow.globalAlpha = 0.6 + rng.next() * 0.4;
    glow.fill(path);
    glow.globalAlpha = 1;
    ctx.fillStyle = '#ffe2a8';
    ctx.fill(path);
  }
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (n >> shift) & 255;
    return Math.max(
      0,
      Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)),
    );
  };
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

export function windowTexture(
  style: WindowStyle,
  dark: boolean,
  seed: string,
): { map: CanvasTexture; glow: CanvasTexture } {
  const [colourCanvas, ctx] = surface();
  const [glowCanvas, glow] = surface();
  const rng = createRng(`${seed}:${dark}`);
  glow.fillStyle = '#000';
  glow.fillRect(0, 0, SIZE, SIZE);
  if (style.brick) bricks(ctx, style.wall);
  else {
    ctx.fillStyle = style.wall;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  const cell = SIZE / CELLS;
  for (let r = 0; r < CELLS; r++) {
    for (let c = 0; c < CELLS; c++) {
      const x0 = c * cell;
      const y0 = r * cell;
      if (style.shape === 'curtain') {
        ctx.fillStyle = style.trim;
        ctx.fillRect(x0, y0, cell, cell);
        ctx.fillStyle = shade(style.wall, -0.15);
        ctx.fillRect(x0, y0 + cell * 0.8, cell, cell * 0.2);
        pane(ctx, glow, x0 + 4, y0 + 4, cell - 8, cell * 0.8 - 6, style, dark, rng);
        ctx.fillStyle = style.trim;
        ctx.fillRect(x0 + cell / 2 - 2, y0, 4, cell * 0.8);
        continue;
      }
      const w = cell * 0.48;
      const h = cell * 0.6;
      const x = x0 + (cell - w) / 2;
      const y = y0 + cell * 0.16;
      ctx.fillStyle = style.trim;
      ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
      ctx.fillRect(x - 10, y + h + 4, w + 20, 8);
      pane(ctx, glow, x, y, w, h, style, dark, rng, style.shape === 'arched');
      ctx.fillStyle = style.trim;
      ctx.fillRect(x + w / 2 - 2, y, 4, h);
      if (style.shape === 'shuttered') {
        ctx.fillStyle = shade(style.trim, -0.1);
        ctx.fillRect(x - 6 - w * 0.36, y - 4, w * 0.34, h + 8);
        ctx.fillRect(x + w + 6 + w * 0.02, y - 4, w * 0.34, h + 8);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < 6; k++) {
          const ly = y + (k + 0.5) * ((h + 8) / 6);
          ctx.beginPath();
          ctx.moveTo(x - 6 - w * 0.36, ly);
          ctx.lineTo(x - 6 - w * 0.02, ly);
          ctx.moveTo(x + w + 6, ly);
          ctx.lineTo(x + w + 6 + w * 0.36, ly);
          ctx.stroke();
        }
      }
    }
  }
  return { map: finish(colourCanvas, true), glow: finish(glowCanvas, true) };
}

const stripes = new Map<string, CanvasTexture>();

/** A striped awning in one colour and cream. */
export function stripeTexture(colour: string): CanvasTexture {
  let map = stripes.get(colour);
  if (!map) {
    const element = document.createElement('canvas');
    element.width = 128;
    element.height = 64;
    const ctx = element.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#fbf6ea' : colour;
      ctx.fillRect(i * 16, 0, 16, 64);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 54, 128, 10);
    map = finish(element, true);
    stripes.set(colour, map);
  }
  return map;
}
