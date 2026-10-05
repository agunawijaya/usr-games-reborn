import { createRng, type Rng } from '@usr-games/kit';
import { deckById } from '../decks/decks';
import { isUnsuitable } from '../decks/screen';
import {
  checkSecret,
  type Duel,
  duelRound,
  isDuelOver,
  nextSetter,
  recordTurn,
  type SecretProblem,
  startDuel,
} from '../engine/duel';
import {
  guess,
  type GuessOutcome,
  type LighthouseOutcome,
  newRound,
  type Round,
  useLighthouse,
} from '../engine/round';
import { addWord, EMPTY_TALLY, type Tally, wordScore } from '../engine/score';
import { finishRunWord, runRound, startRun, type TideRun } from '../engine/tide-run';
import type { Mode } from './records';
import type { TierChoice } from './saves';
import { classicWords, dailyWordFor, pickFresh, runWords, TUTORIAL_WORD, wordsOf } from './words';

/**
 * One visit to the beach in one mode: the words, the castle's waves, the tide average, and
 * whatever the mode adds (a Tide run's lasting castle, a Duel's turns). Pure state and rules;
 * the play screen draws it and the director animates it.
 */
export interface SessionSpec {
  mode: Mode;
  deckId: string;
  tier: TierChoice;
  seed: string;
  dailyNumber: number;
  recent: readonly string[];
  duel?: { names: [string, string]; turnsEach: number };
}

export interface WordResult {
  word: string;
  deckId: string;
  won: boolean;
  waves: number;
  wavesAllowed: number;
  lighthouseUses: number;
  score: number;
}

/** Waiting for a Duel's secret word, playing a word, between words, or finished. */
export type Phase = 'secret' | 'playing' | 'word-over' | 'over';

export class Session {
  readonly rng: Rng;
  round: Round;
  tally: Tally = EMPTY_TALLY;
  readonly words: WordResult[] = [];
  run: TideRun | null = null;
  duel: Duel | null = null;
  phase: Phase = 'playing';
  readonly startedAt = Date.now();
  private readonly recent: string[];

  constructor(readonly spec: SessionSpec) {
    this.rng = createRng(spec.seed);
    this.recent = [...spec.recent];
    if (spec.mode === 'run') {
      this.run = startRun(runWords(spec.deckId, this.recent, this.rng));
      this.round = runRound(this.run);
    } else if (spec.mode === 'duel') {
      const setup = spec.duel ?? { names: ['Player 1', 'Player 2'], turnsEach: 2 };
      this.duel = startDuel(setup.names, setup.turnsEach);
      this.round = newRound('sand');
      this.phase = 'secret';
    } else {
      this.round = newRound(this.pickWord());
    }
  }

  get mode(): Mode {
    return this.spec.mode;
  }

  /** The deck the word in play came from. */
  get deckId(): string {
    if (this.mode === 'beach' || this.mode === 'run') return this.spec.deckId;
    return this.mode === 'duel' ? 'duel' : 'core';
  }

  /** The Lighthouse shines in Beach day, Tide runs and the tutorial, never in the Daily, Classic or a Duel. */
  get lighthouseAllowed(): boolean {
    return this.mode === 'beach' || this.mode === 'run' || this.mode === 'tutorial';
  }

  private pickWord(): string {
    switch (this.mode) {
      case 'tutorial':
        return TUTORIAL_WORD;
      case 'daily':
        return dailyWordFor(this.spec.dailyNumber);
      case 'classic':
        return pickFresh(classicWords(), this.recent, this.rng);
      default:
        return pickFresh(
          wordsOf(deckById(this.spec.deckId), this.spec.tier),
          this.recent,
          this.rng,
        );
    }
  }

  guess(input: string): GuessOutcome {
    if (this.phase !== 'playing') return { kind: 'over' };
    const outcome = guess(this.round, input);
    if (outcome.kind === 'hit' || outcome.kind === 'miss') {
      this.round = outcome.round;
      if (this.round.status !== 'playing') this.endWord();
    }
    return outcome;
  }

  lighthouse(): LighthouseOutcome | null {
    if (this.phase !== 'playing' || !this.lighthouseAllowed) return null;
    const outcome = useLighthouse(this.round);
    if (!outcome) return null;
    this.round = outcome.round;
    if (this.round.status !== 'playing') this.endWord();
    return outcome;
  }

  private endWord() {
    const score = wordScore(this.round);
    const result: WordResult = {
      word: this.round.word,
      deckId: this.deckId,
      won: this.round.status === 'won',
      waves: this.round.waves,
      wavesAllowed: this.round.wavesAllowed,
      lighthouseUses: this.round.lighthouseUses,
      score,
    };
    this.words.push(result);
    this.recent.push(result.word);
    this.tally = addWord(this.tally, score);
    if (this.run) this.run = finishRunWord(this.run, this.round);
    if (this.duel) this.duel = recordTurn(this.duel, this.round);
    this.phase = this.isFinished() ? 'over' : 'word-over';
  }

  private isFinished(): boolean {
    if (this.mode === 'daily' || this.mode === 'tutorial') return true;
    if (this.run) return this.run.status !== 'playing';
    if (this.duel) return isDuelOver(this.duel);
    return false;
  }

  /** Moves on after a word: the next word, or (in a Duel) the next secret. */
  next() {
    if (this.phase !== 'word-over') return;
    if (this.duel) {
      this.phase = 'secret';
      return;
    }
    this.round = this.run ? runRound(this.run) : newRound(this.pickWord());
    this.phase = 'playing';
  }

  /** Whose turn it is in a Duel: who sets the next word, and who guesses it. */
  get duelTurn(): { setter: 0 | 1; guesser: 0 | 1 } | null {
    if (!this.duel) return null;
    const setter = nextSetter(this.duel);
    return { setter, guesser: setter === 0 ? 1 : 0 };
  }

  setSecret(typed: string): { ok: true } | { ok: false; problem: SecretProblem } {
    if (this.phase !== 'secret') return { ok: false, problem: 'not-letters' };
    const checked = checkSecret(typed, isUnsuitable);
    if (!checked.ok) return checked;
    this.round = duelRound(checked.word);
    this.phase = 'playing';
    return { ok: true };
  }

  /** Ends an endless beach (Beach day, Classic) when the player heads home. */
  finish() {
    if (this.phase === 'playing' && this.words.length === 0) return;
    this.phase = 'over';
  }

  get foundCount(): number {
    return this.words.filter((word) => word.won).length;
  }

  get cleanCount(): number {
    return this.words.filter((word) => word.won && word.waves === 0).length;
  }
}
