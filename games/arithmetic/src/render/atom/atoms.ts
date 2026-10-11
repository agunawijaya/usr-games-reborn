import { glow } from '../paint';
import type { Molecule } from './molecule';
import { type AtomPalette, atomColor, atomColorAlpha } from './palette';

/**
 * Drawing atoms and molecules. Every prime has its own colour and orbit: 2 is a small bright core
 * with a tight pair, 3 a triangle, 5 a pentagon and so on up to 13; bigger primes ride a ring of
 * electrons, and the very large ones a dashed ring. The prime is always written on the nucleus.
 */

export interface AtomDraw {
  readonly x: number;
  readonly y: number;
  /** Outer radius of the orbit, in pixels. */
  readonly r: number;
  readonly prime: number;
  readonly time: number;
  /** 0–1, for atoms fading in or out. */
  readonly alpha?: number;
  /** Extra brightness for a flash, 0–1. */
  readonly flare?: number;
  readonly still?: boolean;
}

export function drawAtom(ctx: CanvasRenderingContext2D, atom: AtomDraw, palette: AtomPalette) {
  const { x, y, r, prime } = atom;
  const a = atom.alpha ?? 1;
  if (a <= 0.01) return;
  const flare = atom.flare ?? 0;
  const nucleus = prime === 2 ? r * 0.5 : r * 0.58;
  ctx.save();
  ctx.globalAlpha = a;
  if (palette.glow) {
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, r * (1.7 + flare), atomColorAlpha(prime, palette, 0.42 + flare * 0.4), 1);
    ctx.globalCompositeOperation = 'source-over';
  }
  drawOrbit(ctx, atom, palette, nucleus);
  const body = ctx.createRadialGradient(
    x - nucleus * 0.35,
    y - nucleus * 0.4,
    nucleus * 0.1,
    x,
    y,
    nucleus,
  );
  if (palette.glow) {
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.45, atomColor(prime, palette, 86));
    body.addColorStop(1, atomColor(prime, palette, 62));
  } else {
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.5, atomColor(prime, palette, 86));
    body.addColorStop(1, atomColor(prime, palette, 70));
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, nucleus, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.strokeStyle = palette.glow ? atomColor(prime, palette, 88) : atomColor(prime, palette, 40);
  ctx.stroke();
  // The prime itself, on the nucleus: colour is never the only clue.
  const digits = String(prime).length;
  const size = nucleus * (digits <= 1 ? 1.05 : digits === 2 ? 0.86 : digits === 3 ? 0.66 : 0.5);
  ctx.fillStyle = palette.labelOnCore;
  ctx.font = `700 ${size.toFixed(1)}px "Fredoka Variable", "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(prime), x, y + size * 0.05);
  ctx.restore();
}

function drawOrbit(
  ctx: CanvasRenderingContext2D,
  atom: AtomDraw,
  palette: AtomPalette,
  nucleus: number,
) {
  const { x, y, r, prime, time } = atom;
  const spin = atom.still ? 0.4 : time * (0.9 / Math.sqrt(prime)) + prime;
  const orbit = prime === 2 ? r * 0.82 : r * 0.94;
  ctx.lineWidth = Math.max(1, r * (palette.glow ? 0.035 : 0.04));
  ctx.strokeStyle = atomColorAlpha(
    prime,
    palette,
    palette.glow ? 0.75 : 0.7,
    palette.glow ? 78 : 46,
  );
  const electron = Math.max(1.6, r * 0.075);
  const electrons: { x: number; y: number }[] = [];
  ctx.beginPath();
  if (prime === 2) {
    // A tight tilted ellipse with its pair.
    ctx.ellipse(x, y, orbit, orbit * 0.42, -0.5, 0, Math.PI * 2);
    for (let i = 0; i < 2; i++) {
      const t = spin * 1.6 + i * Math.PI;
      const ex = Math.cos(t) * orbit;
      const ey = Math.sin(t) * orbit * 0.42;
      electrons.push({
        x: x + ex * Math.cos(-0.5) - ey * Math.sin(-0.5),
        y: y + ex * Math.sin(-0.5) + ey * Math.cos(-0.5),
      });
    }
  } else if (prime <= 13) {
    for (let i = 0; i <= prime; i++) {
      const t = spin + (i / prime) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(t) * orbit;
      const py = y + Math.sin(t) * orbit;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      if (i < prime) electrons.push({ x: px, y: py });
    }
    ctx.closePath();
  } else {
    ctx.arc(x, y, orbit, 0, Math.PI * 2);
    if (prime > 31) ctx.setLineDash([orbit * 0.12, orbit * 0.1]);
    const count = prime <= 31 ? prime : 12;
    for (let i = 0; i < count; i++) {
      const t = spin + (i / count) * Math.PI * 2;
      electrons.push({ x: x + Math.cos(t) * orbit, y: y + Math.sin(t) * orbit });
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = palette.glow ? '#ffffff' : atomColor(prime, palette, 38);
  for (const e of electrons) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, prime > 13 ? electron * 0.75 : electron, 0, Math.PI * 2);
    ctx.fill();
  }
  void nucleus;
}

export interface MoleculeDraw {
  readonly molecule: Molecule;
  readonly x: number;
  readonly y: number;
  /** Pixels per unit of the molecule's layout. */
  readonly unit: number;
  readonly time: number;
  readonly rotation?: number;
  readonly alpha?: number;
  readonly flare?: number;
  readonly still?: boolean;
}

export function moleculeAtoms(
  draw: MoleculeDraw,
): { x: number; y: number; r: number; prime: number }[] {
  const rotation = draw.rotation ?? 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return draw.molecule.atoms.map((atom) => ({
    x: draw.x + (atom.x * cos - atom.y * sin) * draw.unit,
    y: draw.y + (atom.x * sin + atom.y * cos) * draw.unit,
    r: atom.r * draw.unit,
    prime: atom.prime,
  }));
}

export function drawMolecule(
  ctx: CanvasRenderingContext2D,
  draw: MoleculeDraw,
  palette: AtomPalette,
) {
  const placed = moleculeAtoms(draw);
  const a = draw.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.lineCap = 'round';
  for (const [from, to] of draw.molecule.bonds) {
    const p = placed[from]!;
    const q = placed[to]!;
    if (palette.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(160, 180, 255, 0.25)';
      ctx.lineWidth = draw.unit * 0.3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = palette.bond;
    ctx.lineWidth = Math.max(1.5, draw.unit * (palette.glow ? 0.07 : 0.12));
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  ctx.restore();
  for (const atom of placed) {
    drawAtom(
      ctx,
      { ...atom, time: draw.time, alpha: a, flare: draw.flare, still: draw.still },
      palette,
    );
  }
}

/** Zero and one have no prime atoms: zero is an empty dashed shell, one a lone neutral core. */
export function drawSpecial(
  ctx: CanvasRenderingContext2D,
  value: 0 | 1,
  x: number,
  y: number,
  r: number,
  palette: AtomPalette,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = palette.label;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.setLineDash(value === 0 ? [r * 0.25, r * 0.18] : []);
  ctx.beginPath();
  ctx.arc(x, y, r * (value === 0 ? 0.9 : 0.45), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (value === 1) {
    ctx.fillStyle = palette.glow ? 'rgba(230, 230, 255, 0.9)' : 'rgba(255,255,255,0.9)';
    ctx.fill();
  }
  ctx.fillStyle = value === 1 ? palette.labelOnCore : palette.label;
  ctx.font = `700 ${(r * 0.5).toFixed(1)}px "Fredoka Variable", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x, y + r * 0.03);
  ctx.restore();
}
