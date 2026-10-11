import { HOLES, punchName } from '../codecs/bcd';
import { morseFor } from '../codecs/morse';
import { h } from './dom';

/**
 * The reference cards a learner may open: the morse chart, the card code with the original's
 * history notes, and the tape's hole values. They are plain HTML, so screen readers and
 * keyboard users get them as well as the eye.
 */
export function morseChart(letters: string, fresh = ''): HTMLElement {
  const list = h('dl', { class: 'dd-chart dd-chart--morse' });
  for (const char of letters) {
    const code = morseFor(char);
    if (!code) continue;
    const marks = [...code].map((mark) => (mark === '.' ? '•' : '▬')).join(' ');
    list.append(
      h(
        'div',
        { class: fresh.includes(char) ? 'dd-chart__item dd-chart__item--fresh' : 'dd-chart__item' },
        h('dt', {}, char),
        h('dd', { 'aria-label': code.replace(/\./g, 'dit ').replace(/-/g, 'daw ').trim() }, marks),
      ),
    );
  }
  return list;
}

/**
 * Where the deduced table differs from the GE-625/635 code the old program really used (see
 * docs/NOTES.md); shown as a footnote beside those characters.
 */
export const REAL_CODE: Readonly<Record<string, string>> = {
  R: '11-9 here; the 1979 table gave R the same holes as Q',
  '\\': '12-7-8 on the GE-635',
  ']': '12-4-8 on the GE-635',
  '^': '11-0 on the GE-635',
  _: '0-2-8 on the GE-635',
};

export function cardChart(characters: string): HTMLElement {
  const list = h('dl', { class: 'dd-chart dd-chart--card' });
  // Letters first, then digits, then any marks, so the eye finds a character where it expects.
  const rank = (c: string) => (/[A-Z]/.test(c) ? 0 : /[0-9]/.test(c) ? 1 : 2);
  const ordered = [...new Set(characters)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  for (const char of ordered) {
    const pattern = HOLES[char.charCodeAt(0)] ?? 0;
    if (!pattern) continue;
    const note = REAL_CODE[char];
    list.append(
      h(
        'div',
        { class: 'dd-chart__item', title: note },
        h('dt', {}, char),
        h('dd', {}, punchName(pattern), note ? h('sup', { 'aria-label': note }, '†') : null),
      ),
    );
  }
  return list;
}

export function tapeLegend(): HTMLElement {
  return h(
    'div',
    { class: 'dd-chart dd-chart--tape' },
    h(
      'p',
      {},
      'Holes, left to right: ',
      h('b', {}, '128 64 32 16 8 · 4 2 1'),
      ' (the dot is the sprocket).',
    ),
    h(
      'p',
      {},
      'Capitals: 64 + their place, A = 1 … Z = 26. Digits: 32 + 16 + the digit. Space: 32.',
    ),
  );
}
