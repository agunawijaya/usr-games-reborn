import type { LightState } from '../engine/score';
import { decorRandom, type Look, type Palette } from './palette';
import { drawEmber, drawLantern, EMBER_LENS, LANTERN_LENS } from './ship';

/**
 * Everything in a zone, drawn in code at any size: the Lantern and the Ember, gleaners, stars,
 * black holes, worlds and harbours. `size` is one cell in pixels; `t` is seconds, for the slow
 * idle motion that reduced motion freezes (callers pass a fixed `t` then).
 */

export interface ShipLook {
  heading: number;
  shieldUp: boolean;
  shieldFraction: number;
  shrouded: boolean;
  moored: boolean;
  ember: boolean;
  /** How far the lamp's light reaches, in cells. */
  beamReach?: number;
  /** A volley could be fired now: the beam emitters on the wingtips glow. */
  beamsReady?: boolean;
}

/** The ship's length in cells: the Lantern reaches a little past her cell, the old Ember less. */
const SHIP_LENGTH = { lantern: 1.16, ember: 1.0 };

export function drawShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  p: Palette,
  look: Look,
  t: number,
  ship: ShipLook,
) {
  const length = size * (ship.ember ? SHIP_LENGTH.ember : SHIP_LENGTH.lantern);
  const lensAhead = length * (ship.ember ? EMBER_LENS : LANTERN_LENS);
  ctx.save();
  ctx.translate(x, y);
  if (ship.shrouded) ctx.globalAlpha = 0.35;
  ctx.rotate(ship.heading);
  drawLampCone(ctx, size, lensAhead, look, t, ship);
  if (ship.ember) drawEmber(ctx, length, p, look, t);
  else drawLantern(ctx, length, p, look, t);
  if (ship.beamsReady && !ship.ember) drawEmitters(ctx, length, p, look, t);
  if (ship.shieldUp) drawShield(ctx, size, p, look, t, ship.shieldFraction);
  ctx.restore();
}

/** The beam emitters at the front of the wingtip pods, glowing while a volley is ready. */
function drawEmitters(ctx: CanvasRenderingContext2D, u: number, p: Palette, look: Look, t: number) {
  const pulse = 0.75 + 0.25 * Math.sin(t * 3.2);
  for (const side of [-1, 1]) {
    const x = side * 0.4 * u;
    const y = 0.07 * u;
    const r = 0.07 * u;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    glow.addColorStop(
      0,
      look === 'night' ? 'rgba(255, 236, 170, 0.95)' : 'rgba(242, 166, 50, 0.9)',
    );
    glow.addColorStop(
      0.35,
      look === 'night' ? 'rgba(255, 196, 92, 0.55)' : 'rgba(242, 166, 50, 0.4)',
    );
    glow.addColorStop(1, 'rgba(255, 196, 92, 0)');
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = look === 'night' ? p.lampSoft : p.lamp;
    ctx.strokeStyle = look === 'night' ? p.lamp : p.ink;
    ctx.lineWidth = Math.max(1, u * 0.01);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** The lantern's light, thrown ahead of the lens and swaying very slightly. */
function drawLampCone(
  ctx: CanvasRenderingContext2D,
  size: number,
  lensAhead: number,
  look: Look,
  t: number,
  ship: ShipLook,
) {
  if (ship.moored) return;
  ctx.save();
  ctx.translate(0, -lensAhead);
  ctx.rotate(Math.sin(t * 0.6) * 0.05);
  const reach = size * (ship.beamReach ?? 2.2);
  const cone = ctx.createLinearGradient(0, 0, 0, -reach);
  cone.addColorStop(0, look === 'night' ? 'rgba(255, 205, 110, 0.36)' : 'rgba(242, 166, 50, 0.42)');
  cone.addColorStop(1, look === 'night' ? 'rgba(255, 205, 110, 0)' : 'rgba(242, 166, 50, 0.04)');
  ctx.fillStyle = cone;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-size * 0.04, 0);
    ctx.lineTo(-size * 0.7, -reach);
    ctx.quadraticCurveTo(0, -reach * 1.08, size * 0.7, -reach);
    ctx.lineTo(size * 0.04, 0);
    ctx.closePath();
  };
  shape();
  ctx.fill();
  if (look === 'chart') {
    // On paper the light is drawn as a navigator would: ink hatching and a darker edge that
    // fades with the light, so it holds its own against the chart.
    ctx.save();
    shape();
    ctx.clip();
    const hatch = ctx.createLinearGradient(0, 0, 0, -reach);
    hatch.addColorStop(0, 'rgba(122, 64, 0, 0.42)');
    hatch.addColorStop(1, 'rgba(122, 64, 0, 0)');
    ctx.strokeStyle = hatch;
    ctx.lineWidth = Math.max(0.8, size * 0.012);
    const step = Math.max(4, size * 0.09);
    for (let d = -reach; d < reach; d += step) {
      ctx.beginPath();
      ctx.moveTo(d - reach, 0);
      ctx.lineTo(d + reach, -reach * 2);
      ctx.stroke();
    }
    ctx.restore();
    const edge = ctx.createLinearGradient(0, 0, 0, -reach);
    edge.addColorStop(0, 'rgba(138, 74, 0, 0.85)');
    edge.addColorStop(1, 'rgba(138, 74, 0, 0)');
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(1, size * 0.018);
    ctx.beginPath();
    ctx.moveTo(-size * 0.04, 0);
    ctx.lineTo(-size * 0.7, -reach);
    ctx.moveTo(size * 0.04, 0);
    ctx.lineTo(size * 0.7, -reach);
    ctx.stroke();
  }
  ctx.restore();
}

/** The shield: a bubble around the hull, brighter the fuller it is, with a sheen running round it. */
function drawShield(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: Palette,
  look: Look,
  t: number,
  fraction: number,
) {
  const rx = size * 0.56;
  const ry = size * 0.66;
  const strength = 0.25 + 0.6 * Math.max(0, Math.min(1, fraction));
  ctx.save();
  ctx.globalAlpha = strength;
  if (look === 'night') {
    ctx.save();
    ctx.scale(1, ry / rx);
    const glow = ctx.createRadialGradient(0, 0, rx * 0.72, 0, 0, rx * 1.08);
    glow.addColorStop(0, 'rgba(128, 180, 255, 0)');
    glow.addColorStop(0.85, 'rgba(128, 180, 255, 0.22)');
    glow.addColorStop(1, 'rgba(128, 180, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 1.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = p.shield;
  ctx.lineWidth = Math.max(1, size * 0.022);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, size * 0.045);
  ctx.lineCap = 'round';
  // Two sheens running opposite ways round the bubble: the shield's shimmer.
  const sheen = t * 0.9;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, sheen, sheen + 0.7);
  ctx.stroke();
  ctx.globalAlpha = strength * 0.6;
  ctx.lineWidth = Math.max(1, size * 0.028);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, -sheen * 1.3 + 2.4, -sheen * 1.3 + 2.9);
  ctx.stroke();
  ctx.restore();
}

/** A gleaner: a hexagonal mining drone, its eye and its charge ring both showing its strength. */
export function drawGleaner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  p: Palette,
  look: Look,
  t: number,
  charge: number,
  seed: number,
) {
  const strength = Math.max(0.08, Math.min(1, charge));
  const radius = size * (0.22 + 0.1 * strength);
  const spin = t * 0.4 + seed;
  ctx.save();
  ctx.translate(x, y);
  if (look === 'night') {
    const glow = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 2);
    glow.addColorStop(0, p.gleanerGlow);
    glow.addColorStop(1, 'rgba(67, 227, 196, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mining arms, two prongs that idle open and shut.
  ctx.save();
  ctx.rotate(spin * 0.5);
  ctx.strokeStyle = look === 'night' ? '#6fb9ad' : p.gleaner;
  ctx.lineWidth = Math.max(1, size * 0.03);
  const open = 0.35 + 0.12 * Math.sin(t * 2 + seed);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * radius * 0.8, 0);
    ctx.lineTo(side * radius * 1.45, -radius * open);
    ctx.moveTo(side * radius * 0.8, 0);
    ctx.lineTo(side * radius * 1.45, radius * open);
    ctx.stroke();
  }
  ctx.restore();
  ctx.rotate(spin);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = Math.cos(a) * radius;
    const py = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = p.gleanerBody;
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.strokeStyle = p.gleaner;
  ctx.stroke();
  if (look === 'chart') {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(13, 122, 105, 0.35)';
    ctx.lineWidth = 1;
    for (let k = -radius; k < radius; k += size * 0.06) {
      ctx.beginPath();
      ctx.moveTo(k, -radius);
      ctx.lineTo(k + radius, radius);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.rotate(-spin);
  const eye = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.5);
  eye.addColorStop(0, look === 'night' ? '#e9fffa' : '#ffffff');
  eye.addColorStop(0.4, p.gleaner);
  eye.addColorStop(1, 'rgba(67, 227, 196, 0)');
  ctx.globalAlpha = 0.35 + 0.65 * strength;
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // The charge ring: a full circle is a fresh gleaner.
  ctx.strokeStyle = p.gleaner;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(1.5, size * 0.035);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.43, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * strength);
  ctx.stroke();
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.43, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  p: Palette,
  look: Look,
  t: number,
  seed: number,
) {
  const random = decorRandom(seed);
  const tint = random();
  const twinkle = 0.85 + 0.15 * Math.sin(t * (1.2 + random()) + seed);
  ctx.save();
  ctx.translate(x, y);
  if (look === 'night') {
    const core = tint < 0.33 ? '#cfe0ff' : tint < 0.66 ? '#fff4d8' : '#ffe0b8';
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.48);
    glow.addColorStop(0, core);
    glow.addColorStop(0.18, core);
    glow.addColorStop(0.45, p.starGlow);
    glow.addColorStop(1, 'rgba(170, 200, 255, 0)');
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = core;
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.beginPath();
    ctx.moveTo(-size * 0.36, 0);
    ctx.lineTo(size * 0.36, 0);
    ctx.moveTo(0, -size * 0.36);
    ctx.lineTo(0, size * 0.36);
    ctx.stroke();
  } else {
    ctx.strokeStyle = p.star;
    ctx.fillStyle = p.star;
    ctx.lineWidth = Math.max(1, size * 0.025);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      const r = i % 2 === 0 ? size * 0.3 : size * 0.14;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(a) * r, -Math.cos(a) * r);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  p: Palette,
  look: Look,
  t: number,
) {
  ctx.save();
  ctx.translate(x, y);
  const ring = size * 0.36;
  if (look === 'night') {
    const lens = ctx.createRadialGradient(0, 0, ring * 0.5, 0, 0, ring * 1.3);
    lens.addColorStop(0, '#000004');
    lens.addColorStop(0.55, '#000004');
    lens.addColorStop(0.7, 'rgba(138, 118, 255, 0.55)');
    lens.addColorStop(1, 'rgba(138, 118, 255, 0)');
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.arc(0, 0, ring * 1.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = p.hole;
    ctx.beginPath();
    ctx.arc(0, 0, ring * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.rotate(t * 0.5);
  ctx.strokeStyle = p.holeRing;
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, ring * (0.7 + i * 0.16), i * 2, i * 2 + 2.2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  p: Palette,
  look: Look,
  t: number,
  state: LightState,
  seed: number,
) {
  const random = decorRandom(seed + 7);
  ctx.save();
  ctx.translate(x, y);
  const lit = state === 'lit' || state === 'threatened';
  if (lit) {
    const halo = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 2.1);
    halo.addColorStop(0, p.worldGlow);
    halo.addColorStop(1, 'rgba(255, 196, 92, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  if (look === 'night') {
    const body = ctx.createRadialGradient(
      -radius * 0.35,
      -radius * 0.4,
      radius * 0.1,
      0,
      0,
      radius,
    );
    body.addColorStop(0, lit ? '#5d6fa8' : '#3a3550');
    body.addColorStop(1, lit ? '#1a2242' : p.worldDark);
    ctx.fillStyle = body;
  } else {
    ctx.fillStyle = state === 'lost' ? '#e3dccb' : lit ? '#f7d58e' : '#c9c2b0';
  }
  ctx.fill();
  ctx.lineWidth = Math.max(1, radius * 0.1);
  ctx.strokeStyle =
    look === 'night' ? (lit ? 'rgba(255, 215, 150, 0.7)' : 'rgba(150, 140, 190, 0.5)') : p.ink;
  ctx.stroke();
  if (lit) {
    // City lights on the night side, each its own small amber spark.
    ctx.fillStyle = look === 'night' ? p.world : p.lamp;
    for (let i = 0; i < 9; i++) {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * radius * 0.78;
      const flicker = look === 'night' ? 0.6 + 0.4 * Math.sin(t * 1.5 + i * 2.1) : 1;
      ctx.globalAlpha = flicker;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, Math.max(0.8, radius * 0.08), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (state === 'dark') {
    // The forge the gleaners built, glowing cold.
    const forge = ctx.createRadialGradient(
      radius * 0.25,
      radius * 0.1,
      0,
      radius * 0.25,
      radius * 0.1,
      radius * 0.5,
    );
    forge.addColorStop(0, p.gleaner);
    forge.addColorStop(1, 'rgba(67, 227, 196, 0)');
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.fillStyle = forge;
    ctx.beginPath();
    ctx.arc(radius * 0.25, radius * 0.1, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (state === 'lost') {
    ctx.strokeStyle = p.lost;
    ctx.lineWidth = Math.max(1, radius * 0.12);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.55, -radius * 0.55);
    ctx.lineTo(radius * 0.55, radius * 0.55);
    ctx.stroke();
  }
  if (state === 'threatened') {
    const pulse = (t * 0.8) % 1;
    ctx.strokeStyle = p.threatened;
    ctx.lineWidth = Math.max(1.5, radius * 0.12);
    ctx.globalAlpha = 1 - pulse;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (1.2 + pulse * 0.9), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawHarbour(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  p: Palette,
  look: Look,
  t: number,
) {
  ctx.save();
  ctx.translate(x, y);
  const r = size * 0.36;
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.strokeStyle = look === 'night' ? '#3d4f80' : p.ink;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.strokeStyle = p.harbour;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.rotate(t * 0.25);
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.fillStyle = p.harbourBody;
  ctx.strokeStyle = p.harbour;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const on = Math.sin(t * 2 + i) > 0;
    ctx.fillStyle = on ? (look === 'night' ? '#ffffff' : p.lamp) : p.harbour;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, Math.max(1, size * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A world as a light on the chart: a warm point with a halo, dark with a cold forge, or gone. */
export function drawLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  p: Palette,
  look: Look,
  t: number,
  state: LightState,
  seed: number,
) {
  ctx.save();
  ctx.translate(x, y);
  if (state === 'lit' || state === 'threatened') {
    const flicker = look === 'night' ? 0.88 + 0.12 * Math.sin(t * 1.7 + seed) : 1;
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.6);
    halo.addColorStop(
      0,
      look === 'night' ? 'rgba(255, 205, 110, 0.55)' : 'rgba(240, 165, 52, 0.45)',
    );
    halo.addColorStop(
      0.35,
      look === 'night' ? 'rgba(255, 190, 80, 0.18)' : 'rgba(240, 165, 52, 0.14)',
    );
    halo.addColorStop(1, 'rgba(255, 190, 80, 0)');
    ctx.globalAlpha = flicker;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    core.addColorStop(0, look === 'night' ? '#fffaf0' : '#fff7e6');
    core.addColorStop(0.45, look === 'night' ? '#ffd27a' : '#f5b347');
    core.addColorStop(1, look === 'night' ? '#e79a2c' : '#c36d0c');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    if (look === 'chart') {
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = Math.max(1, r * 0.22);
      ctx.stroke();
    }
    if (state === 'threatened') {
      const pulse = (t * 0.9) % 1;
      ctx.strokeStyle = p.threatened;
      ctx.lineWidth = Math.max(1.5, r * 0.35);
      ctx.globalAlpha = 1 - pulse;
      ctx.beginPath();
      ctx.arc(0, 0, r * (1.6 + pulse * 2.2), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (state === 'dark') {
    ctx.fillStyle = look === 'night' ? '#151227' : '#d8d0bd';
    ctx.strokeStyle = look === 'night' ? 'rgba(160, 150, 210, 0.6)' : p.ink2;
    ctx.lineWidth = Math.max(1, r * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3 + seed);
    ctx.fillStyle = p.gleaner;
    ctx.beginPath();
    ctx.arc(r * 0.15, r * 0.1, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = p.lost;
    ctx.lineWidth = Math.max(1, r * 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.moveTo(-r * 0.7, -r * 0.7);
    ctx.lineTo(r * 0.7, r * 0.7);
    ctx.stroke();
  }
  ctx.restore();
}
