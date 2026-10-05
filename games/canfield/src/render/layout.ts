/**
 * Where everything sits on the table, from the viewport size alone. The reserve stands at the
 * top left, the hand and talon at the top right, the four foundations (each inside its bloom)
 * across the top between them, and the tableau below the foundations. The top-right corner is
 * left to the Hall's Pause pill and the bottom left to its toasts (docs/ARCHITECTURE.md).
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TableLayout {
  width: number;
  height: number;
  card: { w: number; h: number };
  reserve: Rect;
  talon: Rect;
  hand: Rect;
  foundations: Rect[];
  tableau: Rect[];
  /** The lowest a tableau card may reach: the top of the bottom bar. */
  floor: number;
  /** The free corner below the talon and hand, where the room puts its centrepiece. */
  decor: Rect;
  /** Heights of the top band (title and score) and the bottom bar, in CSS pixels. */
  topBand: number;
  bottomBar: number;
}

/** Column pitch as a multiple of card width: room for each foundation's bloom. */
const PITCH = 1.62;
/** Space between the reserve or talon and the foundations, in card widths. */
const SIDE_GAP = 0.9;
const TOP_BAND = 92;
const BOTTOM_BAR = 64;
/** Room for the pile labels between the two rows, in card heights. */
const ROW_GAP = 0.3;
/** How far a foundation's lotus rises above its card, in card heights (bloom.ts). */
const BLOOM_ROOM = 0.42;
/** Keep the tableau to the right of the toasts' 400 px column when the screen allows. */
const TOAST_COLUMN = 400;

export function tableLayout(width: number, height: number): TableLayout {
  // Card height from the height (two rows and a short fan must fit) and from the width.
  const byHeight = (height - TOP_BAND - BOTTOM_BAR - 24) / (1 + ROW_GAP + 1 + 5 * 0.24);
  const blockCards = 1 + SIDE_GAP + (3 * PITCH + 1) + SIDE_GAP + 2.3;
  const byWidth = (width - 64) / (blockCards / 1.4);
  // A fifth of the screen's height at most, so the room around the table still shows.
  const h = Math.round(Math.min(byHeight, byWidth, height * 0.205));
  const w = Math.round(h / 1.4);

  const centre = (3 * PITCH + 1) * w;
  const reserveWidth = w * (1 + SIDE_GAP);
  const handWidth = w * (SIDE_GAP + 2.3);
  let left = (width - (reserveWidth + centre + handWidth)) / 2 + reserveWidth;
  // Nudge right, as far as the hand allows, to keep the first pile clear of the toasts.
  const room = width - 24 - (left + centre + handWidth);
  if (left < TOAST_COLUMN && room > 0) left += Math.min(room, TOAST_COLUMN - left);
  left = Math.max(left, reserveWidth + 24);

  const top = Math.max(TOP_BAND + 16, Math.round(h * BLOOM_ROOM) + 8);
  const second = top + h + h * ROW_GAP;
  const column = (i: number) => left + i * PITCH * w;
  const foundations = [0, 1, 2, 3].map((i) => ({ x: column(i), y: top, w, h }));
  const tableau = [0, 1, 2, 3].map((i) => ({ x: column(i), y: second, w, h }));
  const reserve = { x: left - reserveWidth, y: top, w, h };
  const talon = { x: left + centre + SIDE_GAP * w, y: top, w, h };
  const hand = { x: talon.x + w * 1.3, y: top, w, h };
  const floor = height - BOTTOM_BAR - 12;
  const decorTop = top + h * 1.3;
  const decor = {
    x: talon.x - w * 0.1,
    y: decorTop,
    w: hand.x + w * 1.1 - talon.x,
    h: floor - decorTop,
  };
  return {
    width,
    height,
    card: { w, h },
    reserve,
    talon,
    hand,
    foundations,
    tableau,
    floor,
    decor,
    topBand: TOP_BAND,
    bottomBar: BOTTOM_BAR,
  };
}

/**
 * The vertical step between fanned tableau cards: a comfortable 24 % of a card, closing up
 * when a long pile would otherwise run into the bottom bar.
 */
export function fanStep(layout: TableLayout, cards: number): number {
  const comfortable = layout.card.h * 0.24;
  if (cards <= 1) return comfortable;
  const room = layout.floor - layout.tableau[0]!.y - layout.card.h;
  return Math.max(layout.card.h * 0.1, Math.min(comfortable, room / (cards - 1)));
}

export function centreOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
