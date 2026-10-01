// Standalone trace runner (not a test) — inspects one autoplay run
// verbose, to diagnose why the cheat is losing.
//
// Run: node tests/autoplay-trace.js [seed] [difficulty]

import { createGame, executeCommand, snapshot } from '../src/engine.js';
import { computeHints } from '../src/hints.js';
import { parseCommand, PARSE } from '../src/parser.js';

const seed = Number(process.argv[2] || 1);
const difficulty = process.argv[3] || 'novice';

const game = createGame({ difficulty, seed });
console.log(`# Seed ${seed} · ${difficulty}`);
console.log(`# Start: quadrant (${game.ship.qx + 1}-${game.ship.qy + 1}), stardate ${game.stardate.toFixed(1)}, budget ${game.stardateEnd.toFixed(1)}, klingons ${game.klingonsRemaining}\n`);

const MAX = 100;
let turn = 0;
let lastCmd = null;
let repeats = 0;

while (!game.won && !game.lost && turn < MAX) {
  const snap = snapshot(game);
  const hints = computeHints(snap);
  const top = hints.find(h => h.cmd) || hints[0];

  let cmd = top?.cmd || 'lrscan';
  if (cmd === lastCmd) { repeats++; if (repeats > 5) { cmd = 'move 0 1'; repeats = 0; } }
  else { repeats = 0; }
  lastCmd = cmd;

  const parsed = parseCommand(cmd);
  if (parsed.status !== PARSE.OK) { console.log(`  parse error: ${cmd} → ${parsed.error}`); break; }
  const res = executeCommand(game, parsed.cmd);

  const sd = game.stardate.toFixed(1);
  const q = `${game.ship.qx + 1}-${game.ship.qy + 1}`;
  const k = game.klingonsRemaining;
  const en = game.ship.energy;
  const hull = game.ship.hull;
  const shields = game.ship.shields;
  const localK = snap.quadrant.contents.klingons.filter(x => !x.destroyed).length;
  console.log(`t${String(turn).padStart(3,' ')} sd${sd} q${q} K${k}(loc=${localK}) en${en} hull${hull}% sh${shields} | [${top?.priority ?? '?'} ${top?.tag ?? 'NONE'}] ${cmd}${res.ok ? '' : ' ← REJECT: ' + res.error}`);
  turn++;
}

console.log(`\n# End: ${game.won ? 'WON' : game.lost ? 'LOST: ' + game.lostReason : 'TIMEOUT'} after ${turn} turns`);
console.log(`# Kills: ${game.kills}, Klingons remaining: ${game.klingonsRemaining}`);
