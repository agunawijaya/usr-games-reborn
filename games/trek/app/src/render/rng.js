// trek/procedural-web — deterministic randomness for *visuals only*.
//
// The game engine owns its own RNG (galaxy.js makeRng). Visual variety must
// never draw from it, or rendering would change the game. Everything here
// is seeded from stable inputs (quadrant coordinates, ship ids, classes).

/** Mulberry32 — small, fast, good enough for procedural art. */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit integer hash of any number of integers (xxhash-style mixing). */
export function hashInts(...xs) {
  let h = 0x9E3779B9 | 0;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x85EBCA6B);
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 0xC2B2AE35);
    h = (h ^ (h >>> 16)) | 0;
  }
  return h >>> 0;
}

/** Stable string hash (FNV-1a) — for ids like "K34-1". */
export function hashString(str) {
  let h = 0x811C9DC5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seed for everything that makes quadrant (qx, qy) look the way it does. */
export function quadrantSeed(qx, qy) {
  return hashInts(qx + 101, qy + 211, 0x7E4E);
}

export const rrange = (rand, lo, hi) => lo + (hi - lo) * rand();
export const rpick = (rand, arr) => arr[Math.floor(rand() * arr.length) % arr.length];

/** Shared RNG for transient effects (sparks, debris, jitter). Seeded so a
 *  replayed command sequence produces the same pictures — useful for the
 *  comparison screenshots — while never touching the engine's RNG. */
export const fxRand = mulberry32(0xC0FFEE);
