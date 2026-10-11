/**
 * Lists seeds whose boards make good showcases (hero frames, the poster, the attract loop): a
 * long, familiar word and plenty of words around it. `tsx scripts/find-showcase.ts [count]`
 */
import { loadDictionary } from '../src/dictionary/load';
import { dealBoard } from '../src/engine/deal';
import { faceLabel } from '../src/engine/grid';

/** Scripts report to the terminal; the lint rule keeps console logging out of game code. */
const print = (line: string) => process.stdout.write(`${line}\n`);

async function main() {
  const trie = await loadDictionary();
  const count = Number(process.argv[2] ?? 400);
  const picks: string[] = [];
  for (let i = 0; i < count; i++) {
    const seed = `showcase-${i}`;
    const deal = dealBoard(trie, { size: 4, rule: 'classic', seed, minLetters: 3 });
    const long = deal.words.filter((w) => w.word.length >= 8 && w.tier <= 1);
    if (long.length === 0 || deal.words.length < 90) continue;
    picks.push(
      `${seed}: ${deal.words.length} words; ${long.map((w) => w.word).join(', ')} | ${deal.roll.board.faces.map(faceLabel).join('')}`,
    );
  }
  print(picks.join('\n'));
}

void main();
