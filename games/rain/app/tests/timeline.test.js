// The engine clock and the constant visual latency (port ADR-003).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRain, screenText, step } from '../src/engine/rain.js';
import {
  createTimeline, advance, takeDue, inFlight, setDelay, LATENCY_MS,
} from '../src/engine/timeline.js';

test('the engine ticks once per delay (drops per second = 1000 / delay)', () => {
  const tl = createTimeline(createRain({ delay: 120 }));
  advance(tl, 0);
  let frames = 1;
  for (let t = 16; t <= 12000; t += 16) frames += advance(tl, t);
  assert.equal(frames, Math.floor(12000 / 120) + 1);
  const fast = createTimeline(createRain({ delay: 1 }));
  let n = 0;
  for (let t = 0; t <= 1000; t += 16) n += advance(fast, t);
  assert.ok(n >= 990 && n <= 1001, `-d 1 gives about a thousand drops a second (${n})`);
});

test('a frame is shown exactly LATENCY_MS after the engine made it', () => {
  const tl = createTimeline(createRain({ delay: 100 }));
  advance(tl, 1000);
  assert.equal(inFlight(tl).length, 1);
  assert.deepEqual(takeDue(tl, 1000 + LATENCY_MS - 1), []);
  const due = takeDue(tl, 1000 + LATENCY_MS);
  assert.equal(due.length, 1);
  assert.equal(due[0].frame, 1);
  assert.equal(tl.shown.frame, 1);
});

test('queued text is the engine screen of that frame', () => {
  const tl = createTimeline(createRain({ delay: 50 }));
  for (let t = 0; t <= 5000; t += 17) {
    advance(tl, t);
    takeDue(tl, t);
  }
  const ref = createRain({ delay: 50 });
  for (let f = 0; f < tl.shown.frame; f++) step(ref);
  assert.equal(tl.shown.text, screenText(ref));
});

test('a hidden tab resumes instead of replaying the backlog', () => {
  const tl = createTimeline(createRain({ delay: 10 }));
  advance(tl, 0);
  const n = advance(tl, 60000);
  assert.equal(n, 1);
  assert.ok(tl.skipped >= 59000);
});

test('a shorter delay takes effect at once; -d 0 is paced by the baud model', () => {
  const tl = createTimeline(createRain({ delay: 999 }));
  advance(tl, 0);
  assert.equal(advance(tl, 100), 0);
  setDelay(tl, 20, 100);
  assert.ok(advance(tl, 125) >= 1);
  const z = createTimeline(createRain({ delay: 0 }));
  let n = 0;
  for (let t = 0; t <= 10000; t += 16) n += advance(z, t);
  assert.ok(n > 55 && n < 90, `about 6-8 frames a second at 9600 baud (${n / 10})`);
});

