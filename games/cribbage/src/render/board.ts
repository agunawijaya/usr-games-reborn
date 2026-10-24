import { createRng } from '@usr-games/kit';
import { LAYOUT, type Point } from './layout';
import type { Look } from './look';
import { softShadow } from './shadow';

/**
 * The cribbage board: a long walnut board with a maple inlay down its middle, two tracks of
 * thirty holes for each player in groups of five, start holes and the game hole at the near
 * end, and brass plates with the scores. Scores travel up the outer row and back down the inner
 * one ("once around" is 60 holes), twice around for a game of 121, as on a real board and as the
 * original drew it in text. Each player has two pegs; on every score the back peg jumps past
 * the front one, so the gap between them always shows the last score.
 *
 * The board is painted once per size and look into its own canvas; pegs are drawn every frame.
 */

type Ctx = CanvasRenderingContext2D;
export type Side = 0 | 1;

const BOARD = LAYOUT.board;
const CENTRE_X = BOARD.x + BOARD.w / 2;
/** Column offsets from the centre: you on the left pair, the computer on the right. */
const COLUMNS: Record<Side, { outer: number; inner: number }> = {
  0: { outer: -82, inner: -40 },
  1: { outer: 82, inner: 40 },
};
const TRACK_TOP = BOARD.y + 74;
const TRACK_BOTTOM = BOARD.y + BOARD.h - 214;
const GROUP_GAP = 0.7;
const HOLE_STEP = (TRACK_BOTTOM - TRACK_TOP) / (29 + 5 * GROUP_GAP);
export const HOLE_RADIUS = 4.6;
const START_Y = TRACK_BOTTOM + 40;
export const GAME_HOLE: Point = { x: CENTRE_X, y: TRACK_BOTTOM + 64 };
export const PLATES: Record<Side, { x: number; y: number; w: number; h: number }> = {
  0: { x: BOARD.x + 18, y: BOARD.y + BOARD.h - 116, w: 100, h: 92 },
  1: { x: BOARD.x + BOARD.w - 118, y: BOARD.y + BOARD.h - 116, w: 100, h: 92 },
};

/** Hole `index` (0 at the near end, 29 at the far end) of one column. */
function holeY(index: number): number {
  return TRACK_BOTTOM - (index + Math.floor(index / 5) * GROUP_GAP) * HOLE_STEP;
}

/** Where a peg standing at `score` sits; `which` picks between the two start holes. */
export function holeFor(side: Side, score: number, length: number, which: 0 | 1 = 0): Point {
  if (score <= 0) {
    const column = which === 0 ? COLUMNS[side].outer : COLUMNS[side].inner;
    return { x: CENTRE_X + column, y: START_Y };
  }
  if (score >= length) return { ...GAME_HOLE };
  const lap = (score - 1) % 60;
  if (lap < 30) return { x: CENTRE_X + COLUMNS[side].outer, y: holeY(lap) };
  return { x: CENTRE_X + COLUMNS[side].inner, y: holeY(59 - lap) };
}

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export class BoardPainter {
  private image: HTMLCanvasElement | null = null;
  private key = '';

  constructor(private look: Look) {}

  setLook(look: Look): void {
    this.look = look;
    this.key = '';
  }

  /** Paints the still board at `scale` device pixels per design unit. */
  prepare(scale: number, length: number): void {
    const key = `${this.look.id}:${scale.toFixed(3)}:${length}`;
    if (key === this.key) return;
    this.key = key;
    const pad = 40;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((BOARD.w + pad * 2) * scale);
    canvas.height = Math.ceil((BOARD.h + pad * 2) * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.translate(pad - BOARD.x, pad - BOARD.y);
    this.paintBody(ctx);
    this.paintInlay(ctx);
    this.paintHoles(ctx, length);
    this.paintMarks(ctx, length);
    this.image = canvas;
  }

  private paintBody(ctx: Ctx): void {
    const look = this.look;
    const { x, y, w, h } = BOARD;
    const r = 44;
    // The board's shadow on the table, cast away from the light.
    ctx.save();
    ctx.filter = 'blur(10px)';
    ctx.fillStyle = `rgba(0, 0, 0, ${look.castShadow.alpha})`;
    roundedRect(ctx, x + look.castShadow.dx * 0.9, y + look.castShadow.dy * 0.9, w, h, r);
    ctx.fill();
    ctx.restore();
    // The edge: the board is about a thumb thick, seen a little from above.
    const side = ctx.createLinearGradient(x, 0, x + w, 0);
    side.addColorStop(0, look.board.bodyDeep);
    side.addColorStop(0.5, look.dark ? '#24120a' : '#3a2010');
    side.addColorStop(1, look.board.bodyDeep);
    ctx.fillStyle = side;
    roundedRect(ctx, x + 2, y + 11, w, h, r);
    ctx.fill();
    const body = ctx.createLinearGradient(x, y, x + w, y + h * 0.3);
    body.addColorStop(0, look.board.body);
    body.addColorStop(1, look.board.bodyDeep);
    ctx.fillStyle = body;
    roundedRect(ctx, x, y, w, h, r);
    ctx.fill();
    // Long grain down the board's length.
    ctx.save();
    roundedRect(ctx, x, y, w, h, r);
    ctx.clip();
    const rng = createRng('board-grain');
    for (let i = 0; i < 46; i++) {
      const gx = x + rng.float(0, w);
      const amplitude = rng.float(2, 9);
      const wave = rng.float(120, 340);
      const phase = rng.float(0, Math.PI * 2);
      ctx.strokeStyle = look.dark ? 'rgba(10, 4, 1, 0.3)' : 'rgba(46, 24, 10, 0.22)';
      ctx.lineWidth = rng.float(0.5, 1.6);
      ctx.beginPath();
      for (let gy = y; gy <= y + h; gy += 10) {
        const px = gx + Math.sin((gy / wave) * Math.PI * 2 + phase) * amplitude;
        if (gy === y) ctx.moveTo(px, gy);
        else ctx.lineTo(px, gy);
      }
      ctx.stroke();
    }
    // Varnish: a long soft sheen where the light catches the top.
    const sheen = ctx.createLinearGradient(x, 0, x + w, 0);
    sheen.addColorStop(0, look.dark ? 'rgba(255, 170, 90, 0.18)' : 'rgba(255, 240, 210, 0.22)');
    sheen.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h);
    if (look.dark) {
      // Far from the fire: warm along the edge that faces it, dusk on the far side.
      const fire = ctx.createLinearGradient(x, 0, x + w, 0);
      fire.addColorStop(0, 'rgba(255, 140, 60, 0.16)');
      fire.addColorStop(0.5, 'rgba(0, 0, 0, 0.12)');
      fire.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
      ctx.fillStyle = fire;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
    // A bright bevel on the lit edge.
    ctx.save();
    ctx.strokeStyle = look.board.edgeLight;
    ctx.lineWidth = 2;
    roundedRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
    ctx.stroke();
    ctx.restore();
  }

  private paintInlay(ctx: Ctx): void {
    const look = this.look;
    const top = BOARD.y + 62;
    const bottom = TRACK_BOTTOM + 18;
    const strip = (x: number, width: number, colour: string) => {
      ctx.fillStyle = colour;
      ctx.fillRect(x - width / 2, top, width, bottom - top);
    };
    strip(CENTRE_X, 16, look.board.inlayDeep);
    strip(CENTRE_X, 11, look.board.inlay);
    strip(CENTRE_X, 2, look.board.inlayDeep);
    // Fine stringing beside each player's pair of rows.
    for (const side of [0, 1] as const) {
      const outer = CENTRE_X + COLUMNS[side].outer;
      const inner = CENTRE_X + COLUMNS[side].inner;
      const mid = (outer + inner) / 2;
      ctx.fillStyle = look.board.inlay;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(mid - 0.75, top + 8, 1.5, bottom - top - 16);
      ctx.globalAlpha = 1;
    }
    // A diamond at each end of the centre strip.
    for (const [cy, size] of [
      [top - 6, 9],
      [bottom + 12, 10],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(CENTRE_X, cy - size);
      ctx.lineTo(CENTRE_X + size * 0.7, cy);
      ctx.lineTo(CENTRE_X, cy + size);
      ctx.lineTo(CENTRE_X - size * 0.7, cy);
      ctx.closePath();
      ctx.fillStyle = look.board.inlay;
      ctx.fill();
      ctx.strokeStyle = look.board.inlayDeep;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private hole(ctx: Ctx, x: number, y: number, radius = HOLE_RADIUS): void {
    ctx.beginPath();
    ctx.arc(x, y + 0.6, radius + 1.2, 0, Math.PI * 2);
    ctx.fillStyle = this.look.board.holeRim;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    const deep = ctx.createRadialGradient(x - 1, y - 1.5, 0.5, x, y, radius);
    deep.addColorStop(0, '#000');
    deep.addColorStop(1, this.look.board.hole);
    ctx.fillStyle = deep;
    ctx.fill();
  }

  private paintHoles(ctx: Ctx, length: number): void {
    for (const side of [0, 1] as const) {
      for (const column of [COLUMNS[side].outer, COLUMNS[side].inner]) {
        for (let i = 0; i < 30; i++) this.hole(ctx, CENTRE_X + column, holeY(i));
      }
      this.hole(ctx, CENTRE_X + COLUMNS[side].outer, START_Y);
      this.hole(ctx, CENTRE_X + COLUMNS[side].inner, START_Y);
    }
    this.hole(ctx, GAME_HOLE.x, GAME_HOLE.y, HOLE_RADIUS + 1.6);
    void length;
  }

  private paintMarks(ctx: Ctx, length: number): void {
    const look = this.look;
    ctx.save();
    ctx.fillStyle = look.board.engraving;
    ctx.strokeStyle = look.board.engraving;
    ctx.globalAlpha = 0.85;
    ctx.font = `600 11px "Fraunces Variable", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Every fifth hole is counted along the outside edge of each player's rows.
    for (let group = 1; group <= 6; group++) {
      const y = (holeY(group * 5 - 1) + holeY(Math.min(29, group * 5))) / 2;
      const yLabel = group === 6 ? holeY(29) - 16 : y;
      for (const side of [0, 1] as const) {
        const outer = CENTRE_X + COLUMNS[side].outer;
        const labelX = outer + (side === 0 ? -17 : 17);
        if (group < 6) {
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(outer - 9, y);
          ctx.lineTo(CENTRE_X + COLUMNS[side].inner + 9 * (side === 0 ? 1 : -1), y);
          ctx.globalAlpha = 0.28;
          ctx.stroke();
          ctx.globalAlpha = 0.85;
        }
        if (group % 2 === 0) ctx.fillText(String(group * 5), labelX, yLabel);
      }
    }
    // The skunk line: below it at the end, a loser has been skunked.
    const skunkY = holeY(29) - 13;
    for (const side of [0, 1] as const) {
      const outer = CENTRE_X + COLUMNS[side].outer;
      const inner = CENTRE_X + COLUMNS[side].inner;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(Math.min(outer, inner) - 8, skunkY);
      ctx.lineTo(Math.max(outer, inner) + 8, skunkY);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.9;
    ctx.font = `700 13px "Fraunces Variable", Georgia, serif`;
    ctx.fillText('S', CENTRE_X, skunkY - 1);
    ctx.font = `600 10px "Fraunces Variable", Georgia, serif`;
    ctx.globalAlpha = 0.75;
    ctx.fillText(length === 61 ? 'ONCE' : 'TWICE', CENTRE_X, BOARD.y + 20);
    ctx.fillText('AROUND', CENTRE_X, BOARD.y + 32);
    ctx.restore();
  }

  /** Draws the board in design units (the context is already scaled to the design sheet). */
  draw(ctx: Ctx): void {
    if (!this.image) return;
    const pad = 40;
    ctx.drawImage(this.image, BOARD.x - pad, BOARD.y - pad, BOARD.w + pad * 2, BOARD.h + pad * 2);
  }

  /** The brass score plates, engraved with each player's name and score. */
  drawPlates(ctx: Ctx, names: [string, string], scores: [number, number], glow: [number, number]) {
    const look = this.look;
    for (const side of [0, 1] as const) {
      const plate = PLATES[side];
      const metal = ctx.createLinearGradient(plate.x, plate.y, plate.x, plate.y + plate.h);
      metal.addColorStop(0, look.board.plate);
      metal.addColorStop(0.55, look.board.plateDeep);
      metal.addColorStop(1, look.board.plate);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      roundedRect(ctx, plate.x, plate.y, plate.w, plate.h, 10);
      ctx.fillStyle = metal;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255, 245, 210, 0.55)';
      ctx.lineWidth = 1.2;
      roundedRect(ctx, plate.x + 3, plate.y + 3, plate.w - 6, plate.h - 6, 8);
      ctx.stroke();
      // Screws at the corners.
      for (const [sx, sy] of [
        [plate.x + 9, plate.y + 9],
        [plate.x + plate.w - 9, plate.y + 9],
        [plate.x + 9, plate.y + plate.h - 9],
        [plate.x + plate.w - 9, plate.y + plate.h - 9],
      ] as const) {
        ctx.beginPath();
        ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = look.board.plateDeep;
        ctx.fill();
      }
      const pegColour = side === 0 ? look.pegs.you.cap : look.pegs.rival.cap;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = look.board.plateInk;
      ctx.font = `700 13px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
      ctx.fillText(names[side].toUpperCase(), plate.x + plate.w / 2 + 7, plate.y + 22);
      ctx.beginPath();
      ctx.arc(
        plate.x + plate.w / 2 - ctx.measureText(names[side].toUpperCase()).width / 2 - 2,
        plate.y + 22,
        4.5,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = pegColour;
      ctx.fill();
      ctx.fillStyle = look.board.plateInk;
      ctx.font = `600 44px "Fraunces Variable", Georgia, serif`;
      if (glow[side] > 0) {
        ctx.save();
        ctx.shadowColor = look.glow.core;
        ctx.shadowBlur = 16 * glow[side];
        ctx.fillText(String(scores[side]), plate.x + plate.w / 2, plate.y + 60);
        ctx.restore();
      } else {
        ctx.fillText(String(scores[side]), plate.x + plate.w / 2, plate.y + 60);
      }
    }
  }
}

export interface PegDraw {
  side: Side;
  at: Point;
  /** 0 resting in its hole, 1 at the top of a jump. */
  lift: number;
  /** While jumping: where from and where to, so the path and the landing hole can show. */
  trail?: { from: Point; to: Point };
}

/** The arc a jumping peg follows, dotted, and a glow on the hole it is heading for. */
export function drawPegTrail(ctx: Ctx, look: Look, peg: PegDraw): void {
  if (!peg.trail) return;
  const { from, to } = peg.trail;
  const colours = peg.side === 0 ? look.pegs.you : look.pegs.rival;
  const lift = Math.min(60, Math.hypot(to.x - from.x, to.y - from.y) * 0.25);
  const midX = (from.x + to.x) / 2 + (peg.side === 0 ? -lift : lift);
  const midY = (from.y + to.y) / 2;
  ctx.save();
  ctx.setLineDash([2, 7]);
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = colours.cap;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(midX, midY, to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const halo = ctx.createRadialGradient(to.x, to.y, 0, to.x, to.y, 18);
  halo.addColorStop(0, look.glow.core);
  halo.addColorStop(0.35, colours.cap);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = halo;
  ctx.fillRect(to.x - 18, to.y - 18, 36, 36);
  ctx.restore();
}

/** A peg seen from above and a little to the side: shadow, brass shank and an enamel cap. */
export function drawPeg(ctx: Ctx, look: Look, peg: PegDraw): void {
  const colours = peg.side === 0 ? look.pegs.you : look.pegs.rival;
  const lift = peg.lift;
  const radius = 8.6 * (1 + lift * 0.45);
  const { x, y } = peg.at;
  const shadowDx = look.castShadow.dx * (0.25 + lift * 1.6);
  const shadowDy = look.castShadow.dy * (0.25 + lift * 1.6);
  const spread = 1.25 + lift * 0.6;
  softShadow(
    ctx,
    x + shadowDx,
    y + shadowDy,
    radius * spread,
    radius * 0.8 * spread,
    look.castShadow.alpha * (1 - lift * 0.45),
  );
  const top = y - 9 - lift * 30;
  // The shank between the hole and the cap.
  const shank = ctx.createLinearGradient(x - radius * 0.5, 0, x + radius * 0.5, 0);
  shank.addColorStop(0, colours.metalDeep);
  shank.addColorStop(0.45, colours.metal);
  shank.addColorStop(1, colours.metalDeep);
  ctx.fillStyle = shank;
  ctx.beginPath();
  ctx.roundRect(x - radius * 0.42, top, radius * 0.84, y - top + 1, radius * 0.3);
  ctx.fill();
  // The domed cap with a highlight from the light.
  const cap = ctx.createRadialGradient(
    x - radius * 0.35,
    top - radius * 0.35,
    radius * 0.1,
    x,
    top,
    radius,
  );
  cap.addColorStop(0, '#fff6e8');
  cap.addColorStop(0.25, colours.cap);
  cap.addColorStop(1, colours.capDeep);
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.arc(x, top, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colours.metal;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}
