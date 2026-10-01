#!/usr/bin/env node
// Writes the generated golden scenarios (tests/golden/scenarios/04-*.hunt …).
// The hand-written ones (01-03) are edited directly. After changing this
// file: node scripts/oracle/make-scenarios.mjs && node scripts/oracle/capture.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../tests/golden/scenarios');
const W = 51;
const H = 23;

// Deterministic chooser, independent of the engine's own generator.
function lcg(seed) {
  let s = seed >>> 0;
  return (n) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 8) % n;
  };
}

function openArena(cells) {
  const g = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      if ((y === 0 || y === H - 1) && (x === 0 || x === W - 1)) row += '+';
      else if (y === 0 || y === H - 1) row += '-';
      else if (x === 0 || x === W - 1) row += '|';
      else row += ' ';
    }
    g.push(row.split(''));
  }
  for (const [y, x, c] of cells) g[y][x] = c;
  return g.map((r) => r.join(''));
}

// 04: every heading into both mirror kinds, a four-bounce loop (each mirror
// flips / <-> \ after a hit, so the second lap takes another path), a door,
// shots meeting shots, and a slime bounced off a mirror.
{
  const maze = openArena([
    [5, 10, '\\'], [15, 10, '\\'], [15, 30, '/'], [5, 30, '/'],
    [10, 40, '/'], [10, 45, '\\'], [19, 20, '#'], [3, 44, '/'], [18, 44, '\\'],
    [12, 20, '+'], [12, 21, '-'], [12, 22, '+'], [8, 24, '|'],
  ]);
  const s = [
    '# Crafted open arena: mirrors, a door, walls; shots in every direction.',
    'seed 4242',
    'maze', ...maze,
    'join east - c', 'join south - c', 'join west - c', 'join north - c', 'join dummy - c',
    'place east 5 2 >', 'place south 7 40 v', 'place west 10 48 <', 'place north 20 44 ^', 'place dummy 20 2 ^',
    'set east ammo 300', 'set south ammo 300', 'set west ammo 300', 'set north ammo 300',
    'full',
    'key east f', 'key south f', 'key west f', 'key north f',
    'fullstep 18',
    'key east jf', 'key south lf', 'key west kf', 'key north hf',
    'fullstep 18',
    'key east kgjg', 'key west LfHf', 'key north Kf',
    'step 30',
    'key south LlffhJf', 'key east jjjjjjjjjjjjjjlllllllllllllllllf',
    'step 60',
    'key west hhhhhhhhhhhhhhhhhhhhhhhhhhhoKOfkkf',
    'step 50',
  ];
  writeFileSync(join(dir, '04-mirrors-doors.hunt'), s.join('\n') + '\n');
}

// 05/06: keystroke fuzz on real mazes. Every step each player types 0-1 key
// from the whole command set; dead players re-enter; ammo is topped up now
// and then so the big bombs and slimes get thrown.
function fuzz(file, seed, names, teams, steps, keyset, ammoEvery) {
  const r = lcg(seed);
  const s = [`# Keystroke fuzz: ${names.length} players, ${steps} steps.`, `seed ${seed}`, 'init'];
  names.forEach((n, i) => s.push(`join ${n} ${teams[i]} ${'csf'[r(3)]}`));
  for (let t = 0; t < steps; t++) {
    names.forEach((n, i) => s.push(`ensure ${n} ${teams[i]} ${'cccsf'[r(5)]}`));
    if (ammoEvery && t % ammoEvery === 0) names.forEach((n) => s.push(`set ${n} ammo ${10 + r(300)}`));
    names.forEach((n) => {
      if (r(5)) s.push(`key ${n} ${keyset[r(keyset.length)]}`);
    });
    s.push(t % 50 === 49 ? 'fullstep' : 'step');
  }
  writeFileSync(join(dir, file), s.join('\n') + '\n');
}

const MOVES = 'hjklhjklhjklhjklHJKLHJKL';
fuzz('05-fuzz-ffa.hunt', 5150, ['ann', 'bea', 'cal', 'dan'], ['-', '-', '-', '-'], 1200,
  MOVES + 'fffffff1gg2FG34ooOpPsc56', 40);
fuzz('06-fuzz-teams.hunt', 606, ['r1', 'r2', 'r3', 'b1', 'b2', 'b3'], ['1', '1', '1', '2', '2', '2'], 1200,
  MOVES + 'fffffff1gg2FG4ooOsc7890@', 25);

// 07: a long hot-seat against otto: humans typing fuzz while two ottos play.
{
  const r = lcg(77);
  const s = ['# Two humans (fuzz) and two Classic Ottos, 1000 steps.', 'seed 777', 'init',
    'join h1 - c', 'join h2 3 s', 'join o1 - c', 'join o2 3 c', 'bot o1 11', 'bot o2 12', 'autorejoin 1'];
  for (let t = 0; t < 1000; t++) {
    s.push('ensure h1 - c', 'ensure h2 3 s');
    for (const n of ['h1', 'h2']) if (r(3)) s.push(`key ${n} ${(MOVES + 'fffgFos')[r(31)]}`);
    s.push('step');
  }
  writeFileSync(join(dir, '07-humans-vs-otto.hunt'), s.join('\n') + '\n');
}
console.log('scenarios written');
