/**
 * Where everything sits on screen, for any window from 1280 × 720 to 2560 × 1440 (drawn at
 * 1920 × 1080 and scaled). The pond fills the left of the screen, rivals on its far bank, your
 * hand on the near one; the notebook and the bucket stand in a column on the right.
 *
 * Two corners are kept free for the Hall: the Pause pill's 220 × 64 at the top right and the
 * toasts' 400-wide column rising from 64 px above the bottom left (docs/ARCHITECTURE.md). The
 * notebook starts below the pill; the hand and the ask bar keep right of the toast column.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PondShape {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** The pond's edge at an angle (radians), wobbled so it reads as a real bank. */
  edge(angle: number): Point;
  /** The water's top edge at a given x (the far shore), for placing rivals and reflections. */
  farShore(x: number): number;
  nearShore(x: number): number;
}

export interface SeatSpot {
  /** Where the rival sits or stands, at the water's edge. */
  base: Point;
  scale: number;
}

export interface PondLayout {
  width: number;
  height: number;
  /** The design scale: 1 at 1920 × 1080. */
  s: number;
  pondArea: Rect;
  pond: PondShape;
  /** The sky's lower edge, where the far trees stand. */
  horizon: number;
  /** The face-down pile on its lily pad. */
  pile: Point;
  /** Up to three rivals' places along the far shore, left to right. */
  seats: (count: number) => SeatSpot[];
  hand: { cx: number; baseline: number; cardHeight: number; maxWidth: number };
  askBar: Rect;
  notebook: Rect;
  bucket: Rect;
  /** Where the line is cast from: the tip of your rod, just above the hand. */
  rodTip: Point;
  /** Safe zones, for the tests that keep the game clear of the Hall's chrome. */
  safe: { pill: Rect; toasts: Rect };
}

const DESIGN = { width: 1920, height: 1080 };

export interface LayoutOptions {
  /** Lay the pond across the whole width, with no column for the notebook (key art, menus). */
  poster?: boolean;
  /** Keep the pond right of this x (the game menu's card stands on the left). */
  left?: number;
}

export function layoutFor(width: number, height: number, options: LayoutOptions = {}): PondLayout {
  const s = Math.min(width / DESIGN.width, height / DESIGN.height);
  const columnWidth = options.poster ? 0 : Math.max(300, 376 * s);
  const gutter = options.poster ? 0 : 16 * Math.max(s, 0.75);
  const left = Math.min(options.left ?? 0, width * 0.45);
  const pondArea: Rect = { x: left, y: 0, w: width - left - columnWidth - gutter * 2, h: height };
  const horizon = height * 0.19;
  const pond = pondShape(pondArea, height);
  const pile = { x: pond.cx + pond.rx * 0.02, y: pond.cy + pond.ry * 0.12 };

  const toasts: Rect = { x: 0, y: height - 64 - 360 * s, w: 400, h: 360 * s };
  const cardHeight = 150 * s;
  const handMaxWidth = Math.min(pondArea.w - 440 * s, 940 * s);
  const handCx = Math.max(pondArea.w / 2 + 40 * s, toasts.w + 24 * s + handMaxWidth / 2);
  // The bar sizes itself to the ranks you hold; this is its widest, centred over the hand and
  // clear of a lifted card.
  const askBarWidth = Math.min(860 * s, pondArea.w - toasts.w - 40 * s);
  const askBar: Rect = {
    x: handCx - askBarWidth / 2,
    y: height - cardHeight - 136 * s,
    w: askBarWidth,
    h: 64 * s,
  };

  const columnX = width - columnWidth - gutter;
  const notebook: Rect = { x: columnX, y: 80 * s, w: columnWidth, h: height * 0.6 - 80 * s };
  const bucket: Rect = {
    x: columnX,
    y: notebook.y + notebook.h + 16 * s,
    w: columnWidth,
    h: height - (notebook.y + notebook.h + 16 * s) - gutter,
  };

  return {
    width,
    height,
    s,
    pondArea,
    pond,
    horizon,
    pile,
    seats: (count) => seatsFor(count, pond, s),
    hand: { cx: handCx, baseline: height - 20 * s, cardHeight, maxWidth: handMaxWidth },
    askBar,
    notebook,
    bucket,
    // The rod leans in from the left of the fan, never across your cards.
    rodTip: { x: handCx - handMaxWidth / 2 - 30 * s, y: height - cardHeight - 96 * s },
    safe: { pill: { x: width - 220, y: 0, w: 220, h: 64 }, toasts },
  };
}

function pondShape(area: Rect, height: number): PondShape {
  const cx = area.x + area.w * 0.5;
  const cy = height * 0.585;
  const rx = area.w * 0.47;
  const ry = height * 0.235;
  // Gentle bays and points, the same every time.
  const wobble = (angle: number) =>
    1 +
    0.035 * Math.sin(angle * 3 + 0.6) +
    0.025 * Math.sin(angle * 5 + 2.1) +
    0.015 * Math.sin(angle * 9);
  const edge = (angle: number): Point => {
    const w = wobble(angle);
    return { x: cx + Math.cos(angle) * rx * w, y: cy + Math.sin(angle) * ry * w };
  };
  const shoreAt = (x: number, top: boolean) => {
    const u = Math.max(-0.999, Math.min(0.999, (x - cx) / rx));
    const angle = top ? -Math.acos(u) : Math.acos(u);
    return edge(angle).y;
  };
  return {
    cx,
    cy,
    rx,
    ry,
    edge,
    farShore: (x) => shoreAt(x, true),
    nearShore: (x) => shoreAt(x, false),
  };
}

/**
 * Rivals along the far shore. One sits in the middle; two share it either side; three take the
 * left, the middle and the right, the middle one a touch further back.
 */
function seatsFor(count: number, pond: PondShape, s: number): SeatSpot[] {
  const spread = pond.rx * 0.62;
  const xs =
    count === 1
      ? [pond.cx]
      : count === 2
        ? [pond.cx - spread * 0.62, pond.cx + spread * 0.62]
        : [pond.cx - spread, pond.cx, pond.cx + spread];
  return xs.map((x, i) => {
    const middleOfThree = count === 3 && i === 1;
    const shore = pond.farShore(x);
    // Each stands or sits just inside the water's edge; the middle one wades a little deeper.
    return {
      base: { x, y: shore + (middleOfThree ? 34 : 40) * s },
      scale: s * (middleOfThree ? 1.08 : 1.2),
    };
  });
}
