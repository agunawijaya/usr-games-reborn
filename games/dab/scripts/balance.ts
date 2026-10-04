import { createRng } from '@usr-games/kit';
import { chooseMove, OPPONENT_IDS, type OpponentId } from '../src/ai/opponents';
import { isFull, newBoard, type Player, play } from '../src/engine/board';

/**
 * The ladder's balance: each opponent against the one below it, on a 5 × 5 board, taking turns
 * to move first. `tsx scripts/balance.ts [games] [columns] [rows] [pair index]`.
 */
const games = Number(process.argv[2] ?? 1000);
const columns = Number(process.argv[3] ?? 5);
const rows = Number(process.argv[4] ?? columns);
const only = process.argv[5] === undefined ? null : Number(process.argv[5]);

interface Tally {
  wins: number;
  losses: number;
  ties: number;
  margin: number;
  slowestMs: number;
  thinkingMs: number;
  moves: number;
}

function match(stronger: OpponentId, weaker: OpponentId, index: number, tally: Tally) {
  const strongSide = (index % 2) as Player;
  const rng = createRng(`balance:${stronger}:${weaker}:${index}`);
  let board = newBoard({ columns, rows });
  let clock = 1_072_483_200 + index * 7919;
  while (!isFull(board)) {
    const id = board.toMove === strongSide ? stronger : weaker;
    const started = performance.now();
    const edge = chooseMove(id, board, { rng, clock: clock++ });
    const spent = performance.now() - started;
    if (id === stronger) {
      tally.thinkingMs += spent;
      tally.moves++;
      tally.slowestMs = Math.max(tally.slowestMs, spent);
    }
    board = play(board, edge).board;
  }
  const mine = board.scores[strongSide];
  const theirs = board.scores[strongSide === 0 ? 1 : 0];
  if (mine > theirs) tally.wins++;
  else if (mine < theirs) tally.losses++;
  else tally.ties++;
  tally.margin += mine - theirs;
}

const say = (line: string) => process.stdout.write(`${line}\n`);

say(`${games} games a pair on ${columns} × ${rows}, first move alternating\n`);
say(
  '| Opponent | Against | Wins | Losses | Ties | Win rate | Mean margin | Mean move | Slowest move |',
);
say('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (let i = 1; i < OPPONENT_IDS.length; i++) {
  if (only !== null && only !== i) continue;
  const stronger = OPPONENT_IDS[i]!;
  const weaker = OPPONENT_IDS[i - 1]!;
  const tally: Tally = {
    wins: 0,
    losses: 0,
    ties: 0,
    margin: 0,
    slowestMs: 0,
    thinkingMs: 0,
    moves: 0,
  };
  for (let g = 0; g < games; g++) match(stronger, weaker, g, tally);
  const rate = ((tally.wins + tally.ties / 2) / games) * 100;
  const margin = (tally.margin / games).toFixed(2);
  const mean = (tally.thinkingMs / tally.moves).toFixed(2);
  say(
    `| ${stronger} | ${weaker} | ${tally.wins} | ${tally.losses} | ${tally.ties} | ${rate.toFixed(1)} % | ${margin} | ${mean} ms | ${tally.slowestMs.toFixed(0)} ms |`,
  );
}
