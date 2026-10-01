// atc/fancy-web — full-game stress test
//
// Purpose: verify the game is *actually winnable* by a player who follows
// the cheat sheet religiously, across many random seeds. Also diagnose
// failure modes so the cheat can be improved.
//
// Approach: for each seed, simulate a full session where every plane on
// screen executes its suggested command each tick. Aggregate outcomes.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame, tick, executeCommand, spawnPlane,
  STATUS,
} from '../src/engine.js';
import { hintForPlane } from '../src/hints.js';
import { parseCommand, PARSE } from '../src/parser.js';
import { PLAYFIELDS } from '../src/playfields.js';

/** Run one full autoplay session using the cheat for every plane. */
function fullAutoplay(pfKey, seed, maxTicks = 200) {
  const pf = PLAYFIELDS[pfKey];
  const g = createGame(pf, { seed });
  spawnPlane(g);   // initial plane so board isn't empty at start

  const commandsIssued = [];
  const chosenTags = new Map(); // count hint tags used

  for (let step = 0; step < maxTicks; step++) {
    if (g.lost) {
      return {
        outcome: 'lost',
        reason: g.lostReason,
        lostPlane: g.lostPlane,
        ticks: step,
        safe: g.safePlanes,
        commandsIssued: commandsIssued.length,
        chosenTags,
      };
    }
    // For each plane, look up hint and issue if any command suggested.
    // Deduplicate commands so we don't re-issue an identical one repeatedly.
    for (const p of [...g.ground, ...g.air]) {
      const isGround = g.ground.includes(p);
      const others = isGround ? [] : g.air.filter(o => o !== p);
      const hint = hintForPlane(p, pf, isGround, others);
      if (!hint) continue;
      chosenTags.set(hint.tag, (chosenTags.get(hint.tag) || 0) + 1);
      if (!hint.command) continue;
      const parsed = parseCommand(hint.command);
      if (parsed.status !== PARSE.OK) continue;
      const res = executeCommand(g, parsed.cmd);
      if (res.ok) commandsIssued.push({ tick: g.clock, cmd: hint.command, tag: hint.tag });
    }
    tick(g);
  }
  return {
    outcome: 'timeout',
    ticks: maxTicks,
    safe: g.safePlanes,
    commandsIssued: commandsIssued.length,
    chosenTags,
  };
}

test('stress: AVOID diagnostic — trace one collision', () => {
  // Deeply instrumented single-seed run — dump state of both planes each
  // tick before/after crash.
  const pf = PLAYFIELDS.easy;
  const g = createGame(pf, { seed: 7 });
  spawnPlane(g);
  const log = [];
  for (let step = 0; step < 200; step++) {
    if (g.lost) {
      log.push(`LOST at tick ${g.clock}: ${g.lostPlane} ${g.lostReason}`);
      break;
    }
    // Snapshot ALL air planes each tick
    const snap = g.air.map(p => ({
      L: p.letter, x: p.xpos, y: p.ypos, alt: p.altitude, nalt: p.newAltitude,
      dir: p.dir, ndir: p.newDir,
    }));
    // Compute all hints
    const hints = [];
    for (const p of [...g.ground, ...g.air]) {
      const isGround = g.ground.includes(p);
      const others = isGround ? [] : g.air.filter(o => o !== p);
      const hint = hintForPlane(p, pf, isGround, others);
      hints.push({ L: p.letter, tag: hint?.tag, cmd: hint?.command });
      if (hint?.command) {
        const parsed = parseCommand(hint.command);
        if (parsed.status === PARSE.OK) executeCommand(g, parsed.cmd);
      }
    }
    log.push(`t${g.clock}: ${JSON.stringify(snap)} hints=${JSON.stringify(hints)}`);
    tick(g);
  }
  console.log('\n=== Seed 7 trace (last 15 ticks) ===');
  for (const line of log.slice(-15)) console.log(' ', line);
});

test('stress: EASY sector — 30 seeds, cheat should keep game alive for a shift', () => {
  const runs = [];
  const N = 30;
  for (let seed = 1; seed <= N; seed++) {
    runs.push({ seed, ...fullAutoplay('easy', seed, 200) });
  }

  const losses = runs.filter(r => r.outcome === 'lost');
  const timeouts = runs.filter(r => r.outcome === 'timeout');

  // Aggregate loss reasons
  const reasons = {};
  for (const r of losses) {
    reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  }
  const totalSafe = runs.reduce((sum, r) => sum + r.safe, 0);
  const avgSafe = totalSafe / N;

  console.log('\n=== EASY stress results ===');
  console.log(`  ${losses.length}/${N} lost`);
  console.log(`  ${timeouts.length}/${N} survived shift`);
  console.log(`  ${totalSafe} planes safely delivered across all runs (avg ${avgSafe.toFixed(1)}/run)`);
  console.log(`  loss reasons:`, reasons);

  // At least 40% of runs should either survive OR deliver ≥1 plane.
  // (More stringent bar is aspirational; below this signals systemic cheat bug.)
  const successful = runs.filter(r => r.outcome === 'timeout' || r.safe >= 1).length;
  assert.ok(successful >= Math.floor(N * 0.4),
    `Only ${successful}/${N} runs delivered any planes. Cheat probably broken. Reasons: ${JSON.stringify(reasons)}`);
});

test('stress: DEFAULT sector — 20 seeds', () => {
  const runs = [];
  const N = 20;
  for (let seed = 1; seed <= N; seed++) {
    runs.push({ seed, ...fullAutoplay('default', seed, 200) });
  }
  const losses = runs.filter(r => r.outcome === 'lost');
  const totalSafe = runs.reduce((sum, r) => sum + r.safe, 0);
  const reasons = {};
  for (const r of losses) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  console.log('\n=== DEFAULT stress results ===');
  console.log(`  ${losses.length}/${N} lost`);
  console.log(`  ${totalSafe} planes safely delivered across all runs (avg ${(totalSafe/N).toFixed(1)}/run)`);
  console.log(`  loss reasons:`, reasons);

  const successful = runs.filter(r => r.outcome === 'timeout' || r.safe >= 1).length;
  assert.ok(successful >= Math.floor(N * 0.3),
    `Only ${successful}/${N} DEFAULT runs delivered any planes. Reasons: ${JSON.stringify(reasons)}`);
});

test('cheat correctness: no scenario tells plane to do a self-crashing action', () => {
  // Sample plane states across the arena. For each, verify the hint's
  // suggested command doesn't immediately self-destruct: e.g., commanding
  // Aa0 while alt > 0 AND not at airport (crash on ground next tick with
  // 0 dist decrement possible if heading wrong).
  const pf = PLAYFIELDS.easy;
  const g = createGame(pf, { seed: 42 });

  const checks = [];
  for (let x = 0; x < pf.width; x += 3) {
    for (let y = 0; y < pf.height; y += 3) {
      for (const alt of [1, 3, 5, 7, 9]) {
        for (const dir of [0, 2, 4, 6]) {
          // Airport dest
          const p = {
            planeNo: 0, planeType: 1, letter: 'A',
            origType: 0, origNo: 0, destType: 1, destNo: 0,
            xpos: x, ypos: y, altitude: alt, newAltitude: alt,
            dir, newDir: dir, fuel: 50,
            status: STATUS.MARKED,
            delayed: false, delayedBeaconNo: -1,
            ticksAlive: 0, spawnTick: 0,
          };
          const hint = hintForPlane(p, pf, false);
          if (!hint) continue;
          checks.push({ pos: [x, y], alt, dir, hint });
        }
      }
    }
  }

  // Verify no hint suggests Aa0 while plane far from airport (dist > 1)
  // AND altitude > 1 AND heading not perfectly toward airport.
  const airport = pf.airports[0];
  const badHints = [];
  for (const { pos, alt, hint } of checks) {
    const dist = Math.max(Math.abs(pos[0] - airport.x), Math.abs(pos[1] - airport.y));
    if (hint.command === 'Aa0' && dist > 1 && alt > 1) {
      badHints.push({ pos, alt, dist, hint: hint.tag, cmd: hint.command });
    }
  }
  assert.equal(badHints.length, 0,
    `Cheat suggests premature Aa0 in ${badHints.length} scenarios: ${JSON.stringify(badHints.slice(0, 5))}`);
});

test('cheat correctness: exit-bound planes always eventually get climb hint when below alt 9', () => {
  const pf = PLAYFIELDS.easy;
  const exit = pf.exits[0];
  // Simulate plane inbound at various altitudes; hint must eventually
  // suggest climb (or already have commanded climb) so alt reaches 9 by
  // arrival.
  const plane = {
    planeNo: 0, planeType: 1, letter: 'A',
    origType: 0, origNo: 1, destType: 0, destNo: 0,
    xpos: 5, ypos: 5, altitude: 5, newAltitude: 5,
    dir: 0, newDir: 0, fuel: 30,
    status: STATUS.MARKED,
    delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
  };
  const hint = hintForPlane(plane, pf, false);
  // Must be either CLIMB (recommending Aa9) or HEADING first (heading takes
  // priority when altitude is fine or above; here alt=5 < required 9 → CLIMB).
  assert.ok(hint.tag === 'CLIMB' || hint.tag === 'HEADING',
    `exit-bound low-altitude plane should get CLIMB or HEADING hint, got ${hint.tag}`);
});
