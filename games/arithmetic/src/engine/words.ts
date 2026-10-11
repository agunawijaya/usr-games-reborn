/**
 * Numerals into English words, following `number` (BSD, 1988): groups of three digits named
 * from the right (thousand, million…), no "and" inside a whole number ("two hundred fifteen"),
 * tens joined to ones by a hyphen, a fraction read as a whole number of tenths, hundredths,
 * thousandths and so on, joined by "and", and "minus" in front of a negative number.
 * `numberLines` reproduces the original's output line for line; the game uses `spell`.
 */

export const MAX_DIGITS = 65;

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = [
  '',
  'ten',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];
const GROUPS = [
  'hundred',
  'thousand',
  'million',
  'billion',
  'trillion',
  'quadrillion',
  'quintillion',
  'sextillion',
  'septillion',
  'octillion',
  'nonillion',
  'decillion',
  'undecillion',
  'duodecillion',
  'tredecillion',
  'quattuordecillion',
  'quindecillion',
  'sexdecillion',
  'septendecillion',
  'octodecillion',
  'novemdecillion',
  'vigintillion',
];
const FRACTION_PREFIX = ['', 'ten-', 'hundred-'];

export interface Numeral {
  readonly negative: boolean;
  /** Whole-number digits as typed (may be empty, as in `.5`). */
  readonly whole: string;
  /** Digits after the point, or null when there is no point. */
  readonly fraction: string | null;
}

/** Reads `-12.05`; returns null for anything `number` would refuse. */
export function parseNumeral(text: string): Numeral | null {
  const match = /^\s*(-?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match) return null;
  const whole = match[2]!;
  const fraction = match[3] ?? null;
  if (whole.length > MAX_DIGITS || (fraction?.length ?? 0) > MAX_DIGITS) return null;
  return { negative: match[1] === '-', whole, fraction };
}

interface Spoken {
  /** Words of each group, each group ending where the original starts a new line. */
  readonly groups: string[];
  readonly said: boolean;
  /** True when the last group is exactly "one", so a fraction reads "tenth", not "tenths". */
  readonly singular: boolean;
}

/** Up to three digits as words (`number()` in the original). */
function smallNumber(digits: string): { words: string; singular: boolean } {
  let words = '';
  let singular = true;
  let rest = digits;
  if (rest.length === 3) {
    if (rest[0] !== '0') {
      words = `${ONES[Number(rest[0])]} hundred`;
      singular = false;
    }
    rest = rest.slice(1);
  }
  if (rest.length === 2) {
    const value = Number(rest);
    if (value) {
      const said =
        value < 20
          ? ONES[value]!
          : TENS[Math.floor(value / 10)]! + (value % 10 ? `-${ONES[value % 10]}` : '');
      words = words ? `${words} ${said}` : said;
    }
    if (value !== 1) singular = false;
  } else if (rest.length === 1) {
    if (rest !== '0') words = ONES[Number(rest)]!;
    if (rest !== '1') singular = false;
  }
  return { words, singular };
}

/** A whole string of digits, group by group (`unit()` in the original). */
function speak(digits: string): Spoken {
  const groups: string[] = [];
  let length = digits.length;
  let at = 0;
  if (length > 3) {
    const lead = length % 3;
    if (lead) {
      length -= lead;
      const part = smallNumber(digits.slice(0, lead));
      if (part.words) groups.push(`${part.words} ${GROUPS[length / 3]}`);
      at = lead;
    }
    while (length > 3) {
      length -= 3;
      const part = smallNumber(digits.slice(at, at + 3));
      if (part.words) groups.push(`${part.words} ${GROUPS[length / 3]}`);
      at += 3;
    }
  }
  // Only the last group decides "tenth" or "tenths", and only when nothing came before it.
  const last = smallNumber(digits.slice(at));
  const singular = last.singular && !(last.words && groups.length > 0);
  if (last.words) groups.push(last.words);
  return { groups, said: groups.length > 0, singular };
}

function fractionName(length: number, singular: boolean): string {
  let name: string;
  if (length === 1) name = 'tenth';
  else if (length === 2) name = 'hundredth';
  else name = `${FRACTION_PREFIX[length % 3]}${GROUPS[Math.floor(length / 3)]}th`;
  return singular ? name : `${name}s`;
}

export interface Spelling {
  /** Each line as the original prints it, one magnitude per line. */
  readonly lines: string[];
  /** The whole phrase on one line: "four thousand two hundred fifteen". */
  readonly text: string;
}

export function spellNumeral(numeral: Numeral): Spelling {
  const lines: string[] = [];
  const phrase: string[] = [];
  if (numeral.negative) {
    lines.push('minus');
    phrase.push('minus');
  }
  const whole = numeral.whole.length > 0 ? speak(numeral.whole) : null;
  let said = false;
  if (whole?.said) {
    lines.push(...whole.groups.map((group) => `${group}.`));
    phrase.push(...whole.groups);
    said = true;
  }
  const fraction = numeral.fraction;
  if (fraction && /[1-9]/.test(fraction)) {
    if (said) {
      lines.push('and');
      phrase.push('and');
    }
    const part = speak(fraction);
    if (part.said) {
      lines.push(...part.groups.map((group) => `${group}.`));
      const name = fractionName(fraction.length, part.singular);
      lines.push(`${name}.`);
      phrase.push(...part.groups, name);
      said = true;
    }
  }
  if (!said) {
    lines.push('zero.');
    phrase.push('zero');
  }
  return { lines, text: phrase.join(' ') };
}

/** The original's multi-line output for one input, or null when it would refuse it. */
export function numberLines(text: string): string[] | null {
  const numeral = parseNumeral(text);
  return numeral ? spellNumeral(numeral).lines : null;
}

/** The phrase for a numeral string or a whole number. */
export function spell(value: string | number): string {
  const numeral = parseNumeral(String(value));
  if (!numeral) throw new RangeError(`not a numeral: ${value}`);
  return spellNumeral(numeral).text;
}

/** Words as tiles: hyphens split, so "twenty-one" is the tiles "twenty" and "one". */
export function wordTokens(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .replace(/[-,.]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Does a typed or tiled answer say this numeral? Spacing, hyphens and capitals never matter,
 * and a whole number may carry the British "and" after its hundreds.
 */
export function saysNumeral(answer: string, numeral: string): boolean {
  const expected = wordTokens(spell(numeral));
  const given = wordTokens(answer);
  if (same(given, expected)) return true;
  const parsed = parseNumeral(numeral);
  if (parsed && !(parsed.fraction && /[1-9]/.test(parsed.fraction))) {
    return same(
      given.filter((word) => word !== 'and'),
      expected,
    );
  }
  return false;
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((word, i) => word === b[i]);
}

/** Canonical digits: no grouping commas, no leading zeros, no trailing fraction zeros. */
export function canonicalNumeral(text: string): string | null {
  const numeral = parseNumeral(text.replace(/[,\s]/g, ''));
  if (!numeral || (numeral.whole === '' && !numeral.fraction)) return null;
  const whole = numeral.whole.replace(/^0+(?=\d)/, '') || '0';
  const fraction = (numeral.fraction ?? '').replace(/0+$/, '');
  const body = fraction ? `${whole}.${fraction}` : whole;
  return numeral.negative && body !== '0' ? `-${body}` : body;
}

/** Does a typed numeral match? `4,215` and `4215` both do. */
export function sameNumeral(typed: string, numeral: string): boolean {
  const a = canonicalNumeral(typed);
  return a !== null && a === canonicalNumeral(numeral);
}

/** `4215` → `4,215` for display. */
export function groupDigits(numeral: string): string {
  const parsed = parseNumeral(numeral);
  if (!parsed) return numeral;
  const whole = (parsed.whole || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = parsed.negative ? '−' : '';
  return parsed.fraction !== null ? `${sign}${whole}.${parsed.fraction}` : `${sign}${whole}`;
}

/** Every word a tile tray needs, in the order the tray shows them. */
export const TILE_WORDS: readonly string[] = [
  ...ONES.slice(1),
  ...TENS.slice(2),
  'hundred',
  'thousand',
  'million',
  'and',
  'tenth',
  'tenths',
  'hundredth',
  'hundredths',
  'thousandth',
  'thousandths',
  'zero',
  'minus',
];
