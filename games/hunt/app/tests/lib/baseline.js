// Seeded replays for the Override regression: full matches (a fuzzing human
// plus mixed bots) whose state hash is recorded every 100 steps.
import * as H from '../../src/engine/hunt.js';
import { createMatch, tick } from '../../src/engine/match.js';
import { setOverride } from '../../src/engine/override.js';
import { stateHash, fuzzer } from './hash.js';

export const BASELINE_MATCHES = [
  { seed: 101, bots: 5, difficulty: 'mixed', mode: 'ffa', arena: 'ricochet', human: 'you', rejoinDelay: 12 },
  { seed: 202, bots: 7, difficulty: 'otto', mode: 'teams', arena: 'classic', human: 'you', rejoinDelay: 8 },
  { seed: 303, bots: 3, difficulty: 'sharp', mode: 'ffa', arena: 'veteran', human: 'you', rejoinDelay: 20 },
];

// flags: { key: true } applied from the start; `hook(g, t)` runs before each step.
export function chain(cfg, steps = 3000, { flags = {}, hook = null } = {}) {
  const g = createMatch(cfg);
  for (const [k, v] of Object.entries(flags)) setOverride(g, k, v);
  const fz = fuzzer(cfg.seed);
  const out = [];
  for (let t = 0; t < steps; t++) {
    if (hook) hook(g, t);
    const me = H.findPlayer(g, cfg.human);
    if (me && me.q.length < 2) {
      const k = fz();
      if (k) H.key(g, me, k);
    }
    tick(g);
    if (t % 100 === 99) out.push(stateHash(g));
  }
  return { g, hashes: out };
}
