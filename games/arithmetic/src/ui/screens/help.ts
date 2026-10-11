import type { App, Screen, ScreenFactory } from '../app';
import { h } from '../dom';
import { icon } from '../icons';
import { page } from './page';

/** The in-game manual: the same things as HOW-TO-PLAY.md in fewer words. */

const SECTIONS: readonly {
  mode: 'sums' | 'split' | 'sieve' | 'spell';
  title: string;
  lines: string[];
}[] = [
  {
    mode: 'sums',
    title: 'Quick Sums',
    lines: [
      'Type the answer and press Enter. A block is twenty problems.',
      'A wrong answer stays until you get it. After three tries a picture shows a way to work it out; the answer is never shown.',
      'Sharing answers are whole numbers: drop what is left over. On the Remainders rung, write it too: 7 r 5.',
      'Missed numbers come back more often until the tutor forgives them.',
    ],
  },
  {
    mode: 'split',
    title: 'Split',
    lines: [
      'Pick or type a prime that goes into the number; it shrinks. Keep going until only primes are left.',
      'When what is left is itself prime, pick it or press P: "It\'s prime".',
      'A number that does not go in, or is not prime, bounces. In Rush it costs three seconds.',
    ],
  },
  {
    mode: 'sieve',
    title: 'Sieve',
    lines: [
      'Pick a prime and every multiple of it leaves the board. When only primes are left, the board is clear.',
      'Par is the fewest picks that clear it. Picking a number that is not prime costs three seconds in Rush.',
      'Arrow keys move along the board and Enter picks; or type a number and press Enter.',
    ],
  },
  {
    mode: 'spell',
    title: 'Spell It',
    lines: [
      'Put the number into words, by typing or with the word tiles, then press Enter. Spaces, hyphens and capitals do not matter.',
      'Every other number goes the other way: read the words and type the digits.',
      'Decimals are read as tenths, hundredths and thousandths: 3.25 is three and twenty-five hundredths.',
    ],
  },
];

const KEYS: readonly [string, string][] = [
  ['0–9', 'Type an answer or a number'],
  ['Enter', 'Check the answer, or pick the typed number'],
  ['Backspace', 'Rub out'],
  ['r or Space', 'Quick Sums, Remainders: start the remainder'],
  ['P', 'Split: the number left is prime'],
  ['?', 'Split, Sieve and Spell It: a hint'],
  ['Arrow keys', 'Sieve: move along the board'],
  ['Delete', 'Spell It: take the last word off'],
  ['Esc', 'Pause; on the game menu, back to the Hall'],
  ['R, H', 'Results: play again, back to the Hall'],
];

export const helpScreen: ScreenFactory = (app: App): Screen => {
  const { root, layout } = page(
    app,
    'How to play',
    [
      h(
        'p',
        {},
        'Number Sprint is four Unix number tools turned into one game. Play any mode on its own in free play, follow the twelve-chapter campaign, or run the Daily: four events, the same for everyone today.',
      ),
      h(
        'div',
        { class: 'ns-help' },
        ...SECTIONS.map((section) =>
          h(
            'section',
            { class: 'ns-help__section' },
            h(
              'h2',
              { class: 'ns-help__title' },
              icon(section.mode, 'ns-mode__icon'),
              section.title,
            ),
            h('ul', {}, ...section.lines.map((line) => h('li', {}, line))),
          ),
        ),
      ),
      h('h2', { class: 'ns-help__title' }, 'Rush and Calm'),
      h(
        'p',
        {},
        'Rush runs a clock and adds points for speed; Calm has no clock and counts accuracy only. Chapter stars: accurate (90 % or better), under par in Rush or a clean run in Calm, and no hints.',
      ),
      h('h2', { class: 'ns-help__title' }, 'Keys'),
      h(
        'table',
        { class: 'ns-keytable' },
        h(
          'tbody',
          {},
          ...KEYS.map(([key, action]) =>
            h('tr', {}, h('th', { scope: 'row' }, h('kbd', {}, key)), h('td', {}, action)),
          ),
        ),
      ),
    ],
    'ns-help-screen',
  );
  app.setScene({ kind: 'ready' });
  return { element: root, layout: 'menu', onLayout: layout };
};
