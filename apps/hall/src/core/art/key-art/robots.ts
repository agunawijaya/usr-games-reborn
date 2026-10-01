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
  roundedRect,
  scatter,
  TAU,
  vignette,
  withOpacity,
} from '../shapes';

/**
 * Placeholder key art for robots, drawn by the Hall until the game supplies its own poster().
 *
 * A neon arena at night (a sunlit rooftop arena by day). Chunky robots close in on one small
 * figure who is already shimmering into a teleport; between them two robots that collided
 * smoulder as a scrap heap. Everything sits right of centre; the floor bottom-left stays quiet.
 */

interface RobotsPalette {
  sky: readonly [string, string, string];
  wall: string;
  strip: string;
  bokeh: readonly string[];
  floor: readonly [string, string];
  gridNear: string;
  gridFar: string;
  metal: readonly [light: string, mid: string, dark: string];
  rimLeft: string;
  rimRight: string;
  eye: string;
  panel: readonly string[];
  hero: string;
  heroGlow: string;
  spark: string;
  ember: string;
  smoke: string;
  shadow: string;
}

const NIGHT: RobotsPalette = {
  sky: ['#04030d', '#0d0724', '#2b0c47'],
  wall: '#120a2b',
  strip: '#ff3fa6',
  bokeh: ['#ff4fb8', '#39e0ff', '#ffcf4a', '#8a6bff'],
  floor: ['#170c35', '#06051a'],
  gridNear: '#ff4fb8',
  gridFar: '#39e0ff',
  metal: ['#6c7694', '#313853', '#141827'],
  rimLeft: '#ff4fb8',
  rimRight: '#39e0ff',
  eye: '#ff3344',
  panel: ['#39e0ff', '#ffcf4a', '#ff4fb8'],
  hero: '#9ffbff',
  heroGlow: '#39e0ff',
  spark: '#ffc25a',
  ember: '#ff6a2a',
  smoke: '#3d3358',
  shadow: '#000000',
};

const DAY: RobotsPalette = {
  sky: ['#7cc8f7', '#d9efff', '#fff1f6'],
  wall: '#efeaff',
  strip: '#ff5fa2',
  bokeh: ['#ff8cc0', '#6fd8ff', '#ffd66b', '#b39bff'],
  floor: ['#eef0fc', '#c9cff0'],
  gridNear: '#7a4dff',
  gridFar: '#00a3d4',
  metal: ['#8b96b3', '#4a5270', '#232839'],
  rimLeft: '#ff5fa2',
  rimRight: '#1cc4f0',
  eye: '#ff2d55',
  panel: ['#1cc4f0', '#ffb020', '#ff5fa2'],
  hero: '#006f94',
  heroGlow: '#3fd6ff',
  spark: '#ff9d2e',
  ember: '#ff5a1f',
  smoke: '#8d84a8',
  shadow: '#2a2340',
};

interface Arena {
  c: Composition;
  horizon: number;
  vanishX: number;
  /** A robot's height on screen at the nearest depth (1). */
  reach: number;
}

function layout(width: number, height: number): Arena {
  const c = compose(width, height);
  return {
    c,
    horizon: c.portrait ? height * 0.36 : height * 0.42,
    vanishX: c.portrait ? width * 0.5 : width * 0.64,
    reach: c.portrait ? Math.min(height * 0.42, width * 0.66) : height * 0.62,
  };
}

/** Floor position (sideways, depth 0 far … 1 near) to screen point and scale. */
function onFloor(a: Arena, lateral: number, depth: number) {
  const spread = a.c.portrait ? a.c.width * 1.4 : a.c.width;
  return {
    x: a.vanishX + lateral * depth * spread,
    y: a.horizon + (a.c.height - a.horizon) * depth,
    scale: depth,
  };
}

// ---- The arena: wall, lights and gridded floor, painted once per size.

function paintArena(context: CanvasRenderingContext2D, a: Arena, p: RobotsPalette, day: boolean) {
  const { width, height } = a.c;
  context.fillStyle = linear(context, 0, 0, 0, a.horizon, [
    [0, p.sky[0]],
    [0.6, p.sky[1]],
    [1, p.sky[2]],
  ]);
  context.fillRect(0, 0, width, a.horizon);
  // Distant stadium lights, out of focus.
  for (const light of scatter('robots-bokeh', 34)) {
    const x = light.x * width;
    const y = a.horizon * (0.15 + light.y * 0.7);
    const color = p.bokeh[Math.floor(light.phase * 10) % p.bokeh.length] as string;
    glow(context, x, y, a.c.unit * (0.015 + light.size * 0.04), color, day ? 0.35 : 0.55);
  }
  // The arena wall with its lit panels and neon strip.
  const wallTop = a.horizon - a.c.height * 0.09;
  context.fillStyle = linear(context, 0, wallTop, 0, a.horizon, [
    [0, withOpacity(p.wall, 0.9)],
    [1, p.wall],
  ]);
  context.fillRect(0, wallTop, width, a.horizon - wallTop);
  // A second, fainter strip along the top of the wall.
  context.fillStyle = withOpacity(p.gridFar, day ? 0.5 : 0.7);
  context.fillRect(0, wallTop, width, a.c.height * 0.003);
  context.fillStyle = p.strip;
  context.fillRect(0, a.horizon - a.c.height * 0.006, width, a.c.height * 0.006);
  glow(context, a.vanishX, a.horizon, width * 0.5, p.strip, day ? 0.25 : 0.5);
  // The floor.
  context.fillStyle = linear(context, 0, a.horizon, 0, height, [
    [0, p.floor[0]],
    [1, p.floor[1]],
  ]);
  context.fillRect(0, a.horizon, width, height - a.horizon);
  paintGrid(context, a, p, day);
  context.fillStyle = radial(context, a.vanishX, a.horizon, 0, width * 0.6, [
    [0, withOpacity(p.strip, day ? 0.18 : 0.3)],
    [1, withOpacity(p.strip, 0)],
  ]);
  context.fillRect(0, a.horizon, width, height - a.horizon);
}

function paintGrid(context: CanvasRenderingContext2D, a: Arena, p: RobotsPalette, day: boolean) {
  const { width, height } = a.c;
  const lines: [x0: number, y0: number, x1: number, y1: number, depth: number][] = [];
  for (let i = -16; i <= 16; i++) {
    const far = onFloor(a, i * 0.09, 0.02);
    const near = onFloor(a, i * 0.09, 1.25);
    lines.push([far.x, far.y, near.x, near.y, 0.6]);
  }
  for (let k = 1; k <= 14; k++) {
    const depth = (k / 14) ** 1.6 * 1.1;
    const y = a.horizon + (height - a.horizon) * depth;
    lines.push([0, y, width, y, depth]);
  }
  for (const [pass, widthScale, alpha] of [
    [0, 6, day ? 0.08 : 0.12],
    [1, 1.6, day ? 0.45 : 0.75],
  ] as const) {
    for (const [x0, y0, x1, y1, depth] of lines) {
      const color = depth > 0.5 ? p.gridNear : p.gridFar;
      context.strokeStyle = linear(context, 0, a.horizon, 0, height, [
        [0, withOpacity(color, alpha * 0.2)],
        [0.35, withOpacity(color, alpha)],
        [1, withOpacity(color, alpha * (pass === 0 ? 1 : 0.9))],
      ]);
      context.lineWidth = Math.max(0.6, a.c.unit * 0.0022 * widthScale * (0.4 + depth));
      context.beginPath();
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
      context.stroke();
    }
  }
  // The floor bottom-left stays calm under the title.
  if (!a.c.portrait) {
    context.fillStyle = radial(context, 0, height, 0, width * 0.42, [
      [0, withOpacity(p.floor[1], 0.75)],
      [1, withOpacity(p.floor[1], 0)],
    ]);
    context.fillRect(0, a.horizon, width * 0.5, height - a.horizon);
  }
}

// ---- Robots: two designs painted once per size, placed in perspective, eyes lit each frame.

type Design = 'block' | 'dome';

function metalFill(context: CanvasRenderingContext2D, p: RobotsPalette, x: number, width: number) {
  return linear(context, x, 0, x + width, 0, [
    [0, p.metal[2]],
    [0.3, p.metal[1]],
    [0.62, p.metal[0]],
    [1, p.metal[1]],
  ]);
}

/** Neon from both sides of the arena catches the robot's edges: magenta left, cyan right. */
function rim(context: CanvasRenderingContext2D, p: RobotsPalette, h: number, halfWidth: number) {
  context.lineWidth = Math.max(1, h * 0.014);
  context.strokeStyle = linear(context, -halfWidth, 0, halfWidth, 0, [
    [0, withOpacity(p.rimLeft, 0.85)],
    [0.3, withOpacity(p.rimLeft, 0)],
    [0.62, withOpacity(p.rimRight, 0)],
    [1, withOpacity(p.rimRight, 0.95)],
  ]);
  context.stroke();
}

/** A robot standing on (0, 0), `h` tall, facing the viewer; eyes are left for the frame. */
function paintRobot(
  context: CanvasRenderingContext2D,
  p: RobotsPalette,
  h: number,
  design: Design,
) {
  const headWidth = design === 'block' ? 0.36 * h : 0.3 * h;
  // Legs and feet.
  for (const side of [-1, 1]) {
    context.fillStyle = metalFill(context, p, side * 0.14 * h - 0.06 * h, 0.12 * h);
    roundedRect(context, side * 0.14 * h - 0.06 * h, -0.24 * h, 0.12 * h, 0.2 * h, 0.02 * h);
    context.fill();
    context.fillStyle = p.metal[2];
    roundedRect(context, side * 0.14 * h - 0.09 * h, -0.06 * h, 0.18 * h, 0.06 * h, 0.025 * h);
    context.fill();
  }
  // Arms reaching forward, claws open.
  for (const side of [-1, 1]) {
    context.save();
    context.translate(side * 0.3 * h, -0.58 * h);
    context.rotate(side * -0.35);
    context.fillStyle = metalFill(context, p, -0.05 * h, 0.1 * h);
    roundedRect(context, -0.05 * h, 0, 0.1 * h, 0.3 * h, 0.04 * h);
    context.fill();
    context.fillStyle = p.metal[2];
    for (const claw of [-1, 1]) {
      context.beginPath();
      context.moveTo(claw * 0.02 * h, 0.29 * h);
      context.lineTo(claw * 0.07 * h, 0.38 * h);
      context.lineTo(claw * 0.035 * h, 0.39 * h);
      context.closePath();
      context.fill();
    }
    context.restore();
  }
  // Body.
  const bodyWidth = design === 'block' ? 0.56 * h : 0.48 * h;
  context.fillStyle = metalFill(context, p, -bodyWidth / 2, bodyWidth);
  roundedRect(context, -bodyWidth / 2, -0.66 * h, bodyWidth, 0.44 * h, 0.07 * h);
  context.fill();
  rim(context, p, h, bodyWidth / 2);
  // A soft specular streak down the body's lit side.
  context.fillStyle = linear(context, bodyWidth * 0.12, 0, bodyWidth * 0.3, 0, [
    [0, withOpacity('#ffffff', 0)],
    [0.5, withOpacity('#ffffff', 0.16)],
    [1, withOpacity('#ffffff', 0)],
  ]);
  context.fillRect(bodyWidth * 0.12, -0.62 * h, bodyWidth * 0.18, 0.36 * h);
  context.fillStyle = withOpacity(p.metal[2], 0.8);
  roundedRect(context, -bodyWidth * 0.32, -0.56 * h, bodyWidth * 0.64, 0.2 * h, 0.03 * h);
  context.fill();
  p.panel.forEach((color, index) => {
    context.fillStyle = color;
    context.fillRect(
      -bodyWidth * 0.22 + index * bodyWidth * 0.16,
      -0.5 * h,
      bodyWidth * 0.1,
      0.035 * h,
    );
  });
  // Neck and head.
  context.fillStyle = p.metal[2];
  context.fillRect(-0.05 * h, -0.72 * h, 0.1 * h, 0.07 * h);
  context.fillStyle = metalFill(context, p, -headWidth / 2, headWidth);
  if (design === 'block') {
    roundedRect(context, -headWidth / 2, -0.94 * h, headWidth, 0.24 * h, 0.05 * h);
  } else {
    context.beginPath();
    context.moveTo(-headWidth / 2, -0.72 * h);
    context.lineTo(-headWidth / 2, -0.84 * h);
    context.arc(0, -0.84 * h, headWidth / 2, Math.PI, 0);
    context.lineTo(headWidth / 2, -0.72 * h);
    context.closePath();
  }
  context.fill();
  rim(context, p, h, headWidth / 2);
  // Visor.
  context.fillStyle = '#05060d';
  roundedRect(context, -headWidth * 0.38, -0.86 * h, headWidth * 0.76, 0.08 * h, 0.03 * h);
  context.fill();
  // Antenna.
  context.strokeStyle = p.metal[1];
  context.lineWidth = Math.max(1, 0.012 * h);
  context.beginPath();
  context.moveTo(0, design === 'block' ? -0.94 * h : -0.99 * h);
  context.lineTo(0.02 * h, -1.06 * h);
  context.stroke();
}

function robotSprite(a: Arena, p: RobotsPalette, design: Design, day: boolean, ratio: number) {
  const h = a.reach;
  const width = h * 1.1;
  const height = h * 1.15;
  return {
    canvas: cachedLayer(
      layerKey(`robot-${design}`, width, height, ratio, day ? 'day' : 'night'),
      width,
      height,
      ratio,
      (context) => {
        context.translate(width / 2, height * 0.96);
        paintRobot(context, p, h, design);
      },
    ),
    width,
    height,
  };
}

interface Placement {
  lateral: number;
  depth: number;
  design: Design;
  flip: boolean;
  phase: number;
}

const ROBOTS: readonly Placement[] = [
  { lateral: -0.24, depth: 0.44, design: 'dome', flip: false, phase: 0.2 },
  { lateral: 0.2, depth: 0.4, design: 'block', flip: true, phase: 1.1 },
  { lateral: 0.5, depth: 0.52, design: 'dome', flip: true, phase: 3.1 },
  { lateral: -0.2, depth: 0.86, design: 'block', flip: false, phase: 4.2 },
  { lateral: 0.19, depth: 1.02, design: 'block', flip: true, phase: 5.3 },
];

const HERO = { lateral: 0.05, depth: 0.66 };
const HEAP = { lateral: -0.1, depth: 0.58 };

/** Spotlights sweeping the arena from the rigging above the wall. */
function paintSpotlights(
  context: CanvasRenderingContext2D,
  a: Arena,
  p: RobotsPalette,
  t: number,
  day: boolean,
) {
  const colors = [p.gridFar, p.strip, p.gridNear];
  colors.forEach((color, index) => {
    const originX = a.c.width * (0.46 + index * 0.2);
    const sweep = Math.sin(t * 0.22 + index * 2.1) * a.c.width * 0.12;
    const targetX = a.vanishX + sweep + (index - 1) * a.c.width * 0.1;
    const spread = a.c.width * 0.07;
    context.fillStyle = linear(context, 0, 0, 0, a.c.height, [
      [0, withOpacity(color, day ? 0.14 : 0.2)],
      [1, withOpacity(color, 0)],
    ]);
    context.beginPath();
    context.moveTo(originX - a.c.unit * 0.01, 0);
    context.lineTo(originX + a.c.unit * 0.01, 0);
    context.lineTo(targetX + spread, a.c.height);
    context.lineTo(targetX - spread, a.c.height);
    context.closePath();
    context.fill();
  });
}

function paintRobotAt(
  context: CanvasRenderingContext2D,
  a: Arena,
  p: RobotsPalette,
  robot: Placement,
  t: number,
  day: boolean,
  ratio: number,
) {
  const spot = onFloor(a, robot.lateral, robot.depth);
  const sprite = robotSprite(a, p, robot.design, day, ratio);
  const scale = spot.scale;
  const h = a.reach * scale;
  const sway = Math.sin(t * 1.4 + robot.phase) * h * 0.01;
  // Contact shadow and the eyes' red smear on the floor.
  context.fillStyle = radial(context, spot.x, spot.y, 0, h * 0.35, [
    [0, withOpacity(p.shadow, day ? 0.35 : 0.6)],
    [1, withOpacity(p.shadow, 0)],
  ]);
  context.beginPath();
  context.ellipse(spot.x, spot.y, h * 0.36, h * 0.07, 0, 0, TAU);
  context.fill();
  glow(context, spot.x, spot.y + h * 0.02, h * 0.25, p.eye, day ? 0.12 : 0.25);
  context.save();
  context.translate(spot.x + sway, spot.y);
  if (robot.flip) context.scale(-1, 1);
  context.drawImage(
    sprite.canvas,
    (-sprite.width / 2) * scale,
    -sprite.height * 0.96 * scale,
    sprite.width * scale,
    sprite.height * scale,
  );
  const pulse = 0.65 + 0.35 * breathe(t, 1.6, robot.phase);
  const headWidth = (robot.design === 'block' ? 0.36 : 0.3) * h;
  for (const side of [-1, 1]) {
    const ex = side * headWidth * 0.2;
    const ey = -0.82 * h;
    glow(context, ex, ey, h * 0.09, p.eye, 0.8 * pulse);
    context.fillStyle = '#ffe3e6';
    context.beginPath();
    context.arc(ex, ey, Math.max(0.8, h * 0.012), 0, TAU);
    context.fill();
  }
  glow(context, 0.02 * h, -1.06 * h, h * 0.035, p.panel[1] as string, pulse);
  context.restore();
}

// ---- The hero mid-teleport, and the smouldering wreck.

function paintHero(
  context: CanvasRenderingContext2D,
  a: Arena,
  p: RobotsPalette,
  t: number,
  day: boolean,
) {
  const spot = onFloor(a, HERO.lateral, HERO.depth);
  const h = a.reach * HERO.depth * 0.42;
  const shimmer = breathe(t, 2.2);
  // Light column rising from the floor.
  context.fillStyle = linear(context, 0, spot.y - h * 2.2, 0, spot.y, [
    [0, withOpacity(p.heroGlow, 0)],
    [1, withOpacity(p.heroGlow, (day ? 0.35 : 0.45) * (0.6 + 0.4 * shimmer))],
  ]);
  context.fillRect(spot.x - h * 0.45, spot.y - h * 2.2, h * 0.9, h * 2.2);
  for (let ring = 0; ring < 3; ring++) {
    const age = (((t * 0.5 + ring / 3) % 1) + 1) % 1;
    context.strokeStyle = withOpacity(p.heroGlow, (1 - age) * 0.8);
    context.lineWidth = Math.max(1, h * 0.03);
    context.beginPath();
    context.ellipse(spot.x, spot.y, h * (0.3 + age * 0.9), h * (0.06 + age * 0.18), 0, 0, TAU);
    context.stroke();
  }
  glow(context, spot.x, spot.y - h * 0.5, h * 1.2, p.heroGlow, day ? 0.45 : 0.6);
  // The figure: a simple silhouette with a bright outline.
  context.save();
  context.translate(spot.x, spot.y);
  context.beginPath();
  context.arc(0, -h * 0.88, h * 0.12, 0, TAU);
  context.moveTo(-h * 0.16, -h * 0.72);
  context.lineTo(h * 0.16, -h * 0.72);
  context.lineTo(h * 0.12, -h * 0.35);
  context.lineTo(h * 0.14, 0);
  context.lineTo(h * 0.03, 0);
  context.lineTo(0, -h * 0.28);
  context.lineTo(-h * 0.03, 0);
  context.lineTo(-h * 0.14, 0);
  context.lineTo(-h * 0.12, -h * 0.35);
  context.closePath();
  context.fillStyle = linear(context, -h * 0.16, 0, h * 0.16, 0, [
    [0, day ? '#0b2f45' : '#062030'],
    [1, day ? '#1d6f93' : '#0f5670'],
  ]);
  context.fill();
  context.strokeStyle = p.hero;
  context.lineWidth = Math.max(1, h * 0.035);
  context.stroke();
  // A lit visor, so the figure reads as a person, not a sign.
  context.fillStyle = p.hero;
  context.fillRect(-h * 0.07, -h * 0.9, h * 0.14, h * 0.035);
  context.restore();
  // Motes streaming upward as the teleport takes hold.
  for (const mote of scatter('robots-teleport', 26)) {
    const age = (t * 0.45 * mote.speed + mote.phase / TAU) % 1;
    const x = spot.x + (mote.x - 0.5) * h * 0.8;
    const y = spot.y - age * h * 2.1;
    context.fillStyle = withOpacity(p.hero, (1 - age) * 0.9);
    const size = Math.max(1, h * 0.03 * (0.5 + mote.size));
    context.fillRect(x - size / 2, y - size / 2, size, size);
  }
}

function paintHeap(
  context: CanvasRenderingContext2D,
  a: Arena,
  p: RobotsPalette,
  t: number,
  day: boolean,
) {
  const spot = onFloor(a, HEAP.lateral, HEAP.depth);
  const h = a.reach * HEAP.depth;
  glow(
    context,
    spot.x,
    spot.y - h * 0.08,
    h * 0.45,
    p.ember,
    day ? 0.4 : 0.6 + 0.2 * breathe(t, 0.9),
  );
  context.fillStyle = radial(context, spot.x, spot.y, 0, h * 0.4, [
    [0, withOpacity(p.shadow, day ? 0.3 : 0.55)],
    [1, withOpacity(p.shadow, 0)],
  ]);
  context.beginPath();
  context.ellipse(spot.x, spot.y, h * 0.42, h * 0.08, 0, 0, TAU);
  context.fill();
  // Tangled plates and a toppled head.
  const plates: [dx: number, dy: number, w: number, hh: number, angle: number, tone: number][] = [
    [-0.18, -0.08, 0.34, 0.16, -0.3, 1],
    [0.12, -0.1, 0.3, 0.18, 0.4, 0],
    [-0.02, -0.22, 0.26, 0.14, -0.9, 2],
    [0.22, -0.02, 0.2, 0.1, 0.1, 1],
  ];
  for (const [dx, dy, w, hh, angle, tone] of plates) {
    context.save();
    context.translate(spot.x + dx * h, spot.y + dy * h);
    context.rotate(angle);
    context.fillStyle = p.metal[tone] as string;
    roundedRect(context, (-w * h) / 2, (-hh * h) / 2, w * h, hh * h, h * 0.02);
    context.fill();
    context.strokeStyle = withOpacity(p.ember, 0.6);
    context.lineWidth = Math.max(0.8, h * 0.008);
    context.stroke();
    context.restore();
  }
  // Smoke.
  for (let puff = 0; puff < 6; puff++) {
    const age = (((t * 0.12 + puff / 6) % 1) + 1) % 1;
    glow(
      context,
      spot.x + Math.sin(age * 5 + puff) * h * 0.08,
      spot.y - h * (0.2 + age * 0.9),
      h * (0.12 + age * 0.3),
      p.smoke,
      (1 - age) * (day ? 0.45 : 0.6),
    );
  }
  // Sparks spitting out of the wreck.
  context.lineCap = 'round';
  for (const spark of scatter('robots-sparks', 28)) {
    const age = (t * 0.9 * spark.speed + spark.phase / TAU) % 1;
    const vx = (spark.x - 0.5) * h * 1.1;
    const vy = h * (0.5 + spark.y * 0.6);
    const x = spot.x + vx * age;
    const y = spot.y - h * 0.15 - vy * age + h * 1.2 * age * age;
    context.strokeStyle = withOpacity(p.spark, 1 - age);
    context.lineWidth = Math.max(0.8, h * 0.008);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - vx * 0.04, y + (vy - 2.4 * h * age) * 0.04);
    context.stroke();
  }
}

function paintRobots(context: CanvasRenderingContext2D, frame: PosterFrame) {
  const day = frame.appearance === 'light';
  const p = day ? DAY : NIGHT;
  const a = layout(frame.width, frame.height);
  const ratio = pixelRatio(context);
  context.drawImage(
    cachedLayer(
      layerKey('robots-arena', frame.width, frame.height, ratio, day ? 'day' : 'night'),
      frame.width,
      frame.height,
      ratio,
      (layer) => paintArena(layer, a, p, day),
    ),
    0,
    0,
    frame.width,
    frame.height,
  );
  const t = frame.t;
  paintSpotlights(context, a, p, t, day);
  // Draw far to near so nearer robots overlap the rest.
  const scene: { depth: number; draw: () => void }[] = [
    ...ROBOTS.map((robot) => ({
      depth: robot.depth,
      draw: () => paintRobotAt(context, a, p, robot, t, day, ratio),
    })),
    { depth: HERO.depth, draw: () => paintHero(context, a, p, t, day) },
    { depth: HEAP.depth, draw: () => paintHeap(context, a, p, t, day) },
  ];
  scene.sort((x, y) => x.depth - y.depth).forEach((thing) => thing.draw());
  vignette(context, a.c, day ? 0.18 : 0.5, day ? '#3a2d5c' : '#000000');
}

export const robotsArt: PosterArt = { animated: true, draw: paintRobots };
