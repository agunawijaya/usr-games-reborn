import type { Current } from '../engine/game';
import type { Layout } from './layout';
import { darken, type Look, withAlpha } from './look';
import { outlineLoops, type PebbleCell, traceLoop } from './sinkers';

/**
 * What a dive brings into the tank besides sinkers. Coral is matte and knobbly, dotted with polyps
 * and branching at its top: nothing like the glass pebbles. Seaweed is a dark green clump with
 * blades that sway above it. A current is a row of streaks and chevrons drifting the way it pushes.
 * A night tank is dark but for a pool of light round the falling sinker.
 */

function hash(i: number, salt: number): number {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function groupsOf(cells: readonly PebbleCell[]): PebbleCell[][] {
  const groups = new Map<number, PebbleCell[]>();
  for (const cell of cells) {
    const list = groups.get(cell.group);
    if (list) list.push(cell);
    else groups.set(cell.group, [cell]);
  }
  return [...groups.values()];
}

function hasAbove(group: readonly PebbleCell[], c: PebbleCell): boolean {
  return group.some((o) => o.x === c.x && o.y === c.y - 1);
}

export interface SpecialOptions {
  time: number;
  shiftY?: number;
  still?: boolean;
  /** 0–1: lit up as a bursting row is. */
  lit?: number;
}

export function drawCoral(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  cells: readonly PebbleCell[],
  options: SpecialOptions,
): void {
  const { cell } = layout;
  const shiftY = options.shiftY ?? 0;
  for (const group of groupsOf(cells)) {
    const loops = outlineLoops(group);
    const path = () => {
      ctx.beginPath();
      for (const loop of loops)
        traceLoop(ctx, loop, layout, {
          inset: cell * 0.06,
          round: cell * 0.44,
          turnIn: cell * 0.16,
          pinch: cell * 0.16,
          shiftY,
        });
    };
    const top = layout.top + (Math.min(...group.map((c) => c.y)) + shiftY) * cell;
    const bottom = layout.top + (Math.max(...group.map((c) => c.y)) + 1 + shiftY) * cell;
    ctx.save();
    // Branches first, so the body overlaps their roots.
    ctx.lineCap = 'round';
    ctx.strokeStyle = look.coral;
    ctx.lineWidth = cell * 0.17;
    ctx.beginPath();
    for (const c of group) {
      if (hasAbove(group, c)) continue;
      const cx = layout.left + (c.x + 0.5) * cell;
      const cy = layout.top + (c.y + shiftY) * cell + cell * 0.2;
      for (let k = 0; k < 3; k++) {
        const along = (k - 1) * 0.28 + (hash(c.x * 5 + k, c.y) - 0.5) * 0.08;
        const reach = 0.22 + hash(c.x + k * 7, c.y + 3) * 0.16;
        ctx.moveTo(cx + along * cell, cy);
        ctx.lineTo(cx + along * cell * 1.25, cy - reach * cell);
      }
    }
    ctx.stroke();
    if (look.dark) {
      ctx.shadowColor = withAlpha(look.coral, 0.7);
      ctx.shadowBlur = cell * 0.35;
    }
    const body = ctx.createLinearGradient(0, top, 0, bottom);
    body.addColorStop(0, look.coral);
    body.addColorStop(1, look.coralShade);
    ctx.fillStyle = body;
    path();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    if (options.lit) {
      ctx.fillStyle = withAlpha(look.coralPolyp, options.lit * 0.7);
      ctx.fillRect(layout.left, top, layout.cols * cell, bottom - top);
    }
    // Polyps: little rings with a dark mouth, scattered over every cell.
    for (const c of group) {
      const x0 = layout.left + c.x * cell;
      const y0 = layout.top + (c.y + shiftY) * cell;
      for (let k = 0; k < 6; k++) {
        const px = x0 + (0.18 + hash(c.x * 13 + k, c.y * 7) * 0.64) * cell;
        const py = y0 + (0.18 + hash(c.x * 3 + k, c.y * 11 + 1) * 0.64) * cell;
        const r = cell * (0.05 + hash(k, c.x + c.y) * 0.04);
        ctx.fillStyle = look.coralPolyp;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = darken(look.coralShade, 0.2);
        ctx.beginPath();
        ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = withAlpha(darken(look.coralShade, 0.3), 0.8);
    ctx.lineWidth = Math.max(1, cell * 0.035);
    path();
    ctx.stroke();
  }
}

export function drawKelp(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  cells: readonly PebbleCell[],
  options: SpecialOptions,
): void {
  const { cell } = layout;
  const shiftY = options.shiftY ?? 0;
  const t = options.still ? 0 : options.time;
  for (const group of groupsOf(cells)) {
    ctx.save();
    // Blades rising from the top of the clump, swaying.
    ctx.lineCap = 'round';
    for (const c of group) {
      if (hasAbove(group, c)) continue;
      const base = layout.top + (c.y + shiftY) * cell + cell * 0.3;
      for (let k = 0; k < 2; k++) {
        const bx = layout.left + (c.x + 0.3 + k * 0.4) * cell;
        const height = cell * (0.75 + hash(c.x * 9 + k, c.y) * 0.45);
        const sway = Math.sin(t * 1.3 + c.x * 0.9 + k * 2) * cell * 0.16;
        ctx.strokeStyle = k === 0 ? look.kelp : look.kelpLeaf;
        ctx.lineWidth = cell * 0.13;
        ctx.beginPath();
        ctx.moveTo(bx, base);
        ctx.quadraticCurveTo(bx - sway * 0.4, base - height * 0.55, bx + sway, base - height);
        ctx.stroke();
      }
    }
    const loops = outlineLoops(group);
    const path = () => {
      ctx.beginPath();
      for (const loop of loops)
        traceLoop(ctx, loop, layout, {
          inset: cell * 0.05,
          round: cell * 0.36,
          turnIn: cell * 0.12,
          pinch: cell * 0.12,
          shiftY,
        });
    };
    const top = layout.top + (Math.min(...group.map((c) => c.y)) + shiftY) * cell;
    const bottom = layout.top + (Math.max(...group.map((c) => c.y)) + 1 + shiftY) * cell;
    const body = ctx.createLinearGradient(0, top, 0, bottom);
    body.addColorStop(0, look.kelp);
    body.addColorStop(1, look.kelpShade);
    ctx.fillStyle = body;
    path();
    ctx.fill();
    ctx.clip();
    if (options.lit) {
      ctx.fillStyle = withAlpha(look.kelpLeaf, options.lit * 0.6);
      ctx.fillRect(layout.left, top, layout.cols * cell, bottom - top);
    }
    // Leaves folded over one another inside the clump.
    ctx.strokeStyle = withAlpha(look.kelpLeaf, 0.55);
    ctx.lineWidth = Math.max(1, cell * 0.06);
    for (const c of group) {
      const x0 = layout.left + c.x * cell;
      const y0 = layout.top + (c.y + shiftY) * cell;
      for (let k = 0; k < 3; k++) {
        const y = y0 + (0.25 + k * 0.25) * cell;
        const lean = (hash(c.x + k, c.y) - 0.5) * cell * 0.3;
        ctx.beginPath();
        ctx.moveTo(x0 + cell * 0.15, y + cell * 0.08);
        ctx.quadraticCurveTo(
          x0 + cell * 0.5 + lean,
          y - cell * 0.16,
          x0 + cell * 0.85,
          y + cell * 0.04,
        );
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = withAlpha(darken(look.kelpShade, 0.3), 0.8);
    ctx.lineWidth = Math.max(1, cell * 0.035);
    path();
    ctx.stroke();
  }
}

/** Each current: streaks drifting along its row and a chevron every other cell. */
export function drawCurrents(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  currents: readonly Current[],
  time: number,
  still: boolean,
): void {
  if (currents.length === 0) return;
  const { cell } = layout;
  const width = layout.cols * cell;
  ctx.save();
  ctx.lineCap = 'round';
  for (const current of currents) {
    const mid = layout.top + (current.row + 0.5) * cell;
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.left, mid - cell * 0.6, width, cell * 1.2);
    ctx.clip();
    // A faint band, so the row reads as moving water.
    const band = ctx.createLinearGradient(0, mid - cell * 0.5, 0, mid + cell * 0.5);
    band.addColorStop(0, withAlpha(look.current, 0));
    band.addColorStop(0.5, withAlpha(look.current, 0.12));
    band.addColorStop(1, withAlpha(look.current, 0));
    ctx.fillStyle = band;
    ctx.fillRect(layout.left, mid - cell * 0.5, width, cell);
    const drift = still ? 0 : time * cell * 1.6 * current.dir;
    ctx.strokeStyle = withAlpha(look.current, 0.5);
    ctx.lineWidth = Math.max(1, cell * 0.04);
    for (let k = 0; k < 7; k++) {
      const lane = mid + (hash(k, current.row) - 0.5) * cell * 0.7;
      const length = cell * (0.8 + hash(k + 3, current.row) * 1.1);
      const span = width + length * 2;
      const x =
        layout.left - length + ((((hash(k + 9, current.row) * span + drift) % span) + span) % span);
      ctx.beginPath();
      ctx.moveTo(x, lane);
      ctx.quadraticCurveTo(x + length / 2, lane - cell * 0.06, x + length, lane);
      ctx.stroke();
    }
    ctx.strokeStyle = withAlpha(look.current, 0.75);
    ctx.lineWidth = Math.max(1.5, cell * 0.06);
    const step = cell * 2;
    const offset = still ? 0 : (((time * cell * 1.6 * current.dir) % step) + step) % step;
    for (let x = layout.left - step + offset; x < layout.left + width + step; x += step) {
      const tip = x + cell * 0.12 * current.dir;
      ctx.beginPath();
      ctx.moveTo(tip - cell * 0.12 * current.dir, mid - cell * 0.13);
      ctx.lineTo(tip, mid);
      ctx.lineTo(tip - cell * 0.12 * current.dir, mid + cell * 0.13);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

/**
 * The dark of a night dive over the tank: deep night inside, a lighter dusk outside, and a pool
 * of light round the falling sinker.
 */
export function drawNight(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  light: { x: number; y: number } | null,
  scratch: HTMLCanvasElement,
): void {
  if (scratch.width !== layout.width || scratch.height !== layout.height) {
    scratch.width = layout.width;
    scratch.height = layout.height;
  }
  const dark = scratch.getContext('2d')!;
  dark.globalCompositeOperation = 'source-over';
  dark.clearRect(0, 0, scratch.width, scratch.height);
  dark.fillStyle = withAlpha(look.night, 0.45);
  dark.fillRect(0, 0, scratch.width, scratch.height);
  const { cell } = layout;
  dark.fillStyle = look.night;
  dark.fillRect(
    layout.left,
    layout.top - cell * 0.2,
    layout.cols * cell,
    layout.rows * cell + cell * 0.2,
  );
  if (light) {
    dark.globalCompositeOperation = 'destination-out';
    const pool = dark.createRadialGradient(
      light.x,
      light.y,
      cell * 0.6,
      light.x,
      light.y,
      cell * 3.4,
    );
    pool.addColorStop(0, 'rgba(0, 0, 0, 1)');
    pool.addColorStop(0.55, 'rgba(0, 0, 0, 0.75)');
    pool.addColorStop(1, 'rgba(0, 0, 0, 0)');
    dark.fillStyle = pool;
    dark.fillRect(light.x - cell * 3.5, light.y - cell * 3.5, cell * 7, cell * 7);
  }
  ctx.drawImage(scratch, 0, 0);
}
