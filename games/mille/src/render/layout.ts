import { CARD_ASPECT } from './card-art';

/**
 * Where everything sits, worked out on a 1920 × 1080 design grid and scaled to the window. The
 * road strip runs across the top under the score bar; the two sides' placards sit below it,
 * yours on the left; your hand, the deck and the discard pile run along the bottom, clear of
 * the corner where the Hall stacks its toasts.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SideSlots {
  panel: Rect;
  battle: Rect;
  speed: Rect;
  safeties: Rect[];
  /** One column per distance, 25 to 200. */
  miles: Rect[];
  /** The odometer: miles so far against the trip. */
  odometer: Rect;
}

export interface TableLayout {
  width: number;
  height: number;
  /** Design pixels to screen pixels. */
  scale: number;
  bar: Rect;
  road: Rect;
  sides: [SideSlots, SideSlots];
  /** Seven hand slots: the pick first, then 1–6. */
  hand: Rect[];
  deck: Rect;
  discard: Rect;
  status: Rect;
}

const DESIGN_W = 1920;
const DESIGN_H = 1080;

export function computeLayout(width: number, height: number): TableLayout {
  const scale = Math.min(width / DESIGN_W, height / DESIGN_H);
  // Centre the design grid; the road and the table paper fill any spare edge.
  const ox = (width - DESIGN_W * scale) / 2;
  const oy = (height - DESIGN_H * scale) / 2;
  const r = (x: number, y: number, w: number, h: number): Rect => ({
    x: ox + x * scale,
    y: oy + y * scale,
    w: w * scale,
    h: h * scale,
  });

  const barH = 64;
  const roadH = 392;
  const panelTop = barH + roadH + 14;
  const panelH = 246;
  const sides = ([0, 1] as const).map((side) => {
    const px = side === 0 ? 24 : 972;
    const pw = 924;
    const cardW = 112;
    const cardH = cardW * CARD_ASPECT;
    const cy = panelTop + 58;
    const battle = r(px + 20, cy, cardW, cardH);
    const speed = r(px + 20 + cardW + 14, cy, cardW, cardH);
    // Each safety slot is square, so a coup fourré can lie crosswise in it.
    const sx = px + 20 + (cardW + 14) * 2 + 18;
    const slot = 104;
    const safeties = [0, 1, 2, 3].map((i) => r(sx + i * (slot + 14), cy, slot, slot));
    const chipW = (px + pw - 20 - sx - 4 * 10) / 5;
    const miles = [0, 1, 2, 3, 4].map((i) => r(sx + i * (chipW + 10), cy + slot + 34, chipW, 42));
    const odoX = sx + 4 * (slot + 14) + 6;
    const odometer = r(odoX, cy, px + pw - 20 - odoX, slot);
    return { panel: r(px, panelTop, pw, panelH), battle, speed, safeties, miles, odometer };
  }) as [SideSlots, SideSlots];

  // The hand keeps clear of the corner where the Hall stacks its toasts (400 px wide, at any
  // window size), so on small windows it starts further right and its cards shrink to fit.
  const toastClear = 412 / scale;
  const handX = Math.max(430, toastClear);
  const deckW = 148;
  const pitch = Math.min(160, (1580 - handX) / 7);
  const handW = pitch - 12;
  const handTop = panelTop + panelH + 44;
  const handH = handW * CARD_ASPECT;
  const hand = Array.from({ length: 7 }, (_, i) =>
    r(handX + i * pitch, handTop + (148 - handW) * 0.6, handW, handH),
  );
  const deck = r(1580, handTop, deckW, deckW * CARD_ASPECT);
  const discard = r(1748, handTop, deckW, deckW * CARD_ASPECT);
  return {
    width,
    height,
    scale,
    bar: { x: 0, y: 0, w: width, h: oy + barH * scale },
    road: { x: 0, y: oy + barH * scale, w: width, h: roadH * scale },
    sides,
    hand,
    deck,
    discard,
    status: r(handX, panelTop + panelH + 6, 1896 - handX, 34),
  };
}
