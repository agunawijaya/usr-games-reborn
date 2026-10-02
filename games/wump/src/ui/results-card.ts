import { h, keycap } from './dom';

/**
 * The calm card at the end of an expedition. It sits over the chamber and leaves the map in view,
 * because the map now shows where everything really was. Actions follow the collection's order:
 * Play again (R) · Game menu · Back to the Hall (H), with the game's own extras (Next cave, Share)
 * after them.
 */

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
  stats: readonly { label: string; value: string }[];
  /** Earned stars, for a campaign cave: each with what it was for. */
  stars?: readonly { earned: boolean; label: string }[];
  /** Lines under the stats: XP earned, a new record, a note on the rules. */
  footnotes?: readonly string[];
  mood: 'hushed' | 'lost';
  actions: readonly ResultsAction[];
}

function starIcon(earned: boolean): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `hw-star${earned ? ' is-earned' : ''}`);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute(
    'd',
    'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z',
  );
  svg.append(path);
  return svg;
}

export function resultsCard(model: ResultsModel): HTMLElement {
  const buttons = model.actions.map((action) =>
    h(
      'button',
      {
        type: 'button',
        class: `hw-results__button${action.primary ? ' is-primary' : ''}`,
        onclick: () => action.run(),
        dataset: { action: action.label },
      },
      action.label,
      action.key ? keycap(action.key) : null,
    ),
  );
  const stars = model.stars
    ? h(
        'ul',
        { class: 'hw-results__stars', 'aria-label': 'Stars' },
        ...model.stars.map((star) =>
          h(
            'li',
            { class: `hw-results__star${star.earned ? ' is-earned' : ''}` },
            starIcon(star.earned),
            h('span', {}, star.label),
            h('span', { class: 'hw-visually-hidden' }, star.earned ? ' (earned)' : ' (not yet)'),
          ),
        ),
      )
    : null;
  return h(
    'section',
    {
      class: `hw-results is-${model.mood}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'hw-results-title',
    },
    h(
      'div',
      { class: 'hw-results__card' },
      h('p', { class: 'hw-results__kicker' }, model.kicker),
      h('h2', { class: 'hw-results__title', id: 'hw-results-title', tabindex: '-1' }, model.title),
      h('p', { class: 'hw-results__story' }, model.story),
      stars,
      h(
        'dl',
        { class: 'hw-results__stats' },
        ...model.stats.map((stat) =>
          h('div', { class: 'hw-results__stat' }, h('dt', {}, stat.label), h('dd', {}, stat.value)),
        ),
      ),
      ...(model.footnotes ?? []).map((line) => h('p', { class: 'hw-results__foot' }, line)),
      h('div', { class: 'hw-results__actions' }, ...buttons),
    ),
  );
}
