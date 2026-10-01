import type { Furniture } from '../engine/types';
import type { Geometry } from './geometry';
import type { Look, SceneLook } from './palette';
import { type Ctx, hash2, line } from './shapes';
import { drawFurniture } from './sprites/furniture';

/**
 * The parts of a room that never move, painted once into an offscreen canvas: the floor
 * boards around the room, the rug or tiles the game is played on, and the furniture.
 */

function planks(ctx: Ctx, geo: Geometry, floor: SceneLook['floor']) {
  const h = Math.max(10, geo.cell * 0.46);
  for (let row = 0; row * h < geo.height; row++) {
    const y = row * h;
    const length = geo.cell * 3.2;
    const offset = (row % 3) * length * 0.37;
    for (let x = -offset, i = 0; x < geo.width; x += length, i++) {
      ctx.fillStyle = hash2(row, i) > 0.5 ? floor.base : floor.alt;
      ctx.fillRect(x, y, length, h);
      line(ctx, x, y, x, y + h, floor.line, 1.2);
      // A knot here and there.
      if (hash2(row, i, 9) > 0.86) {
        ctx.beginPath();
        ctx.ellipse(
          x + length * hash2(row, i, 4),
          y + h / 2,
          h * 0.22,
          h * 0.12,
          0,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = floor.line;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    line(ctx, 0, y, geo.width, y, floor.line, 1.4);
  }
}

function parquet(ctx: Ctx, geo: Geometry, floor: SceneLook['floor']) {
  const block = Math.max(16, geo.cell * 0.9);
  const strip = block / 3;
  for (let by = 0; by * block < geo.height; by++) {
    for (let bx = 0; bx * block < geo.width; bx++) {
      const vertical = (bx + by) % 2 === 0;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = hash2(bx * 3 + i, by) > 0.5 ? floor.base : floor.alt;
        if (vertical) ctx.fillRect(bx * block + i * strip, by * block, strip, block);
        else ctx.fillRect(bx * block, by * block + i * strip, block, strip);
      }
      ctx.strokeStyle = floor.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx * block, by * block, block, block);
    }
  }
}

function floorTiles(ctx: Ctx, geo: Geometry, floor: SceneLook['floor']) {
  const tile = Math.max(14, geo.cell * 1.3);
  for (let y = 0; y * tile < geo.height; y++) {
    for (let x = 0; x * tile < geo.width; x++) {
      ctx.fillStyle = hash2(x, y) > 0.5 ? floor.base : floor.alt;
      ctx.fillRect(x * tile, y * tile, tile, tile);
      ctx.strokeStyle = floor.line;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x * tile, y * tile, tile, tile);
    }
  }
}

function concrete(ctx: Ctx, geo: Geometry, floor: SceneLook['floor']) {
  ctx.fillStyle = floor.base;
  ctx.fillRect(0, 0, geo.width, geo.height);
  for (let i = 0; i < (geo.width * geo.height) / 90; i++) {
    ctx.fillStyle = hash2(i, 1) > 0.5 ? floor.alt : floor.line;
    ctx.fillRect(hash2(i, 2) * geo.width, hash2(i, 3) * geo.height, 1.5, 1.5);
  }
}

function paintFloor(ctx: Ctx, geo: Geometry, scene: SceneLook) {
  const floor = scene.floor;
  if (floor.style === 'planks') planks(ctx, geo, floor);
  else if (floor.style === 'parquet') parquet(ctx, geo, floor);
  else if (floor.style === 'tiles') floorTiles(ctx, geo, floor);
  else concrete(ctx, geo, floor);
}

function cellFill(scene: SceneLook, x: number, y: number): string {
  const surface = scene.surface;
  switch (surface.style) {
    case 'checker':
      return (x + y) % 2 === 0 ? surface.base : surface.alt;
    case 'mat': {
      const colors = [surface.base, surface.alt, surface.accent, surface.base];
      return colors[(x * 3 + y * 5) % colors.length]!;
    }
    case 'tiles':
      return hash2(x, y, 3) > 0.5 ? surface.base : surface.alt;
    default:
      return (x + y) % 2 === 0 ? surface.base : surface.alt;
  }
}

function paintSurface(ctx: Ctx, geo: Geometry, scene: SceneLook) {
  const s = geo.cell;
  const surface = scene.surface;
  const x0 = geo.boardX;
  const y0 = geo.boardY;
  const w = geo.cols * s;
  const h = geo.rows * s;
  const isRug = surface.style === 'rug' || surface.style === 'runner' || surface.style === 'carpet';
  const border = isRug ? s * 0.3 : s * 0.12;
  // Shadow, then the border band, then the cells.
  ctx.fillStyle = scene.shadow;
  ctx.fillRect(x0 - border + s * 0.08, y0 - border + s * 0.1, w + border * 2, h + border * 2);
  ctx.fillStyle = surface.border;
  ctx.fillRect(x0 - border, y0 - border, w + border * 2, h + border * 2);
  if (isRug) {
    // A row of diamonds woven into the border.
    ctx.fillStyle = surface.accent;
    const step = s * 0.5;
    const edges = [
      { from: x0 - border / 2, to: x0 + w + border / 2, fixed: y0 - border / 2, horizontal: true },
      {
        from: x0 - border / 2,
        to: x0 + w + border / 2,
        fixed: y0 + h + border / 2,
        horizontal: true,
      },
      { from: y0 - border / 2, to: y0 + h + border / 2, fixed: x0 - border / 2, horizontal: false },
      {
        from: y0 - border / 2,
        to: y0 + h + border / 2,
        fixed: x0 + w + border / 2,
        horizontal: false,
      },
    ];
    for (const edge of surface.style === 'runner' ? edges.slice(0, 2) : edges) {
      for (let t = edge.from + step / 2; t < edge.to; t += step) {
        const cx = edge.horizontal ? t : edge.fixed;
        const cy = edge.horizontal ? edge.fixed : t;
        const r = border * 0.28;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Fringe on the short ends.
    ctx.strokeStyle = surface.base;
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (let y = y0 - border; y < y0 + h + border; y += s * 0.12) {
      line(ctx, x0 - border, y, x0 - border - s * 0.18, y, surface.base, Math.max(1, s * 0.03));
      line(
        ctx,
        x0 + w + border,
        y,
        x0 + w + border + s * 0.18,
        y,
        surface.base,
        Math.max(1, s * 0.03),
      );
    }
  }
  for (let y = 0; y < geo.rows; y++) {
    for (let x = 0; x < geo.cols; x++) {
      ctx.fillStyle = cellFill(scene, x, y);
      ctx.fillRect(x0 + x * s, y0 + y * s, s, s);
    }
  }
  if (surface.style === 'carpet' || isRug) {
    // Weave: fine diagonal threads so the rug reads as fabric.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    ctx.strokeStyle = surface.line;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    const gap = Math.max(4, s * 0.14);
    for (let t = -h; t < w; t += gap) line(ctx, x0 + t, y0, x0 + t + h, y0 + h, surface.line, 1);
    ctx.restore();
  }
  // The grid every square sits on: faint, but always there.
  ctx.save();
  ctx.globalAlpha = surface.style === 'tiles' || surface.style === 'checker' ? 0.9 : 0.55;
  for (let x = 0; x <= geo.cols; x++)
    line(ctx, x0 + x * s, y0, x0 + x * s, y0 + h, surface.line, Math.max(1, s * 0.03));
  for (let y = 0; y <= geo.rows; y++)
    line(ctx, x0, y0 + y * s, x0 + w, y0 + y * s, surface.line, Math.max(1, s * 0.03));
  ctx.restore();
}

export interface StaticLayer {
  readonly canvas: HTMLCanvasElement;
}

export function paintStatic(
  canvas: HTMLCanvasElement,
  geo: Geometry,
  scene: SceneLook,
  furniture: readonly Furniture[],
  look: Look,
  ratio: number,
) {
  canvas.width = Math.round(geo.width * ratio);
  canvas.height = Math.round(geo.height * ratio);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  paintFloor(ctx, geo, scene);
  paintSurface(ctx, geo, scene);
  for (const piece of furniture)
    drawFurniture(ctx, piece, { x: geo.boardX, y: geo.boardY }, geo.cell, look);
}
