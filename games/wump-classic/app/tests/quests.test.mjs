import assert from 'node:assert/strict';
import test from 'node:test';
import { taskText, tasksMet, TASKS } from '../src/quests.mjs';

const run = (overrides) => ({
  slain: true,
  moves: 10,
  bumps: 0,
  batRides: 0,
  ledges: 0,
  arrowsFired: 1,
  arrowsLeft: 4,
  slayingPath: 1,
  woke: false,
  visited: 6,
  chartOpened: false,
  ...overrides,
});

test('every quest reads as a sentence of its own', () => {
  for (const kind of Object.keys(TASKS)) {
    const text = taskText([kind, 3]);
    assert.match(text, /^[A-Z].*\.$/, kind);
  }
});

test('each quest is met only by what it asks', () => {
  const cases = [
    [['swift', 10], {}, true],
    [['swift', 9], {}, false],
    [['no-bats'], { batRides: 1 }, false],
    [['first-arrow'], { arrowsFired: 2 }, false],
    [['spare', 4], {}, true],
    [['spare', 5], {}, false],
    [['no-bumps'], { bumps: 1 }, false],
    [['quiet'], { woke: true }, false],
    [['few-chambers', 6], {}, true],
    [['few-chambers', 5], {}, false],
    [['crooked', 2], { slayingPath: 2 }, true],
    [['crooked', 2], {}, false],
    [['no-chart'], { chartOpened: true }, false],
  ];
  for (const [task, overrides, expected] of cases) {
    assert.deepEqual(tasksMet([task], run(overrides)), [expected], JSON.stringify(task));
  }
});

test('nothing counts on a delve whose wumpus was not slain', () => {
  assert.deepEqual(tasksMet([['no-bats'], ['quiet'], ['no-chart']], run({ slain: false })), [false, false, false]);
});
