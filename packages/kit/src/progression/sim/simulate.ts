import type { PackageTier } from '../../achievements/packages';
import type { GameResult, Outcome } from '../../contract/contract';
import { addDays, type DateKey } from '../../daily/daily';
import { createRng, type Rng } from '../../rng/rng';
import { STYLE_IDS } from '../../settings/settings';
import type { CronJob } from '../cron';
import {
  applyResult,
  type EngineContext,
  installGamePackage,
  recordLogin,
  recordManPageRead,
  recordStyleSeen,
  syncWeek,
} from '../engine';
import { RANK_IDS, rankForXp, type RankId } from '../ranks';
import { type GameInfo, isToy } from '../rules';
import { emptyProgression, type ProgressionState } from '../state';
import { modelPackages } from './collection';

/**
 * Bot players for balance checks. Each profile is a sketch of a real habit, not an optimiser:
 * it plays for about its daily budget, prefers games it has not played yet today, sometimes
 * steers toward a cron job and unlocks packages at a rate that grows with skill.
 */
export interface BotProfile {
  name: string;
  minutesPerDay: number;
  /** How many favourite games the bot rotates through; `all` plays everything shipped. */
  pool: number | 'all';
  /** Chance of taking a day off. */
  restChance: number;
  winRate: number;
  /** Chance a session of a daily-capable game is played as the daily. */
  dailyChance: number;
  /** Multiplies the chance of unlocking the next package in a session. */
  skill: number;
  /** Chance of choosing a game because a cron job wants it. */
  cronFocus: number;
  manPagesOnFirstDay: number;
  triesAllStyles: boolean;
}

export const BOT_PROFILES: Readonly<Record<'casual' | 'regular' | 'enthusiast', BotProfile>> = {
  casual: {
    name: 'casual',
    minutesPerDay: 15,
    pool: 3,
    restChance: 0.12,
    winRate: 0.35,
    dailyChance: 0.5,
    skill: 0.7,
    cronFocus: 0.15,
    manPagesOnFirstDay: 3,
    triesAllStyles: false,
  },
  regular: {
    name: 'regular',
    minutesPerDay: 45,
    pool: 6,
    restChance: 0.08,
    winRate: 0.5,
    dailyChance: 0.7,
    skill: 1,
    cronFocus: 0.45,
    manPagesOnFirstDay: 6,
    triesAllStyles: true,
  },
  enthusiast: {
    name: 'enthusiast',
    minutesPerDay: 120,
    pool: 'all',
    restChance: 0.04,
    winRate: 0.6,
    dailyChance: 0.9,
    skill: 1.3,
    cronFocus: 0.8,
    manPagesOnFirstDay: 10,
    triesAllStyles: true,
  },
};

/**
 * Not a target audience: a stress test with six hours a day and near-perfect play. It proves
 * the "never under three weeks to root" floor holds even far beyond the enthusiast.
 */
export const MARATHON_PROFILE: BotProfile = {
  name: 'marathon',
  minutesPerDay: 360,
  pool: 'all',
  restChance: 0,
  winRate: 0.9,
  dailyChance: 1,
  skill: 2,
  cronFocus: 0.9,
  manPagesOnFirstDay: 30,
  triesAllStyles: true,
};

/** Per-session unlock chance for the next locked package of each tier, at skill 1. */
const UNLOCK_CHANCE: Record<PackageTier, number> = { core: 0.14, extra: 0.045, rare: 0.015 };

export interface SimulationOptions {
  seed: string;
  days: number;
  catalog: readonly GameInfo[];
  startDate?: DateKey;
}

export interface SimulationResult {
  /** 1-based day on which each rank was first reached; null if never within the run. */
  rankDay: Record<RankId, number | null>;
  xpByDay: number[];
  finalState: ProgressionState;
}

function jobWants(job: CronJob, game: GameInfo): boolean {
  if (job.done) return false;
  if (job.gameId) return job.gameId === game.id;
  if (job.category) return job.category === game.category;
  return !isToy(game);
}

function chooseGame(
  rng: Rng,
  bot: BotProfile,
  pool: readonly GameInfo[],
  state: ProgressionState,
  today: DateKey,
  budget: number,
  catalog: readonly GameInfo[],
): GameInfo | null {
  const sessionsToday = state.days[today]?.sessions ?? {};
  const fits = (game: GameInfo) => game.sessionMinutes[0] <= budget + 3;
  if (rng.chance(bot.cronFocus)) {
    // Cron jobs can point outside the bot's favourites; that is the point of them.
    const wanted = catalog.filter(
      (game) => fits(game) && state.cron.jobs.some((job) => jobWants(job, game)),
    );
    if (wanted.length > 0) return rng.pick(wanted);
  }
  const candidates = pool.filter(fits);
  if (candidates.length === 0) return null;
  const fewest = Math.min(...candidates.map((game) => sessionsToday[game.id] ?? 0));
  return rng.pick(candidates.filter((game) => (sessionsToday[game.id] ?? 0) === fewest));
}

function sessionOutcome(rng: Rng, bot: BotProfile, game: GameInfo): Outcome {
  if (isToy(game)) return 'complete';
  if (game.category === 'stories') return rng.chance(bot.winRate * 0.2) ? 'win' : 'complete';
  return rng.chance(bot.winRate) ? 'win' : 'loss';
}

function unlockPackages(
  rng: Rng,
  bot: BotProfile,
  game: GameInfo,
  state: ProgressionState,
  context: EngineContext,
): ProgressionState {
  let next = state;
  for (const definition of modelPackages(game)) {
    if (next.packages[`${game.id}/${definition.id}`]) continue;
    if (rng.chance(UNLOCK_CHANCE[definition.tier] * bot.skill)) {
      next = installGamePackage(next, game.id, definition, context).state;
    }
  }
  return next;
}

function firstDayRituals(
  bot: BotProfile,
  pool: readonly GameInfo[],
  state: ProgressionState,
  context: EngineContext,
) {
  let next = recordLogin(state, context).state;
  for (const game of pool.slice(0, bot.manPagesOnFirstDay))
    next = recordManPageRead(next, game.id, context).state;
  if (bot.triesAllStyles)
    for (const style of STYLE_IDS) next = recordStyleSeen(next, style, context).state;
  return next;
}

export function simulate(bot: BotProfile, options: SimulationOptions): SimulationResult {
  const rng = createRng(`${bot.name}:${options.seed}`);
  const start = options.startDate ?? '2026-10-05';
  const catalog = options.catalog;
  const pool =
    bot.pool === 'all' ? catalog : rng.shuffle(catalog.filter((g) => !isToy(g))).slice(0, bot.pool);
  const rankDay = Object.fromEntries(RANK_IDS.map((id) => [id, null])) as Record<
    RankId,
    number | null
  >;
  rankDay.guest = 1;
  const xpByDay: number[] = [];
  let state = emptyProgression();

  for (let day = 1; day <= options.days; day++) {
    const today = addDays(start, day - 1);
    const context: EngineContext = { today, shippedGames: catalog };
    state = syncWeek(state, context);
    if (day === 1) state = firstDayRituals(bot, pool, state, context);

    if (day === 1 || !rng.chance(bot.restChance)) {
      let budget = bot.minutesPerDay * rng.float(0.7, 1.3);
      while (budget > 1) {
        const game = chooseGame(rng, bot, pool, state, today, budget, catalog);
        if (!game) break;
        const minutes = rng.float(game.sessionMinutes[0], game.sessionMinutes[1]);
        const played = state.days[today]?.dailies ?? [];
        const result: GameResult = {
          outcome: sessionOutcome(rng, bot, game),
          presentation: 'hall',
          durationSeconds: Math.round(minutes * 60),
          daily: game.daily && !played.includes(game.id) && rng.chance(bot.dailyChance),
          xpEvents: isToy(game)
            ? []
            : [{ id: 'milestone', xp: Math.round(rng.float(0, 18) * bot.skill) }],
        };
        state = applyResult(state, game, result, context).state;
        state = unlockPackages(rng, bot, game, state, context);
        budget -= minutes;
      }
    }

    const rank = rankForXp(state.xp).id;
    for (const id of RANK_IDS.slice(0, RANK_IDS.indexOf(rank) + 1)) rankDay[id] ??= day;
    xpByDay.push(state.xp);
  }
  return { rankDay, xpByDay, finalState: state };
}

export interface RankStats {
  median: number | null;
  p10: number | null;
  p90: number | null;
  min: number | null;
  reached: number;
  runs: number;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[
    Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))
  ] as number;
}

export function summarise(results: readonly SimulationResult[], rank: RankId): RankStats {
  const days = results
    .map((result) => result.rankDay[rank])
    .filter((day): day is number => day !== null)
    .sort((a, b) => a - b);
  return {
    median: percentile(days, 0.5),
    p10: percentile(days, 0.1),
    p90: percentile(days, 0.9),
    min: days[0] ?? null,
    reached: days.length,
    runs: results.length,
  };
}

export function runMany(
  bot: BotProfile,
  runs: number,
  days: number,
  catalog: readonly GameInfo[],
): SimulationResult[] {
  return Array.from({ length: runs }, (_, i) => simulate(bot, { seed: `run-${i}`, days, catalog }));
}
