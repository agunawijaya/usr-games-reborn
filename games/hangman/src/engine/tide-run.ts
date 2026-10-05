import { type Round, newRound, WAVES_ALLOWED } from './round';

/**
 * A Tide run: ten words in a row against one castle. Waves no longer reset between words: each
 * wrong letter (or Lighthouse) takes a section for the rest of the run, and a clean word, one
 * with no waves at all, repairs a section. The run ends when the castle falls or the tenth word
 * is found.
 */
export const RUN_LENGTH = 10;
export const CASTLE_SECTIONS = WAVES_ALLOWED;

export type RunStatus = 'playing' | 'castle-fell' | 'complete';

export interface TideRun {
  readonly words: readonly string[];
  /** Index of the word in play. */
  readonly index: number;
  /** Sections still standing at the start of the word in play. */
  readonly standing: number;
  readonly found: number;
  readonly cleanWords: number;
  readonly repairs: number;
  readonly status: RunStatus;
}

export function startRun(words: readonly string[]): TideRun {
  if (words.length < RUN_LENGTH) throw new Error(`a run needs ${RUN_LENGTH} words`);
  return {
    words: words.slice(0, RUN_LENGTH),
    index: 0,
    standing: CASTLE_SECTIONS,
    found: 0,
    cleanWords: 0,
    repairs: 0,
    status: 'playing',
  };
}

/** The round for the word in play: it may take only as many waves as sections still stand. */
export function runRound(run: TideRun): Round {
  return newRound(run.words[run.index]!, run.standing);
}

/** Folds a finished round into the run and moves on to the next word (or ends the run). */
export function finishRunWord(run: TideRun, round: Round): TideRun {
  if (round.status === 'playing') throw new Error('the word is still in play');
  const standingAfterWaves = run.standing - Math.min(round.waves, run.standing);
  if (round.status === 'lost' || standingAfterWaves === 0) {
    return { ...run, standing: 0, status: 'castle-fell' };
  }
  const clean = round.waves === 0;
  const repaired = clean && standingAfterWaves < CASTLE_SECTIONS;
  const found = run.found + 1;
  return {
    ...run,
    index: run.index + 1,
    standing: standingAfterWaves + (repaired ? 1 : 0),
    found,
    cleanWords: run.cleanWords + (clean ? 1 : 0),
    repairs: run.repairs + (repaired ? 1 : 0),
    status: found >= RUN_LENGTH ? 'complete' : 'playing',
  };
}
