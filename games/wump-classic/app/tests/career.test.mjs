import assert from 'node:assert/strict';
import test from 'node:test';
import { DELVES, emptyCareer, isOpen, nextDelve, rankOf, recordDelve, RANKS, totalStars } from '../src/career.mjs';
import { TASKS } from '../src/quests.mjs';

test('twelve delves, numbered in order, each with three known quests', () => {
  assert.equal(DELVES.length, 12);
  DELVES.forEach((delve, i) => {
    assert.equal(delve.number, i + 1);
    assert.equal(delve.tasks.length, 3);
    for (const [kind] of delve.tasks) assert.ok(TASKS[kind], `${delve.id}: unknown quest ${kind}`);
    assert.equal(new Set(delve.tasks.map(([kind]) => kind)).size, 3, `${delve.id}: a quest twice`);
  });
  assert.equal(new Set(DELVES.map((d) => d.id)).size, 12);
});

test('every delve keeps to three tunnels a chamber, as the gates are drawn', () => {
  for (const delve of DELVES) assert.equal(delve.options.linkNum ?? 3, 3, delve.id);
});

test('only the first delve is open at the start; clearing one opens the next', () => {
  let career = emptyCareer();
  assert.equal(isOpen(career, 0), true);
  assert.equal(isOpen(career, 1), false);
  assert.equal(nextDelve(career).id, 'threshold');
  career = recordDelve(career, 'threshold', { slain: false, seals: 0, moves: 9 }).career;
  assert.equal(isOpen(career, 1), false, 'a lost delve opens nothing');
  career = recordDelve(career, 'threshold', { slain: true, seals: 1, moves: 12 }).career;
  assert.equal(isOpen(career, 1), true);
  assert.equal(nextDelve(career).id, 'pillars');
});

test('a delve keeps its best seals and fewest moves, and counts every try', () => {
  let career = emptyCareer();
  let result = recordDelve(career, 'threshold', { slain: true, seals: 2, moves: 14 });
  assert.equal(result.firstClear, true);
  assert.equal(result.newStars, 2);
  career = result.career;
  result = recordDelve(career, 'threshold', { slain: true, seals: 1, moves: 10 });
  assert.equal(result.firstClear, false);
  assert.equal(result.newStars, 0);
  assert.deepEqual(result.career.delves.threshold, { tries: 2, cleared: true, stars: 2, bestMoves: 10 });
  assert.equal(totalStars(result.career), 2);
});

test('seals only count on a delve whose wumpus was slain', () => {
  const { career } = recordDelve(emptyCareer(), 'threshold', { slain: false, seals: 3, moves: 5 });
  assert.equal(career.delves.threshold.stars, 0);
});

test('ranks follow the delves cleared, and a promotion is announced once', () => {
  let career = emptyCareer();
  assert.equal(rankOf(career).name, RANKS[0].name);
  career = recordDelve(career, 'threshold', { slain: true, seals: 0, moves: 9 }).career;
  const second = recordDelve(career, 'pillars', { slain: true, seals: 0, moves: 9 });
  assert.equal(second.promoted, true);
  assert.equal(second.rank.name, 'Tunnel-walker');
  const again = recordDelve(second.career, 'pillars', { slain: true, seals: 0, moves: 9 });
  assert.equal(again.promoted, false);
});
