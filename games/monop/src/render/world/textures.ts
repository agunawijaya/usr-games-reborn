import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { createRng } from '@usr-games/kit';

/**
 * Textures drawn in code onto canvases: no image files. Each is painted once and shared.
 */

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return [element, element.getContext('2d')!];
}

function texture(element: HTMLCanvasElement, repeat = false): CanvasTexture {
  const map = new CanvasTexture(element);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  map.minFilter = LinearMipmapLinearFilter;
  if (repeat) map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

export interface SignStyle {
  font: string;
  band: string;
  paper: string;
  ink: string;
  /** Text on the band, for corner and service signs that carry no group. */
  bandText?: string;
}

const signs = new Map<string, CanvasTexture>();

/**
 * A lot's sign: the group's colour band on top, the name beneath. Lots are rebuilt whenever
 * they change hands or grow, so each sign is painted once and kept.
 */
export function signTexture(name: string, style: SignStyle): CanvasTexture {
  const key = `${name}|${style.font}|${style.band}|${style.paper}|${style.ink}|${style.bandText ?? ''}`;
  let map = signs.get(key);
  if (!map) {
    map = paintSign(name, style);
    signs.set(key, map);
  }
  return map;
}

function paintSign(name: string, style: SignStyle): CanvasTexture {
  const [element, ctx] = canvas(512, 192);
  ctx.fillStyle = style.paper;
  ctx.fillRect(0, 0, 512, 192);
  ctx.fillStyle = style.band;
  ctx.fillRect(0, 0, 512, 58);
  if (style.bandText) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 34px ${style.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.bandText, 256, 31);
  }
  ctx.fillStyle = style.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 64;
  do {
    ctx.font = `700 ${size}px ${style.font}`;
    size -= 2;
  } while (ctx.measureText(name).width > 470 && size > 24);
  ctx.fillText(name, 256, 126);
  return texture(element);
}

export interface FacadeStyle {
  wall: string;
  frame: string;
  /** Window glass by day, and the share of windows lit at night with their colours. */
  glass: string;
  lit: readonly string[];
  litShare: number;
  columns: number;
  rows: number;
  seed: string;
  /** 0 for punched windows, 1 for a curtain wall of glass. */
  glassiness: number;
}

/**
 * A building's face: rows of windows. Returns the colour map and an emissive map with the lit
 * windows, so the same face reads by day and glows at night.
 */
export function facadeTextures(style: FacadeStyle): { map: CanvasTexture; glow: CanvasTexture } {
  const size = 256;
  const [colour, ctx] = canvas(size, size);
  const [glowCanvas, glow] = canvas(size, size);
  const rng = createRng(style.seed);
  ctx.fillStyle = style.wall;
  ctx.fillRect(0, 0, size, size);
  glow.fillStyle = '#000000';
  glow.fillRect(0, 0, size, size);
  const cellW = size / style.columns;
  const cellH = size / style.rows;
  const marginX = cellW * (0.18 - style.glassiness * 0.14);
  const marginY = cellH * (0.22 - style.glassiness * 0.16);
  for (let r = 0; r < style.rows; r++) {
    for (let c = 0; c < style.columns; c++) {
      const x = c * cellW + marginX;
      const y = r * cellH + marginY;
      const w = cellW - marginX * 2;
      const h = cellH - marginY * 2;
      ctx.fillStyle = style.frame;
      ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
      const shade = 0.82 + rng.next() * 0.3;
      ctx.fillStyle = style.glass;
      ctx.globalAlpha = 1;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 0.18 * shade;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w * 0.45, h);
      ctx.globalAlpha = 1;
      if (rng.next() < style.litShare) {
        glow.fillStyle = rng.pick(style.lit);
        glow.globalAlpha = 0.65 + rng.next() * 0.35;
        glow.fillRect(x, y, w, h);
        glow.globalAlpha = 1;
      }
    }
  }
  const map = texture(colour, true);
  const glowMap = texture(glowCanvas, true);
  return { map, glow: glowMap };
}

/** Soft value noise for grass, rock, paper and water: a tileable grey field. */
export function noiseTexture(
  seed: string,
  { size = 256, scale = 8, contrast = 1 } = {},
): CanvasTexture {
  const [element, ctx] = canvas(size, size);
  const rng = createRng(seed);
  const grid: number[][] = Array.from({ length: scale }, () =>
    Array.from({ length: scale }, () => rng.next()),
  );
  const image = ctx.createImageData(size, size);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * scale;
      const gy = (y / size) * scale;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = smooth(gx - x0);
      const fy = smooth(gy - y0);
      const at = (i: number, j: number) => grid[j % scale]![i % scale]!;
      const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
      const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
      const fine = rng.next() * 0.12;
      const value = Math.max(
        0,
        Math.min(1, 0.5 + (top * (1 - fy) + bottom * fy - 0.5) * contrast + fine - 0.06),
      );
      const v = Math.round(value * 255);
      const p = (y * size + x) * 4;
      image.data[p] = v;
      image.data[p + 1] = v;
      image.data[p + 2] = v;
      image.data[p + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const map = new CanvasTexture(element);
  map.wrapS = map.wrapT = RepeatWrapping;
  map.anisotropy = 8;
  return map;
}

/**
 * A tileable normal map from a sum of seeded waves: ripples for water, a gentle crinkle for
 * paper. `strength` tilts the normals; more octaves add finer detail.
 */
export function normalTexture(
  seed: string,
  { size = 256, strength = 1.2, waves = 14 } = {},
): CanvasTexture {
  const [element, ctx] = canvas(size, size);
  const rng = createRng(seed);
  const parts = Array.from({ length: waves }, (_, i) => {
    const frequency = 1 + Math.floor(rng.next() * (2 + i * 0.6));
    const angle = rng.next() * Math.PI * 2;
    return {
      kx: Math.round(Math.cos(angle) * frequency),
      ky: Math.round(Math.sin(angle) * frequency) || 1,
      phase: rng.next() * Math.PI * 2,
      amplitude: 1 / (1 + i * 0.45),
    };
  });
  const height = (x: number, y: number) =>
    parts.reduce(
      (sum, p) =>
        sum + p.amplitude * Math.sin(((p.kx * x + p.ky * y) / size) * Math.PI * 2 + p.phase),
      0,
    );
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * strength;
      const dy = (height(x, y + 1) - height(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 2);
      const p = (y * size + x) * 4;
      image.data[p] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
      image.data[p + 1] = Math.round(((-dy / length) * 0.5 + 0.5) * 255);
      image.data[p + 2] = Math.round(((2 / length) * 0.5 + 0.5) * 255);
      image.data[p + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const map = new CanvasTexture(element);
  map.wrapS = map.wrapT = RepeatWrapping;
  map.anisotropy = 8;
  return map;
}

/** An emblem drawn into a small square: a player's mark on flags and owner plaques. */
export function emblemTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  background: string,
): CanvasTexture {
  const [element, ctx] = canvas(128, 128);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 128, 128);
  draw(ctx, 128);
  return texture(element);
}
