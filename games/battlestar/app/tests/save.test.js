// Save/load: the JSON snapshot is lossless (ADR-007).

import test from 'node:test';
import assert from 'node:assert/strict';
import { Battlestar, SNAPSHOT_VERSION } from '../src/engine/battlestar.js';
import { scriptedWalkthrough } from '../src/engine/autoplay.js';

/** Plays `lines` and returns the engine (at the main prompt). */
function play(seed, lines, opts = {}) {
  const g = new Battlestar({ seed, flightMode: 'stdin', keepTranscript: true, ...opts });
  g.start();
  for (const l of lines) g.send(l);
  return g;
}

test('snapshot -> JSON -> restore -> snapshot is the identity', () => {
  const { input } = scriptedWalkthrough(4);
  for (const cut of [5, 30, 60, 90, 120]) {
    const g = play(4, input.slice(0, cut));
    if (!g.atMainPrompt) continue;
    const s1 = g.snapshot();
    const json = JSON.stringify(s1);
    const h = new Battlestar({ snapshot: JSON.parse(json), resume: 'prompt', flightMode: 'stdin' });
    h.start();
    assert.deepEqual(h.snapshot(), s1, `cut ${cut}`);
  }
});

test('a restored game continues exactly like the uninterrupted one (RNG included)', () => {
  const { input } = scriptedWalkthrough(4);
  const full = play(4, input);
  assert.equal(full.endKind, 'won');
  for (const cut of [20, 45, 80, 110]) {
    const a = play(4, input.slice(0, cut));
    if (!a.atMainPrompt) continue;
    const tailA = [];
    const b = new Battlestar({ snapshot: a.snapshot(), resume: 'prompt', flightMode: 'stdin', keepTranscript: true });
    b.start();
    // continue both
    const cont = input.slice(cut);
    const a0 = a.transcript.length;
    for (const l of cont) { if (!a.ended) a.send(l); }
    const b0 = b.transcript.length;
    for (const l of cont) { if (!b.ended) b.send(l); }
    tailA.push(a.transcript.slice(a0).join(''));
    assert.equal(b.transcript.slice(b0).join(''), tailA[0], `cut ${cut}`);
    assert.equal(b.endKind, 'won');
  }
});

test('the `save` verb keeps the original prompt and calls the host', () => {
  let saved = null;
  const g = new Battlestar({ seed: 1, onSave: (name, snap) => { saved = { name, snap }; } });
  g.start();
  let r = g.send('save');
  assert.match(r.output, /\nSave file name \(default \.Bstar\): $/);
  r = g.send('');
  assert.match(r.output, /Saved in \.Bstar\./);
  assert.equal(saved.name, '.Bstar');
  assert.equal(saved.snap.version, SNAPSHOT_VERSION);
  g.send('save');
  g.send('before the fight');
  assert.equal(saved.name, 'before the fight');
});

test('restore through the `-r` path re-runs the start of a turn, like the original', () => {
  const g = play(9, ['right', 'right']);
  const h = new Battlestar({ snapshot: g.snapshot(), resume: 'start', flightMode: 'stdin' });
  const r = h.start();
  assert.match(r.output, /^Version 4\.2, fall 1984\./);
  assert.match(r.output, /You are in what was once an elegant stateroom\./);
});

test('saves from a newer version, or not ours, are refused', () => {
  const g = play(1, []);
  const s = g.snapshot();
  assert.throws(() => new Battlestar({ snapshot: { ...s, version: SNAPSHOT_VERSION + 1 } }).start(), /newer/);
  assert.throws(() => new Battlestar({ snapshot: { format: 'x' } }).start(), /not a battlestar save/);
});
