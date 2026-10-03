import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { match } from './match';
import { type Opponent, opponentById, OPPONENTS, type OpponentId } from './opponents';

/**
 * The ladder's balance: each opponent against a yardstick, a mid-strength player that is not on
 * the ladder (the 1994 search two frames deep, with an occasional slip), as many games moving
 * first as second. The full run (GOMOKU_BALANCE=<file>) writes the table recorded in NOTES.md;
 * the everyday run checks the ends of the curve with a few games.
 */

const YARDSTICK: Opponent = {
  ...opponentById('heron'),
  name: 'Yardstick',
  play: { ...opponentById('heron').play, maxDepth: 2, slip: 0.08, blindToThree: 0.1 },
};

function score(id: OpponentId, games: number, label: string) {
  let wins = 0;
  let draws = 0;
  for (let i = 0; i < games; i++) {
    const first = i % 2 === 0;
    const game = match(first ? id : YARDSTICK, first ? YARDSTICK : id, `${label}:${id}:${i}`);
    const mine = first ? 'black' : 'white';
    if (game.winner === mine) wins++;
    else if (game.draw) draws++;
  }
  return { wins, draws, games };
}

const output = process.env.GOMOKU_BALANCE;

describe('the ladder against the yardstick', () => {
  it.skipIf(!output)(
    'records the curve',
    () => {
      const games = Number(process.env.GOMOKU_BALANCE_GAMES ?? 24);
      const lines = OPPONENTS.map((o) => {
        const r = score(o.id, games, 'curve');
        return `${o.name}: ${r.wins} won, ${r.draws} drawn, of ${r.games} (${Math.round((100 * (r.wins + r.draws / 2)) / r.games)} %)`;
      });
      writeFileSync(output!, `${lines.join('\n')}\n`);
    },
    7_200_000,
  );

  it('has Pebble well below Koi', () => {
    const pebble = score('pebble', 6, 'quick');
    const koi = score('koi', 6, 'quick');
    expect(pebble.wins).toBeLessThan(koi.wins);
  }, 300_000);
});
