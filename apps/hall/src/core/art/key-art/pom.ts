import type { PosterArt, PosterFrame } from '../art';
import { cachedLayer, layerKey } from '../cache';
import {
  breathe,
  type Composition,
  compose,
  glow,
  linear,
  pixelRatio,
  radial,
  scatter,
  TAU,
  vignette,
  withOpacity,
} from '../shapes';

/**
 * Placeholder key art for pom, drawn by the Hall until the game supplies its own poster().
 *
 * A huge waxing gibbous moon, its seas and craters where they belong and the terminator curving
 * the right way, over a quiet sea with a lighthouse on the far point. By day it is the pale moon
 * you notice in a blue afternoon sky, its dark side lost in the blue.
 */

interface PomPalette {
  sky: readonly [string, string, string];
  moonLight: string;
  moonEdge: string;
  maria: string;
  mariaAlpha: number;
  shade: string;
  shadeAlpha: number;
  halo: string;
  haloAlpha: number;
  cloud: readonly [body: string, lit: string];
  cloudAlpha: number;
  sea: readonly [string, string];
  glitter: string;
  hills: readonly [far: string, near: string];
  lighthouse: string;
  lamp: string;
}

const NIGHT: PomPalette = {
  sky: ['#030615', '#0c1836', '#223a6b'],
  moonLight: '#f6f2e6',
  moonEdge: '#b7b1a2',
  maria: '#7f7b72',
  mariaAlpha: 0.62,
  shade: '#0b1022',
  shadeAlpha: 0.9,
  halo: '#c9d6ff',
  haloAlpha: 0.5,
  cloud: ['#1b2645', '#b8c6ec'],
  cloudAlpha: 0.8,
  sea: ['#1c2f5c', '#040816'],
  glitter: '#f3f1e8',
  hills: ['#0f1a36', '#060b1a'],
  lighthouse: '#1a2238',
  lamp: '#ffd68a',
};

const DAY: PomPalette = {
  sky: ['#3f8fe0', '#7fbcf0', '#cfe8fb'],
  moonLight: '#f8fbff',
  moonEdge: '#d9e3f2',
  maria: '#9fb3d0',
  mariaAlpha: 0.5,
  shade: '#80bdf0',
  shadeAlpha: 1,
  halo: '#ffffff',
  haloAlpha: 0.25,
  cloud: ['#e9f3fd', '#ffffff'],
  cloudAlpha: 0.92,
  sea: ['#3e9ccd', '#155a88'],
  glitter: '#ffffff',
  hills: ['#6f9fb8', '#3c6f8a'],
  lighthouse: '#f5f1ea',
  lamp: '#ff5a4a',
};

interface Night {
  c: Composition;
  moonX: number;
  moonY: number;
  moonR: number;
  horizon: number;
}

function layout(width: number, height: number): Night {
  const c = compose(width, height);
  if (c.portrait) {
    return {
      c,
      moonX: width * 0.52,
      moonY: height * 0.34,
      moonR: width * 0.38,
      horizon: height * 0.74,
    };
  }
  return {
    c,
    moonX: width * 0.66,
    moonY: height * 0.42,
    moonR: height * 0.36,
    horizon: height * 0.8,
  };
}

/** Illuminated fraction of the disc: a waxing gibbous, lit from the right. */
const LIT_FRACTION = 0.8;

// ---- The moon, painted once per size.

const MARIA: readonly [x: number, y: number, rx: number, ry: number][] = [
  [-0.36, -0.34, 0.27, 0.22],
  [0.12, -0.3, 0.16, 0.14],
  [0.24, -0.04, 0.19, 0.15],
  [0.56, -0.22, 0.1, 0.08],
  [0.46, 0.14, 0.12, 0.14],
  [-0.14, 0.36, 0.17, 0.12],
  [-0.56, -0.02, 0.24, 0.4],
  [-0.04, -0.63, 0.22, 0.06],
  [0.1, 0.2, 0.1, 0.08],
];

function paintMoon(context: CanvasRenderingContext2D, n: Night, p: PomPalette, day: boolean) {
  const { moonX: x, moonY: y, moonR: r } = n;
  glow(context, x, y, r * 2.6, p.halo, p.haloAlpha);
  context.save();
  // By day the moon is pale: the blue sky shows faintly through it.
  context.globalAlpha = day ? 0.82 : 1;
  context.beginPath();
  context.arc(x, y, r, 0, TAU);
  context.clip();
  context.fillStyle = radial(context, x + r * 0.25, y - r * 0.2, r * 0.1, r * 1.1, [
    [0, p.moonLight],
    [1, p.moonEdge],
  ]);
  context.fillRect(x - r, y - r, r * 2, r * 2);
  // The seas: soft, darker basalt plains.
  context.filter = `blur(${(r * 0.035).toFixed(1)}px)`;
  context.fillStyle = withOpacity(p.maria, p.mariaAlpha);
  context.beginPath();
  for (const [mx, my, rx, ry] of MARIA) {
    context.moveTo(x + (mx + rx) * r, y + my * r);
    context.ellipse(x + mx * r, y + my * r, rx * r, ry * r, 0, 0, TAU);
  }
  context.fill();
  context.filter = 'none';
  paintCraters(context, n, p);
  // Earthshine keeps the dark side faintly visible at night; by day it vanishes into the sky.
  context.filter = `blur(${(r * 0.03).toFixed(1)}px)`;
  context.fillStyle = withOpacity(p.shade, p.shadeAlpha);
  const terminator = r * Math.abs(2 * LIT_FRACTION - 1);
  context.beginPath();
  context.arc(x, y, r * 1.1, -Math.PI / 2, Math.PI / 2, true);
  context.ellipse(x, y, terminator, r * 1.1, 0, Math.PI / 2, Math.PI * 1.5, false);
  context.closePath();
  context.fill();
  context.restore();
  if (!day) {
    // A thin bright limb on the lit side.
    context.strokeStyle = withOpacity('#ffffff', 0.5);
    context.lineWidth = Math.max(1, r * 0.01);
    context.beginPath();
    context.arc(x, y, r * 0.995, -Math.PI * 0.42, Math.PI * 0.42);
    context.stroke();
  }
}

function paintCraters(context: CanvasRenderingContext2D, n: Night, p: PomPalette) {
  const { moonX: x, moonY: y, moonR: r } = n;
  for (const crater of scatter('pom-craters', 70)) {
    const angle = crater.phase;
    const distance = Math.sqrt(crater.x) * r * 0.92;
    const cx = x + Math.cos(angle) * distance;
    const cy = y + Math.sin(angle) * distance;
    const cr = r * (0.012 + crater.size ** 3 * 0.07);
    // Foreshortened toward the limb.
    const squash = Math.sqrt(Math.max(0.15, 1 - (distance / r) ** 2));
    context.fillStyle = withOpacity(p.maria, 0.35);
    context.beginPath();
    context.ellipse(cx, cy, cr * squash, cr, angle, 0, TAU);
    context.fill();
    // Sunlight from the right lights each crater's inner left wall.
    context.strokeStyle = withOpacity('#ffffff', 0.4);
    context.lineWidth = Math.max(0.5, cr * 0.25);
    context.beginPath();
    context.ellipse(cx, cy, cr * squash, cr, angle, Math.PI * 0.6, Math.PI * 1.4);
    context.stroke();
  }
  // A young bright crater low on the disc, with its rays.
  const tychoX = x - r * 0.1;
  const tychoY = y + r * 0.62;
  context.strokeStyle = withOpacity('#ffffff', 0.12);
  context.lineWidth = Math.max(0.6, r * 0.006);
  for (let ray = 0; ray < 14; ray++) {
    const angle = (ray / 14) * TAU + 0.2;
    context.beginPath();
    context.moveTo(tychoX, tychoY);
    context.lineTo(tychoX + Math.cos(angle) * r * 0.6, tychoY + Math.sin(angle) * r * 0.6);
    context.stroke();
  }
  glow(context, tychoX, tychoY, r * 0.05, '#ffffff', 0.9);
}

// ---- Sky, sea and the far point, painted once per size.

function paintBackdrop(context: CanvasRenderingContext2D, n: Night, p: PomPalette, day: boolean) {
  const { width, height } = n.c;
  context.fillStyle = linear(context, 0, 0, 0, n.horizon, [
    [0, p.sky[0]],
    [0.6, p.sky[1]],
    [1, p.sky[2]],
  ]);
  context.fillRect(0, 0, width, n.horizon);
  if (!day) {
    for (const star of scatter('pom-stars', 240)) {
      context.fillStyle = withOpacity('#ffffff', 0.2 + star.size * 0.6);
      const size = star.size > 0.94 ? 2 : star.size > 0.7 ? 1.4 : 1;
      context.fillRect(star.x * width, star.y ** 1.3 * n.horizon, size, size);
    }
  }
  paintMoon(context, n, p, day);
  // The sea, with the moon's long reflection laid on it.
  context.fillStyle = linear(context, 0, n.horizon, 0, height, [
    [0, p.sea[0]],
    [1, p.sea[1]],
  ]);
  context.fillRect(0, n.horizon, width, height - n.horizon);
  context.save();
  context.beginPath();
  context.rect(0, n.horizon, width, height - n.horizon);
  context.clip();
  context.translate(n.moonX, n.horizon);
  context.scale(0.14, 1);
  context.fillStyle = radial(context, 0, 0, 0, height * 0.8, [
    [0, withOpacity(p.glitter, day ? 0.35 : 0.45)],
    [1, withOpacity(p.glitter, 0)],
  ]);
  context.fillRect(-height * 6, 0, height * 12, height);
  context.restore();
  paintHills(context, n, p);
}

function ridge(
  context: CanvasRenderingContext2D,
  n: Night,
  from: number,
  to: number,
  height: number,
  seed: string,
) {
  const bumps = scatter(seed, 7);
  context.beginPath();
  context.moveTo(from, n.horizon + 1);
  bumps.forEach((bump, index) => {
    const x = from + ((index + 1) / (bumps.length + 1)) * (to - from);
    context.quadraticCurveTo(
      x - (to - from) * 0.05,
      n.horizon - height * (0.4 + bump.size * 0.6),
      x,
      n.horizon - height * (0.3 + bump.y * 0.5),
    );
  });
  context.lineTo(to, n.horizon + 1);
  context.closePath();
  context.fill();
}

function paintHills(context: CanvasRenderingContext2D, n: Night, p: PomPalette) {
  const { width, height } = n.c;
  context.fillStyle = p.hills[0];
  ridge(context, n, -width * 0.02, width * 0.38, height * 0.07, 'pom-hills-far');
  context.fillStyle = p.hills[1];
  ridge(context, n, -width * 0.05, width * 0.22, height * 0.045, 'pom-hills-near');
  // The far point with its lighthouse.
  const pointX = n.c.portrait ? width * 0.86 : width * 0.9;
  context.fillStyle = p.hills[1];
  ridge(context, n, pointX - width * 0.1, width * 1.02, height * 0.035, 'pom-point');
  const towerHeight = height * (n.c.portrait ? 0.08 : 0.1);
  const base = n.horizon - height * 0.025;
  context.fillStyle = p.lighthouse;
  context.beginPath();
  context.moveTo(pointX - towerHeight * 0.1, base);
  context.lineTo(pointX - towerHeight * 0.06, base - towerHeight);
  context.lineTo(pointX + towerHeight * 0.06, base - towerHeight);
  context.lineTo(pointX + towerHeight * 0.1, base);
  context.closePath();
  context.fill();
  context.fillRect(
    pointX - towerHeight * 0.09,
    base - towerHeight * 1.12,
    towerHeight * 0.18,
    towerHeight * 0.12,
  );
}

// ---- What moves: clouds crossing the moon, glitter, the lighthouse lamp, twinkling stars.

function cloudSprite(n: Night, p: PomPalette, day: boolean, ratio: number, index: number) {
  const width = n.c.width * (n.c.portrait ? 0.9 : 0.42);
  const height = n.c.height * 0.14;
  return {
    canvas: cachedLayer(
      layerKey(`pom-cloud-${index}`, width, height, ratio, day ? 'day' : 'night'),
      width,
      height,
      ratio,
      (context) => {
        const puffs = scatter(`pom-cloud-puffs-${index}`, 26);
        for (const [dy, shrink, color, alpha] of [
          [height * 0.08, 1, p.cloud[0], 1],
          [-height * 0.08, 0.6, p.cloud[1], day ? 0.9 : 0.35],
        ] as const) {
          context.filter = `blur(${(height * 0.08).toFixed(1)}px)`;
          context.globalAlpha = alpha;
          context.fillStyle = color;
          context.beginPath();
          for (const puff of puffs) {
            const px = width * (0.12 + puff.x * 0.76);
            const py =
              height * 0.5 +
              dy +
              (puff.y - 0.5) * height * 0.25 -
              Math.sin(puff.x * Math.PI) * height * 0.12;
            const pr = height * (0.16 + puff.size * 0.22) * shrink;
            context.moveTo(px + pr * 1.8, py);
            context.ellipse(px, py, pr * 1.8, pr, 0, 0, TAU);
          }
          context.fill();
        }
      },
    ),
    width,
    height,
  };
}

function paintClouds(
  context: CanvasRenderingContext2D,
  n: Night,
  p: PomPalette,
  t: number,
  day: boolean,
  ratio: number,
) {
  const lanes = [
    { y: n.moonY + n.moonR * 0.35, speed: 0.006, offset: 0.1 },
    { y: n.moonY - n.moonR * 0.75, speed: 0.004, offset: 0.62 },
    { y: n.horizon - n.c.height * 0.14, speed: 0.008, offset: 0.35 },
  ];
  lanes.forEach((lane, index) => {
    const sprite = cloudSprite(n, p, day, ratio, index);
    const travel = n.c.width + sprite.width;
    const x = ((lane.offset + t * lane.speed) % 1) * travel - sprite.width;
    context.globalAlpha = p.cloudAlpha;
    context.drawImage(sprite.canvas, x, lane.y - sprite.height / 2, sprite.width, sprite.height);
    context.globalAlpha = 1;
  });
}

/** Long, low swells on the water, faint everywhere and brighter in the moon's path. */
function paintSwell(context: CanvasRenderingContext2D, n: Night, p: PomPalette, t: number) {
  const depth = n.c.height - n.horizon;
  context.lineCap = 'round';
  for (const swell of scatter('pom-swell', 40)) {
    const y = n.horizon + swell.y ** 1.5 * depth;
    const length = n.c.width * (0.04 + swell.y * 0.12) * (0.5 + swell.size);
    const x = ((swell.x + t * 0.004 * swell.speed) % 1) * (n.c.width + length) - length / 2;
    const nearMoon = Math.max(0, 1 - Math.abs(x - n.moonX) / (n.c.width * 0.25));
    context.strokeStyle = withOpacity(p.glitter, 0.05 + swell.y * 0.05 + nearMoon * 0.15);
    context.lineWidth = Math.max(0.6, n.c.height * (0.001 + swell.y * 0.003));
    context.beginPath();
    context.moveTo(x - length / 2, y);
    context.lineTo(x + length / 2, y);
    context.stroke();
  }
}

function paintGlitter(context: CanvasRenderingContext2D, n: Night, p: PomPalette, t: number) {
  const depth = n.c.height - n.horizon;
  for (const speck of scatter('pom-glitter', 90)) {
    const y = n.horizon + speck.y ** 1.4 * depth;
    const spread = n.c.width * (0.01 + speck.y * 0.07);
    const x = n.moonX + (speck.x - 0.5) * 2 * spread;
    const alpha = Math.max(0, Math.sin(t * 2 * speck.speed + speck.phase)) * 0.85;
    if (alpha < 0.05) continue;
    context.fillStyle = withOpacity(p.glitter, alpha);
    const length = (2 + speck.size * 10) * (0.4 + speck.y) * Math.max(0.35, n.c.width / 1920 + 0.3);
    context.fillRect(x - length / 2, y, length, Math.max(1, length * 0.12));
  }
}

function paintLamp(
  context: CanvasRenderingContext2D,
  n: Night,
  p: PomPalette,
  t: number,
  day: boolean,
) {
  const pointX = n.c.portrait ? n.c.width * 0.86 : n.c.width * 0.9;
  const towerHeight = n.c.height * (n.c.portrait ? 0.08 : 0.1);
  const lampY = n.horizon - n.c.height * 0.025 - towerHeight * 1.06;
  const on = breathe(t, 4) > 0.55 ? 1 : 0.25;
  glow(context, pointX, lampY, towerHeight * (day ? 0.25 : 0.6), p.lamp, on);
  if (!day && on > 0.5) {
    const reach = n.c.width * 0.09;
    context.fillStyle = linear(context, pointX, 0, pointX - reach, 0, [
      [0, withOpacity(p.lamp, 0.3)],
      [1, withOpacity(p.lamp, 0)],
    ]);
    context.beginPath();
    context.moveTo(pointX, lampY);
    context.lineTo(pointX - reach, lampY - towerHeight * 0.3);
    context.lineTo(pointX - reach, lampY + towerHeight * 0.2);
    context.closePath();
    context.fill();
  }
}

function paintPom(context: CanvasRenderingContext2D, frame: PosterFrame) {
  const day = frame.appearance === 'light';
  const p = day ? DAY : NIGHT;
  const n = layout(frame.width, frame.height);
  const ratio = pixelRatio(context);
  const t = frame.t;
  context.drawImage(
    cachedLayer(
      layerKey('pom-backdrop', frame.width, frame.height, ratio, day ? 'day' : 'night'),
      frame.width,
      frame.height,
      ratio,
      (layer) => paintBackdrop(layer, n, p, day),
    ),
    0,
    0,
    frame.width,
    frame.height,
  );
  if (!day) {
    for (const star of scatter('pom-twinkle', 18)) {
      const alpha = Math.max(0, Math.sin(t * 1.5 * star.speed + star.phase));
      glow(
        context,
        star.x * frame.width,
        star.y * n.horizon * 0.8,
        frame.height * 0.006,
        '#ffffff',
        alpha * 0.8,
      );
    }
  }
  paintClouds(context, n, p, t, day, ratio);
  paintSwell(context, n, p, t);
  paintGlitter(context, n, p, t);
  paintLamp(context, n, p, t, day);
  vignette(context, n.c, day ? 0.18 : 0.5, day ? '#1c4f86' : '#000000');
}

export const pomArt: PosterArt = { animated: true, draw: paintPom };
