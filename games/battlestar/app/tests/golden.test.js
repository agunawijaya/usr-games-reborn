// Byte-for-byte comparison with the real /usr/games/battlestar.
//
// tests/golden/<name>.out were captured by scripts/golden-capture.mjs from the
// Debian bsdgames 2.17 binary with getpid() pinned to the case's seed. The
// engine is seeded with the same number and fed the same input lines.
//
// The only thing removed from the real output is the curses screen of a
// dogfight (ESC ... ESC[23B): the port draws that screen in 3D instead. The
// Cylon's position and the HUD numbers in that screen are checked separately.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runScript } from '../src/engine/run.js';
import { Battlestar } from '../src/engine/battlestar.js';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'golden');
const cases = JSON.parse(readFileSync(join(dir, 'cases.json'), 'utf8'));

const CURSES = /\x1b\(B[\s\S]*?\x1b\[23B/g;
export const stripCurses = (s) => s.replace(CURSES, '');

/** Pulls the Cylon glyph position and HUD numbers out of each curses screen. */
function cursesScreens(raw) {
  const screens = [];
  for (const m of raw.match(CURSES) || []) {
    const cylon = [...m.matchAll(/\x1b\[(\d+);(\d+)H\/-\\/g)].pop();
    const nums = [...m.matchAll(/\x1b\[24;(\d+)H\s*(-?\d+)/g)].map((x) => [+x[1], +x[2]]);
    screens.push({
      cylon: cylon ? { row: +cylon[1] - 1, column: +cylon[2] } : null,
      hud: Object.fromEntries(nums.map(([col, v]) => [col, v])),
    });
  }
  return screens;
}

for (const c of cases) {
  const outFile = join(dir, `${c.name}.out`);
  test(`golden: ${c.name}`, { skip: !existsSync(outFile) && 'no capture' }, () => {
    const raw = readFileSync(outFile, 'latin1');
    const expected = stripCurses(raw);
    const flights = [];
    const { transcript } = runScript(c.input, {
      seed: c.seed,
      username: c.username || '',
      onFlight: (sim) => flights.push(sim),
    });
    if (transcript !== expected) {
      // Show the first divergence with context, which is far more useful than a full diff.
      let i = 0;
      while (i < transcript.length && transcript[i] === expected[i]) i++;
      const ctx = (s) => JSON.stringify(s.slice(Math.max(0, i - 300), i + 200));
      assert.fail(`transcripts diverge at byte ${i}\n--- engine:\n${ctx(transcript)}\n--- binary:\n${ctx(expected)}`);
    }
    // Dogfights: first frame of each curses screen vs the engine's FlightSim.
    const screens = cursesScreens(raw);
    assert.equal(flights.length, screens.length, 'number of dogfights');
    screens.forEach((s, k) => {
      const f = flights[k];
      if (s.cylon) assert.deepEqual({ row: f.firstRow, column: f.firstColumn }, s.cylon, `dogfight ${k} cylon position`);
      // printw("%3d") at columns 25/43/58 (1-based); curses skips the leading blanks.
      const at = (lo) => Object.entries(s.hud).find(([col]) => +col >= lo && +col <= lo + 2)?.[1];
      if (at(25) !== undefined) assert.equal(f.firstTorps, at(25), `dogfight ${k} torpedoes`);
      if (at(43) !== undefined) assert.equal(f.firstFuel, at(43), `dogfight ${k} fuel`);
      if (at(58) !== undefined) assert.equal(f.firstClock, at(58), `dogfight ${k} clock`);
    });
  });
}

test('vocabulary has no duplicate words (no "Multiply defined" at start-up)', () => {
  const g = new Battlestar({ seed: 1 });
  const r = g.start();
  assert.ok(!/Multiply defined/.test(r.output));
});
