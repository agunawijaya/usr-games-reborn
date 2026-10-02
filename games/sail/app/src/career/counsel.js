// The first lieutenant's counsel: a full set of orders for the player's ship this turn, with the
// reason for each. It is the testing aid behind Ctrl+Alt+C, and the line the Sea Service and the
// Daily Engagement are proven winnable by: the engine is deterministic, so a captain who gives
// exactly these orders every turn replays the proof. Pure: reads the state, never changes it.
//
// The tactics were tuned by playing every staged scenario from every ship over 30 seeds
// (docs/NOTES.md): round shot only (double shot leaves a broadside empty for two turns, and lost
// a fifth of the wins), full sails beyond nine squares as the computer captains do, and boarders
// only against a crew at least 40% smaller.

import { closestenemy, fireOptions, range, freeSections, boardableTargets, L_EMPTY } from '../engine/index.js';
import { suggestHelm } from '../engine/hints.js';

/** Squares beyond which the counsel crowds on sail, as the computer captains do. */
const CHASE_RANGE = 9;
/** Boarders go across only with this much more crew than the enemy. */
const BOARDING_EDGE = 1.4;

const sideName = (side) => (side === 'L' ? 'port' : 'starboard');
const sideKey = (side) => (side === 'L' ? 'l' : 'r');
const crewOf = (sp) => sp.specs.crew1 + sp.specs.crew2 + sp.specs.crew3;
const loaded = (sp, side) => (side === 'L' ? sp.loadL : sp.loadR) !== L_EMPTY;

function boardingOrder(st, ms, advice) {
  const free = freeSections(ms).reduce((a, b) => a + b, 0);
  if (!free) return;
  const prize = boardableTargets(st, ms)
    .map((i) => st.ships[i])
    .find((sp) => sp.nationality !== ms.nationality && !sp.struck && crewOf(ms) >= crewOf(sp) * BOARDING_EDGE);
  if (!prize) return;
  advice.orders.board = [{ target: prize.index, sections: free }];
  advice.notes.push({ order: `Board the ${prize.name} with ${free} section${free === 1 ? '' : 's'}`, why: 'Her crew is much smaller than yours: take her on her own deck.' });
  advice.commands.push(`b #${prize.index} ${free}`);
}

function gunneryOrders(st, ms, advice) {
  // With every section away boarding there is nobody left at the guns: hold fire, keep loading.
  const boarding = !!advice.orders.board;
  if (boarding) advice.notes.push({ order: 'Hold fire', why: 'All hands are going across: no gun crews are left.' });
  for (const side of boarding ? [] : ['L', 'R']) {
    const opt = fireOptions(st, ms, side === 'R' ? 1 : 0);
    if (!opt.ok || opt.friendly) continue;
    const aim = opt.canAim ? 'hull' : 'rigging';
    advice.orders.fire = { ...(advice.orders.fire || {}), [side]: aim };
    const rake = opt.sternrake ? ', a stern rake' : opt.rake ? ', a rake' : '';
    const why = opt.canAim ? `The ${st.ships[opt.target].name} bears at range ${opt.range}${rake}.` : `She bears at range ${opt.range}: too far to aim at the hull.`;
    advice.notes.push({ order: `Fire the ${sideName(side)} broadside at her ${aim}`, why });
    advice.commands.push(`f ${sideKey(side)} ${aim === 'hull' ? 'h' : 'r'}`);
  }
  // Every side that is empty, or fired this turn, takes round shot at once.
  const sides = ['L', 'R'].filter((side) => !loaded(ms, side) || advice.orders.fire?.[side]);
  if (!sides.length) return;
  advice.orders.load = Object.fromEntries(sides.map((side) => [side, 'round']));
  const what = sides.length === 2 ? 'both broadsides' : `the ${sideName(sides[0])} broadside`;
  advice.notes.push({ order: `Load ${what} with round shot`, why: 'Round shot reaches ten squares and is ready next turn.' });
  advice.commands.push(sides.length === 2 ? 'ld b r' : `ld ${sideKey(sides[0])} r`);
}

function sailOrder(ms, enemyRange, advice) {
  const wantFull = enemyRange > CHASE_RANGE;
  if (!!ms.FS === wantFull || !ms.specs.rig1) return;
  advice.orders.sails = wantFull ? 'full' : 'battle';
  advice.notes.push(
    wantFull
      ? { order: 'Set full sails', why: `The enemy is ${enemyRange} squares off: close the distance.` }
      : { order: 'Shorten to battle sails', why: 'She is near, and full sails double the damage aloft.' },
  );
  advice.commands.push(`c ${advice.orders.sails}`);
}

function helmOrder(st, me, advice) {
  const helm = suggestHelm(st, me);
  if (!helm?.helm) return;
  advice.orders.move = helm.helm;
  advice.notes.push({
    order: `Helm ${helm.helm}`,
    why: helm.helm === 'd' ? 'No better heading this turn: hold on.' : `Close on the ${st.ships[helm.target].name}.`,
  });
  advice.commands.push(helm.helm);
}

/**
 * @returns {{ orders: object, notes: { order: string, why: string }[], commands: string[] } | null}
 *   null when there is nothing to command (the battle is over, the ship struck or gone).
 */
export function counsel(st, me) {
  const ms = st.ships[me];
  if (!ms || st.over || !ms.dir || ms.struck) return null;
  const advice = { orders: {}, notes: [], commands: [] };
  const enemy = closestenemy(st, ms, 0, 0);
  boardingOrder(st, ms, advice);
  gunneryOrders(st, ms, advice);
  sailOrder(ms, enemy ? range(ms, enemy) : Infinity, advice);
  helmOrder(st, me, advice);
  return advice;
}
