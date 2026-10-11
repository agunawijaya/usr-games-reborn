/**
 * Punch cards as the BSD `bcd` program printed them. Steve Hayman rebuilt `bcd` in 1989 from
 * nothing but its manual page: with no code table to hand, he deduced the hole patterns from
 * the old program's output, and Dyane Bruce fixed four entries in 1993 (Q and R had shared a
 * code). The table below is theirs, entry for entry (BSD-3-Clause, the Regents of the
 * University of California); `docs/NOTES.md` compares it with the IBM keypunch code.
 *
 * Each pattern is twelve bits, one per punch row: bit 11 is the top row ("12"), bit 10 the
 * "11" row, bit 9 the zero row, and bits 8 to 0 the rows 1 to 9. A set bit is a hole.
 */

/** The card's twelve rows, top to bottom, by the names printed on real cards. */
export const ROW_NAMES = ['12', '11', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** Columns on a card the original prints; real cards had eighty. */
export const CARD_COLUMNS = 48;

/** The 256 patterns of `bcd.c`, indexed by byte value. */
// prettier-ignore
export const HOLES: readonly number[] = [
  0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
  0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
  0x0, 0x206, 0x20a, 0x042, 0x442, 0x222, 0x800, 0x406,
  0x812, 0x412, 0x422, 0xa00, 0x242, 0x400, 0x842, 0x300,
  0x200, 0x100, 0x080, 0x040, 0x020, 0x010, 0x008, 0x004,
  0x002, 0x001, 0x012, 0x40a, 0x80a, 0x212, 0x00a, 0x006,
  0x022, 0x900, 0x880, 0x840, 0x820, 0x810, 0x808, 0x804,
  0x802, 0x801, 0x500, 0x480, 0x440, 0x420, 0x410, 0x408,
  0x404, 0x402, 0x401, 0x280, 0x240, 0x220, 0x210, 0x208,
  0x204, 0x202, 0x201, 0x082, 0x822, 0x600, 0x282, 0x30f,
  0x900, 0x880, 0x840, 0x820, 0x810, 0x808, 0x804, 0x802,
  0x801, 0x500, 0x480, 0x440, 0x420, 0x410, 0x408, 0x404,
  0x402, 0x401, 0x280, 0x240, 0x220, 0x210, 0x208, 0x204,
  0x202, 0x201, 0x082, 0x806, 0x822, 0x600, 0x282, 0x0,
  0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
  0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
  0x206, 0x20a, 0x042, 0x442, 0x222, 0x800, 0x406, 0x812,
  0x412, 0x422, 0xa00, 0x242, 0x400, 0x842, 0x300, 0x200,
  0x100, 0x080, 0x040, 0x020, 0x010, 0x008, 0x004, 0x002,
  0x001, 0x012, 0x40a, 0x80a, 0x212, 0x00a, 0x006, 0x022,
  0x900, 0x880, 0x840, 0x820, 0x810, 0x808, 0x804, 0x802,
  0x801, 0x500, 0x480, 0x440, 0x420, 0x410, 0x408, 0x404,
  0x402, 0x401, 0x280, 0x240, 0x220, 0x210, 0x208, 0x204,
  0x202, 0x201, 0x082, 0x806, 0x822, 0x600, 0x282, 0x30f,
  0x900, 0x880, 0x840, 0x820, 0x810, 0x808, 0x804, 0x802,
  0x801, 0x500, 0x480, 0x440, 0x420, 0x410, 0x408, 0x404,
  0x402, 0x401, 0x280, 0x240, 0x220, 0x210, 0x208, 0x204,
  0x202, 0x201, 0x082, 0x806, 0x822, 0x600, 0x282, 0x0,
];

/** The rows (0 = the "12" row) punched by a pattern, top to bottom. */
export function rowsOf(pattern: number): number[] {
  const rows: number[] = [];
  for (let row = 0; row < 12; row++) if (pattern & (1 << (11 - row))) rows.push(row);
  return rows;
}

export function patternOf(rows: readonly number[]): number {
  return rows.reduce((pattern, row) => pattern | (1 << (11 - row)), 0);
}

/** Writes a pattern the way card people say it: `12-1`, `0-3-8`, `11`. */
export function punchName(pattern: number): string {
  return rowsOf(pattern)
    .map((row) => ROW_NAMES[row])
    .join('-');
}

/** The original upper-cases letters (and only ASCII letters) before it looks them up. */
function cardCase(char: string): string {
  return /^[a-z]$/.test(char) ? char.toUpperCase() : char;
}

/**
 * The pattern for a character. Only ASCII is punched: the table's upper half repeats the lower
 * one shifted by a place (an artefact of the deduction; see docs/NOTES.md), and our cards keep
 * to the characters a keypunch had.
 */
export function holesFor(char: string): number {
  const code = cardCase(char).charCodeAt(0);
  return code < 128 ? (HOLES[code] ?? 0) : 0;
}

export function canPunch(char: string): boolean {
  return char === ' ' || holesFor(char) !== 0;
}

/** One column of a card: the character printed along the top edge and its holes. */
export interface CardColumn {
  /** What the top edge shows: the character, or a blank when it has no pattern. */
  printed: string;
  holes: number;
}

/**
 * A card as the original makes it: the first line of the text, cut to 48 columns, letters
 * upper-cased, characters without a pattern left blank.
 */
export function punchCard(text: string): CardColumn[] {
  const line = text.split('\n')[0]!.slice(0, CARD_COLUMNS);
  return [...line].map((char) => {
    const upper = cardCase(char);
    const holes = holesFor(upper);
    return { printed: holes ? upper : ' ', holes };
  });
}

/**
 * The character a pattern reads as. Several characters share a pattern in this table (`A` and
 * the backquote, `\` and `|`, `]` and `}`, `^` and `~`); the reader gives the first in byte
 * order, as a card reader with this table would.
 */
export function readPattern(pattern: number): string | null {
  if (pattern === 0) return ' ';
  for (let code = 32; code < 127; code++)
    if (HOLES[code] === pattern) return String.fromCharCode(code);
  return null;
}

export function readCard(columns: readonly number[]): string {
  return columns
    .map((pattern) => readPattern(pattern) ?? '?')
    .join('')
    .trimEnd();
}

/** Exactly what `bcd` prints for one line of text, row characters and frame included. */
export function originalCardOutput(text: string): string {
  const columns = punchCard(text);
  const rowChars = '   123456789';
  let out = ' ' + '_'.repeat(CARD_COLUMNS) + '\n';
  out +=
    '/' +
    columns
      .map((column) => column.printed)
      .join('')
      .padEnd(CARD_COLUMNS) +
    '|\n';
  for (let row = 0; row < 12; row++) {
    let line = '|';
    for (let i = 0; i < CARD_COLUMNS; i++) {
      const holes = columns[i]?.holes ?? 0;
      line += holes & (1 << (11 - row)) ? ']' : rowChars[row];
    }
    out += line + '|\n';
  }
  return out + '|' + '_'.repeat(CARD_COLUMNS) + '|\n';
}
