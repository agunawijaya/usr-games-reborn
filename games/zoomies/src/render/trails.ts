import type { Point } from '../engine/types';
import { cellCenter, type Geometry } from './geometry';
import type { Look, SceneLook } from './palette';

/**
 * The trails the reveal draws on the rug: every square a vacuum rolled, in the order it rolled
 * them. Afternoon draws them as thin dark stripes combed like vacuumed carpet, the nap pointing
 * the way the vacuum went, so crossings stay readable; Midnight keeps its glowing dots.
 */

export interface TrailMove {
  /** Two steps per turn: a turbo's second roll comes after everyone's first. */
  readonly step: number;
  readonly from: Point;
  readonly to: Point;
}

export class TrailLog {
  private list: TrailMove[] = [];
  private turns = 0;

  clear() {
    this.list = [];
    this.turns = 0;
  }

  /** Records one turn's rolls; `phase` is 1 for every vacuum's first roll, 2 for a turbo's second. */
  addTurn(moves: readonly { phase: 1 | 2; from: Point; to: Point }[]) {
    for (const move of moves)
      this.list.push({ step: this.turns * 2 + move.phase - 1, from: move.from, to: move.to });
    this.turns++;
  }

  get moves(): readonly TrailMove[] {
    return this.list;
  }

  get steps(): number {
    return this.turns * 2;
  }
}

const NAP = {
  stripe: 'rgba(92, 60, 30, 0.34)',
  comb: 'rgba(255, 246, 226, 0.78)',
};

/**
 * Draws the trails as far as `progress` (0…1) has got through the room's turns: every earlier
 * roll whole, the current one partly.
 */
export function drawTrails(
  ctx: CanvasRenderingContext2D,
  geo: Geometry,
  log: TrailLog,
  progress: number,
  look: Look,
  scene: SceneLook,
) {
  const steps = log.steps;
  if (steps === 0 || progress <= 0) return;
  const reached = progress * steps;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = geo.cell;
  if (look === 'day') {
    // The stripes first, so every comb sits on top of every stripe where paths cross.
    ctx.strokeStyle = NAP.stripe;
    ctx.lineWidth = s * 0.2;
    ctx.beginPath();
    forEachShown(geo, log, reached, (a, b) => {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    });
    ctx.stroke();
    ctx.strokeStyle = NAP.comb;
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    forEachShown(geo, log, reached, (a, b) => combNap(ctx, a, b, s));
    ctx.stroke();
  } else {
    const glow = scene.glow ?? 'rgba(104, 232, 255, 0.2)';
    ctx.globalCompositeOperation = 'lighter';
    forEachShown(geo, log, reached, (a, b) => glowDots(ctx, a, b, s, glow));
  }
  ctx.restore();
}

function forEachShown(
  geo: Geometry,
  log: TrailLog,
  reached: number,
  draw: (a: Point, b: Point) => void,
) {
  for (const move of log.moves) {
    const shown = Math.min(1, reached - move.step);
    if (shown <= 0) continue;
    const a = cellCenter(geo, move.from.x, move.from.y);
    const end = cellCenter(geo, move.to.x, move.to.y);
    const b = { x: a.x + (end.x - a.x) * shown, y: a.y + (end.y - a.y) * shown };
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) continue;
    draw(a, b);
  }
}

/** Small chevrons along a stripe, pointing the way the vacuum rolled, like combed carpet nap. */
function combNap(ctx: CanvasRenderingContext2D, a: Point, b: Point, s: number) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const gap = s * 0.2;
  const arm = s * 0.065;
  for (let d = gap * 0.6; d < length - gap * 0.3; d += gap) {
    const tipX = a.x + ux * d;
    const tipY = a.y + uy * d;
    // The two arms trail back from the tip, either side of the line.
    ctx.moveTo(tipX - ux * arm - uy * arm, tipY - uy * arm + ux * arm);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX - ux * arm + uy * arm, tipY - uy * arm - ux * arm);
  }
}

/** Midnight: a string of soft glowing dots, brighter where paths overlap. */
function glowDots(ctx: CanvasRenderingContext2D, a: Point, b: Point, s: number, color: string) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const gap = s * 0.25;
  ctx.fillStyle = color;
  for (let d = 0; d <= length; d += gap) {
    const x = a.x + ((b.x - a.x) * d) / length;
    const y = a.y + ((b.y - a.y) * d) / length;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}
