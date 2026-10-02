import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyDelve, dailyNumber, dailyShareLine, weekdayIndex } from '../src/daily.mjs';

test('the numbering matches the Hall’s: #1 on 2026-09-01', () => {
  assert.equal(dailyNumber('2026-09-01'), 1);
  assert.equal(dailyNumber('2026-10-02'), 32);
});

test('weekdays start on Monday', () => {
  assert.equal(weekdayIndex('2026-09-28'), 0); // a Monday
  assert.equal(weekdayIndex('2026-10-04'), 6); // a Sunday
});

test('the same date always gives the same cave, seed and quests; another date another seed', () => {
  assert.deepEqual(dailyDelve('2026-10-02'), dailyDelve('2026-10-02'));
  assert.notEqual(dailyDelve('2026-10-02').options.seed, dailyDelve('2026-10-03').options.seed);
});

test('a day’s three quests are all different', () => {
  for (let day = 1; day <= 28; day++) {
    const key = `2026-10-${String(day).padStart(2, '0')}`;
    const kinds = dailyDelve(key).tasks.map(([kind]) => kind);
    assert.equal(new Set(kinds).size, 3, key);
  }
});

test('the share line is one line with no link', () => {
  const line = dailyShareLine({ number: 32, slain: true, moves: 11, arrowsLeft: 2, sealsMet: [true, true, false] });
  assert.equal(line, 'The Rune Gates #32 · slain in 11 moves · 🏹2 · ◆◆◇');
  assert.doesNotMatch(line, /https?:|\n/);
  assert.match(dailyShareLine({ number: 3, slain: false, moves: 4, arrowsLeft: 0, sealsMet: [false, false, false] }), /lost after 4 moves/);
});
