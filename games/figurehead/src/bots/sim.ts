import { type Battle, createBattle, resolveTurn } from '../engine';
import type { Encounter } from '../voyage/encounters';
import {
  chapterOptions,
  chooseRefit,
  closeChapter,
  launchLife,
  lifeEncounter,
  type PrizeOffer,
  readBattle,
} from '../voyage/life';
import { addEvents, emptyTally, type Tally } from '../voyage/tally';
import type { Life } from '../voyage/types';
import { advise, type BotStyle } from './captain';

/**
 * Seeded simulations: a bot captain fights an encounter, or sails a whole life from launch to
 * epilogue. Used by the balance tests and `pnpm --filter @usr-games/game-figurehead sim`.
 */

export interface Played {
  battle: Battle;
  tally: Tally;
}

/**
 * 'idle' only drifts, a floor to measure against; 'computer' hands her to one of the original's
 * own captains, the yardstick the bots should beat.
 */
export type SimStyle = BotStyle | 'idle' | 'computer';

export function playEncounter(encounter: Encounter, style: SimStyle): Played {
  let battle = createBattle(encounter.setup);
  if (style === 'computer') battle.ships[battle.player]!.role = 'attack';
  let tally = emptyTally();
  for (let guard = 0; !battle.over && guard < 400; guard++) {
    const orders =
      style === 'idle' || style === 'computer' ? { helm: 'd' } : advise(battle, style).orders;
    const result = resolveTurn(battle, orders);
    tally = addEvents(tally, result.battle, result.events);
    battle = result.battle;
  }
  return { battle, tally };
}

/** The bot's prize crews: enough to keep a prize that can serve, else enough to bring her home. */
export function botPrizeCrews(prizes: readonly PrizeOffer[], spare: number): number[] {
  let left = spare;
  return prizes.map((p) => {
    const want = p.canServe && left >= p.keep ? p.keep : p.need;
    const sent = left >= want ? want : 0;
    left -= sent;
    return sent;
  });
}

export function playLife(
  seed: string,
  style: SimStyle,
  pick: (options: number) => number = () => 0,
): Life {
  let life = launchLife({
    id: seed,
    dateKey: '2026-10-04',
    shipName: 'Kittiwake',
    captain: 'Sim',
    figurehead: 'fox',
  });
  for (let guard = 0; !life.ending && guard < 40; guard++) {
    if (life.dockyard) life = chooseRefit(life, life.dockyard[0]!);
    const options = chapterOptions(life);
    const encounter = lifeEncounter(life, options[pick(options.length) % options.length]!);
    const { battle, tally } = playEncounter(encounter, style);
    const outcome = readBattle(life, encounter, battle, tally);
    life = closeChapter(life, outcome, battle, botPrizeCrews(outcome.prizes, outcome.spare)).life;
  }
  return life;
}
