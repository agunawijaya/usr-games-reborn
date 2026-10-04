import type { FigureheadId } from '../voyage/types';
import type { Palette } from './palette';

/**
 * The five carvings a ship can be launched with, drawn in a 100 × 120 box facing right (the
 * way the ship sails), standing on the stem at (0, 120). Gilded wood: gilt fill, darker gilt
 * for the cut lines, so they read at the bow of a small ship and on the launch screen alike.
 */

export const FIGUREHEADS: readonly { id: FigureheadId; name: string; line: string }[] = [
  { id: 'fox', name: 'The Fox', line: 'Quick, and never caught napping.' },
  { id: 'owl', name: 'The Owl', line: 'Sees in the dark, says little.' },
  { id: 'lion', name: 'The Lion', line: 'Bold in a gale, bold alongside.' },
  { id: 'heron', name: 'The Heron', line: 'Patient as the tide.' },
  { id: 'lantern', name: 'The Lantern Bearer', line: 'Lights the way home.' },
];

/** A lion's mane: a ring of flame-like locks around (cx, cy). */
function mane(cx: number, cy: number, r: number, locks: number): string {
  const points: string[] = [];
  for (let i = 0; i <= locks; i++) {
    const a = (i / locks) * Math.PI * 2 - Math.PI / 2;
    const tip = a - Math.PI / locks;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const tx = cx + Math.cos(tip) * (r + 9);
    const ty = cy + Math.sin(tip) * (r + 9);
    points.push(
      i === 0
        ? `M ${x.toFixed(1)} ${y.toFixed(1)}`
        : `Q ${tx.toFixed(1)} ${ty.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`,
    );
  }
  return `${points.join(' ')} Z`;
}

function carving(id: FigureheadId, p: Palette, glow: boolean): string {
  const g = `fill="${p.gilt}" stroke="${p.giltShade}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  const line = `fill="none" stroke="${p.giltShade}" stroke-width="2" stroke-linecap="round"`;
  const eye = (x: number, y: number, r = 3) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.giltShade}"/>`;
  switch (id) {
    case 'fox':
      return `
        <path ${g} d="M2 118 C 8 92 22 78 40 70 C 48 66 52 58 54 50 L 50 30 L 62 42 L 70 26 L 74 46 C 84 52 94 58 100 64 C 92 70 80 70 70 72 C 64 84 52 96 40 104 C 28 112 14 116 2 118 Z"/>
        <path ${line} d="M 58 56 C 64 62 72 66 82 66"/>
        <path ${line} d="M 30 96 C 40 92 48 86 54 78"/>
        <path ${g} d="M 4 118 C 0 104 6 96 16 98 C 12 104 12 110 18 114 Z"/>
        ${eye(68, 52)}`;
    case 'owl':
      return `
        <path ${g} d="M 4 118 C 6 92 14 70 28 56 C 22 46 22 34 30 24 L 34 34 C 42 28 54 28 62 34 L 68 22 C 74 32 74 44 68 54 C 82 66 86 90 80 118 Z"/>
        <circle cx="38" cy="46" r="9" fill="${p.giltShade}" opacity="0.35"/>
        <circle cx="58" cy="46" r="9" fill="${p.giltShade}" opacity="0.35"/>
        ${eye(40, 46, 4)}${eye(58, 46, 4)}
        <path ${g} d="M 46 52 L 50 62 L 54 52 Z"/>
        <path ${line} d="M 24 78 C 32 92 34 104 30 116"/>
        <path ${line} d="M 72 78 C 66 92 64 104 68 116"/>
        <path ${line} d="M 40 76 C 44 80 52 80 56 76 M 40 88 C 44 92 52 92 56 88"/>`;
    case 'lion':
      return `
        <path ${g} d="M 2 118 C 8 102 16 92 26 86 L 50 88 C 56 92 58 96 60 100 C 66 96 78 96 82 102 C 76 109 64 110 54 108 C 38 114 18 117 2 118 Z"/>
        <path ${g} d="${mane(46, 56, 30, 11)}"/>
        <path ${line} d="M 30 44 C 36 50 36 62 30 70 M 40 32 C 46 40 46 50 42 58"/>
        <path ${g} d="M 50 40 C 62 34 76 38 84 46 L 96 54 C 98 60 94 66 88 66 L 82 70 C 74 74 62 74 54 68 C 50 60 48 50 50 40 Z"/>
        <path ${line} d="M 84 46 C 82 52 84 58 90 60 M 76 70 C 78 64 84 62 88 66"/>
        ${eye(72, 48)}
        <path ${line} d="M 66 42 C 70 40 76 41 79 44"/>
        <path fill="${p.giltShade}" d="M 93 52 L 98 54 L 95 58 Z"/>
        <path ${line} d="M 68 99 L 68 105 M 75 100 L 74 106"/>`;
    case 'heron':
      return `
        <path ${g} d="M 2 118 C 10 100 22 90 36 86 C 30 76 30 64 38 56 C 46 48 44 38 38 30 C 36 20 44 12 54 14 C 60 16 62 22 60 28 L 100 34 L 62 36 C 58 46 56 56 50 64 C 58 70 62 82 58 94 C 44 106 22 114 2 118 Z"/>
        ${eye(54, 22)}
        <path ${line} d="M 24 100 C 34 96 44 92 52 84 M 20 108 C 32 104 44 100 54 92"/>
        <path ${line} d="M 46 16 C 40 10 34 10 28 14"/>`;
    case 'lantern': {
      const light = glow
        ? `<circle cx="92" cy="34" r="22" fill="#ffd27a" opacity="0.35"/><circle cx="92" cy="34" r="11" fill="#ffe6a8" opacity="0.6"/>`
        : '';
      return `
        <path ${g} d="M 2 118 C 10 98 20 86 30 80 C 26 70 28 60 34 54 C 30 46 30 36 36 30 C 42 24 52 24 56 30 C 60 36 58 46 52 52 C 58 54 64 50 72 44 L 84 38 L 86 44 L 74 52 C 66 60 60 64 56 68 C 60 80 58 92 50 104 C 36 112 20 116 2 118 Z"/>
        <path ${g} d="M 30 32 C 26 26 30 18 38 18 C 44 18 46 22 44 26"/>
        ${eye(50, 38, 2.5)}
        <path ${line} d="M 36 70 C 40 80 40 92 36 104 M 44 66 C 48 78 48 92 44 106"/>
        ${light}
        <path ${g} d="M 86 26 L 98 26 L 100 44 L 84 44 Z"/>
        <path fill="${glow ? '#fff1c4' : p.giltShade}" d="M 88 30 L 96 30 L 97 41 L 87 41 Z"/>
        <path ${line} d="M 92 26 L 92 20"/>`;
    }
  }
}

/** A carving as an SVG group, placed with its foot at (x, y) and scaled. */
export function figureheadGroup(
  id: FigureheadId,
  p: Palette,
  x: number,
  y: number,
  scale: number,
  glow = false,
): string {
  return `<g transform="translate(${x.toFixed(1)} ${(y - 120 * scale).toFixed(1)}) scale(${scale.toFixed(3)})">${carving(id, p, glow)}</g>`;
}

/** The plain scroll carved on ships without a figure: the enemy's and the merchants'. */
export function scrollHead(p: Palette, x: number, y: number, scale: number): string {
  return `<g transform="translate(${x.toFixed(1)} ${(y - 60 * scale).toFixed(1)}) scale(${scale.toFixed(3)})">
    <path fill="${p.gilt}" stroke="${p.giltShade}" stroke-width="2.4" d="M 0 60 C 10 40 22 26 36 22 C 46 20 52 28 48 36 C 44 42 36 40 36 34"/>
  </g>`;
}

/** A large carving alone, for the launch screen and the log. */
export function figureheadSvg(id: FigureheadId, p: Palette, glow: boolean, label: string): string {
  return `<svg viewBox="-12 -8 124 136" role="img" aria-label="${label}" class="fh-carving-art">${carving(id, p, glow)}</svg>`;
}
