import test from 'node:test';
import assert from 'node:assert/strict';
import { tasksMet, taskText } from '../src/quests.mjs';

test('a contract reads false whenever the shift was not cleared', () => {
  const tasks = [['swift', 50], ['no-topout']];
  const run = { cleared: false, piecesLocked: 10, toppedOut: false };
  assert.deepEqual(tasksMet(tasks, run), [false, false]);
});

test('each contract kind checks its own stat', () => {
  const run = { cleared: true, piecesLocked: 40, hardDrops: 5, quads: 1, score: 2000, rubbleRowsSurvived: 12, toppedOut: false };
  assert.equal(tasksMet([['swift', 50]], run)[0], true);
  assert.equal(tasksMet([['swift', 30]], run)[0], false);
  assert.equal(tasksMet([['light-touch', 10]], run)[0], true);
  assert.equal(tasksMet([['no-topout']], run)[0], true);
  assert.equal(tasksMet([['score', 1500]], run)[0], true);
  assert.equal(tasksMet([['quad']], run)[0], true);
  assert.equal(tasksMet([['flood', 10]], run)[0], true);
});

test('taskText fills in the shift number for contracts without their own', () => {
  assert.match(taskText(['swift', 42]), /42/);
});
