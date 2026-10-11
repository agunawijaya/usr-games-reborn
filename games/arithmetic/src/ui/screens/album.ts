import { isPalindrome, specialsOf, summarize, twinPairs } from '../../engine/album';
import { primesUpTo } from '../../engine/sieve';
import { trainingRows, WRONG_PENALTY } from '../../engine/penalties';
import { SIGN } from '../../engine/sums';
import { primeHue } from '../../render/atom/palette';
import type { App, Screen, ScreenFactory } from '../app';
import { h } from '../dom';
import { page } from './page';

/**
 * The prime album: every prime uncovered in Split or the Sieve. Sprint shows them as medals,
 * Atom as a periodic table; twins, primes above a thousand and primes that read the same both
 * ways earn special marks. The tutor's page sits here too.
 */

type Filter = 'all' | 'twin' | 'big' | 'palindrome';

const MARKS: Record<'twin' | 'big' | 'palindrome', string> = {
  twin: 'Twin',
  big: 'Over 1,000',
  palindrome: 'Reads both ways',
};

export const albumScreen: ScreenFactory = (app: App): Screen => {
  const album = app.saves.album.load();
  const owned = new Set(album.primes);
  const summary = summarize(album);
  let filter: Filter = 'all';
  const grid = h('div', { class: 'ns-album', role: 'list', 'data-testid': 'ns-album' });

  function cell(prime: number): HTMLElement {
    const have = owned.has(prime);
    const marks = have ? specialsOf(album, prime) : [];
    const label = have
      ? `${prime}${marks.length > 0 ? `, ${marks.map((m) => MARKS[m]).join(', ')}` : ''}`
      : `${prime}, not found yet`;
    const item = h(
      'div',
      {
        class: `ns-album__cell${have ? ' ns-album__cell--have' : ''}`,
        role: 'listitem',
        'aria-label': label,
        style: `--hue:${primeHue(prime).toFixed(0)}`,
      },
      h('span', { class: 'ns-album__number' }, have ? String(prime) : '?'),
      marks.length > 0
        ? h(
            'span',
            { class: 'ns-album__marks', 'aria-hidden': 'true' },
            marks.map((m) => (m === 'twin' ? '∞' : m === 'big' ? 'K' : '↔')).join(' '),
          )
        : null,
    );
    return item;
  }

  function render() {
    const twins = new Set(twinPairs(album).flatMap((p) => [p, p + 2]));
    const shown =
      filter === 'all'
        ? [...new Set([...primesUpTo(100), ...album.primes])].sort((a, b) => a - b)
        : album.primes.filter((p) =>
            filter === 'twin'
              ? twins.has(p)
              : filter === 'big'
                ? p > 1000
                : p > 10 && isPalindrome(p),
          );
    grid.replaceChildren(...shown.slice(0, 600).map(cell));
    if (shown.length === 0)
      grid.append(h('p', { class: 'ns-muted' }, 'None yet. Split and sieve to find some.'));
  }

  const filters = h(
    'div',
    { class: 'ns-tabs', role: 'tablist', 'aria-label': 'Show' },
    ...(
      [
        ['all', `All · ${summary.count}`],
        ['twin', `Twin pairs · ${summary.twins}`],
        ['big', `Over 1,000 · ${summary.big}`],
        ['palindrome', `Both ways · ${summary.palindromes}`],
      ] as const
    ).map(([value, text]) =>
      h(
        'button',
        {
          class: 'ns-tab',
          type: 'button',
          role: 'tab',
          'aria-selected': String(value === filter),
          onclick: (event: Event) => {
            filter = value;
            for (const tab of filters.querySelectorAll('button'))
              tab.setAttribute('aria-selected', String(tab === event.currentTarget));
            render();
          },
        },
        text,
      ),
    ),
  );

  render();
  const { root, layout } = page(
    app,
    app.look.theme === 'atom' ? 'Periodic table of primes' : 'Prime medals',
    [
      h(
        'p',
        { class: 'ns-muted' },
        `${summary.count} primes collected${summary.largest > 0 ? `, the largest ${summary.largest.toLocaleString('en-US')}` : ''}. Every prime you split off a number or leave standing in a sieve joins the album.`,
      ),
      filters,
      grid,
    ],
    'ns-album-page',
  );
  root.dataset.theme = app.look.theme;
  app.setScene({ kind: 'ready' });
  return {
    element: root,
    layout: 'menu',
    onLayout: layout,
    focus: () => filters.querySelector<HTMLElement>('button')?.focus(),
  };
};

export const trainingScreen: ScreenFactory = (app: App): Screen => {
  const rows = trainingRows(app.saves.tutor.load().book);
  const forgiven = app.saves.records.load().counters.forgiven;
  const list = h(
    'ul',
    { class: 'ns-training__list ns-training__list--page', 'data-testid': 'ns-training-page' },
    ...rows.map((row) => {
      const sign = SIGN[row.op];
      const fact =
        row.slot === 1
          ? `□ ${sign} ${row.value}`
          : row.op === '+' || row.op === 'x'
            ? `${row.value} ${sign} □`
            : `□ ${sign} □ = ${row.value}`;
      return h(
        'li',
        { class: 'ns-training__row' },
        h('span', { class: 'ns-training__fact' }, fact),
        h(
          'span',
          { class: 'ns-muted' },
          `${row.chances} extra chance${row.chances === 1 ? '' : 's'} of coming up`,
        ),
        h(
          'span',
          { class: 'ns-chances', 'aria-hidden': 'true' },
          ...Array.from({ length: Math.max(WRONG_PENALTY, Math.min(row.chances, 15)) }, (_, i) =>
            h('span', { class: `ns-chance${i < row.chances ? '' : ' ns-chance--spent'}` }),
          ),
        ),
      );
    }),
  );
  const { root, layout } = page(
    app,
    'Numbers in training',
    [
      h(
        'p',
        {},
        'When you miss a sum, its numbers come back for practice: each miss gives them five extra chances of turning up in that kind of sum, and every time one turns up it uses a chance. When the chances run out, the number is forgiven. It is the idea of the 1989 arithmetic program, kept exactly.',
      ),
      rows.length === 0 ? h('p', { class: 'ns-muted' }, 'Nothing in training right now.') : list,
      h('p', { class: 'ns-muted' }, `Numbers forgiven so far: ${forgiven}.`),
    ],
    'ns-training-screen',
  );
  app.setScene({ kind: 'ready' });
  return { element: root, layout: 'menu', onLayout: layout };
};
