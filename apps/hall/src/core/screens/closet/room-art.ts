import { createRng, type Rng, withAlpha } from '@usr-games/kit';

/**
 * The server closet, painted on a canvas: a raised floor, two racks of blinking equipment with
 * patch cables slung between them, a lamp hanging from the ceiling, a wall fan, and a desk where
 * an old monitor scrolls the names of the people who wrote the original games. Everything is
 * drawn from the time `t` in seconds, so a frozen frame and a live one are the same picture.
 */

export type Lights = 'warm' | 'cool' | 'party';

export interface RoomState {
  lights: Lights;
  fan: boolean;
  /** When the rack was last rebooted, on the same clock as `t`. */
  rebootedAt: number | null;
}

export interface RoomColours {
  accent: string;
  accent2: string;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const WALL_TOP = '#0c0f18';
const WALL_BOTTOM = '#151a29';
const FLOOR_NEAR = '#0a0c13';
const FLOOR_FAR = '#121624';
const METAL = '#1b2031';
const METAL_EDGE = '#2a3149';
const FACEPLATE = '#222840';
const LED_OFF = '#2f364d';
const REBOOT_SECONDS = 2.4;

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) =>
    Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function lampColour(lights: Lights, t: number): string {
  if (lights === 'warm') return '#ffb86b';
  if (lights === 'cool') return '#8fd8ff';
  return hslToHex((t * 70) % 360, 90, 66);
}

/** How far the reboot has got: 0 just switched off, 1 fully back (or never rebooted). */
function rebootProgress(state: RoomState, t: number): number {
  if (state.rebootedAt === null) return 1;
  return Math.min(1, Math.max(0, (t - state.rebootedAt) / REBOOT_SECONDS));
}

function drawWallAndFloor(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  floorY: number,
) {
  const wall = context.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, WALL_TOP);
  wall.addColorStop(1, WALL_BOTTOM);
  context.fillStyle = wall;
  context.fillRect(0, 0, width, floorY);

  // Wall panels, just visible.
  context.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  context.lineWidth = 1;
  for (let x = width / 9; x < width; x += width / 9) {
    context.beginPath();
    context.moveTo(Math.round(x) + 0.5, 0);
    context.lineTo(Math.round(x) + 0.5, floorY);
    context.stroke();
  }

  const floor = context.createLinearGradient(0, floorY, 0, height);
  floor.addColorStop(0, FLOOR_FAR);
  floor.addColorStop(1, FLOOR_NEAR);
  context.fillStyle = floor;
  context.fillRect(0, floorY, width, height - floorY);
  context.fillStyle = '#1f2537';
  context.fillRect(0, floorY - 3, width, 4);

  // Raised-floor tiles in perspective, converging on a point high above the room.
  context.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  const depth = height - floorY;
  for (let row = 1; row <= 5; row++) {
    const y = floorY + depth * (row / 5) ** 1.5;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  const vanishX = width * 0.5;
  const vanishY = floorY - height * 1.4;
  for (let column = -12; column <= 12; column++) {
    const bottomX = vanishX + column * width * 0.1;
    const topX = vanishX + (bottomX - vanishX) * ((floorY - vanishY) / (height - vanishY));
    context.beginPath();
    context.moveTo(topX, floorY);
    context.lineTo(bottomX, height);
    context.stroke();
  }
}

function drawLamp(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  x: number,
  colour: string,
  brightness: number,
) {
  const shadeTop = height * 0.1;
  const shadeBottom = shadeTop + Math.max(16, height * 0.05);
  const halfBottom = Math.max(18, width * 0.022);

  // The pool of light: a soft cone down to the floor and a glow around the bulb.
  context.save();
  context.globalCompositeOperation = 'screen';
  const cone = context.createLinearGradient(0, shadeBottom, 0, height);
  cone.addColorStop(0, withAlpha(colour, 0.2 * brightness));
  cone.addColorStop(1, withAlpha(colour, 0.03 * brightness));
  context.fillStyle = cone;
  context.beginPath();
  context.moveTo(x - halfBottom * 0.8, shadeBottom);
  context.lineTo(x + halfBottom * 0.8, shadeBottom);
  context.lineTo(x + width * 0.24, height);
  context.lineTo(x - width * 0.24, height);
  context.closePath();
  context.fill();
  const glow = context.createRadialGradient(x, shadeBottom, 0, x, shadeBottom, height * 0.95);
  glow.addColorStop(0, withAlpha(colour, 0.34 * brightness));
  glow.addColorStop(0.35, withAlpha(colour, 0.1 * brightness));
  glow.addColorStop(1, withAlpha(colour, 0));
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.restore();

  context.strokeStyle = '#2b3146';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, shadeTop);
  context.stroke();
  context.fillStyle = '#2a3045';
  context.beginPath();
  context.moveTo(x - 7, shadeTop);
  context.lineTo(x + 7, shadeTop);
  context.lineTo(x + halfBottom, shadeBottom);
  context.lineTo(x - halfBottom, shadeBottom);
  context.closePath();
  context.fill();
  context.fillStyle = withAlpha(colour, 0.35 + 0.65 * brightness);
  context.beginPath();
  context.ellipse(x, shadeBottom, halfBottom * 0.55, 4, 0, 0, Math.PI * 2);
  context.fill();
}

type UnitKind = 'server' | 'switch' | 'drives' | 'blank';

function drawLed(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colour: string | null,
) {
  context.fillStyle = colour ?? LED_OFF;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  if (!colour) return;
  context.fillStyle = withAlpha(colour, 0.22);
  context.beginPath();
  context.arc(x, y, radius * 2.6, 0, Math.PI * 2);
  context.fill();
}

function drawRack(
  context: CanvasRenderingContext2D,
  rack: Box,
  units: number,
  seed: string,
  t: number,
  reboot: number,
  palette: readonly string[],
) {
  const random: Rng = createRng(seed);
  const { x, y, width, height } = rack;
  context.fillStyle = METAL;
  context.fillRect(x, y, width, height);
  context.fillStyle = METAL_EDGE;
  context.fillRect(x, y, 6, height);
  context.fillRect(x + width - 6, y, 6, height);
  context.fillRect(x - 3, y - 6, width + 6, 8);
  context.fillStyle = '#10131d';
  context.fillRect(x + 6, y + height - 4, 10, 8);
  context.fillRect(x + width - 16, y + height - 4, 10, 8);

  const inner = { x: x + 10, width: width - 20 };
  const pitch = (height - 20) / units;
  for (let unit = 0; unit < units; unit++) {
    const kind = random.pick<UnitKind>(['server', 'server', 'switch', 'drives', 'blank']);
    const top = y + 10 + unit * pitch;
    const plate = pitch - 5;
    context.fillStyle = FACEPLATE;
    context.fillRect(inner.x, top, inner.width, plate);
    context.fillStyle = 'rgba(255, 255, 255, 0.04)';
    context.fillRect(inner.x, top, inner.width, 1.5);
    // A reboot switches the rack off from the top and brings it back unit by unit.
    const powered = reboot >= 1 || reboot > 0.35 + (unit / units) * 0.6;
    const middle = top + plate / 2;

    if (kind === 'blank') {
      context.fillStyle = '#1a1f31';
      for (let slot = 0; slot < 8; slot++) {
        context.fillRect(
          inner.x + 10 + slot * (inner.width / 9),
          middle - 1.5,
          inner.width / 14,
          3,
        );
      }
      continue;
    }
    if (kind === 'drives') {
      const bays = 6;
      const bayWidth = (inner.width - 24) / bays;
      for (let bay = 0; bay < bays; bay++) {
        const bx = inner.x + 8 + bay * bayWidth;
        context.fillStyle = '#191d2c';
        context.fillRect(bx, top + 3, bayWidth - 4, plate - 6);
        const busy = powered && (t * 3 + random.float(0, 5)) % 1.3 < 0.18;
        drawLed(
          context,
          bx + bayWidth - 9,
          top + 7,
          1.6,
          busy ? palette[1]! : powered ? palette[3]! : null,
        );
      }
      continue;
    }
    if (kind === 'switch') {
      const ports = 12;
      const portWidth = (inner.width - 30) / ports;
      for (let port = 0; port < ports; port++) {
        const px = inner.x + 12 + port * portWidth;
        context.fillStyle = '#0f121c';
        context.fillRect(px, middle - 3, portWidth - 3, 7);
        const blink = powered && (t * 2.2 + random.float(0, 4)) % 1 < random.float(0.3, 0.8);
        drawLed(context, px + (portWidth - 3) / 2, middle - 6, 1.2, blink ? palette[3]! : null);
      }
      continue;
    }
    // A server: vents on the left, a row of status lights on the right.
    context.fillStyle = '#1a1f31';
    for (let vent = 0; vent < 5; vent++) {
      context.fillRect(inner.x + 8 + vent * 6, top + 3, 3, plate - 6);
    }
    const leds = 6;
    for (let led = 0; led < leds; led++) {
      const period = random.float(0.5, 2.8);
      const phase = random.float(0, 3);
      const on = powered && ((t + phase) % period) / period < 0.6;
      const colour = palette[led % palette.length]!;
      drawLed(context, inner.x + inner.width - 14 - led * 11, middle, 2.2, on ? colour : null);
    }
  }
}

function drawCables(
  context: CanvasRenderingContext2D,
  from: Box,
  to: Box,
  colours: readonly string[],
) {
  context.lineWidth = 3;
  context.lineCap = 'round';
  colours.forEach((colour, index) => {
    const startY = from.y + from.height * (0.18 + index * 0.09);
    const endY = to.y + to.height * (0.14 + index * 0.1);
    const sag = 26 + index * 12;
    const startX = from.x + from.width - 8;
    const endX = to.x + 8;
    context.strokeStyle = withAlpha(colour, 0.85);
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(startX + 18, startY + sag, endX - 18, endY + sag, endX, endY);
    context.stroke();
  });

  // A bundle climbs from the big rack into the tray under the ceiling.
  context.strokeStyle = '#262c40';
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(to.x + to.width * 0.3, to.y - 6);
  context.bezierCurveTo(
    to.x + to.width * 0.3,
    to.y - 30,
    to.x + to.width * 0.1,
    22,
    to.x - to.width * 0.2,
    18,
  );
  context.stroke();
}

function drawCableTray(context: CanvasRenderingContext2D, width: number) {
  context.fillStyle = '#181c2a';
  context.fillRect(0, 10, width * 0.5, 10);
  context.fillStyle = '#232941';
  for (let x = 8; x < width * 0.5; x += 22) context.fillRect(x, 10, 3, 10);
}

function drawWallFan(
  context: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  size: number,
  angle: number,
) {
  const half = size / 2;
  context.fillStyle = '#171b29';
  context.beginPath();
  context.roundRect(centreX - half, centreY - half, size, size, size * 0.12);
  context.fill();
  context.strokeStyle = METAL_EDGE;
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = '#0b0d14';
  context.beginPath();
  context.arc(centreX, centreY, half * 0.82, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#4c556f';
  for (let blade = 0; blade < 5; blade++) {
    context.save();
    context.translate(centreX, centreY);
    context.rotate(angle + (blade * Math.PI * 2) / 5);
    context.beginPath();
    context.ellipse(half * 0.4, 0, half * 0.38, half * 0.13, 0.35, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.fillStyle = '#2d344b';
  context.beginPath();
  context.arc(centreX, centreY, half * 0.14, 0, Math.PI * 2);
  context.fill();

  // The grille in front of the blades.
  context.strokeStyle = 'rgba(120, 132, 168, 0.35)';
  context.lineWidth = 1.2;
  for (const ring of [0.3, 0.55, 0.8]) {
    context.beginPath();
    context.arc(centreX, centreY, half * ring, 0, Math.PI * 2);
    context.stroke();
  }
  context.beginPath();
  context.moveTo(centreX - half * 0.8, centreY);
  context.lineTo(centreX + half * 0.8, centreY);
  context.moveTo(centreX, centreY - half * 0.8);
  context.lineTo(centreX, centreY + half * 0.8);
  context.stroke();
}

function drawMonitor(
  context: CanvasRenderingContext2D,
  body: Box,
  t: number,
  names: readonly string[],
  powered: boolean,
) {
  context.fillStyle = '#6d685d';
  context.beginPath();
  context.roundRect(body.x, body.y, body.width, body.height, 10);
  context.fill();
  context.fillStyle = 'rgba(255, 255, 255, 0.08)';
  context.fillRect(body.x + 6, body.y + 4, body.width - 12, 3);
  context.fillStyle = '#58534a';
  context.fillRect(body.x + body.width * 0.35, body.y + body.height, body.width * 0.3, 10);

  const screen: Box = {
    x: body.x + body.width * 0.08,
    y: body.y + body.height * 0.1,
    width: body.width * 0.84,
    height: body.height * 0.72,
  };
  context.fillStyle = '#04110a';
  context.beginPath();
  context.roundRect(screen.x, screen.y, screen.width, screen.height, 8);
  context.fill();
  if (!powered) return;

  context.save();
  context.beginPath();
  context.roundRect(screen.x, screen.y, screen.width, screen.height, 8);
  context.clip();
  const glow = context.createRadialGradient(
    screen.x + screen.width / 2,
    screen.y + screen.height / 2,
    0,
    screen.x + screen.width / 2,
    screen.y + screen.height / 2,
    screen.width * 0.7,
  );
  glow.addColorStop(0, 'rgba(60, 255, 150, 0.12)');
  glow.addColorStop(1, 'rgba(60, 255, 150, 0)');
  context.fillStyle = glow;
  context.fillRect(screen.x, screen.y, screen.width, screen.height);

  // Sized so the longest thank-you still fits across the screen.
  const lines = names.map((name) => `thank you, ${name}`);
  context.font = `100px 'IBM Plex Mono', monospace`;
  const widest = Math.max(...lines.map((line) => context.measureText(line).width));
  const fontSize = Math.max(7, Math.min(screen.height / 8.5, ((screen.width - 20) / widest) * 100));
  const lineHeight = fontSize * 1.35;
  context.font = `${fontSize}px 'IBM Plex Mono', monospace`;
  context.fillStyle = '#6dffa6';
  context.shadowColor = 'rgba(109, 255, 166, 0.6)';
  context.shadowBlur = 6;
  const loop = names.length * lineHeight + screen.height;
  const scroll = (t * 14) % loop;
  lines.forEach((line, index) => {
    const y = screen.y + screen.height + fontSize - scroll + index * lineHeight;
    if (y > screen.y && y < screen.y + screen.height + fontSize) {
      context.fillText(line, screen.x + 10, y);
    }
  });
  context.shadowBlur = 0;
  context.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let y = screen.y; y < screen.y + screen.height; y += 3)
    context.fillRect(screen.x, y, screen.width, 1);
  context.restore();
}

function drawDesk(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  floorY: number,
  t: number,
  names: readonly string[],
  powered: boolean,
  mugColour: string,
) {
  const left = width * 0.6;
  const right = width * 0.96;
  const top = floorY - height * 0.1;
  context.fillStyle = '#12151f';
  context.fillRect(left + 10, top + 10, 8, height - top - 10);
  context.fillRect(right - 18, top + 10, 8, height - top - 10);
  context.fillStyle = '#2b2530';
  context.fillRect(left, top, right - left, 12);
  context.fillStyle = 'rgba(255, 255, 255, 0.06)';
  context.fillRect(left, top, right - left, 2);

  const monitorWidth = Math.min(width * 0.2, height * 0.42 * 1.3);
  const monitorHeight = monitorWidth / 1.3;
  const monitor: Box = {
    x: left + (right - left) * 0.12,
    y: top - 10 - monitorHeight,
    width: monitorWidth,
    height: monitorHeight,
  };
  drawMonitor(context, monitor, t, names, powered);

  // A sticky note on the bezel, the keyboard, and a mug that is still warm.
  context.save();
  context.translate(monitor.x + monitor.width - 6, monitor.y + 10);
  context.rotate(0.12);
  context.fillStyle = '#f2d45c';
  context.fillRect(0, 0, 26, 24);
  context.fillStyle = 'rgba(60, 50, 20, 0.6)';
  context.fillRect(5, 8, 15, 2);
  context.fillRect(5, 14, 11, 2);
  context.restore();

  context.fillStyle = '#343a4f';
  context.beginPath();
  context.moveTo(monitor.x + 4, top - 1);
  context.lineTo(monitor.x + monitor.width - 4, top - 1);
  context.lineTo(monitor.x + monitor.width - 14, top - 7);
  context.lineTo(monitor.x + 14, top - 7);
  context.closePath();
  context.fill();

  const mugX = right - (right - left) * 0.18;
  const mugTop = top - 24;
  context.fillStyle = mugColour;
  context.beginPath();
  context.roundRect(mugX, mugTop, 18, 24, 3);
  context.fill();
  context.strokeStyle = mugColour;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(mugX + 20, mugTop + 11, 6, -Math.PI / 2, Math.PI / 2);
  context.stroke();
  context.strokeStyle = 'rgba(220, 225, 240, 0.22)';
  context.lineWidth = 2;
  for (let wisp = 0; wisp < 3; wisp++) {
    const x = mugX + 4 + wisp * 5;
    const sway = Math.sin(t * 1.6 + wisp * 1.7) * 4;
    context.beginPath();
    context.moveTo(x, mugTop - 3);
    context.quadraticCurveTo(x + sway, mugTop - 14, x - sway * 0.6, mugTop - 26);
    context.stroke();
  }
}

/** A framed moon on the wall, a nod to the phase-of-the-moon program in the collection. */
function drawMoonPicture(context: CanvasRenderingContext2D, frame: Box) {
  context.fillStyle = '#2a2433';
  context.fillRect(frame.x - 5, frame.y - 5, frame.width + 10, frame.height + 10);
  context.fillStyle = '#0a0d1a';
  context.fillRect(frame.x, frame.y, frame.width, frame.height);
  const random = createRng('closet-moon-stars');
  context.fillStyle = 'rgba(230, 236, 255, 0.7)';
  for (let star = 0; star < 12; star++) {
    context.fillRect(
      frame.x + random.float(4, frame.width - 4),
      frame.y + random.float(4, frame.height - 4),
      1.3,
      1.3,
    );
  }
  const radius = Math.min(frame.width, frame.height) * 0.26;
  const cx = frame.x + frame.width * 0.52;
  const cy = frame.y + frame.height * 0.45;
  context.fillStyle = '#e9e3cf';
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
  // A waxing gibbous: the shadow is a darker disc slid off to the left.
  context.fillStyle = 'rgba(10, 13, 26, 0.82)';
  context.beginPath();
  context.arc(cx - radius * 1.45, cy, radius * 1.02, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(160, 150, 120, 0.45)';
  context.beginPath();
  context.arc(cx + radius * 0.3, cy - radius * 0.2, radius * 0.16, 0, Math.PI * 2);
  context.arc(cx + radius * 0.05, cy + radius * 0.35, radius * 0.1, 0, Math.PI * 2);
  context.fill();
}

function drawChair(context: CanvasRenderingContext2D, x: number, seatY: number, size: number) {
  const dark = '#1a1e2c';
  const edge = '#2c3247';
  // The back, then the seat in front of it.
  context.fillStyle = dark;
  context.beginPath();
  context.roundRect(x - size * 0.34, seatY - size * 1.05, size * 0.68, size * 0.9, size * 0.14);
  context.fill();
  context.strokeStyle = edge;
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#20253a';
  context.beginPath();
  context.ellipse(x, seatY, size * 0.48, size * 0.13, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#2a3045';
  context.fillRect(x - 3, seatY + size * 0.1, 6, size * 0.42);
  // Five legs on little wheels.
  const baseY = seatY + size * 0.55;
  context.strokeStyle = '#2a3045';
  context.lineWidth = 4;
  context.lineCap = 'round';
  for (const reach of [-0.46, -0.22, 0, 0.22, 0.46]) {
    const footX = x + reach * size;
    const footY = baseY + (reach === 0 ? size * 0.06 : 0);
    context.beginPath();
    context.moveTo(x, baseY - size * 0.02);
    context.lineTo(footX, footY);
    context.stroke();
    context.fillStyle = '#10131c';
    context.beginPath();
    context.arc(footX, footY + 4, 4, 0, Math.PI * 2);
    context.fill();
  }
}

function drawPlant(context: CanvasRenderingContext2D, x: number, floorY: number, size: number) {
  context.fillStyle = '#6b3d2e';
  context.beginPath();
  context.moveTo(x - size * 0.28, floorY - size * 0.42);
  context.lineTo(x + size * 0.28, floorY - size * 0.42);
  context.lineTo(x + size * 0.2, floorY);
  context.lineTo(x - size * 0.2, floorY);
  context.closePath();
  context.fill();
  context.fillStyle = '#7d4a38';
  context.fillRect(x - size * 0.3, floorY - size * 0.46, size * 0.6, size * 0.08);
  const leaves: [number, number][] = [
    [-0.9, 0.9],
    [-0.55, 1.1],
    [-0.2, 1.25],
    [0.2, 1.2],
    [0.55, 1.05],
    [0.95, 0.85],
    [0, 0.95],
  ];
  leaves.forEach(([lean, length], index) => {
    context.save();
    context.translate(x, floorY - size * 0.46);
    context.rotate(lean * 0.7);
    context.fillStyle = index % 2 === 0 ? '#2f5a3f' : '#3a6d4b';
    context.beginPath();
    context.ellipse(0, -size * 0.5 * length, size * 0.12, size * 0.5 * length, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
}

function drawMotes(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  lampX: number,
  colour: string,
  t: number,
) {
  const random = createRng('closet-motes');
  for (let index = 0; index < 34; index++) {
    const lane = random.float(-1, 1);
    const speed = random.float(4, 11);
    const offset = random.float(0, height);
    const y = height * 0.18 + ((offset + t * speed) % (height * 0.8));
    const spread = 30 + (y / height) * width * 0.22;
    const x = lampX + lane * spread + Math.sin(t * 0.7 + index) * 6;
    const twinkle = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + index * 1.3));
    context.fillStyle = withAlpha(colour, twinkle);
    context.fillRect(x, y, 1.6, 1.6);
  }
}

export function drawRoom(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  state: RoomState,
  colours: RoomColours,
  names: readonly string[],
): void {
  const floorY = height * 0.76;
  const reboot = rebootProgress(state, t);
  const colour = lampColour(state.lights, t);
  // The lamp dips and flickers while the rack reboots, then comes back to full.
  const flicker = reboot < 1 ? 0.35 + 0.65 * reboot * (0.8 + 0.2 * Math.sin(t * 40)) : 1;
  const lampX = width * 0.42;
  const ledColours = [colour, colours.accent2, colours.accent, '#7ee8a8'] as const;

  drawWallAndFloor(context, width, height, floorY);
  drawCableTray(context, width);

  const small: Box = {
    x: width * 0.06,
    y: height * 0.24,
    width: width * 0.12,
    height: floorY - height * 0.24 + height * 0.05,
  };
  const big: Box = {
    x: width * 0.22,
    y: height * 0.12,
    width: width * 0.15,
    height: floorY - height * 0.12 + height * 0.1,
  };
  drawRack(context, small, 8, 'closet-rack-small', t, reboot, ledColours);
  drawRack(context, big, 11, 'closet-rack-big', t, reboot, ledColours);
  drawCables(context, small, big, [colours.accent, colours.accent2, '#ffb86b', '#7fd3ff']);

  const fanSize = Math.min(130, height * 0.26);
  drawWallFan(context, width * 0.5, height * 0.3, fanSize, state.fan ? t * 7 : 0.4);
  const pictureWidth = Math.min(width * 0.06, height * 0.2);
  drawMoonPicture(context, {
    x: width * 0.5 + fanSize / 2 + width * 0.03,
    y: height * 0.14,
    width: pictureWidth,
    height: pictureWidth * 1.3,
  });
  drawPlant(context, width * 0.025 + height * 0.05, floorY + height * 0.1, height * 0.26);
  drawDesk(context, width, height, floorY, t, names, reboot > 0.8, colours.accent);
  drawChair(context, width * 0.8, floorY + height * 0.02, height * 0.22);

  drawLamp(context, width, height, lampX, colour, flicker);
  drawMotes(context, width, height, lampX, colour, t);

  // A vignette pulls the eye to the lit middle of the room.
  const vignette = context.createRadialGradient(
    width / 2,
    height * 0.55,
    height * 0.3,
    width / 2,
    height * 0.55,
    width * 0.75,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}
