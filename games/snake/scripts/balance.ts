// The balance report: `npx tsx games/snake/scripts/balance.ts [runs]`. Both bots play full runs
// from many seeds; the prompt's targets are checked at the end.
import { CAUTIOUS, GREEDY, playRun } from '../src/bots/bots';
import { RUN_LENGTH } from '../src/engine/chambers';

const runs = Number(process.argv[2] ?? 1000);

function report(name: string, outcomes: ReturnType<typeof playRun>[]) {
  const banked = outcomes.filter((o) => o.banked !== null);
  const reached = (depth: number) =>
    outcomes.filter((o) => o.deepest >= depth).length / outcomes.length;
  const median = (values: number[]) =>
    values.sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
  process.stdout.write(
    `${name.padEnd(9)} banked ${((banked.length / outcomes.length) * 100).toFixed(1)}% · ` +
      `reached 3: ${(reached(3) * 100).toFixed(1)}% · 5: ${(reached(5) * 100).toFixed(1)}% · 10: ${(reached(10) * 100).toFixed(1)}% · ` +
      `median bank ${median(banked.map((o) => o.banked!))} · lucky breaks ${outcomes.reduce((s, o) => s + o.luckyBreaks, 0)} · ` +
      `median turns ${median(outcomes.map((o) => o.turns))}\n`,
  );
}

const started = performance.now();
const cautious = Array.from({ length: runs }, (_, i) =>
  playRun(`balance:${i}`, CAUTIOUS, RUN_LENGTH),
);
const greedy = Array.from({ length: runs }, (_, i) => playRun(`balance:${i}`, GREEDY, RUN_LENGTH));
report('cautious', cautious);
report('greedy', greedy);
process.stdout.write(
  `${runs} runs each in ${((performance.now() - started) / 1000).toFixed(1)} s\n`,
);
