import { DICTIONARY_META } from '../../dictionary/meta';
import { TIER_NAMES, TIERS } from '../../dictionary/tiers';
import { RULES } from '../../engine/grid';
import { HUNTERS, STRENGTHS } from '../../engine/hunter';
import { basePoints } from '../../engine/score';
import { GRID_NAMES, RULE_CARDS } from '../../game/modes';
import { bookCounts, readingLevel } from '../../game/records';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { applyLook } from '../look';

/** The pages off the game menu: the word book, the records and how to play. */
function page(
  app: App,
  testId: string,
  title: string,
  intro: string,
  ...body: (HTMLElement | null)[]
): Screen {
  const back = h(
    'button',
    {
      class: 'chl-button chl-button--primary',
      type: 'button',
      'data-testid': 'chl-back',
      onclick: () => app.go.title(),
    },
    'Game menu',
  );
  const element = h(
    'div',
    { class: 'chl-screen chl-page', 'data-testid': testId },
    h(
      'div',
      { class: 'chl-page__card chl-card' },
      h('header', { class: 'chl-page__head' }, h('h1', {}, title), h('p', {}, intro)),
      h('div', { class: 'chl-page__body' }, ...body),
      h('nav', { class: 'chl-actions' }, back),
    ),
  );
  applyLook(element, app.palette, app.reducedMotion);
  app.board.settle();
  app.board.setTrace([]);
  return {
    element,
    onLook: (palette, reducedMotion) => applyLook(element, palette, reducedMotion),
    focus: () => back.focus({ preventScroll: true }),
  };
}

const percentOf = (part: number, whole: number) => (whole === 0 ? 0 : (100 * part) / whole);

export function bookScreen(app: App): Screen {
  const book = app.book();
  const counts = bookCounts(book);
  const total = Object.keys(book.words).length;
  const tiers = h(
    'section',
    { class: 'chl-book__tiers' },
    ...TIERS.map((tier) =>
      h(
        'div',
        { class: 'chl-meter', 'data-tier': tier },
        h(
          'span',
          { class: 'chl-meter__name' },
          TIER_NAMES[tier],
          tier >= 2 ? h('span', { class: 'chl-word__stamp', 'aria-hidden': 'true' }, ' ★') : null,
        ),
        h(
          'span',
          { class: 'chl-meter__bar', 'aria-hidden': 'true' },
          h('i', {
            style: `width:${Math.min(100, Math.max(0.6, percentOf(counts.byTier[tier]!, DICTIONARY_META.byTier[tier]!))).toFixed(1)}%`,
          }),
        ),
        h(
          'span',
          { class: 'chl-meter__count' },
          `${counts.byTier[tier]!.toLocaleString('en-GB')} of ${DICTIONARY_META.byTier[tier]!.toLocaleString('en-GB')}`,
        ),
      ),
    ),
  );
  const letters = h(
    'section',
    { class: 'chl-book__letters', 'aria-label': 'Words by first letter' },
    ...Object.keys(DICTIONARY_META.byInitial)
      .sort()
      .map((letter) => {
        const all = DICTIONARY_META.byInitial[letter]!.reduce((a, b) => a + b, 0);
        const mine = (counts.byInitial[letter] ?? [0, 0, 0, 0]).reduce((a, b) => a + b, 0);
        return h(
          'div',
          {
            class: 'chl-letter',
            title: `${mine} of ${all} words starting with ${letter.toUpperCase()}`,
          },
          h('span', { class: 'chl-letter__glyph' }, letter.toUpperCase()),
          h('span', {
            class: 'chl-letter__fill',
            style: `--fill:${Math.sqrt(mine / Math.max(1, all)).toFixed(3)}`,
          }),
          h('span', { class: 'chl-letter__count' }, String(mine)),
        );
      }),
  );
  const rarest = Object.entries(book.words)
    .filter(([, tier]) => tier >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 24);
  const stamps = h(
    'section',
    { class: 'chl-book__stamps' },
    h('h2', { class: 'chl-card__label' }, 'Rare finds'),
    rarest.length === 0
      ? h(
          'p',
          { class: 'chl-page__quiet' },
          'Rare and very rare words you find get a foil stamp here.',
        )
      : h(
          'ul',
          { class: 'chl-stamps' },
          ...rarest.map(([word, tier]) =>
            h('li', { class: 'chl-stamp', 'data-tier': tier }, word.toUpperCase()),
          ),
        ),
  );
  return page(
    app,
    'chl-book',
    'Word book',
    total === 0
      ? 'Every word you find is filed here, with how rare it is. Your first round fills the first page.'
      : `${total.toLocaleString('en-GB')} words collected of ${DICTIONARY_META.words.toLocaleString('en-GB')}. Rarity comes from the spell-checker lists' word sizes.`,
    tiers,
    letters,
    stamps,
  );
}

export function recordsScreen(app: App): Screen {
  const records = app.records();
  const level = readingLevel(records);
  const summary = h(
    'dl',
    { class: 'chl-stats chl-stats--wide' },
    ...[
      ['Board-reading level', level === null ? '—' : `${Math.round(level * 100)}%`],
      ['Boards read', String(records.rounds)],
      ['Words found', records.wordsFound.toLocaleString('en-GB')],
      ['Longest word', records.longestWord ? records.longestWord.toUpperCase() : '—'],
      ['Best chain', records.bestChain > 1 ? `×${records.bestChain}` : '—'],
      ['Daily Grids', String(Object.keys(records.dailies).length)],
    ].map(([label, value]) =>
      h('div', { class: 'chl-stat' }, h('dt', {}, label!), h('dd', {}, value!)),
    ),
  );
  const rows = Object.entries(records.setups)
    .sort()
    .map(([key, record]) => {
      const [size, rule, min] = key.split('-');
      const name = `${GRID_NAMES[Number(size) as 4 | 5 | 6]} · ${RULE_CARDS[rule as (typeof RULES)[number]]?.name ?? rule}${min === '3' ? '' : ` · ${min}+ letters`}`;
      return h(
        'tr',
        {},
        h('th', { scope: 'row' }, name),
        h('td', {}, String(record.boards)),
        h('td', {}, `${Math.round(record.bestCoverage * 100)}%`),
        h('td', {}, String(record.bestScore)),
      );
    });
  const table =
    rows.length === 0
      ? h(
          'p',
          { class: 'chl-page__quiet' },
          'Your best share of each kind of board will appear here.',
        )
      : h(
          'table',
          { class: 'chl-table' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', { scope: 'col' }, 'Board'),
              h('th', { scope: 'col' }, 'Played'),
              h('th', { scope: 'col' }, 'Best share'),
              h('th', { scope: 'col' }, 'Best score'),
            ),
          ),
          h('tbody', {}, ...rows),
        );
  const duels = h(
    'ul',
    { class: 'chl-duels' },
    ...STRENGTHS.map((strength) => {
      const duel = records.duels[String(strength)];
      return h(
        'li',
        {},
        h('strong', {}, HUNTERS[strength].name),
        duel ? ` won ${duel.won} of ${duel.played}` : ' not met yet',
      );
    }),
  );
  return page(
    app,
    'chl-records',
    'Records',
    'Your share of the board, as the 1988 program kept it: every word found over every word there was.',
    summary,
    table,
    h('h2', { class: 'chl-card__label' }, 'Duels'),
    duels,
  );
}

export function helpScreen(app: App): Screen {
  const points = [3, 5, 6, 7, 8].map((letters) =>
    h(
      'li',
      {},
      `${letters === 3 ? '3–4' : letters === 8 ? '8+' : letters} letters: ${basePoints('x'.repeat(letters))} ${basePoints('x'.repeat(letters)) === 1 ? 'point' : 'points'}`,
    ),
  );
  const sources = DICTIONARY_META.sources
    .map((source) => `${source.name} ${source.version} (${source.detail})`)
    .join(' and ');
  return page(
    app,
    'chl-help',
    'How to play',
    'Sixteen letter cubes, three minutes, and a dictionary that knows every word hiding in them.',
    h(
      'section',
      { class: 'chl-help' },
      h('h2', {}, 'Make words'),
      h(
        'p',
        {},
        'Drag across touching cubes, diagonals included, and let go to claim the word. Or click cubes one at a time and click the last again; or type the letters and press Enter. Words need three letters or more; the Qu cube counts as two letters.',
      ),
      h('h2', {}, 'Score'),
      h('ul', {}, ...points),
      h(
        'p',
        {},
        'Find words within four seconds of each other to build a chain: ×1.5, then ×2, then ×3.',
      ),
      h('h2', {}, 'Beat the dictionary'),
      h(
        'p',
        {},
        'When the bell rings you see every word the board held. Your share of them is your coverage; across every timed board it becomes your board-reading level, which opens the Big grid at 25% and the Mega grid at 35%.',
      ),
      h('h2', {}, 'Rule cards'),
      h(
        'ul',
        {},
        ...RULES.map((rule) =>
          h('li', {}, h('strong', {}, `${RULE_CARDS[rule].name}: `), RULE_CARDS[rule].text),
        ),
      ),
      h('h2', {}, 'Keys'),
      h(
        'ul',
        {},
        h(
          'li',
          {},
          'Letters type a word; Enter claims it; Backspace steps back; Delete clears it.',
        ),
        h('li', {}, 'Arrow keys move between cubes; Space or Enter adds the cube in focus.'),
        h('li', {}, 'Esc pauses. On the reveal, R plays again and H goes back to the Hall.'),
      ),
      h('h2', {}, 'About the dictionary'),
      h(
        'p',
        {},
        `${DICTIONARY_META.words.toLocaleString('en-GB')} words that two independent lists agree on: ${sources}. Words are checked, never defined.`,
      ),
    ),
  );
}
