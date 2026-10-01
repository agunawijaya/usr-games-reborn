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
  type Speck,
  TAU,
  vignette,
  withOpacity,
} from '../shapes';

/**
 * Placeholder key art for trek, drawn by the Hall until the game supplies its own poster().
 *
 * Deep space: a nebula, stars drifting in three depths, a planet filling the lower right with
 * its star rising over the limb, and a sleek, generic delta-winged ship crossing in front of the
 * sunrise, rim-lit from behind. No franchise shapes, names or insignia.
 */

interface TrekPalette {
  space: readonly [string, string, string];
  nebula: readonly string[];
  nebulaAlpha: number;
  ocean: readonly [string, string];
  land: string;
  cloud: string;
  atmosphere: string;
  nightShade: number;
  city: string;
  sun: string;
  sunHalo: string;
  hull: readonly [string, string];
  rim: string;
  engine: string;
  window: string;
}

const NIGHT: TrekPalette = {
  space: ['#010208', '#060a20', '#0d1030'],
  nebula: ['#8a2a8f', '#3b2a9c', '#1d7f9a', '#c24a7a'],
  nebulaAlpha: 0.32,
  ocean: ['#16427a', '#081830'],
  land: '#2c4a3c',
  cloud: '#dfe8ff',
  atmosphere: '#5cbcff',
  nightShade: 0.985,
  city: '#ffc978',
  sun: '#fff6e6',
  sunHalo: '#ffae6b',
  hull: ['#1d2333', '#0a0d15'],
  rim: '#ffd9a6',
  engine: '#86dcff',
  window: '#ffcf7a',
};

const DAY: TrekPalette = {
  space: ['#0b1446', '#1c3386', '#4566c4'],
  nebula: ['#ff7ac8', '#8a8cff', '#4fe0d8', '#ffc27a'],
  nebulaAlpha: 0.42,
  ocean: ['#2f8ad8', '#123c74'],
  land: '#4f8a52',
  cloud: '#ffffff',
  atmosphere: '#a4e2ff',
  nightShade: 0.72,
  city: '#ffe2a8',
  sun: '#ffffff',
  sunHalo: '#ffd49a',
  hull: ['#4e5b78', '#212839'],
  rim: '#fff3dc',
  engine: '#9fe6ff',
  window: '#ffe3a0',
};

interface Space {
  c: Composition;
  planetX: number;
  planetY: number;
  planetR: number;
  /** Where the star breaks over the planet's limb. */
  sunX: number;
  sunY: number;
  shipX: number;
  shipY: number;
  shipLength: number;
}

function layout(width: number, height: number): Space {
  const c = compose(width, height);
  if (c.portrait) {
    const planetR = width * 0.95;
    const planetX = width * 0.62;
    const planetY = height + planetR * 0.52;
    return {
      c,
      planetX,
      planetY,
      planetR,
      ...limbPoint(planetX, planetY, planetR, -1.35),
      shipX: width * 0.48,
      shipY: height * 0.36,
      shipLength: width * 0.78,
    };
  }
  const planetR = height * 0.95;
  const planetX = width * 0.86;
  const planetY = height * 1.2;
  return {
    c,
    planetX,
    planetY,
    planetR,
    ...limbPoint(planetX, planetY, planetR, -1.66),
    shipX: width * 0.58,
    shipY: height * 0.42,
    shipLength: Math.min(width * 0.3, height * 0.85),
  };
}

function limbPoint(cx: number, cy: number, r: number, angle: number) {
  return { sunX: cx + Math.cos(angle) * r, sunY: cy + Math.sin(angle) * r };
}

// ---- Deep space: gradient and nebula, painted once per size.

function paintSpace(context: CanvasRenderingContext2D, s: Space, p: TrekPalette) {
  const { width, height } = s.c;
  context.fillStyle = linear(context, 0, 0, width * 0.3, height, [
    [0, p.space[0]],
    [0.6, p.space[1]],
    [1, p.space[2]],
  ]);
  context.fillRect(0, 0, width, height);
  // The nebula: many soft clouds of colour, heavier toward the ship's side of the frame.
  context.save();
  context.globalCompositeOperation = 'lighter';
  scatter('trek-nebula', 46).forEach((cloud, index) => {
    const x = width * (0.3 + cloud.x * 0.75);
    const y = height * (cloud.y * 0.85);
    const r = s.c.unit * (0.15 + cloud.size * 0.5);
    const color = p.nebula[index % p.nebula.length] as string;
    context.fillStyle = radial(context, x, y, 0, r, [
      [0, withOpacity(color, p.nebulaAlpha * (0.3 + cloud.size * 0.5))],
      [1, withOpacity(color, 0)],
    ]);
    context.fillRect(x - r, y - r, r * 2, r * 2);
  });
  context.restore();
  // A dark dust lane through the nebula gives it shape.
  context.save();
  context.filter = `blur(${(s.c.unit * 0.04).toFixed(1)}px)`;
  context.strokeStyle = withOpacity(p.space[0], 0.55);
  context.lineWidth = s.c.unit * 0.08;
  context.beginPath();
  context.moveTo(width * 0.35, height * 0.05);
  context.bezierCurveTo(
    width * 0.55,
    height * 0.3,
    width * 0.7,
    height * 0.05,
    width * 1.05,
    height * 0.25,
  );
  context.stroke();
  context.restore();
}

// ---- The planet, its star and atmosphere, painted once per size.

/**
 * Continents as clusters of blurred patches around a few seeded centres, then long, thin,
 * blurred cloud streaks curving with the sphere. Blur is fine: this layer is painted once.
 */
function paintSurface(context: CanvasRenderingContext2D, s: Space, p: TrekPalette) {
  const { planetX: cx, planetY: cy, planetR: r } = s;
  const centres = scatter('trek-continents', 5);
  context.save();
  context.filter = `blur(${(r * 0.012).toFixed(1)}px)`;
  context.fillStyle = withOpacity(p.land, 0.9);
  centres.forEach((centre, index) => {
    const angle = -Math.PI * (0.5 + centre.x * 0.55);
    const distance = r * (0.5 + centre.y * 0.45);
    const x0 = cx + Math.cos(angle) * distance;
    const y0 = cy + Math.sin(angle) * distance;
    context.beginPath();
    for (const patch of scatter(`trek-continent-${index}`, 22)) {
      const spread = r * (0.06 + centre.size * 0.12);
      const x = x0 + (patch.x - 0.5) * spread * 2.2;
      const y = y0 + (patch.y - 0.5) * spread * 1.2;
      const size = r * (0.012 + patch.size * 0.04);
      context.moveTo(x + size, y);
      context.ellipse(x, y, size, size * 0.6, angle, 0, TAU);
    }
    context.fill();
  });
  // Weather: long, soft swirls following the sphere, not streaks.
  context.filter = `blur(${(r * 0.01).toFixed(1)}px)`;
  context.lineCap = 'round';
  for (const swirl of scatter('trek-cloud-swirls', 16)) {
    const radius = r * (0.4 + swirl.y * 0.58);
    const start = -Math.PI * (0.4 + swirl.x * 0.65);
    context.strokeStyle = withOpacity(p.cloud, 0.08 + swirl.size * 0.18);
    context.lineWidth = r * (0.012 + swirl.size * 0.03);
    context.beginPath();
    context.arc(cx, cy, radius, start, start + 0.15 + swirl.speed * 0.25);
    context.stroke();
  }
  context.restore();
}

function paintPlanet(context: CanvasRenderingContext2D, s: Space, p: TrekPalette) {
  const { planetX: cx, planetY: cy, planetR: r } = s;
  const toSunX = (s.sunX - cx) / r;
  const toSunY = (s.sunY - cy) / r;
  context.save();
  context.beginPath();
  context.arc(cx, cy, r, 0, TAU);
  context.clip();
  context.fillStyle = radial(context, cx + toSunX * r * 0.5, cy + toSunY * r * 0.5, 0, r * 1.4, [
    [0, p.ocean[0]],
    [1, p.ocean[1]],
  ]);
  context.fillRect(cx - r, cy - r, r * 2, r * 2);
  paintSurface(context, s, p);
  // Night side: most of the planet faces away from its star.
  context.fillStyle = radial(
    context,
    cx + toSunX * r * 1.05,
    cy + toSunY * r * 1.05,
    r * 0.25,
    r * 1.6,
    [
      [0, withOpacity('#000000', 0)],
      [0.35, withOpacity('#000000', p.nightShade * 0.55)],
      [0.62, withOpacity('#000000', p.nightShade)],
      [1, withOpacity('#000000', p.nightShade)],
    ],
  );
  context.fillRect(cx - r, cy - r, r * 2, r * 2);
  // City lights glowing on the dark side; by day the star drowns them out.
  const cities = p.nightShade > 0.9 ? scatter('trek-cities', 90) : [];
  for (const city of cities) {
    const angle = -Math.PI * (0.62 + city.x * 0.36);
    const distance = r * (0.6 + city.y * 0.38);
    const x = cx + Math.cos(angle) * distance;
    const y = cy + Math.sin(angle) * distance;
    const lit = Math.hypot(x - s.sunX, y - s.sunY) / r;
    if (lit < 0.55) continue;
    context.fillStyle = withOpacity(p.city, 0.35 + city.size * 0.45);
    context.fillRect(x, y, Math.max(1, r * 0.004), Math.max(1, r * 0.004));
  }
  context.restore();
  // Atmosphere: a thin luminous rim, brightest toward the star.
  const sunAngle = Math.atan2(s.sunY - cy, s.sunX - cx);
  const conic = context.createConicGradient(sunAngle - Math.PI, cx, cy);
  conic.addColorStop(0, withOpacity(p.atmosphere, 0));
  conic.addColorStop(0.3, withOpacity(p.atmosphere, 0.05));
  conic.addColorStop(0.5, withOpacity(p.atmosphere, 1));
  conic.addColorStop(0.7, withOpacity(p.atmosphere, 0.05));
  conic.addColorStop(1, withOpacity(p.atmosphere, 0));
  context.save();
  context.filter = `blur(${(r * 0.012).toFixed(1)}px)`;
  context.strokeStyle = conic;
  context.lineWidth = r * 0.035;
  context.beginPath();
  context.arc(cx, cy, r * 1.005, 0, TAU);
  context.stroke();
  context.restore();
}

// ---- The ship: a sleek delta, painted once per size, dark against the sunrise with a lit rim.

function shipOutline(context: CanvasRenderingContext2D, L: number) {
  context.beginPath();
  context.moveTo(-0.5 * L, 0);
  context.bezierCurveTo(-0.32 * L, -0.045 * L, -0.12 * L, -0.07 * L, 0.12 * L, -0.085 * L);
  context.lineTo(0.44 * L, -0.08 * L);
  context.lineTo(0.5 * L, -0.03 * L);
  context.lineTo(0.49 * L, 0.05 * L);
  context.lineTo(0.12 * L, 0.07 * L);
  context.bezierCurveTo(-0.1 * L, 0.06 * L, -0.3 * L, 0.035 * L, -0.5 * L, 0);
  context.closePath();
}

function paintShip(context: CanvasRenderingContext2D, p: TrekPalette, L: number) {
  const body = linear(context, 0, -0.1 * L, 0, 0.08 * L, [
    [0, p.hull[0]],
    [1, p.hull[1]],
  ]);
  // Far wing, behind the hull.
  context.fillStyle = p.hull[1];
  context.beginPath();
  context.moveTo(-0.02 * L, -0.05 * L);
  context.lineTo(0.3 * L, -0.24 * L);
  context.lineTo(0.42 * L, -0.24 * L);
  context.lineTo(0.4 * L, -0.07 * L);
  context.closePath();
  context.fill();
  // Dorsal fin.
  context.beginPath();
  context.moveTo(0.2 * L, -0.08 * L);
  context.lineTo(0.36 * L, -0.19 * L);
  context.lineTo(0.43 * L, -0.19 * L);
  context.lineTo(0.44 * L, -0.08 * L);
  context.closePath();
  context.fill();
  // Engine pods.
  for (const y of [-0.045, 0.035]) {
    context.fillStyle = body;
    context.beginPath();
    context.roundRect(0.28 * L, (y - 0.03) * L, 0.26 * L, 0.06 * L, 0.02 * L);
    context.fill();
  }
  // Hull.
  shipOutline(context, L);
  context.fillStyle = body;
  context.fill();
  // Near wing, swept back below the hull.
  context.beginPath();
  context.moveTo(-0.12 * L, 0.04 * L);
  context.lineTo(0.28 * L, 0.26 * L);
  context.lineTo(0.42 * L, 0.26 * L);
  context.lineTo(0.38 * L, 0.06 * L);
  context.closePath();
  context.fillStyle = linear(context, -0.12 * L, 0, 0.42 * L, 0, [
    [0, p.hull[1]],
    [1, p.hull[0]],
  ]);
  context.fill();
  // The dorsal plane catches the nebula's light; the belly stays dark.
  context.save();
  shipOutline(context, L);
  context.clip();
  context.fillStyle = linear(context, 0, -0.09 * L, 0, 0.0, [
    [0, withOpacity(p.rim, 0.4)],
    [0.45, withOpacity(p.rim, 0.12)],
    [1, withOpacity(p.rim, 0)],
  ]);
  context.fillRect(-0.5 * L, -0.1 * L, L, 0.1 * L);
  // A metallic sheen sliding back along the spine toward the light.
  context.fillStyle = linear(context, -0.2 * L, 0, 0.5 * L, 0, [
    [0, withOpacity('#ffffff', 0)],
    [0.8, withOpacity('#ffffff', 0.12)],
    [1, withOpacity(p.rim, 0.3)],
  ]);
  context.fillRect(-0.2 * L, -0.09 * L, 0.7 * L, 0.05 * L);
  context.fillStyle = withOpacity('#000000', 0.45);
  context.fillRect(-0.5 * L, 0.02 * L, L, 0.06 * L);
  // Greebles along the spine.
  context.fillStyle = withOpacity(p.hull[0], 0.9);
  for (const [x, w] of [
    [0.05, 0.06],
    [0.15, 0.04],
    [0.24, 0.07],
  ] as const) {
    context.fillRect(x * L, -0.095 * L, w * L, 0.018 * L);
  }
  context.restore();
  // Leading edges of the wings, lit.
  context.strokeStyle = withOpacity(p.rim, 0.45);
  context.lineWidth = Math.max(0.8, L * 0.004);
  context.beginPath();
  context.moveTo(-0.12 * L, 0.045 * L);
  context.lineTo(0.28 * L, 0.26 * L);
  context.moveTo(-0.02 * L, -0.05 * L);
  context.lineTo(0.3 * L, -0.24 * L);
  context.stroke();
  // Panel lines and a row of lit windows.
  context.strokeStyle = withOpacity(p.rim, 0.12);
  context.lineWidth = Math.max(0.5, L * 0.002);
  context.beginPath();
  for (const x of [-0.2, -0.02, 0.16, 0.3]) {
    context.moveTo(x * L, -0.08 * L);
    context.lineTo((x + 0.02) * L, 0.065 * L);
  }
  context.moveTo(-0.4 * L, 0.004 * L);
  context.lineTo(0.48 * L, 0.004 * L);
  context.stroke();
  context.fillStyle = p.window;
  for (let w = 0; w < 14; w++) {
    context.fillRect((-0.18 + w * 0.042) * L, -0.03 * L, L * 0.008, L * 0.005);
  }
  // Canopy.
  context.fillStyle = withOpacity(p.engine, 0.85);
  context.beginPath();
  context.ellipse(-0.3 * L, -0.028 * L, 0.06 * L, 0.012 * L, -0.12, 0, TAU);
  context.fill();
  // Rim light from the sunrise behind: along the top edges and the back.
  shipOutline(context, L);
  context.strokeStyle = linear(context, -0.5 * L, 0, 0.5 * L, 0, [
    [0, withOpacity(p.rim, 0.15)],
    [0.6, withOpacity(p.rim, 0.55)],
    [1, withOpacity(p.rim, 1)],
  ]);
  context.lineWidth = Math.max(1, L * 0.006);
  context.stroke();
  context.beginPath();
  context.moveTo(0.3 * L, -0.24 * L);
  context.lineTo(0.42 * L, -0.24 * L);
  context.moveTo(0.36 * L, -0.19 * L);
  context.lineTo(0.43 * L, -0.19 * L);
  context.moveTo(0.28 * L, 0.26 * L);
  context.lineTo(0.42 * L, 0.26 * L);
  context.stroke();
}

function shipLayer(s: Space, p: TrekPalette, day: boolean, ratio: number) {
  const L = s.shipLength;
  const width = L * 1.1;
  const height = L * 0.6;
  return {
    canvas: cachedLayer(
      layerKey('trek-ship', width, height, ratio, day ? 'day' : 'night'),
      width,
      height,
      ratio,
      (context) => {
        context.translate(width / 2, height / 2);
        paintShip(context, p, L);
      },
    ),
    width,
    height,
  };
}

// ---- Things that move: stars, the flare, engines.

interface StarLayer {
  specks: Speck[];
  speed: number;
  size: number;
  alpha: number;
}

const STAR_LAYERS: readonly StarLayer[] = [
  { specks: scatter('trek-stars-far', 260), speed: 0.004, size: 1, alpha: 0.55 },
  { specks: scatter('trek-stars-mid', 110), speed: 0.012, size: 1.5, alpha: 0.8 },
  { specks: scatter('trek-stars-near', 26), speed: 0.03, size: 2.2, alpha: 1 },
];

function paintStars(context: CanvasRenderingContext2D, s: Space, t: number, day: boolean) {
  const { width, height } = s.c;
  const density = Math.min(1, (width * height) / (1920 * 650) + 0.25);
  for (const layer of STAR_LAYERS) {
    const count = Math.round(layer.specks.length * density);
    for (let i = 0; i < count; i++) {
      const star = layer.specks[i]!;
      const x = ((((star.x - t * layer.speed) % 1) + 1) % 1) * width;
      const y = star.y * height;
      const twinkle = 0.6 + 0.4 * Math.sin(t * 2 * star.speed + star.phase);
      context.fillStyle = withOpacity(
        '#ffffff',
        layer.alpha * twinkle * (day ? 0.8 : 1) * (0.4 + star.size * 0.6),
      );
      const size = layer.size * (0.6 + star.size * 0.7);
      context.fillRect(x, y, size, size);
      if (layer === STAR_LAYERS[2] && star.size > 0.6)
        glow(context, x, y, size * 4, '#cfe3ff', 0.35 * twinkle);
    }
  }
}

function paintSunrise(context: CanvasRenderingContext2D, s: Space, p: TrekPalette, t: number) {
  const pulse = 0.9 + 0.1 * breathe(t, 3.3);
  const unit = s.c.unit;
  glow(context, s.sunX, s.sunY, unit * 0.9, p.sunHalo, 0.5 * pulse);
  glow(context, s.sunX, s.sunY, unit * 0.28, p.sun, 0.95 * pulse);
  glow(context, s.sunX, s.sunY, unit * 0.08, '#ffffff', 1);
  // An anamorphic streak across the frame, the lens catching the light.
  const reach = s.c.width * 0.3;
  context.fillStyle = linear(context, s.sunX - reach, 0, s.sunX + reach, 0, [
    [0, withOpacity(p.sunHalo, 0)],
    [0.5, withOpacity('#ffffff', 0.45 * pulse)],
    [1, withOpacity(p.sunHalo, 0)],
  ]);
  context.fillRect(s.sunX - reach, s.sunY - unit * 0.003, reach * 2, unit * 0.006);
  // Ghosts along the line through the frame's centre.
  const dx = s.c.width * 0.5 - s.sunX;
  const dy = s.c.height * 0.5 - s.sunY;
  for (const [along, size, alpha] of [
    [0.5, 0.05, 0.18],
    [0.9, 0.09, 0.1],
    [1.3, 0.035, 0.2],
  ] as const) {
    glow(context, s.sunX + dx * along, s.sunY + dy * along, unit * size, p.engine, alpha);
  }
}

function paintTrek(context: CanvasRenderingContext2D, frame: PosterFrame) {
  const day = frame.appearance === 'light';
  const p = day ? DAY : NIGHT;
  const s = layout(frame.width, frame.height);
  const ratio = pixelRatio(context);
  const variant = day ? 'day' : 'night';
  const t = frame.t;
  const full = (name: string, paint: (layer: CanvasRenderingContext2D) => void) =>
    context.drawImage(
      cachedLayer(
        layerKey(name, frame.width, frame.height, ratio, variant),
        frame.width,
        frame.height,
        ratio,
        paint,
      ),
      0,
      0,
      frame.width,
      frame.height,
    );
  full('trek-space', (layer) => paintSpace(layer, s, p));
  paintStars(context, s, t, day);
  full('trek-planet', (layer) => paintPlanet(layer, s, p));
  paintSunrise(context, s, p, t);
  // The ship drifts gently along its course; engines flicker.
  const ship = shipLayer(s, p, day, ratio);
  const drift = Math.sin(t * 0.35) * s.shipLength * 0.02;
  const angle = -0.16 + Math.sin(t * 0.3) * 0.01;
  context.save();
  context.translate(s.shipX + drift, s.shipY - drift * 0.4);
  context.rotate(angle);
  const L = s.shipLength;
  const flicker = 0.8 + 0.2 * Math.sin(t * 13) * Math.sin(t * 7.3);
  context.fillStyle = linear(context, 0.5 * L, 0, 1.3 * L, 0, [
    [0, withOpacity(p.engine, 0.45 * flicker)],
    [1, withOpacity(p.engine, 0)],
  ]);
  for (const y of [-0.045, 0.035]) context.fillRect(0.52 * L, (y - 0.018) * L, 0.8 * L, 0.036 * L);
  // The sunrise behind blooms around the ship's tail.
  glow(context, 0.42 * L, -0.06 * L, L * 0.35, p.sunHalo, 0.3);
  context.drawImage(ship.canvas, -ship.width / 2, -ship.height / 2, ship.width, ship.height);
  for (const y of [-0.045, 0.035]) {
    glow(context, 0.54 * L, y * L, L * 0.09, p.engine, flicker);
    glow(context, 0.54 * L, y * L, L * 0.025, '#ffffff', 1);
  }
  // Navigation lights on the wingtips, blinking out of step.
  glow(context, 0.4 * L, 0.26 * L, L * 0.03, '#3dff8a', breathe(t, 1.3) > 0.5 ? 1 : 0.2);
  glow(context, 0.4 * L, -0.24 * L, L * 0.03, '#ff4a4a', breathe(t, 1.3, Math.PI) > 0.5 ? 1 : 0.2);
  context.restore();
  vignette(context, s.c, day ? 0.3 : 0.55);
}

export const trekArt: PosterArt = { animated: true, draw: paintTrek };
