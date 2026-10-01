import type { EventKind, Params, RankId, Rules, RuleSet, SystemId, WatchLength } from './types';

/**
 * Every number a watch is played with, taken from the 1976 program's setup and scaled by rank
 * (the original's skill level) and length. The career adds one idea per rank on top; the
 * classic rule set switches everything on at once, as the original did.
 */

export interface Rank {
  id: RankId;
  title: string;
  /** The original's name for this skill level, kept for the notes and the record screen. */
  originalLevel: string;
}

export const RANKS: readonly Rank[] = [
  { id: 1, title: 'Cadet', originalLevel: 'novice' },
  { id: 2, title: 'Lamplighter', originalLevel: 'fair' },
  { id: 3, title: 'Keeper', originalLevel: 'good' },
  { id: 4, title: 'Head Keeper', originalLevel: 'expert' },
  { id: 5, title: 'Warden', originalLevel: 'commodore' },
  { id: 6, title: 'High Warden', originalLevel: 'impossible' },
];

/** What a promotion from the top rank makes you, as the original promised. */
export const EMERITUS_TITLE = 'Warden Emeritus';

export function rankById(id: number): Rank {
  return RANKS[Math.min(6, Math.max(1, Math.round(id))) - 1]!;
}

const EVERYTHING: Rules = {
  calls: true,
  sieges: true,
  hail: true,
  radioHidesNews: true,
  snare: true,
  collapses: true,
  bursts: true,
  shroud: true,
  redline: true,
  callCapCountsLiveOnly: false,
};

/** The rank at which the career switches each rule on. */
export const RULE_UNLOCKS: Record<Exclude<keyof Rules, 'callCapCountsLiveOnly'>, RankId> = {
  calls: 1,
  sieges: 2,
  hail: 2,
  radioHidesNews: 3,
  snare: 3,
  collapses: 4,
  bursts: 4,
  shroud: 5,
  redline: 6,
};

export function rulesFor(ruleSet: RuleSet, rank: RankId): Rules {
  if (ruleSet === 'classic') return { ...EVERYTHING };
  const rules = { ...EVERYTHING, callCapCountsLiveOnly: true };
  for (const [rule, from] of Object.entries(RULE_UNLOCKS)) {
    rules[rule as keyof typeof RULE_UNLOCKS] = rank >= from;
  }
  return rules;
}

/** Systems in the original's device order, which a critical hit walks to pick its victim. */
export const SYSTEM_ORDER: readonly SystemId[] = [
  'drive',
  'near-sensors',
  'far-sensors',
  'beams',
  'flare-tubes',
  'thrusters',
  'shield',
  'computer',
  'radio',
  'life-support',
  'navigation',
  'shroud',
  'ferry',
  'launch',
];

export const DAMAGE_ODDS: Record<SystemId, number> = {
  drive: 70,
  'near-sensors': 110,
  'far-sensors': 110,
  beams: 125,
  'flare-tubes': 125,
  thrusters: 75,
  shield: 150,
  computer: 20,
  radio: 35,
  'life-support': 30,
  navigation: 20,
  shroud: 50,
  ferry: 80,
  launch: 0,
};

const EVENT_DELAY: Record<EventKind, number> = {
  collapse: 0.5,
  snare: 25,
  'siege-begins': 1,
  'harbour-falls': 3,
  call: 1,
  'world-falls': 0.5,
  'swarm-grows': 2,
  snapshot: 0.5,
  repair: 0,
  raid: 0,
};

/**
 * The career's watches run longer at the higher ranks: the original's swarm grows with skill
 * while its clock did not, which made its top levels a matter of luck more than judgement.
 */
export function commissionDays(rank: RankId, length: WatchLength): number {
  return 6 * length + 2 + CAREER_TUNING.baseExtraDays + CAREER_TUNING.extraDays * (rank - 1);
}

/**
 * The career climbs the original's skill levels more gently: each rank adds `skillStep` to the
 * skill that sets the swarm's size and strength. The classic rule set uses the rank itself.
 */
export const CAREER_TUNING = {
  /** A first watch should be about learning the Reach, not racing its clock. */
  baseExtraDays: 2,
  extraDays: 2,
  skillStep: 0.55,
  minimumAir: 3,
  extraGleaners: 3,
  /** The career's worlds call more often than the original's, so the lights stay in play. */
  callDelay: 0.4,
};

export function skillFor(ruleSet: RuleSet, rank: RankId): number {
  if (ruleSet === 'classic') return rank;
  // The last rank brings its single harbour and the redline, not a stronger swarm.
  return 1 + CAREER_TUNING.skillStep * (Math.min(rank, 5) - 1);
}

/**
 * The parameters that do not depend on chance. The harbour and gleaner counts and the start
 * date are drawn by `newWatch`, which fills them in.
 */
export function baseParams(rank: RankId, length: WatchLength, ruleSet: RuleSet): Params {
  const skill = skillFor(ruleSet, rank);
  const career = ruleSet === 'commission';
  const time = career ? commissionDays(rank, length) : 6 * length + 2;
  const air = (6 - rank) * 2;
  return {
    rank,
    skill,
    length,
    ruleSet,
    rules: rulesFor(ruleSet, rank),
    harbours: 0,
    gleaners: 0,
    date: 0,
    time,
    reserve: 0,
    energy: 5000,
    shield: 1500,
    reserves: career ? Math.max(CAREER_TUNING.minimumAir, air) : air,
    crew: 387,
    holdFree: 400,
    flares: 10,
    damageFactor: Math.log(skill + 0.5),
    mooredRepairFactor: 0.5,
    // The reactor's recovery is a rank's rule: from Warden on it does not recharge in flight.
    regen: Math.max(0, (5 - rank) * 0.05),
    driveTime: 10,
    stopEnergy: 50,
    shieldUpEnergy: 40,
    gleanerPower: Math.round(100 + 150 * skill + (skill >= 6 ? 150 : 0)),
    gleanerFatigue: 0.8,
    moveChance: [45, 40, 40, 25 + 5 * skill, 0, 10 + 10 * skill],
    moveFactor: [0.09, -0.05, 0.075, -0.06 * skill, 0, 0.25],
    eventDelay: career ? { ...EVENT_DELAY, call: CAREER_TUNING.callDelay } : { ...EVENT_DELAY },
    navigationDrift: [1.5, 0.75],
    shroudEnergy: 1000,
    damageOdds: { ...DAMAGE_ODDS },
    hitFactor: 0.5,
    gleanerCargo: 200,
    hailChance: 0.0035,
    lowEnergy: 1000,
  };
}
