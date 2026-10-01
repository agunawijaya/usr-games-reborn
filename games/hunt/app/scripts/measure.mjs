#!/usr/bin/env node
// Reproduces the engine, arena and bot measurements in docs/notes.md §7.
//   node scripts/measure.mjs            (all three tables, ~1-2 minutes)
//   node scripts/measure.mjs engine|arenas|bots
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { createMatch, tick } from '../src/engine/match.js';
import { trajectory } from '../src/engine/trajectory.js';
import { addBot } from '../src/bots/index.js';

const which = process.argv[2] || 'all';

if (which === 'all' || which === 'engine') {
  console.log('\nEngine: steps per second, 8 bots, 20,000 steps');
  for (const [diff, arena] of [['otto', 'classic'], ['mixed', 'ricochet'], ['sharp', 'ricochet']]) {
    const g = createMatch({ seed: 9, bots: 8, difficulty: diff, arena, human: null, rejoinDelay: 10 });
    const t0 = performance.now();
    for (let i = 0; i < 20000; i++) tick(g);
    const s = (performance.now() - t0) / 1000;
    console.log(`  ${diff.padEnd(6)} ${arena.padEnd(9)} ${Math.round(20000 / s)} steps/s`);
  }
}

if (which === 'all' || which === 'arenas') {
  console.log('\nArenas: every free cell x 4 facings x 20 seeds');
  for (const arena of ['classic', 'veteran', 'ricochet']) {
    const hist = {};
    let mirrors = 0;
    let free = 0;
    let open = 0;
    let longest = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = H.newGame({ seed, arena });
      H.initArena(g);
      const T = (y, x) => g.maze[y * K.WIDTH + x];
      const empty = (c) => c === K.SPACE || c === K.BOOT_PAIR;
      for (let y = 1; y < K.HEIGHT - 1; y++) {
        for (let x = 1; x < K.WIDTH - 1; x++) {
          const c = T(y, x);
          if (empty(c)) open++;
          if (c === K.WALL4 || c === K.WALL5) {
            mirrors++;
            if ([T(y - 1, x), T(y + 1, x), T(y, x - 1), T(y, x + 1)].every(empty)) free++;
          }
          if (c !== K.SPACE) continue;
          for (const f of K.FACES) {
            const b = trajectory(T, x, y, f, { maxCells: 400, maxBounces: 40 }).bounces.length;
            hist[b] = (hist[b] || 0) + 1;
            longest = Math.max(longest, b);
          }
        }
      }
    }
    const total = Object.values(hist).reduce((a, b) => a + b, 0);
    const two = Object.entries(hist).filter(([k]) => +k >= 2).reduce((a, [, v]) => a + v, 0);
    console.log(`  ${arena.padEnd(9)} mirrors/maze ${(mirrors / 20).toFixed(1)}  in open space ${mirrors ? Math.round(100 * free / mirrors) + '%' : '-'}  >=2 bounces ${(100 * two / total).toFixed(2)}%  longest ${longest}  open cells ${Math.round(open / 20)}`);
  }
}

if (which === 'all' || which === 'bots') {
  console.log('\nBots: kills in 10 duels of 3,000 steps (seeds 1-10)');
  const duel = (a, b, seed, arena) => {
    const g = createMatch({ seed, bots: 0, human: null, arena, rejoinDelay: 10 });
    H.connect(g, 'A');
    addBot(g, 'A', a, seed * 3 + 1);
    H.connect(g, 'B');
    addBot(g, 'B', b, seed * 5 + 2);
    for (let t = 0; t < 3000; t++) tick(g);
    const s = Object.fromEntries(g.scores.map((x) => [x.name, x.gkills]));
    return [s.A, s.B];
  };
  for (const [a, b] of [['otto', 'novice'], ['sharp', 'otto'], ['sharp', 'novice']]) {
    const row = [];
    for (const arena of ['classic', 'ricochet']) {
      let A = 0;
      let B = 0;
      for (let s = 1; s <= 10; s++) {
        const [x, y] = duel(a, b, s, arena);
        A += x;
        B += y;
      }
      row.push(`${arena} ${A}-${B}`);
    }
    console.log(`  ${a} vs ${b}: ${row.join('   ')}`);
  }
}
