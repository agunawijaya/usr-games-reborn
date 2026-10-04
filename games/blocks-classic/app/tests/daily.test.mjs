import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyNumber, dailyShareLine, dailyShift, DAILY_EPOCH } from '../src/daily.mjs';

test('the epoch is daily #1', () => {
  assert.equal(dailyNumber(DAILY_EPOCH), 1);
});

test('the same date always gives the same shift', () => {
  const a = dailyShift('2026-10-04');
  const b = dailyShift('2026-10-04');
  assert.deepEqual(a, b);
});

test('a different date gives a different number and usually a different well', () => {
  const a = dailyShift('2026-10-04');
  const b = dailyShift('2026-10-05');
  assert.notEqual(a.number, b.number);
});

test('the share line never carries a link', () => {
  const line = dailyShareLine({ number: 7, cleared: true, piecesLocked: 55, score: 1800, sealsMet: [true, true, false] });
  assert.doesNotMatch(line, /https?:\/\//);
  assert.match(line, /^Broken Well #7 ·/);
});
