/**
 * The seven sinkers and their turned forms. Each form is a centre cell and three offsets from it
 * (x to the right, y downwards), exactly as the 1992 program's shape table lays them out, so a
 * form turns about the same cell it did then: one of the four for most shapes; the square's centre
 * is its lower-right cell, so it "sticks out" up and to the left; and the long one's centre wobbles,
 * sticking out rightwards when it lies flat and downwards when it stands.
 *
 * `left` is the form a quarter turn counter-clockwise gives (the only turn the original had);
 * `right`, the turn the other way, is that table followed backwards.
 */

export interface Offset {
  readonly x: number;
  readonly y: number;
}

export interface Form {
  /** The three cells besides the centre. */
  readonly offsets: readonly [Offset, Offset, Offset];
  /** The form after a quarter turn counter-clockwise. */
  readonly left: number;
  /** The form after a quarter turn clockwise. */
  readonly right: number;
  /** Which of the seven sinkers this is a form of. */
  readonly kind: number;
}

const TL = { x: -1, y: -1 };
const TC = { x: 0, y: -1 };
const TR = { x: 1, y: -1 };
const ML = { x: -1, y: 0 };
const MR = { x: 1, y: 0 };
const BL = { x: -1, y: 1 };
const BC = { x: 0, y: 1 };
const BR = { x: 1, y: 1 };
const FAR_RIGHT = { x: 2, y: 0 };
const FAR_DOWN = { x: 0, y: 2 };

/** [offsets, counter-clockwise turn] for the 19 forms, in the original's order. */
const TABLE: readonly [readonly [Offset, Offset, Offset], number][] = [
  [[TL, TC, MR], 7],
  [[TC, TR, ML], 8],
  [[ML, MR, BC], 9],
  [[TL, TC, ML], 3],
  [[ML, BL, MR], 12],
  [[ML, BR, MR], 15],
  [[ML, MR, FAR_RIGHT], 18],
  [[TC, ML, BL], 0],
  [[TC, MR, BR], 1],
  [[TC, MR, BC], 10],
  [[TC, ML, MR], 11],
  [[TC, ML, BC], 2],
  [[TC, BC, BR], 13],
  [[TR, ML, MR], 14],
  [[TL, TC, BC], 4],
  [[TR, TC, BC], 16],
  [[TL, MR, ML], 17],
  [[TC, BC, BL], 5],
  [[TC, BC, FAR_DOWN], 6],
];

/** The first seven forms are the seven sinkers as they appear; the rest are their turns. */
export const KINDS = 7;

function kindOf(form: number): number {
  // Follow the turns until one of the first seven forms comes round.
  let at = form;
  for (let i = 0; i < 4 && at >= KINDS; i++) at = TABLE[at]![1];
  return at;
}

export const FORMS: readonly Form[] = TABLE.map(([offsets, left], i) => ({
  offsets,
  left,
  right: TABLE.findIndex(([, turn]) => turn === i),
  kind: kindOf(i),
}));

/** The four cells of a form with its centre at (x, y). */
export function cellsOf(form: number, x: number, y: number): Offset[] {
  const { offsets } = FORMS[form]!;
  return [{ x, y }, ...offsets.map((o) => ({ x: x + o.x, y: y + o.y }))];
}
