import { createBattle, crewOf, resolveTurn } from '../src/engine';
import { advise, type BotStyle } from '../src/bots/captain';
import { buildEncounter } from '../src/voyage/encounters';
import type { EncounterKind, Quality } from '../src/voyage/types';

const say = (line: string) => process.stdout.write(`${line}\n`);

/**
 * One battle, turn by turn, for reading what a bot and the computer captains do.
 * `tsx scripts/trace.ts <kind> <seed> [pressure] [quality] [style]`.
 */

const [kind = 'duel', seed = 'trace', pressure = '1', qual = '3', style = 'gunner'] =
  process.argv.slice(2);
const encounter = buildEncounter(kind as EncounterKind, seed, {
  flagship: { name: 'Kittiwake', qual: Number(qual) as Quality, refits: [], away: 0 },
  squadron: [],
  pressure: Number(pressure),
});
let battle = createBattle(encounter.setup);
say(`wind ${battle.winddir}/${battle.windspeed}, chart ${battle.rows}x${battle.cols}`);
const describe = () =>
  battle.ships
    .map(
      (s) =>
        `${s.name.slice(0, 9).padEnd(9)} ${s.role.slice(0, 5)} @${s.row},${s.col} d${s.dir} h${s.specs.hull}/${s.max.hull} c${crewOf(s)} r${[s.specs.rig1, s.specs.rig2, s.specs.rig3, s.specs.rig4].join('')}${s.struck ? ' STRUCK' : ''}${s.captured >= 0 ? ` held-by-${s.captured}` : ''}${s.dir === 0 ? ' GONE' : ''}`,
    )
    .join('\n  ');
say(`  ${describe()}`);
for (let t = 0; t < 80 && !battle.over; t++) {
  const advice = advise(battle, style as BotStyle);
  const r = resolveTurn(battle, advice.orders);
  battle = r.battle;
  const fires = r.events
    .filter((e) => e.t === 'fire')
    .map((e) =>
      e.t === 'fire'
        ? `${e.from}->${e.to} ${e.side} load${e.load} r${e.range} hit${e.hit}${e.rake ? ' RAKE' : ''}${e.damage ? ` H${e.damage.hits.hull}G${e.damage.hits.guns}C${e.damage.hits.crew}R${e.damage.hits.rig}` : ' miss'}`
        : '',
    );
  const other = r.events
    .filter((e) =>
      ['strike', 'capture', 'melee', 'grapple', 'board', 'foul', 'escape', 'safe', 'note'].includes(
        e.t,
      ),
    )
    .map((e) => JSON.stringify(e).slice(0, 120));
  say(
    `T${battle.turn} helm ${advice.orders.helm} fire ${JSON.stringify(advice.orders.fire ?? {})} | ${fires.join('; ')}`,
  );
  for (const o of other) say(`   ${o}`);
  say(`  ${describe()}`);
}
say(`END ${JSON.stringify(battle.end)}`);
