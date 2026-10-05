/** Prints each tier's share of the core deck and the well-read player's mean misses in it. */
import { missesToSolve, playWellRead } from '../src/bots/solver';
import { ALL_DECKS, CORE_DECK } from '../src/decks/decks';
import { tierOf } from '../src/engine/difficulty';

const print = (line: string) =>
  process.stdout.write(`${line}
`);

const vocabulary = [...new Set(ALL_DECKS.flatMap((deck) => deck.words))];
for (const tier of ['easy', 'medium', 'hard'] as const) {
  const words = CORE_DECK.words.filter((word) => tierOf(word) === tier);
  const misses = words.map((word) => missesToSolve((w, a) => playWellRead(w, vocabulary, a), word));
  const mean = misses.reduce((a, b) => a + b, 0) / misses.length;
  print(
    `${tier}: ${words.length} words (${((words.length / CORE_DECK.words.length) * 100).toFixed(1)} %), well-read mean ${mean.toFixed(2)}, e.g. ${words.slice(0, 6).join(', ')}`,
  );
}
