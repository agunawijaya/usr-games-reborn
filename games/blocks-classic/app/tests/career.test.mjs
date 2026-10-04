import test from 'node:test';
import assert from 'node:assert/strict';
import { clearedCount, emptyCareer, isOpen, nextShift, rankOf, recordShift, RANKS, SHIFTS } from '../src/career.mjs';

test('the career starts with only the first shift open', () => {
  const career = emptyCareer();
  assert.equal(isOpen(career, 0), true);
  assert.equal(isOpen(career, 1), false);
  assert.equal(rankOf(career).name, RANKS[0].name);
  assert.equal(nextShift(career).id, SHIFTS[0].id);
});

test('clearing a shift opens the next one and can promote the rank', () => {
  let career = emptyCareer();
  const first = SHIFTS[0];
  const result = recordShift(career, first.id, { cleared: true, contractsMet: 2, score: 1000 });
  career = result.career;
  assert.equal(clearedCount(career), 1);
  assert.equal(isOpen(career, 1), true);
  assert.equal(result.firstClear, true);

  const second = recordShift(career, SHIFTS[1].id, { cleared: true, contractsMet: 3, score: 1500 });
  career = second.career;
  assert.equal(clearedCount(career), 2);
  assert.equal(rankOf(career).name, RANKS[1].name, 'two shifts cleared promotes past the first rank');
});

test('a failed shift keeps the career unchanged other than a recorded try', () => {
  let career = emptyCareer();
  const { career: afterLoss } = recordShift(career, SHIFTS[0].id, { cleared: false, contractsMet: 0, score: 200 });
  assert.equal(clearedCount(afterLoss), 0);
  assert.equal(afterLoss.shifts[SHIFTS[0].id].tries, 1);
  assert.equal(isOpen(afterLoss, 1), false);
});
