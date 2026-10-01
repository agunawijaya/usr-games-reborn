import type { VacuumKind } from '../../engine/types';
import { type Look, vacuumColors } from '../palette';
import { circle, type Ctx, ellipse, floorShadow, glow, line } from '../shapes';

/**
 * Robot vacuums seen from a little above: a disc with a side band, a bumper, and a dark visor
 * whose two LED eyes look where the vacuum is about to roll. Each kind has its own outline
 * (round, square-nosed mop, tall drum, big old model, small racer), so the kinds differ by
 * shape as well as colour.
 */

export type Mood = 'calm' | 'alert' | 'danger';

export interface VacuumDrawing {
  readonly kind: VacuumKind;
  readonly look: Look;
  /** Direction of its next step (0,0 when it has none). */
  readonly heading: { readonly x: number; readonly y: number };
  readonly mood: Mood;
  readonly resting: boolean;
  readonly full: boolean;
  readonly time: number;
  /** 0…1 through a hop, for a little bounce while moving. */
  readonly hop: number;
  readonly squash?: number;
  readonly ghost?: boolean;
}

const MOOD_LED: Record<Exclude<Mood, 'calm'>, Record<Look, string>> = {
  alert: { day: '#ffb52e', night: '#ffbe4a' },
  danger: { day: '#ff4b3e', night: '#ff5a5a' },
};

interface Size {
  rx: number;
  ry: number;
  band: number;
}

function sizeFor(kind: VacuumKind, s: number): Size {
  switch (kind) {
    case 'slow':
      return { rx: 0.47 * s, ry: 0.36 * s, band: 0.13 * s };
    case 'turbo':
      return { rx: 0.37 * s, ry: 0.28 * s, band: 0.1 * s };
    case 'sweeper':
      return { rx: 0.36 * s, ry: 0.28 * s, band: 0.24 * s };
    default:
      return { rx: 0.43 * s, ry: 0.33 * s, band: 0.12 * s };
  }
}

function bodyPath(ctx: Ctx, kind: VacuumKind, x: number, y: number, size: Size) {
  ctx.beginPath();
  if (kind === 'mop') {
    const r = size.ry * 0.9;
    ctx.roundRect(x - size.rx, y - size.ry, size.rx * 2, size.ry * 2, [
      r,
      r,
      size.ry * 0.3,
      size.ry * 0.3,
    ]);
  } else {
    ctx.ellipse(x, y, size.rx, size.ry, 0, 0, Math.PI * 2);
  }
}

function headingOrFront(d: VacuumDrawing): { x: number; y: number } {
  if (d.heading.x === 0 && d.heading.y === 0) return { x: 0, y: 1 };
  const length = Math.hypot(d.heading.x, d.heading.y);
  return { x: d.heading.x / length, y: d.heading.y / length };
}

function drawVisor(ctx: Ctx, s: number, size: Size, d: VacuumDrawing, top: number) {
  const front = headingOrFront(d);
  const visor = d.look === 'day' ? '#262a35' : '#0b0d16';
  const led = d.mood === 'calm' ? vacuumColors(d.kind, d.look).led : MOOD_LED[d.mood][d.look];
  const vx = front.x * size.rx * 0.38;
  const vy = top + front.y * size.ry * 0.36 + size.ry * 0.08;
  ctx.save();
  bodyPath(ctx, d.kind, 0, top, size);
  ctx.clip();
  ellipse(ctx, vx, vy, size.rx * 0.6, size.ry * 0.42, visor);
  // A glint across the visor.
  ctx.beginPath();
  ctx.ellipse(
    vx - size.rx * 0.12,
    vy - size.ry * 0.16,
    size.rx * 0.32,
    size.ry * 0.08,
    -0.15,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.fill();
  ctx.restore();
  const spread = size.rx * 0.27;
  const ex = vx + front.x * size.rx * 0.08;
  const ey = vy + front.y * size.ry * 0.06;
  const paint = () => {
    for (const side of [-1, 1]) {
      const x = ex + side * spread;
      if (d.resting) {
        line(ctx, x - 0.045 * s, ey, x + 0.045 * s, ey, led, 0.03 * s);
        continue;
      }
      const tall = d.mood === 'danger' ? 0.05 : 0.075;
      ctx.beginPath();
      ctx.roundRect(x - 0.033 * s, ey - tall * s * 0.6, 0.066 * s, tall * s, 0.033 * s);
      ctx.fillStyle = led;
      ctx.fill();
    }
  };
  if (!d.resting) glow(ctx, led, (d.look === 'night' ? 0.5 : 0.22) * s, paint);
  else paint();
  if (d.mood === 'danger' && !d.resting) {
    for (const side of [-1, 1]) {
      const x = ex + side * spread;
      line(
        ctx,
        x - side * 0.06 * s,
        ey - 0.09 * s,
        x + side * 0.04 * s,
        ey - 0.055 * s,
        led,
        0.026 * s,
      );
    }
  }
}

function drawKindDetails(ctx: Ctx, s: number, size: Size, d: VacuumDrawing, top: number) {
  const c = vacuumColors(d.kind, d.look);
  const front = headingOrFront(d);
  const back = { x: -front.x * size.rx * 0.5, y: top - front.y * size.ry * 0.45 };
  switch (d.kind) {
    case 'slow': {
      // An old model: a patched dent and a stubby aerial whose bulb dims while it rests.
      ctx.save();
      ctx.translate(size.rx * 0.5, top - size.ry * 0.25);
      ctx.rotate(0.3);
      ctx.fillStyle = d.look === 'day' ? '#f4e6b8' : '#6a5e44';
      ctx.fillRect(-0.06 * s, -0.025 * s, 0.12 * s, 0.05 * s);
      ctx.fillRect(-0.025 * s, -0.06 * s, 0.05 * s, 0.12 * s);
      ctx.restore();
      line(ctx, back.x, back.y, back.x - 0.05 * s, back.y - 0.3 * s, c.trim, 0.035 * s);
      const bulb = d.resting ? (d.look === 'day' ? '#bfae88' : '#4a4232') : c.led;
      const paintBulb = () => circle(ctx, back.x - 0.05 * s, back.y - 0.32 * s, 0.06 * s, bulb);
      if (!d.resting) glow(ctx, bulb, 0.3 * s, paintBulb);
      else paintBulb();
      break;
    }
    case 'turbo': {
      ctx.save();
      bodyPath(ctx, 'turbo', 0, top, size);
      ctx.clip();
      ctx.fillStyle = c.trim;
      ctx.fillRect(-0.09 * s, top - size.ry, 0.06 * s, size.ry * 2);
      ctx.fillRect(0.0, top - size.ry, 0.03 * s, size.ry * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(back.x - 0.18 * s, back.y - 0.07 * s, 0.36 * s, 0.07 * s, 0.03 * s);
      ctx.fillStyle = c.rim;
      ctx.fill();
      break;
    }
    case 'sweeper': {
      ellipse(ctx, 0, top, size.rx * 0.84, size.ry * 0.82, c.trim);
      ellipse(
        ctx,
        0,
        top,
        size.rx * 0.72,
        size.ry * 0.7,
        d.full ? (d.look === 'day' ? '#9a8660' : '#5a4c36') : c.top,
      );
      ctx.beginPath();
      ctx.arc(size.rx * 0.12, top - size.ry * 0.12, size.rx * 0.36, Math.PI * 0.9, Math.PI * 2.35);
      ctx.strokeStyle = c.rim;
      ctx.lineWidth = 0.07 * s;
      ctx.lineCap = 'round';
      ctx.stroke();
      if (d.full)
        ellipse(
          ctx,
          -size.rx * 0.2,
          top + size.ry * 0.05,
          size.rx * 0.34,
          size.ry * 0.3,
          d.look === 'day' ? '#b49c6a' : '#6a5a40',
        );
      break;
    }
    case 'mop':
      break;
    default:
      // A quiet power button on the lid, toward the back.
      circle(ctx, back.x * 0.6, back.y + (top - back.y) * 0.4, 0.05 * s, c.rim);
  }
}

export function drawVacuum(ctx: Ctx, cx: number, cy: number, s: number, d: VacuumDrawing) {
  const c = vacuumColors(d.kind, d.look);
  const size = sizeFor(d.kind, s);
  const bounce = Math.sin(d.hop * Math.PI) * 0.07 * s;
  const squash = d.squash ?? 0;
  const ink = d.look === 'day' ? 'rgba(46, 36, 28, 0.6)' : 'rgba(0, 0, 0, 0.75)';
  ctx.save();
  if (d.ghost) ctx.globalAlpha *= 0.5;
  floorShadow(
    ctx,
    cx,
    cy + size.ry * 0.45 + size.band * 0.5,
    size.rx * 1.08,
    size.ry * 0.55,
    d.look === 'day' ? 'rgba(60,40,20,0.38)' : 'rgba(0,0,0,0.6)',
  );
  ctx.translate(cx, cy - bounce + size.band * 0.25);
  ctx.scale(1 + squash * 0.25, 1 - squash * 0.25);
  const top = -size.band * 0.6;
  if (d.kind === 'mop') {
    ctx.beginPath();
    ctx.roundRect(
      -size.rx * 0.95,
      top + size.band * 0.4,
      size.rx * 1.9,
      size.ry * 2 + size.band * 0.5,
      size.ry * 0.45,
    );
    ctx.fillStyle = d.look === 'day' ? '#9fd3ee' : '#3d6f96';
    ctx.fill();
  }
  // The side band (darker), then the lid on top of it.
  bodyPath(ctx, d.kind, 0, top + size.band, size);
  ctx.fillStyle = c.rim;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.028 * s;
  ctx.stroke();
  ctx.fillRect(-size.rx, top, size.rx * 2, size.band);
  bodyPath(ctx, d.kind, 0, top, size);
  const sheen = ctx.createRadialGradient(
    -size.rx * 0.35,
    top - size.ry * 0.45,
    size.rx * 0.1,
    0,
    top,
    size.rx * 1.1,
  );
  sheen.addColorStop(0, c.top);
  sheen.addColorStop(1, c.body);
  ctx.fillStyle = sheen;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.028 * s;
  ctx.stroke();
  // Side edges of the band.
  line(ctx, -size.rx, top, -size.rx, top + size.band, ink, 0.028 * s);
  line(ctx, size.rx, top, size.rx, top + size.band, ink, 0.028 * s);
  if (d.kind !== 'sweeper') {
    const front = headingOrFront(d);
    const angle = Math.atan2(front.y * size.rx, front.x * size.ry);
    ctx.beginPath();
    ctx.ellipse(0, top, size.rx * 0.97, size.ry * 0.95, 0, angle - 1.0, angle + 1.0);
    ctx.strokeStyle = c.trim;
    ctx.lineWidth = 0.06 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  drawKindDetails(ctx, s, size, d, top);
  drawVisor(ctx, s, size, d, top);
  ctx.restore();
}

/** A sleepy "z" drifting up from a resting old model. */
export function drawSnooze(ctx: Ctx, cx: number, cy: number, s: number, time: number, look: Look) {
  const rise = (time % 1.6) / 1.6;
  ctx.save();
  ctx.globalAlpha *= 1 - rise;
  ctx.fillStyle = look === 'day' ? '#6a5a8a' : '#d8ccff';
  ctx.font = `700 ${Math.round(0.3 * s)}px 'Fredoka Variable', 'Fredoka', system-ui, sans-serif`;
  ctx.fillText('z', cx + 0.28 * s + rise * 0.12 * s, cy - 0.42 * s - rise * 0.3 * s);
  ctx.restore();
}
