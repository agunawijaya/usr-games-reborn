import { CARD_ASPECT } from '@usr-games/kit/cards';

/**
 * Where everything sits. The table is laid out once on a 1920 × 1080 design sheet and scaled to
 * the window (letterboxed by the table's own wood, never by bars). The peg board runs down the
 * right side, below the Hall's Pause pill; your hand is at the bottom, the computer's at the
 * top, the play in the middle with its count, the stock and starter to the left, and the crib
 * beside whoever deals. Nothing that informs sits in the bottom-left corner where the Hall's
 * toasts stack.
 */

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Frame {
  /** Window size in CSS pixels. */
  width: number;
  height: number;
  /** Design units to CSS pixels, and the design sheet's top-left corner on screen. */
  scale: number;
  originX: number;
  originY: number;
}

export function frameFor(width: number, height: number): Frame {
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  return {
    width,
    height,
    scale,
    originX: (width - DESIGN_WIDTH * scale) / 2,
    originY: (height - DESIGN_HEIGHT * scale) / 2,
  };
}

/** Converts a design point to CSS pixels on screen. */
export function toScreen(frame: Frame, point: Point): Point {
  return { x: frame.originX + point.x * frame.scale, y: frame.originY + point.y * frame.scale };
}

/** Converts CSS pixels on screen to design units. */
export function toDesign(frame: Frame, point: Point): Point {
  return { x: (point.x - frame.originX) / frame.scale, y: (point.y - frame.originY) / frame.scale };
}

export const cardWidth = (height: number) => Math.round(height / CARD_ASPECT);

/** Card heights on the design sheet. */
export const CARD = {
  hand: 200,
  rival: 128,
  pile: 178,
  stock: 150,
  show: 236,
  /** Your hand while another is being counted. */
  resting: 150,
} as const;

export const LAYOUT = {
  board: { x: 1606, y: 92, w: 246, h: 944 } satisfies Rect,
  /** The middle of the area left of the board, where the hands and the play line up. */
  centreX: 800,
  handY: 902,
  restingY: 1030,
  rivalY: 112,
  pileY: 512,
  pileStartX: 452,
  pileStep: 70,
  count: { x: 1150, y: 512 } satisfies Point,
  stock: { x: 168, y: 512 } satisfies Point,
  starter: { x: 300, y: 512 } satisfies Point,
  crib: { you: { x: 234, y: 744 }, rival: { x: 234, y: 282 } },
  /** Earlier counts of this hand, squared away face down beside the count. */
  turned: { x: 1372, y: 520 } satisfies Point,
  /** The two cards cut for the first deal, side by side in the middle. */
  cutForDeal: { you: { x: 690, y: 540 }, rival: { x: 910, y: 540 } },
  /** The counting stage: the hand laid out large, the starter set a little apart. */
  show: { y: 530, gap: 34, starterGap: 72 },
} as const;

/** Card centres for a fanned hand of `count` cards centred on `x`. */
export function fanPositions(
  count: number,
  centreX: number,
  y: number,
  height: number,
  spread = 0.86,
): { x: number; y: number; angle: number }[] {
  const width = cardWidth(height);
  const step = width * spread;
  const start = centreX - ((count - 1) * step) / 2;
  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) - 0.5 : 0;
    return { x: start + i * step, y: y + Math.abs(t) * height * 0.06, angle: t * 0.1 };
  });
}

/** Card centres for the counting stage: four cards, then the starter a little apart. */
export function showPositions(count: number, centreX: number): Point[] {
  const width = cardWidth(CARD.show);
  const { y, gap, starterGap } = LAYOUT.show;
  const total = count * width + (count - 2) * gap + starterGap;
  let x = centreX - total / 2 + width / 2;
  return Array.from({ length: count }, (_, i) => {
    const point = { x, y };
    x += width + (i === count - 2 ? starterGap : gap);
    return point;
  });
}
