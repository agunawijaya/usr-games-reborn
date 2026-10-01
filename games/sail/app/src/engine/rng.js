// Seeded, serialisable RNG (mulberry32).
//
// The original seeded random() from the clock (sail/main.c) and rolled a d6
// through `dieroll()` (sail/extern.h:49). Here the generator state is a
// plain { s } object stored inside the game state, so a battle is fully
// reproducible from (scenario, seed, orders) and survives JSON round-trips.

export function createRng(seed) {
  return { s: (seed >>> 0) || 0x9e3779b9 };
}

export function random(rng) {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// d6, 1..6 — the only distribution sail ever uses.
export function dieroll(rng) {
  return Math.floor(random(rng) * 6) + 1;
}
