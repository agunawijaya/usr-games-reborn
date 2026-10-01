/**
 * The rival ladder over many Long Nights: `tsx scripts/sim-rivals.ts [nights]`. The medians
 * are recorded in docs/NOTES.md; rivals.test.ts locks the order.
 */
import { createGlasses } from '../src/rivals/glasses';
import { createMochi } from '../src/rivals/mochi';
import { createPip } from '../src/rivals/pip';
import { createProfessor } from '../src/rivals/professor';
import { playNight } from '../src/rivals/run';

const runs = Number(process.argv[2] ?? 40);
const rivals = {
  mochi: createMochi,
  pip: createPip,
  professor: createProfessor,
  glasses: createGlasses,
};
const median = (xs: number[]) => xs[Math.floor(xs.length / 2)];
for (const [name, make] of Object.entries(rivals)) {
  const started = performance.now();
  const results = Array.from({ length: runs }, (_, i) => playNight(`sim-${i}`, make()));
  const scores = results.map((r) => r.score).sort((a, b) => a - b);
  const waves = results.map((r) => r.wavesCleared).sort((a, b) => a - b);
  const ms = Math.round(performance.now() - started);
  process.stdout.write(
    `${name.padEnd(10)} score median ${median(scores)} (min ${scores[0]}, max ${scores.at(-1)}) · waves median ${median(waves)}, max ${waves.at(-1)} · ${ms} ms\n`,
  );
}
