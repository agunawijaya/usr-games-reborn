/**
 * Morse code as the BSD `morse` program knew it: letters, digits, twelve punctuation marks and
 * the SK prosign it sends at the end of every message. The table is the one in `morse.c`
 * (BSD-3-Clause, the Regents of the University of California); see docs/NOTES.md.
 *
 * Codes are written with `.` for a dit and `-` for a daw.
 */

const LETTER_CODES = [
  '.-',
  '-...',
  '-.-.',
  '-..',
  '.',
  '..-.',
  '--.',
  '....',
  '..',
  '.---',
  '-.-',
  '.-..',
  '--',
  '-.',
  '---',
  '.--.',
  '--.-',
  '.-.',
  '...',
  '-',
  '..-',
  '...-',
  '.--',
  '-..-',
  '-.--',
  '--..',
] as const;

const DIGIT_CODES = [
  '-----',
  '.----',
  '..---',
  '...--',
  '....-',
  '.....',
  '-....',
  '--...',
  '---..',
  '----.',
] as const;

/** In the order `morse.c` lists them; decoding searches them in this order too. */
const PUNCTUATION_CODES: ReadonlyArray<readonly [string, string]> = [
  ['.', '.-.-.-'],
  [',', '--..--'],
  [':', '---...'],
  ['?', '..--..'],
  ["'", '.----.'],
  ['-', '-....-'],
  ['/', '-..-.'],
  ['(', '-.--.'],
  [')', '-.--.-'],
  ['"', '.-..-.'],
  ['=', '-...-'],
  ['+', '.-.-.'],
];

/** "End of work": the original sends it after every message and swallows it when decoding. */
export const END_OF_WORK = '...-.-';

/** The original gives up on a run of this many marks and prints line noise instead. */
const LONGEST_RUN = 10;

const CODE_BY_CHAR = new Map<string, string>();
LETTER_CODES.forEach((code, i) => CODE_BY_CHAR.set(String.fromCharCode(65 + i), code));
DIGIT_CODES.forEach((code, i) => CODE_BY_CHAR.set(String(i), code));
for (const [char, code] of PUNCTUATION_CODES) CODE_BY_CHAR.set(char, code);

/** Every character the code can carry, in table order: A–Z, 0–9, then punctuation. */
export const MORSE_CHARACTERS: readonly string[] = [...CODE_BY_CHAR.keys()];

/** The code for one character, or null when the table has none (`!`, `@`, `&`, `;` …). */
export function morseFor(char: string): string | null {
  return CODE_BY_CHAR.get(char.toUpperCase()) ?? null;
}

/**
 * The character a code stands for, searched in the original's order (digits, letters,
 * punctuation). The end-of-work sign reads as an empty string; anything else is null.
 */
export function characterFor(code: string): string | null {
  const digit = DIGIT_CODES.indexOf(code as (typeof DIGIT_CODES)[number]);
  if (digit >= 0) return String(digit);
  const letter = LETTER_CODES.indexOf(code as (typeof LETTER_CODES)[number]);
  if (letter >= 0) return String.fromCharCode(65 + letter);
  const mark = PUNCTUATION_CODES.find(([, punctuation]) => punctuation === code);
  if (mark) return mark[0];
  if (code === END_OF_WORK) return '';
  return null;
}

export function isSendable(char: string): boolean {
  return char === ' ' || morseFor(char) !== null;
}

/** A message as words of codes; characters the table lacks are dropped, as the original does. */
export function encodeWords(text: string): string[][] {
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) =>
      [...word].map((char) => morseFor(char)).filter((code): code is string => code !== null),
    )
    .filter((word) => word.length > 0);
}

/** Reads words of codes back; an unknown code becomes `x`, the original's "line noise". */
export function decodeWords(words: readonly (readonly string[])[]): string {
  return words.map((word) => word.map((code) => characterFor(code) ?? 'x').join('')).join(' ');
}

/** The spoken form of one code: the original says "dit" and "daw", never "dah". */
export function spoken(code: string): string {
  return [...code].map((mark) => (mark === '.' ? 'dit' : 'daw')).join(' ');
}

/**
 * Exactly what `morse` prints: one line per character, a blank line for whitespace and after
 * each argument, and the end-of-work sign last. `dots` is the `-s` switch; without it the
 * program speaks in dits and daws.
 */
export function originalMorseOutput(input: { args?: string[]; stdin?: string }, dots: boolean) {
  const lines: string[] = [];
  const show = (code: string) =>
    lines.push(dots ? ` ${code}` : [...code].map((m) => (m === '.' ? ' dit' : ' daw')).join(''));
  const send = (char: string) => {
    if (/^[A-Za-z0-9]$/.test(char)) show(morseFor(char)!);
    else if (/^\s$/.test(char)) show('');
    else {
      const mark = PUNCTUATION_CODES.find(([punctuation]) => punctuation === char);
      if (mark) show(mark[1]);
    }
  };
  if (input.args && input.args.length > 0) {
    for (const arg of input.args) {
      for (const char of arg) send(char);
      show('');
    }
  } else {
    for (const char of input.stdin ?? '') send(char);
  }
  show(END_OF_WORK);
  return lines.join('\n') + '\n';
}

/**
 * Exactly what `morse -d` prints for standard input: runs of dots and dashes are characters,
 * every second blank between them is a space, an overlong run is a single `x`.
 */
export function originalMorseDecode(stdin: string): string {
  let output = '';
  let run = '';
  let pendingBlank = false;
  let index = 0;
  while (index < stdin.length) {
    const char = stdin[index++]!;
    if (char === '-' || char === '.') {
      run += char;
      if (run.length === LONGEST_RUN) {
        run = '';
        output += 'x';
        while (index < stdin.length && (stdin[index] === '.' || stdin[index] === '-')) index++;
        // The character that ended the skipped run is consumed with it, as getchar() does.
        index++;
        pendingBlank = true;
      }
    } else if (run.length > 0) {
      output += characterFor(run) ?? 'x';
      run = '';
      pendingBlank = false;
    } else if (/\s/.test(char)) {
      if (pendingBlank) {
        output += ' ';
        pendingBlank = false;
      } else pendingBlank = true;
    }
  }
  return output + '\n';
}

/* ------------------------------------------------------------------ timing */

/** Lengths in milliseconds of the parts of a sent message. */
export interface MorseTiming {
  /** One dit; a daw is three. */
  unit: number;
  /** Silence inside a character (one unit). */
  markGap: number;
  /** Silence between characters (three units, longer under Farnsworth spacing). */
  letterGap: number;
  /** Silence between words (seven units, longer under Farnsworth spacing). */
  wordGap: number;
}

/**
 * The standard "PARIS" timing: a word of fifty units, so one unit lasts 1200 / wpm ms. With a
 * slower `effectiveWpm`, characters keep their full speed and only the gaps stretch (Farnsworth
 * spacing), which is how learners hear letters as whole sounds.
 */
export function morseTiming(wpm: number, effectiveWpm = wpm): MorseTiming {
  const unit = 1200 / wpm;
  if (effectiveWpm >= wpm) return { unit, markGap: unit, letterGap: 3 * unit, wordGap: 7 * unit };
  // PARIS has 31 units of marks and in-character gaps and 19 units of spacing between letters
  // and words; stretch only those 19.
  const spacingUnit = (60000 / effectiveWpm - 31 * unit) / 19;
  return { unit, markGap: unit, letterGap: 3 * spacingUnit, wordGap: 7 * spacingUnit };
}

/** One key-down of a schedule, with what it belongs to. */
export interface MorseMark {
  start: number;
  length: number;
  mark: '.' | '-';
  /** Index of the character in the message (spaces included). */
  charIndex: number;
}

export interface MorseSchedule {
  marks: MorseMark[];
  /** When each character of the message starts and ends sounding. */
  characters: { char: string; start: number; end: number }[];
  duration: number;
}

/** Lays a message out in time for the sounder, the lamp and the tape of marks. */
export function scheduleMessage(text: string, timing: MorseTiming): MorseSchedule {
  const marks: MorseMark[] = [];
  const characters: MorseSchedule['characters'] = [];
  let clock = 0;
  let previous: 'none' | 'char' | 'space' = 'none';
  [...text.toUpperCase()].forEach((char, charIndex) => {
    if (/\s/.test(char)) {
      if (previous === 'char') clock += timing.wordGap - timing.letterGap;
      previous = 'space';
      characters.push({ char: ' ', start: clock, end: clock });
      return;
    }
    const code = morseFor(char);
    if (!code) return;
    if (previous !== 'none') clock += timing.letterGap;
    const start = clock;
    [...code].forEach((mark, i) => {
      if (i > 0) clock += timing.markGap;
      const length = mark === '.' ? timing.unit : 3 * timing.unit;
      marks.push({ start: clock, length, mark: mark as '.' | '-', charIndex });
      clock += length;
    });
    characters.push({ char, start, end: clock });
    previous = 'char';
  });
  return { marks, characters, duration: clock };
}

/* ------------------------------------------------------------------ the key */

export type KeyEvent =
  | { kind: 'mark'; mark: '.' | '-'; length: number }
  | { kind: 'letter'; code: string; char: string | null }
  | { kind: 'word' };

/**
 * Reads a hand on the key. Presses become dits or daws by comparing them with the operator's
 * own rhythm, which it keeps learning, so a slow and a fast hand both read cleanly. Silences
 * end letters (about three units) and words (about seven).
 */
export class KeyReader {
  private unit: number;
  private code = '';
  private downAt: number | null = null;
  private lastUpAt: number | null = null;
  private wordOpen = false;

  constructor(
    startingWpm: number,
    private readonly adaptive = true,
  ) {
    this.unit = 1200 / startingWpm;
  }

  /** The operator's current speed estimate. */
  get wpm(): number {
    return 1200 / this.unit;
  }

  get pendingCode(): string {
    return this.code;
  }

  press(time: number): KeyEvent[] {
    const events = this.flush(time);
    this.downAt = time;
    return events;
  }

  release(time: number): KeyEvent[] {
    if (this.downAt === null) return [];
    const length = Math.max(1, time - this.downAt);
    this.downAt = null;
    this.lastUpAt = time;
    // Between a dit (1 unit) and a daw (3 units), the geometric mean (√3 ≈ 1.73) is the
    // fairest dividing line for an uneven hand.
    const mark: '.' | '-' = length < this.unit * Math.sqrt(3) ? '.' : '-';
    if (this.adaptive) this.learn(mark === '.' ? length : length / 3);
    this.code += mark;
    this.wordOpen = true;
    return [{ kind: 'mark', mark, length }];
  }

  /** Call regularly while the key is up, so silences can end letters and words. */
  tick(time: number): KeyEvent[] {
    return this.downAt === null ? this.flush(time) : [];
  }

  /** Ends whatever is pending, as if the operator had paused for a whole word. */
  finish(): KeyEvent[] {
    if (this.lastUpAt === null) return [];
    return this.flush(this.lastUpAt + this.unit * 100);
  }

  private flush(time: number): KeyEvent[] {
    if (this.lastUpAt === null) return [];
    const silence = time - this.lastUpAt;
    const events: KeyEvent[] = [];
    if (this.code && silence >= this.unit * 2) {
      events.push({ kind: 'letter', code: this.code, char: characterFor(this.code) });
      this.code = '';
    }
    if (this.wordOpen && !this.code && silence >= this.unit * 5) {
      events.push({ kind: 'word' });
      this.wordOpen = false;
    }
    return events;
  }

  private learn(unitSample: number) {
    // Clamp single wild presses so one stumble cannot throw the reader off.
    const sample = Math.min(this.unit * 2, Math.max(this.unit / 2, unitSample));
    this.unit = this.unit * 0.8 + sample * 0.2;
  }
}
