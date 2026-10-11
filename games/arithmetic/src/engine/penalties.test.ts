import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import {
  drawOperand,
  emptyBook,
  penalise,
  type RandomBelow,
  totalPenalty,
  trainingRows,
  WRONG_PENALTY,
} from './penalties';
import { nextProblem, penaliseProblem, type SumsSetup } from './sums';

/** A random source that plays back a script, checking each roll is in range. */
function scripted(rolls: number[]): RandomBelow & { left: () => number } {
  const queue = [...rolls];
  const random = ((n: number) => {
    const roll = queue.shift();
    if (roll === undefined) throw new Error('script ran out');
    if (roll < 0 || roll >= n) throw new Error(`roll ${roll} outside [0, ${n})`);
    return roll;
  }) as RandomBelow & { left: () => number };
  random.left = () => queue.length;
  return random;
}

const seeded = (seed: string): RandomBelow => {
  const rng = createRng(seed);
  return (n) => rng.int(0, n - 1);
};

describe('the penalty book (arithmetic.c, penalise and getrandom)', () => {
  it('charges five extra chances per wrong answer, newest first', () => {
    let book = penalise(emptyBook(), 'x', 0, 7);
    book = penalise(book, 'x', 0, 3);
    expect(WRONG_PENALTY).toBe(5);
    expect(book.x[0]).toEqual([
      { value: 3, penalty: 5 },
      { value: 7, penalty: 5 },
    ]);
    expect(totalPenalty(book, 'x', 0)).toBe(10);
    expect(totalPenalty(book, 'x', 1)).toBe(0);
  });

  it('uses a roll below the fresh count as it is', () => {
    const book = penalise(emptyBook(), '+', 1, 9);
    const draw = drawOperand(book, '+', 1, 11, scripted([4]));
    expect(draw).toMatchObject({ value: 4, fromCharge: false, forgiven: null });
    expect(draw.book).toBe(book);
  });

  it('walks the list for rolls above it and spends one chance', () => {
    let book = penalise(emptyBook(), '+', 1, 7);
    book = penalise(book, '+', 1, 3);
    // Rolls 11–15 land on the newest charge (3), 16–20 on the older one (7).
    const onNewest = drawOperand(book, '+', 1, 11, scripted([15]));
    expect(onNewest.value).toBe(3);
    expect(onNewest.book['+'][1]).toEqual([
      { value: 3, penalty: 4 },
      { value: 7, penalty: 5 },
    ]);
    const onOlder = drawOperand(book, '+', 1, 11, scripted([16]));
    expect(onOlder.value).toBe(7);
    expect(totalPenalty(onOlder.book, '+', 1)).toBe(9);
  });

  it('forgives a value once its last chance is spent', () => {
    let book = penalise(emptyBook(), '-', 0, 6);
    for (let spent = 1; spent < WRONG_PENALTY; spent++) {
      const draw = drawOperand(book, '-', 0, 11, scripted([11]));
      expect(draw).toMatchObject({ value: 6, fromCharge: true, forgiven: null });
      book = draw.book;
    }
    const last = drawOperand(book, '-', 0, 11, scripted([11]));
    expect(last.forgiven).toBe(6);
    expect(last.book['-'][0]).toEqual([]);
  });

  it('keeps a value in training while another charge for it remains', () => {
    let book = penalise(emptyBook(), 'x', 1, 8);
    book = penalise(book, 'x', 1, 8);
    for (let i = 0; i < WRONG_PENALTY; i++)
      book = drawOperand(book, 'x', 1, 11, scripted([11])).book;
    expect(book.x[1]).toEqual([{ value: 8, penalty: 5 }]);
    expect(trainingRows(book)).toEqual([{ op: 'x', slot: 1, value: 8, chances: 5 }]);
  });
});

describe('problems in the original order', () => {
  const plusMinus: SumsSetup = { ops: '+-', range: 10 };

  it('draws the sign, then the right operand, then the left', () => {
    const random = scripted([0, 3, 4]);
    const { problem } = nextProblem(emptyBook(), plusMinus, random);
    expect(problem).toMatchObject({ op: '+', left: 4, right: 3, answer: 7 });
    expect(random.left()).toBe(0);
  });

  it('builds subtraction from its answer, so answers stay in range', () => {
    const { problem } = nextProblem(emptyBook(), plusMinus, scripted([1, 6, 9]));
    expect(problem).toMatchObject({ op: '-', left: 15, right: 6, answer: 9 });
  });

  it('hides a remainder in division and wants the whole-number quotient', () => {
    // Divisor roll 5 → ÷ 6, quotient 7, remainder roll 5: 6 × 7 + 5 = 47.
    const { problem } = nextProblem(emptyBook(), { ops: '/', range: 10 }, scripted([0, 5, 7, 5]));
    expect(problem).toMatchObject({ left: 47, right: 6, answer: 7, remainder: 5 });
  });

  it('weights a repeated sign, as -o "++x" does', () => {
    const random = seeded('weights');
    let plus = 0;
    for (let i = 0; i < 6000; i++) {
      if (nextProblem(emptyBook(), { ops: '++x', range: 10 }, random).problem.op === '+') plus++;
    }
    expect(plus / 6000).toBeCloseTo(2 / 3, 1);
  });

  it('charges the right operand and the left one for + and ×', () => {
    const book = penaliseProblem(emptyBook(), {
      op: 'x',
      left: 7,
      right: 8,
      answer: 56,
      remainder: 0,
      askRemainder: false,
    });
    expect(book.x[0]).toEqual([{ value: 7, penalty: 5 }]);
    expect(book.x[1]).toEqual([{ value: 8, penalty: 5 }]);
  });

  it('charges the right operand and the answer for − and ÷', () => {
    const book = penaliseProblem(emptyBook(), {
      op: '/',
      left: 47,
      right: 6,
      answer: 7,
      remainder: 5,
      askRemainder: false,
    });
    expect(book['/'][0]).toEqual([{ value: 7, penalty: 5 }]);
    expect(book['/'][1]).toEqual([{ value: 6, penalty: 5 }]);
  });

  it('brings a missed divisor back as itself (the original slipped by one)', () => {
    const book = penalise(emptyBook(), '/', 1, 7);
    // Divisor roll 10 is past the ten fresh divisors: it lands on the charge for 7.
    const fixed = nextProblem(book, { ops: '/', range: 10 }, scripted([0, 10, 3, 0]));
    expect(fixed.problem.right).toBe(7);
    const classic = nextProblem(
      book,
      { ops: '/', range: 10, classicDivisorSlip: true },
      scripted([0, 10, 3, 0]),
    );
    expect(classic.problem.right).toBe(8);
  });
});

describe('selection probabilities with a seeded stream', () => {
  const TRIALS = 40_000;

  it('one miss on 7 × 8 makes 7 the left operand 6 times in 16', () => {
    const missed = penaliseProblem(emptyBook(), {
      op: 'x',
      left: 7,
      right: 8,
      answer: 56,
      remainder: 0,
      askRemainder: false,
    });
    const random = seeded('seven-times');
    let sevens = 0;
    let eights = 0;
    for (let i = 0; i < TRIALS; i++) {
      const { problem } = nextProblem(missed, { ops: 'x', range: 10 }, random);
      if (problem.left === 7) sevens++;
      if (problem.right === 8) eights++;
    }
    expect(sevens / TRIALS).toBeCloseTo(6 / 16, 2);
    expect(eights / TRIALS).toBeCloseTo(6 / 16, 2);
  });

  it('the bias decays: each use of a charge makes the next one less likely', () => {
    // Replay the original loop: a value with c chances left is drawn with p = (1 + c) / (11 + c).
    const random = seeded('decay');
    const runs = 4000;
    const firstDraws: number[] = [0, 0, 0, 0, 0, 0];
    for (let run = 0; run < runs; run++) {
      let book = penalise(emptyBook(), '+', 0, 4);
      let chancesLeft = WRONG_PENALTY;
      // Draw until forgiven; tally how often 4 came up while c chances were left.
      for (let guard = 0; guard < 400 && chancesLeft > 0; guard++) {
        const draw = drawOperand(book, '+', 0, 11, random);
        if (draw.fromCharge) {
          firstDraws[chancesLeft]!++;
          chancesLeft--;
        }
        book = draw.book;
      }
      expect(chancesLeft).toBe(0);
    }
    // Every charge is spent exactly once per run, in order 5, 4, 3, 2, 1.
    expect(firstDraws.slice(1)).toEqual([runs, runs, runs, runs, runs]);
  });

  it('matches p = (1 + c) / (11 + c) at each stage of forgiveness', () => {
    const random = seeded('stages');
    for (let chances = WRONG_PENALTY; chances >= 1; chances--) {
      let book = penalise(emptyBook(), '+', 0, 4);
      for (let spent = WRONG_PENALTY; spent > chances; spent--) {
        book = drawOperand(book, '+', 0, 11, scripted([11])).book;
      }
      let fours = 0;
      for (let i = 0; i < TRIALS; i++)
        if (drawOperand(book, '+', 0, 11, random).value === 4) fours++;
      expect(fours / TRIALS).toBeCloseTo((1 + chances) / (11 + chances), 2);
    }
  });
});
