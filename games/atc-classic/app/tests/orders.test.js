// The order buttons: every button types exactly the command a player would type, and the engine
// treats the two the same. A property test over many legal states of all three sectors.
// Run: node --test tests/orders.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGame, executeCommand, makeRng, spawnPlane, tick, FEATURE, STATUS } from '../src/engine.js';
import { parseCommand, PARSE } from '../src/parser.js';
import { PLAYFIELDS } from '../src/playfields.js';
import { boardButtons, COMPASS_LAYOUT, explainTyped, orderBoard } from '../src/orders.js';

/**
 * A sector some way into a shift: seeded traffic and a few ticks of orders chosen at random from
 * the buttons themselves, delayed ones included. Deterministic, so calling it twice with the same
 * arguments gives two identical games.
 */
function busySector(sectorKey, seed, ticks) {
  const game = createGame(PLAYFIELDS[sectorKey], { seed });
  const choose = makeRng(seed ^ 0x5bd1e995);
  for (let i = 0; i < 3; i++) spawnPlane(game);
  for (let t = 0; t < ticks && !game.lost; t++) {
    const planes = [...game.air, ...game.ground];
    if (planes.length && choose() < 0.8) {
      const plane = planes[Math.floor(choose() * planes.length)];
      const onTrack = orderBoard(plane, game.playfield).delay.beacons.filter((b) => b.enabled);
      const atBeacon = onTrack.length && choose() < 0.3 ? onTrack[0].index : null;
      const enabled = boardButtons(orderBoard(plane, game.playfield, { atBeacon })).filter((b) => b.enabled);
      if (enabled.length) executeCommand(game, enabled[Math.floor(choose() * enabled.length)].cmd);
    }
    tick(game);
  }
  return game;
}

const planeState = (game) =>
  [...game.air, ...game.ground].map(({ letter, xpos, ypos, altitude, newAltitude, dir, newDir, status, delayed, delayedBeaconNo, fuel }) =>
    ({ letter, xpos, ypos, altitude, newAltitude, dir, newDir, status, delayed, delayedBeaconNo, fuel }));

const STATES = [];
for (const sectorKey of Object.keys(PLAYFIELDS)) {
  for (let seed = 1; seed <= 40; seed++) STATES.push({ sectorKey, seed, ticks: (seed * 7) % 31 });
}

test('every button types a command the parser reads as exactly the button’s order', () => {
  let checked = 0;
  for (const { sectorKey, seed, ticks } of STATES) {
    const game = busySector(sectorKey, seed, ticks);
    if (game.lost) continue;
    for (const plane of [...game.air, ...game.ground]) {
      for (const atBeacon of [null, ...game.playfield.beacons.map((_, i) => i)]) {
        for (const button of boardButtons(orderBoard(plane, game.playfield, { atBeacon }))) {
          const parsed = parseCommand(button.typed);
          assert.equal(parsed.status, PARSE.OK, `${button.typed} parses`);
          assert.deepEqual(parsed.cmd, button.cmd, `${button.typed} means the button's order`);
          assert.equal(button.parts.map(([text]) => text).join(''), button.typed);
          assert.deepEqual(explainTyped(button.typed, parsed.cmd, game.playfield), button.parts, `${button.typed} explained the same either way`);
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 5000, `checked ${checked} buttons`);
});

test('a button on is an order the engine accepts and that changes something; off, it refuses or changes nothing', () => {
  for (const { sectorKey, seed, ticks } of STATES) {
    const probe = busySector(sectorKey, seed, ticks);
    if (probe.lost) continue;
    for (const plane of [...probe.air, ...probe.ground]) {
      for (const atBeacon of [null, ...probe.playfield.beacons.map((_, i) => i)]) {
        for (const button of boardButtons(orderBoard(plane, probe.playfield, { atBeacon }))) {
          // Orders touch only the planes, so a copy of them stands in for the whole game here.
          const game = { playfield: probe.playfield, air: probe.air.map((p) => ({ ...p })), ground: probe.ground.map((p) => ({ ...p })) };
          const before = JSON.stringify(planeState(game));
          const result = executeCommand(game, parseCommand(button.typed).cmd);
          const changed = JSON.stringify(planeState(game)) !== before;
          if (button.enabled) {
            assert.equal(result.ok, true, `${button.typed} accepted`);
            assert.equal(changed, true, `${button.typed} changes the plane`);
          } else {
            assert.ok(button.why, `${button.typed} says why it is off`);
            const harmless = !result.ok || !changed || button.why === 'It is there already';
            assert.ok(harmless, `${button.typed} is off for a reason: ${button.why}`);
          }
        }
      }
    }
  }
});

test('pressing a button and typing its command lead to the same shift, tick after tick', () => {
  for (const { sectorKey, seed, ticks } of STATES.filter((_, i) => i % 3 === 0)) {
    const probe = busySector(sectorKey, seed, ticks);
    if (probe.lost) continue;
    for (const plane of [...probe.air, ...probe.ground]) {
      const enabled = boardButtons(orderBoard(plane, probe.playfield)).filter((b) => b.enabled);
      for (const button of enabled) {
        const pressed = busySector(sectorKey, seed, ticks);
        const typed = busySector(sectorKey, seed, ticks);
        executeCommand(pressed, button.cmd);
        executeCommand(typed, parseCommand(button.typed).cmd);
        for (let t = 0; t < 6; t++) {
          tick(pressed);
          tick(typed);
          assert.deepEqual(planeState(pressed), planeState(typed), `${button.typed}, tick ${t + 1}`);
          assert.equal(pressed.lost, typed.lost);
        }
      }
    }
  }
});

test('the board marks the destination and the altitude it needs, and the orders already followed', () => {
  const game = createGame(PLAYFIELDS.default, { seed: 5 });
  const plane = {
    planeNo: 1, planeType: 1, letter: 'B', origType: FEATURE.EXIT, origNo: 5, destType: FEATURE.EXIT, destNo: 2,
    xpos: 8, ypos: 13, altitude: 7, newAltitude: 7, dir: 2, newDir: 2, fuel: 30,
    status: STATUS.MARKED, delayed: false, delayedBeaconNo: -1, ticksAlive: 0, spawnTick: 0,
  };
  game.air.push(plane);
  const board = orderBoard(plane, game.playfield);
  assert.deepEqual(board.exits.filter((b) => b.goal).map((b) => b.label), ['Exit 2']);
  assert.deepEqual(board.altitudes.filter((b) => b.goal).map((b) => b.glyph), ['9']);
  assert.deepEqual(board.altitudes.filter((b) => b.current).map((b) => b.glyph), ['7']);
  assert.equal(board.altitudes[7].enabled, false, 'the altitude it is already holding is off');
  const east = board.compass[COMPASS_LAYOUT.indexOf(2)];
  assert.equal(east.typed, 'Btd');
  assert.equal(east.current, true);
  assert.equal(east.enabled, false);
  assert.deepEqual(board.status.filter((b) => b.current).map((b) => b.label), ['Mark']);
});

test('a prop types its own lower-case letter', () => {
  const game = createGame(PLAYFIELDS.easy, { seed: 2 });
  const plane = {
    planeNo: 19, planeType: 0, letter: 't', origType: FEATURE.EXIT, origNo: 3, destType: FEATURE.EXIT, destNo: 1,
    xpos: 3, ypos: 7, altitude: 7, newAltitude: 7, dir: 2, newDir: 2, fuel: 30,
    status: STATUS.MARKED, delayed: false, delayedBeaconNo: -1, ticksAlive: 0, spawnTick: 0,
  };
  game.air.push(plane);
  const board = orderBoard(plane, game.playfield, { atBeacon: 0 });
  const north = board.compass[COMPASS_LAYOUT.indexOf(0)];
  assert.equal(north.typed, 'ttw@b0');
  assert.deepEqual(north.parts, [['t', 'plane t'], ['t', 'turn'], ['w', 'north'], ['@b0', 'at beacon 0']]);
  assert.equal(north.enabled, true);
  assert.equal(board.altitudes[9].enabled, false, 'only direction orders can wait for a beacon');
  assert.equal(board.delay.enabled, true);
});
