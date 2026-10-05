/**
 * Where everything sits on the beach, in CSS pixels, worked out once per size and shared by the
 * water shader, the castle painter and the HTML interface so they always line up.
 *
 * The composition is designed at 1920 × 1080 and scaled. The word and the shell keyboard keep
 * clear of the Hall's toast corner (bottom left, 400 px wide, whatever the size), so on narrow
 * screens the play column slides right of centre.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BeachLayout {
  width: number;
  height: number;
  /** One design pixel at 1920 × 1080, in CSS pixels. */
  scale: number;
  horizonY: number;
  shoreY: number;
  /** The play column's centre: the castle, the word and the keyboard line up on it. */
  columnX: number;
  castle: { x: number; baseY: number; width: number };
  word: Rect;
  slot: { width: number; height: number; gap: number };
  keyboard: Rect;
  key: { size: number; gap: number };
  gauge: { x: number; topY: number; bottomY: number };
  headlandX: number;
}

export const LONGEST_WORD = 14;
const TOAST_ZONE_WIDTH = 400;
const TOAST_ZONE_MARGIN = 20;
const KEYS_PER_ROW = 13;

export interface LayoutOptions {
  /** The game menu: the castle stands right of the menu card, the title written below it. */
  title?: boolean;
  /** Attract loops and posters: no interface, the castle centred, the word beneath it. */
  compact?: boolean;
}

export function beachLayout(
  width: number,
  height: number,
  wordLength = 10,
  options: LayoutOptions = {},
): BeachLayout {
  const scale = Math.min(width / 1920, height / 1080);
  const slotWidth = Math.max(48, 74 * scale);
  const slot = { width: slotWidth, height: slotWidth * 1.12, gap: Math.round(slotWidth * 0.14) };
  const key = { size: Math.max(46, 72 * scale), gap: Math.max(6, 10 * scale) };

  const wordWidth = wordLength * slot.width + (wordLength - 1) * slot.gap;
  const keyboardWidth = KEYS_PER_ROW * key.size + (KEYS_PER_ROW - 1) * key.gap;
  const widest = Math.max(wordWidth, keyboardWidth, LONGEST_WORD * 40);
  const columnX = options.title
    ? width * 0.64
    : Math.min(
        width - widest / 2 - 24 * scale,
        Math.max(width / 2, TOAST_ZONE_WIDTH + TOAST_ZONE_MARGIN + widest / 2),
      );

  const keyboardHeight = key.size * 2 + key.gap;
  const keyboardY = height - keyboardHeight - 26 * scale;
  const wordY = keyboardY - slot.height - 34 * scale;
  const castleWidth = 600 * scale;
  const castleBase = wordY - 40 * scale;

  if (options.compact) return compactLayout(width, height, wordLength);
  return {
    width,
    height,
    scale,
    horizonY: height * 0.205,
    shoreY: height * 0.485,
    columnX,
    castle: { x: columnX, baseY: castleBase, width: castleWidth },
    word: { x: columnX - wordWidth / 2, y: wordY, width: wordWidth, height: slot.height },
    slot,
    keyboard: {
      x: columnX - keyboardWidth / 2,
      y: keyboardY,
      width: keyboardWidth,
      height: keyboardHeight,
    },
    key,
    gauge: {
      x: Math.min(width - 90 * scale, columnX + castleWidth * 0.95),
      topY: height * 0.255,
      bottomY: height * 0.53,
    },
    headlandX: width * 0.86,
  };
}

function compactLayout(width: number, height: number, wordLength: number): BeachLayout {
  const scale = Math.min(width / 1920, height / 1080);
  const castleWidth = Math.min(width * 0.46, height * 0.62);
  const slotWidth = Math.min(castleWidth * 0.12, (width * 0.8) / (wordLength + 1));
  const slot = { width: slotWidth, height: slotWidth * 1.12, gap: slotWidth * 0.14 };
  const wordWidth = wordLength * slotWidth + (wordLength - 1) * slot.gap;
  const wordY = height * 0.83;
  return {
    width,
    height,
    scale: Math.max(scale, castleWidth / 600),
    horizonY: height * 0.22,
    shoreY: height * 0.5,
    columnX: width / 2,
    castle: { x: width / 2, baseY: wordY - slot.height * 0.15, width: castleWidth },
    word: { x: width / 2 - wordWidth / 2, y: wordY, width: wordWidth, height: slot.height },
    slot,
    keyboard: { x: 0, y: height, width: 0, height: 0 },
    key: { size: 0, gap: 0 },
    gauge: { x: width * 0.9, topY: height * 0.3, bottomY: height * 0.55 },
    headlandX: width * 0.86,
  };
}
