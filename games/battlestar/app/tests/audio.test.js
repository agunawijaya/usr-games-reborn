// The ambience map is pure data: every room gets a bed made only of known
// recipes, beds differ between biomes, day and night, and nothing is loaded
// from files (the module must not reference audio assets).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Battlestar, C } from '../src/engine/battlestar.js';
import { composeRoom } from '../src/scene/composer.js';
import { bedFor, EVENT_SOUNDS } from '../src/audio/audio.js';

const src = readFileSync(new URL('../src/audio/audio.js', import.meta.url), 'utf8');
const layerRecipes = new Set([...src.matchAll(/case '([a-zA-Z]+)':/g)].map((m) => m[1]));

function specsFor(night) {
  const g = new Battlestar({ seed: 1 });
  g.start();
  if (night) g.convert(C.TONIGHT);
  const out = [];
  for (let r = 1; r <= 275; r++) {
    g.position = r;
    g.whichway(g.room(r));
    out.push(composeRoom(g));
  }
  return out;
}

test('every room has an ambience bed made of known recipes', () => {
  for (const night of [false, true]) {
    for (const spec of specsFor(night)) {
      const bed = bedFor(spec);
      assert.ok(bed.layers.length > 0, `room ${spec.room} (${spec.biome}/${spec.place}) is silent`);
      for (const l of bed.layers) assert.ok(layerRecipes.has(l.recipe), `unknown layer ${l.recipe}`);
      for (const s of bed.sparse) {
        assert.ok(layerRecipes.has(s.recipe), `unknown incidental ${s.recipe}`);
        assert.ok(s.min > 0 && s.max >= s.min, 'sparse sounds have a sane interval');
      }
    }
  }
});

test('beds differ by biome and by day and night outdoors', () => {
  const day = specsFor(false);
  const night = specsFor(true);
  const keys = new Set(day.map((s) => bedFor(s).key.split('|').slice(3).join('|')));
  assert.ok(keys.size >= 12, `only ${keys.size} distinct beds`);
  const coastDay = bedFor(day.find((s) => s.biome === 'coast'));
  const coastNight = bedFor(night.find((s) => s.biome === 'coast'));
  assert.notEqual(coastDay.key, coastNight.key);
  assert.ok(coastNight.layers.some((l) => l.recipe === 'crickets'));
});

test('tonal incidentals stay short (drips are splash-first)', () => {
  // every _blip in an incidental recipe is under 80 ms except deliberate chimes
  const chimes = ['ring', 'clang', 'bells', 'fall', 'alarm', 'zap'];
  for (const m of src.matchAll(/case '([a-zA-Z]+)':([^\n]*)/g)) {
    if (chimes.includes(m[1])) continue;
    for (const d of m[2].matchAll(/_blip\(\{[^}]*d: ([0-9.]+)/g)) assert.ok(+d[1] <= 0.08, `${m[1]} blip lasts ${d[1]} s`);
  }
});

test('event sounds map to recipes, and no audio files are referenced', () => {
  for (const r of Object.values(EVENT_SOUNDS)) assert.ok(layerRecipes.has(r), `unknown event recipe ${r}`);
  assert.doesNotMatch(src, /\.(mp3|wav|ogg|m4a|flac|aac)\b/i);
  assert.doesNotMatch(src, /fetch\(|decodeAudioData/);
});
