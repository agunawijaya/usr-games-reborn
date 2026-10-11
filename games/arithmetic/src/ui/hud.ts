import { powerText, productText } from '../engine/factor';
import type { TrainingRow } from '../engine/penalties';
import { SIGN } from '../engine/sums';
import { WRONG_PENALTY } from '../engine/penalties';
import type { Rect } from '../render/layout';
import { h } from './dom';

/**
 * The pieces every play screen is built from: status, the problem on its board, the tutor's
 * panel and the on-screen keys. Each takes plain data and returns an element; screens keep them
 * up to date and place them with `place`.
 */

export function place<T extends HTMLElement>(element: T, rect: Rect): T {
  element.style.left = `${rect.x}px`;
  element.style.top = `${rect.y}px`;
  element.style.width = `${rect.w}px`;
  element.style.height = `${rect.h}px`;
  return element;
}

export type PipState = 'todo' | 'now' | 'done' | 'clean';

export interface HudData {
  readonly mode: string;
  readonly level: string;
  /** e.g. "Problem 12 of 20". */
  readonly count: string;
  readonly pips: readonly PipState[];
  /** Rush shows a clock; Calm shows none. */
  readonly clock: string | null;
  readonly streak: string | null;
}

export function hud(data: HudData): HTMLElement {
  return h(
    'section',
    { class: 'ns-panel ns-hud', 'aria-label': 'Status' },
    h(
      'div',
      { class: 'ns-hud__title' },
      h('span', { class: 'ns-label' }, data.mode),
      h('span', { class: 'ns-hud__level' }, data.level),
    ),
    h(
      'div',
      { class: 'ns-hud__row' },
      h('span', { class: 'ns-count' }, data.count),
      data.streak ? h('span', { class: 'ns-streak' }, data.streak) : null,
    ),
    h(
      'div',
      { class: 'ns-pips', 'aria-hidden': 'true' },
      ...data.pips.map((state) => h('span', { class: `ns-pip ns-pip--${state}` })),
    ),
    data.clock !== null
      ? h(
          'div',
          { class: 'ns-hud__row' },
          h('span', { class: 'ns-clock', 'aria-label': `Time ${data.clock}` }, data.clock),
          h('span', { class: 'ns-muted' }, 'Rush'),
        )
      : h(
          'div',
          { class: 'ns-hud__row' },
          h('span', { class: 'ns-muted' }, 'Calm: no clock, take your time'),
        ),
  );
}

export interface ProblemData {
  readonly top: string;
  readonly left: number;
  readonly sign: keyof typeof SIGN;
  readonly right: number;
  readonly typed: string;
  readonly askRemainder: boolean;
  readonly rule?: string;
}

/** `7 × 8 = 56▌` on the scoreboard or display, with the honest rule underneath when there is one. */
export function problemBoard(data: ProblemData): HTMLElement {
  const answer = h(
    'span',
    { class: `ns-board__answer${data.typed ? ' ns-board__answer--typing' : ''}` },
    data.typed || (data.askRemainder ? '? r ?' : '?'),
    data.typed ? h('span', { class: 'ns-board__caret' }) : null,
  );
  return h(
    'div',
    { class: 'ns-board', role: 'group', 'aria-label': 'Problem' },
    h('div', { class: 'ns-board__top' }, data.top),
    h(
      'div',
      { class: 'ns-board__problem', 'aria-live': 'polite' },
      h('span', {}, `${data.left} ${SIGN[data.sign]} ${data.right}`),
      h('span', { 'aria-hidden': 'true' }, '='),
      answer,
    ),
    data.rule ? h('div', { class: 'ns-board__rule' }, data.rule) : null,
  );
}

export interface SplitBoardData {
  readonly top: string;
  readonly start: number;
  /** Primes split off so far, in order. */
  readonly found: readonly number[];
  readonly remaining: number;
  readonly done: boolean;
}

/** The number, the trail of splits so far, and once done the whole answer in both forms. */
export function splitBoard(data: SplitBoardData): HTMLElement {
  const steps: string[] = [String(data.start)];
  let value = data.start;
  for (const prime of data.found) {
    value /= prime;
    steps.push(String(value));
  }
  if (data.done) {
    const sorted = [...data.found].sort((a, b) => a - b);
    return h(
      'div',
      { class: 'ns-board', role: 'group', 'aria-label': 'Split' },
      h('div', { class: 'ns-board__top' }, data.top),
      h(
        'div',
        { class: 'ns-board__power', 'aria-live': 'polite' },
        `${data.start} = ${powerText(sorted)}`,
      ),
      h('div', { class: 'ns-board__chain' }, productText(sorted)),
    );
  }
  return h(
    'div',
    { class: 'ns-board', role: 'group', 'aria-label': 'Split' },
    h('div', { class: 'ns-board__top' }, data.top),
    h(
      'div',
      { class: 'ns-board__problem', 'aria-live': 'polite' },
      h('span', {}, String(data.remaining)),
    ),
    h('div', { class: 'ns-board__chain' }, steps.join(' → ')),
  );
}

const TRAINING_SHOWN = 5;

/** The tutor's panel: each number it is bringing back, and the chances it still has. */
export function trainingPanel(rows: readonly TrainingRow[]): HTMLElement {
  const shown = rows.slice(0, TRAINING_SHOWN);
  return h(
    'section',
    { class: 'ns-panel ns-training', 'aria-label': 'Numbers in training' },
    h('span', { class: 'ns-label' }, 'Numbers in training'),
    shown.length === 0
      ? h(
          'p',
          { class: 'ns-training__note' },
          'Miss a sum and its numbers come back for practice, a little less each time.',
        )
      : h(
          'ul',
          { class: 'ns-training__list' },
          ...shown.map((row) =>
            h(
              'li',
              {
                class: 'ns-training__row',
                'aria-label': `${trainingFact(row)}, ${row.chances} more chances`,
              },
              h('span', { class: 'ns-training__fact' }, ...trainingParts(row)),
              h(
                'span',
                { class: 'ns-chances', 'aria-hidden': 'true' },
                ...Array.from({ length: WRONG_PENALTY }, (_, i) =>
                  h('span', {
                    class: `ns-chance${i < Math.min(row.chances, WRONG_PENALTY) ? '' : ' ns-chance--spent'}`,
                  }),
                ),
              ),
            ),
          ),
        ),
    shown.length > 0
      ? h(
          'p',
          { class: 'ns-training__note' },
          'They come back more often, one chance fewer each time.',
        )
      : null,
  );
}

/** `7 × ▢` for a left operand, `▢ × 8` for a right one, `▢ − 6 = 4`… as plain words for readers. */
function trainingFact(row: TrainingRow): string {
  const sign = SIGN[row.op];
  if (row.slot === 1) return `anything ${sign} ${row.value}`;
  return row.op === '+' || row.op === 'x'
    ? `${row.value} ${sign} anything`
    : `answers of ${row.value} with ${sign}`;
}

function trainingParts(row: TrainingRow): (HTMLElement | string)[] {
  const sign = SIGN[row.op];
  const blank = h('span', { class: 'ns-training__blank' }, '□');
  if (row.slot === 1) return [blank, ` ${sign} ${row.value}`];
  if (row.op === '+' || row.op === 'x') return [`${row.value} ${sign} `, blank];
  return [blank, ` ${sign} `, h('span', { class: 'ns-training__blank' }, '□'), ` = ${row.value}`];
}

export type KeyHandler = (key: string) => void;

/** Digits, rub out and enter, for playing by mouse; `extra` adds `r` (remainders) or a point. */
export function numberKeys(onKey: KeyHandler, extra: 'r' | '.' | null = null): HTMLElement {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  return h(
    'div',
    { class: 'ns-keys', role: 'group', 'aria-label': 'Number keys' },
    ...keys.map((key) =>
      h('button', { class: 'ns-key', type: 'button', onclick: () => onKey(key) }, key),
    ),
    extra
      ? h(
          'button',
          {
            class: 'ns-key',
            type: 'button',
            onclick: () => onKey(extra),
            'aria-label': extra === 'r' ? 'remainder' : 'point',
          },
          extra,
        )
      : null,
    h(
      'button',
      {
        class: 'ns-key ns-key--wide',
        type: 'button',
        'aria-label': 'Rub out',
        onclick: () => onKey('Backspace'),
      },
      '⌫',
    ),
    h(
      'button',
      { class: 'ns-key ns-key--go', type: 'button', onclick: () => onKey('Enter') },
      'Enter',
    ),
  );
}

/** The primes on offer for Split, and "it's prime" for the last one. */
export function primeKeys(
  primes: readonly number[],
  onPrime: (prime: number) => void,
  onDeclare: () => void,
): HTMLElement {
  return h(
    'div',
    { class: 'ns-keys', role: 'group', 'aria-label': 'Primes' },
    ...primes.map((prime) =>
      h(
        'button',
        { class: 'ns-key ns-key--prime', type: 'button', onclick: () => onPrime(prime) },
        String(prime),
      ),
    ),
    h(
      'button',
      { class: 'ns-key ns-key--go', type: 'button', onclick: onDeclare },
      "It's prime",
      h('small', {}, 'P'),
    ),
  );
}

/**
 * Shrinks the board's big lines until they fit its face. Call it once the board is on the page
 * (measuring needs layout) and again after the text or the size changes.
 */
export function fitBoardText(board: HTMLElement) {
  const room = board.clientWidth * 0.9;
  for (const line of board.querySelectorAll<HTMLElement>(
    '.ns-board__problem, .ns-board__power, .ns-board__chain',
  )) {
    line.style.fontSize = '';
    const natural = line.scrollWidth;
    if (natural > room) {
      const size = parseFloat(getComputedStyle(line).fontSize);
      line.style.fontSize = `${Math.floor(size * (room / natural))}px`;
    }
  }
}

/** Places an element by its top-left corner and width, leaving its height to its content. */
export function placeTop<T extends HTMLElement>(
  element: T,
  rect: { x: number; y: number; w: number },
): T {
  element.style.left = `${rect.x}px`;
  element.style.top = `${rect.y}px`;
  element.style.width = `${rect.w}px`;
  return element;
}
