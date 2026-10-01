// Headless arena stress: full matches of mixed bots (and a fuzzing human)
// for thousands of steps — no crashes, no stuck projectiles, sane state,
// and the same seed always replays to the same state, including across a
// JSON snapshot/restore in the middle.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { createMatch, tick } from '../src/engine/match.js';
import { stateHash, fuzzer } from './lib/hash.js';

const MOVING = new Set([K.SHOT, K.GRENADE, K.SATCHEL, K.BOMB]);

function play(cfg, steps, { check = false, snapshotAt = -1 } = {}) {
  let g = createMatch(cfg);
  const fz = fuzzer(cfg.seed);
  const stats = { deaths: 0, shots: 0, bounces: 0, maxBullets: 0, kinds: {} };
  for (let t = 0; t < steps; t++) {
    if (t === snapshotAt) g = H.restore(H.snapshot(g));
    const me = cfg.human ? H.findPlayer(g, cfg.human) : null;
    if (me && me.q.length < 2) {
      const k = fz();
      if (k) H.key(g, me, k);
    }
    const ev = tick(g);
    const bootLeft = new Set(ev.filter((e) => e.t === 'bootFly').map((e) => e.fy * K.WIDTH + e.fx));
    for (const e of ev) {
      if (e.t === 'death') stats.deaths++;
      if (e.t === 'fire') { stats.shots++; stats.kinds[e.type] = (stats.kinds[e.type] || 0) + 1; }
      if (e.t === 'bounce') stats.bounces++;
    }
    stats.maxBullets = Math.max(stats.maxBullets, g.bullets.length);
    if (!check) continue;
    // --- invariants
    assert.ok(g.np <= K.MAXPL && g.np >= 0);
    for (let i = 0; i < g.np; i++) {
      const p = g.slots[i];
      assert.ok(p.x >= 0 && p.x < K.WIDTH && p.y >= 0 && p.y < K.HEIGHT, 'player in bounds');
      const c = g.maze[p.y * K.WIDTH + p.x];
      // Daemon quirk (docs/notes.md): a boot flying off a cell restores the
      // space it was thrown onto, over a player who stepped in meanwhile.
      const quirk = c === K.SPACE && bootLeft.has(p.y * K.WIDTH + p.x);
      assert.ok(c === p.face || K.isWallChar(c) || quirk, `step ${g.step}: the maze shows ${p.face} where it stands`);
      assert.equal(p.death, '', 'the dead were zapped');
    }
    for (let x = 0; x < K.WIDTH; x++) {
      assert.ok(K.isWallChar(g.maze[x]) || g.maze[x] === K.FLYER, 'top border intact');
    }
    const moved = new Set(g.trails.map((tr) => tr.id));
    for (const b of g.bullets) {
      assert.ok(b.x >= 0 && b.x < K.WIDTH && b.y >= 0 && b.y < K.HEIGHT, 'bullet in bounds');
      if (MOVING.has(b.type) && !b.expl) assert.ok(moved.has(b.id), `step ${g.step}: a live shot moved`);
      if (b.type === K.SLIME || b.type === K.LAVA) assert.ok(b.charge > 0, 'slime left has charge');
    }
    assert.ok(g.bullets.length < 3000, 'bullets do not pile up');
  }
  return { g, stats };
}

const CONFIGS = [
  { seed: 1, bots: 8, difficulty: 'mixed', mode: 'ffa', arena: 'classic', human: 'you', rejoinDelay: 0 },
  { seed: 2, bots: 8, difficulty: 'otto', mode: 'teams', arena: 'veteran', human: 'you', rejoinDelay: 5 },
  { seed: 3, bots: 6, difficulty: 'sharp', mode: 'ffa', arena: 'ricochet', human: null, rejoinDelay: 10 },
  { seed: 4, bots: 8, difficulty: 'novice', mode: 'teams', arena: 'ricochet', human: 'you', rejoinDelay: 20 },
];

for (const cfg of CONFIGS) {
  test(`stress: ${cfg.bots} ${cfg.difficulty} bots, ${cfg.mode}, ${cfg.arena} arena — 5000 steps, invariants hold`, () => {
    const { stats } = play(cfg, 5000, { check: true });
    assert.ok(stats.deaths > 10, `a real fight happened (${stats.deaths} deaths, ${stats.shots} shots)`);
    assert.ok(stats.shots > 50);
    if (cfg.arena === 'ricochet') assert.ok(stats.bounces > 10, `ricochets: ${stats.bounces}`);
  });
}

test('determinism: the same seed replays to the same state, through a JSON snapshot too', () => {
  for (const cfg of CONFIGS) {
    const a = play(cfg, 2000).g;
    const b = play(cfg, 2000).g;
    const c = play(cfg, 2000, { snapshotAt: 1000 }).g;
    assert.equal(stateHash(a), stateHash(b), `seed ${cfg.seed}: same run twice`);
    assert.equal(stateHash(a), stateHash(c), `seed ${cfg.seed}: snapshot/restore at step 1000`);
  }
});

test('different seeds give different matches', () => {
  const a = play({ ...CONFIGS[0], seed: 10 }, 300).g;
  const b = play({ ...CONFIGS[0], seed: 11 }, 300).g;
  assert.notEqual(stateHash(a), stateHash(b));
});
