// The testing aid's planner: following its suggestions brings shifts home, landings included.
// Run: node --test tests/planner.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGame, executeCommand, spawnPlane, tick, FEATURE, STATUS } from '../src/engine.js';
import { parseCommand, PARSE } from '../src/parser.js';
import { PLAYFIELDS } from '../src/playfields.js';
import { planTraffic } from '../src/planner.js';

/** Every suggestion typed, tick after tick, as a player following the cheat panel would. */
function followThePlanner(sectorKey, seed, ticks) {
  const game = createGame(PLAYFIELDS[sectorKey], { seed });
  spawnPlane(game);
  const counts = { landings: 0, exits: 0, refused: 0, losses: [] };
  for (let t = 0; t < ticks && !game.lost; t++) {
    for (const { hint } of planTraffic(game)) {
      for (const command of hint.commands) {
        const parsed = parseCommand(command);
        assert.equal(parsed.status, PARSE.OK, `${command} parses`);
        if (!executeCommand(game, parsed.cmd).ok) counts.refused += 1;
      }
    }
    for (const event of tick(game).events) {
      if (event.type === 'land') counts.landings += 1;
      if (event.type === 'exit') counts.exits += 1;
      if (event.type === 'loss') counts.losses.push(`seed ${seed}, tick ${game.clock}: ${event.reason}`);
    }
  }
  return counts;
}

function shifts(sectorKey, seeds, ticks) {
  const total = { landings: 0, exits: 0, refused: 0, losses: [] };
  for (let seed = 1; seed <= seeds; seed++) {
    const counts = followThePlanner(sectorKey, seed, ticks);
    total.landings += counts.landings;
    total.exits += counts.exits;
    total.refused += counts.refused;
    total.losses.push(...counts.losses);
  }
  return total;
}

test('Easy: twelve shifts followed to the letter lose nothing, and planes land', () => {
  const total = shifts('easy', 12, 200);
  assert.deepEqual(total.losses, []);
  assert.equal(total.refused, 0, 'the engine accepts every suggestion');
  assert.ok(total.landings >= 30, `${total.landings} landings`);
  assert.ok(total.exits >= 100, `${total.exits} handoffs`);
});

test('Default: four busy shifts lose nothing', () => {
  const total = shifts('default', 4, 150);
  assert.deepEqual(total.losses, []);
  assert.ok(total.landings >= 10, `${total.landings} landings`);
});

test('Killer: three fast shifts lose nothing', () => {
  const total = shifts('killer', 3, 120);
  assert.deepEqual(total.losses, []);
  assert.ok(total.landings >= 10, `${total.landings} landings`);
});

function plane(overrides) {
  return {
    planeNo: 0, planeType: 1, letter: 'A', origType: FEATURE.EXIT, origNo: 3, destType: FEATURE.AIRPORT, destNo: 0,
    xpos: 10, ypos: 7, altitude: 6, newAltitude: 6, dir: 6, newDir: 6, fuel: 30,
    status: STATUS.MARKED, delayed: false, delayedBeaconNo: -1, ticksAlive: 0, spawnTick: 0,
    ...overrides,
  };
}

test('a lone plane bound for the airport is talked all the way down onto the runway', () => {
  const game = createGame({ ...PLAYFIELDS.easy, newplaneMean: 1e9 }, { seed: 4 });
  game.air.push(plane({}));
  let landed = false;
  for (let t = 0; t < 40 && !landed && !game.lost; t++) {
    for (const { hint } of planTraffic(game)) for (const command of hint.commands) executeCommand(game, parseCommand(command).cmd);
    landed = tick(game).events.some((event) => event.type === 'land');
  }
  assert.equal(game.lost, false);
  assert.equal(landed, true);
});

test('a suggestion comes as few orders as fly it: a straight climb out is one order, then none', () => {
  const game = createGame({ ...PLAYFIELDS.easy, newplaneMean: 1e9 }, { seed: 4 });
  // Bound for exit 1 at (19, 7), heading east along the row at 6,000 feet: climb to 9 and fly on.
  game.air.push(plane({ destType: FEATURE.EXIT, destNo: 1, xpos: 9, dir: 2, newDir: 2 }));
  const [first] = planTraffic(game);
  assert.deepEqual(first.hint.commands, ['Aa9']);
  executeCommand(game, parseCommand('Aa9').cmd);
  const [second] = planTraffic(game);
  assert.deepEqual(second.hint.commands, []);
  assert.equal(second.hint.tag, 'ON COURSE');
});
