// Engine tests: the RNG against the real C library, the frames against
// the real binary, and the canonical spec rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRandom, next } from '../src/engine/random.js';
import {
  createRain, step, screenText, parseDelay, cloneRain, frameMs,
} from '../src/engine/rain.js';

const here = dirname(fileURLToPath(import.meta.url));

test('random() reproduces glibc (2.39) for the default seed and for srandom(42)', () => {
  // Reference values printed by a C program calling random() under
  // glibc 2.39 (Ubuntu), with no srandom() and with srandom(42).
  const r1 = createRandom(1);
  assert.deepEqual([...Array(6)].map(() => next(r1)),
    [1804289383, 846930886, 1681692777, 1714636915, 1957747793, 424238335]);
  const r42 = createRandom(42);
  assert.deepEqual([...Array(3)].map(() => next(r42)), [71876166, 708592740, 1483128881]);
  // srandom(0) behaves as srandom(1)
  const r0 = createRandom(0);
  assert.equal(next(r0), 1804289383);
});

// /usr/games Reborn: the captures lived beside the game in the earlier project and were not
// adopted with it. Put 01-start.txt, 02-midgame.txt and 03-end.txt in tests/fixtures/captures/
// to run this test again; until then it is skipped (docs/KNOWN-ISSUES.md).
const captures = join(here, 'fixtures', 'captures');

test('the frames captured from the original binary are reproduced exactly', {
  skip: existsSync(captures) ? false : 'the captures of the original binary were not adopted',
}, () => {
  // media/0N-*.txt were captured from the real rain (built from the BSD
  // source, 80x24 tmux pane, -d 120) by docs/scripts/capture-screenshots.sh.
  const load = (n) => readFileSync(join(captures, `${n}.txt`), 'utf8')
    .replace(/\r/g, '').split('\n').slice(0, 24).map((l) => l.replace(/\s+$/, '')).join('\n');
  const want = { 26: load('01-start'), 57: load('02-midgame'), 86: load('03-end') };
  const st = createRain({ COLS: 80, LINES: 24, seed: 1 });
  for (let f = 1; f <= 86; f++) {
    step(st);
    if (want[f]) assert.equal(screenText(st), want[f], `frame ${f}`);
  }
});

test('-d parsing follows the original (rain.c:82-93)', () => {
  assert.deepEqual(parseDelay('120'), { delay: 120 });
  assert.deepEqual(parseDelay('0'), { delay: 0 });
  assert.deepEqual(parseDelay('999'), { delay: 999 });
  assert.deepEqual(parseDelay('0x10'), { delay: 16 }, 'strtoul base 0: hex');
  assert.deepEqual(parseDelay('010'), { delay: 8 }, 'strtoul base 0: octal');
  assert.deepEqual(parseDelay('1000'), { error: "Invalid delay `1000' (1-999)" });
  assert.deepEqual(parseDelay('12ms'), { error: "Invalid delay `12ms'" });
  assert.deepEqual(parseDelay(''), { error: "Invalid delay `'" });
  assert.deepEqual(parseDelay('-5'), { error: "Invalid delay `-5' (1-999)" }, 'strtoul wraps a minus sign');
  assert.deepEqual(parseDelay('-0'), { delay: 0 });
  assert.deepEqual(parseDelay('08'), { error: "Invalid delay `08'" }, 'not octal: junk after the 0');
  assert.deepEqual(parseDelay(' 50'), { delay: 50 }, 'strtoul skips leading blanks');
});

test('every frame: one new drop and five older ones, ages 0..5', () => {
  const st = createRain({ seed: 7 });
  for (let f = 0; f < 200; f++) {
    const ev = step(st);
    assert.deepEqual(ev.map((e) => e.age), [0, 1, 2, 3, 4, 5]);
    assert.ok(st.j >= 0 && st.j <= 4, 'the buffer index wraps modulo 5');
  }
});

test('each drop runs . o O small-ring large-ring erase on successive frames', () => {
  const st = createRain({ seed: 3 });
  const drops = new Map(); // "frame of birth" -> sequence of (age, x, y)
  for (let f = 0; f < 60; f++) {
    for (const e of step(st)) {
      if (e.phantom) continue;
      const born = f - e.age;
      if (!drops.has(born)) drops.set(born, []);
      drops.get(born).push(e);
    }
  }
  let full = 0;
  for (const [, seq] of drops) {
    if (seq.length < 6) continue; // still alive at the end
    full++;
    assert.deepEqual(seq.map((e) => e.age), [0, 1, 2, 3, 4, 5]);
    assert.ok(seq.every((e) => e.x === seq[0].x && e.y === seq[0].y), 'a drop stays put');
  }
  assert.ok(full > 40);
});

test('what a drop looks like at each age (rain.c:120-143)', () => {
  // Put the five buffered drops far apart, step once, read the shapes.
  const st = createRain({ COLS: 30, LINES: 22, seed: 1 });
  // with j = 0 the slots are drawn in the order 0, 4, 3, 2, 1
  st.j = 0;
  st.xpos = [5, 5, 15, 25, 15];
  st.ypos = [4, 16, 16, 4, 4];
  // junk under the drop that is about to be erased
  for (let y = 14; y <= 18; y++) st.screen[y] = '#'.repeat(30);
  step(st);
  const s = st.screen;
  const box = (x, y) => [-2, -1, 0, 1, 2].map((d) => s[y + d].slice(x - 2, x + 3));
  assert.equal(s[4][5], 'o', 'age 1: o');
  assert.equal(s[4][15], 'O', 'age 2: O');
  assert.deepEqual(box(25, 4).slice(1, 4), [' - ', '|.|', ' - '].map((r) => ` ${r} `), 'age 3: small ring');
  // (drawn over the '#' junk: only the diamond's own cells change)
  assert.deepEqual(box(15, 16), ['##-##', '#/ \\#', '| O |', '#\\ /#', '##-##'], 'age 4: large ring');
  assert.deepEqual(box(5, 16), ['## ##', '#   #', '     ', '#   #', '## ##'], 'age 5: the diamond is blanked, corners survive');
});

test('drops land inside the border; drawings stay on screen (many sizes)', () => {
  for (const [C, L] of [[80, 24], [5, 5], [7, 30], [132, 43]]) {
    const st = createRain({ COLS: C, LINES: L, seed: C * L });
    for (let f = 0; f < 3000; f++) {
      const ev = step(st);
      const d = ev[0];
      assert.ok(d.x >= 2 && d.x <= C - 3 && d.y >= 2 && d.y <= L - 3, `${C}x${L} drop at ${d.x},${d.y}`);
      assert.equal(st.screen.length, L);
      assert.ok(st.screen.every((r) => r.length === C));
    }
  }
});

test('seeded runs are reproducible and survive a JSON round trip', () => {
  const a = createRain({ seed: 99 });
  const b = createRain({ seed: 99 });
  for (let f = 0; f < 50; f++) { step(a); step(b); }
  assert.equal(screenText(a), screenText(b));
  const saved = cloneRain(a);
  step(a);
  step(saved);
  assert.equal(screenText(a), screenText(saved));
  const c = createRain({ seed: 100 });
  for (let f = 0; f < 51; f++) step(c);
  assert.notEqual(screenText(a), screenText(c));
});

test('-d 0 is paced like a 9600-baud terminal draining (ADR-003)', () => {
  const st = createRain({ delay: 0 });
  const ms = [];
  for (let f = 0; f < 300; f++) {
    step(st);
    if (f > 10) ms.push(frameMs(st));
  }
  const mean = ms.reduce((a, b) => a + b) / ms.length;
  assert.ok(mean > 110 && mean < 170, `about the man page's 120 ms (${mean.toFixed(0)})`);
  assert.equal(frameMs(createRain({ delay: 40 })), 40, 'an explicit -d is used as is');
});

test('the terminal must be big enough for random() % cols', () => {
  assert.throws(() => createRain({ COLS: 4, LINES: 24 }), /too small/);
});
