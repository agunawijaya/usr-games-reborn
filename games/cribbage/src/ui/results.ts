import { h } from './dom';

/**
 * The card after a game, a trainer round or a Daily Discard: what happened, the numbers, what
 * the Hall granted, and the way on in the standard order (Play again, Game menu, Back to the
 * Hall), with Share after them for the Daily.
 */

export interface ResultsAction {
  id: string;
  label: string;
  key?: string;
  primary?: boolean;
  run(): void;
}

export interface ResultsModel {
  kicker: string;
  title: string;
  story: string | Node;
  mood: 'won' | 'lost' | 'done';
  /** A big number for the card's corner: the final score, the hands counted, the percentage. */
  figure?: { value: string; label: string };
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
        class: `ft-button${action.primary ? '' : ' ft-button--quiet'}`,
        'aria-keyshortcuts': action.key,
        'data-testid': `ft-results-${action.id}`,
        onclick: action.run,
      },
      action.label,
      action.key ? h('kbd', { class: 'ft-key' }, action.key) : null,
    ),
  );
  const heading = h(
    'h2',
    { class: 'ft-results-title', id: 'ft-results-title', tabindex: '-1' },
    model.title,
  );
  const element = h(
    'section',
    {
      class: 'ft-results ft-sheet-panel',
      'data-mood': model.mood,
      'aria-labelledby': 'ft-results-title',
      'data-testid': 'ft-results',
    },
    h(
      'div',
      { class: 'ft-results-head' },
      h(
        'div',
        {},
        h('p', { class: 'ft-results-kicker' }, model.kicker),
        heading,
        h('p', { class: 'ft-results-story' }, model.story),
      ),
      model.figure
        ? h(
            'div',
            { class: 'ft-results-figure' },
            h('b', {}, model.figure.value),
            h('span', {}, model.figure.label),
          )
        : null,
    ),
    h(
      'dl',
      { class: 'ft-stats' },
      ...model.stats.flatMap((stat) => [
        h('div', { class: 'ft-stat' }, h('dt', {}, stat.label), h('dd', {}, stat.value)),
      ]),
    ),
    model.footnotes.length > 0
      ? h('ul', { class: 'ft-footnotes' }, ...model.footnotes.map((note) => h('li', {}, note)))
      : null,
    h('div', { class: 'ft-results-actions' }, ...buttons),
  );
  const shownAt = performance.now();
  element.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      // Escape on the card goes to the game menu, before the Hall's pause menu hears it.
      event.preventDefault();
      event.stopPropagation();
      back();
      return;
    }
    // Keys still held from the last moment of play must not land on the card.
    if (performance.now() - shownAt < 600) return;
    const action = model.actions.find((a) => a.key?.toLowerCase() === event.key.toLowerCase());
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    action.run();
  });
  return { element, focus: () => heading.focus() };
}
