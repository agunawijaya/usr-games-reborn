import { type Problem, SIGN } from './sums';

/**
 * The picture hint that appears after three wrong tries. The original "cannot be persuaded to
 * tell you the right answer", and neither can we: a hint shows a way to work it out (dots in
 * rows, a friendlier split), never the number itself.
 */

export type Hint =
  /** `rows` rows of `columns` dots: a product, or a share with `leftover` dots spare. */
  | {
      readonly kind: 'array';
      readonly rows: number;
      readonly columns: number;
      readonly leftover: number;
      readonly caption: string;
    }
  /** Two groups of dots, the second topping the first up to a ten. */
  | {
      readonly kind: 'ten-frame';
      readonly first: number;
      readonly second: number;
      readonly caption: string;
    }
  /** A friendlier way to write the same problem, in steps. */
  | { readonly kind: 'steps'; readonly steps: readonly string[]; readonly caption: string };

/** Pictures stay countable: beyond this many dots a hint becomes steps instead. */
export const MAX_DOTS = 120;

export function hintFor(problem: Problem): Hint {
  switch (problem.op) {
    case '+':
      return additionHint(problem.left, problem.right);
    case '-':
      return subtractionHint(problem.left, problem.right);
    case 'x':
      return multiplicationHint(problem.left, problem.right);
    case '/':
      return divisionHint(problem);
  }
}

function additionHint(left: number, right: number): Hint {
  if (left + right <= 20 && left <= 10 && right <= 10) {
    const big = Math.max(left, right);
    const small = Math.min(left, right);
    const toTen = 10 - big;
    if (big + small > 10 && toTen > 0) {
      return {
        kind: 'ten-frame',
        first: big,
        second: small,
        caption: `Fill the ten first: ${big} + ${toTen} + ${small - toTen}`,
      };
    }
    return {
      kind: 'ten-frame',
      first: big,
      second: small,
      caption: 'Count on from the bigger one',
    };
  }
  const tens = (n: number) => Math.floor(n / 10) * 10;
  return {
    kind: 'steps',
    steps: [`${tens(left)} + ${tens(right)}`, `${left % 10} + ${right % 10}`],
    caption: 'Tens with tens, ones with ones, then together',
  };
}

function subtractionHint(left: number, right: number): Hint {
  if (left <= 20 && right <= 10 && left > 10 && left - right < 10) {
    const downToTen = left - 10;
    return {
      kind: 'steps',
      steps: [`${left} ${SIGN['-']} ${downToTen} = 10`, `10 ${SIGN['-']} ${right - downToTen}`],
      caption: 'Go down to ten first, then the rest',
    };
  }
  if (right === 0)
    return { kind: 'steps', steps: [], caption: 'Taking nothing away leaves it as it is' };
  return {
    kind: 'steps',
    steps: [`${right} + ? = ${left}`],
    caption: `Count up from ${right} to ${left}`,
  };
}

function multiplicationHint(left: number, right: number): Hint {
  if (left === 0 || right === 0) {
    return { kind: 'steps', steps: [], caption: 'Any number of empty rows holds nothing' };
  }
  if (left === 1 || right === 1) {
    return { kind: 'steps', steps: [], caption: 'One row of a number is just that number' };
  }
  const caption = splitCaption(left, right);
  if (left * right <= MAX_DOTS) {
    return { kind: 'array', rows: left, columns: right, leftover: 0, caption };
  }
  return { kind: 'steps', steps: [caption], caption: 'Split it into easier pieces' };
}

/** `7 × 8 = 7 × 4 × 2`, or `7 × 9 = 7 × 5 + 7 × 4` when the factor will not halve. */
function splitCaption(left: number, right: number): string {
  if (right % 2 === 0 && right > 2) return `${left} × ${right} = ${left} × ${right / 2} × 2`;
  if (left % 2 === 0 && left > 2) return `${left} × ${right} = ${left / 2} × ${right} × 2`;
  const five = right > 5 ? 5 : 2;
  return `${left} × ${right} = ${left} × ${five} + ${left} × ${right - five}`;
}

function divisionHint(problem: Problem): Hint {
  const { left, right } = problem;
  if (left === 0) return { kind: 'steps', steps: [], caption: 'Sharing nothing gives nothing' };
  const leftoverNote = problem.askRemainder ? ', and count what is left' : '';
  if (left <= MAX_DOTS) {
    return {
      kind: 'array',
      rows: problem.answer,
      columns: right,
      leftover: problem.remainder,
      caption: `How many full rows of ${right}${leftoverNote}?`,
    };
  }
  // A step that happens to land on the answer would give it away, so such a step is skipped.
  const rows =
    [10, 5, 2, 1].find((count) => {
      const chunk = right * count;
      return chunk <= left && chunk !== problem.answer && left - chunk !== problem.answer;
    }) ?? 1;
  const chunk = right * rows;
  return {
    kind: 'steps',
    steps: [`${right} × ${rows} = ${chunk}`, `${left} ${SIGN['-']} ${chunk} = ${left - chunk}`],
    caption: `Take away ${rows} rows of ${right} first, then keep going${leftoverNote}`,
  };
}
