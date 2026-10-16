import { BOARD_IDS } from '../src/boards/themes';
import { ECONOMY_PARAMS } from '../src/engine/economy';
import type { PersonalityId } from '../src/engine/rivals';
import { CLASSIC_LONG_STOP, makeRules, quickRounds } from '../src/engine/rules';
import { simulate, type SimResult, type SimSeat } from '../src/engine/simulate';
import type { Difficulty, Mode, Preset } from '../src/engine/types';

const out = (line = '') => process.stdout.write(`${line}\n`);

/**
 * Plays thousands of rival-only games and prints the tables NOTES.md records: game length,
 * first-player advantage, how often each district decides the game, and what each earns.
 *
 *   pnpm --filter @usr-games/game-monop simulate -- --games 2000 --players 3 --mode quick
 */

function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1]! : fallback;
}

const games = Number(arg('games', '1000'));
const players = Number(arg('players', '3'));
const mode = arg('mode', 'quick') as Mode;
const preset = arg('preset', 'standard') as Preset;
const rounds = Number(
  arg('rounds', String(mode === 'quick' ? quickRounds(players) : CLASSIC_LONG_STOP)),
);
/** A level for every seat, or `mixed` to seat one of each level, rotating. */
const difficulty = arg('difficulty', 'hard') as Difficulty | 'mixed';
const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];
const mix = arg('mix', 'all');
/** Economy overrides as JSON, for tuning: --economy '{"rentTilt":0.3}'. */
const economy = {
  ...ECONOMY_PARAMS,
  ...(JSON.parse(arg('economy', '{}')) as Partial<typeof ECONOMY_PARAMS>),
};
const brief = process.argv.includes('--brief');

const PERSONALITIES: PersonalityId[] = ['builder', 'saver', 'collector', 'dealmaker', 'steady'];

function table(game: number): SimSeat[] {
  return Array.from({ length: players }, (_, seat) => ({
    personality:
      mix === 'all'
        ? PERSONALITIES[(game + seat * 2) % PERSONALITIES.length]!
        : (mix as PersonalityId),
    difficulty: difficulty === 'mixed' ? LEVELS[(game + seat) % LEVELS.length]! : difficulty,
  }));
}

const started = Date.now();
const results: SimResult[] = [];
for (let game = 0; game < games; game++) {
  results.push(
    simulate({
      seed: `sim-${game}`,
      seats: table(game),
      rules: makeRules(preset, mode, undefined, rounds),
      economy,
      board: BOARD_IDS[game % BOARD_IDS.length],
    }),
  );
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;
const quantile = (xs: number[], q: number) =>
  [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))]!;

const finished = results.filter((r) => !r.stalled);
out(
  `${games} games, ${players} players, ${mode}, ${preset}, ${difficulty}, mix ${mix}; ${((Date.now() - started) / 1000).toFixed(1)} s`,
);
out(`stalled ${results.length - finished.length}`);
const minutes = finished.map((r) => r.minutes);
const roundsPlayed = finished.map((r) => r.rounds);
out(
  `minutes   mean ${mean(minutes).toFixed(1)}  p10 ${quantile(minutes, 0.1).toFixed(1)}  p90 ${quantile(minutes, 0.9).toFixed(1)}`,
);
out(`minutes per round ${mean(finished.map((r) => r.minutes / Math.max(1, r.rounds))).toFixed(3)}`);
out(
  `rounds    mean ${mean(roundsPlayed).toFixed(1)}  p10 ${quantile(roundsPlayed, 0.1)}  p90 ${quantile(roundsPlayed, 0.9)}`,
);
out(
  `trades ${mean(finished.map((r) => r.trades)).toFixed(2)}  auctions ${mean(finished.map((r) => r.auctions)).toFixed(2)}  landmarks ${mean(finished.map((r) => r.landmarks)).toFixed(2)}`,
);

const wins = new Array<number>(players).fill(0);
for (const r of finished) if (r.winner !== null) wins[r.winner]! += 1;
out(`wins by seat  ${wins.map((w, i) => `${i}: ${pct(w, finished.length)}`).join('  ')}`);

const byPersonality = new Map<string, { games: number; wins: number }>();
finished.forEach((r, game) => {
  table(game).forEach((seat, i) => {
    const entry = byPersonality.get(seat.personality) ?? { games: 0, wins: 0 };
    entry.games += 1;
    if (r.winner === i) entry.wins += 1;
    byPersonality.set(seat.personality, entry);
  });
});
const byLevel = new Map<string, { games: number; wins: number }>();
finished.forEach((r, game) => {
  table(game).forEach((seat, i) => {
    const entry = byLevel.get(seat.difficulty) ?? { games: 0, wins: 0 };
    entry.games += 1;
    if (r.winner === i) entry.wins += 1;
    byLevel.set(seat.difficulty, entry);
  });
});
if (difficulty === 'mixed')
  out(`wins by level  ${[...byLevel].map(([d, e]) => `${d} ${pct(e.wins, e.games)}`).join('  ')}`);
out(
  `wins by personality  ${[...byPersonality].map(([p, e]) => `${p} ${pct(e.wins, e.games)}`).join('  ')}`,
);

out(`bankruptcies ${mean(finished.map((r) => r.bankruptcies)).toFixed(2)}`);
out(
  'district | completed | completer wins | first formed | its owner wins | rent/game | return | done by round',
);
for (let group = 0; group < 8; group++) {
  const completed = finished.filter((r) => r.groupOwners[group] !== null);
  const completerWins = completed.filter((r) => r.winner === r.groupOwners[group]).length;
  const first = finished.filter((r) => r.firstDistrict?.group === group);
  const firstWins = first.filter((r) => r.winner === r.firstDistrict!.seat).length;
  const firstDone = finished
    .map((r) => r.completedOnRound[group])
    .filter((x): x is number => x !== null);
  const rent = mean(finished.map((r) => r.rentByGroup[group]!));
  const spent = mean(finished.map((r) => r.spentByGroup[group]!));
  out(
    [
      `  ${group}     `,
      pct(completed.length, finished.length).padStart(7),
      pct(completerWins, completed.length).padStart(12),
      pct(first.length, finished.length).padStart(12),
      pct(firstWins, first.length).padStart(12),
      rent.toFixed(0).padStart(8),
      (rent / Math.max(1, spent)).toFixed(2).padStart(7),
      (firstDone.length ? mean(firstDone).toFixed(1) : '-').padStart(8),
    ].join(' | '),
  );
}
out(
  `transit rent/game ${mean(finished.map((r) => r.rentTransit)).toFixed(0)}  utility rent/game ${mean(finished.map((r) => r.rentUtility)).toFixed(0)}`,
);

if (brief) {
  const firstWins = Array.from({ length: 8 }, (_, g) => {
    const first = finished.filter((r) => r.firstDistrict?.group === g);
    return first.length
      ? first.filter((r) => r.winner === r.firstDistrict!.seat).length / first.length
      : NaN;
  });
  const completerWins = Array.from({ length: 8 }, (_, g) => {
    const done = finished.filter((r) => r.groupOwners[g] !== null);
    return done.length
      ? done.filter((r) => r.winner === r.groupOwners[g]).length / done.length
      : NaN;
  });
  const spread = (xs: number[]) =>
    Math.max(...xs.filter((x) => !Number.isNaN(x))) -
    Math.min(...xs.filter((x) => !Number.isNaN(x)));
  out(
    `BRIEF ${process.argv.slice(2).join(' ')} | min ${mean(minutes).toFixed(1)} | seat ${wins.map((w) => ((100 * w) / finished.length).toFixed(0)).join('/')} | completer ${completerWins.map((x) => (100 * x).toFixed(0)).join(' ')} (spread ${(100 * spread(completerWins)).toFixed(0)}) | first ${firstWins.map((x) => (100 * x).toFixed(0)).join(' ')} (spread ${(100 * spread(firstWins)).toFixed(0)}) | landmarks ${mean(finished.map((r) => r.landmarks)).toFixed(2)} | out ${mean(finished.map((r) => r.bankruptcies)).toFixed(2)}`,
  );
}
