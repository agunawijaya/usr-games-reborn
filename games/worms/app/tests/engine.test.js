// Abyssal Worms engine tests — faithful port of BSD worms(6).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createRandom } from '../src/engine/random.js';
import { parseArgs, cAtoi, cStrtoulToUint, formatArgs, splitArgs, USAGE } from '../src/engine/args.js';
import {
  createWorld, step, screenLines, bodyCells, tableFor, TABLES, XINC, YINC, FLAVOR,
  setNumber, setLength, setTrail, setField, stepInterval,
} from '../src/engine/worms.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/worms-binary-golden.json', import.meta.url)));
const rstrip = (lines) => lines.map((l) => l.replace(/\s+$/, ''));

// ---------------------------------------------------------------------------
// Golden screens: a binary built from the original worms.c, run in tmux at a
// fixed terminal size and captured at several moments. The port, with glibc's
// default seed (1) and the same size, must reproduce every captured screen at
// some step, in order.
// ---------------------------------------------------------------------------

for (const cfg of golden.screens) {
  test(`golden screens: ${cfg.cols}x${cfg.rows} worms ${cfg.args}`, () => {
    const parsed = parseArgs(splitArgs(cfg.args));
    assert.ok(parsed.ok);
    const w = createWorld({ cols: cfg.cols, rows: cfg.rows, ...parsed.opts, seed: 1 });
    let k = 0;
    const found = [];
    for (const cap of cfg.captures) {
      const want = rstrip(cap.lines).join('\n');
      const limit = Math.ceil(cap.t / 0.15) + 40;
      let hit = -1;
      while (k <= limit) {
        if (rstrip(screenLines(w)).join('\n') === want) { hit = k; break; }
        step(w);
        k++;
      }
      assert.notEqual(hit, -1, `no step reproduces the capture at t=${cap.t}s (searched up to step ${limit})`);
      found.push(hit);
    }
    // sanity: later captures are later steps, and at least some motion happened
    assert.ok(found.at(-1) > found[0], `steps ${found}`);
  });
}

test('golden CLI: argument errors are byte-identical to the original', () => {
  for (const c of golden.cli) {
    const r = parseArgs(c.args);
    if (c.code === 124) {
      // the original accepted the arguments and started animating
      assert.equal(r.ok, true, JSON.stringify(c.args));
    } else {
      assert.equal(r.ok, false, JSON.stringify(c.args));
      assert.equal(r.stderr, c.stderr, JSON.stringify(c.args));
      assert.equal(r.code, c.code);
    }
  }
});

// ---------------------------------------------------------------------------
// Canonical scenarios — bsdgames/worms/docs/test-scenarios.md
// ---------------------------------------------------------------------------

test('scenario 1: defaults are 3 worms of length 16', () => {
  const r = parseArgs(['-d', '100']);
  assert.deepEqual(r.opts, { delay: 100, length: 16, number: 3, field: false, trail: false });
  const w = createWorld({ cols: 80, rows: 24, ...r.opts });
  for (let i = 0; i < 200; i++) step(w);
  assert.equal(w.worms.length, 3);
  for (let n = 0; n < 3; n++) assert.equal(bodyCells(w, n).length, 16);
});

test('scenario 2: -n 5 -l 32', () => {
  const r = parseArgs(['-n', '5', '-l', '32', '-d', '80']);
  const w = createWorld({ cols: 80, rows: 24, ...r.opts });
  for (let i = 0; i < 300; i++) step(w);
  assert.equal(w.worms.length, 5);
  for (let n = 0; n < 5; n++) assert.equal(bodyCells(w, n).length, 32);
});

test('scenario 3: -f fills the screen with WORM and worms eat it', () => {
  const w = createWorld({ cols: 60, rows: 20, field: true });
  assert.equal(screenLines(w)[0].slice(0, 8), 'WORMWORM');
  const count = () => screenLines(w).join('').split('').filter((c) => 'WORM'.includes(c)).length;
  const before = count();
  for (let i = 0; i < 400; i++) step(w);
  assert.ok(count() < before - 50, 'the field gets eaten');
  // the pattern continues across rows (worms.c:279-290): 61 columns shift each row by 1
  const odd = createWorld({ cols: 61, rows: 3, field: true });
  assert.deepEqual(screenLines(odd).map((l) => l.slice(0, 4)), ['WORM', 'ORMW', 'RMWO']);
});

test('scenario 4: -t leaves dots', () => {
  const w = createWorld({ cols: 80, rows: 24, trail: true });
  for (let i = 0; i < 100; i++) step(w);
  assert.ok(screenLines(w).join('').includes('.'));
});

test('scenario 5: invalid delay', () => {
  const r = parseArgs(['-d', '2000']);
  assert.equal(r.stderr, 'worms: invalid delay (1-1000)\n');
  assert.equal(r.code, 1);
});

test('scenario 7: worms stay inside the screen and use the flavor characters', () => {
  const w = createWorld({ cols: 80, rows: 24, number: 8, length: 12 });
  for (let i = 0; i < 2000; i++) step(w);
  const chars = new Set(screenLines(w).join('').replace(/ /g, ''));
  for (const c of chars) assert.ok(FLAVOR.includes(c), c);
});

// ---------------------------------------------------------------------------
// Invariants (property tests over many grids, seeds and flags)
// ---------------------------------------------------------------------------

test('invariants: in bounds, ref counts exact, abort() unreachable', () => {
  const sizes = [[2, 2], [2, 9], [9, 2], [3, 3], [5, 17], [80, 24], [131, 41]];
  for (const [cols, rows] of sizes) {
    for (const seed of [1, 7, 99]) {
      const w = createWorld({ cols, rows, number: 6, length: 9, seed, trail: seed === 7, field: seed === 99 });
      for (let s = 0; s < 3000; s++) {
        step(w); // throws if a table with no options is ever reached
        if (s % 97 !== 0) continue;
        const expect = new Uint16Array(cols * rows);
        for (const worm of w.worms) {
          for (let k = 0; k < worm.xpos.length; k++) {
            const x = worm.xpos[k];
            const y = worm.ypos[k];
            if (x < 0) continue;
            assert.ok(x >= 0 && x < cols && y >= 0 && y < rows, `(${x},${y}) outside ${cols}x${rows}`);
            expect[y * cols + x]++;
          }
        }
        assert.deepEqual(w.ref, expect);
      }
    }
  }
});

test('boundary tables never point off-screen from any reachable state', () => {
  // exhaustive: every cell of a small screen x every orientation that could
  // have brought the head there
  const cols = 6;
  const rows = 5;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      for (let o = 0; o < 8; o++) {
        const px = x - XINC[o];
        const py = y - YINC[o];
        const reachable = (px >= 0 && px < cols && py >= 0 && py < rows) || (x === 0 && y === rows - 1 && o === 0);
        if (!reachable) continue;
        const opts = tableFor(x, y, cols - 1, rows - 1)[o];
        assert.ok(opts.length > 0, `no option at (${x},${y}) o=${o}`);
        for (const n of opts) {
          const nx = x + XINC[n];
          const ny = y + YINC[n];
          assert.ok(nx >= 0 && nx < cols && ny >= 0 && ny < rows, `(${x},${y}) o=${o} -> ${n}`);
        }
      }
    }
  }
  assert.equal(Object.keys(TABLES).length, 9);
});

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

test('random(): glibc sequence for the default seed and srandom(42)', () => {
  const r = createRandom(1);
  assert.deepEqual([r(), r(), r(), r(), r()], [1804289383, 846930886, 1681692777, 1714636915, 1957747793]);
  const r42 = createRandom(42);
  assert.deepEqual([r42(), r42(), r42()], [71876166, 708592740, 1483128881]);
  const big = createRandom(4294967295);
  assert.deepEqual([big(), big(), big()], [254925627, 1205188300, 366127624]);
});

test('C conversions: strtoul cast to unsigned int, atoi on LP64', () => {
  assert.equal(cStrtoulToUint('4294967297'), 1);
  assert.equal(cStrtoulToUint('-1'), 4294967295);
  assert.equal(cStrtoulToUint('  25abc'), 25);
  assert.equal(cStrtoulToUint('abc'), 0);
  assert.equal(cAtoi('4294967298'), 2);
  assert.equal(cAtoi('99999999999999999999'), -1);
  assert.equal(cAtoi('2147483648'), -2147483648);
  assert.equal(cAtoi(' -7x'), -7);
});

test('getopt details: clusters, attached arguments, -- and operands', () => {
  assert.deepEqual(parseArgs(['-ftn5', '-l', '9']).opts, { delay: 0, length: 9, number: 5, field: true, trail: true });
  assert.deepEqual(parseArgs(['-d50']).opts.delay, 50);
  assert.equal(parseArgs(['--', '-n', '0']).ok, true);
  assert.equal(parseArgs(['-x']).stderr, `worms: invalid option -- 'x'\n${USAGE}\n`);
});

test('formatArgs / splitArgs round trip', () => {
  const opts = { delay: 50, length: 32, number: 5, field: true, trail: false };
  const line = formatArgs(opts);
  assert.equal(line, 'worms -f -d 50 -l 32 -n 5');
  assert.deepEqual(parseArgs(splitArgs(line)).opts, opts);
});

test('stepInterval: -d is exact; default emulates a 9600-baud terminal', () => {
  assert.equal(stepInterval(80, 3), 80);
  assert.equal(stepInterval(0, 3), 37.5);
  assert.equal(stepInterval(0, 1), 33);
  assert.equal(stepInterval(0, 20), 250);
});

// ---------------------------------------------------------------------------
// Live flag changes (port ADR-003)
// ---------------------------------------------------------------------------

function refInvariant(w) {
  const expect = new Uint16Array(w.cols * w.rows);
  for (const worm of w.worms) {
    for (let k = 0; k < worm.xpos.length; k++) {
      if (worm.xpos[k] >= 0) expect[worm.ypos[k] * w.cols + worm.xpos[k]]++;
    }
  }
  assert.deepEqual(w.ref, expect);
}

test('live -n: adding worms enters at (0,bottom); removing releases their cells', () => {
  const w = createWorld({ cols: 40, rows: 15, number: 3, length: 10 });
  for (let i = 0; i < 60; i++) step(w);
  setNumber(w, 7);
  step(w);
  assert.deepEqual(bodyCells(w, 6)[0], [0, 14]);
  for (let i = 0; i < 40; i++) step(w);
  refInvariant(w);
  setNumber(w, 2);
  refInvariant(w);
  assert.equal(w.worms.length, 2);
});

test('live -l: shrinking drops the oldest cells, growing lets the worm grow', () => {
  const w = createWorld({ cols: 40, rows: 15, number: 2, length: 20 });
  for (let i = 0; i < 50; i++) step(w);
  const head = bodyCells(w, 0).at(-1);
  setLength(w, 6);
  refInvariant(w);
  assert.equal(bodyCells(w, 0).length, 6);
  assert.deepEqual(bodyCells(w, 0).at(-1), head);
  setLength(w, 30);
  for (let i = 0; i < 10; i++) step(w);
  assert.equal(bodyCells(w, 0).length, 16);
  for (let i = 0; i < 40; i++) step(w);
  assert.equal(bodyCells(w, 0).length, 30);
  refInvariant(w);
});

test('live -t and -f toggles', () => {
  const w = createWorld({ cols: 30, rows: 10, trail: true });
  for (let i = 0; i < 80; i++) step(w);
  setTrail(w, false);
  assert.ok(!screenLines(w).join('').includes('.'));
  setField(w, true);
  assert.ok(screenLines(w).join('').includes('WORM'));
  setField(w, false);
  assert.ok(!/[WRM]/.test(screenLines(w).join('')));
});
