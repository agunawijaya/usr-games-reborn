import type { Peek } from '../engine/round';
import type { StrikeChance } from '../engine/snake';
import type { BoardFrame } from './frame';
import { type Look, PALETTES } from './look';
import { rgba } from './noise';

/**
 * The strike preview: every square the snake's head can reach next turn, tinted and hatched
 * by how likely it is (pattern as well as colour, so it reads without telling red from green),
 * with the chance written on the squares that matter.
 */
export function drawStrikes(
  ctx: CanvasRenderingContext2D,
  frame: BoardFrame,
  strikes: readonly StrikeChance[],
  look: Look,
  time: number,
) {
  const p = PALETTES[look];
  const s = frame.cell;
  const colour = p.strike;
  const pulse = 0.85 + 0.15 * Math.sin(time * 3);
  for (const strike of strikes) {
    const x = frame.x + strike.cell.x * s;
    const y = frame.y + strike.cell.y * s;
    const inset = s * 0.07;
    const chance = strike.chance;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.16);
    ctx.fillStyle = colour.replace(', 1)', `, ${(0.1 + chance * 0.42) * pulse})`);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * (0.025 + chance * 0.03));
    ctx.strokeStyle = colour.replace(', 1)', `, ${0.45 + chance * 0.5})`);
    ctx.stroke();
    ctx.clip();
    // Hatching: the likelier the square, the closer the lines.
    const gap = s * (0.26 - chance * 0.17);
    ctx.strokeStyle = colour.replace(', 1)', `, ${0.3 + chance * 0.4})`);
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    for (let k = -s; k < s * 2; k += gap) {
      ctx.moveTo(x + k, y);
      ctx.lineTo(x + k - s, y + s);
    }
    ctx.stroke();
    ctx.restore();
    if (chance >= 0.08) chanceLabel(ctx, x + s * 0.5, y + s * 0.5, chance, s, look);
  }
}

function chanceLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  chance: number,
  s: number,
  look: Look,
) {
  const text = `${Math.round(chance * 100)}%`;
  const size = Math.max(11, Math.round(s * 0.24));
  ctx.font = `700 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  const width = ctx.measureText(text).width + size * 0.7;
  ctx.fillStyle = look === 'sun' ? 'rgba(255, 248, 236, 0.94)' : 'rgba(30, 10, 24, 0.86)';
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - size * 0.72, width, size * 1.44, size * 0.72);
  ctx.fill();
  ctx.fillStyle = PALETTES[look].strikeInk;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + size * 0.04);
}

/** Arrow angles for the eight directions, north first and clockwise. */
const ANGLES = [
  -Math.PI / 2,
  -Math.PI / 4,
  0,
  Math.PI / 4,
  Math.PI / 2,
  (Math.PI * 3) / 4,
  Math.PI,
  (-Math.PI * 3) / 4,
];

/** The original's peek arrows: chevrons from beside you toward the treasure or the door. */
export function drawPeek(
  ctx: CanvasRenderingContext2D,
  frame: BoardFrame,
  peek: Peek,
  look: Look,
  time: number,
) {
  const s = frame.cell;
  const colour = PALETTES[look].peek;
  peek.path.forEach((cell, i) => {
    const wave = Math.max(0, Math.sin(time * 5 - i * 0.7));
    const x = frame.x + (cell.x + 0.5) * s;
    const y = frame.y + (cell.y + 0.5) * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ANGLES[peek.directions[i] ?? 0] ?? 0);
    ctx.strokeStyle = rgba(look === 'sun' ? '#fff6dc' : '#1a1024', 0.85);
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    chevron(ctx, s);
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.55 + wave * 0.45;
    ctx.lineWidth = s * 0.09;
    chevron(ctx, s);
    ctx.restore();
  });
}

function chevron(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(-s * 0.12, -s * 0.18);
  ctx.lineTo(s * 0.1, 0);
  ctx.lineTo(-s * 0.12, s * 0.18);
  ctx.stroke();
}
