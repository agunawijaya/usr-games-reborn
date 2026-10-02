import type { Cell } from '../engine/geometry';
import { withAlpha } from './fruit';
import type { Layout } from './layout';
import { FONT_DISPLAY, FONT_UI, type Look } from './look';

/**
 * The moments drawn over the bed: the points of a bite popping up (with the chain it extends),
 * a splash of juice, and the mosaic a filled box turns into.
 */

export interface Popup {
  at: Cell;
  points: number;
  chain: number;
  value: number;
  /** Seconds, on the same clock as the frame. */
  born: number;
  /** Where the points float, in cells from the bite: into open soil, away from the head. */
  drift?: { dx: number; dy: number };
  /** A word in the badge above the points instead of the chain, such as a count-up. */
  badge?: string;
}

/**
 * A drift for a popup at `at`: of eight directions, the one that lands furthest from the cells to
 * keep clear (the body, and anything on the board worth seeing) and still inside the box, leaning
 * upwards. The popup is wider than it is tall, so sideways distance counts for less.
 */
export function driftFor(
  at: Cell,
  cols: number,
  rows: number,
  avoid: readonly Cell[],
): { dx: number; dy: number } {
  let best = { dx: 0, dy: -1.6, score: -Infinity };
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
    const dx = Math.cos(a) * 1.7;
    const dy = Math.sin(a) * 1.7;
    const x = at.x + dx;
    const y = at.y + dy - 0.6;
    if (x < 0.4 || y < 0.4 || x > cols - 1.4 || y > rows - 1.4) continue;
    const near = Math.min(...avoid.map((c) => Math.hypot((c.x - x) * 0.65, c.y - y)));
    const score = Math.min(near, 2.5) - dy * 0.15;
    if (score > best.score) best = { dx, dy, score };
  }
  return { dx: best.dx, dy: best.dy };
}

export interface Burst {
  at: Cell;
  value: number;
  born: number;
}

export const POPUP_SECONDS = 1.4;
export const BURST_SECONDS = 0.6;

function centreOf(layout: Layout, cell: Cell): { x: number; y: number } {
  return {
    x: layout.left + (cell.x + 0.5) * layout.cell,
    y: layout.top + (cell.y + 0.5) * layout.cell,
  };
}

export function drawBursts(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  bursts: readonly Burst[],
  time: number,
): void {
  for (const burst of bursts) {
    const age = (time - burst.born) / BURST_SECONDS;
    if (age < 0 || age > 1) continue;
    const { x, y } = centreOf(layout, burst.at);
    const colour = look.fruit[burst.value - 1]!;
    const drops = 6 + burst.value;
    for (let i = 0; i < drops; i++) {
      const a = (i / drops) * Math.PI * 2 + burst.value;
      const d = layout.cell * (0.35 + age * (0.6 + (i % 3) * 0.18));
      ctx.fillStyle = withAlpha(colour, 1 - age);
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(a) * d,
        y + Math.sin(a) * d + age * age * layout.cell * 0.3,
        layout.cell * 0.08 * (1 - age * 0.6),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
}

/** Chunky points rising from the bite; a chain badge above them from the second bite on. */
export function drawPopups(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  popups: readonly Popup[],
  time: number,
): void {
  for (const popup of popups) {
    const age = (time - popup.born) / POPUP_SECONDS;
    if (age < 0 || age > 1) continue;
    const base = centreOf(layout, popup.at);
    const drift = popup.drift ?? { dx: 0, dy: -0.6 };
    const travel = easeOut(Math.min(1, age * 2.2));
    const x = base.x + drift.dx * layout.cell * travel;
    const y = base.y + drift.dy * layout.cell * travel;
    const rise = easeOut(Math.min(1, age * 1.6)) * layout.cell * 0.5;
    const pop = age < 0.18 ? 0.6 + (age / 0.18) * 0.6 : 1.2 - Math.min(0.2, (age - 0.18) * 0.8);
    const fade = age > 0.75 ? 1 - (age - 0.75) / 0.25 : 1;
    const size = layout.cell * (0.62 + Math.min(0.5, popup.chain * 0.07)) * pop;
    const colour = look.fruit[popup.value - 1]!;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y - rise);
    ctx.font = `900 ${Math.round(size)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const text = `+${popup.points}`;
    ctx.lineWidth = size * 0.26;
    ctx.strokeStyle = look.popOutline;
    ctx.strokeText(text, 0, size * 0.06);
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = colour;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = look.popInk;
    ctx.fillText(text, 0, 0);
    const label = popup.badge ?? (popup.chain >= 2 ? `CHAIN ×${popup.chain}` : null);
    if (label) {
      const badge = layout.cell * 0.36;
      ctx.font = `800 ${Math.round(badge)}px ${FONT_UI}`;
      const w = ctx.measureText(label).width + badge * 1.4;
      const h = badge * 1.55;
      const by = -size * 0.95;
      const gradient = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      gradient.addColorStop(0, '#ff5fa2');
      gradient.addColorStop(0.5, '#ffb347');
      gradient.addColorStop(1, '#7c5cff');
      ctx.fillStyle = look.popOutline;
      ctx.beginPath();
      ctx.roundRect(-w / 2 - 3, by - h / 2 - 3 + 3, w + 6, h + 6, h);
      ctx.fill();
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(-w / 2, by - h / 2, w, h, h);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, 0, by + badge * 0.05);
    }
    ctx.restore();
  }
}

/**
 * The filled box: every cell under the coiled body becomes a glowing tile, hued along the body
 * from head to tail, and a ripple runs outward from the head. The noodle is drawn over it in the
 * same colours (`mosaicTint`). `elapsed` is seconds since the box was filled.
 */
export function drawMosaic(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  body: readonly Cell[],
  elapsed: number,
  reducedMotion: boolean,
): void {
  const head = body[0];
  if (!head) return;
  const { cell } = layout;
  const front = reducedMotion ? 99 : elapsed * 6;
  const reveal = reducedMotion ? 1 : Math.min(1, elapsed * 3);
  ctx.save();
  body.forEach((c, i) => {
    const { x, y } = centreOf(layout, c);
    const d = Math.hypot(c.x - head.x, c.y - head.y);
    const wave = Math.max(0, 1 - Math.abs(d - front) / 1.3);
    const hue = mosaicHue(i, body.length);
    const inset = cell * 0.04;
    const size = cell - inset * 2;
    ctx.globalAlpha = reveal;
    ctx.shadowColor = `hsla(${hue}, 100%, 65%, ${(look.dark ? 0.55 : 0.3) + wave * 0.45})`;
    ctx.shadowBlur = cell * (0.2 + wave * 0.7);
    ctx.fillStyle = look.dark
      ? `hsl(${hue}, 70%, ${26 + wave * 30}%)`
      : `hsl(${hue}, 80%, ${80 + wave * 10}%)`;
    ctx.beginPath();
    ctx.roundRect(x - size / 2, y - size / 2, size, size, cell * 0.16);
    ctx.fill();
  });
  ctx.restore();
}

/** The ripple itself: a soft ring of light spreading from the head over the box. */
export function drawRipple(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  head: Cell,
  elapsed: number,
  reducedMotion: boolean,
): void {
  if (reducedMotion) return;
  const { x, y } = centreOf(layout, head);
  const box = {
    x: layout.left,
    y: layout.top,
    w: layout.cols * layout.cell,
    h: layout.rows * layout.cell,
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  for (const [delay, strength] of [
    [0, 1],
    [0.35, 0.6],
  ] as const) {
    const t = elapsed - delay;
    if (t <= 0) continue;
    const radius = t * 6 * layout.cell;
    const fade = Math.max(0, 1 - t / 1.6) * strength;
    const ring = ctx.createRadialGradient(
      x,
      y,
      Math.max(0, radius - layout.cell * 0.9),
      x,
      y,
      radius + layout.cell * 0.4,
    );
    ring.addColorStop(0, 'rgba(255, 255, 255, 0)');
    ring.addColorStop(0.7, `rgba(255, 255, 255, ${0.55 * fade})`);
    ring.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = ring;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  ctx.restore();
}

/** The colour of the nth cell of the body on the mosaic: pink at the head round to blue. */
export function mosaicHue(index: number, length: number): number {
  return (340 - (index / Math.max(1, length - 1)) * 300 + 360) % 360;
}

/** The noodle's own colours on the mosaic, with a bright band where the ripple is passing. */
export function mosaicTint(
  elapsed: number,
  reducedMotion: boolean,
): (u: number, length: number) => string {
  const front = reducedMotion ? 99 : elapsed * 6;
  return (u, length) => {
    const lit = Math.max(0, 1 - Math.abs(u * 0.55 - front * 0.55) / 1.6);
    return `hsl(${mosaicHue(u, length)}, 92%, ${62 + lit * 16}%)`;
  };
}

/**
 * The bonk: a cartoon impact where the head met the wall, and little stars circling the head
 * while the noodle sees them. `age` is seconds since the bonk.
 */
export function drawBonk(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  head: Cell,
  hit: Cell,
  age: number,
  time: number,
  reducedMotion: boolean,
): void {
  const h = centreOf(layout, head);
  const w = {
    x: (h.x + layout.left + (hit.x + 0.5) * layout.cell) / 2,
    y: (h.y + layout.top + (hit.y + 0.5) * layout.cell) / 2,
  };
  const { cell } = layout;
  const pop = Math.max(0, 1 - age / 0.5);
  if (pop > 0) {
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.fillStyle = `rgba(255, 244, 190, ${pop})`;
    ctx.strokeStyle = `rgba(120, 70, 20, ${pop})`;
    ctx.lineWidth = cell * 0.04;
    ctx.beginPath();
    const spikes = 9;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = (i % 2 === 0 ? 0.5 : 0.24) * cell * (0.7 + (1 - pop) * 0.5);
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // Stars on a tilted orbit above the head.
  const count = 4;
  for (let i = 0; i < count; i++) {
    const a = (reducedMotion ? 0 : time * 3.2) + (i / count) * Math.PI * 2;
    const x = h.x + Math.cos(a) * cell * 0.75;
    const y = h.y - cell * 0.78 + Math.sin(a) * cell * 0.22;
    const behind = Math.sin(a) < 0;
    star(ctx, x, y, cell * (behind ? 0.15 : 0.21), behind ? 0.65 : 1);
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffd84a';
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = Math.max(1, r * 0.25);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
