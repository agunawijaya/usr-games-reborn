import { FULL_WIDTH, hasGlyph, printBanner } from '../codecs/banner';
import { CARD_COLUMNS, punchCard, ROW_NAMES } from '../codecs/bcd';
import { keywordShift, rotate } from '../codecs/caesar';
import { encodeWords, spoken } from '../codecs/morse';
import { bitsOf, HOLES_BEFORE_SPROCKET, punchTape } from '../codecs/ppt';
import { canSend, DIRECTION_NAMES, encodeSemaphore } from '../codecs/semaphore';
import type { Step } from './message';

/**
 * "Make your own": a message turned on the wheel (or not) and carried by one machine, packed
 * into a desk code a friend can paste back in. Codes are plain text with no links; the payload
 * is lightly scrambled so the words do not show at a glance.
 */
export type Carrier = 'telegraph' | 'punch' | 'tape' | 'printer' | 'semaphore';

export const CARRIERS: readonly Carrier[] = ['telegraph', 'punch', 'tape', 'printer', 'semaphore'];

export type Turn =
  | { kind: 'none' }
  | { kind: 'shift'; shift: number; secret: boolean }
  | { kind: 'keyword'; keyword: string; secret: boolean };

export interface Recipe {
  text: string;
  turn: Turn;
  carrier: Carrier;
}

const CARRIER_LETTER: Record<Carrier, string> = {
  telegraph: 'M',
  punch: 'C',
  tape: 'T',
  printer: 'B',
  semaphore: 'F',
};

/** The characters each carrier can take, so the sandbox can warn before it packs. */
export function unsendable(text: string, carrier: Carrier): string[] {
  const bad = [...new Set([...text.toUpperCase()])].filter((char) => {
    if (char === ' ') return false;
    switch (carrier) {
      case 'telegraph':
        return encodeWords(char).length === 0;
      case 'punch':
        return punchCard(char)[0]?.holes === 0;
      case 'tape':
        return char.charCodeAt(0) > 126;
      case 'printer':
        return !hasGlyph(char);
      case 'semaphore':
        return !canSend(char);
    }
  });
  return bad;
}

/** Applies the recipe's turn: what the carrier actually carries. */
export function turned(recipe: Recipe): string {
  const text = recipe.text.toUpperCase();
  if (recipe.turn.kind === 'shift') return rotate(text, recipe.turn.shift);
  if (recipe.turn.kind === 'keyword') return keywordShift(text, recipe.turn.keyword);
  return text;
}

/* ------------------------------------------------------------------ codes */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SCRAMBLE = [...'DITSANDDAWS'].map((char) => char.charCodeAt(0));

function toBase32(bytes: readonly number[]): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string): number[] | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return null;
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return out;
}

function checksum(text: string): string {
  let sum = 7;
  for (const char of text) sum = (sum * 31 + char.charCodeAt(0)) % 1024;
  return ALPHABET[sum >> 5]! + ALPHABET[sum & 31]!;
}

function turnTag(turn: Turn): string {
  if (turn.kind === 'none') return '0';
  const letter = turn.kind === 'shift' ? 'R' : 'K';
  return turn.secret ? `${letter}S` : letter;
}

/**
 * `DD1-C-R-ABCD…-XY`: version, carrier, how the message was turned (and whether the turn is
 * kept secret on the friend's screen), the scrambled payload, and a check. The payload carries
 * the turn too, so the desk can tell a friend when they have cracked a secret one.
 */
export function packCode(recipe: Recipe): string {
  const carried = turned(recipe);
  const key =
    recipe.turn.kind === 'shift'
      ? String(recipe.turn.shift)
      : recipe.turn.kind === 'keyword'
        ? recipe.turn.keyword.toUpperCase()
        : '';
  const payload = `${key}|${carried}`;
  const bytes = [...payload].map(
    (char, i) => (char.charCodeAt(0) & 127) ^ SCRAMBLE[i % SCRAMBLE.length]!,
  );
  const body = `DD1-${CARRIER_LETTER[recipe.carrier]}-${turnTag(recipe.turn)}-${toBase32(bytes)}`;
  return `${body}-${checksum(body)}`;
}

export interface Unpacked {
  carrier: Carrier;
  /** The message as carried (still turned, if it was). */
  carried: string;
  turn: Turn;
}

export function unpackCode(code: string): Unpacked | null {
  const clean = code.trim().toUpperCase().replace(/\s+/g, '');
  const parts = clean.split('-');
  if (parts.length !== 5 || parts[0] !== 'DD1') return null;
  const [, carrierLetter, tag, payload, check] = parts as [string, string, string, string, string];
  if (checksum(parts.slice(0, 4).join('-')) !== check) return null;
  const carrier = (Object.keys(CARRIER_LETTER) as Carrier[]).find(
    (c) => CARRIER_LETTER[c] === carrierLetter,
  );
  const bytes = fromBase32(payload);
  if (!carrier || !bytes) return null;
  const text = bytes
    .map((byte, i) => String.fromCharCode(byte ^ SCRAMBLE[i % SCRAMBLE.length]!))
    .join('');
  const bar = text.indexOf('|');
  if (bar < 0) return null;
  const key = text.slice(0, bar);
  const carried = text.slice(bar + 1);
  const secret = tag.endsWith('S');
  let turn: Turn;
  if (tag === '0') turn = { kind: 'none' };
  else if (tag.startsWith('R') && /^\d{1,2}$/.test(key))
    turn = { kind: 'shift', shift: Number(key) % 26, secret };
  else if (tag.startsWith('K') && /^[A-Z]+$/.test(key))
    turn = { kind: 'keyword', keyword: key, secret };
  else return null;
  return { carrier, carried, turn };
}

/** The message as the sender wrote it. */
export function plainOf(unpacked: Unpacked): string {
  const { turn, carried } = unpacked;
  if (turn.kind === 'shift') return rotate(carried, 26 - turn.shift);
  if (turn.kind === 'keyword') return keywordShift(carried, turn.keyword, -1);
  return carried;
}

/** The steps a friend works through to read a code: the carrier at an easy pace, then the wheel. */
export function stepsFor(unpacked: Unpacked): Step[] {
  const text = unpacked.carried;
  const first: Step = (() => {
    switch (unpacked.carrier) {
      case 'telegraph':
        return { machine: 'telegraph', mode: 'read', text, wpm: 15, spacingWpm: 10 };
      case 'punch':
        return { machine: 'punch', mode: 'read', text };
      case 'tape':
        return { machine: 'tape', mode: 'read', text };
      case 'printer':
        return { machine: 'printer', mode: 'read', text, width: FULL_WIDTH };
      case 'semaphore':
        return { machine: 'semaphore', mode: 'read', text, hold: 2.4, scene: 'rooftop' };
    }
  })();
  const plain = plainOf(unpacked);
  if (unpacked.turn.kind === 'none') return [first];
  const wheel: Step =
    unpacked.turn.kind === 'shift'
      ? { machine: 'cipher', mode: 'crack', text: plain, shift: unpacked.turn.shift }
      : { machine: 'cipher', mode: 'crack', text: plain, shift: 0, keyword: unpacked.turn.keyword };
  return [first, wheel];
}

/* ------------------------------------------------------------------ written forms */

/** The carried message in the carrier's own written form, for copying as text. */
export function writtenForm(carried: string, carrier: Carrier): string {
  switch (carrier) {
    case 'telegraph':
      return encodeWords(carried)
        .map((word) => word.join(' '))
        .join(' / ');
    case 'punch':
      return punchCard(carried)
        .map((column) => (column.holes ? holesName(column.holes) : '·'))
        .join(' ');
    case 'tape':
      return punchTape(carried)
        .map((byte) =>
          bitsOf(byte)
            .map((hole) => (hole ? 'o' : '.'))
            .join(''),
        )
        .join(' ');
    case 'printer':
      return carried;
    case 'semaphore':
      return encodeSemaphore(carried)
        .map((step) =>
          step.kind === 'rest'
            ? '/'
            : `${DIRECTION_NAMES[step.pose.near]}+${DIRECTION_NAMES[step.pose.far]}`,
        )
        .join(' ');
  }
}

function holesName(pattern: number): string {
  const rows: string[] = [];
  for (let row = 0; row < 12; row++) if (pattern & (1 << (11 - row))) rows.push(ROW_NAMES[row]!);
  return rows.join('-');
}

/** The spoken morse of a message, the original's own way of saying it. */
export function spokenForm(carried: string): string {
  return encodeWords(carried)
    .map((word) => word.map(spoken).join(', '))
    .join(' / ');
}

/* ------------------------------------------------------------------ SVG keepsakes */

const escapeXml = (text: string) => text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A punched card as an SVG drawing: manila, cut corner, printed digits, holes. */
export function cardSvg(text: string): string {
  const columns = punchCard(text);
  const w = 1000;
  const h = Math.round(w / 2.27);
  const left = w * 0.035;
  const colW = (w * 0.95) / CARD_COLUMNS;
  const top = h * 0.13;
  const rowH = (h * 0.82) / 12;
  let body = '';
  for (let row = 2; row < 12; row++) {
    for (let col = 0; col < CARD_COLUMNS; col++) {
      body += `<text x="${(left + (col + 0.5) * colW).toFixed(1)}" y="${(top + (row + 0.7) * rowH).toFixed(1)}">${ROW_NAMES[row]}</text>`;
    }
  }
  const holes = columns
    .flatMap((column, col) =>
      Array.from({ length: 12 }, (_, row) =>
        column.holes & (1 << (11 - row))
          ? `<rect x="${(left + (col + 0.24) * colW).toFixed(1)}" y="${(top + (row + 0.17) * rowH).toFixed(1)}" width="${(colW * 0.52).toFixed(1)}" height="${(rowH * 0.66).toFixed(1)}" rx="1.5"/>`
          : '',
      ),
    )
    .join('');
  const printed = columns
    .map(
      (column, col) =>
        `<text x="${(left + (col + 0.5) * colW).toFixed(1)}" y="${(h * 0.085).toFixed(1)}">${escapeXml(column.printed)}</text>`,
    )
    .join('');
  const cut = h * 0.12;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<title>${escapeXml(text)}, punched on a card</title>
<path d="M${cut} 0H${w}V${h}H0V${cut}Z" fill="#ecd7a4" stroke="#b89a5e"/>
<g font-family="IBM Plex Mono, monospace" font-size="${(rowH * 0.55).toFixed(1)}" fill="#9a5a3a" fill-opacity="0.7" text-anchor="middle">${body}</g>
<g font-family="IBM Plex Mono, monospace" font-size="${(h * 0.06).toFixed(1)}" font-weight="600" fill="#2a2420" text-anchor="middle">${printed}</g>
<g fill="#2a2420">${holes}</g>
</svg>`;
}

/** A strip of eight-hole tape as an SVG drawing, sprocket holes and all. */
export function tapeSvg(text: string): string {
  const rows = punchTape(text);
  const width = 100;
  const pitch = 10;
  const length = Math.max(1, rows.length + 4) * pitch;
  const across = (slot: number) => width * (0.12 + slot * 0.085);
  let holes = '';
  rows.forEach((byte, i) => {
    const x = (i + 2.5) * pitch;
    bitsOf(byte).forEach((hole, bit) => {
      if (!hole) return;
      const slot = bit < HOLES_BEFORE_SPROCKET ? bit : bit + 1;
      holes += `<circle cx="${x}" cy="${across(slot).toFixed(1)}" r="3.4"/>`;
    });
  });
  let sprockets = '';
  for (let i = 0; i < rows.length + 4; i++)
    sprockets += `<circle cx="${(i + 0.5) * pitch}" cy="${across(HOLES_BEFORE_SPROCKET).toFixed(1)}" r="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${length} ${width}" width="${length * 4}" height="${width * 4}">
<title>${escapeXml(text)}, punched on paper tape</title>
<rect width="${length}" height="${width}" fill="#f4e6b8" stroke="#c9b06f"/>
<g fill="#3a2a1c">${sprockets}${holes}</g>
</svg>`;
}

/** A banner as an SVG drawing, upright, every printed mark a cell, as the printer made it. */
export function bannerSvg(text: string, width = FULL_WIDTH): string {
  const print = printBanner(text, width);
  const cell = 6;
  const line = cell * (10 / 6);
  const margin = 12;
  const w = print.rows.length * line + margin * 2;
  const h = print.width * cell + margin * 2;
  let marks = '';
  print.rows.forEach((row, i) => {
    let run = -1;
    for (let col = 0; col <= print.width; col++) {
      const on = col < print.width && row[col];
      if (on && run < 0) run = col;
      if (!on && run >= 0) {
        // One rectangle per run of marks, from the top of the letter down.
        const y = margin + (print.width - col) * cell;
        marks += `<rect x="${(margin + i * line).toFixed(1)}" y="${y}" width="${line.toFixed(1)}" height="${(col - run) * cell}"/>`;
        run = -1;
      }
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(0)} ${h}" width="${w.toFixed(0)}" height="${h}">
<title>${escapeXml(text)}, printed as a banner</title>
<rect width="100%" height="100%" fill="#fbf6ea"/>
<g fill="#2a2420">${marks}</g>
</svg>`;
}
