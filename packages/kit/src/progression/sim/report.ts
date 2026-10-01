/**
 * Prints the progression balance report: `pnpm sim [runs]`.
 * The numbers recorded in docs/NOTES-progression.md come from this script.
 */
import { RANK_IDS, RANKS } from '../ranks';
import { XP_RULES } from '../rules';
import { FIRST_WAVE_IDS, PLANNED_COLLECTION } from './collection';
import { BOT_PROFILES, MARATHON_PROFILE, runMany, summarise } from './simulate';

const runs = Number(process.argv[2] ?? 60);
const DAYS = 140;

function cell(value: number | null): string {
  return value === null ? '—' : String(value);
}

function report(label: string, catalog = PLANNED_COLLECTION) {
  console.log(`\n### ${label} (${catalog.length} games, ${runs} runs × ${DAYS} days)\n`);
  console.log('| Bot | Rank | Median day | p10 | p90 | Fastest | Reached |');
  console.log('|---|---|---|---|---|---|---|');
  for (const bot of [...Object.values(BOT_PROFILES), MARATHON_PROFILE]) {
    const results = runMany(bot, runs, DAYS, catalog);
    for (const rank of RANK_IDS.slice(1)) {
      const stats = summarise(results, rank);
      console.log(
        `| ${bot.name} | ${rank} | ${cell(stats.median)} | ${cell(stats.p10)} | ${cell(stats.p90)} | ${cell(stats.min)} | ${stats.reached}/${stats.runs} |`,
      );
    }
    const finals = results.map((r) => r.finalState.xp).sort((a, b) => a - b);
    const perDay = results.map((r) => (r.xpByDay[27] ?? 0) / 28).sort((a, b) => a - b);
    console.log(
      `| ${bot.name} | XP after ${DAYS} days (median) | ${finals[Math.floor(finals.length / 2)]} | | | | avg XP/day over first 4 weeks: ${Math.round(perDay[Math.floor(perDay.length / 2)] ?? 0)} |`,
    );
  }
}

console.log('## Rank thresholds');
console.log(RANKS.map((rank) => `${rank.id} ${rank.threshold}`).join(' · '));
console.log('\n## XP rules');
console.log(JSON.stringify(XP_RULES));
report('Full planned collection');
report(
  'First wave only (eight adopted games)',
  PLANNED_COLLECTION.filter((g) => FIRST_WAVE_IDS.includes(g.id)),
);
