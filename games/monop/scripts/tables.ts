import { LAYOUT } from '../src/boards/layout';
import { BOARDS } from '../src/boards/themes';
import { ECONOMY, ECONOMY_PARAMS } from '../src/engine/economy';
import { landingOdds } from '../src/engine/markov';
import { paybacks } from './payback';

/**
 * Prints the economy's tables and the landing chart as Markdown and Mermaid, for NOTES.md, so
 * the record is regenerated from the code rather than typed by hand.
 */

const out = (line = '') => process.stdout.write(`${line}\n`);
const harbour = BOARDS.harbour;

out(
  '| Space | Harbour City name | Price | Rent: bare · 1 · 2 · 3 · 4 storeys · landmark | Storey |',
);
out(
  '| ----: | ----------------- | ----: | --------------------------------------------- | -----: |',
);
for (const slot of LAYOUT) {
  const deed = ECONOMY.deeds[slot.index];
  if (!deed || slot.kind !== 'street') continue;
  out(
    `| ${slot.index} | ${harbour.spaces[slot.index]} | ${deed.price} | ${deed.rents.join(' · ')} | ${deed.buildCost} |`,
  );
}
out();
out(
  `Transit stops: ${ECONOMY_PARAMS.transitPrice} each, fares ${ECONOMY_PARAMS.transitRents.join(' · ')} with one to four owned.`,
);
out(
  `Utilities: ${ECONOMY_PARAMS.utilityPrice} each, ${ECONOMY_PARAMS.utilityTimes.join(' or ')} times the dice with one or both.`,
);
out();
out('Payback in rounds (deeds and buildings, two rivals landing):');
out();
out('| District | 1 storey | 2 | 3 | 4 | landmark |');
out('| -------- | -------: | -: | -: | -: | -------: |');
paybacks(ECONOMY_PARAMS).forEach((row, g) =>
  out(`| ${g} ${harbour.groups[g]!.name} | ${row.map((x) => x.toFixed(1)).join(' | ')} |`),
);
out();
for (const stay of ['short', 'long'] as const) {
  const odds = landingOdds(stay);
  out(
    `Landing odds (${stay} stays): rolls per turn ${odds.rollsPerTurn.toFixed(3)}, lock-up per turn ${odds.lockupPerTurn.toFixed(4)}`,
  );
  out('```mermaid');
  out('xychart-beta');
  out(`  title "Landings per turn, % (${stay} stays in the lock-up)"`);
  out(`  x-axis [${odds.perTurn.map((_, i) => i).join(', ')}]`);
  out(`  y-axis "landings per 100 turns" 0 --> 4`);
  out(`  bar [${odds.perTurn.map((p) => (100 * p).toFixed(2)).join(', ')}]`);
  out('```');
}
