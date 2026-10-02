import { h } from './dom';

/**
 * The cards laid over the garden: the results at the end of a run, a question before progress
 * is lost, the tutorial's coach, and the hint while the noodle waits for its first move.
 * Results follow the collection's order: Play again (R) · Game menu · Back to the Hall (H), then
 * the game's own extras (Next, Share).
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
  /** Stars, each with what it was for, for a garden or a fill puzzle. */
  stars?: readonly { earned: boolean; label: string }[];
  footnotes?: readonly string[];
  mood: 'won' | 'lost';
  actions: readonly ResultsAction[];
}

function keycap(key: string): HTMLElement {
  return h('kbd', { class: 'nn-key' }, key);
}

function starIcon(earned: boolean): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `nn-star${earned ? ' is-earned' : ''}`);
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
  const buttons = model.actions.map((action) => {
    const button = h(
      'button',
      {
        type: 'button',
        class: `nn-button nn-results__button${action.primary ? ' is-primary' : ''}`,
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
        { class: 'nn-results__stars', 'aria-label': 'Stars' },
        ...model.stars.map((star) =>
          h(
            'li',
            { class: `nn-results__star${star.earned ? ' is-earned' : ''}` },
            starIcon(star.earned),
            h('span', {}, star.label),
            h('span', { class: 'nn-visually-hidden' }, star.earned ? ' (earned)' : ' (not yet)'),
          ),
        ),
      )
    : null;
  return h(
    'section',
    {
      class: `nn-results is-${model.mood}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'nn-results-title',
    },
    h(
      'div',
      { class: 'nn-results__card' },
      h('p', { class: 'nn-results__kicker' }, model.kicker),
      h('h2', { class: 'nn-results__title', id: 'nn-results-title', tabindex: '-1' }, model.title),
      h('p', { class: 'nn-results__story' }, model.story),
      stars,
      h(
        'dl',
        { class: 'nn-results__stats' },
        ...model.stats.map((stat) =>
          h('div', { class: 'nn-results__stat' }, h('dt', {}, stat.label), h('dd', {}, stat.value)),
        ),
      ),
      ...(model.footnotes ?? []).map((line) => h('p', { class: 'nn-results__foot' }, line)),
      h('div', { class: 'nn-results__actions' }, ...buttons),
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
 * A question before progress is lost, in the game's own look. Escape or the safe answer says
 * no; focus stays inside until it is answered and then goes back where it was.
 */
export function askToConfirm(parent: HTMLElement, text: ConfirmText): Promise<boolean> {
  const returnFocus = document.activeElement as HTMLElement | null;
  const cancel = h('button', { type: 'button', class: 'nn-button is-primary' }, text.cancel);
  const confirm = h('button', { type: 'button', class: 'nn-button' }, text.confirm);
  const card = h(
    'section',
    {
      class: 'nn-confirm__card',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': 'nn-confirm-title',
      'aria-describedby': 'nn-confirm-body',
    },
    h('h2', { class: 'nn-confirm__title', id: 'nn-confirm-title' }, text.title),
    h('p', { id: 'nn-confirm-body' }, text.body),
    h('div', { class: 'nn-row' }, cancel, confirm),
  );
  const scrim = h('div', { class: 'nn-confirm' }, card);
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

/** The tutorial's coach: which lesson, what to do, and a nudge after a near miss. */
export function coachCard(
  step: string,
  title: string,
  body: string,
  hint: string | null,
): HTMLElement {
  return h(
    'aside',
    { class: 'nn-coach', 'aria-live': 'polite' },
    h('p', { class: 'nn-coach__step' }, step),
    h('h2', { class: 'nn-coach__title' }, title),
    h('p', {}, body),
    hint ? h('p', { class: 'nn-coach__hint' }, hint) : null,
  );
}

/** The line shown while the noodle waits for its first move. */
export function startHint(text: string): HTMLElement {
  return h('p', { class: 'nn-start-hint', role: 'status' }, text);
}
