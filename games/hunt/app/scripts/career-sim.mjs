#!/usr/bin/env node
// How the ten career matches play out when the player's seat is driven by a
// bot brain: Novice stands in for a newcomer, Sharpshooter for a strong
// player. For each match and bot speed: how often the stand-in wins, and how
// long a match lasts at the Standard pace (10 steps a second).
//   node scripts/career-sim.mjs [runs]    (default 12 runs per cell)
import { createMatch, tick } from '../src/engine/match.js';
import { addBot } from '../src/bots/index.js';
import { MATCHES } from '../src/desk/career.js';
import { goalOutcome } from '../src/desk/goal.js';

const RUNS = Number(process.argv[2] ?? 12);
const STEP_LIMIT = 6000; // ten minutes at the Standard pace
const PLAYER = 'you';
const COLUMNS = [['novice', 'fast'], ['novice', 'slow'], ['sharp', 'fast'], ['sharp', 'medium'], ['sharp', 'slow']];

function play(match, standIn, botSpeed, run) {
  const seed = match.seed + run * 1009;
  const g = createMatch({ seed, arena: match.arena, roster: match.roster, human: PLAYER, botSpeed, rejoinDelay: 20 });
  addBot(g, PLAYER, standIn, seed * 7 + 3);
  for (let step = 1; step <= STEP_LIMIT; step++) {
    tick(g);
    const outcome = goalOutcome(g, PLAYER, match.goal);
    if (outcome) return { won: outcome === 'won', steps: step };
  }
  return { won: false, steps: STEP_LIMIT, unfinished: true };
}

const pct = (n, d) => `${Math.round((100 * n) / d)}%`.padStart(4);
const minutes = (steps) => (steps / 600).toFixed(1).padStart(4);

console.log(`${RUNS} runs per cell; win rate · median minutes (Standard pace)`);
console.log(`${'match'.padEnd(20)}${COLUMNS.map(([who, speed]) => `${who} ${speed}`.padEnd(20)).join('')}`);
for (const match of MATCHES) {
  const cells = [];
  for (const [standIn, botSpeed] of COLUMNS) {
    const results = Array.from({ length: RUNS }, (_, run) => play(match, standIn, botSpeed, run));
    const wins = results.filter((r) => r.won).length;
    const unfinished = results.filter((r) => r.unfinished).length;
    const steps = results.map((r) => r.steps).sort((a, b) => a - b);
    const median = steps[Math.floor(steps.length / 2)];
    cells.push(`${pct(wins, RUNS)} · ${minutes(median)}m${unfinished ? ` (${unfinished}∞)` : ''}`.padEnd(20));
  }
  console.log(`${match.id.padEnd(20)}${cells.join('')}`);
}
