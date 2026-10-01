// Random numbers, kept as plain numbers inside the game state so a state
// snapshot (JSON) resumes the exact same sequence.

// driver.c:50 — huntd's own generator, used for every daemon decision:
//   #define RN (((Seed = Seed * 11109 + 13849) >> 16) & 0xffff)
// Seed is a 32-bit int that wraps on overflow.
export function rn(g) {
  g.seed = (Math.imul(g.seed, 11109) + 13849) | 0;
  return (g.seed >> 16) & 0xffff;
}

// driver.c:830-835 — range 0 returns 0 without touching the seed.
export function randNum(g, range) {
  return range === 0 ? 0 : rn(g) % range;
}

// glibc random() (TYPE_3, degree 31, separation 3) — what otto.c's calls to
// random() return in the original client. The state is a plain object
// { s: int32[31], f, r } so it serialises with the game.
export function glibcSeed(seed) {
  const s = new Array(31);
  let word = (seed >>> 0) || 1;
  word |= 0;
  s[0] = word;
  for (let i = 1; i < 31; i++) {
    const hi = Math.trunc(word / 127773);
    const lo = word % 127773;
    word = 16807 * lo - 2836 * hi;
    if (word < 0) word += 2147483647;
    s[i] = word;
  }
  const st = { s, f: 3, r: 0 };
  for (let i = 0; i < 310; i++) glibcRandom(st);
  return st;
}

export function glibcRandom(st) {
  const val = (st.s[st.f] + st.s[st.r]) >>> 0;
  st.s[st.f] = val | 0;
  st.f++;
  st.r++;
  if (st.f >= 31) st.f = 0;
  else if (st.r >= 31) st.r = 0;
  return val >>> 1;
}
