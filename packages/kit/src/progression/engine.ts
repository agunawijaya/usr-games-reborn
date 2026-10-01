import {
  packageKey,
  type PackageDefinition,
  type PackageKey,
  packageXp,
} from '../achievements/packages';
import type { GameResult } from '../contract/contract';
import { addDays, type DateKey, isoWeekKey } from '../daily/daily';
import type { StyleId, ThemeId } from '../settings/settings';
import { advanceCronJobs, type CronJob, generateCronJobs } from './cron';
import { HALL_PACKAGES, hallPackageConditions } from './hall-packages';
import { rankForXp, rankIndex, type RankId } from './ranks';
import {
  applySoftCap,
  completedSession,
  eventsXp,
  type GameInfo,
  isToy,
  sameGameMultiplier,
  sessionXp,
  XP_RULES,
} from './rules';
import {
  CRON_HISTORY_WEEKS,
  DAY_LOG_RETENTION,
  type DayLog,
  emptyDay,
  type GameStats,
  type ProgressionState,
} from './state';
import { registerActivity } from './streak';

/**
 * The progression engine: pure functions from (state, event) to (new state, receipt). No DOM,
 * no clock, no storage; the caller supplies today's date and the shipped catalog. That keeps
 * every rule testable and lets the simulations replay months of play in milliseconds.
 */

export type XpSource = 'session' | 'first-win' | 'daily' | 'package' | 'cron' | 'cron-bonus';

export interface XpLine {
  source: XpSource;
  label: string;
  xp: number;
}

export interface ProgressionUpdate {
  state: ProgressionState;
  xpGained: number;
  lines: XpLine[];
  packagesInstalled: PackageKey[];
  cronCompleted: CronJob[];
  rankBefore: RankId;
  rankAfter: RankId;
}

export interface EngineContext {
  today: DateKey;
  /** Only shipped games can appear in cron jobs. */
  shippedGames: readonly GameInfo[];
}

/** Starts the week's crontab when the week changes; last week's jobs roll off harmlessly. */
export function syncWeek(state: ProgressionState, context: EngineContext): ProgressionState {
  const week = isoWeekKey(context.today);
  const sameWeek = state.cron.week === week;
  if (sameWeek && (state.cron.jobs.length > 0 || context.shippedGames.length === 0)) return state;
  const history =
    !sameWeek && state.cron.week !== null && state.cron.jobs.length > 0
      ? [
          ...state.cron.history,
          {
            week: state.cron.week,
            completed: state.cron.jobs.filter((job) => job.done).length,
            total: state.cron.jobs.length,
          },
        ].slice(-CRON_HISTORY_WEEKS)
      : state.cron.history;
  return {
    ...state,
    cron: { ...state.cron, week, jobs: generateCronJobs(week, context.shippedGames), history },
  };
}

function pruneDays(days: Record<DateKey, DayLog>, today: DateKey): Record<DateKey, DayLog> {
  const oldest = addDays(today, -DAY_LOG_RETENTION);
  return Object.fromEntries(Object.entries(days).filter(([day]) => day >= oldest));
}

function installInto(
  state: ProgressionState,
  scope: string,
  definition: PackageDefinition,
  today: DateKey,
): { state: ProgressionState; line: XpLine | null } {
  const key = packageKey(scope, definition.id);
  if (state.packages[key]) return { state, line: null };
  const xp = packageXp(definition);
  return {
    state: { ...state, packages: { ...state.packages, [key]: { installedOn: today, xp } } },
    line: { source: 'package', label: `Installed ${definition.title}`, xp },
  };
}

/** Adds XP, installs any Hall packages that just became earned, and writes the day totals. */
function finalize(
  before: ProgressionState,
  working: ProgressionState,
  lines: XpLine[],
  installed: PackageKey[],
  cronCompleted: CronJob[],
  today: DateKey,
): ProgressionUpdate {
  let state = working;
  const conditions = hallPackageConditions(state);
  for (const definition of HALL_PACKAGES) {
    if (!conditions[definition.id]) continue;
    const result = installInto(state, 'hall', definition, today);
    if (result.line) {
      state = result.state;
      lines.push(result.line);
      installed.push(packageKey('hall', definition.id));
    }
  }
  const xpGained = lines.reduce((sum, line) => sum + line.xp, 0);
  const day = state.days[today] ?? emptyDay();
  state = {
    ...state,
    xp: state.xp + xpGained,
    days: pruneDays({ ...state.days, [today]: { ...day, totalXp: day.totalXp + xpGained } }, today),
  };
  return {
    state,
    xpGained,
    lines,
    packagesInstalled: installed,
    cronCompleted,
    rankBefore: rankForXp(before.xp).id,
    rankAfter: rankForXp(state.xp).id,
  };
}

function updatedStats(
  previous: GameStats | undefined,
  game: GameInfo,
  result: GameResult,
  today: DateKey,
  countsAsDaily: boolean,
): GameStats {
  const stats: GameStats = previous ?? {
    category: game.category,
    sessions: 0,
    completed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    bestScore: null,
    totalSeconds: 0,
    dailies: 0,
    firstPlayed: today,
    lastPlayed: today,
    counters: {},
  };
  const counters = { ...stats.counters };
  for (const [name, value] of Object.entries(result.stats ?? {})) {
    if (Number.isFinite(value)) counters[name] = (counters[name] ?? 0) + value;
  }
  const score = result.score;
  return {
    ...stats,
    category: game.category,
    sessions: stats.sessions + 1,
    completed: stats.completed + (completedSession(result) ? 1 : 0),
    wins: stats.wins + (result.outcome === 'win' ? 1 : 0),
    losses: stats.losses + (result.outcome === 'loss' ? 1 : 0),
    draws: stats.draws + (result.outcome === 'draw' ? 1 : 0),
    bestScore:
      typeof score === 'number' && Number.isFinite(score)
        ? Math.max(score, stats.bestScore ?? -Infinity)
        : stats.bestScore,
    totalSeconds: stats.totalSeconds + Math.max(0, Math.round(result.durationSeconds ?? 0)),
    dailies: stats.dailies + (countsAsDaily ? 1 : 0),
    lastPlayed: today,
    counters,
  };
}

/** Lines for the session itself, before the soft ceiling. */
function playLines(
  game: GameInfo,
  result: GameResult,
  day: DayLog,
  sessionNumber: number,
): XpLine[] {
  if (!completedSession(result)) return [];
  if (isToy(game)) {
    return sessionNumber === 1
      ? [{ source: 'session', label: `${game.title}, once today`, xp: XP_RULES.toySession }]
      : [];
  }
  const lines: XpLine[] = [];
  const multiplier = sameGameMultiplier(sessionNumber);
  const session = Math.round((sessionXp(game) + eventsXp(result.xpEvents)) * multiplier);
  if (session > 0) {
    const note = multiplier < 1 ? ' · encore, lighter XP' : '';
    lines.push({ source: 'session', label: `Session of ${game.title}${note}`, xp: session });
  }
  if (result.outcome === 'win' && !day.wins.includes(game.id)) {
    lines.push({
      source: 'first-win',
      label: `First win of the day in ${game.title}`,
      xp: XP_RULES.firstWinOfDay,
    });
  }
  if (result.daily && game.daily && !day.dailies.includes(game.id)) {
    lines.push({
      source: 'daily',
      label: `Daily challenge in ${game.title}`,
      xp: XP_RULES.dailyChallenge,
    });
  }
  return lines;
}

/** Scales play lines so their total matches what the soft ceiling allows. */
function capLines(lines: XpLine[], alreadyToday: number): XpLine[] {
  const raw = lines.reduce((sum, line) => sum + line.xp, 0);
  if (raw === 0) return lines;
  const allowed = applySoftCap(alreadyToday, raw);
  if (allowed === raw) return lines;
  const factor = allowed / raw;
  const scaled = lines.map((line) => ({ ...line, xp: Math.floor(line.xp * factor) }));
  const shortfall = allowed - scaled.reduce((sum, line) => sum + line.xp, 0);
  if (scaled[0]) scaled[0] = { ...scaled[0], xp: scaled[0].xp + shortfall };
  return scaled.filter((line) => line.xp > 0);
}

export function applyResult(
  current: ProgressionState,
  game: GameInfo,
  result: GameResult,
  context: EngineContext,
): ProgressionUpdate {
  const { today } = context;
  let state = syncWeek(current, context);
  const day = state.days[today] ?? emptyDay();
  const sessionNumber = (day.sessions[game.id] ?? 0) + 1;
  const completed = completedSession(result);
  const countsAsDaily =
    completed && Boolean(result.daily) && game.daily && !day.dailies.includes(game.id);

  const lines = capLines(playLines(game, result, day, sessionNumber), day.playXp);
  const playXp = lines.reduce((sum, line) => sum + line.xp, 0);

  state = {
    ...state,
    streak: completed ? registerActivity(state.streak, today).streak : state.streak,
    games: {
      ...state.games,
      [game.id]: updatedStats(state.games[game.id], game, result, today, countsAsDaily),
    },
    days: {
      ...state.days,
      [today]: {
        ...day,
        playXp: day.playXp + playXp,
        sessions: { ...day.sessions, [game.id]: sessionNumber },
        wins:
          result.outcome === 'win' && !day.wins.includes(game.id)
            ? [...day.wins, game.id]
            : day.wins,
        dailies: countsAsDaily ? [...day.dailies, game.id] : day.dailies,
      },
    },
  };

  const wasFullWeek = state.cron.jobs.length > 0 && state.cron.jobs.every((job) => job.done);
  const advanced = advanceCronJobs(state.cron.jobs, { game, result, countsAsDaily });
  for (const job of advanced.completed) {
    lines.push({ source: 'cron', label: `Cron job done: ${job.label}`, xp: XP_RULES.cronJob });
  }
  const isFullWeek = advanced.jobs.length > 0 && advanced.jobs.every((job) => job.done);
  if (isFullWeek && !wasFullWeek) {
    lines.push({
      source: 'cron-bonus',
      label: 'Every cron job this week',
      xp: XP_RULES.cronFullWeekBonus,
    });
  }
  state = {
    ...state,
    cron: {
      ...state.cron,
      jobs: advanced.jobs,
      completedTotal: state.cron.completedTotal + advanced.completed.length,
      fullWeeks: state.cron.fullWeeks + (isFullWeek && !wasFullWeek ? 1 : 0),
    },
  };

  return finalize(current, state, lines, [], advanced.completed, today);
}

/** Installs one of a game's own packages (the game decides when it is earned). */
export function installGamePackage(
  current: ProgressionState,
  scope: string,
  definition: PackageDefinition,
  context: EngineContext,
): ProgressionUpdate {
  const state = syncWeek(current, context);
  const { state: next, line } = installInto(state, scope, definition, context.today);
  return finalize(
    current,
    next,
    line ? [line] : [],
    line ? [packageKey(scope, definition.id)] : [],
    [],
    context.today,
  );
}

export function recordLogin(current: ProgressionState, context: EngineContext): ProgressionUpdate {
  const state = { ...syncWeek(current, context), hall: { ...current.hall, loggedIn: true } };
  return finalize(current, state, [], [], [], context.today);
}

export function recordManPageRead(
  current: ProgressionState,
  gameId: string,
  context: EngineContext,
): ProgressionUpdate {
  const read = current.hall.manPagesRead.includes(gameId)
    ? current.hall.manPagesRead
    : [...current.hall.manPagesRead, gameId];
  const state = { ...syncWeek(current, context), hall: { ...current.hall, manPagesRead: read } };
  return finalize(current, state, [], [], [], context.today);
}

export function recordThemeSeen(
  current: ProgressionState,
  theme: ThemeId,
  context: EngineContext,
): ProgressionUpdate {
  const seen = current.hall.themesSeen.includes(theme)
    ? current.hall.themesSeen
    : [...current.hall.themesSeen, theme];
  const state = { ...syncWeek(current, context), hall: { ...current.hall, themesSeen: seen } };
  return finalize(current, state, [], [], [], context.today);
}

export function recordStyleSeen(
  current: ProgressionState,
  style: StyleId,
  context: EngineContext,
): ProgressionUpdate {
  const seen = current.hall.stylesSeen.includes(style)
    ? current.hall.stylesSeen
    : [...current.hall.stylesSeen, style];
  const state = { ...syncWeek(current, context), hall: { ...current.hall, stylesSeen: seen } };
  return finalize(current, state, [], [], [], context.today);
}

/** The rank-up the player has not celebrated yet, if any. */
export function pendingRankUp(state: ProgressionState): { from: RankId; to: RankId } | null {
  const reached = rankForXp(state.xp).id;
  return rankIndex(reached) > rankIndex(state.celebratedRank)
    ? { from: state.celebratedRank, to: reached }
    : null;
}

export function acknowledgeRank(state: ProgressionState): ProgressionState {
  return { ...state, celebratedRank: rankForXp(state.xp).id };
}
