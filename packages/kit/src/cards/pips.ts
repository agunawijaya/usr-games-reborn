import type { Suit } from './deck';

/**
 * The four suit marks, drawn for this deck: SVG path data on a 100 × 100 grid centred on
 * (50, 50). The spade and club stand on a small stepped foot, the deck's Art Deco signature;
 * the diamond's sides are drawn in slightly so it reads as cut, not stamped.
 */

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const PIP_PATHS: Record<Suit, string> = {
  hearts:
    'M50 90C46 84 34 74 22 63C10 52 4 42 5 31C6 17 17 8 30 8C39 8 46 13 50 22C54 13 61 8 70 8C83 8 94 17 95 31C96 42 90 52 78 63C66 74 54 84 50 90Z',
  diamonds: 'M50 3C57 20 69 37 86 50C69 63 57 80 50 97C43 80 31 63 14 50C31 37 43 20 50 3Z',
  spades:
    'M50 4C58 16 72 26 83 37C93 47 97 56 94 66C91 77 80 82 70 79C64 77 59 73 55 68C56 77 59 84 63 88H66V94H34V88H37C41 84 44 77 45 68C41 73 36 77 30 79C20 82 9 77 6 66C3 56 7 47 17 37C28 26 42 16 50 4Z',
  clubs:
    'M50 6C61 6 70 15 70 26C70 31 68 36 65 39C67 38 70 38 73 38C85 38 94 47 94 58C94 70 85 78 73 78C66 78 60 75 56 70C57 78 59 84 63 88H66V94H34V88H37C41 84 43 78 44 70C40 75 34 78 27 78C15 78 6 70 6 58C6 47 15 38 27 38C30 38 33 38 35 39C32 36 30 31 30 26C30 15 39 6 50 6Z',
};

const pathCache = new Map<Suit, Path2D>();

export function pipPath(suit: Suit): Path2D {
  let path = pathCache.get(suit);
  if (!path) {
    path = new Path2D(PIP_PATHS[suit]);
    pathCache.set(suit, path);
  }
  return path;
}

/** Fills a suit mark `size` pixels tall, centred on (x, y), upside down when `flipped`. */
export function drawPip(
  ctx: Ctx,
  suit: Suit,
  x: number,
  y: number,
  size: number,
  colour: string,
  flipped = false,
): void {
  ctx.save();
  ctx.translate(x, y);
  if (flipped) ctx.rotate(Math.PI);
  const scale = size / 100;
  ctx.scale(scale, scale);
  ctx.translate(-50, -50);
  ctx.fillStyle = colour;
  ctx.fill(pipPath(suit));
  ctx.restore();
}

/**
 * Where the pips of a numbered card sit, as fractions of the card (x across, y down), with
 * whether each one is printed upside down. The layouts are the ones every deck has used for
 * centuries; the rows are spaced for this card's proportions.
 */
export interface PipPlace {
  x: number;
  y: number;
  flipped: boolean;
}

const COLUMNS = { left: 0.3, centre: 0.5, right: 0.7 } as const;
const TOP = 0.205;
const BOTTOM = 0.795;

function row(step: number): number {
  return TOP + ((BOTTOM - TOP) * step) / 8;
}

type Spot = [keyof typeof COLUMNS, number];

const LAYOUTS: Record<number, Spot[]> = {
  2: [
    ['centre', 0],
    ['centre', 8],
  ],
  3: [
    ['centre', 0],
    ['centre', 4],
    ['centre', 8],
  ],
  4: [
    ['left', 0],
    ['right', 0],
    ['left', 8],
    ['right', 8],
  ],
  5: [
    ['left', 0],
    ['right', 0],
    ['centre', 4],
    ['left', 8],
    ['right', 8],
  ],
  6: [
    ['left', 0],
    ['right', 0],
    ['left', 4],
    ['right', 4],
    ['left', 8],
    ['right', 8],
  ],
  7: [
    ['left', 0],
    ['right', 0],
    ['centre', 2],
    ['left', 4],
    ['right', 4],
    ['left', 8],
    ['right', 8],
  ],
  8: [
    ['left', 0],
    ['right', 0],
    ['centre', 2],
    ['left', 4],
    ['right', 4],
    ['centre', 6],
    ['left', 8],
    ['right', 8],
  ],
  9: [
    ['left', 0],
    ['right', 0],
    ['left', 8 / 3],
    ['right', 8 / 3],
    ['centre', 4],
    ['left', 16 / 3],
    ['right', 16 / 3],
    ['left', 8],
    ['right', 8],
  ],
  10: [
    ['left', 0],
    ['right', 0],
    ['centre', 4 / 3],
    ['left', 8 / 3],
    ['right', 8 / 3],
    ['left', 16 / 3],
    ['right', 16 / 3],
    ['centre', 20 / 3],
    ['left', 8],
    ['right', 8],
  ],
};

export function pipLayout(rank: number): PipPlace[] {
  return (LAYOUTS[rank] ?? []).map(([column, step]) => ({
    x: COLUMNS[column],
    y: row(step),
    flipped: step > 4,
  }));
}
