import type { Look } from './look';
import { mix, rgba } from './noise';
import { glow, sparkle } from './shapes';

/**
 * Glints, the garden's treasure: two coins and three gems, worth more the deeper the chamber.
 * Each sits on the flagstones with a small shadow, bobs a little and catches the light.
 */
export type GlintTier = 0 | 1 | 2 | 3 | 4;

interface GemColours {
  readonly light: string;
  readonly mid: string;
  readonly deep: string;
}

const GEMS: readonly GemColours[] = [
  { light: '#f6c08a', mid: '#c97a3c', deep: '#7d4219' }, // copper coin
  { light: '#fff1a8', mid: '#e8b52c', deep: '#9a6a0c' }, // gold coin
  { light: '#b8f5c9', mid: '#2fbf71', deep: '#0e6b3a' }, // emerald
  { light: '#ffb3c1', mid: '#e23b5a', deep: '#86122c' }, // ruby
  { light: '#e6f6ff', mid: '#7cc8ff', deep: '#2a6fb5' }, // star sapphire
];

export function glintColour(tier: GlintTier): string {
  return GEMS[tier]!.mid;
}

export interface GlintDraw {
  readonly x: number;
  readonly y: number;
  /** The glint's width in pixels. */
  readonly size: number;
  readonly tier: GlintTier;
  readonly look: Look;
  readonly time: number;
  /** Varies the bob and the sparkle between glints. */
  readonly phase?: number;
  /** Lying on its side mid-scatter: no bob, a little tilt. */
  readonly tumble?: number;
}

export function drawGlint(ctx: CanvasRenderingContext2D, g: GlintDraw) {
  const phase = g.phase ?? 0;
  const lift = g.tumble === undefined ? Math.sin(g.time * 2.2 + phase) * g.size * 0.06 : 0;
  const r = g.size / 2;
  ctx.save();
  // Shadow on the stone.
  ctx.fillStyle = rgba('#000000', g.look === 'sun' ? 0.22 : 0.4);
  ctx.beginPath();
  ctx.ellipse(g.x + r * 0.12, g.y + r * 0.62, r * 0.78, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  if (g.look === 'moon') {
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, g.x, g.y - lift, r * 2.4, rgba(GEMS[g.tier]!.mid, 0.28));
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.translate(g.x, g.y - lift - r * 0.1);
  if (g.tumble !== undefined) ctx.rotate(g.tumble);
  if (g.tier <= 1) drawCoin(ctx, r, GEMS[g.tier]!);
  else drawGem(ctx, r, GEMS[g.tier]!, g.tier);
  ctx.restore();

  // A sparkle that comes and goes.
  const twinkle = Math.max(0, Math.sin(g.time * 3.1 + phase * 1.7));
  if (twinkle > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = g.look === 'moon' ? 'lighter' : 'source-over';
    ctx.fillStyle = rgba('#ffffff', 0.9 * twinkle);
    sparkle(ctx, g.x + r * 0.45, g.y - lift - r * 0.55, r * (0.35 + twinkle * 0.3));
    ctx.fill();
    ctx.restore();
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, r: number, c: GemColours) {
  ctx.fillStyle = c.deep;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.08, r * 0.86, r * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createLinearGradient(-r, -r, r, r);
  face.addColorStop(0, c.light);
  face.addColorStop(0.55, c.mid);
  face.addColorStop(1, c.deep);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.86, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(c.light, 0.9);
  ctx.lineWidth = r * 0.09;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.64, r * 0.59, 0, 0, Math.PI * 2);
  ctx.stroke();
  // An embossed leaf: the garden's mark.
  ctx.fillStyle = rgba(c.deep, 0.55);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.42);
  ctx.quadraticCurveTo(r * 0.36, 0, 0, r * 0.42);
  ctx.quadraticCurveTo(-r * 0.36, 0, 0, -r * 0.42);
  ctx.fill();
  ctx.strokeStyle = rgba(c.light, 0.7);
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.34);
  ctx.lineTo(0, r * 0.34);
  ctx.stroke();
}

function drawGem(ctx: CanvasRenderingContext2D, r: number, c: GemColours, tier: number) {
  // A brilliant seen from above: an outline of eight, a table in the middle, facets between.
  const sides = tier === 4 ? 8 : tier === 3 ? 6 : 8;
  const stretch = tier === 2 ? 0.82 : 1;
  const outer = Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2 + (tier === 3 ? Math.PI / 6 : Math.PI / 8);
    return { x: Math.cos(a) * r * 0.9 * stretch, y: Math.sin(a) * r * 0.9 };
  });
  const table = outer.map((p) => ({ x: p.x * 0.48, y: p.y * 0.48 - r * 0.04 }));
  ctx.fillStyle = c.deep;
  ctx.beginPath();
  outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + r * 0.08) : ctx.moveTo(p.x, p.y + r * 0.08)));
  ctx.closePath();
  ctx.fill();
  outer.forEach((p, i) => {
    const q = outer[(i + 1) % sides]!;
    const t1 = table[i]!;
    const t2 = table[(i + 1) % sides]!;
    const angle = Math.atan2((p.y + q.y) / 2, (p.x + q.x) / 2);
    const lit = (1 - Math.cos(angle + Math.PI * 0.75)) / 2;
    ctx.fillStyle = mix(c.deep, c.light, 0.15 + lit * 0.7);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.closePath();
    ctx.fill();
  });
  const top = ctx.createLinearGradient(-r * 0.4, -r * 0.4, r * 0.4, r * 0.4);
  top.addColorStop(0, c.light);
  top.addColorStop(1, c.mid);
  ctx.fillStyle = top;
  ctx.beginPath();
  table.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.7);
  ctx.beginPath();
  ctx.moveTo(table[sides - 1]!.x * 0.9, table[sides - 1]!.y * 0.9);
  ctx.lineTo(table[0]!.x * 0.9, table[0]!.y * 0.9);
  ctx.lineTo(0, -r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(c.deep, 0.6);
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath();
  outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.stroke();
}
