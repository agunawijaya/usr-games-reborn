// A faithful port of the C library's random() — the TYPE_3 additive
// feedback generator shared by 4.3BSD and glibc (x[i] = x[i-3] + x[i-31],
// seeded by a Park–Miller LCG, the first 310 outputs discarded).
//
// rain.c never calls srandom() (rain.c:109-119), so the original always
// ran the default sequence, equivalent to srandom(1). With this port and
// seed 1 the engine replays exactly what the real binary drew
// (tests/capture.test.js checks the frames captured from it).
//
// State is a plain object, so it serialises with the rest of the engine.

const DEG = 31; // TYPE_3 degree
const SEP = 3; // TYPE_3 separation

export function createRandom(seed = 1) {
  const r = new Int32Array(DEG);
  let word = seed | 0;
  if (word === 0) word = 1;
  r[0] = word;
  for (let i = 1; i < DEG; i++) {
    // 16807 * word % 2147483647 without overflow (Schrage's method)
    const hi = Math.trunc(word / 127773);
    const lo = word % 127773;
    word = 16807 * lo - 2836 * hi;
    if (word < 0) word += 2147483647;
    r[i] = word;
  }
  const st = { r: Array.from(r), f: SEP, b: 0 };
  for (let k = 0; k < DEG * 10; k++) next(st);
  return st;
}

// One value in [0, 2^31 - 1], exactly as random() returns it.
export function next(st) {
  const v = (st.r[st.f] + st.r[st.b]) | 0; // 32-bit wrap-around add
  st.r[st.f] = v;
  const result = (v >>> 1) & 0x7fffffff;
  // advance both pointers; wrap whichever runs off the end of the table
  st.f++;
  st.b++;
  if (st.f >= DEG) st.f = 0;
  else if (st.b >= DEG) st.b = 0;
  return result;
}
