import type { GridSize, Rule } from '../engine/grid';
import { HUNTERS, type Strength } from '../engine/hunter';

/**
 * The ways to play, and the plan a round is dealt from. A plan is plain data: the round
 * screen, the solver worker and the records all read the same one.
 */
export type ModeId = 'tutorial' | 'classic' | 'zen' | 'daily' | 'duel' | 'pass';

export interface RoundPlan {
  mode: ModeId;
  size: GridSize;
  rule: Rule;
  minLetters: number;
  /** Seconds on the clock, or null when untimed (Zen). */
  seconds: number | null;
  seed: string;
  /** Duel only: the hunter's strength. */
  strength?: Strength;
  /** Pass and play only: the two players, in turn order. */
  players?: readonly [string, string];
  /** Daily only: the date it belongs to, and its public number. */
  dateKey?: string;
  dailyNumber?: number;
}

/** Three minutes on the 1988 board; a minute more for each larger grid. */
export const CLOCK_SECONDS: Record<GridSize, number> = { 4: 180, 5: 240, 6: 300 };
export const TUTORIAL_SECONDS = 60;

export const GRID_NAMES: Record<GridSize, string> = { 4: '4×4', 5: 'Big grid', 6: 'Mega grid' };

export interface RuleCard {
  rule: Rule;
  name: string;
  text: string;
}

export const RULE_CARDS: Record<Rule, RuleCard> = {
  classic: { rule: 'classic', name: 'Classic', text: 'Each cube once per word.' },
  echo: {
    rule: 'echo',
    name: 'Echo',
    text: 'A cube may come back in the same word, but never twice in a row.',
  },
  mirror: {
    rule: 'mirror',
    name: 'Mirror',
    text: 'A cube counts as its own neighbour: it may repeat straight away.',
  },
};

export const MIN_LETTER_CHOICES = [3, 4, 5] as const;

/** Rounds that count towards the board-reading level: timed, three-letter words. */
export function countsTowardsLevel(plan: RoundPlan): boolean {
  return (
    plan.seconds !== null &&
    plan.minLetters === 3 &&
    (plan.mode === 'classic' || plan.mode === 'daily' || plan.mode === 'duel')
  );
}

function gridLabel(size: GridSize): string {
  return size === 4 ? '4×4' : `${GRID_NAMES[size]} ${size}×${size}`;
}

/** The short line naming a round: "Classic · 4×4", "Daily Grid #42", "Duel · Reader". */
export function modeLabel(plan: RoundPlan): string {
  const twist = plan.rule === 'classic' ? '' : ` · ${RULE_CARDS[plan.rule].name}`;
  const shortest = plan.minLetters === 3 ? '' : ` · ${plan.minLetters}+ letters`;
  switch (plan.mode) {
    case 'tutorial':
      return 'Tutorial';
    case 'daily':
      return `Daily Grid #${plan.dailyNumber ?? ''}`;
    case 'duel':
      return `Duel · ${HUNTERS[plan.strength ?? 3].name} · ${gridLabel(plan.size)}${twist}`;
    case 'pass':
      return `Pass and play · ${gridLabel(plan.size)}${twist}`;
    case 'zen':
      return `Zen · ${gridLabel(plan.size)}${twist}${shortest}`;
    case 'classic':
      return `Classic · ${gridLabel(plan.size)}${twist}${shortest}`;
  }
}

export function ruleLine(plan: RoundPlan): string {
  const card = RULE_CARDS[plan.rule];
  const shortest = plan.minLetters === 3 ? '' : ` Words of ${plan.minLetters} letters or more.`;
  return `${card.text}${shortest}`;
}
