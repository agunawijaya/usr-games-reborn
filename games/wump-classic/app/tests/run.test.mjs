import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { addToLedger, chronicleLines } from '../src/chronicle.mjs';
import { newPages, PAGES } from '../src/codex.mjs';
import { tasksMet } from '../src/quests.mjs';
import { noteChart, noteMove, noteShot, startRun, summarize } from '../src/run.mjs';

const require = createRequire(import.meta.url);
const { WumpGame } = require('../src/engine.js');

/** A shortest route through the cave's tunnels. */
function route(cave, from, to) {
  const previous = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length > 0) {
    const room = queue.shift();
    if (room === to) break;
    for (const next of cave[room]) {
      if (!previous.has(next)) {
        previous.set(next, room);
        queue.push(next);
      }
    }
  }
  const rooms = [];
  for (let at = to; at !== from; at = previous.get(at)) rooms.unshift(at);
  return rooms;
}

test('a delve played through the engine is counted and told as it happened', () => {
  const game = new WumpGame({ seed: 7 });
  const run = startRun({ kind: 'career', name: 'Delve 1', delveId: 'threshold', tasks: [['no-bats'], ['first-arrow'], ['no-chart']] }, game);
  // A wall first: a room that no tunnel leads to.
  const wall = [...Array(20).keys()].map((i) => i + 1).find((r) => r !== game.playerLoc && !game.cave[game.playerLoc].includes(r));
  noteMove(run, wall, game.moveTo(wall), game);
  noteChart(run);
  // Then an arrow straight down the tunnels to the wumpus, if it is in reach.
  const path = route(game.cave, game.playerLoc, game.wumpusLoc).slice(0, 2);
  noteShot(run, path, game.shootArrow(path), game);

  const summary = summarize(run, game);
  assert.equal(summary.moves, 1);
  assert.equal(summary.bumps, 1);
  assert.equal(summary.arrowsFired, 1);
  assert.equal(summary.chartOpened, true);
  assert.equal(summary.slain, game.status === 'VICTORY');
  const met = tasksMet(run.tasks, summary);
  assert.equal(met[2], false, 'the chart was opened');

  const lines = chronicleLines(run, { title: 'THE END', message: 'It ended.' });
  assert.match(lines[0], /^You passed through the rune gate into chamber \d+\./);
  assert.ok(lines.some((line) => line.startsWith('Reaching for chamber')));
  assert.ok(lines.some((line) => line.startsWith('You loosed an arrow along')));
  assert.equal(lines[lines.length - 1], 'The end It ended.');
});

test('bats and outcrops are counted from the engine’s answers', () => {
  const game = new WumpGame({ seed: 3 });
  const run = startRun({ kind: 'free', name: 'Free delve' }, game);
  noteMove(run, 5, { success: true, batTransported: true, pitOutcropSaved: true, status: 'IN_PROGRESS' }, game);
  assert.equal(run.batRides, 1);
  assert.equal(run.ledges, 1);
  const lines = chronicleLines(run, { title: 'X', message: 'Y' });
  assert.ok(lines.some((line) => line.includes('Super-bats seized you')));
  assert.ok(lines.some((line) => line.includes('rock outcrop')));
});

test('the ledger keeps the newest thirty chronicles', () => {
  let ledger = [];
  for (let i = 0; i < 35; i++) ledger = addToLedger(ledger, { n: i });
  assert.equal(ledger.length, 30);
  assert.equal(ledger[0].n, 34);
});

test('codex pages are unique and found once', () => {
  assert.equal(new Set(PAGES.map((p) => p.id)).size, PAGES.length);
  const moment = {
    run: { events: [{ type: 'start', cues: { draft: true, stench: false, flutter: false } }] },
    summary: { slain: true, ledges: 0, batRides: 0, arrowsFired: 1, chartOpened: false },
    delve: { options: { mode: 'dodecahedron', level: 'EASY' } },
    daily: false,
    cleared: 1,
    droneHeard: false,
  };
  const first = newPages([], moment);
  assert.ok(first.includes('wumpus') && first.includes('draft') && first.includes('pillars'));
  assert.deepEqual(newPages(first, moment), []);
});
