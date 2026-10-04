import { type Battle, type BattleEvent, capship, crewOf } from '../engine';
import type { Encounter, MentionDef } from './encounters';
import type { MentionRecord, PrizeCondition } from './types';

/**
 * What a battle came to, counted from its events as they happen: broadsides, rakes, masts
 * brought down. With the final battle state it decides the chapter's mentions.
 */

export interface Tally {
  broadsides: number;
  hits: number;
  rakes: number;
  sternRakes: number;
  /** Enemy ships the player's broadsides left with no mast standing. */
  dismasted: number[];
  /** The player's ship lost a mast at some point. */
  mastLost: boolean;
  signals: number;
}

export const emptyTally = (): Tally => ({
  broadsides: 0,
  hits: 0,
  rakes: 0,
  sternRakes: 0,
  dismasted: [],
  mastLost: false,
  signals: 0,
});

export function addEvents(tally: Tally, battle: Battle, events: readonly BattleEvent[]): Tally {
  const me = battle.player;
  const next = { ...tally, dismasted: [...tally.dismasted] };
  for (const e of events) {
    if (e.t === 'fire' && e.from === me) {
      next.broadsides++;
      if (e.damage) next.hits++;
      if (e.rake) next.rakes++;
      if (e.sternRake) next.sternRakes++;
      if (e.damage?.dismasted && !next.dismasted.includes(e.to)) next.dismasted.push(e.to);
    }
    if ((e.t === 'fire' || e.t === 'blast') && e.to === me && e.damage) {
      const lost = e.damage.after.rig.some((r, i) => r === 0 && e.damage!.before.rig[i]! > 0);
      if (lost) next.mastLost = true;
    }
    if (e.t === 'signal') next.signals++;
  }
  return next;
}

/** Prize condition by the hull she has left. */
export function conditionOf(hull: number, maxHull: number): PrizeCondition {
  const share = maxHull > 0 ? hull / maxHull : 0;
  if (share >= 0.5) return 'whole';
  if (share >= 0.2) return 'sound';
  return 'battered';
}

/** Enemy ships the player's side holds at the end: taken by boarding, or struck and afloat. */
export function prizesTaken(battle: Battle): number[] {
  if (battle.player < 0) return [];
  const me = battle.ships[battle.player]!;
  return battle.ships
    .filter(
      (sp) =>
        sp.nation !== me.nation &&
        sp.dir !== 0 &&
        !sp.sink &&
        !sp.explode &&
        (sp.captured >= 0 ? capship(battle, sp).nation === me.nation : sp.struck),
    )
    .map((sp) => sp.index);
}

/** Ships of the player's side, other than her own and the merchantmen. */
export function squadronShips(battle: Battle): number[] {
  if (battle.player < 0) return [];
  const me = battle.ships[battle.player]!;
  return battle.ships
    .filter(
      (sp) =>
        sp !== me &&
        sp.nation === me.nation &&
        sp.role !== 'merchant' &&
        sp.index !== battle.retake,
    )
    .map((sp) => sp.index);
}

export function crewLossShare(battle: Battle): number {
  if (battle.player < 0) return 0;
  const me = battle.ships[battle.player]!;
  return me.startCrew > 0 ? 1 - crewOf(me) / me.startCrew : 0;
}

export function judgeMentions(encounter: Encounter, battle: Battle, tally: Tally): MentionRecord[] {
  const won = battle.end?.win === true;
  const prizes = prizesTaken(battle);
  const enemies = battle.ships.filter(
    (sp) => battle.player >= 0 && sp.nation !== battle.ships[battle.player]!.nation,
  );
  const squadron = squadronShips(battle);
  const lostAlly = squadron.some((i) => {
    const sp = battle.ships[i]!;
    return sp.dir === 0 ? !sp.escaped : sp.struck || capship(battle, sp).nation !== sp.nation;
  });
  const judge = (m: MentionDef): boolean => {
    switch (m.id) {
      case 'won':
        return won;
      case 'whole':
        return prizes.some((i) => {
          const sp = battle.ships[i]!;
          return conditionOf(sp.specs.hull, sp.max.hull) === 'whole';
        });
      case 'masts':
        return won && !tally.mastLost;
      case 'rake':
        return tally.rakes > 0;
      case 'stern-rake':
        return tally.sternRakes > 0;
      case 'quick':
        return won && battle.turn <= (m.turns ?? 0);
      case 'all-merchants': {
        const merchants = battle.ships.filter((sp) => sp.role === 'merchant');
        return (
          won &&
          merchants.every(
            (sp) =>
              battle.safe.includes(sp.index) || (sp.dir !== 0 && !sp.struck && sp.captured < 0),
          )
        );
      }
      case 'both':
        return enemies.length >= 2 && prizes.length >= 2;
      case 'squadron-whole':
        return won && !lostAlly;
      case 'big-prize':
        return prizes.some((i) => battle.ships[i]!.specs.cls <= 2);
      case 'three-prizes':
        return prizes.length >= 3;
      case 'bare-poles':
        return tally.dismasted.length > 0;
      case 'in-company': {
        if (!won) return false;
        const me = battle.ships[battle.player]!;
        return squadron.every((i) => {
          const sp = battle.ships[i]!;
          return sp.dir !== 0 && Math.abs(sp.row - me.row) + Math.abs(sp.col - me.col) <= 8;
        });
      }
      case 'light-losses':
        return battle.end?.win !== false && crewLossShare(battle) < 0.25;
    }
  };
  return encounter.mentions.map((m) => ({
    id: m.id,
    earned: judge(m),
    ...(m.turns ? { turns: m.turns } : {}),
  }));
}
