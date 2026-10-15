import { newMatch, runDrivers } from '../src/engine/match';
import { scoreHand } from '../src/engine/score';
import { isSafety } from '../src/engine/cards';

/** Where a hand's points come from when Classic plays Classic (NOTES.md, "Balance"). */

const hands = 4000;
const t: Record<string, number> = {};
const add = (k: string, v = 1) => {
  t[k] = (t[k] ?? 0) + v;
};
for (let i = 0; i < hands; i++) {
  const m = newMatch({
    teams: false,
    length: 'single',
    seed: `st:${i}`,
    drivers: ['classic', 'classic'],
  });
  runDrivers(m);
  const h = m.hand;
  const s = scoreHand(h);
  for (const side of [0, 1] as const) {
    const sc = s[side];
    add('points', sc.total);
    add('miles', sc.milestones);
    add('safetyPts', sc.safeties);
    add('coupPts', sc.coups);
    add('tripPts', sc.trip);
    add('safeTripPts', sc.safeTrip);
    add('delayPts', sc.delayedAction);
    add('extPts', sc.extension);
    add('shutPts', sc.shutOut);
    add('all4', sc.allSafeties);
    const held = h.seats[side]!.hand.filter((c) => c !== null && isSafety(h.cards[c]!)).length;
    add('safetiesStranded', held);
  }
  if (h.extendedBy !== null) {
    add('extended');
    if (h.sides[h.extendedBy].miles === h.end) add('extensionMade');
    else if (h.sides[h.extendedBy === 0 ? 1 : 0].miles === h.end) add('extensionStolen');
    else add('extensionNobody');
  }
  if (h.sides[0].miles !== h.end && h.sides[1].miles !== h.end) add('noTrip');
  if (h.deck.length === 0) add('deckOut');
  add('discards', h.discards.length);
}
for (const [k, v] of Object.entries(t))
  process.stdout.write(`${k.padEnd(18)} ${(v / hands).toFixed(3)} per hand\n`);
