/**
 * Times the solver on random boards of every size and rule (the prompt asks for a 6×6 board
 * in under 100 ms). `tsx scripts/bench-solver.ts [boards]`
 */
import { createRng } from '@usr-games/kit';
import { loadDictionary } from '../src/dictionary/load';
import { type GridSize, RULES } from '../src/engine/grid';
import { solveBoard } from '../src/engine/solver';

/** Scripts report to the terminal; the lint rule keeps console logging out of game code. */
const print = (line: string) => process.stdout.write(`${line}\n`);

const LETTERS = 'eeeeeeaaaaiiiioooonnnrrrttttsssllcdduupmghbyfvkwxzjq';

async function main() {
  const t0 = performance.now();
  const trie = await loadDictionary();
  print(
    `dictionary: ${trie.words} words, ${trie.nodes} nodes, ${(performance.now() - t0).toFixed(0)} ms`,
  );
  const boards = Number(process.argv[2] ?? 200);
  const rng = createRng('bench');
  for (const size of [4, 5, 6] as GridSize[]) {
    for (const rule of RULES) {
      let worst = 0;
      let total = 0;
      let words = 0;
      for (let i = 0; i < boards; i++) {
        const faces = Array.from({ length: size * size }, () => {
          const letter = rng.pick([...LETTERS]);
          return letter === 'q' ? 'qu' : letter;
        });
        const start = performance.now();
        words += solveBoard({ size, faces }, trie, { rule, minLetters: 3 }).length;
        const took = performance.now() - start;
        total += took;
        worst = Math.max(worst, took);
      }
      print(
        `${size}×${size} ${rule}: mean ${(total / boards).toFixed(2)} ms, worst ${worst.toFixed(1)} ms, ${(words / boards).toFixed(0)} words`,
      );
    }
  }
}

void main();
