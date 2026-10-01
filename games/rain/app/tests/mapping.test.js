// The contracts between the engine and the picture: ADR-003's stage table
// and the intensity control's delay scale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMPULSES } from '../src/render/renderer.js';
import { STAGES } from '../src/engine/rain.js';
import { sliderToDelay, delayToSlider } from '../src/ui/controls.js';
import { ambientCount } from '../src/render/particles.js';

test('one impulse per living age, shaped like ADR-003 says', () => {
  assert.equal(IMPULSES.length, STAGES.length);
  const [dot, o, O, ring1, ring2, erase] = IMPULSES;
  assert.ok(dot.amp < 0 && dot.ring === 0, '"." the impact: a crater');
  assert.ok(o.amp > 0 && o.ring > 0, '"o" the crown collapsing: a ring');
  assert.ok(O.amp > 0 && O.ring === 0 && O.sigma < dot.sigma, '"O" the jet: a sharp bump');
  assert.ok(ring1.amp < 0 && Math.abs(ring1.amp) < Math.abs(dot.amp), 'small ring: the droplet falls back, smaller');
  assert.ok(ring2.amp > 0 && ring2.amp < O.amp && ring2.sigma > O.sigma, 'large ring: a soft rebound');
  assert.equal(erase, null, 'erased: nothing new, the rings run on');
});

test('the intensity slider spans -d 999 .. -d 1, heavier to the right', () => {
  assert.equal(sliderToDelay(0), 999);
  assert.equal(sliderToDelay(1000), 1);
  let prev = Infinity;
  for (let p = 0; p <= 1000; p += 10) {
    const d = sliderToDelay(p);
    assert.ok(d >= 1 && d <= 999 && d <= prev);
    prev = d;
  }
  for (const d of [1, 10, 120, 400, 999]) {
    assert.ok(Math.abs(sliderToDelay(delayToSlider(d)) - d) <= Math.max(1, d * 0.01), `round trip ${d}`);
  }
});

test('more drops, more rain in the air', () => {
  assert.ok(ambientCount(0) < ambientCount(0.3));
  assert.ok(ambientCount(0.3) < ambientCount(1));
  assert.ok(ambientCount(1) <= 8000, 'bounded for slow GPUs');
});
