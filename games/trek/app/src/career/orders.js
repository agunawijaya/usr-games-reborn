// Deep Space Command — the mission log and its commendations. The log counts what a mission
// did from the commands the player gave and the effects the engine returned; a commendation is
// a standing order judged against that log when the mission ends. Pure: no DOM, no storage.

/** Commands that act in the world. Scans, reports, the computer and help are free. */
export const ORDER_ACTIONS = new Set([
  'phaser',
  'torpedo',
  'move',
  'dock',
  'shieldUp',
  'shieldDown',
  'shieldTransfer',
]);

const charted = (game) => game.galaxy.quadrants.flat().filter((q) => q.scanned).length;

/** A fresh log for a mission that has just begun. */
export function createLog(game) {
  return {
    orders: 0,
    docks: 0,
    torpedoesFired: 0,
    torpedoKills: 0,
    phaserVolleys: 0,
    lowestHull: game.ship.hull,
    chartedAtStart: charted(game),
    charted: charted(game),
  };
}

/** Records one carried-out command and the effects it had. */
export function noteOrder(log, game, action, effects) {
  if (ORDER_ACTIONS.has(action)) log.orders += 1;
  for (const effect of effects) {
    if (effect.type === 'dock') log.docks += 1;
    if (effect.type === 'torpedo') {
      log.torpedoesFired += 1;
      if (effect.destroyedKlingon) log.torpedoKills += 1;
    }
    if (effect.type === 'phaser') log.phaserVolleys += 1;
  }
  log.lowestHull = Math.min(log.lowestHull, game.ship.hull);
  log.charted = charted(game);
}

/**
 * A commendation: `win` is always the first; the others are standing orders that only count on
 * a won mission.
 * @typedef {{ kind: 'win' }
 *   | { kind: 'hull', atLeast: number }
 *   | { kind: 'noDock' }
 *   | { kind: 'spare', stardates: number }
 *   | { kind: 'orders', under: number }
 *   | { kind: 'torpedoes', atMost: number }
 *   | { kind: 'torpedoKills', atLeast: number }
 *   | { kind: 'energy', atLeast: number }
 *   | { kind: 'charted', atLeast: number }} Commendation
 */

/** @param {Commendation} c */
export function describeCommendation(c) {
  switch (c.kind) {
    case 'win':
      return 'Clear the sector';
    case 'hull':
      return `Bring her home with the hull at ${c.atLeast}% or better`;
    case 'noDock':
      return 'Never dock';
    case 'spare':
      return `Finish with ${c.stardates} stardates to spare`;
    case 'orders':
      return `Win in fewer than ${c.under} orders`;
    case 'torpedoes':
      return c.atMost === 0 ? 'Phasers only: fire no torpedoes' : `Fire ${c.atMost} torpedoes or fewer`;
    case 'torpedoKills':
      return `Destroy ${c.atLeast} ships with torpedoes`;
    case 'energy':
      return `Keep ${c.atLeast.toLocaleString('en')} energy in reserve`;
    case 'charted':
      return `Chart ${c.atLeast} quadrants`;
    default:
      return '';
  }
}

/** Whether a commendation was earned, at the end of a mission. @param {Commendation} c */
export function judgeCommendation(c, game, log) {
  if (!game.won) return false;
  switch (c.kind) {
    case 'win':
      return true;
    case 'hull':
      return game.ship.hull >= c.atLeast;
    case 'noDock':
      return log.docks === 0;
    case 'spare':
      return game.stardateEnd - game.stardate >= c.stardates;
    case 'orders':
      return log.orders < c.under;
    case 'torpedoes':
      return log.torpedoesFired <= c.atMost;
    case 'torpedoKills':
      return log.torpedoKills >= c.atLeast;
    case 'energy':
      return game.ship.energy >= c.atLeast;
    case 'charted':
      return log.charted >= c.atLeast;
    default:
      return false;
  }
}

/**
 * How a commendation stands mid-mission, for the briefing strip on the HUD: `kept`, `lost` for
 * good, or `open` while it could still go either way.
 * @param {Commendation} c
 */
export function commendationStatus(c, game, log) {
  if (game.won) return judgeCommendation(c, game, log) ? 'kept' : 'lost';
  if (game.lost) return 'lost';
  switch (c.kind) {
    case 'noDock':
      return log.docks === 0 ? 'open' : 'lost';
    case 'orders':
      return log.orders < c.under ? 'open' : 'lost';
    case 'torpedoes':
      return log.torpedoesFired <= c.atMost ? 'open' : 'lost';
    case 'torpedoKills':
      return log.torpedoKills >= c.atLeast ? 'kept' : 'open';
    case 'charted':
      return log.charted >= c.atLeast ? 'kept' : 'open';
    case 'spare':
      return game.stardateEnd - game.stardate >= c.stardates ? 'open' : 'lost';
    default:
      return 'open';
  }
}
