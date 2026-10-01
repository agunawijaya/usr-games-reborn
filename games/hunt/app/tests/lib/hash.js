// A stable fingerprint of everything that makes up the simulation.
export function stateHash(g) {
  const core = {
    seed: g.seed, step: g.step, maze: g.maze, np: g.np, nplayer: g.nplayer,
    slots: g.slots.slice(0, g.np).map((p) => ({ ...p })),
    boots: g.boots, bullets: g.bullets.map((b) => ({ ...b, path: null })),
    expl: g.expl, removed: g.removed, remIndex: g.remIndex, volcano: g.volcano,
    scores: g.scores, joinq: g.joinq, bots: g.bots,
  };
  const s = JSON.stringify(core);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Deterministic "human": random keys from the whole command set.
export function fuzzer(seed) {
  let s = seed >>> 0;
  const keys = 'hjklhjklhjklHJKLffffgGFoOsc';
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    if ((s >>> 24) % 3) return null;
    return keys[(s >>> 8) % keys.length];
  };
}
