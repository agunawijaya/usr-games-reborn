import type { PosterArt, PosterFrame } from '../art';
import { cachedLayer, layerKey } from '../cache';
import {
  type Composition,
  compose,
  glow,
  linear,
  pixelRatio,
  radial,
  scatter,
  type Speck,
  TAU,
  vignette,
  withOpacity,
} from '../shapes';

/**
 * Placeholder key art for sail, drawn by the Hall until the game supplies its own poster().
 *
 * A ship of the line heels under full sail on a rolling sea, lit from the right: a low golden
 * sun by day, the moon by night. A distant enemy fires from the horizon. The ship sits right of
 * centre so the Console Home title can take the calm, darker water bottom-left.
 */

interface SailPalette {
  sky: readonly [string, string, string, string];
  light: string;
  lightGlow: string;
  cloud: readonly [shadow: string, body: string, lit: string];
  sea: readonly [string, string, string, string];
  reflection: string;
  crest: string;
  trough: string;
  glitter: string;
  sailLit: string;
  sailMid: string;
  sailShade: string;
  hullTop: string;
  hullBottom: string;
  strake: string;
  rope: string;
  window: string;
  rim: string;
  smoke: string;
  flash: string;
  haze: string;
  enemy: string;
}

const DAY: SailPalette = {
  sky: ['#16396a', '#4a6aa4', '#e39565', '#ffd59c'],
  light: '#fffaeb',
  lightGlow: '#ffb35a',
  cloud: ['#8c5d73', '#d89080', '#ffe2b8'],
  sea: ['#e7a26a', '#4a7d9c', '#1d4d6e', '#0c2a41'],
  reflection: '#ffd08a',
  crest: '#ffe6bd',
  trough: '#0b2438',
  glitter: '#fff6d8',
  sailLit: '#fff5e0',
  sailMid: '#ecd0a4',
  sailShade: '#9a7657',
  hullTop: '#744220',
  hullBottom: '#28140a',
  strake: '#d79d48',
  rope: '#2a1a10',
  window: '#3a2412',
  rim: '#ffcf8a',
  smoke: '#efe0d0',
  flash: '#ffb04a',
  haze: '#ffc98e',
  enemy: '#9d6f73',
};

const NIGHT: SailPalette = {
  sky: ['#02060f', '#091531', '#1b2f5e', '#2e4a82'],
  light: '#f7f4ea',
  lightGlow: '#8ea8ff',
  cloud: ['#070d1e', '#17223f', '#8fa3d4'],
  sea: ['#2d4a80', '#162c5a', '#0a1838', '#040a1c'],
  reflection: '#b9c9f2',
  crest: '#b3c5ec',
  trough: '#02060f',
  glitter: '#f1f5ff',
  sailLit: '#e8eefa',
  sailMid: '#a3b1cc',
  sailShade: '#3f4a66',
  hullTop: '#3b3645',
  hullBottom: '#0d0b12',
  strake: '#857b5d',
  rope: '#0a0910',
  window: '#ffc56a',
  rim: '#d4e0ff',
  smoke: '#8d98b6',
  flash: '#ffb04a',
  haze: '#4c69aa',
  enemy: '#2c3d66',
};

interface SailScene {
  c: Composition;
  horizon: number;
  lightX: number;
  lightY: number;
  lightR: number;
  shipX: number;
  waterline: number;
  /** Mast height: the unit the ship is drawn in. */
  u: number;
  enemyX: number;
}

function layout(width: number, height: number, day: boolean): SailScene {
  const c = compose(width, height);
  const horizon = c.portrait ? height * 0.5 : height * 0.58;
  const u = c.portrait ? Math.min(height * 0.52, width * 0.8) : height * 0.7;
  return {
    c,
    horizon,
    lightX: c.portrait ? width * 0.78 : width * 0.85,
    lightY: day ? horizon - height * 0.1 : height * (c.portrait ? 0.15 : 0.2),
    lightR: c.unit * (day ? 0.075 : 0.052),
    shipX: c.portrait ? width * 0.5 : width * 0.62,
    waterline: horizon + height * (c.portrait ? 0.2 : 0.21),
    u,
    enemyX: c.portrait ? width * 0.14 : width * 0.33,
  };
}

// ---- Sky and sea floor: painted once per size into a cached layer.

function seaGradient(context: CanvasRenderingContext2D, s: SailScene, p: SailPalette) {
  return linear(context, 0, s.horizon, 0, s.c.height, [
    [0, p.sea[0]],
    [0.12, p.sea[1]],
    [0.45, p.sea[2]],
    [1, p.sea[3]],
  ]);
}

function paintBackdrop(
  context: CanvasRenderingContext2D,
  s: SailScene,
  p: SailPalette,
  day: boolean,
) {
  const { width, height } = s.c;
  context.fillStyle = linear(context, 0, 0, 0, s.horizon, [
    [0, p.sky[0]],
    [0.45, p.sky[1]],
    [0.82, p.sky[2]],
    [1, p.sky[3]],
  ]);
  context.fillRect(0, 0, width, s.horizon + 1);
  context.fillStyle = radial(context, s.lightX, s.lightY, 0, s.c.unit * 1.25, [
    [0, withOpacity(p.lightGlow, day ? 0.8 : 0.4)],
    [0.35, withOpacity(p.lightGlow, day ? 0.24 : 0.1)],
    [1, withOpacity(p.lightGlow, 0)],
  ]);
  context.fillRect(0, 0, width, s.horizon + 1);
  if (!day) paintStars(context, s);
  paintClouds(context, s, p, day);
  paintLight(context, s, p, day);
  context.fillStyle = seaGradient(context, s, p);
  context.fillRect(0, s.horizon, width, height - s.horizon);
  // The light's long reflection on the water.
  context.save();
  context.beginPath();
  context.rect(0, s.horizon, width, height - s.horizon);
  context.clip();
  context.fillStyle = radial(context, s.lightX, s.horizon, 0, height * 0.9, [
    [0, withOpacity(p.reflection, day ? 0.55 : 0.4)],
    [1, withOpacity(p.reflection, 0)],
  ]);
  context.translate(s.lightX, s.horizon);
  context.scale(0.16, 1);
  context.translate(-s.lightX, -s.horizon);
  context.fillRect(s.lightX - height * 4, s.horizon, height * 8, height);
  context.restore();
  paintEnemy(context, s, p);
  context.fillStyle = linear(context, 0, s.horizon - height * 0.06, 0, s.horizon + height * 0.05, [
    [0, withOpacity(p.haze, 0)],
    [0.55, withOpacity(p.haze, day ? 0.4 : 0.3)],
    [1, withOpacity(p.haze, 0)],
  ]);
  context.fillRect(0, s.horizon - height * 0.06, width, height * 0.11);
}

function paintStars(context: CanvasRenderingContext2D, s: SailScene) {
  for (const star of scatter('sail-stars', 220)) {
    const y = star.y ** 1.5 * s.horizon * 0.95;
    context.fillStyle = withOpacity('#ffffff', 0.2 + star.size * 0.65);
    const size = star.size > 0.95 ? 2 : star.size > 0.7 ? 1.4 : 1;
    context.fillRect(star.x * s.c.width, y, size, size);
  }
}

function paintLight(context: CanvasRenderingContext2D, s: SailScene, p: SailPalette, day: boolean) {
  glow(context, s.lightX, s.lightY, s.lightR * (day ? 4.5 : 5), p.lightGlow, day ? 0.95 : 0.6);
  glow(context, s.lightX, s.lightY, s.lightR * 1.8, p.light, day ? 0.8 : 0.45);
  context.fillStyle = p.light;
  context.beginPath();
  context.arc(s.lightX, s.lightY, s.lightR, 0, TAU);
  context.fill();
  if (day) return;
  // Maria on the moon, faint.
  context.fillStyle = withOpacity('#b9b6ab', 0.55);
  for (const [dx, dy, r] of [
    [-0.32, -0.22, 0.3],
    [0.18, 0.08, 0.24],
    [-0.08, 0.36, 0.16],
    [0.3, -0.35, 0.12],
  ] as const) {
    context.beginPath();
    context.arc(s.lightX + dx * s.lightR, s.lightY + dy * s.lightR, r * s.lightR, 0, TAU);
    context.fill();
  }
}

/**
 * Cloud banks as painted masses: a darker underside, the body, then a lit crown toward the sun
 * or moon, each softened with a blur. Blur is fine here: the sky is painted once, not per frame.
 */
function paintClouds(
  context: CanvasRenderingContext2D,
  s: SailScene,
  p: SailPalette,
  day: boolean,
) {
  const { width } = s.c;
  const banks = scatter('sail-clouds', s.c.portrait ? 4 : 6);
  banks.forEach((bank, index) => {
    const cx = width * (0.05 + bank.x * 0.9);
    const cy = s.horizon * (0.18 + bank.y * 0.55);
    const length = width * (s.c.portrait ? 0.5 : 0.22) * (0.7 + bank.size * 0.8);
    const thickness = s.c.height * (0.03 + bank.size * 0.035);
    const puffs = scatter(`sail-cloud-${index}`, 14);
    const toward = Math.sign(s.lightX - cx) || 1;
    const layers: [dx: number, dy: number, shrink: number, color: string, alpha: number][] = [
      [0, thickness * 0.35, 1, p.cloud[0], day ? 0.55 : 0.8],
      [0, 0, 0.92, p.cloud[1], day ? 0.75 : 0.85],
      [toward * length * 0.04, -thickness * 0.3, 0.55, p.cloud[2], day ? 0.55 : 0.28],
    ];
    for (const [dx, dy, shrink, color, alpha] of layers) {
      context.save();
      context.filter = `blur(${Math.max(1, thickness * 0.28).toFixed(1)}px)`;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.beginPath();
      for (const puff of puffs) {
        const px = cx + dx + (puff.x - 0.5) * length;
        const py =
          cy +
          dy +
          (puff.y - 0.5) * thickness * 0.8 -
          Math.cos((puff.x - 0.5) * Math.PI) * thickness * 0.4;
        const rx = thickness * (0.9 + puff.size * 1.4) * shrink;
        context.moveTo(px + rx, py);
        context.ellipse(px, py, rx, rx * 0.55, 0, 0, TAU);
      }
      context.fill();
      context.restore();
    }
  });
}

/** A small, hazy silhouette on the horizon: the enemy the smoke comes from. */
function paintEnemy(context: CanvasRenderingContext2D, s: SailScene, p: SailPalette) {
  const u = s.u * 0.13;
  const x = s.enemyX;
  const y = s.horizon + u * 0.03;
  context.fillStyle = p.enemy;
  context.beginPath();
  context.moveTo(x - u * 0.5, y - u * 0.14);
  context.quadraticCurveTo(x, y - u * 0.08, x + u * 0.5, y - u * 0.16);
  context.lineTo(x + u * 0.42, y);
  context.lineTo(x - u * 0.44, y);
  context.closePath();
  context.fill();
  for (const [mx, height, width] of [
    [-0.28, 0.78, 0.26],
    [0, 1, 0.32],
    [0.26, 0.86, 0.28],
  ] as const) {
    context.fillRect(x + mx * u - u * 0.008, y - height * u, u * 0.016, height * u);
    for (let tier = 0; tier < 3; tier++) {
      const top = y - height * u + tier * height * u * 0.27 + u * 0.03;
      const w = width * u * (1 - tier * 0.1);
      context.beginPath();
      context.moveTo(x + mx * u - w / 2, top);
      context.quadraticCurveTo(x + mx * u, top - u * 0.02, x + mx * u + w / 2, top);
      context.quadraticCurveTo(
        x + mx * u + w * 0.55,
        top + height * u * 0.12,
        x + mx * u + w * 0.46,
        top + height * u * 0.22,
      );
      context.lineTo(x + mx * u - w * 0.46, top + height * u * 0.22);
      context.closePath();
      context.fill();
    }
  }
}

// ---- The ship, painted once per size into its own layer and rolled each frame.

function sailPath(
  context: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  width: number,
  belly: number,
) {
  const half = width / 2;
  const middle = (top + bottom) / 2;
  context.beginPath();
  context.moveTo(x - half, top);
  context.quadraticCurveTo(x, top - belly * 0.3, x + half, top);
  context.quadraticCurveTo(x + half + belly * 0.55, middle, x + half * 1.08, bottom);
  context.quadraticCurveTo(x + belly * 0.25, bottom + belly, x - half * 1.06, bottom);
  context.quadraticCurveTo(x - half - belly * 0.25, middle, x - half, top);
  context.closePath();
}

function paintSquareSail(
  context: CanvasRenderingContext2D,
  p: SailPalette,
  x: number,
  top: number,
  bottom: number,
  width: number,
) {
  const height = bottom - top;
  const belly = height * 0.24;
  sailPath(context, x, top, bottom, width, belly);
  // Lit from the right; the far edge falls into shade.
  context.fillStyle = linear(context, x - width / 2, 0, x + width / 2, 0, [
    [0, p.sailShade],
    [0.32, p.sailMid],
    [0.72, p.sailLit],
    [0.92, p.sailLit],
    [1, p.sailMid],
  ]);
  context.fill();
  context.save();
  context.clip();
  // The belly: a soft highlight where the cloth swells toward the light, shade under the yard.
  context.fillStyle = radial(context, x + width * 0.16, top + height * 0.58, 0, width * 0.55, [
    [0, withOpacity(p.sailLit, 0.55)],
    [1, withOpacity(p.sailLit, 0)],
  ]);
  context.fillRect(x - width, top - belly, width * 2, height + belly * 2);
  context.fillStyle = linear(context, 0, top, 0, top + height * 0.3, [
    [0, withOpacity(p.sailShade, 0.45)],
    [1, withOpacity(p.sailShade, 0)],
  ]);
  context.fillRect(x - width, top - belly, width * 2, height * 0.35 + belly);
  context.strokeStyle = withOpacity(p.sailShade, 0.22);
  context.lineWidth = Math.max(0.5, width * 0.005);
  for (let seam = 1; seam < 7; seam++) {
    const sx = x - width / 2 + (width * seam) / 7;
    context.beginPath();
    context.moveTo(sx, top);
    context.quadraticCurveTo(
      sx + belly * 0.2,
      (top + bottom) / 2,
      sx + (sx - x) * 0.07,
      bottom + belly * 0.85,
    );
    context.stroke();
  }
  context.restore();
  context.strokeStyle = withOpacity(p.rim, 0.9);
  context.lineWidth = Math.max(0.8, width * 0.016);
  context.beginPath();
  context.moveTo(x + width / 2, top);
  context.quadraticCurveTo(
    x + width / 2 + belly * 0.55,
    (top + bottom) / 2,
    x + width * 0.54,
    bottom,
  );
  context.stroke();
  context.strokeStyle = p.rope;
  context.lineWidth = Math.max(1, width * 0.022);
  context.beginPath();
  context.moveTo(x - width * 0.58, top);
  context.lineTo(x + width * 0.58, top);
  context.stroke();
}

function paintHull(
  context: CanvasRenderingContext2D,
  p: SailPalette,
  u: number,
  L: number,
  day: boolean,
) {
  const deck = (x: number) => -0.16 * u - 0.075 * u * Math.pow(Math.abs(x) / (0.5 * L), 2.4);
  context.beginPath();
  context.moveTo(-0.5 * L, -0.29 * u);
  context.lineTo(-0.43 * L, -0.27 * u);
  for (let i = -0.4; i <= 0.44; i += 0.04) context.lineTo(i * L, deck(i * L));
  context.lineTo(0.48 * L, -0.2 * u);
  context.quadraticCurveTo(0.56 * L, -0.08 * u, 0.44 * L, 0.04 * u);
  context.lineTo(-0.42 * L, 0.04 * u);
  context.quadraticCurveTo(-0.53 * L, -0.1 * u, -0.5 * L, -0.29 * u);
  context.closePath();
  context.fillStyle = linear(context, 0, -0.3 * u, 0, 0.04 * u, [
    [0, p.hullTop],
    [0.6, p.hullBottom],
    [1, p.hullBottom],
  ]);
  context.fill();
  context.save();
  context.clip();
  // Two gun decks, each a painted strake with its row of ports.
  for (const drop of [0.045, 0.095]) {
    context.strokeStyle = p.strake;
    context.lineWidth = u * 0.02;
    context.beginPath();
    for (let i = -0.47; i <= 0.48; i += 0.02) {
      const y = deck(i * L) + drop * u;
      if (i <= -0.469) context.moveTo(i * L, y);
      else context.lineTo(i * L, y);
    }
    context.stroke();
    context.fillStyle = withOpacity('#000000', 0.6);
    for (let port = 0; port < 13; port++) {
      const x = (-0.38 + port * 0.063) * L;
      const size = u * 0.014;
      context.fillRect(x - size / 2, deck(x) + drop * u - size / 2, size, size);
    }
  }
  context.fillStyle = linear(context, 0.05 * L, 0, 0.55 * L, 0, [
    [0, withOpacity(p.rim, 0)],
    [1, withOpacity(p.rim, day ? 0.38 : 0.22)],
  ]);
  context.fillRect(0.05 * L, -0.32 * u, 0.5 * L, 0.4 * u);
  context.restore();
  // Rim light along the rail.
  context.strokeStyle = withOpacity(p.rim, day ? 0.7 : 0.55);
  context.lineWidth = Math.max(0.8, u * 0.005);
  context.beginPath();
  for (let i = -0.43; i <= 0.47; i += 0.03) {
    if (i <= -0.429) context.moveTo(i * L, deck(i * L));
    else context.lineTo(i * L, deck(i * L));
  }
  context.stroke();
  // Stern gallery windows: dark by day, lamplit by night.
  for (let row = 0; row < 2; row++) {
    for (let w = 0; w < 4; w++) {
      const x = (-0.49 + w * 0.021) * L;
      const y = (-0.255 + row * 0.045) * u;
      if (!day) glow(context, x, y, u * 0.035, p.window, 0.55);
      context.fillStyle = p.window;
      context.fillRect(x - u * 0.006, y - u * 0.01, u * 0.012, u * 0.02);
    }
  }
}

function paintShip(context: CanvasRenderingContext2D, p: SailPalette, u: number, day: boolean) {
  const L = 1.1 * u;
  const masts = [
    { x: -0.3 * L, height: 0.8 * u, widths: [0.24, 0.2, 0.15] },
    { x: 0.0 * L, height: u, widths: [0.37, 0.32, 0.25, 0.17] },
    { x: 0.28 * L, height: 0.9 * u, widths: [0.34, 0.29, 0.22, 0.15] },
  ];
  const [mizzen, main, fore] = masts as [(typeof masts)[0], (typeof masts)[0], (typeof masts)[0]];
  context.lineCap = 'round';
  context.strokeStyle = withOpacity(p.rope, 0.75);
  context.lineWidth = Math.max(0.5, u * 0.0035);
  context.beginPath();
  context.moveTo(0.74 * L, -0.36 * u);
  context.lineTo(fore.x, -fore.height);
  context.lineTo(main.x, -main.height);
  context.lineTo(mizzen.x, -mizzen.height);
  context.lineTo(-0.52 * L, -0.3 * u);
  for (const mast of masts) {
    for (const side of [-1, 1]) {
      for (let line = 0; line < 4; line++) {
        context.moveTo(mast.x + side * (0.03 + line * 0.02) * L, -0.17 * u);
        context.lineTo(mast.x, -mast.height * 0.45);
      }
    }
  }
  context.stroke();
  context.strokeStyle = p.rope;
  context.lineWidth = u * 0.013;
  context.beginPath();
  context.moveTo(0.46 * L, -0.2 * u);
  context.lineTo(0.76 * L, -0.37 * u);
  for (const mast of masts) {
    context.moveTo(mast.x, -0.16 * u);
    context.lineTo(mast.x, -mast.height - u * 0.04);
  }
  context.stroke();
  for (const [tipX, tipY, headY] of [
    [0.74, -0.35, 0.64],
    [0.63, -0.3, 0.52],
  ] as const) {
    context.beginPath();
    context.moveTo(fore.x + L * 0.02, -fore.height * headY);
    context.quadraticCurveTo(fore.x + L * 0.27, -fore.height * headY * 0.6, tipX * L, tipY * u);
    context.lineTo(fore.x + L * 0.07, -0.25 * u);
    context.closePath();
    context.fillStyle = linear(context, fore.x, 0, tipX * L, 0, [
      [0, p.sailMid],
      [1, p.sailLit],
    ]);
    context.fill();
  }
  context.beginPath();
  context.moveTo(mizzen.x, -0.25 * u);
  context.lineTo(mizzen.x - 0.23 * L, -0.25 * u);
  context.quadraticCurveTo(mizzen.x - 0.22 * L, -0.4 * u, mizzen.x - 0.17 * L, -0.53 * u);
  context.lineTo(mizzen.x, -0.6 * u);
  context.closePath();
  context.fillStyle = linear(context, mizzen.x - 0.23 * L, 0, mizzen.x, 0, [
    [0, p.sailShade],
    [1, p.sailMid],
  ]);
  context.fill();
  for (const mast of masts) {
    const first = mast === mizzen ? 0.62 : 0.24;
    const span = (mast.height * 0.97 - first * u) / mast.widths.length;
    mast.widths.forEach((width, tier) => {
      const bottom = -(first * u + tier * span);
      paintSquareSail(
        context,
        p,
        mast.x + tier * u * 0.012,
        bottom - span * 0.9,
        bottom,
        width * L,
      );
    });
    const topY = -mast.height - u * 0.04;
    context.fillStyle = mast === main ? '#c8373a' : p.rim;
    context.beginPath();
    context.moveTo(mast.x, topY);
    context.quadraticCurveTo(
      mast.x + u * 0.09,
      topY + u * 0.004,
      mast.x + u * 0.18,
      topY + u * 0.02,
    );
    context.lineTo(mast.x, topY + u * 0.024);
    context.closePath();
    context.fill();
  }
  paintHull(context, p, u, L, day);
}

function shipLayer(s: SailScene, p: SailPalette, day: boolean, ratio: number): HTMLCanvasElement {
  const width = s.u * 1.9;
  const height = s.u * 1.2;
  return cachedLayer(
    layerKey('sail-ship', width, height, ratio, day ? 'day' : 'night'),
    width,
    height,
    ratio,
    (context) => {
      context.translate(width * 0.44, height * 0.93);
      paintShip(context, p, s.u, day);
    },
  );
}

// ---- The moving sea: brush-stroke wave crests, glitter, a waterline over the hull, spray.

const WAVE_ROWS = 30;

interface WaveRow {
  y: number;
  depth: number;
  dashes: Speck[];
}

const waveRowCache = new Map<string, WaveRow[]>();

function waveRows(s: SailScene): WaveRow[] {
  const key = `${Math.round(s.c.width)}x${Math.round(s.c.height)}`;
  let rows = waveRowCache.get(key);
  if (!rows) {
    rows = Array.from({ length: WAVE_ROWS }, (_, index) => {
      const depth = (index + 0.5) / WAVE_ROWS;
      return {
        y: s.horizon + (s.c.height - s.horizon) * depth ** 1.75,
        depth,
        dashes: scatter(
          `sail-wave-row-${index}`,
          Math.round((6 + depth * 8) * (s.c.width < 500 ? 0.6 : 1)),
        ),
      };
    });
    if (waveRowCache.size > 16) waveRowCache.clear();
    waveRowCache.set(key, rows);
  }
  return rows;
}

/** Rounds an opacity so dashes of nearly the same shade can share one stroke. */
function shade(alpha: number): number {
  return Math.round(alpha * 20) / 20;
}

function pathFor(paths: Map<number, Path2D>, alpha: number): Path2D {
  let path = paths.get(alpha);
  if (!path) paths.set(alpha, (path = new Path2D()));
  return path;
}

function paintWaves(
  context: CanvasRenderingContext2D,
  s: SailScene,
  p: SailPalette,
  t: number,
  fromY: number,
  toY: number,
) {
  const { width, height } = s.c;
  for (const row of waveRows(s)) {
    if (row.y < fromY || row.y >= toY) continue;
    const length = width * (0.03 + row.depth * 0.13);
    const lift = height * (0.002 + row.depth * row.depth * 0.02);
    const lineWidth = Math.max(0.7, height * (0.0015 + row.depth * 0.005));
    // The sea is hundreds of dashes a frame, so each row strokes one path per shade rather than
    // one per dash.
    const troughs = new Map<number, Path2D>();
    const crests = new Map<number, Path2D>();
    for (const dash of row.dashes) {
      const drift = (t * (4 + row.depth * 24) * dash.speed) % (width + length * 2);
      const x = ((dash.x * (width + length * 2) + drift) % (width + length * 2)) - length;
      const y =
        row.y +
        (dash.y - 0.5) * height * 0.012 * (0.4 + row.depth) +
        Math.sin(t * 0.9 + dash.phase) * lift * 0.4;
      const w = length * (0.5 + dash.size);
      const nearLight = Math.max(0, 1 - Math.abs(x - s.lightX) / (width * 0.35));
      // The title sits bottom-left on wide art, so the water there stays calm.
      const calm = !s.c.portrait && x < width * 0.42 && y > height * 0.62 ? 0.4 : 1;
      const trough = pathFor(troughs, shade((0.12 + row.depth * 0.16) * calm));
      trough.moveTo(x - w / 2, y + lineWidth);
      trough.quadraticCurveTo(x, y + lineWidth - lift, x + w / 2, y + lineWidth);
      const crest = pathFor(crests, shade((0.05 + row.depth * 0.08) * calm + nearLight * 0.4));
      crest.moveTo(x - w / 2, y);
      crest.quadraticCurveTo(x, y - lift, x + w / 2, y);
    }
    context.lineWidth = lineWidth;
    for (const [alpha, path] of troughs) {
      context.strokeStyle = withOpacity(p.trough, alpha);
      context.stroke(path);
    }
    for (const [alpha, path] of crests) {
      context.strokeStyle = withOpacity(p.crest, alpha);
      context.stroke(path);
    }
  }
}

function paintGlitter(
  context: CanvasRenderingContext2D,
  s: SailScene,
  p: SailPalette,
  t: number,
  fromY: number,
  toY: number,
) {
  const depth = s.c.height - s.horizon;
  for (const speck of scatter('sail-glitter', 130)) {
    const y = s.horizon + speck.y ** 1.6 * depth;
    if (y < fromY || y >= toY) continue;
    const spread = s.c.width * (0.015 + speck.y ** 1.6 * 0.14);
    const x = s.lightX + (speck.x - 0.5) * 2 * spread;
    const alpha =
      Math.max(0, Math.sin(t * 2.4 * speck.speed + speck.phase)) * (0.95 - speck.y * 0.35);
    if (alpha < 0.05) continue;
    context.fillStyle = withOpacity(p.glitter, alpha);
    const length = (2 + speck.size * 12) * (0.3 + speck.y) * Math.max(0.35, s.c.width / 1920 + 0.3);
    context.fillRect(x - length / 2, y, length, Math.max(1, length * 0.14));
  }
}

/** Water that closes over the hull's waterline, in exactly the sea's own gradient. */
function paintWaterline(
  context: CanvasRenderingContext2D,
  s: SailScene,
  p: SailPalette,
  t: number,
) {
  const { width, height } = s.c;
  const step = Math.max(6, width / 80);
  const top = s.waterline + s.u * 0.012;
  context.beginPath();
  context.moveTo(0, height);
  for (let x = 0; x <= width + step; x += step) {
    const y =
      top +
      Math.sin(x / (width * 0.07) + t * 1.1) * height * 0.004 +
      Math.sin(x / (width * 0.021) - t * 1.7) * height * 0.002;
    context.lineTo(x, y);
  }
  context.lineTo(width, height);
  context.closePath();
  context.fillStyle = seaGradient(context, s, p);
  context.fill();
}

function paintSpray(
  context: CanvasRenderingContext2D,
  s: SailScene,
  p: SailPalette,
  t: number,
  heel: number,
) {
  const bowX = s.shipX + s.u * 0.53 * Math.cos(heel);
  const bowY = s.waterline + s.u * 0.01;
  for (const drop of scatter('sail-spray', 44)) {
    const age = (t * 0.6 * drop.speed + drop.phase) % 1;
    const x = bowX + (drop.x - 0.4) * s.u * 0.16 + age * s.u * 0.14;
    const y = bowY - Math.sin(age * Math.PI) * s.u * (0.04 + drop.y * 0.09);
    context.fillStyle = withOpacity(p.crest, (1 - age) * 0.85);
    const r = Math.max(0.6, s.u * 0.0045 * (0.5 + drop.size));
    context.beginPath();
    context.arc(x, y, r, 0, TAU);
    context.fill();
  }
  // White water along the hull and a wake trailing astern.
  context.fillStyle = radial(context, s.shipX + s.u * 0.3, bowY, 0, s.u * 0.3, [
    [0, withOpacity(p.crest, 0.55)],
    [1, withOpacity(p.crest, 0)],
  ]);
  context.beginPath();
  context.ellipse(s.shipX + s.u * 0.3, bowY, s.u * 0.3, s.u * 0.022, 0, 0, TAU);
  context.fill();
  context.fillStyle = linear(context, s.shipX - s.u * 1.1, 0, s.shipX - s.u * 0.4, 0, [
    [0, withOpacity(p.crest, 0)],
    [1, withOpacity(p.crest, 0.3)],
  ]);
  context.beginPath();
  context.ellipse(s.shipX - s.u * 0.75, bowY + s.u * 0.01, s.u * 0.4, s.u * 0.012, 0, 0, TAU);
  context.fill();
}

function paintSmoke(context: CanvasRenderingContext2D, s: SailScene, p: SailPalette, t: number) {
  const u = s.u * 0.13;
  // A bank of gun smoke drifting off the enemy's side, with the odd flash of a broadside.
  for (let puff = 0; puff < 8; puff++) {
    const age = ((t + puff * 0.85) % 6.8) / 6.8;
    const x = s.enemyX + u * (0.5 - (puff % 4) * 0.28) + age * u * 1.4;
    const y = s.horizon - u * (0.12 + (puff % 3) * 0.08) - age * u * 0.7;
    glow(context, x, y, u * (0.3 + age * 1.1), p.smoke, (1 - age) * 0.36);
    if (age < 0.02) glow(context, x - u * 0.1, s.horizon - u * 0.1, u * 0.3, p.flash, 0.9);
  }
}

function paintGulls(context: CanvasRenderingContext2D, s: SailScene, t: number) {
  context.strokeStyle = withOpacity('#2a1b1f', 0.75);
  context.lineWidth = Math.max(0.9, s.c.unit * 0.004);
  for (const gull of scatter('sail-gulls', 5)) {
    const x = s.c.width * (0.46 + gull.x * 0.46) + Math.sin(t * 0.2 + gull.phase) * s.c.unit * 0.05;
    const y = s.horizon * (0.18 + gull.y * 0.42);
    const span = s.c.unit * (0.018 + gull.size * 0.018);
    const flap = Math.sin(t * 3 * gull.speed + gull.phase) * span * 0.45;
    context.beginPath();
    context.moveTo(x - span, y - flap);
    context.quadraticCurveTo(x - span * 0.4, y - span * 0.32, x, y);
    context.quadraticCurveTo(x + span * 0.4, y - span * 0.32, x + span, y - flap);
    context.stroke();
  }
}

function paintSail(context: CanvasRenderingContext2D, frame: PosterFrame) {
  const day = frame.appearance === 'light';
  const p = day ? DAY : NIGHT;
  const s = layout(frame.width, frame.height, day);
  const ratio = pixelRatio(context);
  const variant = day ? 'day' : 'night';
  const t = frame.t;
  context.drawImage(
    cachedLayer(
      layerKey('sail-backdrop', frame.width, frame.height, ratio, variant),
      frame.width,
      frame.height,
      ratio,
      (layer) => paintBackdrop(layer, s, p, day),
    ),
    0,
    0,
    frame.width,
    frame.height,
  );
  if (day) paintGulls(context, s, t);
  paintSmoke(context, s, p, t);
  paintGlitter(context, s, p, t, s.horizon, s.waterline);
  paintWaves(context, s, p, t, s.horizon, s.waterline);
  const heel = 0.065 + 0.016 * Math.sin(t * 0.85);
  const bob = Math.sin(t * 0.85 + 0.7) * s.u * 0.013;
  const ship = shipLayer(s, p, day, ratio);
  context.save();
  context.translate(s.shipX, s.waterline + bob);
  context.rotate(heel);
  context.drawImage(ship, -s.u * 1.9 * 0.44, -s.u * 1.2 * 0.93, s.u * 1.9, s.u * 1.2);
  context.restore();
  paintWaterline(context, s, p, t);
  paintSpray(context, s, p, t, heel);
  paintGlitter(context, s, p, t, s.waterline, frame.height + 1);
  paintWaves(context, s, p, t, s.waterline, frame.height + 1);
  vignette(context, s.c, day ? 0.3 : 0.5);
}

export const sailArt: PosterArt = { animated: true, draw: paintSail };
