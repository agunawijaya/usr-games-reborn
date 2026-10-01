import type { TangleKind, VacuumKind } from '../../engine/types';
import { type Look, vacuumColors } from '../palette';
import { circle, type Ctx, ellipse, floorShadow, glow, hash2, line } from '../shapes';

/** Tangles, socks, cables and the charging dock: everything a vacuum can come to grief on. */

function sockPath(ctx: Ctx, s: number) {
  ctx.beginPath();
  ctx.moveTo(-0.22 * s, -0.2 * s);
  ctx.lineTo(-0.02 * s, -0.24 * s);
  ctx.lineTo(0.04 * s, 0.06 * s);
  ctx.quadraticCurveTo(0.3 * s, 0.05 * s, 0.28 * s, 0.18 * s);
  ctx.quadraticCurveTo(0.26 * s, 0.27 * s, 0.02 * s, 0.25 * s);
  ctx.quadraticCurveTo(-0.14 * s, 0.24 * s, -0.16 * s, 0.1 * s);
  ctx.closePath();
}

export function drawSock(ctx: Ctx, cx: number, cy: number, s: number, look: Look, seed: number) {
  const hues =
    look === 'day'
      ? ['#e86f6a', '#5f9fd6', '#f2b84b', '#8cc084']
      : ['#a84a5a', '#3f6a9a', '#a8823a', '#4f7a5a'];
  const main = hues[Math.floor(hash2(seed, 3) * hues.length)]!;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((hash2(seed, 7) - 0.5) * 1.6);
  floorShadow(
    ctx,
    0,
    0.05 * s,
    0.3 * s,
    0.22 * s,
    look === 'day' ? 'rgba(70,45,20,0.22)' : 'rgba(0,0,0,0.4)',
  );
  sockPath(ctx, s);
  ctx.fillStyle = main;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = -3; i < 6; i++) {
    ctx.fillStyle = look === 'day' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.22)';
    ctx.fillRect(-0.3 * s, (-0.2 + i * 0.09) * s, 0.7 * s, 0.035 * s);
  }
  ctx.restore();
  ctx.strokeStyle = look === 'day' ? 'rgba(60,40,30,0.5)' : 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 0.02 * s;
  ctx.stroke();
  ctx.restore();
}

export function drawCable(ctx: Ctx, cx: number, cy: number, s: number, look: Look, seed: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(hash2(seed, 5) * Math.PI * 2);
  const wire = look === 'day' ? '#3d3a40' : '#9a9ab0';
  ctx.strokeStyle = wire;
  ctx.lineWidth = 0.035 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const angle = t * Math.PI * 5;
    const r = (0.08 + t * 0.2) * s;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r * 0.7;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // The plug at the loose end.
  ctx.fillStyle = look === 'day' ? '#f1efe9' : '#cfd0dc';
  ctx.beginPath();
  ctx.roundRect(0.24 * s, -0.06 * s, 0.12 * s, 0.09 * s, 0.02 * s);
  ctx.fill();
  line(ctx, 0.36 * s, -0.04 * s, 0.42 * s, -0.04 * s, wire, 0.02 * s);
  line(ctx, 0.36 * s, 0.01 * s, 0.42 * s, 0.01 * s, wire, 0.02 * s);
  ctx.restore();
}

/** Vacuums stuck together: tipped discs in a nest of fluff, with a blinking error light. */
export function drawTangle(
  ctx: Ctx,
  cx: number,
  cy: number,
  s: number,
  look: Look,
  kind: TangleKind,
  size: number,
  kinds: readonly VacuumKind[],
  time: number,
  seed: number,
) {
  if (kind === 'sock' && size === 0) return drawSock(ctx, cx, cy, s, look, seed);
  if (kind === 'cable' && size === 0) return drawCable(ctx, cx, cy, s, look, seed);
  ctx.save();
  floorShadow(
    ctx,
    cx,
    cy + 0.18 * s,
    0.44 * s,
    0.18 * s,
    look === 'day' ? 'rgba(60,40,20,0.35)' : 'rgba(0,0,0,0.55)',
  );
  if (kind === 'sock') drawSock(ctx, cx + 0.12 * s, cy + 0.12 * s, s * 0.8, look, seed);
  if (kind === 'cable') drawCable(ctx, cx, cy + 0.1 * s, s * 0.85, look, seed);
  // Up to three of the stuck vacuums, tipped against each other, each with its visor and a
  // pair of dizzy crosses for eyes, so a tangle reads as vacuums at a glance.
  const shown = Math.max(1, Math.min(3, size));
  const ink = look === 'day' ? 'rgba(46, 36, 28, 0.6)' : 'rgba(0, 0, 0, 0.75)';
  for (let i = 0; i < shown; i++) {
    const vacuumKind = kinds[i] ?? 'basic';
    const colors = vacuumColors(vacuumKind, look);
    const angle = (i - (shown - 1) / 2) * 0.6 + (hash2(seed, i) - 0.5) * 0.35;
    const ox = Math.sin(angle) * 0.2 * s;
    const oy = -Math.abs(angle) * 0.06 * s - i * 0.03 * s;
    ctx.save();
    ctx.translate(cx + ox, cy + oy);
    ctx.rotate(angle * 0.9);
    const rx = 0.33 * s;
    const ry = 0.22 * s;
    ellipse(ctx, 0, 0.07 * s, rx, ry, colors.rim);
    ellipse(ctx, 0, 0, rx, ry, colors.body);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.025 * s;
    ctx.stroke();
    ellipse(ctx, 0, 0.04 * s, rx * 0.6, ry * 0.5, look === 'day' ? '#262a35' : '#0b0d16');
    const cross = look === 'day' ? '#ff6a5a' : '#ff7a7a';
    for (const side of [-1, 1]) {
      const ex = side * 0.08 * s;
      const ey = 0.04 * s;
      line(ctx, ex - 0.028 * s, ey - 0.028 * s, ex + 0.028 * s, ey + 0.028 * s, cross, 0.02 * s);
      line(ctx, ex + 0.028 * s, ey - 0.028 * s, ex - 0.028 * s, ey + 0.028 * s, cross, 0.02 * s);
    }
    ctx.restore();
  }
  // The fluff they choked on.
  ctx.strokeStyle = look === 'day' ? 'rgba(120, 104, 92, 0.75)' : 'rgba(190, 184, 220, 0.55)';
  ctx.lineWidth = 0.016 * s;
  for (let i = 0; i < 5; i++) {
    const a = hash2(seed, i + 10) * Math.PI * 2;
    const r = 0.14 * s + hash2(seed, i + 20) * 0.1 * s;
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * 0.12 * s,
      cy + Math.sin(a) * 0.06 * s + 0.06 * s,
      r * 0.5,
      a,
      a + 2.4,
    );
    ctx.stroke();
  }
  if (Math.floor(time * 1.5 + hash2(seed, 2) * 3) % 2 === 0) {
    const red = look === 'day' ? '#d8322a' : '#ff5a5a';
    const paint = () => circle(ctx, cx + 0.2 * s, cy - 0.18 * s, 0.035 * s, red);
    if (look === 'night') glow(ctx, red, 0.3 * s, paint);
    else paint();
  }
  ctx.restore();
}

export function drawDock(
  ctx: Ctx,
  cx: number,
  cy: number,
  s: number,
  look: Look,
  remaining: number,
  jammed: boolean,
  time: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  floorShadow(
    ctx,
    0,
    0.18 * s,
    0.42 * s,
    0.14 * s,
    look === 'day' ? 'rgba(60,40,20,0.3)' : 'rgba(0,0,0,0.5)',
  );
  // A low ramp the vacuums back onto.
  ctx.beginPath();
  ctx.moveTo(-0.4 * s, 0.26 * s);
  ctx.lineTo(0.4 * s, 0.26 * s);
  ctx.lineTo(0.3 * s, 0.02 * s);
  ctx.lineTo(-0.3 * s, 0.02 * s);
  ctx.closePath();
  ctx.fillStyle = look === 'day' ? '#d9d4ca' : '#33313e';
  ctx.fill();
  // The tower at the back, with the charging light.
  ctx.beginPath();
  ctx.roundRect(-0.3 * s, -0.36 * s, 0.6 * s, 0.4 * s, [0.16 * s, 0.16 * s, 0.04 * s, 0.04 * s]);
  ctx.fillStyle = look === 'day' ? '#f4f1ea' : '#45434f';
  ctx.fill();
  ctx.strokeStyle = look === 'day' ? 'rgba(60,50,40,0.4)' : 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 0.02 * s;
  ctx.stroke();
  const pulse = 0.6 + Math.sin(time * 3) * 0.4;
  const lamp = jammed
    ? look === 'day'
      ? '#d8322a'
      : '#ff5a5a'
    : look === 'day'
      ? '#1fae82'
      : '#6dfff0';
  ctx.save();
  ctx.globalAlpha *= jammed ? (Math.floor(time * 4) % 2 ? 1 : 0.3) : pulse;
  const paintLamp = () => {
    ctx.beginPath();
    ctx.roundRect(-0.16 * s, -0.25 * s, 0.32 * s, 0.06 * s, 0.03 * s);
    ctx.fillStyle = lamp;
    ctx.fill();
  };
  if (look === 'night') glow(ctx, lamp, 0.4 * s, paintLamp);
  else paintLamp();
  ctx.restore();
  // One dot for every vacuum still waiting inside.
  for (let i = 0; i < remaining; i++) {
    const x = (-0.15 + i * (0.3 / Math.max(1, remaining - 1 || 1))) * s;
    circle(
      ctx,
      remaining === 1 ? 0 : x,
      -0.1 * s,
      0.03 * s,
      look === 'day' ? '#6a6458' : '#cfcbe0',
    );
  }
  if (jammed) {
    line(ctx, -0.08 * s, -0.16 * s, 0.08 * s, -0.02 * s, lamp, 0.03 * s);
    line(ctx, 0.08 * s, -0.16 * s, -0.08 * s, -0.02 * s, lamp, 0.03 * s);
  }
  ctx.restore();
}
