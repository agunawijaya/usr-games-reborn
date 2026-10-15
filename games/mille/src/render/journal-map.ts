import { type Journal, STOPS, openRoutes } from '../modes/journal';
import type { Look } from './look';
import { DISPLAY_FONT, alpha, circle, fillWith, poly, roundRect, strokeWith } from './paint';
import { ROUTES, type RouteId } from './routes';

/**
 * The journal's map: a poster map of the five roads joined in a loop, each stop a badge in its
 * route's colour with a little emblem; locked stops are grey with a padlock, stickers ring a
 * stop in gold, and its stamps are counted under it.
 */

const SIGNATURE: Record<RouteId, string> = {
  coast: '#2a8a9a',
  desert: '#d9893d',
  alpine: '#5f86c2',
  jungle: '#3f8a4b',
  city: '#8a5bd6',
};

const LOOP: RouteId[] = ['coast', 'desert', 'alpine', 'city', 'jungle'];

export function paintJournalMap(canvas: HTMLCanvasElement, journal: Journal, look: Look): void {
  const box = canvas.getBoundingClientRect();
  const w = Math.max(240, Math.round(box.width));
  const h = Math.max(160, Math.round(box.height));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const t = look.table;
  roundRect(ctx, 0, 0, w, h, 14);
  fillWith(ctx, t.paper);
  ctx.save();
  roundRect(ctx, 0, 0, w, h, 14);
  ctx.clip();
  // Sea along the left and bottom, land everywhere else.
  ctx.beginPath();
  ctx.moveTo(0, h * 0.4);
  ctx.bezierCurveTo(w * 0.12, h * 0.5, w * 0.08, h * 0.85, w * 0.32, h * 0.9);
  ctx.bezierCurveTo(w * 0.5, h * 0.95, w * 0.7, h * 0.86, w * 0.78, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  fillWith(ctx, alpha(look.dark ? '#3c6f9a' : '#7fb8cf', look.dark ? 0.35 : 0.45));
  // Contour rings round a few hills.
  ctx.strokeStyle = t.contour;
  ctx.lineWidth = 1.2;
  for (const [cx, cy] of [
    [0.62, 0.2],
    [0.4, 0.3],
    [0.85, 0.75],
  ] as const) {
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      ctx.ellipse(cx * w, cy * h, ring * 18, ring * 11, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  const at = (id: RouteId) => {
    const stop = STOPS.find((s) => s.id === id)!;
    return { x: stop.map.x * w, y: stop.map.y * h };
  };
  // The road that joins them, dotted.
  ctx.save();
  ctx.setLineDash([8, 7]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = alpha(look.dark ? '#f0c27a' : '#c4531f', 0.75);
  ctx.beginPath();
  LOOP.forEach((id, i) => {
    const p = at(id);
    const next = at(LOOP[(i + 1) % LOOP.length]!);
    if (i === 0) ctx.moveTo(p.x, p.y);
    const mx = (p.x + next.x) / 2 + (next.y - p.y) * 0.18;
    const my = (p.y + next.y) / 2 - (next.x - p.x) * 0.18;
    ctx.quadraticCurveTo(mx, my, next.x, next.y);
  });
  ctx.stroke();
  ctx.restore();
  const open = openRoutes(journal);
  const r = Math.min(w, h) * 0.075;
  for (const stop of STOPS) {
    const p = at(stop.id);
    const isOpen = open.includes(stop.id);
    const colour = isOpen ? SIGNATURE[stop.id] : look.dark ? '#4a5368' : '#b4ab98';
    if (journal.stickers.includes(stop.id)) {
      circle(ctx, p.x, p.y, r + 7);
      fillWith(ctx, '#e5a92b');
    }
    circle(ctx, p.x, p.y, r);
    fillWith(ctx, colour);
    circle(ctx, p.x, p.y, r);
    strokeWith(ctx, '#ffffff', 3);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(r / 30, r / 30);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    if (isOpen) emblem(ctx, stop.id);
    else padlock(ctx);
    ctx.restore();
    ctx.fillStyle = t.label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `800 ${Math.max(12, r * 0.42)}px ${DISPLAY_FONT}`;
    ctx.fillText(ROUTES[stop.id].name, p.x, p.y + r + 10);
    const stamps = journal.stamps[stop.id] ?? 0;
    if (stamps > 0) {
      ctx.font = `700 ${Math.max(11, r * 0.34)}px ${DISPLAY_FONT}`;
      ctx.fillStyle = t.labelSoft;
      ctx.fillText(
        `${stamps} stamp${stamps === 1 ? '' : 's'}`,
        p.x,
        p.y + r + 12 + Math.max(12, r * 0.42) * 1.15,
      );
    }
  }
}

/** A little white emblem for each route, on a 60-unit badge. */
function emblem(ctx: CanvasRenderingContext2D, id: RouteId): void {
  switch (id) {
    case 'coast':
      poly(ctx, [-5, 14, -3, -12, 3, -12, 5, 14]);
      ctx.fill();
      ctx.fillRect(-6, -18, 12, 6);
      break;
    case 'desert':
      ctx.fillRect(-3, -16, 6, 30);
      ctx.fillRect(-13, -6, 6, 4);
      ctx.fillRect(-13, -12, 4, 10);
      ctx.fillRect(7, -2, 6, 4);
      ctx.fillRect(9, -10, 4, 10);
      break;
    case 'alpine':
      poly(ctx, [-18, 14, -4, -14, 4, -2, 9, -8, 20, 14]);
      ctx.fill();
      break;
    case 'jungle':
      ctx.fillRect(-2, -6, 4, 22);
      for (const a of [-2.4, -1.6, -0.8, 0]) {
        ctx.save();
        ctx.translate(0, -6);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(10, 0, 11, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'city':
      ctx.fillRect(-18, -2, 9, 16);
      ctx.fillRect(-7, -16, 10, 30);
      ctx.fillRect(5, -8, 12, 22);
      break;
  }
}

function padlock(ctx: CanvasRenderingContext2D): void {
  roundRect(ctx, -11, -3, 22, 17, 3);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -4, 7, Math.PI, 0);
  ctx.stroke();
}
