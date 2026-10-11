import type { DeskPalette } from '../palette';
import { alpha, contactShadow, type Ctx, FONT_MONO, linear, mix, roundRect } from '../paint';

/**
 * The register: a strip of paper the marks are inked on as they arrive, dots as short dashes
 * and daws as long ones, the way the old inkers did. Marks are placed by time, so the gaps
 * between letters and words show as gaps on the paper.
 */
export interface RegisterMark {
  start: number;
  length: number;
  mark: '.' | '-';
}

export interface RegisterLook {
  marks: readonly RegisterMark[];
  /** Seconds the strip spans from its left edge. */
  span: number;
  /** Seconds at the strip's left edge (it scrolls as marks arrive). */
  from: number;
  /** Letters written under the marks (help on), each at its start time. */
  letters?: ReadonlyArray<{ char: string; at: number; right?: boolean | null }>;
  /** A mark being made right now, still growing. */
  live?: { start: number; length: number } | null;
}

export function paintRegister(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: DeskPalette,
  look: RegisterLook,
) {
  ctx.save();
  contactShadow(ctx, x + w / 2, y + h + 6, w * 0.52, 14, 0.35);
  ctx.fillStyle = linear(ctx, 0, y, 0, y + h, [
    [0, mix(pal.paper, '#ffffff', 0.3)],
    [1, pal.paperShade],
  ]);
  ctx.fillRect(x, y, w, h);
  // Fine ruling along the strip.
  ctx.strokeStyle = alpha(pal.inkRed, 0.18);
  ctx.lineWidth = 1;
  for (const ry of [y + h * 0.22, y + h * 0.78]) {
    ctx.beginPath();
    ctx.moveTo(x, ry);
    ctx.lineTo(x + w, ry);
    ctx.stroke();
  }
  const scale = w / look.span;
  const markY = look.letters ? y + h * 0.4 : y + h * 0.5;
  const thickness = Math.max(3, h * 0.13);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = pal.ink;
  const draw = (start: number, length: number) => {
    const mx = x + (start - look.from) * scale;
    const mw = Math.max(thickness, length * scale);
    if (mx + mw < x || mx > x + w) return;
    roundRect(ctx, mx, markY - thickness / 2, mw, thickness, thickness / 2);
    ctx.fill();
  };
  for (const mark of look.marks) draw(mark.start, mark.length);
  if (look.live) {
    ctx.fillStyle = pal.inkRed;
    draw(look.live.start, look.live.length);
  }
  if (look.letters) {
    ctx.font = `600 ${Math.max(12, h * 0.26)}px ${FONT_MONO}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (const letter of look.letters) {
      // The strip is paper in both looks, so its letters are always in dark ink.
      ctx.fillStyle = letter.right === false ? pal.inkRed : alpha(pal.ink, 0.75);
      ctx.fillText(letter.char, x + (letter.at - look.from) * scale, y + h * 0.78);
    }
  }
  ctx.restore();
  // Torn ends.
  ctx.fillStyle = alpha('#000000', 0.08);
  ctx.fillRect(x, y, 3, h);
  ctx.fillRect(x + w - 3, y, 3, h);
  ctx.restore();
}

/** A mark placed on the ruled register by code units, row by row. */
export interface PlacedMark {
  row: number;
  /** Units from the row's start. */
  at: number;
  mark: '.' | '-';
  /** When it sounds, in milliseconds from the start of the message. */
  start: number;
}

/**
 * Lays a message's marks out by units, the way a page of code is written: a dit is one unit, a
 * daw three, one unit inside a letter, three between letters, seven between words, and a new
 * row where a word would run off the strip.
 */
export function layoutMarks(
  marks: ReadonlyArray<{ start: number; mark: '.' | '-'; charIndex: number }>,
  text: string,
  unitsPerRow: number,
): { marks: PlacedMark[]; rows: number } {
  const words: number[][] = [];
  let current: number[] = [];
  let lastChar = -1;
  marks.forEach((mark, i) => {
    if (lastChar >= 0 && mark.charIndex !== lastChar) {
      const between = text.slice(lastChar + 1, mark.charIndex);
      if (/\s/.test(between)) {
        words.push(current);
        current = [];
      }
    }
    current.push(i);
    lastChar = mark.charIndex;
  });
  if (current.length > 0) words.push(current);
  const placed: PlacedMark[] = [];
  let row = 0;
  let cursor = 0;
  for (const word of words) {
    // Measure the word first, so it can move to a fresh row whole.
    let width = 0;
    word.forEach((index, k) => {
      if (k > 0) width += marks[index]!.charIndex !== marks[word[k - 1]!]!.charIndex ? 3 : 1;
      width += marks[index]!.mark === '.' ? 1 : 3;
    });
    if (cursor > 0 && cursor + 7 + width > unitsPerRow) {
      row++;
      cursor = 0;
    } else if (cursor > 0) cursor += 7;
    word.forEach((index, k) => {
      if (k > 0) cursor += marks[index]!.charIndex !== marks[word[k - 1]!]!.charIndex ? 3 : 1;
      const mark = marks[index]!;
      placed.push({ row, at: cursor, mark: mark.mark, start: mark.start });
      cursor += mark.mark === '.' ? 1 : 3;
    });
  }
  return { marks: placed, rows: row + 1 };
}

/** The register in rows: marks inked by units, appearing as they sound. */
export function paintRegisterRows(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  rowHeight: number,
  pal: DeskPalette,
  layout: { marks: readonly PlacedMark[]; rows: number },
  unit: number,
  shownUntil: number,
  sounding: number,
) {
  const h = rowHeight * Math.max(1, layout.rows) + rowHeight * 0.3;
  ctx.save();
  contactShadow(ctx, x + w / 2, y + h + 6, w * 0.52, 14, 0.35);
  ctx.fillStyle = linear(ctx, 0, y, 0, y + h, [
    [0, mix(pal.paper, '#ffffff', 0.3)],
    [1, pal.paperShade],
  ]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = alpha(pal.inkRed, 0.16);
  ctx.lineWidth = 1;
  for (let row = 0; row <= layout.rows; row++) {
    const ry = y + rowHeight * 0.15 + row * rowHeight;
    ctx.beginPath();
    ctx.moveTo(x, ry);
    ctx.lineTo(x + w, ry);
    ctx.stroke();
  }
  const thickness = rowHeight * 0.24;
  layout.marks.forEach((mark, i) => {
    if (mark.start > shownUntil) return;
    ctx.fillStyle = i === sounding ? pal.inkRed : pal.ink;
    const mx = x + 30 + mark.at * unit;
    const my = y + rowHeight * 0.15 + mark.row * rowHeight + rowHeight / 2 - thickness / 2;
    roundRect(ctx, mx, my, (mark.mark === '.' ? 1 : 3) * unit, thickness, thickness / 2);
    ctx.fill();
  });
  ctx.restore();
}
