import { describe, expect, it } from 'vitest';
import { bannerLength, keptPositions, missingGlyphs, printBanner } from './banner';
import { BANNER_GLYPH_ROWS } from './banner-glyphs';
import { HOLES, punchCard, punchName, readCard, readPattern } from './bcd';
import {
  bestRotation,
  CODE_FREQUENCIES,
  keywordColumn,
  keywordShift,
  MANUAL_FREQUENCIES,
  rot13,
  rotate,
  rotationFit,
  shareAfter,
} from './caesar';
import {
  characterFor,
  decodeWords,
  encodeWords,
  KeyReader,
  MORSE_CHARACTERS,
  morseFor,
  morseTiming,
  scheduleMessage,
  spoken,
  type KeyEvent,
} from './morse';
import { bitsOf, byteOf, punchTape, readRowPicture, readTape, rowPicture } from './ppt';
import {
  ANNUL_SIGN,
  CIRCLES,
  decodeSemaphore,
  decodeSteps,
  encodeSemaphore,
  holdSeconds,
  judgeSend,
  LETTER_POSES,
  NUMERALS_SIGN,
  opposite,
  poseKey,
  readPose,
  REST,
  samePose,
} from './semaphore';

describe('morse', () => {
  it('reads back every character it can send', () => {
    for (const char of MORSE_CHARACTERS) expect(characterFor(morseFor(char)!)).toBe(char);
  });

  it('round-trips a message, dropping what the table lacks', () => {
    const words = encodeWords('Night wire, 7:30! Over & out');
    expect(decodeWords(words)).toBe('NIGHT WIRE, 7:30 OVER OUT');
  });

  it('says daw, not dah', () => {
    expect(spoken('-.-.')).toBe('daw dit daw dit');
  });

  it('times a word of PARIS at fifty units', () => {
    const timing = morseTiming(20);
    expect(timing.unit).toBe(60);
    const schedule = scheduleMessage('PARIS', timing);
    // Fifty units including the closing word space, which a schedule does not sound.
    expect(schedule.duration).toBe(43 * 60);
  });

  it('stretches only the gaps under Farnsworth spacing', () => {
    const fast = morseTiming(18, 18);
    const spaced = morseTiming(18, 8);
    expect(spaced.unit).toBe(fast.unit);
    expect(spaced.letterGap).toBeGreaterThan(fast.letterGap * 2);
    const word = scheduleMessage('PARIS ', spaced);
    // A word and its closing space last as long as PARIS should at eight words a minute.
    expect(word.duration + spaced.letterGap).toBeCloseTo(60000 / 8, 6);
  });

  function keyed(code: string, unit: number, reader: KeyReader, start: number): number {
    let clock = start;
    for (const mark of code) {
      reader.press(clock);
      clock += mark === '.' ? unit : unit * 3;
      reader.release(clock);
      clock += unit;
    }
    return clock;
  }

  it('reads a steady hand and learns its speed', () => {
    const reader = new KeyReader(12);
    const unit = 1200 / 18;
    const events: KeyEvent[] = [];
    let clock = 0;
    for (const char of 'SOS') {
      clock = keyed(morseFor(char)!, unit, reader, clock);
      clock += unit * 2;
      events.push(...reader.tick(clock));
    }
    events.push(...reader.finish());
    const letters = events.flatMap((e) => (e.kind === 'letter' ? [e.char] : []));
    expect(letters).toEqual(['S', 'O', 'S']);
    expect(reader.wpm).toBeGreaterThan(15);
    expect(events.at(-1)?.kind).toBe('word');
  });

  it('tells dits from daws in an uneven hand', () => {
    const reader = new KeyReader(15);
    const unit = 80;
    const lengths = [0.7, 3.4, 1.3, 2.6]; // dit, daw, dit, daw — sloppily
    let clock = 0;
    const marks: string[] = [];
    for (const length of lengths) {
      reader.press(clock);
      clock += length * unit;
      for (const e of reader.release(clock)) if (e.kind === 'mark') marks.push(e.mark);
      clock += unit;
    }
    expect(marks.join('')).toBe('.-.-');
  });
});

describe('caesar', () => {
  it('rotates letters only, keeping case', () => {
    expect(rotate('Night Wire 1964!', 3)).toBe('Qljkw Zluh 1964!');
    expect(rotate(rotate('Zebra', 7), -7)).toBe('Zebra');
    expect(rot13(rot13('Spoiler'))).toBe('Spoiler');
  });

  it('keeps two different frequency tables, as the original does', () => {
    const order = (table: readonly number[]) =>
      table
        .map((p, i) => [p, String.fromCharCode(65 + i)] as const)
        .sort((a, b) => b[0] - a[0])
        .map(([, letter]) => letter)
        .join('');
    expect(order(MANUAL_FREQUENCIES)).toBe('ETAONRISHDLFCMUPYGWBVKXJQZ'.replace('PYG', 'GPY'));
    expect(order(CODE_FREQUENCIES)).toBe('ETSAORINDHLCPMUYFWGBVKXQZJ');
  });

  it('cracks a sentence and its scope agrees', () => {
    const secret = rotate('The night operator hears a strange signal from the rooftops', 9);
    const rotation = bestRotation(secret);
    expect(rotate(secret, rotation)).toMatch(/^The night operator/);
    expect(rotationFit(secret)[rotation]).toBe(1);
    expect(shareAfter(secret, rotation)[4]).toBeGreaterThan(8); // plenty of E once unturned
  });

  it('is fooled by short texts full of rare letters', () => {
    const plain = 'Jazz quiz';
    const secret = rotate(plain, 5);
    expect(rotate(secret, bestRotation(secret))).not.toBe(plain);
  });

  it('turns keyword shifts back and splits them into plain columns', () => {
    const secret = keywordShift('Meet me by the clock', 'KEY');
    expect(keywordShift(secret, 'KEY', -1)).toBe('Meet me by the clock');
    const column = keywordColumn(secret, 3, 0);
    expect(rotate(column, 26 - 10)).toBe(keywordColumn('Meet me by the clock', 3, 0));
  });
});

describe('punch cards', () => {
  it('reads back every letter, digit and most punctuation', () => {
    const text = 'HELLO, WORLD 1964 (A+B)*C=D? $5.00 / 75% #1 @ME';
    expect(readCard(punchCard(text).map((column) => column.holes))).toBe(text);
  });

  it('names patterns the way card people say them', () => {
    expect(punchName(HOLES[65]!)).toBe('12-1');
    expect(punchName(HOLES[83]!)).toBe('0-2');
    expect(punchName(HOLES[95]!)).toBe('0-1-6-7-8-9');
  });

  it('keeps the table’s shared patterns', () => {
    expect(HOLES[96]).toBe(HOLES[65]); // the backquote punches as A
    expect(readPattern(HOLES[96]!)).toBe('A');
    expect(HOLES[124]).toBe(HOLES[92]); // | and \
  });

  it('upper-cases letters and leaves unpunchable characters blank', () => {
    const card = punchCard('Hi é');
    expect(card.map((c) => c.printed).join('')).toBe('HI  ');
  });
});

describe('paper tape', () => {
  it('round-trips bytes through the row pictures', () => {
    for (let byte = 0; byte < 256; byte++) {
      expect(byteOf(bitsOf(byte))).toBe(byte);
      expect(readRowPicture(rowPicture(byte))).toBe(byte);
    }
    expect(readTape(punchTape('Tape 8\n'))).toBe('Tape 8\n');
  });

  it('puts the sprocket after the fifth hole', () => {
    expect(rowPicture(0xff)).toBe('|ooooo.ooo|');
  });
});

describe('the banner printer', () => {
  it('has every glyph the original had, and none of the missing ones', () => {
    expect(BANNER_GLYPH_ROWS.size).toBe(84);
    expect(missingGlyphs('<>[]\\^_{|}~')).toHaveLength(11);
    expect(missingGlyphs('Dits & Daws!')).toEqual([]);
  });

  it('keeps every glyph within the paper and its own mask', () => {
    for (const char of BANNER_GLYPH_ROWS.keys()) {
      expect(bannerLength(char)).toBeLessThanOrEqual(132);
      expect(printBanner(char).width).toBe(132);
    }
  });

  it('gets grainier as it narrows', () => {
    const full = printBanner('DAWS');
    const narrow = printBanner('DAWS', 40);
    expect(narrow.width).toBe(40);
    expect(narrow.rows.length).toBeLessThan(full.rows.length / 2);
    expect(keptPositions(132).every(Boolean)).toBe(true);
  });
});

describe('flag semaphore', () => {
  const all = [...Object.values(LETTER_POSES), NUMERALS_SIGN, ANNUL_SIGN, REST];

  it('gives every letter and sign a pose of its own', () => {
    expect(new Set(all.map(poseKey)).size).toBe(all.length);
  });

  it('pairs letters with their upside-down opposites, D, L and R alone matching themselves', () => {
    const fixed = Object.entries(LETTER_POSES)
      .filter(([, p]) => samePose(p, opposite(p)))
      .map(([letter]) => letter);
    expect(fixed).toEqual(['D', 'L', 'R']);
    for (const p of Object.values(LETTER_POSES)) expect(readPose(opposite(p))).not.toBeNull();
    expect(readPose(opposite(LETTER_POSES.A!))).toBe('#');
  });

  it('crosses a hand over the body for H, I, O and W, X, Z only', () => {
    const crossing = Object.entries(LETTER_POSES)
      .filter(([, p]) => {
        const nearOnRight = p.near >= 5 && p.near <= 7;
        const farOnLeft = p.far >= 1 && p.far <= 3;
        return nearOnRight || farOnLeft;
      })
      .map(([letter]) => letter);
    expect(crossing).toEqual(['H', 'I', 'O', 'W', 'X', 'Z']);
  });

  it('sends rests, numerals and the letters sign where they belong', () => {
    const steps = encodeSemaphore('Book 1964 now');
    expect(steps.map((s) => s.meaning).join('')).toBe('BOOK #1964 JNOW');
    expect(decodeSteps(steps)).toBe('BOOK 1964 NOW');
    expect(decodeSemaphore(encodeSemaphore('Meat at 7 ok').map((s) => s.pose))).toBe(
      'MEAT AT 7 OK',
    );
  });

  it('judges the shape, not the hand', () => {
    const h = LETTER_POSES.H!;
    expect(judgeSend(h, { near: h.far, far: h.near }, 1, 3)).toBe('right');
    expect(judgeSend(h, h, 4, 3)).toBe('late');
    expect(judgeSend(h, LETTER_POSES.I!, 1, 3)).toBe('wrong');
  });

  it('teaches every letter in the six circles', () => {
    expect(CIRCLES.flat().sort().join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(holdSeconds(0)).toBeGreaterThan(holdSeconds(7));
  });
});
