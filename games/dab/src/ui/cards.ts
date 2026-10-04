import type { MarkId } from '../render/marks';
import { h, markIcon } from './dom';

/** The cards that sit over the board: before a match, after it, and "are you sure?". */

export interface IntroModel {
  readonly eyebrow: string;
  readonly title: string;
  readonly lines: readonly string[];
  readonly rival: { readonly name: string; readonly blurb: string; readonly mark: MarkId } | null;
  readonly start: string;
}

export function introCard(model: IntroModel, onStart: () => void): HTMLElement {
  return h(
    'section',
    {
      class: 'dx-card dx-panel dx-intro',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': 'dx-intro-title',
      'data-testid': 'dx-intro',
    },
    h('span', { class: 'dx-eyebrow' }, model.eyebrow),
    h('h1', { id: 'dx-intro-title' }, model.title),
    model.rival
      ? h(
          'div',
          { class: 'dx-rival dx-rival-big' },
          markIcon(model.rival.mark),
          h('b', {}, model.rival.name),
          h('p', {}, model.rival.blurb),
        )
      : null,
    h('ul', { class: 'dx-facts' }, ...model.lines.map((line) => h('li', {}, line))),
    h(
      'div',
      { class: 'dx-row' },
      h(
        'button',
        {
          class: 'dx-btn dx-btn-primary',
          type: 'button',
          onclick: onStart,
          'data-autofocus': true,
          'data-testid': 'dx-start',
        },
        model.start,
        h('span', { class: 'dx-key' }, 'Enter'),
      ),
    ),
  );
}

export interface ResultsModel {
  readonly eyebrow: string;
  readonly title: string;
  readonly calm: boolean;
  readonly score: readonly [number, number];
  readonly names: readonly [string, string];
  readonly lead: string;
  readonly quote: string | null;
  readonly tally: ReadonlyArray<readonly [string, string]>;
  readonly notes: readonly string[];
  readonly next: { readonly label: string; readonly run: () => void } | null;
  readonly share: (() => void) | null;
}

export interface ResultsHandlers {
  readonly again: () => void;
  readonly menu: () => void;
  readonly hall: () => void;
}

export function resultsCard(model: ResultsModel, handlers: ResultsHandlers): HTMLElement {
  const button = (
    label: string,
    choice: string,
    onclick: () => void,
    key: string | null,
    primary = false,
  ) =>
    h(
      'button',
      {
        class: primary ? 'dx-btn dx-btn-primary' : 'dx-btn',
        type: 'button',
        'data-choice': choice,
        'data-autofocus': primary || null,
        onclick,
      },
      label,
      key ? h('span', { class: 'dx-key' }, key) : null,
    );
  return h(
    'section',
    {
      class: 'dx-card dx-panel dx-results',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': 'dx-results-title',
      'data-testid': 'dx-results',
    },
    h('span', { class: `dx-eyebrow${model.calm ? ' dx-eyebrow-calm' : ''}` }, model.eyebrow),
    h('h1', { id: 'dx-results-title' }, model.title),
    h(
      'div',
      {
        class: 'dx-final',
        'aria-label': `${model.names[0]} ${model.score[0]}, ${model.names[1]} ${model.score[1]}`,
      },
      h('span', { class: 'dx-final-0' }, h('b', {}, String(model.score[0])), model.names[0]),
      h('i', { 'aria-hidden': 'true' }, '–'),
      h('span', { class: 'dx-final-1' }, h('b', {}, String(model.score[1])), model.names[1]),
    ),
    h('p', {}, model.lead),
    model.quote ? h('p', { class: 'dx-quote' }, `“${model.quote}”`) : null,
    model.tally.length
      ? h(
          'div',
          { class: 'dx-tally' },
          ...model.tally.map(([value, label]) => h('span', {}, h('b', {}, value), ` ${label}`)),
        )
      : null,
    ...model.notes.map((note) => h('p', { class: 'dx-note' }, note)),
    h(
      'div',
      { class: 'dx-row' },
      model.next ? button(model.next.label, 'next', model.next.run, 'N', true) : null,
      button('Play again', 'again', handlers.again, 'R', !model.next),
      button('Game menu', 'menu', handlers.menu, null),
      button('Back to the Hall', 'hall', handlers.hall, 'H'),
      model.share ? button('Share', 'share', model.share, null) : null,
    ),
  );
}

export function confirmCard(
  title: string,
  body: string,
  confirm: { label: string; run: () => void },
  cancel: () => void,
): HTMLElement {
  return h(
    'section',
    {
      class: 'dx-card dx-panel dx-confirm',
      role: 'alertdialog',
      'aria-modal': 'false',
      'aria-labelledby': 'dx-confirm-title',
      'data-testid': 'dx-confirm',
    },
    h('h1', { id: 'dx-confirm-title' }, title),
    h('p', {}, body),
    h(
      'div',
      { class: 'dx-row' },
      h(
        'button',
        { class: 'dx-btn', type: 'button', onclick: confirm.run, 'data-choice': 'confirm' },
        confirm.label,
      ),
      h(
        'button',
        {
          class: 'dx-btn dx-btn-primary',
          type: 'button',
          onclick: cancel,
          'data-autofocus': true,
          'data-choice': 'cancel',
        },
        'Keep playing',
      ),
    ),
  );
}
