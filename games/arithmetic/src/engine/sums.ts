import {
  drawOperand,
  type Operation,
  penalise,
  type PenaltyBook,
  type RandomBelow,
} from './penalties';

/**
 * Quick Sums, the heart of the game: the problem rules of `arithmetic` (1989) with its forgiving
 * penalty book, and a block of twenty problems that each must be answered correctly before the
 * next appears. The answer is never shown.
 */

export const BLOCK_SIZE = 20;
/** Wrong tries on one problem before the picture hint appears. */
export const HINT_AFTER = 3;
/** The biggest range we offer; the original had no limit and could overflow. */
export const MAX_RANGE = 999;

export interface SumsSetup {
  /** The original's `-o` keys: any of `+-x/`, a repeated sign is asked more often. */
  readonly ops: string;
  /** The original's `-r`: operands, and the answers to `-` and `/`, run from 0 to `range`. */
  readonly range: number;
  /** Division asks for the remainder too, written `7 r 5`. */
  readonly remainders?: boolean;
  /**
   * Replays the original's slip: a missed divisor is stored as shown but drawn back one higher,
   * so a miss on `÷ 7` brings back `÷ 8`. Off in the game; on in the tests that prove it.
   */
  readonly classicDivisorSlip?: boolean;
}

export interface Problem {
  readonly op: Operation;
  readonly left: number;
  readonly right: number;
  /** The result; for division, the whole-number quotient. */
  readonly answer: number;
  /** Division only: what the quotient leaves over (0 otherwise). */
  readonly remainder: number;
  readonly askRemainder: boolean;
}

export interface Forgiven {
  readonly op: Operation;
  readonly value: number;
}

export function sanitizeOps(ops: string): string {
  const kept = [...ops].filter((sign) => '+-x/'.includes(sign)).join('');
  return kept.length > 0 ? kept : '+-';
}

export function clampRange(range: number): number {
  return Math.min(MAX_RANGE, Math.max(1, Math.round(range)));
}

/**
 * One problem, drawn in the original's order: the sign, then the right operand (except for
 * division), then the left operand or the answer, then the hidden remainder.
 */
export function nextProblem(
  book: PenaltyBook,
  setup: SumsSetup,
  random: RandomBelow,
): { problem: Problem; book: PenaltyBook; forgiven: Forgiven[] } {
  const ops = sanitizeOps(setup.ops);
  const range = clampRange(setup.range);
  const op = ops[random(ops.length)] as Operation;
  const forgiven: Forgiven[] = [];
  let current = book;
  const take = (slot: 0 | 1, freshCount: number, offset = 0) => {
    const draw = drawOperand(current, op, slot, freshCount, random, offset);
    current = draw.book;
    if (draw.forgiven !== null) forgiven.push({ op, value: draw.forgiven });
    const slip = setup.classicDivisorSlip && draw.fromCharge ? offset : 0;
    return draw.value + slip;
  };

  let problem: Problem;
  if (op === '/') {
    const right = take(1, range, 1);
    const answer = take(0, range + 1);
    const remainder = random(right);
    problem = {
      op,
      left: right * answer + remainder,
      right,
      answer,
      remainder,
      askRemainder: setup.remainders === true,
    };
  } else {
    const right = take(1, range + 1);
    if (op === '-') {
      const answer = take(0, range + 1);
      problem = { op, left: right + answer, right, answer, remainder: 0, askRemainder: false };
    } else {
      const left = take(0, range + 1);
      const answer = op === '+' ? left + right : left * right;
      problem = { op, left, right, answer, remainder: 0, askRemainder: false };
    }
  }
  return { problem, book: current, forgiven };
}

/** A wrong answer charges the right operand, and the left operand or the answer. */
export function penaliseProblem(book: PenaltyBook, problem: Problem): PenaltyBook {
  const charged = penalise(book, problem.op, 1, problem.right);
  const slotZero = problem.op === '+' || problem.op === 'x' ? problem.left : problem.answer;
  return penalise(charged, problem.op, 0, slotZero);
}

export type AnswerCheck = 'right' | 'wrong' | 'not-a-number';

/**
 * Digits only (a remainder answer is two numbers, `7 r 5` or `7 5`). Anything else is not an
 * answer at all and costs nothing, as in the original, which asked for a number instead.
 */
export function checkAnswer(problem: Problem, input: string): AnswerCheck {
  const text = input.trim().toLowerCase();
  if (problem.askRemainder) {
    const match = /^(\d+)\s*(?:r|rem|remainder)?\s*(\d+)$/.exec(text);
    if (!match) return 'not-a-number';
    return Number(match[1]) === problem.answer && Number(match[2]) === problem.remainder
      ? 'right'
      : 'wrong';
  }
  if (!/^\d+$/.test(text)) return 'not-a-number';
  return Number(text) === problem.answer ? 'right' : 'wrong';
}

export const SIGN: Record<Operation, string> = { '+': '+', '-': '−', x: '×', '/': '÷' };

/** `47 ÷ 6`: the left side as players read it. */
export function problemText(problem: Problem): string {
  return `${problem.left} ${SIGN[problem.op]} ${problem.right}`;
}

/** The right side's blank: `?`, or `? r ?` when the remainder is asked. */
export function answerShape(problem: Problem): string {
  return problem.askRemainder ? '? r ?' : '?';
}

export type Tempo = 'rush' | 'calm';

/** Points for a solved problem: more for a first try, and in Rush a bonus for speed. */
export function problemPoints(firstTry: boolean, ms: number, tempo: Tempo): number {
  const base = firstTry ? 100 : 40;
  if (tempo === 'calm') return base;
  const speed = Math.min(1, Math.max(0, (5000 - ms) / 4000));
  return base + Math.round(100 * speed);
}

/** The original's score: rights over all answers given, rounded down. */
export function scorePercent(rights: number, wrongs: number): number {
  return rights + wrongs === 0 ? 100 : Math.floor((100 * rights) / (rights + wrongs));
}

export interface BlockState {
  readonly setup: SumsSetup;
  readonly tempo: Tempo;
  readonly book: PenaltyBook;
  readonly problem: Problem;
  /** How many problems are already solved. */
  readonly solved: number;
  /** Wrong tries on the current problem. */
  readonly misses: number;
  readonly rights: number;
  readonly wrongs: number;
  readonly firstTries: number;
  /** Problems on which the picture hint appeared. */
  readonly hinted: number;
  /** Milliseconds per solved problem, in order: the timing card's splits. */
  readonly splits: readonly number[];
  readonly score: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly forgiven: readonly Forgiven[];
  readonly finished: boolean;
}

export function startBlock(
  book: PenaltyBook,
  setup: SumsSetup,
  tempo: Tempo,
  random: RandomBelow,
): BlockState {
  const first = nextProblem(book, setup, random);
  return {
    setup,
    tempo,
    book: first.book,
    problem: first.problem,
    solved: 0,
    misses: 0,
    rights: 0,
    wrongs: 0,
    firstTries: 0,
    hinted: 0,
    splits: [],
    score: 0,
    streak: 0,
    bestStreak: 0,
    forgiven: first.forgiven,
    finished: false,
  };
}

export interface SubmitResult {
  readonly state: BlockState;
  readonly check: AnswerCheck;
  readonly points: number;
  /** True on the miss that brings the picture hint up. */
  readonly hintNow: boolean;
  /** Values the tutor let go of while drawing the next problem. */
  readonly forgiven: readonly Forgiven[];
}

/** One answer from the player, with the time spent on this problem so far. */
export function submitAnswer(
  state: BlockState,
  input: string,
  msOnProblem: number,
  random: RandomBelow,
): SubmitResult {
  if (state.finished)
    return { state, check: 'not-a-number', points: 0, hintNow: false, forgiven: [] };
  const check = checkAnswer(state.problem, input);
  if (check === 'not-a-number') return { state, check, points: 0, hintNow: false, forgiven: [] };
  if (check === 'wrong') {
    const misses = state.misses + 1;
    return {
      state: {
        ...state,
        book: penaliseProblem(state.book, state.problem),
        misses,
        wrongs: state.wrongs + 1,
        hinted: misses === HINT_AFTER ? state.hinted + 1 : state.hinted,
        streak: 0,
      },
      check,
      points: 0,
      hintNow: misses === HINT_AFTER,
      forgiven: [],
    };
  }
  const firstTry = state.misses === 0;
  const points = problemPoints(firstTry, msOnProblem, state.tempo);
  const solved = state.solved + 1;
  const streak = firstTry ? state.streak + 1 : 0;
  const base: BlockState = {
    ...state,
    solved,
    misses: 0,
    rights: state.rights + 1,
    firstTries: state.firstTries + (firstTry ? 1 : 0),
    splits: [...state.splits, msOnProblem],
    score: state.score + points,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    finished: solved >= BLOCK_SIZE,
  };
  if (base.finished) return { state: base, check, points, hintNow: false, forgiven: [] };
  const next = nextProblem(base.book, base.setup, random);
  return {
    state: {
      ...base,
      book: next.book,
      problem: next.problem,
      forgiven: [...base.forgiven, ...next.forgiven],
    },
    check,
    points,
    hintNow: false,
    forgiven: next.forgiven,
  };
}

export interface BlockCard {
  readonly rights: number;
  readonly wrongs: number;
  readonly percent: number;
  readonly totalMs: number;
  readonly perProblemMs: number;
  readonly bestMs: number;
  readonly firstTries: number;
}

/** The block card the original printed every twenty problems, plus the best split. */
export function blockCard(state: BlockState): BlockCard {
  const totalMs = state.splits.reduce((sum, ms) => sum + ms, 0);
  return {
    rights: state.rights,
    wrongs: state.wrongs,
    percent: scorePercent(state.rights, state.wrongs),
    totalMs,
    perProblemMs: state.rights > 0 ? totalMs / state.rights : 0,
    bestMs: state.splits.length > 0 ? Math.min(...state.splits) : 0,
    firstTries: state.firstTries,
  };
}
