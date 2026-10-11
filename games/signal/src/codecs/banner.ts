import { BANNER_GLYPH_ROWS } from './banner-glyphs';

/**
 * The banner printer: messages printed sideways down 132 columns of fan-fold paper, one glyph
 * after another, as Mark Horton's `banner` did (BSD-3-Clause, the Regents of the University of
 * California). A narrower width "scrunches" the banner the original's way, by skipping whole
 * lines and columns, so letters grow grainy and sometimes run together.
 */

/** Print positions across the paper. */
export const FULL_WIDTH = 132;

/** One printer line of a glyph: the `#` spans across the paper. */
interface GlyphLine {
  spans: ReadonlyArray<readonly [start: number, length: number]>;
  /** The original prints a line only up to the end of the last span it set (see below). */
  printedTo: number;
}

const glyphCache = new Map<string, GlyphLine[]>();

/** A glyph's printer lines, expanded from its row groups. */
function glyphLines(char: string): GlyphLine[] | null {
  const cached = glyphCache.get(char);
  if (cached) return cached;
  const rows = BANNER_GLYPH_ROWS.get(char);
  if (rows === undefined) return null;
  const lines: GlyphLine[] = [];
  // `max` in the original survives a run of blank lines: it is only moved by a new span.
  let printedTo = 0;
  for (const group of rows.split('|')) {
    const numbers = group.split(' ').map(Number);
    const repeat = numbers[0]!;
    const spans: [number, number][] = [];
    for (let i = 1; i < numbers.length; i += 2) spans.push([numbers[i]!, numbers[i + 1]!]);
    if (spans.length > 0) printedTo = spans[spans.length - 1]![0] + spans[spans.length - 1]![1];
    for (let n = 0; n < repeat; n++) lines.push({ spans, printedTo });
  }
  glyphCache.set(char, lines);
  return lines;
}

export function hasGlyph(char: string): boolean {
  return BANNER_GLYPH_ROWS.has(char);
}

/** The characters of a message the printer cannot print, in order of first appearance. */
export function missingGlyphs(message: string): string[] {
  return [...new Set([...message].filter((char) => !hasGlyph(char)))];
}

/**
 * Which of the 132 positions survive at a width: the original marks `i * 132 / width` for each
 * of `width` steps, and the same marks choose the lines kept inside each glyph. That double use
 * is where the grain comes from.
 */
export function keptPositions(width: number): boolean[] {
  const kept = new Array<boolean>(FULL_WIDTH).fill(false);
  for (let i = 0; i < width; i++) {
    const position = Math.floor((i * FULL_WIDTH) / width);
    if (position < FULL_WIDTH) kept[position] = true;
  }
  return kept;
}

/** A printed banner as a grid of cells: `rows[line][column]` is true where a `#` is printed. */
export interface BannerPrint {
  /** Lines down the paper. */
  rows: boolean[][];
  /** Columns across the paper after scrunching. */
  width: number;
  /** For each printed line, the index of the message character it belongs to. */
  charOfRow: number[];
}

/**
 * Prints a message at a width (132 is full size). Characters without a glyph throw, as the
 * original refuses the whole message; check with `missingGlyphs` first.
 */
export function printBanner(message: string, width = FULL_WIDTH): BannerPrint {
  const missing = missingGlyphs(message);
  if (missing.length > 0) throw new Error(`no glyph for ${missing.join(' ')}`);
  const kept = keptPositions(Math.min(width, FULL_WIDTH));
  const columns = kept.flatMap((keep, position) => (keep ? [position] : []));
  const rows: boolean[][] = [];
  const charOfRow: number[] = [];
  [...message].forEach((char, charIndex) => {
    glyphLines(char)!.forEach((line, lineIndex) => {
      if (!kept[lineIndex]) return;
      const cells = new Array<boolean>(FULL_WIDTH).fill(false);
      for (const [start, length] of line.spans) cells.fill(true, start, start + length);
      rows.push(columns.map((column) => cells[column]!));
      charOfRow.push(charIndex);
    });
  });
  return { rows, width: columns.length, charOfRow };
}

/**
 * Exactly what `banner [-w width] message` prints, trailing spaces included: each line runs to
 * one past the last span the original set, which it remembers across blank lines. Used to
 * prove the glyphs against the original's output.
 */
export function originalBannerOutput(message: string, width = FULL_WIDTH): string {
  const kept = keptPositions(width);
  let out = '';
  for (const char of message) {
    let printedTo = 0;
    for (const [lineIndex, line] of glyphLines(char)!.entries()) {
      printedTo = line.spans.length > 0 ? line.printedTo : printedTo;
      if (!kept[lineIndex]) continue;
      const cells = new Array<string>(FULL_WIDTH + 1).fill(' ');
      for (const [start, length] of line.spans) cells.fill('#', start, start + length);
      for (let column = 0; column <= printedTo; column++) if (kept[column]) out += cells[column];
      out += '\n';
    }
  }
  return out;
}

/** The number of printer lines a message takes at full width, for pacing the print. */
export function bannerLength(message: string): number {
  return [...message].reduce((sum, char) => sum + (glyphLines(char)?.length ?? 0), 0);
}
