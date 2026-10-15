import { h, svg } from './dom';
import { FISH_ICON, GOLD_FISH_ICON } from './icons';

/**
 * The results card after the last fish has swum its lap: who won, everyone's catch as a row of
 * fish, your numbers, what the Hall granted, and the way on in the standard order (Play again,
 * Game menu, Back to the Hall), with Share for the Daily Pond and Next round in a Tournament.
 */

export interface ResultsAction {
  id: string;
  label: string;
  key?: string;
  primary?: boolean;
  run(): void;
}

export interface CatchRow {
  name: string;
  books: readonly { golden: boolean }[];
  winner: boolean;
}

export interface ResultsModel {
  kicker: string;
  title: string;
  story: string;
  mood: 'won' | 'tied' | 'lost';
  catches: readonly CatchRow[];
  stats: readonly { label: string; value: string }[];
  footnotes: readonly string[];
  actions: readonly ResultsAction[];
}

export interface ResultsCard {
  element: HTMLElement;
  focus(): void;
}

export function resultsCard(model: ResultsModel, back: () => void): ResultsCard {
  const buttons = model.actions.map((action) =>
    h(
      'button',
      {
        type: 'button',
        class: `gf-button${action.primary ? ' is-primary' : ''}`,
        'aria-keyshortcuts': action.key,
        'data-testid': `gf-results-${action.id}`,
        onclick: action.run,
      },
      action.label,
      action.key ? h('kbd', { class: 'gf-key' }, action.key) : null,
    ),
  );
  const heading = h(
    'h2',
    { class: 'gf-results-title', id: 'gf-results-title', tabindex: '-1' },
    model.title,
  );
  const element = h(
    'section',
    {
      class: 'gf-results gf-panel',
      'data-mood': model.mood,
      'aria-labelledby': 'gf-results-title',
      'data-testid': 'gf-results',
    },
    h('p', { class: 'gf-results-kicker' }, model.kicker),
    heading,
    h('p', { class: 'gf-results-story' }, model.story),
    h(
      'ul',
      { class: 'gf-catches', 'aria-label': 'Everyone’s catch' },
      ...model.catches.map((row) =>
        h(
          'li',
          { class: 'gf-catch', 'data-winner': String(row.winner) },
          h('span', { class: 'gf-catch-name' }, row.name),
          h(
            'span',
            {
              class: 'gf-catch-fish',
              'aria-label': `${row.books.length} ${row.books.length === 1 ? 'book' : 'books'}`,
            },
            ...row.books.map((book) => svg(book.golden ? GOLD_FISH_ICON : FISH_ICON)),
          ),
          h('span', { class: 'gf-catch-count' }, String(row.books.length)),
        ),
      ),
    ),
    h(
      'dl',
      { class: 'gf-stats' },
      ...model.stats.flatMap((stat) => [h('dt', {}, stat.label), h('dd', {}, stat.value)]),
    ),
    model.footnotes.length > 0
      ? h('ul', { class: 'gf-footnotes' }, ...model.footnotes.map((note) => h('li', {}, note)))
      : null,
    h('div', { class: 'gf-results-actions' }, ...buttons),
  );
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // Escape on the card goes to the game menu, before the Hall's pause menu hears it.
    event.preventDefault();
    event.stopPropagation();
    back();
  });
  return { element, focus: () => heading.focus() };
}
