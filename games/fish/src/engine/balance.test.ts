import { createRng } from '@usr-games/kit';
import { shuffledDeck } from '@usr-games/kit/cards';
import { describe, expect, it } from 'vitest';
import { diceFrom } from './chance';
import { createMind, type MindName } from './minds';
import type { RuleSetId } from './rules';
import { Table } from './table';

/**
 * The rivals' order of strength, locked: Otto < Hazel < Miso in head-to-head Standard games, as
 * measured in docs/NOTES.md (3 000 games a line there; 800 here, on fixed seeds, with bands
 * wide enough for honest tuning and narrow enough to catch a mind that has broken).
 */

function duel(first: MindName, second: MindName, games: number, rules: RuleSetId = 'standard') {
  let firstWins = 0;
  let secondWins = 0;
  for (let i = 0; i < games; i++) {
    const rng = createRng(`balance/${first}/${second}/${i}`);
    const table = new Table({
      rules,
      minds: [createMind(first, 0), createMind(second, 1)],
      deck: shuffledDeck(rng.split('deck')),
      dice: diceFrom(rng),
      mindChance: (seat) => {
        const stream = rng.split(`mind/${seat}`);
        return { below: (n) => stream.int(0, n - 1) };
      },
    });
    table.runComputers();
    const end = table.log.at(-1)!;
    if (end.kind !== 'end' || end.winners.length !== 1) continue;
    if (end.winners[0] === 0) firstWins++;
    else secondWins++;
  }
  return { first: firstWins / games, second: secondWins / games };
}

describe('the rivals grow smarter: Otto, then Hazel, then Miso', () => {
  it('Hazel beats Otto', () => {
    const result = duel('hazel', 'otto', 800);
    expect(result.first).toBeGreaterThan(result.second + 0.1);
    expect(result.first).toBeGreaterThan(0.46);
    expect(result.first).toBeLessThan(0.58);
  });

  it('Miso beats Otto by more', () => {
    const result = duel('miso', 'otto', 800);
    expect(result.first).toBeGreaterThan(result.second + 0.2);
    expect(result.first).toBeGreaterThan(0.52);
    expect(result.first).toBeLessThan(0.65);
  });

  it('Miso beats Hazel', () => {
    const result = duel('miso', 'hazel', 800);
    expect(result.first).toBeGreaterThan(result.second + 0.02);
    expect(result.first).toBeGreaterThan(0.39);
    expect(result.first).toBeLessThan(0.51);
  });

  it('every rival beats a player with no memory at all', () => {
    for (const mind of ['otto', 'hazel', 'miso'] as const) {
      const result = duel('reference', mind, 600);
      expect(result.second, mind).toBeGreaterThan(result.first + 0.2);
    }
  });
});
