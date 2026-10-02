// Commendations: standing orders judged against the battle's logbook (logbook.js) and the final
// state. The first is always the win; the others count only on a won action. Pure.

/**
 * @typedef {{ kind: 'win' }
 *   | { kind: 'turns', within: number }
 *   | { kind: 'hull', atLeast: number }
 *   | { kind: 'rakes', atLeast: number }
 *   | { kind: 'sternRake' }
 *   | { kind: 'prizes', atLeast: number }
 *   | { kind: 'boarded' }
 *   | { kind: 'masts' }
 *   | { kind: 'noRepair' }
 *   | { kind: 'crew', atLeast: number }
 *   | { kind: 'broadsides', atMost: number }} Commendation
 */

const pct = (value, max) => (max > 0 ? Math.round((100 * value) / max) : 0);
const crewOf = (sp) => sp.specs.crew1 + sp.specs.crew2 + sp.specs.crew3;
const won = (st) => st.over && st.result?.reason === 'victory';

/** @param {Commendation} c */
export function describeCommendation(c) {
  switch (c.kind) {
    case 'win':
      return 'Win the action';
    case 'turns':
      return `Win by turn ${c.within}`;
    case 'hull':
      return `Keep the hull at ${c.atLeast}% or better`;
    case 'rakes':
      return c.atLeast === 1 ? 'Rake the enemy' : `Rake the enemy ${c.atLeast} times`;
    case 'sternRake':
      return 'Rake an enemy from astern';
    case 'prizes':
      return c.atLeast === 1 ? 'Take a prize' : `Take ${c.atLeast} prizes`;
    case 'boarded':
      return 'Take a prize by boarding';
    case 'masts':
      return 'Keep every mast standing';
    case 'noRepair':
      return 'Never stop to repair';
    case 'crew':
      return `Keep ${c.atLeast}% of your crew`;
    case 'broadsides':
      return `Win with ${c.atMost} broadsides or fewer`;
    default:
      return '';
  }
}

/** A few words for the narrow strip on the HUD. */
export function shortCommendation(c) {
  switch (c.kind) {
    case 'win':
      return 'Win';
    case 'turns':
      return `By turn ${c.within}`;
    case 'hull':
      return `Hull ${c.atLeast}%+`;
    case 'rakes':
      return c.atLeast === 1 ? 'A rake' : `${c.atLeast} rakes`;
    case 'sternRake':
      return 'Stern rake';
    case 'prizes':
      return c.atLeast === 1 ? 'A prize' : `${c.atLeast} prizes`;
    case 'boarded':
      return 'Board a prize';
    case 'masts':
      return 'Every mast';
    case 'noRepair':
      return 'No repairs';
    case 'crew':
      return `Crew ${c.atLeast}%+`;
    case 'broadsides':
      return `${c.atMost} broadsides max`;
    default:
      return '';
  }
}

/** Whether the condition holds right now, ignoring the win. */
function holds(c, st, me, log) {
  const ms = st.ships[me];
  switch (c.kind) {
    case 'win':
      return won(st);
    case 'turns':
      return st.turn <= c.within;
    case 'hull':
      return pct(ms.specs.hull, ms.max.hull) >= c.atLeast;
    case 'rakes':
      return log.rakes >= c.atLeast;
    case 'sternRake':
      return log.sternRakes >= 1;
    case 'prizes':
      return log.struckToGuns + log.boardedPrizes >= c.atLeast;
    case 'boarded':
      return log.boardedPrizes >= 1;
    case 'masts':
      return !log.mastLost;
    case 'noRepair':
      return log.repairs === 0;
    case 'crew':
      return pct(crewOf(ms), log.startCrew) >= c.atLeast;
    case 'broadsides':
      return log.broadsides <= c.atMost;
    default:
      return false;
  }
}

/** Earned at the end of the battle. @param {Commendation} c */
export function judgeCommendation(c, st, me, log) {
  return won(st) && holds(c, st, me, log);
}

/** Things that, once true, stay true: met mid-battle means met for good (if the action is won). */
const ONCE_MET = new Set(['rakes', 'sternRake', 'prizes', 'boarded']);
/** Things that, once false, stay false. */
const ONCE_LOST = new Set(['turns', 'masts', 'noRepair', 'broadsides']);

/**
 * How a commendation stands mid-battle, for the strip: `met`, `lost` for good, or `open`.
 * @param {Commendation} c
 */
export function commendationStatus(c, st, me, log) {
  if (st.over) return judgeCommendation(c, st, me, log) ? 'met' : 'lost';
  if (c.kind === 'win') return 'open';
  const now = holds(c, st, me, log);
  if (ONCE_MET.has(c.kind)) return now ? 'met' : 'open';
  if (ONCE_LOST.has(c.kind)) return now ? 'open' : 'lost';
  return 'open';
}

/** A count to show beside the commendation on the strip, where one helps. */
export function commendationProgress(c, st, me, log) {
  const ms = st.ships[me];
  switch (c.kind) {
    case 'turns':
      return `turn ${st.turn}`;
    case 'hull':
      return `${pct(ms.specs.hull, ms.max.hull)}%`;
    case 'rakes':
      return `${log.rakes}/${c.atLeast}`;
    case 'prizes':
      return `${log.struckToGuns + log.boardedPrizes}/${c.atLeast}`;
    case 'crew':
      return `${pct(crewOf(ms), log.startCrew)}%`;
    case 'broadsides':
      return `${log.broadsides}`;
    default:
      return '';
  }
}
