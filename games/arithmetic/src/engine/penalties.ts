/**
 * The forgiving tutor, rebuilt from Eamonn McManus's `arithmetic` (1989, `arithmetic.c`,
 * `penalise` and `getrandom`). Every wrong answer charges the numbers in the problem
 * WRONG_PENALTY extra chances of being drawn again for the same operation; every draw that lands
 * on a charge spends one of them, and a charge that reaches zero is forgiven.
 *
 * The book keeps one list per operation and operand slot, newest charge first, exactly like the
 * original's linked lists, so a seeded random source replays the original's choices draw for
 * draw. The data is immutable: every function returns a new book.
 */

export const WRONG_PENALTY = 5;

export type Operation = '+' | '-' | 'x' | '/';
export const OPERATIONS: readonly Operation[] = ['+', '-', 'x', '/'];

/**
 * Slot 1 is the right-hand operand. Slot 0 is the left operand for `+` and `x`, and the answer
 * for `-` and `/`: the original picks the answer for those two and builds the left side from it.
 */
export type Slot = 0 | 1;

export interface Charge {
  readonly value: number;
  readonly penalty: number;
}

export type PenaltyBook = Readonly<
  Record<Operation, readonly [readonly Charge[], readonly Charge[]]>
>;

/** Returns an integer in [0, n). Seeded in the game, scripted in tests. */
export type RandomBelow = (n: number) => number;

export interface Draw {
  readonly value: number;
  /** True when the value came from a charge rather than a fresh pick. */
  readonly fromCharge: boolean;
  readonly book: PenaltyBook;
  /** Set when this draw spent the last charge a value had in its list. */
  readonly forgiven: number | null;
}

export function emptyBook(): PenaltyBook {
  return { '+': [[], []], '-': [[], []], x: [[], []], '/': [[], []] };
}

export function chargesOf(book: PenaltyBook, op: Operation, slot: Slot): readonly Charge[] {
  return book[op][slot];
}

/** The sum the original keeps in `penalty[op][operand]`: how many extra chances are owed. */
export function totalPenalty(book: PenaltyBook, op: Operation, slot: Slot): number {
  let total = 0;
  for (const charge of book[op][slot]) total += charge.penalty;
  return total;
}

function withList(book: PenaltyBook, op: Operation, slot: Slot, list: readonly Charge[]) {
  const pair: [readonly Charge[], readonly Charge[]] = [book[op][0], book[op][1]];
  pair[slot] = list;
  return { ...book, [op]: pair } as PenaltyBook;
}

/** A wrong answer: a fresh charge of WRONG_PENALTY goes to the front of the list. */
export function penalise(book: PenaltyBook, op: Operation, slot: Slot, value: number): PenaltyBook {
  return withList(book, op, slot, [{ value, penalty: WRONG_PENALTY }, ...book[op][slot]]);
}

/**
 * Picks a value for one operand, as `getrandom` does: a roll below `freshCount` is used as it
 * is (plus `offset`), anything above it is a position inside the charges, which is spent.
 * `offset` exists for the divisor, which the original draws from 0 and then moves up by one.
 */
export function drawOperand(
  book: PenaltyBook,
  op: Operation,
  slot: Slot,
  freshCount: number,
  random: RandomBelow,
  offset = 0,
): Draw {
  const owed = totalPenalty(book, op, slot);
  let roll = random(freshCount + owed);
  if (roll < freshCount) return { value: roll + offset, fromCharge: false, book, forgiven: null };
  roll -= freshCount;
  const list = book[op][slot];
  for (let index = 0; index < list.length; index++) {
    const charge = list[index]!;
    if (charge.penalty > roll) {
      const spent = charge.penalty - 1;
      const next =
        spent > 0
          ? list.map((entry, i) => (i === index ? { value: entry.value, penalty: spent } : entry))
          : list.filter((_, i) => i !== index);
      const stillOwed = next.some((entry) => entry.value === charge.value);
      return {
        value: charge.value,
        fromCharge: true,
        book: withList(book, op, slot, next),
        forgiven: stillOwed ? null : charge.value,
      };
    }
    roll -= charge.penalty;
  }
  throw new Error('penalty book out of balance');
}

/** One row of the "Numbers in training" panel: a value and the chances it still has. */
export interface TrainingRow {
  readonly op: Operation;
  readonly slot: Slot;
  readonly value: number;
  readonly chances: number;
}

/** Charges grouped by value, biggest debt first; the panel shows these. */
export function trainingRows(book: PenaltyBook): TrainingRow[] {
  const rows: TrainingRow[] = [];
  for (const op of OPERATIONS) {
    for (const slot of [0, 1] as const) {
      const byValue = new Map<number, number>();
      for (const charge of book[op][slot]) {
        byValue.set(charge.value, (byValue.get(charge.value) ?? 0) + charge.penalty);
      }
      for (const [value, chances] of byValue) rows.push({ op, slot, value, chances });
    }
  }
  return rows.sort((a, b) => b.chances - a.chances || a.value - b.value);
}

export function isPenaltyBook(value: unknown): value is PenaltyBook {
  if (typeof value !== 'object' || value === null) return false;
  return OPERATIONS.every((op) => {
    const pair = (value as Record<string, unknown>)[op];
    return (
      Array.isArray(pair) &&
      pair.length === 2 &&
      pair.every(
        (list) =>
          Array.isArray(list) &&
          list.every(
            (charge: unknown) =>
              typeof charge === 'object' &&
              charge !== null &&
              Number.isInteger((charge as Charge).value) &&
              Number.isInteger((charge as Charge).penalty) &&
              (charge as Charge).penalty > 0,
          ),
      )
    );
  });
}
