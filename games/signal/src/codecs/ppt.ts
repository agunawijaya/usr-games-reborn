/**
 * Eight-hole paper tape as the BSD `ppt` program punches and reads it (BSD-3-Clause, the Regents
 * of the University of California): one row per byte, the highest bit on the left, and the small
 * sprocket ("feed") hole between the third and fourth bits from the right, so five data holes sit
 * on one side of it and three on the other.
 */

/** The tape's top and bottom edge in the original's drawing. */
const EDGE = '___________';

/** Bit positions of a row from left to right; the feed hole sits between bits 3 and 2. */
export const BIT_ORDER = [7, 6, 5, 4, 3, 2, 1, 0] as const;

/** How many data holes lie to the left of the sprocket hole. */
export const HOLES_BEFORE_SPROCKET = 5;

export function bitsOf(byte: number): boolean[] {
  return BIT_ORDER.map((bit) => (byte & (1 << bit)) !== 0);
}

export function byteOf(bits: readonly boolean[]): number {
  return BIT_ORDER.reduce<number>((byte, bit, i) => (bits[i] ? byte | (1 << bit) : byte), 0);
}

/** One row per character; characters beyond one byte are not on this tape. */
export function punchTape(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0)).filter((code) => code < 256);
}

export function readTape(rows: readonly number[]): string {
  return rows.map((byte) => String.fromCharCode(byte)).join('');
}

/** The visible form of one row: `o` for a hole, a blank for none, `.` for the sprocket. */
export function rowPicture(byte: number): string {
  let row = '|';
  for (let bit = 7; bit >= 0; bit--) {
    if (bit === 2) row += '.';
    row += byte & (1 << bit) ? 'o' : ' ';
  }
  return row + '|';
}

/**
 * Exactly what `ppt` prints: an edge, a row per character (arguments joined by one blank, with
 * no newline added), and the closing edge.
 */
export function originalTapeOutput(input: { args?: string[]; stdin?: string }): string {
  const text = input.args && input.args.length > 0 ? input.args.join(' ') : (input.stdin ?? '');
  const rows = [...text].map((char) => rowPicture(char.charCodeAt(0) & 0xff));
  return [EDGE, ...rows, EDGE].join('\n') + '\n';
}

/**
 * Reads one printed row the original's way: find the sprocket dot, then look at fixed
 * distances on either side; anything but a blank counts as a hole. Null for a row with no dot.
 */
export function readRowPicture(line: string): number | null {
  const dot = line.indexOf('.');
  if (dot < 0) return null;
  const at = (offset: number) => line[dot + offset] ?? '';
  const holes: [number, number][] = [
    [3, 0o001],
    [2, 0o002],
    [1, 0o004],
    [-1, 0o010],
    [-2, 0o020],
    [-3, 0o040],
    [-4, 0o100],
    [-5, 0o200],
  ];
  return holes.reduce((byte, [offset, bit]) => (at(offset) !== ' ' ? byte | bit : byte), 0);
}

/**
 * Exactly what `ppt -d` prints: rows are read until the first line without a sprocket after the
 * tape has begun ("lost sync"), and a newline is added unless the text ended with one.
 */
export function originalTapeDecode(stdin: string): string {
  let out = '';
  let started = false;
  let needNewline = false;
  for (const line of stdin.split('\n').slice(0, stdin.endsWith('\n') ? -1 : undefined)) {
    const byte = readRowPicture(line);
    if (byte === null) {
      if (started) break;
      continue;
    }
    started = true;
    out += String.fromCharCode(byte);
    needNewline = byte !== 10;
  }
  return needNewline ? out + '\n' : out;
}
