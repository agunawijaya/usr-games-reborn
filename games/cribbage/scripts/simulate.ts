/**
 * Balance report: the three opponents against each other over many seeded games to 121, seats
 * swapped every game so neither side keeps the first crib. Prints win rates with a 95 %
 * interval, average margins, skunks and pegging/show points per hand.
 * `pnpm --filter @usr-games/game-cribbage simulate [games] [length]`
 */
import { type Level, MINDS } from '../src/engine/ai/minds';
import { playGame } from '../src/engine/autoplay';
import type { GameLength } from '../src/engine/match';

export interface PairingResult {
  first: Level;
  second: Level;
  games: number;
  firstWins: number;
  skunks: number;
  hands: number;
  peggedPerHand: [number, number];
  shownPerHand: [number, number];
  milliseconds: number;
}

export function simulatePairing(
  first: Level,
  second: Level,
  games: number,
  length: GameLength = 121,
  seedPrefix = 'balance',
): PairingResult {
  const started = performance.now();
  let firstWins = 0;
  let skunks = 0;
  let hands = 0;
  const pegged: [number, number] = [0, 0];
  const shown: [number, number] = [0, 0];
  for (let i = 0; i < games; i++) {
    // Even games put `first` in seat 0, odd games in seat 1.
    const swap = i % 2 === 1;
    const minds = swap
      ? ([MINDS[second], MINDS[first]] as const)
      : ([MINDS[first], MINDS[second]] as const);
    const game = playGame(
      { length, counting: 'automatic' },
      `${seedPrefix}:${first}-${second}:${i}`,
      [minds[0], minds[1]],
    );
    const firstSeat = swap ? 1 : 0;
    if (game.state.winner === firstSeat) firstWins++;
    hands += game.hands;
    for (const event of game.events) {
      if (event.type === 'game-over' && event.skunk !== 'none') skunks++;
      if (event.type !== 'scored') continue;
      const side = event.seat === firstSeat ? 0 : 1;
      if (event.reason === 'play' || event.reason === 'go' || event.reason === 'last-card') {
        pegged[side] += event.points;
      } else if (event.reason === 'hand' || event.reason === 'crib') {
        shown[side] += event.points;
      }
    }
  }
  return {
    first,
    second,
    games,
    firstWins,
    skunks,
    hands,
    peggedPerHand: [pegged[0] / hands, pegged[1] / hands],
    shownPerHand: [shown[0] / hands, shown[1] / hands],
    milliseconds: performance.now() - started,
  };
}

const out = (line = '') => process.stdout.write(`${line}\n`);

function interval(wins: number, games: number): string {
  const p = wins / games;
  const half = 1.96 * Math.sqrt((p * (1 - p)) / games);
  return `${(p * 100).toFixed(1)} % ± ${(half * 100).toFixed(1)}`;
}

function main(): void {
  const games = Number(process.argv[2] ?? 2000);
  const length = Number(process.argv[3] ?? 121) as GameLength;
  const pairings: [Level, Level][] = [
    ['classic', 'beginner'],
    ['sharp', 'classic'],
    ['sharp', 'beginner'],
  ];
  out(`Fifteen-Two balance: ${games} games to ${length} per pairing, seats alternating\n`);
  for (const [first, second] of pairings) {
    const result = simulatePairing(first, second, games, length);
    out(
      `${first} vs ${second}: ${first} wins ${interval(result.firstWins, games)}` +
        ` · skunks ${result.skunks} · ${(result.hands / games).toFixed(1)} hands a game` +
        ` · pegging ${result.peggedPerHand.map((x) => x.toFixed(2)).join(' / ')}` +
        ` · show ${result.shownPerHand.map((x) => x.toFixed(2)).join(' / ')} a hand` +
        ` · ${(result.milliseconds / 1000).toFixed(1)} s`,
    );
  }
}

if (process.argv[1]?.endsWith('simulate.ts')) main();
