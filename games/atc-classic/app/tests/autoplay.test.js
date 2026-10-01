// atc/fancy-web autoplay simulation
// Verifies the cheat sheet actually WORKS: given a plane, follow the
// suggested command each tick and check the plane lands / exits without loss.
//
// This is a smoke test — not exhaustive. A passing autoplay run proves the
// hint chain can drive a plane home; a failing one is a real bug in the
// glidepath / heading / altitude coordination.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame, tick, executeCommand, spawnPlane,
  DIR, FEATURE, STATUS, MAXDIR,
} from '../src/engine.js';
import { hintForPlane } from '../src/hints.js';
import { parseCommand, PARSE } from '../src/parser.js';
import { EASY_FIELD } from '../src/playfields.js';

/**
 * Autoplay: on each tick, take the current hint's suggested command
 * (if any) and execute it, then advance the tick. Continue until the
 * plane is safely delivered, the game is lost, or we time out.
 */
function autoplay(game, planeLetter, maxTicks = 60) {
  const log = [];
  for (let step = 0; step < maxTicks; step++) {
    if (game.lost) return { outcome: 'lost', reason: game.lostReason, ticks: step, log };
    // is our target plane still around?
    const inAir = game.air.find(p => p.letter === planeLetter);
    const inGround = game.ground.find(p => p.letter === planeLetter);
    const plane = inAir || inGround;
    if (!plane) {
      // gone — either safely delivered (safePlanes counter should show) or already lost
      return { outcome: 'delivered', ticks: step, log, safePlanes: game.safePlanes };
    }

    const hint = hintForPlane(plane, game.playfield, !!inGround);
    if (hint && hint.command) {
      const parsed = parseCommand(hint.command);
      if (parsed.status !== PARSE.OK) {
        return { outcome: 'bad-hint', reason: `hint "${hint.command}" failed to parse: ${parsed.error}`, ticks: step, log };
      }
      const res = executeCommand(game, parsed.cmd);
      if (!res.ok) {
        return { outcome: 'bad-hint', reason: `hint "${hint.command}" execute failed: ${res.error}`, ticks: step, log };
      }
      log.push({ tick: game.clock, plane: plane.letter, pos: [plane.xpos, plane.ypos], alt: plane.altitude, dir: plane.dir, hint: hint.tag, cmd: hint.command });
    } else {
      log.push({ tick: game.clock, plane: plane.letter, pos: [plane.xpos, plane.ypos], alt: plane.altitude, dir: plane.dir, hint: hint ? hint.tag : 'none', cmd: null });
    }

    tick(game);
  }
  return { outcome: 'timeout', ticks: maxTicks, log };
}

// Helper: seed a plane manually so we can control origin/dest/position.
function seedPlane(game, overrides) {
  const p = {
    planeNo: 0, planeType: 1, letter: 'A',
    origType: FEATURE.EXIT, origNo: 0,
    destType: FEATURE.EXIT, destNo: 1,
    xpos: 10, ypos: 7,
    altitude: 7, newAltitude: 7,
    dir: DIR.E, newDir: DIR.E,
    fuel: 40,
    status: STATUS.MARKED,
    delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
    ...overrides,
  };
  game.air.push(p);
  return p;
}

// ---------------------------------------------------------------------------
// Autoplay scenarios
// ---------------------------------------------------------------------------

test('autoplay: exit-bound plane climbs and departs', () => {
  const g = createGame(EASY_FIELD, { seed: 1 });
  // Manually control: place plane at (5, 5), altitude 3, dest exit 1 at (19, 7).
  seedPlane(g, {
    xpos: 5, ypos: 5, altitude: 3, newAltitude: 3,
    dir: DIR.E, newDir: DIR.E, fuel: 60,
    destType: FEATURE.EXIT, destNo: 1,
  });
  const res = autoplay(g, 'A', 80);
  assert.equal(res.outcome, 'delivered', `expected delivered, got ${res.outcome}: ${res.reason}`);
});

test('autoplay: airport-bound from correct approach line at matched altitude', () => {
  // Airport 0 at (5, 5) runway SE. Correct approach line from NW heading SE.
  // Plane at (0, 0) alt 5 heading SE — altitude MATCHES distance (5=5) which
  // is the mathematical prerequisite for a clean straight-line landing
  // in BSD atc (altitude drops 1/tick, distance drops 1/tick, both hit 0
  // together). The cheat should command Aa0 and let the plane glide in.
  //
  // Known cheat limitation: planes with altitude != distance on approach
  // need to CIRCLE to bleed altitude before final approach. The cheat
  // does not currently issue circle commands — that would be a v2
  // enhancement. Novice players may see planes miss the airport in that
  // case and need to intervene manually.
  const g = createGame(EASY_FIELD, { seed: 2 });
  seedPlane(g, {
    xpos: 0, ypos: 0, altitude: 5, newAltitude: 5,
    dir: DIR.SE, newDir: DIR.SE, fuel: 40,
    destType: FEATURE.AIRPORT, destNo: 0,
  });
  const res = autoplay(g, 'A', 30);
  assert.equal(res.outcome, 'delivered',
    `expected delivered, got ${res.outcome}: ${res.reason}\nlog tail:\n${JSON.stringify(res.log.slice(-8), null, 2)}`);
});

test('autoplay: airport-bound close approach', () => {
  const g = createGame(EASY_FIELD, { seed: 3 });
  // Airport 0 at (5,5). Start plane 4 cells NW of airport, alt 4, heading SE.
  seedPlane(g, {
    xpos: 1, ypos: 1, altitude: 4, newAltitude: 4,
    dir: DIR.SE, newDir: DIR.SE, fuel: 60,
    destType: FEATURE.AIRPORT, destNo: 0,
  });
  const res = autoplay(g, 'A', 40);
  assert.equal(res.outcome, 'delivered',
    `expected delivered, got ${res.outcome}: ${res.reason}\nlog tail:\n${JSON.stringify(res.log.slice(-8), null, 2)}`);
});

test('autoplay: airport-bound directly over airport at high altitude — hint never suggests Aa0 immediately', () => {
  // Hardest hint scenario: plane directly over airport but too high to
  // land. The hint MUST NOT tell the plane Aa0 immediately (would drop
  // through altitude 0 next tick, past the airport → crashed on ground).
  //
  // We verify this by inspecting the very first hint at the starting
  // state — not by playing the whole game (which introduces confounds
  // like multi-plane collisions once the engine keeps spawning).
  const g = createGame(EASY_FIELD, { seed: 4 });
  const plane = {
    planeNo: 0, planeType: 1, letter: 'A',
    origType: FEATURE.AIRPORT, origNo: 0,
    destType: FEATURE.AIRPORT, destNo: 0,
    xpos: 5, ypos: 5, altitude: 7, newAltitude: 7,
    dir: DIR.N, newDir: DIR.N, fuel: 100,
    status: STATUS.MARKED,
    delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
  };
  const hint = hintForPlane(plane, g.playfield, false);
  // The starting hint should not command Aa0 with plane at alt 7 dist 0.
  // It should either align (heading N != SE) or otherwise not immediately
  // trigger a fatal descent.
  assert.notEqual(hint.command, 'Aa0',
    `hint at (airport, alt 7, heading N) should not be Aa0 immediately — got ${hint.command}`);
});

test('autoplay: ground plane takes off and heads to exit', () => {
  const g = createGame(EASY_FIELD, { seed: 5 });
  // Airport 0 at (5, 5). Plane on ground there, dest exit 1 at (19, 7).
  const plane = {
    planeNo: 0, planeType: 1, letter: 'A',
    origType: FEATURE.AIRPORT, origNo: 0,
    destType: FEATURE.EXIT, destNo: 1,
    xpos: 5, ypos: 5, altitude: 0, newAltitude: 0,
    dir: DIR.SE, newDir: DIR.SE, fuel: 80,
    status: STATUS.MARKED,
    delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
  };
  g.ground.push(plane);
  const res = autoplay(g, 'A', 100);
  assert.equal(res.outcome, 'delivered',
    `expected delivered, got ${res.outcome}: ${res.reason}\nlog tail:\n${JSON.stringify(res.log.slice(-8), null, 2)}`);
});
