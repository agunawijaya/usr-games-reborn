import type { Action, Step } from '../engine/types';
import { canStepClassic, mustTeleportClassic } from './classic-sense';
import type { Mind, RivalProfile } from './types';

/**
 * Pip plays the original's hidden "pattern roll" experiment: run as far as possible in one
 * direction, then the next letter of Y H B J N L U K, round and round, teleporting only when
 * every square is deadly. The Pattern Lab hands the same engine a pattern of your own.
 */
export const PIP: RivalProfile = {
  id: 'pip',
  name: 'Pip',
  style: 'Runs as far as she can one way, then turns to the next of eight directions.',
  origin: 'The original’s hidden pattern-roll experiment (Y H B J N L U K).',
};

export const PIP_PATTERN = 'YHBJNLUK';

export const PATTERN_LETTERS = ['Y', 'K', 'U', 'H', 'L', 'B', 'J', 'N'] as const;
export type PatternLetter = (typeof PATTERN_LETTERS)[number];

const DIRECTION: Record<PatternLetter, readonly [Step, Step]> = {
  Y: [-1, -1],
  K: [0, -1],
  U: [1, -1],
  H: [-1, 0],
  L: [1, 0],
  B: [-1, 1],
  J: [0, 1],
  N: [1, 1],
};

export function directionOf(letter: PatternLetter): readonly [Step, Step] {
  return DIRECTION[letter];
}

export function isPattern(text: string): text is string {
  return text.length >= 1 && text.length <= 8 && [...text].every((c) => c in DIRECTION);
}

const STAY: Action = { type: 'step', dx: 0, dy: 0 };
const ZOOM: Action = { type: 'zoom' };

/**
 * A faithful reading of get_move under pattern roll. `next` points at the current letter
 * (−1 before the first); `running` is the direction of the run in progress. When the pattern
 * comes back round to the letter it started this turn on, the original stopped and asked the
 * human; Pip stays put instead, or zooms if staying is deadly.
 */
export function createPatternMind(pattern: string): Mind {
  const letters = [...pattern] as PatternLetter[];
  let next = -1;
  let running: PatternLetter | null = null;

  return {
    newRoom() {
      running = null;
    },
    decide(state) {
      const lastMove = next >= 0 ? letters[next] : null;
      // Each pass either returns, starts a run or moves the pointer, so the pattern bounds it.
      for (let guard = 0; guard < letters.length * 2 + 4; guard++) {
        if (mustTeleportClassic(state)) {
          running = null;
          return ZOOM;
        }
        if (running) {
          const [dx, dy] = DIRECTION[running];
          if (canStepClassic(state, dx, dy)) return { type: 'step', dx, dy };
          running = null;
          continue;
        }
        next += 1;
        if (next >= letters.length) {
          if (lastMove === null) break;
          next = 0;
        }
        const letter = letters[next]!;
        if (letter === lastMove) break;
        running = letter;
      }
      return canStepClassic(state, 0, 0) ? STAY : ZOOM;
    },
  };
}

export function createPip(): Mind {
  return createPatternMind(PIP_PATTERN);
}
