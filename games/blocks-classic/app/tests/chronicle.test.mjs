import test from 'node:test';
import assert from 'node:assert/strict';
import { addToLogbook, chronicleLines, emptyLogbook } from '../src/chronicle.mjs';

test('a marathon shift reports its lines and pieces from the summary, not the run', () => {
  const run = { options: { preset: 'canyon', mode: 'marathon' } };
  const summary = { lines: 12, piecesLocked: 48, score: 1800, cleared: true, quads: 0, rubbleRowsSurvived: 0 };
  const lines = chronicleLines(run, summary);
  assert.ok(lines.some((line) => line.includes('12 lines went out of the shaft, 48 pieces')));
  assert.ok(lines.every((line) => !line.includes('undefined')));
});

test('a flood shift reports rubble rows survived from the summary', () => {
  const run = { options: { preset: 'normal', mode: 'survival' } };
  const summary = { lines: 0, piecesLocked: 30, score: 900, cleared: false, quads: 0, rubbleRowsSurvived: 7 };
  const lines = chronicleLines(run, summary);
  assert.ok(lines.some((line) => line.includes('7 flood rows')));
});

test('the logbook keeps only its most recent entries', () => {
  let logbook = emptyLogbook();
  for (let i = 0; i < 35; i++) logbook = addToLogbook(logbook, { title: `Shift ${i}`, lines: [] });
  assert.equal(logbook.length, 30);
  assert.equal(logbook[0].title, 'Shift 34');
});
