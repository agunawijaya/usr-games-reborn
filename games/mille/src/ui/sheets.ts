import { type HandScore, type ScoreItem, SCORE_ITEMS } from '../engine/score';
import { formatPoints, h } from './dom';

/**
 * The score sheet after each hand, item by item as the original's score window lists them, and
 * the results card at the end of a game. Both are cards over the table, read by keyboard and
 * screen reader alike.
 */

const ITEM: Record<ScoreItem, { label: string; why: string }> = {
  milestones: { label: 'Miles laid', why: 'A point for every mile.' },
  safeties: { label: 'Safeties', why: '100 for each safety laid.' },
  allSafeties: { label: 'All four safeties', why: '300 more for laying all four.' },
  coups: { label: 'Coups fourrés', why: '300 for every hazard parried as it landed.' },
  trip: { label: 'Trip completed', why: '400 for finishing the trip exactly.' },
  safeTrip: { label: 'Safe trip', why: '300 more for finishing without a 200.' },
  delayedAction: { label: 'Delayed action', why: '300 for finishing after the deck ran out.' },
  extension: { label: 'Extension', why: '200 for finishing a trip extended to 1000.' },
  shutOut: { label: 'Shut-out', why: '500 for finishing before the rival moved a mile.' },
};

export interface SheetModel {
  kicker: string;
  title: string;
  story: string;
  names: [string, string];
  scores: [HandScore, HandScore];
  /** Game totals after this hand, for games of several hands. */
  totals: [number, number] | null;
  target: number | null;
  explain: boolean;
  notes: string[];
  next: { label: string; key: string; run(): void };
}

export interface Card {
  element: HTMLElement;
  focus(): void;
}

export function scoreSheet(model: SheetModel): Card {
  const rows = SCORE_ITEMS.filter(
    (item) => model.scores[0][item] > 0 || model.scores[1][item] > 0 || item === 'milestones',
  ).map((item) =>
    h(
      'tr',
      {},
      h(
        'th',
        { scope: 'row' },
        h('span', { class: 'dt-sheet__label' }, ITEM[item].label),
        model.explain ? h('span', { class: 'dt-sheet__why' }, ITEM[item].why) : null,
      ),
      h('td', {}, model.scores[0][item] ? formatPoints(model.scores[0][item]) : '—'),
      h('td', {}, model.scores[1][item] ? formatPoints(model.scores[1][item]) : '—'),
    ),
  );
  const next = h(
    'button',
    { class: 'dt-button dt-button--primary', type: 'button', onclick: model.next.run },
    model.next.label,
    h('kbd', {}, model.next.key),
  );
  const element = h(
    'div',
    { class: 'dt-sheet-wrap' },
    h(
      'div',
      {
        class: 'dt-panel dt-sheet',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'dt-sheet-title',
      },
      h('p', { class: 'dt-panel__kicker' }, model.kicker),
      h('h1', { class: 'dt-panel__title', id: 'dt-sheet-title' }, model.title),
      h('p', { class: 'dt-panel__lead' }, model.story),
      h(
        'table',
        { class: 'dt-sheet__table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', {}, ''),
            h('th', { scope: 'col' }, model.names[0]),
            h('th', { scope: 'col' }, model.names[1]),
          ),
        ),
        h('tbody', {}, ...rows),
        h(
          'tfoot',
          {},
          h(
            'tr',
            { class: 'dt-sheet__total' },
            h('th', { scope: 'row' }, 'This hand'),
            h('td', {}, formatPoints(model.scores[0].total)),
            h('td', {}, formatPoints(model.scores[1].total)),
          ),
          model.totals
            ? h(
                'tr',
                { class: 'dt-sheet__total' },
                h(
                  'th',
                  { scope: 'row' },
                  model.target ? `Game total (to ${formatPoints(model.target)})` : 'Game total',
                ),
                h('td', {}, formatPoints(model.totals[0])),
                h('td', {}, formatPoints(model.totals[1])),
              )
            : null,
        ),
      ),
      model.notes.length
        ? h('ul', { class: 'dt-notes' }, ...model.notes.map((note) => h('li', {}, note)))
        : null,
      h('div', { class: 'dt-panel__buttons' }, next),
    ),
  );
  return { element, focus: () => next.focus() };
}

export interface ResultsAction {
  label: string;
  key?: string;
  primary?: boolean;
  run(): void;
}

export interface ResultsModel {
  kicker: string;
  title: string;
  story: string;
  mood: 'won' | 'lost' | 'level';
  stats: { label: string; value: string }[];
  notes: string[];
  actions: ResultsAction[];
}

export function resultsCard(model: ResultsModel): Card {
  const buttons = model.actions.map((action) =>
    h(
      'button',
      {
        class: `dt-button${action.primary ? ' dt-button--primary' : ''}`,
        type: 'button',
        onclick: action.run,
      },
      action.label,
      action.key ? h('kbd', {}, action.key) : null,
    ),
  );
  const element = h(
    'div',
    { class: 'dt-sheet-wrap' },
    h(
      'div',
      {
        class: `dt-panel dt-results is-${model.mood}`,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'dt-results-title',
      },
      h('p', { class: 'dt-panel__kicker' }, model.kicker),
      h('h1', { class: 'dt-panel__title dt-results__title', id: 'dt-results-title' }, model.title),
      h('p', { class: 'dt-panel__lead' }, model.story),
      h(
        'dl',
        { class: 'dt-stats' },
        ...model.stats.map((s) => h('div', {}, h('dt', {}, s.label), h('dd', {}, s.value))),
      ),
      model.notes.length
        ? h('ul', { class: 'dt-notes' }, ...model.notes.map((note) => h('li', {}, note)))
        : null,
      h('div', { class: 'dt-panel__buttons' }, ...buttons),
    ),
  );
  return { element, focus: () => (buttons[0] as HTMLButtonElement | undefined)?.focus() };
}
