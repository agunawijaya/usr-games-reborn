/**
 * Measures each hunter strength over many seeded deals: mean share of the board found and words
 * per round, per grid size. `tsx scripts/hunter-sim.ts [deals]`
 */
import { loadDictionary } from '../src/dictionary/load';
import { dealBoard } from '../src/engine/deal';
import type { GridSize } from '../src/engine/grid';
import { planHunt, STRENGTHS } from '../src/engine/hunter';

const print = (line: string) => process.stdout.write(`${line}\n`);
const SECONDS: Record<GridSize, number> = { 4: 180, 5: 240, 6: 300 };

async function main() {
  const trie = await loadDictionary();
  const deals = Number(process.argv[2] ?? 300);
  for (const size of [4, 5, 6] as GridSize[]) {
    const boards = Array.from({ length: deals }, (_, i) =>
      dealBoard(trie, { size, rule: 'classic', seed: `hunt-${size}-${i}`, minLetters: 3 }),
    );
    for (const strength of STRENGTHS) {
      let share = 0;
      let words = 0;
      let longest = 0;
      for (const [i, deal] of boards.entries()) {
        const finds = planHunt(deal.words, strength, SECONDS[size], `sim-${i}`);
        share += finds.length / deal.words.length;
        words += finds.length;
        longest += Math.max(0, ...finds.map((f) => f.word.length));
      }
      print(
        `${size}×${size} strength ${strength}: ${((100 * share) / deals).toFixed(1)} % of the board, ${(words / deals).toFixed(1)} words, longest ${(longest / deals).toFixed(1)}`,
      );
    }
  }
}

void main();
