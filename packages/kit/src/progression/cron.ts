import type { GameResult } from '../contract/contract';
import type { Category } from '../manifest/manifest';
import { createRng, type Rng } from '../rng/rng';
import type { WeekKey } from '../daily/daily';
import { completedSession, type GameInfo, isToy } from './rules';

/**
 * Cron jobs are three weekly quests, generated from the week's seed so everyone on the same
 * catalog sees the same crontab. They only ever point at shipped games, spread across
 * different games and directories. When a week ends, unfinished jobs are simply replaced;
 * nothing is taken away.
 */

export const JOBS_PER_WEEK = 3;

export type CronJobKind =
  'category-sessions' | 'category-wins' | 'game-wins' | 'game-goal' | 'variety' | 'dailies';

export interface CronJob {
  id: string;
  kind: CronJobKind;
  label: string;
  /** The same job in plain words, for styles without Unix flavour ("Play 4 arcade games"). */
  plain?: string;
  /** Crontab-flavoured command line shown next to the label. */
  command: string;
  target: number;
  progress: number;
  done: boolean;
  gameId?: string;
  category?: Category;
  stat?: string;
  /** Distinct games played, for variety jobs. */
  seen?: string[];
}

const WIN_NOUNS: Partial<Record<Category, string>> = {
  arcade: 'arcade games',
  strategy: 'strategy games',
  board: 'board games',
  cards: 'card games',
  words: 'word games',
  numbers: 'number games',
};

/** Weekly schedules look like crontab entries: minute hour day month weekday. */
function cronSchedule(rng: Rng): string {
  return `${rng.pick([0, 15, 30, 45])} ${rng.int(0, 23)} * * ${rng.int(0, 6)}`;
}

function averageMinutes(games: readonly GameInfo[]): number {
  const total = games.reduce((sum, g) => sum + (g.sessionMinutes[0] + g.sessionMinutes[1]) / 2, 0);
  return total / Math.max(1, games.length);
}

type Candidate = Omit<CronJob, 'id' | 'progress' | 'done' | 'command'> & { verb: string };

function candidateJobs(games: readonly GameInfo[], rng: Rng): Candidate[] {
  const candidates: Candidate[] = [];
  const byCategory = new Map<Category, GameInfo[]>();
  for (const game of games)
    byCategory.set(game.category, [...(byCategory.get(game.category) ?? []), game]);

  for (const [category, members] of byCategory) {
    // Aim for roughly forty minutes of play, so long story games ask for fewer sessions.
    const sessions = Math.min(5, Math.max(1, Math.round(40 / averageMinutes(members))));
    candidates.push({
      kind: 'category-sessions',
      category,
      target: sessions,
      label:
        sessions === 1
          ? `Play something from /usr/games/${category}`
          : `Run ${sessions} sessions from /usr/games/${category}`,
      verb: `run /usr/games/${category} -n ${sessions}`,
    });
    const noun = WIN_NOUNS[category];
    if (noun) {
      const wins = rng.int(2, 3);
      candidates.push({
        kind: 'category-wins',
        category,
        target: wins,
        label: `Win ${wins} ${noun}`,
        verb: `win --dir ${category} -n ${wins}`,
      });
    }
  }

  for (const game of games) {
    if (!isToy(game) && game.category !== 'stories') {
      const wins = rng.int(1, 3);
      candidates.push({
        kind: 'game-wins',
        gameId: game.id,
        category: game.category,
        target: wins,
        label: wins === 1 ? `Win a round of ${game.title}` : `Win ${wins} rounds of ${game.title}`,
        verb: `${game.id} --win -n ${wins}`,
      });
    }
    for (const goal of game.cronGoals ?? []) {
      const target = rng.int(goal.min, goal.max);
      candidates.push({
        kind: 'game-goal',
        gameId: game.id,
        category: game.category,
        stat: goal.stat,
        target,
        label: `${goal.label.replace('{n}', String(target))} in ${game.title}`,
        verb: `${game.id} --goal ${goal.id} -n ${target}`,
      });
    }
  }

  const playable = games.filter((game) => !isToy(game));
  if (playable.length >= 3) {
    const distinct = rng.int(3, Math.min(5, playable.length));
    candidates.push({
      kind: 'variety',
      target: distinct,
      label: `Run ${distinct} different games`,
      verb: `ps --distinct -n ${distinct}`,
    });
  }
  if (games.some((game) => game.daily)) {
    const dailies = rng.int(2, 3);
    candidates.push({
      kind: 'dailies',
      target: dailies,
      label: `Finish ${dailies} daily challenges`,
      verb: `daily --finish -n ${dailies}`,
    });
  }
  return candidates;
}

const PLAIN_CATEGORY: Record<Category, [one: string, many: string]> = {
  arcade: ['an arcade game', 'arcade games'],
  strategy: ['a strategy game', 'strategy games'],
  board: ['a board game', 'board games'],
  cards: ['a card game', 'card games'],
  words: ['a word game', 'word games'],
  numbers: ['a number game', 'number games'],
  stories: ['a story game', 'story games'],
  toys: ['a toy', 'toys'],
};

/** A job in plain words, for the styles that speak without Unix flavour. */
export function plainLabel(job: Pick<CronJob, 'kind' | 'category' | 'target' | 'label'>): string {
  if (job.kind === 'variety') return `Play ${job.target} different games`;
  if (job.kind !== 'category-sessions' || !job.category) return job.label;
  const [one, many] = PLAIN_CATEGORY[job.category];
  const verb = job.category === 'toys' ? 'Play with' : 'Play';
  return job.target === 1 ? `${verb} ${one}` : `${verb} ${job.target} ${many}`;
}

/** Plain label for display, including jobs saved before plain labels existed. */
export function questLabel(job: CronJob): string {
  return job.plain ?? plainLabel(job);
}

function compatible(chosen: readonly Candidate[], next: Candidate, strictKinds: boolean): boolean {
  return chosen.every(
    (job) =>
      (!strictKinds || job.kind !== next.kind) &&
      (job.category === undefined ||
        next.category === undefined ||
        job.category !== next.category) &&
      (job.gameId === undefined || next.gameId === undefined || job.gameId !== next.gameId),
  );
}

export function generateCronJobs(week: WeekKey, shippedGames: readonly GameInfo[]): CronJob[] {
  const rng = createRng(
    `cron:${week}:${shippedGames
      .map((g) => g.id)
      .sort()
      .join(',')}`,
  );
  const shuffled = rng.shuffle(candidateJobs(shippedGames, rng.split('targets')));
  const chosen: Candidate[] = [];
  for (const strictKinds of [true, false]) {
    for (const candidate of shuffled) {
      if (chosen.length >= JOBS_PER_WEEK) break;
      if (!chosen.includes(candidate) && compatible(chosen, candidate, strictKinds))
        chosen.push(candidate);
    }
  }
  const schedules = rng.split('schedule');
  return chosen.map(({ verb, ...job }, index) => ({
    ...job,
    id: `${week}/${index + 1}`,
    command: `${cronSchedule(schedules)} ${verb}`,
    plain: plainLabel(job),
    progress: 0,
    done: false,
    ...(job.kind === 'variety' ? { seen: [] } : {}),
  }));
}

export interface CronEvent {
  game: GameInfo;
  result: GameResult;
  /** True only for the first daily challenge of this game today. */
  countsAsDaily: boolean;
}

function advanceOne(job: CronJob, { game, result, countsAsDaily }: CronEvent): CronJob {
  if (job.done) return job;
  const completed = completedSession(result);
  const won = result.outcome === 'win';
  let progress = job.progress;
  let seen = job.seen;
  switch (job.kind) {
    case 'category-sessions':
      if (completed && game.category === job.category) progress += 1;
      break;
    case 'category-wins':
      if (won && game.category === job.category) progress += 1;
      break;
    case 'game-wins':
      if (won && game.id === job.gameId) progress += 1;
      break;
    case 'game-goal':
      if (game.id === job.gameId && job.stat)
        progress += Math.max(0, Math.floor(result.stats?.[job.stat] ?? 0));
      break;
    case 'variety':
      if (completed && !isToy(game) && !(seen ?? []).includes(game.id)) {
        seen = [...(seen ?? []), game.id];
        progress = seen.length;
      }
      break;
    case 'dailies':
      if (countsAsDaily) progress += 1;
      break;
  }
  progress = Math.min(job.target, progress);
  return { ...job, progress, done: progress >= job.target, ...(seen ? { seen } : {}) };
}

export function advanceCronJobs(
  jobs: readonly CronJob[],
  event: CronEvent,
): { jobs: CronJob[]; completed: CronJob[] } {
  const next = jobs.map((job) => advanceOne(job, event));
  const completed = next.filter((job, i) => job.done && !(jobs[i] as CronJob).done);
  return { jobs: next, completed };
}
