import type { Look, Palette } from './palette';

/**
 * The keeper's ships, seen from above with the bow pointing up (north): the Lantern, a slim
 * corvette with swept radiator wings, an engine pod at each wingtip and a lighthouse lens in
 * her bow; and the Ember, the old tender, boxy and patched, with one big engine. Both are drawn
 * in units of the ship's length; the caller has already moved to the ship and turned her.
 */

/** Where the lens sits, as a share of the ship's length ahead of her centre. */
export const LANTERN_LENS = 0.37;
export const EMBER_LENS = 0.36;

interface Ink {
  hull: CanvasGradient | string;
  hullEdge: string;
  wing: string;
  wingEdge: string;
  metal: string;
  detail: string;
  window: string;
  keel: string;
  exhaust: [string, string];
}

function inks(
  ctx: CanvasRenderingContext2D,
  look: Look,
  p: Palette,
  u: number,
  ember: boolean,
): Ink {
  if (look === 'night') {
    const hull = ctx.createLinearGradient(-0.15 * u, 0, 0.15 * u, 0);
    if (ember) {
      hull.addColorStop(0, '#4a3a33');
      hull.addColorStop(0.42, '#8a6c58');
      hull.addColorStop(0.6, '#6a5446');
      hull.addColorStop(1, '#3a2d27');
    } else {
      hull.addColorStop(0, '#2b3762');
      hull.addColorStop(0.4, '#7487c6');
      hull.addColorStop(0.58, '#56679f');
      hull.addColorStop(1, '#232d52');
    }
    return {
      hull,
      hullEdge: ember ? 'rgba(255, 220, 190, 0.75)' : 'rgba(214, 226, 255, 0.85)',
      wing: ember ? '#3b302b' : '#1f2848',
      wingEdge: ember ? 'rgba(230, 190, 160, 0.7)' : 'rgba(170, 190, 245, 0.75)',
      metal: ember ? '#2a221e' : '#161d36',
      detail: ember ? 'rgba(255, 220, 190, 0.28)' : 'rgba(190, 205, 255, 0.3)',
      window: '#ffdca0',
      keel: p.lamp,
      exhaust: ember ? ['#ffe3b0', 'rgba(255, 140, 60, 0)'] : ['#e6f7ff', 'rgba(110, 190, 255, 0)'],
    };
  }
  return {
    hull: ember ? '#f3e7d0' : '#fbf6ea',
    hullEdge: p.ink,
    wing: ember ? '#ece0c6' : '#f4ecda',
    wingEdge: p.ink,
    metal: p.ink,
    detail: 'rgba(29, 39, 65, 0.42)',
    window: p.ink,
    keel: p.lamp,
    exhaust: ['rgba(242, 166, 50, 0.55)', 'rgba(242, 166, 50, 0)'],
  };
}

/** A soft jet of light behind an engine, a little longer and shorter as `t` runs. */
function exhaust(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  length: number,
  ink: Ink,
  t: number,
  phase: number,
) {
  const reach = length * (0.85 + 0.15 * Math.sin(t * 17 + phase));
  const jet = ctx.createLinearGradient(x, y, x, y + reach);
  jet.addColorStop(0, ink.exhaust[0]);
  jet.addColorStop(1, ink.exhaust[1]);
  ctx.fillStyle = jet;
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  ctx.quadraticCurveTo(x, y + reach * 1.3, x + width / 2, y);
  ctx.closePath();
  ctx.fill();
}

function hatch(ctx: CanvasRenderingContext2D, u: number, step: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.6, u * 0.006);
  for (let k = -0.6; k < 0.6; k += step) {
    ctx.beginPath();
    ctx.moveTo(k * u, -0.6 * u);
    ctx.lineTo((k + 0.6) * u, 0);
    ctx.stroke();
  }
}

function runningLights(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  look: Look,
  p: Palette,
  t: number,
) {
  const on = look === 'chart' || Math.sin(t * 3) > -0.4;
  const r = Math.max(1, u * 0.018);
  for (const [side, color] of [
    [-1, look === 'night' ? '#ff6b6b' : p.danger],
    [1, look === 'night' ? '#6bffb0' : p.good],
  ] as const) {
    if (look === 'night' && on) {
      const glow = ctx.createRadialGradient(side * x, y, 0, side * x, y, r * 4);
      glow.addColorStop(0, color);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(side * x, y, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = on ? 1 : 0.35;
    ctx.beginPath();
    ctx.arc(side * x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function drawLantern(
  ctx: CanvasRenderingContext2D,
  u: number,
  p: Palette,
  look: Look,
  t: number,
) {
  const ink = inks(ctx, look, p, u, false);
  const line = Math.max(1, u * (look === 'night' ? 0.012 : 0.017));

  exhaust(ctx, 0, 0.47 * u, 0.11 * u, 0.26 * u, ink, t, 0);
  for (const side of [-1, 1])
    exhaust(ctx, side * 0.4 * u, 0.42 * u, 0.065 * u, 0.2 * u, ink, t, side * 2);

  drawLanternWings(ctx, u, p, look, ink, line);
  drawLanternPods(ctx, u, look, ink, line);

  // Canards either side of the neck.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.07 * u, -0.25 * u);
    ctx.lineTo(side * 0.16 * u, -0.18 * u);
    ctx.lineTo(side * 0.16 * u, -0.14 * u);
    ctx.lineTo(side * 0.1 * u, -0.15 * u);
    ctx.closePath();
    ctx.fillStyle = ink.wing;
    ctx.fill();
    ctx.strokeStyle = ink.wingEdge;
    ctx.lineWidth = line;
    ctx.stroke();
  }

  // The hull: a slim neck carrying the lamp room, widening to the engines.
  ctx.beginPath();
  ctx.moveTo(0.045 * u, -0.3 * u);
  ctx.lineTo(0.13 * u, -0.08 * u);
  ctx.lineTo(0.14 * u, 0.24 * u);
  ctx.quadraticCurveTo(0.14 * u, 0.4 * u, 0.08 * u, 0.46 * u);
  ctx.lineTo(-0.08 * u, 0.46 * u);
  ctx.quadraticCurveTo(-0.14 * u, 0.4 * u, -0.14 * u, 0.24 * u);
  ctx.lineTo(-0.13 * u, -0.08 * u);
  ctx.lineTo(-0.045 * u, -0.3 * u);
  ctx.closePath();
  ctx.fillStyle = ink.hull;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (look === 'chart') hatch(ctx, u, 0.06, 'rgba(29, 39, 65, 0.1)');
  ctx.strokeStyle = ink.detail;
  ctx.lineWidth = Math.max(0.6, u * 0.007);
  for (const y of [0.14, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(-0.15 * u, y * u);
    ctx.lineTo(0.15 * u, y * u);
    ctx.stroke();
  }
  // Rows of portholes down each flank.
  ctx.fillStyle = look === 'night' ? ink.window : 'rgba(29, 39, 65, 0.6)';
  for (const y of [0.05, 0.1, 0.19, 0.24]) {
    for (const side of [-1, 1])
      ctx.fillRect(side * 0.105 * u - 0.006 * u, y * u, 0.012 * u, 0.02 * u);
  }
  ctx.restore();
  ctx.strokeStyle = ink.hullEdge;
  ctx.lineWidth = line;
  ctx.stroke();

  // The keeper's amber keel line, from the bridge to the engines.
  ctx.strokeStyle = ink.keel;
  ctx.lineWidth = Math.max(1, u * 0.014);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0.1 * u);
  ctx.lineTo(0, 0.38 * u);
  ctx.stroke();
  ctx.lineCap = 'butt';

  drawBridge(ctx, u, look, ink, line);

  // The main engine block at the stern.
  ctx.fillStyle = ink.metal;
  ctx.fillRect(-0.08 * u, 0.42 * u, 0.16 * u, 0.05 * u);
  ctx.fillStyle = ink.exhaust[0];
  ctx.fillRect(-0.06 * u, 0.455 * u, 0.12 * u, 0.02 * u);

  drawLampRoom(ctx, -LANTERN_LENS * u, 0.095 * u, look, p, ink, u);
  runningLights(ctx, 0.44 * u, 0.3 * u, u, look, p, t);
}

/** Swept radiator wings, lighter at the root, with an amber trim on the trailing edge. */
function drawLanternWings(
  ctx: CanvasRenderingContext2D,
  u: number,
  p: Palette,
  look: Look,
  ink: Ink,
  line: number,
) {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.12 * u, -0.05 * u);
    ctx.lineTo(side * 0.36 * u, 0.15 * u);
    ctx.lineTo(side * 0.44 * u, 0.2 * u);
    ctx.lineTo(side * 0.45 * u, 0.32 * u);
    ctx.lineTo(side * 0.13 * u, 0.31 * u);
    ctx.closePath();
    if (look === 'night') {
      const wash = ctx.createLinearGradient(side * 0.12 * u, 0, side * 0.45 * u, 0);
      wash.addColorStop(0, '#43538a');
      wash.addColorStop(1, '#283461');
      ctx.fillStyle = wash;
    } else {
      ctx.fillStyle = '#e6dbc2';
    }
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (look === 'chart') hatch(ctx, u, 0.03, 'rgba(29, 39, 65, 0.22)');
    ctx.strokeStyle = ink.detail;
    ctx.lineWidth = Math.max(0.6, u * 0.007);
    for (let k = 0; k < 3; k++) {
      const offset = 0.06 + k * 0.05;
      ctx.beginPath();
      ctx.moveTo(side * 0.14 * u, (-0.02 + offset) * u);
      ctx.lineTo(side * 0.38 * u, (0.19 + offset * 0.5) * u);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = ink.wingEdge;
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.strokeStyle = p.lamp;
    ctx.lineWidth = Math.max(1, u * 0.012);
    ctx.beginPath();
    ctx.moveTo(side * 0.16 * u, 0.29 * u);
    ctx.lineTo(side * 0.36 * u, 0.3 * u);
    ctx.stroke();
  }
}

/** An engine pod at each wingtip: an intake cone, a ribbed body and a nozzle. */
function drawLanternPods(
  ctx: CanvasRenderingContext2D,
  u: number,
  look: Look,
  ink: Ink,
  line: number,
) {
  for (const side of [-1, 1]) {
    const x = side * 0.4 * u;
    const w = 0.045 * u;
    ctx.beginPath();
    ctx.moveTo(x, 0.04 * u);
    ctx.lineTo(x + w, 0.13 * u);
    ctx.lineTo(x + w, 0.38 * u);
    ctx.lineTo(x + w * 0.75, 0.42 * u);
    ctx.lineTo(x - w * 0.75, 0.42 * u);
    ctx.lineTo(x - w, 0.38 * u);
    ctx.lineTo(x - w, 0.13 * u);
    ctx.closePath();
    if (look === 'night') {
      const metal = ctx.createLinearGradient(x - w, 0, x + w, 0);
      metal.addColorStop(0, '#2c3962');
      metal.addColorStop(0.45, '#7083c0');
      metal.addColorStop(1, '#27325a');
      ctx.fillStyle = metal;
    } else {
      ctx.fillStyle = '#fbf6ea';
    }
    ctx.fill();
    ctx.strokeStyle = ink.hullEdge;
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.strokeStyle = ink.detail;
    ctx.lineWidth = Math.max(0.6, u * 0.007);
    for (const y of [0.17, 0.24, 0.31]) {
      ctx.beginPath();
      ctx.moveTo(x - w, y * u);
      ctx.lineTo(x + w, y * u);
      ctx.stroke();
    }
    ctx.fillStyle = ink.exhaust[0];
    ctx.fillRect(x - w * 0.6, 0.405 * u, w * 1.2, 0.016 * u);
  }
}

/** The bridge: a raised block with a dark canopy across its front. */
function drawBridge(ctx: CanvasRenderingContext2D, u: number, look: Look, ink: Ink, line: number) {
  ctx.beginPath();
  ctx.roundRect(-0.07 * u, -0.09 * u, 0.14 * u, 0.13 * u, 0.03 * u);
  ctx.fillStyle = look === 'night' ? '#5b6da8' : '#f6eedd';
  ctx.fill();
  ctx.strokeStyle = ink.hullEdge;
  ctx.lineWidth = line;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-0.055 * u, -0.08 * u, 0.11 * u, 0.032 * u, 0.016 * u);
  ctx.fillStyle = look === 'night' ? '#0d1430' : '#1d2741';
  ctx.fill();
  if (look === 'night') {
    ctx.fillStyle = 'rgba(255, 220, 160, 0.85)';
    for (const x of [-0.04, -0.013, 0.013, 0.04]) {
      ctx.fillRect((x - 0.006) * u, -0.071 * u, 0.012 * u, 0.014 * u);
    }
  }
}

/**
 * The lamp room at the bow, as on a lighthouse: an octagonal frame with glazing bars around a
 * glowing Fresnel lens.
 */
function drawLampRoom(
  ctx: CanvasRenderingContext2D,
  y: number,
  radius: number,
  look: Look,
  p: Palette,
  ink: Ink,
  u: number,
) {
  const octagon = () => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (Math.PI / 4) * i;
      const px = Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  if (look === 'night') {
    const halo = ctx.createRadialGradient(0, y, radius * 0.3, 0, y, radius * 2.4);
    halo.addColorStop(0, 'rgba(255, 210, 120, 0.5)');
    halo.addColorStop(1, 'rgba(255, 210, 120, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, y, radius * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  octagon();
  ctx.fillStyle = ink.metal;
  ctx.fill();
  const lensRadius = radius * 0.72;
  const glass = ctx.createRadialGradient(0, y, 0, 0, y, lensRadius);
  glass.addColorStop(0, look === 'night' ? '#fffdf2' : '#fff6de');
  glass.addColorStop(0.5, look === 'night' ? '#ffd27a' : p.lampSoft);
  glass.addColorStop(1, look === 'night' ? '#e8962a' : p.lamp);
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.arc(0, y, lensRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = look === 'night' ? 'rgba(150, 80, 10, 0.5)' : 'rgba(120, 60, 0, 0.55)';
  ctx.lineWidth = Math.max(0.5, u * 0.004);
  for (const ring of [0.4, 0.7]) {
    ctx.beginPath();
    ctx.arc(0, y, lensRadius * ring, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Glazing bars, then the frame.
  ctx.strokeStyle = look === 'night' ? 'rgba(20, 26, 50, 0.75)' : 'rgba(29, 39, 65, 0.7)';
  ctx.lineWidth = Math.max(0.6, u * 0.007);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (Math.PI / 4) * i;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * lensRadius * 0.55, y + Math.sin(a) * lensRadius * 0.55);
    ctx.lineTo(Math.cos(a) * radius, y + Math.sin(a) * radius);
    ctx.stroke();
  }
  octagon();
  ctx.strokeStyle = ink.hullEdge;
  ctx.lineWidth = Math.max(1, u * 0.014);
  ctx.stroke();
}

export function drawEmber(
  ctx: CanvasRenderingContext2D,
  u: number,
  p: Palette,
  look: Look,
  t: number,
) {
  const ink = inks(ctx, look, p, u, true);
  const line = Math.max(0.8, u * (look === 'night' ? 0.012 : 0.017));

  exhaust(ctx, 0, 0.45 * u, 0.16 * u, 0.26 * u, ink, t, 1);

  // Cargo pods slung either side.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(side > 0 ? 0.16 * u : -0.27 * u, -0.12 * u, 0.11 * u, 0.36 * u, 0.025 * u);
    ctx.fillStyle = ink.wing;
    ctx.fill();
    ctx.strokeStyle = ink.wingEdge;
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.strokeStyle = ink.detail;
    for (const y of [-0.04, 0.05, 0.14]) {
      ctx.beginPath();
      ctx.moveTo((side > 0 ? 0.16 : -0.27) * u, y * u);
      ctx.lineTo((side > 0 ? 0.27 : -0.16) * u, y * u);
      ctx.stroke();
    }
  }

  // A boxy hull with chamfered corners.
  ctx.beginPath();
  ctx.moveTo(-0.09 * u, -0.42 * u);
  ctx.lineTo(0.09 * u, -0.42 * u);
  ctx.lineTo(0.16 * u, -0.31 * u);
  ctx.lineTo(0.16 * u, 0.36 * u);
  ctx.lineTo(0.12 * u, 0.44 * u);
  ctx.lineTo(-0.12 * u, 0.44 * u);
  ctx.lineTo(-0.16 * u, 0.36 * u);
  ctx.lineTo(-0.16 * u, -0.31 * u);
  ctx.closePath();
  ctx.fillStyle = ink.hull;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (look === 'chart') hatch(ctx, u, 0.04, 'rgba(29, 39, 65, 0.16)');
  // Patched plates from a long working life.
  ctx.fillStyle = look === 'night' ? 'rgba(30, 22, 18, 0.45)' : 'rgba(29, 39, 65, 0.1)';
  ctx.fillRect(0.02 * u, -0.05 * u, 0.1 * u, 0.12 * u);
  ctx.fillRect(-0.13 * u, 0.16 * u, 0.09 * u, 0.1 * u);
  ctx.strokeStyle = ink.detail;
  ctx.lineWidth = Math.max(0.6, u * 0.007);
  for (const y of [-0.18, 0.02, 0.22]) {
    ctx.beginPath();
    ctx.moveTo(-0.17 * u, y * u);
    ctx.lineTo(0.17 * u, y * u);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = ink.hullEdge;
  ctx.lineWidth = line;
  ctx.stroke();

  ctx.fillStyle = ink.window;
  for (const x of [-0.07, -0.025, 0.02, 0.065]) ctx.fillRect(x * u, -0.2 * u, 0.014 * u, 0.02 * u);

  ctx.fillStyle = ink.metal;
  ctx.fillRect(-0.1 * u, 0.4 * u, 0.2 * u, 0.06 * u);
  ctx.fillStyle = ink.exhaust[0];
  ctx.fillRect(-0.08 * u, 0.44 * u, 0.16 * u, 0.022 * u);

  drawLampRoom(ctx, -EMBER_LENS * u, 0.075 * u, look, p, ink, u);
  runningLights(ctx, 0.27 * u, 0.2 * u, u, look, p, t);
}
