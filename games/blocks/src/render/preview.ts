import { createRng } from '@usr-games/kit';
import { CORAL, SEAWEED } from '../engine/game';
import { cellsOf } from '../engine/forms';
import { diveGame, type DiveSpec } from '../dives/dives';
import { paintBubble } from './effects';
import type { Layout } from './layout';
import { type Look, withAlpha } from './look';
import { settledCells } from './from-game';
import { drawClusters } from './sinkers';
import { drawCoral, drawCurrents, drawKelp } from './specials';

/**
 * A dive's tank in miniature, for its tile: the lower part of the tank in its water, the floor it
 * starts with (coral and seaweed, drawn as in play), its currents, and the dark of a night dive.
 * Drawn once per look, never animated.
 */
export function drawDivePreview(canvas: HTMLCanvasElement, dive: DiveSpec, look: Look): void {
  const box = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(box.width * dpr));
  canvas.height = Math.max(1, Math.round(box.height * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const game = diveGame(dive, createRng('preview'));
  const sand = Math.round(canvas.height * 0.1);
  // The lower rows of the tank, where a dive differs: at least eight, more to take in a current.
  const highestCurrent = Math.min(game.height, ...(dive.currents ?? []).map((c) => c.row));
  const rowsShown = Math.max(8, game.height - highestCurrent + 1);
  const cell = Math.floor((canvas.height - sand) / rowsShown);
  const firstRow = game.height - rowsShown;
  const layout: Layout = {
    width: canvas.width,
    height: canvas.height,
    dpr,
    cols: game.width,
    rows: game.height,
    cell,
    left: Math.round((canvas.width - cell * game.width) / 2),
    top: canvas.height - sand - game.height * cell,
    floor: canvas.height - sand,
    scenery: cell,
  };
  const water = ctx.createLinearGradient(0, 0, 0, canvas.height);
  water.addColorStop(0, look.waterTop);
  water.addColorStop(1, look.waterDeep);
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = look.sand[1];
  ctx.fillRect(0, canvas.height - sand, canvas.width, sand);
  // The tank: its water, a little clearer, and its two panes.
  const tankX = layout.left;
  const tankW = game.width * cell;
  ctx.fillStyle = look.tankWater;
  ctx.fillRect(tankX, 0, tankW, canvas.height - sand);
  ctx.fillStyle = look.glassEdge;
  ctx.fillRect(tankX - 2 * dpr, 0, 2 * dpr, canvas.height - sand);
  ctx.fillRect(tankX + tankW, 0, 2 * dpr, canvas.height - sand);
  const cells = settledCells(game).filter((c) => c.y >= firstRow);
  const options = { time: 0, still: true };
  drawKelp(
    ctx,
    layout,
    look,
    cells.filter((c) => c.kind === SEAWEED),
    options,
  );
  drawCoral(
    ctx,
    layout,
    look,
    cells.filter((c) => c.kind === CORAL),
    options,
  );
  drawCurrents(ctx, layout, look, dive.currents ?? [], 0, true);
  if (dive.dark) {
    ctx.fillStyle = look.night;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const glow = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height * 0.3,
      0,
      canvas.width / 2,
      canvas.height * 0.3,
      cell * 3,
    );
    glow.addColorStop(0, withAlpha(look.depth[1]!, 0.8));
    glow.addColorStop(1, withAlpha(look.depth[1]!, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * A row of sinkers, each in its own bubble, as the Daily Dive's page shows the day's first ones.
 * Drawn with the tank's own glass.
 */
export function drawSinkerRow(
  canvas: HTMLCanvasElement,
  kinds: readonly number[],
  look: Look,
): void {
  const box = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(box.width * dpr));
  canvas.height = Math.max(1, Math.round(box.height * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const slot = canvas.width / kinds.length;
  const r = Math.min(slot * 0.42, canvas.height * 0.42);
  kinds.forEach((kind, i) => {
    const x = slot * (i + 0.5);
    const y = canvas.height / 2;
    const cells = cellsOf(kind, 0, 0);
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    const mini = r * 0.36;
    const width = (Math.max(...xs) - Math.min(...xs) + 1) * mini;
    const height = (Math.max(...ys) - Math.min(...ys) + 1) * mini;
    const layout: Layout = {
      width: canvas.width,
      height: canvas.height,
      dpr,
      cols: 4,
      rows: 4,
      cell: mini,
      left: x - width / 2 - Math.min(...xs) * mini,
      top: y - height / 2 - Math.min(...ys) * mini,
      floor: canvas.height,
      scenery: mini,
    };
    drawClusters(
      ctx,
      layout,
      look,
      cells.map((c) => ({ x: c.x, y: c.y, group: i, kind, depth: 0.1 + (i / kinds.length) * 0.8 })),
      { time: 0, glow: 0.6 },
    );
    paintBubble(ctx, look, x, y, r);
  });
}
