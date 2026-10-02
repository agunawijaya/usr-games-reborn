/**
 * Balance report: lets the Scout play many seeded expeditions in each cave and prints how they
 * ended. Usage: pnpm --filter @usr-games/game-wump sim [seeds] [cave-id …]
 */
import { createRng } from '@usr-games/kit';
import { startExpedition } from '../src/engine/expedition';
import { randomFrom } from '../src/engine/random';
import { CAMPAIGN, presetFor, TUTORIAL } from '../src/engine/campaign';
import { runScout } from '../src/engine/scout';

const seeds = Number(process.argv[2] ?? 1000);
const only = process.argv.slice(3);

for (const cave of [TUTORIAL, ...CAMPAIGN]) {
  if (only.length > 0 && !only.includes(cave.id)) continue;
  const endings = new Map<string, number>();
  let turns = 0;
  let forced = 0;
  for (let seed = 0; seed < seeds; seed++) {
    const random = randomFrom(createRng(`sim:${cave.id}:${seed}`));
    const expedition = startExpedition(cave.recipe, cave.rules, random, {
      preset: presetFor(cave),
    });
    const run = runScout(expedition);
    const last = run.events.at(-1) ?? [];
    const carried = last.some((e) => e.kind === 'carried');
    const ending = run.ending;
    const kind = !ending
      ? 'unfinished'
      : ending.kind === 'bowled-over'
        ? `bowled-${ending.cause}${carried ? '-by-bats' : ''}`
        : ending.kind === 'pit' && carried
          ? 'pit-by-bats'
          : ending.kind;
    endings.set(kind, (endings.get(kind) ?? 0) + 1);
    turns += run.turns;
    if (run.forcedFirstMove) forced += 1;
  }
  const hushed = endings.get('hushed') ?? 0;
  const rest = [...endings]
    .filter(([k]) => k !== 'hushed')
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
  process.stdout.write(
    `${cave.id.padEnd(16)} hushed ${((hushed / seeds) * 100).toFixed(1).padStart(5)}%  turns ${(turns / seeds).toFixed(1).padStart(5)}  forced first move ${((forced / seeds) * 100).toFixed(1)}%  | ${rest}
`,
  );
}
