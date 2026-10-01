// glibc-compatible rand()/random() (TYPE_3 additive feedback generator).
//
// battlestar calls srand(getpid()) once (init.c) and then rand() % x
// everywhere through the rnd() macro (extern.h). Reproducing glibc's
// generator bit for bit lets a seeded game here replay a run of the real
// /usr/games/battlestar whose getpid() was pinned to the same number --
// that is how tests/golden.test.js compares transcripts byte for byte.
//
// Algorithm (glibc stdlib/random_r.c, TYPE_3, degree 31, separation 3):
//   r[0] = seed; r[i] = 16807 * r[i-1] mod (2^31 - 1)   for i = 1..30
//   r[i] = r[i-31]                                       for i = 31..33
//   r[i] = r[i-31] + r[i-3]  (mod 2^32)                  for i >= 34
//   the first 310 outputs are discarded; output = r[i] >>> 1.

export class GlibcRandom {
  constructor(seed = 1) {
    this.srand(seed);
  }

  srand(seed) {
    let s = seed | 0;
    if (s === 0) s = 1;
    const r = new Int32Array(34);
    r[0] = s;
    for (let i = 1; i < 31; i++) {
      // Schrage's method, exactly as glibc does it (keeps int32 semantics).
      const hi = Math.trunc(r[i - 1] / 127773);
      const lo = r[i - 1] % 127773;
      let word = 16807 * lo - 2836 * hi;
      if (word < 0) word += 2147483647;
      r[i] = word;
    }
    for (let i = 31; i < 34; i++) r[i] = r[i - 31];
    this.r = r;
    this.i = 0; // index of r[k-34] in the ring (the oldest slot)
    for (let k = 34; k < 344; k++) this._next();
  }

  _next() {
    // ring of 34: r[k] = r[k-31] + r[k-3]; slot k%34 holds r[k-34]
    const r = this.r;
    const k = this.i;
    const v = (r[(k + 3) % 34] + r[(k + 31) % 34]) | 0; // r[k-31] + r[k-3]
    r[k] = v;
    this.i = (k + 1) % 34;
    return v;
  }

  /** glibc rand(): 31-bit non-negative integer. */
  rand() {
    return this._next() >>> 1;
  }

  /** The rnd(x) macro from extern.h: rand() % x. */
  rnd(x) {
    return this.rand() % x;
  }

  /** Plain-JSON snapshot for save files. */
  snapshot() {
    return { r: Array.from(this.r), i: this.i };
  }

  static fromSnapshot(s) {
    const g = Object.create(GlibcRandom.prototype);
    g.r = Int32Array.from(s.r);
    g.i = s.i;
    return g;
  }
}
