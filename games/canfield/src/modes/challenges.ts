import type { CardId } from '@usr-games/kit/cards';
import { cardsHome, type Game } from '../engine/game';
import type { From, Move, RuleSet, TableauIndex } from '../engine/rules';
import data from './challenges.json';

/**
 * Twenty-four hand-picked deals, each with a goal. Every one ships with a proof: a line of play,
 * found by the solver, that meets its goal, so no challenge asks for the impossible. The deals
 * come from `scripts/make-challenges.ts`; those that ask for a single pass were shaped by swapping
 * cards until such a win existed, as random deals almost never allow one.
 */

export type Condition =
  | { kind: 'win' }
  | { kind: 'no-insight' }
  /** No undo and no hints. */
  | { kind: 'clean-hands' }
  | { kind: 'max-passes'; passes: number }
  | { kind: 'time'; seconds: number }
  | { kind: 'reserve-first-pass' }
  | { kind: 'cards-home'; count: number };

export interface Challenge {
  id: string;
  number: number;
  set: string;
  title: string;
  rules: RuleSet;
  conditions: Condition[];
  deal: CardId[];
  /** A line of play that meets the goal, in the compact form below. */
  proof: string[];
}

export const CHALLENGES: readonly Challenge[] = data as Challenge[];

export function challengeById(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

/** The goal in plain words: "Win in at most two passes, without Insight." */
export function goalText(conditions: readonly Condition[]): string {
  const win = conditions.some((c) => c.kind === 'win');
  const parts: string[] = [];
  for (const c of conditions) {
    switch (c.kind) {
      case 'max-passes':
        parts.push(
          c.passes === 1 ? 'in a single pass' : `in at most ${WORDS[c.passes] ?? c.passes} passes`,
        );
        break;
      case 'time':
        parts.push(`in under ${WORDS[c.seconds / 60] ?? c.seconds / 60} minutes`);
        break;
      case 'no-insight':
        parts.push('without Insight');
        break;
      case 'clean-hands':
        parts.push('without undo or hints');
        break;
      default:
        break;
    }
  }
  const home = conditions.find((c) => c.kind === 'cards-home');
  if (home && home.kind === 'cards-home') return `Get ${home.count} cards home.`;
  if (conditions.some((c) => c.kind === 'reserve-first-pass') && !win)
    return 'Empty the reserve before the talon turns over.';
  return `Win ${parts.join(', ')}`.trim().replace(/ $/, '') + '.';
}

/** Whether a deal, finished or still going, has met every condition of a challenge. */
export function conditionsMet(
  conditions: readonly Condition[],
  game: Game,
  elapsedMs: number,
): boolean {
  return conditions.every((c) => {
    switch (c.kind) {
      case 'win':
        return game.ending === 'won';
      case 'no-insight':
        return !game.insightUsed;
      case 'clean-hands':
        return game.counters.undos === 0 && game.counters.hints === 0;
      case 'max-passes':
        return game.layout.run <= c.passes;
      case 'time':
        return elapsedMs < c.seconds * 1000;
      case 'reserve-first-pass':
        return game.reserveClearedInRun === 1;
      case 'cards-home':
        return cardsHome(game) >= c.count;
    }
  });
}

/** A goal with no win in it is met the moment it happens, mid-deal. */
export function metBeforeTheEnd(conditions: readonly Condition[]): boolean {
  return !conditions.some((c) => c.kind === 'win');
}

// —— the compact form of a line of play: `d`, `sf`, `t3`, `24`, `24:2` ——

function source(from: From): string {
  return from === 'stock' ? 's' : from === 'talon' ? 't' : String(from + 1);
}

function sourceOf(char: string): From | null {
  if (char === 's') return 'stock';
  if (char === 't') return 'talon';
  if (char >= '1' && char <= '4') return (Number(char) - 1) as TableauIndex;
  return null;
}

export function encodeMove(move: Move): string {
  if (move.kind === 'deal') return 'd';
  if (move.kind === 'home') return `${source(move.from)}f`;
  const base = `${source(move.from)}${move.to + 1}`;
  return move.count > 1 ? `${base}:${move.count}` : base;
}

export function decodeMove(text: string): Move | null {
  if (text === 'd') return { kind: 'deal' };
  const from = sourceOf(text[0] ?? '');
  if (from === null) return null;
  if (text[1] === 'f') return { kind: 'home', from };
  const to = sourceOf(text[1] ?? '');
  if (typeof to !== 'number') return null;
  const count = text.includes(':') ? Number(text.split(':')[1]) : 1;
  return { kind: 'build', from, to, count };
}
