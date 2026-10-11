import { playEvents, SKILLS } from '../src/bots/bots';
import { CHAPTERS, chapterPar, chapterStars, starCount } from '../src/engine/chapters';
import { dailyPlan } from '../src/engine/daily';
import { type EventSpec, eventCount, eventPar } from '../src/engine/events';
import type { Tempo } from '../src/engine/sums';

/**
 * Prints the campaign balance: for each chapter and skill, the median length, the share of runs
 * at each star count and the median score, over `runs` seeds (default 200).
 * Run with `pnpm --filter @usr-games/game-arithmetic exec tsx scripts/balance.ts [runs] [calm]`.
 */

export interface ChapterBalance {
  readonly chapter: number;
  readonly skill: string;
  readonly medianMinutes: number;
  readonly stars: [number, number, number, number];
  readonly speedStar: number;
  readonly medianScore: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function measureCampaign(runs: number, tempo: Tempo): ChapterBalance[] {
  const rows: ChapterBalance[] = [];
  for (const chapter of CHAPTERS) {
    for (const skill of Object.values(SKILLS)) {
      const minutes: number[] = [];
      const scores: number[] = [];
      const stars: [number, number, number, number] = [0, 0, 0, 0];
      let speed = 0;
      for (let run = 0; run < runs; run++) {
        const { results } = playEvents(
          chapter.events,
          skill,
          tempo,
          `${chapter.id}:${skill.name}:${run}`,
        );
        const check = chapterStars(chapter, results, tempo);
        stars[starCount(check)]!++;
        if (check.second) speed++;
        minutes.push(results.reduce((sum, r) => sum + r.ms, 0) / 60_000);
        scores.push(results.reduce((sum, r) => sum + r.score, 0));
      }
      rows.push({
        chapter: chapter.number,
        skill: skill.name,
        medianMinutes: median(minutes),
        stars: stars.map((count) => count / runs) as [number, number, number, number],
        speedStar: speed / runs,
        medianScore: median(scores),
      });
    }
  }
  return rows;
}

export function measureDaily(
  runs: number,
): { skill: string; medianMinutes: number; medianScore: number }[] {
  return Object.values(SKILLS).map((skill) => {
    const minutes: number[] = [];
    const scores: number[] = [];
    for (let run = 0; run < runs; run++) {
      const plan = dailyPlan(`arithmetic:daily:sim-${run}`);
      const { results } = playEvents(plan.events, skill, 'rush', plan.seed);
      minutes.push(results.reduce((sum, r) => sum + r.ms, 0) / 60_000);
      scores.push(results.reduce((sum, r) => sum + r.score, 0));
    }
    return { skill: skill.name, medianMinutes: median(minutes), medianScore: median(scores) };
  });
}

/** Median seconds per item for each rung, by skill: the yardstick the pars are set from. */
export function measureRungs(runs: number): string[] {
  const specs = new Map<string, EventSpec>();
  const events = [...CHAPTERS.flatMap((chapter) => chapter.events), ...dailyPlan('rungs').events];
  for (const spec of events)
    specs.set(`${spec.mode}:${spec.level}`, { mode: spec.mode, level: spec.level } as EventSpec);
  const lines: string[] = [];
  for (const [key, spec] of specs) {
    const per = spec.mode === 'sieve' ? 1 : eventCount(spec);
    const cells = Object.values(SKILLS).map((skill) => {
      const seconds: number[] = [];
      for (let run = 0; run < runs; run++) {
        const { results } = playEvents([spec], skill, 'rush', `${key}:${skill.name}:${run}`);
        seconds.push(results[0]!.ms / 1000 / per);
      }
      return median(seconds).toFixed(1).padStart(6);
    });
    lines.push(`${key.padEnd(22)} ${cells.join(' ')}   par ${(eventPar(spec) / per).toFixed(1)}`);
  }
  return lines;
}

const print = (line: string) =>
  process.stdout.write(`${line}
`);

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/balance.ts');
if (isMain && process.argv[2] === 'rungs') {
  print('rung                   novice steady    ace');
  for (const line of measureRungs(Number(process.argv[3] ?? 200))) print(line);
} else if (isMain) {
  const runs = Number(process.argv[2] ?? 200);
  const tempo: Tempo = process.argv[3] === 'calm' ? 'calm' : 'rush';
  print(`chapter skill   minutes  par   0★    1★    2★    3★   speed  score`);
  for (const row of measureCampaign(runs, tempo)) {
    const chapter = CHAPTERS[row.chapter - 1]!;
    print(
      [
        String(row.chapter).padStart(7),
        row.skill.padEnd(7),
        row.medianMinutes.toFixed(1).padStart(7),
        (chapterPar(chapter) / 60).toFixed(1).padStart(5),
        ...row.stars.map((share) => `${Math.round(share * 100)}%`.padStart(5)),
        `${Math.round(row.speedStar * 100)}%`.padStart(6),
        String(row.medianScore).padStart(6),
      ].join(' '),
    );
  }
  print('\ndaily   skill   minutes  score');
  for (const row of measureDaily(runs)) {
    print(
      `        ${row.skill.padEnd(7)} ${row.medianMinutes.toFixed(1).padStart(7)} ${String(row.medianScore).padStart(6)}`,
    );
  }
}
