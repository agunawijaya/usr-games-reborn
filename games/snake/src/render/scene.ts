import { chaseView, isAsleep, type Round } from '../engine/round';
import { boldnessChance } from '../engine/snake';
import type { ViewScene } from './garden-view';
import type { GlintTier } from './glint';
import type { Look } from './look';
import { hash } from './noise';
import type { SnakeMood } from './snake';

/**
 * What a glint looks like follows what it is worth: copper and gold coins in the shallow
 * chambers, emeralds, rubies and star sapphires further down. Each glint's square picks between
 * two neighbouring kinds so a chamber never looks uniform.
 */
export function glintTier(round: Round, index: number): GlintTier {
  const glint = round.glints[index]!;
  const base = round.chunk < 40 ? 0 : round.chunk < 55 ? 1 : round.chunk < 70 ? 2 : 3;
  return (base + (hash(glint.x, glint.y, 7) < 0.5 ? 0 : 1)) as GlintTier;
}

/** How full the satchel looks: ten glints is bursting. */
export function fullness(round: Round): number {
  return Math.min(1, round.loot / 250);
}

export function boldnessOf(round: Round): number {
  return isAsleep(round) ? 0 : boldnessChance(round.snake[0]!, chaseView(round));
}

export function moodOf(round: Round): SnakeMood {
  if (isAsleep(round)) return 'asleep';
  return boldnessOf(round) >= 0.25 ? 'bold' : 'curious';
}

export function sceneFor(
  round: Round,
  look: Look,
  seed: number,
  extras: Partial<ViewScene> = {},
): ViewScene {
  return {
    round,
    look,
    tiers: round.glints.map((_, i) => glintTier(round, i)),
    fullness: fullness(round),
    boldness: boldnessOf(round),
    mood: moodOf(round),
    strikes: null,
    peek: null,
    pose: 'idle',
    facing: 1,
    moment: null,
    seed,
    ...extras,
  };
}
