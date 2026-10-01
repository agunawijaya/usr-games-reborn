// A faithful JavaScript port of glibc's random() / srandom() (TYPE_3:
// additive feedback generator, degree 31, separation 3).
//
// The original worms.c never calls srandom(), so glibc behaves as if
// srandom(1) had been called. With the default seed of 1 this generator
// yields the exact sequence the original binary used on Linux
// (1804289383, 846930886, 1681692777, ...), which is what lets the port
// reproduce the original animation cell for cell.

const DEG = 31;
const SEP = 3;

export function createRandom(seed = 1) {
  const state = new Int32Array(DEG);
  let s = seed >>> 0;
  if (s === 0) s = 1;
  state[0] = s | 0;
  let word = s | 0; // int32_t in glibc: seeds above 2^31 go negative
  for (let i = 1; i < DEG; i++) {
    // Park-Miller "minimal standard" step via Schrage's method, as glibc does
    const hi = Math.trunc(word / 127773);
    const lo = word % 127773;
    word = 16807 * lo - 2836 * hi;
    if (word < 0) word += 2147483647;
    state[i] = word;
  }
  let f = SEP;
  let r = 0;

  function next() {
    const val = (state[f] + state[r]) >>> 0; // uint32 wrap-around add
    state[f] = val | 0;
    f++;
    r++;
    if (f >= DEG) f = 0;
    else if (r >= DEG) r = 0;
    return val >>> 1; // "chucking least random bit"
  }

  for (let i = 0; i < DEG * 10; i++) next(); // glibc discards 310 outputs

  return next;
}
