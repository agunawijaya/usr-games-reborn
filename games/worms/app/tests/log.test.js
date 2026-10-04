import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorld, step } from '../src/engine/worms.js';
import { SightingWatch, KIND_IDS, headOf, SHOW_SECONDS } from '../src/log/sightings.js';
import { journalPage, wormAt, SPECIES_NOTES } from '../src/log/journal.js';
import { dailyDive, diveNumber, diveShareLine } from '../src/log/dive.js';
import {
  addPostcard, freshLog, logDiveFind, logSighting, logSpecies, POSTCARDS_KEPT,
} from '../src/log/store.js';

/** Runs a world and a watch together for `seconds`, a step every `interval`. */
function watchFor(seconds, { seed = 1, number = 12, length = 16, interval = 0.05 } = {}) {
  const world = createWorld({ cols: 60, rows: 30, number, length, seed });
  const watch = new SightingWatch(seed);
  const seen = [];
  const steps = Math.round(seconds / interval);
  for (let i = 0; i < steps; i++) {
    step(world);
    const found = watch.afterStep(world, i * interval);
    if (found) seen.push(found);
  }
  return { world, watch, seen };
}

test('the watch never touches the engine: the worms move as they would without it', () => {
  const plain = createWorld({ cols: 60, rows: 30, number: 12, length: 16, seed: 7 });
  for (let i = 0; i < 2000; i++) step(plain);
  const { world } = watchFor(100, { seed: 7 });
  assert.deepEqual([...world.ref], [...plain.ref]);
});

test('sightings are rare, spaced out, and of the four kinds', () => {
  const { seen } = watchFor(600);
  assert.ok(seen.length >= 10, `some sightings in ten minutes (${seen.length})`);
  assert.ok(seen.length <= 60, `not a flood (${seen.length})`);
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i].born - seen[i - 1].born >= SHOW_SECONDS + 7 - 1e-9, 'a quiet spell between two');
  }
  assert.ok(seen.every((s) => KIND_IDS.includes(s.kind)));
  assert.ok(new Set(seen.map((s) => s.kind)).size >= 3, 'more than one kind turns up');
});

test('a sighting is the same for everyone with the same seed', () => {
  const a = watchFor(300, { seed: 42 }).seen.map((s) => `${s.kind}@${s.x},${s.y}`);
  const b = watchFor(300, { seed: 42 }).seen.map((s) => `${s.kind}@${s.x},${s.y}`);
  assert.deepEqual(a, b);
});

test('a click logs the sighting only near it and only while it lasts', () => {
  const world = createWorld({ cols: 60, rows: 30, number: 12, length: 16, seed: 3 });
  const watch = new SightingWatch(3);
  let found = null;
  let now = 0;
  while (!found && now < 600) {
    step(world);
    found = watch.afterStep(world, now);
    now += 0.05;
  }
  assert.ok(found);
  assert.equal(watch.tryLog(found.x + 10, found.y + 10, now), null, 'too far');
  assert.equal(watch.tryLog(found.x + 1, found.y, found.until + 1), null, 'too late');
  assert.equal(watch.tryLog(found.x + 1, found.y, now)?.kind, found.kind);
  assert.equal(watch.active, null, 'logged once');
});

test('the journal knows eight species and finds the worm under a click', () => {
  assert.equal(SPECIES_NOTES.length, 8);
  assert.equal(journalPage(3).glyph, '$');
  const world = createWorld({ cols: 40, rows: 20, number: 3, length: 8, seed: 1 });
  for (let i = 0; i < 40; i++) step(world);
  const head = headOf(world, 2);
  assert.equal(wormAt(world, head[0], head[1]), 2);
  assert.equal(wormAt(world, -50, -50), null);
});

test('the Daily Dive: numbered like the Hall, three of the four kinds, the same for everyone', () => {
  assert.equal(diveNumber('2026-09-01'), 1);
  const a = dailyDive('2026-10-03');
  assert.deepEqual(a, dailyDive('2026-10-03'));
  assert.equal(a.seek.length, 3);
  assert.equal(new Set(a.seek).size, 3);
  assert.ok(a.worms >= 6 && a.worms <= 12);
  assert.equal(diveShareLine(33, [true, false, true]), 'Abyssal Worms Dive #33 · found 2 of 3 · 🫧·🫧');
});

test('a dive is finished once, by finding what it asks for', () => {
  const dive = dailyDive('2026-10-03');
  let log = freshLog();
  const other = KIND_IDS.find((kind) => !dive.seek.includes(kind));
  assert.equal(logDiveFind(log, dive, other).finished, false);
  let finished = 0;
  for (const kind of dive.seek) {
    const result = logDiveFind(log, dive, kind);
    log = result.log;
    if (result.finished) finished++;
  }
  assert.equal(finished, 1);
  assert.equal(log.divesFinished, 1);
  assert.equal(logDiveFind(log, dive, dive.seek[0]).finished, false, 'not twice');
});

test('the log counts sightings, keeps species once, and keeps the newest postcards', () => {
  let log = logSighting(logSighting(freshLog(), 'curl'), 'curl');
  assert.equal(log.sightings.curl, 2);
  log = logSpecies(logSpecies(log, 4), 4);
  assert.deepEqual(log.species, [4]);
  for (let i = 0; i < POSTCARDS_KEPT + 3; i++) {
    log = addPostcard(log, { seed: i, opts: {}, cell: 14, view: 'modern', savedOn: '2026-10-03' });
  }
  assert.equal(log.postcards.length, POSTCARDS_KEPT);
  assert.equal(log.postcards[0].seed, POSTCARDS_KEPT + 2);
});
