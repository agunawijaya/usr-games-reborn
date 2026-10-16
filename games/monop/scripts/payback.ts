import { groupSpaces } from '../src/boards/layout';
import { ECONOMY_PARAMS, makeEconomy, type EconomyParams } from '../src/engine/economy';
import { landingOdds } from '../src/engine/markov';

const out = (line = '') => process.stdout.write(`${line}\n`);

/** Rounds for each district to pay back its deeds and buildings at each height, with two rivals landing. */
export function paybacks(params: EconomyParams, rivals = 2): number[][] {
  const economy = makeEconomy(params);
  const landing = landingOdds('short').perTurn;
  return Array.from({ length: 8 }, (_, g) => {
    const lots = groupSpaces(g);
    return [1, 2, 3, 4, 5].map((level) => {
      const income = lots.reduce(
        (sum, s) => sum + economy.deeds[s]!.rents[level]! * landing[s]! * rivals,
        0,
      );
      const cost = lots.reduce(
        (sum, s) => sum + economy.deeds[s]!.price + level * economy.deeds[s]!.buildCost,
        0,
      );
      return cost / income;
    });
  });
}

if (process.argv[1]?.endsWith('payback.ts')) {
  const e = makeEconomy(ECONOMY_PARAMS);
  paybacks(ECONOMY_PARAMS).forEach((row, g) =>
    out(
      g,
      groupSpaces(g)
        .map((s) => `${e.deeds[s]!.price}/${e.deeds[s]!.rents.join(',')}/${e.deeds[s]!.buildCost}`)
        .join('  '),
      '| payback',
      row.map((x) => x.toFixed(1)).join(' '),
    ),
  );
}
