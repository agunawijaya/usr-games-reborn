import { h } from './dom';

/**
 * The cards laid over the tank: the results at the end of a run, a question before progress is
 * lost, the tutorial's coach, and the keys shown as a run begins. Results follow the collection's
 * order: Play again (R) · Game menu · Back to the Hall (H), then the game's own extras (Next,
 * Share).
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
  /** Stars, each with what it was for, for a dive. */
  stars?: readonly { earned: boolean; label: string }[];
  /** The Daily Dive's bubbles against the day's par. */
  bubbles?: { earned: number; par: number } | null;
  footnotes?: readonly string[];
  mood: 'won' | 'lost';
  actions: readonly ResultsAction[];
}

const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z';

function svgIcon(className: string, draw: (svg: SVGSVGElement, ns: string) => void): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  draw(svg, ns);
  return svg;
}

export function starIcon(earned: boolean): SVGSVGElement {
  return svgIcon(`snk-star${earned ? ' is-earned' : ''}`, (svg, ns) => {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', STAR);
    svg.append(path);
  });
}

/** A bubble: a ring with a glint, filled when earned. */
export function bubbleIcon(earned: boolean): SVGSVGElement {
  return svgIcon(`snk-bubble${earned ? ' is-earned' : ''}`, (svg, ns) => {
    const ring = document.createElementNS(ns, 'circle');
    ring.setAttribute('cx', '12');
    ring.setAttribute('cy', '12');
    ring.setAttribute('r', '8.5');
    const glint = document.createElementNS(ns, 'path');
    glint.setAttribute('d', 'M8 10.5a4.5 4.5 0 0 1 3-3.2');
    glint.setAttribute('class', 'snk-bubble__glint');
    svg.append(ring, glint);
  });
}

function keycap(key: string): HTMLElement {
  return h('kbd', { class: 'snk-key' }, key);
}

export function resultsCard(model: ResultsModel): HTMLElement {
  const buttons = model.actions.map((action) => {
    const button = h(
      'button',
      {
        type: 'button',
        class: `snk-button snk-results__button${action.primary ? ' is-primary' : ''}`,
        'data-action': action.label,
      },
      action.label,
      action.key ? keycap(action.key) : null,
    );
    button.addEventListener('click', () => action.run());
    return button;
  });
  const stars = model.stars
    ? h(
        'ul',
        { class: 'snk-results__stars', 'aria-label': 'Stars' },
        ...model.stars.map((star) =>
          h(
            'li',
            { class: `snk-results__star${star.earned ? ' is-earned' : ''}` },
            starIcon(star.earned),
            h('span', {}, star.label),
            h('span', { class: 'snk-visually-hidden' }, star.earned ? ' (earned)' : ' (not yet)'),
          ),
        ),
      )
    : null;
  const bubbles = model.bubbles
    ? h(
        'p',
        {
          class: 'snk-results__bubbles',
          role: 'img',
          'aria-label': `${model.bubbles.earned} of 3 bubbles against today’s par`,
        },
        ...[0, 1, 2].map((i) => bubbleIcon(i < model.bubbles!.earned)),
        h('span', {}, `par ${model.bubbles.par.toLocaleString('en-GB')}`),
      )
    : null;
  return h(
    'section',
    {
      class: `snk-results is-${model.mood}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'snk-results-title',
    },
    h(
      'div',
      { class: 'snk-results__card' },
      h('p', { class: 'snk-results__kicker' }, model.kicker),
      h(
        'h2',
        { class: 'snk-results__title', id: 'snk-results-title', tabindex: '-1' },
        model.title,
      ),
      h('p', { class: 'snk-results__story' }, model.story),
      stars,
      bubbles,
      h(
        'dl',
        { class: 'snk-results__stats' },
        ...model.stats.map((stat) =>
          h(
            'div',
            { class: 'snk-results__stat' },
            h('dt', {}, stat.label),
            h('dd', {}, stat.value),
          ),
        ),
      ),
      ...(model.footnotes ?? []).map((line) => h('p', { class: 'snk-results__foot' }, line)),
      h('div', { class: 'snk-results__actions' }, ...buttons),
    ),
  );
}

export interface ConfirmText {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
}

/**
 * A question before progress is lost, in the game's own look. Escape or the safe answer says no;
 * focus stays inside until it is answered and then goes back where it was.
 */
export function askToConfirm(parent: HTMLElement, text: ConfirmText): Promise<boolean> {
  const returnFocus = document.activeElement as HTMLElement | null;
  const cancel = h('button', { type: 'button', class: 'snk-button is-primary' }, text.cancel);
  const confirm = h('button', { type: 'button', class: 'snk-button' }, text.confirm);
  const card = h(
    'section',
    {
      class: 'snk-confirm__card',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': 'snk-confirm-title',
      'aria-describedby': 'snk-confirm-body',
    },
    h('h2', { class: 'snk-confirm__title', id: 'snk-confirm-title' }, text.title),
    h('p', { id: 'snk-confirm-body' }, text.body),
    h('div', { class: 'snk-row' }, cancel, confirm),
  );
  const scrim = h('div', { class: 'snk-confirm' }, card);
  parent.append(scrim);
  cancel.focus();
  return new Promise((resolve) => {
    const answer = (yes: boolean) => {
      window.removeEventListener('keydown', onKey, true);
      scrim.remove();
      returnFocus?.focus();
      resolve(yes);
    };
    // Captured before the Hall sees it: Escape here closes the question, not the game.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        answer(false);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        (document.activeElement === cancel ? confirm : cancel).focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    cancel.addEventListener('click', () => answer(false));
    confirm.addEventListener('click', () => answer(true));
  });
}

/** The tutorial's coach: which lesson, what to do, and a nudge after a miss. */
export function coachCard(
  step: string,
  title: string,
  body: string,
  hint: string | null,
): HTMLElement {
  return h(
    'aside',
    { class: 'snk-coach', 'aria-live': 'polite' },
    h('p', { class: 'snk-coach__step' }, step),
    h('h2', { class: 'snk-coach__title' }, title),
    h('p', {}, body),
    hint ? h('p', { class: 'snk-coach__hint' }, hint) : null,
  );
}

/** The keys, shown along the bottom for the first moments of a run. */
export function keysHint(text: string): HTMLElement {
  return h('p', { class: 'snk-keys-hint', role: 'status' }, text);
}
