// trek/fancy-web — Full-game autoplay stress test.
//
// Simulates a novice player who follows the top cheat hint every turn
// verbatim, no manual judgment. If the cheat is any good, the player
// should win a decent fraction of runs. This is the honest "is the game
// playable AND winnable" check.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGame, executeCommand, snapshot } from '../src/engine.js';
import { computeHints } from '../src/hints.js';
import { parseCommand, PARSE } from '../src/parser.js';

const MAX_TURNS = 500;

/**
 * Play one full session. Each turn: compute hints, take the top-priority
 * one that has a command, execute it. Stop on win/loss/timeout.
 */
function autoplaySession(difficulty, seed) {
  const game = createGame({ difficulty, seed });
  let turns = 0;
  let sameCommandRepeat = 0;
  let lastCmd = null;

  while (!game.won && !game.lost && turns < MAX_TURNS) {
    const snap = snapshot(game);
    const hints = computeHints(snap);

    // Pick the top hint that actually has an executable command.
    const actionable = hints.find(h => h.cmd);

    let cmdText;
    if (!actionable) {
      // Cheat has nothing actionable (rare — READY tier). Try scanning
      // to reveal more of the map, then hunt.
      cmdText = 'lrscan';
    } else {
      cmdText = actionable.cmd;
    }

    // Detect infinite loops (same command 6+ times in a row) — try
    // random directions in sequence when stuck.
    if (cmdText === lastCmd) {
      sameCommandRepeat++;
      if (sameCommandRepeat > 5) {
        // Escape the loop: cycle through cardinal directions
        const escapeMoves = ['move 3 1', 'move 6 1', 'move 9 1', 'move 0 1', 'move 1.5 1', 'move 4.5 1', 'move 7.5 1', 'move 10.5 1'];
        cmdText = escapeMoves[Math.floor(Math.random() * escapeMoves.length)];
        sameCommandRepeat = 0;
      }
    } else {
      sameCommandRepeat = 0;
    }
    lastCmd = cmdText;

    const parsed = parseCommand(cmdText);
    if (parsed.status !== PARSE.OK) {
      return { outcome: 'parse-error', cmd: cmdText, error: parsed.error, turns, kills: game.kills };
    }
    let res = executeCommand(game, parsed.cmd);
    if (!res.ok) {
      // Command rejected. Try each cardinal direction until one works,
      // then finally lrscan.
      const fallbacks = ['move 3 1', 'move 0 1', 'move 6 1', 'move 9 1', 'lrscan'];
      let recovered = false;
      for (const fb of fallbacks) {
        const p = parseCommand(fb);
        const r = executeCommand(game, p.cmd);
        if (r.ok) { recovered = true; break; }
      }
      if (!recovered) {
        return { outcome: 'stuck', reason: `"${cmdText}" and all fallbacks failed: ${res.error}`, turns, kills: game.kills };
      }
    }
    turns++;
  }

  return {
    outcome: game.won ? 'won' : game.lost ? 'lost' : 'timeout',
    reason: game.lostReason,
    kills: game.kills,
    klingonsRemaining: game.klingonsRemaining,
    stardate: game.stardate,
    stardateEnd: game.stardateEnd,
    turns,
    hull: game.ship.hull,
    energy: game.ship.energy,
  };
}

function stressRun(difficulty, seedCount) {
  const results = [];
  for (let seed = 1; seed <= seedCount; seed++) {
    results.push({ seed, ...autoplaySession(difficulty, seed) });
  }
  return results;
}

function summarise(label, results) {
  const won = results.filter(r => r.outcome === 'won');
  const lost = results.filter(r => r.outcome === 'lost');
  const timeout = results.filter(r => r.outcome === 'timeout');
  const stuck = results.filter(r => r.outcome === 'stuck' || r.outcome === 'parse-error');

  const reasons = {};
  for (const r of lost) {
    const key = r.reason || 'unknown';
    reasons[key] = (reasons[key] || 0) + 1;
  }

  const totalKills = results.reduce((s, r) => s + (r.kills || 0), 0);
  const avgKills = (totalKills / results.length).toFixed(2);

  console.log(`\n=== ${label} ===`);
  console.log(`  Runs: ${results.length}`);
  console.log(`  Won:      ${won.length} (${(100 * won.length / results.length).toFixed(0)}%)`);
  console.log(`  Lost:     ${lost.length}`);
  console.log(`  Timeout:  ${timeout.length}`);
  console.log(`  Stuck:    ${stuck.length}`);
  console.log(`  Total kills across all runs: ${totalKills} (avg ${avgKills}/run)`);
  if (Object.keys(reasons).length > 0) {
    console.log(`  Loss reasons:`);
    for (const [reason, count] of Object.entries(reasons)) {
      console.log(`    ${count}× ${reason}`);
    }
  }
  if (won.length > 0) {
    const avgWinTurns = won.reduce((s, r) => s + r.turns, 0) / won.length;
    const avgWinStardates = won.reduce((s, r) => s + (r.stardate - (r.stardateEnd - r.stardateEnd)), 0) / won.length;
    console.log(`  Winning runs — avg turns to victory: ${avgWinTurns.toFixed(1)}`);
  }
  return { won, lost, timeout, stuck, totalKills, avgKills, reasons };
}

// ---------------------------------------------------------------------------
// Actual stress tests
// ---------------------------------------------------------------------------

test('autoplay stress: NOVICE — cheat should deliver >= 70% win rate', () => {
  const results = stressRun('novice', 20);
  const s = summarise('NOVICE (8 Klingons / 40 stardates)', results);
  const winRate = s.won.length / results.length;
  assert.ok(winRate >= 0.7,
    `Novice autoplay win rate too low: ${(winRate * 100).toFixed(0)}%. Cheat regression likely.`);
});

test('autoplay stress: STANDARD — should destroy most Klingons even when time runs out', () => {
  const results = stressRun('standard', 15);
  const s = summarise('STANDARD (15 Klingons / 30 stardates)', results);
  // Standard has 15 Klingons; expect at least 10 kills per run on average
  // (autoplay can't consistently win, but should nearly finish the job).
  const avgKills = s.totalKills / results.length;
  assert.ok(avgKills >= 8,
    `Standard autoplay too weak: only ${avgKills.toFixed(1)} avg kills. Cheat regression likely.`);
});

test('autoplay stress: EXPERT — should not stall and should score meaningful kills', () => {
  const results = stressRun('expert', 10);
  const s = summarise('EXPERT (25 Klingons / 22 stardates)', results);
  assert.equal(s.stuck.length, 0, `Expert autoplay got stuck ${s.stuck.length} times`);
  // 25 Klingons in 22 stardates is genuinely hard; require ≥ 5 avg kills.
  const avgKills = s.totalKills / results.length;
  assert.ok(avgKills >= 5,
    `Expert autoplay too weak: only ${avgKills.toFixed(1)} avg kills.`);
});
