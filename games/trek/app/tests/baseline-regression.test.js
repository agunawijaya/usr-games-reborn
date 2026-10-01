// trek/procedural-web — Proof that the Captain's Override layer is inert
// when switched off.
//
// tests/fixtures/baseline/ holds a frozen, byte-for-byte copy of the
// fancy-web engine (commit fbe3bb0) — the engine this port started from.
// Each test below creates the same seeded game in both engines, drives
// both with the same long command sequence, and requires that every
// returned result (ok/error/effects) and the entire game state are
// identical after every single step, and that both RNGs end in the same
// state. With all override flags off, this port's engine must be
// indistinguishable from the baseline.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import * as base from './fixtures/baseline/engine.js';
import * as port from '../src/engine.js';
import { computeHints } from '../src/hints.js';
import { parseCommand, PARSE } from '../src/parser.js';

// Local command-mix PRNG (never Math.random, so every run is identical).
function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Serialise a game (or result) for comparison. Drops the RNG closure and
 *  the port-only override fields so both engines are judged on the
 *  baseline's own state. */
function serialise(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'function') return undefined;
    if (key === 'overrides' || key === 'cheated') return undefined;
    return value;
  });
}

function randomCommand(r) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const kind = pick(['phaser', 'torpedo', 'move', 'impulse', 'warp', 'srscan', 'lrscan',
    'damages', 'dock', 'shields up', 'shields down', 'shields', 'computer']);
  switch (kind) {
    case 'phaser':  return `phaser ${50 + Math.floor(r() * 3000)}`;
    case 'torpedo': return `torpedo ${(r() * 12).toFixed(1)}`;
    case 'move':    return `move ${(r() * 12).toFixed(1)} ${(0.5 + r() * 7.5).toFixed(1)}`;
    case 'impulse': return `impulse ${(r() * 12).toFixed(1)}`;
    case 'warp':    return `warp ${(1 + r() * 6).toFixed(1)} ${(r() * 12).toFixed(1)}`;
    case 'shields': return `shields ${50 + Math.floor(r() * 1200)}`;
    default:        return kind;
  }
}

/** Play one seeded game through both engines in lock step. */
function lockstep(difficulty, seed, maxSteps, hintBias) {
  const a = base.createGame({ difficulty, seed });
  const b = port.createGame({ difficulty, seed });
  assert.equal(serialise(b), serialise(a), `${difficulty}/${seed}: initial state differs`);

  const r = mulberry(seed * 7919 + difficulty.length);
  let steps = 0;
  for (; steps < maxSteps && !a.won && !a.lost; steps++) {
    let text;
    if (r() < hintBias) {
      const top = computeHints(port.snapshot(b)).find(h => h.cmd);
      text = top ? top.cmd : randomCommand(r);
    } else {
      text = randomCommand(r);
    }
    const parsed = parseCommand(text);
    if (parsed.status !== PARSE.OK) continue;
    if (parsed.cmd.action === 'help' || parsed.cmd.action === 'quit') continue;

    const ra = base.executeCommand(a, parsed.cmd);
    const rb = port.executeCommand(b, parsed.cmd);
    assert.equal(serialise(rb), serialise(ra), `${difficulty}/${seed} step ${steps} "${text}": result differs`);
    assert.equal(serialise(b), serialise(a), `${difficulty}/${seed} step ${steps} "${text}": state differs`);
    assert.equal(serialise(port.snapshot(b)), serialise(base.snapshot(a)),
      `${difficulty}/${seed} step ${steps}: snapshot differs`);
  }
  // Same number of RNG draws on both sides ⇒ the next draw matches.
  assert.equal(b.rng(), a.rng(), `${difficulty}/${seed}: RNG state diverged`);
  assert.equal(b.cheated, false);
  return { steps, won: a.won, lost: a.lost };
}

test('all overrides off: 60 seeded hint-driven games are identical to the baseline engine', () => {
  let totalSteps = 0, ended = 0;
  for (const difficulty of ['novice', 'standard', 'expert']) {
    for (let seed = 1; seed <= 20; seed++) {
      const out = lockstep(difficulty, seed, 400, 0.8);
      totalSteps += out.steps;
      if (out.won || out.lost) ended++;
    }
  }
  assert.ok(totalSteps > 2000, `expected a long replay, got ${totalSteps} steps`);
  assert.ok(ended > 40, `expected most games to reach an ending, got ${ended}`);
});

test('all overrides off: 60 seeded random-command games are identical to the baseline engine', () => {
  for (const difficulty of ['novice', 'standard', 'expert']) {
    for (let seed = 101; seed <= 120; seed++) lockstep(difficulty, seed, 300, 0.2);
  }
});

const CHEAT_SUFFIX = " [CHEATED — Captain's Override]";

test('a flag switched on and off again leaves no trace in the rules', () => {
  // Toggling on marks the mission as cheated (by design) but must not
  // change any rule once the flag is off again.
  const a = base.createGame({ difficulty: 'novice', seed: 77 });
  const b = port.createGame({ difficulty: 'novice', seed: 77 });
  for (const f of port.OVERRIDE_FLAGS) {
    port.setOverride(b, f, true);
    port.setOverride(b, f, false);
  }
  b.events = b.events.filter(e => e.tag !== 'override');
  const r = mulberry(4242);
  for (let i = 0; i < 200 && !a.won && !a.lost; i++) {
    const parsed = parseCommand(randomCommand(r));
    if (parsed.status !== PARSE.OK) continue;
    const ra = base.executeCommand(a, parsed.cmd);
    const rb = port.executeCommand(b, parsed.cmd);
    assert.equal(serialise(rb), serialise(ra));
    // The one intended difference: a cheated mission's final log line
    // carries the [CHEATED] mark.
    assert.equal(serialise(b).replace(CHEAT_SUFFIX, ''), serialise(a));
  }
  assert.equal(b.cheated, true);
});

test('setting an already-off flag to off is a no-op (not cheated, nothing logged)', () => {
  const g = port.createGame({ difficulty: 'novice', seed: 5 });
  const before = g.events.length;
  for (const f of port.OVERRIDE_FLAGS) {
    const res = port.setOverride(g, f, false);
    assert.equal(res.ok, true);
    assert.equal(res.effects[0].changed, false);
  }
  assert.equal(g.cheated, false);
  assert.equal(g.events.length, before);
});

test('galaxy.js, parser.js and hints.js are byte-identical to the fancy-web baseline', () => {
  // SHA-256 of the fancy-web files at commit fbe3bb0, line endings
  // normalised to LF so a CRLF checkout does not matter.
  const PINNED = {
    'galaxy.js': '3c8d15a118531389dd430ca84e76c76fd5a8d62322e10964758d71b0fc8219e9',
    'parser.js': 'e53d1fd985228a3ef6cb06d4a11094a4b7899c4a0bca46117fedd359e06b41c7',
    'hints.js':  'a1d1a62f4679541fa6a6df5e22574b89e46a3b0523ea5243ecb6e8f3d076da86',
  };
  for (const [file, want] of Object.entries(PINNED)) {
    const text = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const got = createHash('sha256').update(text).digest('hex');
    assert.equal(got, want, `src/${file} drifted from the fancy-web baseline`);
  }
  const fixture = readFileSync(new URL('./fixtures/baseline/engine.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(createHash('sha256').update(fixture).digest('hex'),
    '83f15bbddcd96d4b7aa54a99df2ad244a4616a65961e646744287ee0af87f2bb',
    'the frozen baseline engine fixture was modified');
});
