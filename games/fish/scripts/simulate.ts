import { createRng } from '@usr-games/kit';
import { shuffledDeck } from '@usr-games/kit/cards';
import { diceFrom } from '../src/engine/chance';
import type { GameEvent } from '../src/engine/events';
import { createMind, type MindName } from '../src/engine/minds';
import type { RuleSetId } from '../src/engine/rules';
import { Table } from '../src/engine/table';

/**
 * Balance runs for docs/NOTES.md: `pnpm --filter @usr-games/game-fish simulate [games]`.
 * Seat 0 stands in for the player; its mind is the skill being modelled. Every run is seeded,
 * so the numbers in NOTES.md come back exactly.
 */

const GAMES = Number(process.argv[2] ?? 4000);
const out = (line = '') => process.stdout.write(`${line}\n`);
const pct = (n: number, of: number) => `${((100 * n) / of).toFixed(1)} %`;

interface Tally {
  games: number;
  wins: number;
  draws: number;
  books: number;
  asks: number;
  ownAsks: number;
  ownCasts: number;
  aiAsks: number;
  luckyThree: number;
  threeInTurn: number;
  goldenGames: number;
  maxAsks: number;
}

function emptyTally(): Tally {
  return {
    games: 0,
    wins: 0,
    draws: 0,
    books: 0,
    asks: 0,
    ownAsks: 0,
    ownCasts: 0,
    aiAsks: 0,
    luckyThree: 0,
    threeInTurn: 0,
    goldenGames: 0,
    maxAsks: 0,
  };
}

function play(seed: string, rules: RuleSetId, lineup: readonly MindName[]): GameEvent[] {
  const rng = createRng(seed);
  const table = new Table({
    rules,
    minds: lineup.map((name, seat) => createMind(name, seat)),
    deck: shuffledDeck(rng.split('deck')),
    dice: diceFrom(rng),
    mindChance: (seat) => {
      const stream = rng.split(`mind/${seat}`);
      return { below: (n) => stream.int(0, n - 1) };
    },
  });
  table.runComputers();
  return table.log;
}

/** Seat 0's view of a finished game, added to a tally. */
function record(tally: Tally, log: readonly GameEvent[]): void {
  tally.games++;
  let asks = 0;
  let lucky = 0;
  let booksThisTurn = 0;
  let threeInTurn = false;
  let golden = false;
  for (const event of log) {
    if (event.kind === 'ask') {
      asks++;
      if (event.asker === 0) tally.ownAsks++;
      else tally.aiAsks++;
    }
    if (event.kind === 'draw' && event.seat === 0 && event.why === 'fish') {
      tally.ownCasts++;
      if (event.lucky) lucky++;
    }
    if (event.kind === 'turn') booksThisTurn = 0;
    if (event.kind === 'book' && event.seat === 0) {
      booksThisTurn++;
      if (booksThisTurn >= 3) threeInTurn = true;
      if (event.golden) golden = true;
    }
    if (event.kind === 'end') {
      tally.books += event.books[0]!;
      if (event.winners.includes(0)) {
        if (event.winners.length === 1) tally.wins++;
        else tally.draws++;
      }
    }
  }
  tally.asks += asks;
  tally.maxAsks = Math.max(tally.maxAsks, asks);
  if (lucky >= 3) tally.luckyThree++;
  if (threeInTurn) tally.threeInTurn++;
  if (golden) tally.goldenGames++;
}

function run(label: string, rules: RuleSetId, lineup: readonly MindName[], games = GAMES): Tally {
  const tally = emptyTally();
  for (let i = 0; i < games; i++) record(tally, play(`${label}/${i}`, rules, lineup));
  return tally;
}

function winLine(tally: Tally): string {
  return `win ${pct(tally.wins, tally.games)} · tie ${pct(tally.draws, tally.games)} · books ${(tally.books / tally.games).toFixed(2)}`;
}

/**
 * Minutes a game takes at the table: the player thinks about 3 s an ask; an ask the table
 * answers plays for about 1.4 s; a cast and reel about 2.2 s; the end lap and results 8 s.
 */
function minutes(tally: Tally): number {
  const ownAnswered = tally.ownAsks - tally.ownCasts;
  const seconds =
    tally.ownAsks * 3 +
    ownAnswered * 1.4 +
    tally.ownCasts * 2.2 +
    tally.aiAsks * 1.4 +
    8 * tally.games;
  return seconds / tally.games / 60;
}

const MINDS: MindName[] = ['otto', 'hazel', 'miso'];

out(`# Gone Fishing balance runs, ${GAMES} games a line`);
out();
out(
  '## Each rival against the reference bot (seat 0 is the reference; the rival wins what it loses)',
);
for (const rules of ['standard', 'all-books', 'classic'] as const) {
  for (const mind of MINDS) {
    const tally = run(`ref/${rules}/${mind}`, rules, ['reference', mind]);
    const rivalWins = tally.games - tally.wins - tally.draws;
    out(
      `- ${rules.padEnd(9)} ${mind.padEnd(5)} beats the reference ${pct(rivalWins, tally.games)} · ties ${pct(tally.draws, tally.games)}`,
    );
  }
}

out();
out('## Rival against rival, Standard (row is seat 0)');
for (const a of MINDS) {
  const cells = MINDS.map((b) => {
    const tally = run(`duel/${a}/${b}`, 'standard', [a, b]);
    return `${b} ${pct(tally.wins, tally.games)}`;
  });
  out(`- ${a.padEnd(5)} vs ${cells.join(' · ')}`);
}

out();
const ROUNDS: { name: string; rivals: MindName[] }[] = [
  { name: 'Otto', rivals: ['otto'] },
  { name: 'Hazel', rivals: ['hazel'] },
  { name: 'Miso', rivals: ['miso'] },
  { name: 'Otto and Hazel', rivals: ['otto', 'hazel'] },
  { name: 'Otto and Miso', rivals: ['otto', 'miso'] },
  { name: 'Hazel and Miso', rivals: ['hazel', 'miso'] },
  { name: 'Otto, Hazel and Miso', rivals: ['otto', 'hazel', 'miso'] },
];
for (const rules of ['standard', 'all-books'] as const) {
  out(`## Tournament curve: the player modelled at four levels of memory (${rules})`);
  for (const player of ['reference', 'otto', 'hazel', 'miso'] as const) {
    const cells = ROUNDS.map((round) => {
      const tally = run(`tour/${rules}/${player}/${round.name}`, rules, [player, ...round.rivals]);
      return `${round.name} ${pct(tally.wins, tally.games)}`;
    });
    out(`- player as ${player.padEnd(9)} ${cells.join(' · ')}`);
  }
  out();
}

out('## Game length and moments (player modelled as hazel)');
for (const rules of ['standard', 'all-books'] as const) {
  for (const rivals of [['otto'], ['hazel', 'miso'], ['otto', 'hazel', 'miso']] as MindName[][]) {
    const tally = run(`len/${rules}/${rivals.join('+')}`, rules, ['hazel', ...rivals]);
    out(
      `- ${rules.padEnd(9)} vs ${rivals.join('+').padEnd(16)} asks ${(tally.asks / tally.games).toFixed(1)} (max ${tally.maxAsks}) · player's casts ${(tally.ownCasts / tally.games).toFixed(1)} · ~${minutes(tally).toFixed(1)} min · ${winLine(tally)}`,
    );
    out(
      `  lucky cast ×3 ${pct(tally.luckyThree, tally.games)} · three books in a turn ${pct(tally.threeInTurn, tally.games)} · a golden fish ${pct(tally.goldenGames, tally.games)}`,
    );
  }
}

out();
out('## Daily Pond: All 13 books, the player against all three rivals');
for (const player of ['reference', 'hazel', 'miso'] as const) {
  const histogram = new Array<number>(14).fill(0);
  let wins = 0;
  for (let i = 0; i < GAMES; i++) {
    const log = play(`daily/${player}/${i}`, 'all-books', [player, 'otto', 'hazel', 'miso']);
    const end = log.at(-1)!;
    if (end.kind !== 'end') continue;
    histogram[end.books[0]!]!++;
    if (end.winners.length === 1 && end.winners[0] === 0) wins++;
  }
  const mean = histogram.reduce((sum, n, books) => sum + n * books, 0) / GAMES;
  out(
    `- player as ${player.padEnd(9)} books ${mean.toFixed(2)} on average · outright win ${pct(wins, GAMES)} · 0–13: ${histogram.join(' ')}`,
  );
}
