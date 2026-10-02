import { FONT_DISPLAY, type Look } from './look';

/**
 * The digits as number-fruit: plump, glossy, bigger as they are worth more, each with as many
 * lobes as its value (a 1 is a round berry, a 9 a nine-lobed rosette) so the shape tells the
 * number apart even without its colour or numeral.
 */

export interface FruitOptions {
  /** Seconds, for the gentle bob. */
  time: number;
  /** 0–1: how far a newly placed fruit has popped up. */
  appear?: number;
  /** Shapes on by default; the setting turns the lobes off for a plainer look. */
  shapes?: boolean;
  reducedMotion?: boolean;
}

export function fruitRadius(value: number, cell: number): number {
  return cell * (0.3 + value * 0.024);
}

export function drawFruit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  value: number,
  cell: number,
  look: Look,
  options: FruitOptions,
): void {
  const colour = look.fruit[value - 1] ?? look.fruit[0]!;
  const appear = easeBack(Math.min(1, options.appear ?? 1));
  const bob = options.reducedMotion ? 0 : Math.sin(options.time * 2.4 + value) * cell * 0.035;
  const r = fruitRadius(value, cell) * appear;
  if (r <= 0) return;
  const cy = y + bob;
  const lobes = options.shapes === false ? 1 : value;

  ctx.save();
  if (look.dark) {
    const glow = ctx.createRadialGradient(x, cy, r * 0.4, x, cy, r * 2.2);
    glow.addColorStop(0, withAlpha(colour, 0.55));
    glow.addColorStop(1, withAlpha(colour, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  } else {
    ctx.fillStyle = 'rgba(60, 28, 8, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.12, y + r * 0.95, r * 0.8, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stem and leaf first, so the fruit sits on top of their base.
  ctx.strokeStyle = look.fruitOutline;
  ctx.lineWidth = Math.max(1.5, cell * 0.04);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, cy - r * 0.82);
  ctx.quadraticCurveTo(x + r * 0.05, cy - r * 1.12, x + r * 0.16, cy - r * 1.2);
  ctx.stroke();
  ctx.fillStyle = look.leaf;
  ctx.beginPath();
  ctx.ellipse(x + r * 0.4, cy - r * 1.06, r * 0.32, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  lobedPath(ctx, x, cy, r, lobes);
  const body = ctx.createRadialGradient(x - r * 0.35, cy - r * 0.4, r * 0.1, x, cy, r * 1.1);
  body.addColorStop(0, lighten(colour, 0.45));
  body.addColorStop(0.55, colour);
  body.addColorStop(1, darken(colour, 0.25));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, cell * 0.045);
  ctx.strokeStyle = look.fruitOutline;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, cy - r * 0.42, r * 0.26, r * 0.14, -0.7, 0, Math.PI * 2);
  ctx.fill();

  const size = Math.round(r * 1.12);
  ctx.font = `800 ${size}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.2);
  ctx.strokeStyle = look.fruitOutline;
  ctx.strokeText(String(value), x, cy + size * 0.06);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(value), x, cy + size * 0.06);
  ctx.restore();
}

/** A round shape with `lobes` gentle bumps, one of them pointing up. */
function lobedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  lobes: number,
): void {
  ctx.beginPath();
  if (lobes <= 1) {
    ctx.arc(x, y, r, 0, Math.PI * 2);
    return;
  }
  const depth = lobes === 2 ? 0.12 : 0.1;
  const steps = 72;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const k = 1 - depth + depth * Math.cos(lobes * (a + Math.PI / 2));
    const px = x + Math.cos(a) * r * k;
    const py = y + Math.sin(a) * r * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function easeBack(t: number): number {
  const c = 1.8;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

function parse(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  const mix = (c: number) => Math.round(c * (1 - amount));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
