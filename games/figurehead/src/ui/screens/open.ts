import { normaliseCode, PRACTICE_KINDS } from '../../voyage/daily';
import type { Quality } from '../../voyage/types';
import type { App, Screen } from '../app';
import { KIND_TEASERS, KIND_TITLES } from '../copy';
import { button, h } from '../dom';

/** Open water: any action, any crew, any seed. Nothing goes in her log; it is all practice. */
export function openScreen(app: App): Screen {
  const practice = { ...app.saves.open.load() };
  const kinds = h('div', { class: 'fh-kinds', role: 'radiogroup', 'aria-label': 'Action' });
  const code = h('input', {
    type: 'text',
    maxlength: '24',
    value: practice.code,
    placeholder: 'any words: the same words, the same sea',
    'aria-label': 'Sea code',
    dataset: { testid: 'fh-open-code' },
  });
  const drawKinds = () =>
    kinds.replaceChildren(
      ...PRACTICE_KINDS.map((kind) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(kind === practice.kind),
            class: `fh-kind${kind === practice.kind ? ' is-chosen' : ''}`,
            dataset: { testid: `fh-open-${kind}` },
            onclick: () => {
              practice.kind = kind;
              drawKinds();
            },
          },
          h('b', {}, KIND_TITLES[kind]),
          h('span', {}, KIND_TEASERS[kind]),
        ),
      ),
    );
  drawKinds();
  const select = (
    label: string,
    values: [number, string][],
    current: number,
    set: (v: number) => void,
    testId: string,
  ) =>
    h(
      'label',
      { class: 'fh-field' },
      h('span', {}, label),
      h(
        'select',
        {
          dataset: { testid: testId },
          onchange: (e: Event) => set(Number((e.target as HTMLSelectElement).value)),
        },
        values.map(([v, text]) => h('option', { value: String(v), selected: v === current }, text)),
      ),
    );
  const start = () => {
    practice.code = normaliseCode(code.value);
    app.saves.open.save(practice);
    app.go.briefing({ kind: 'open', practice: { ...practice } });
  };
  const element = h(
    'section',
    { class: 'fh-screen fh-open', dataset: { testid: 'fh-open' } },
    h(
      'div',
      { class: 'fh-sheet fh-sheet--wide' },
      h('p', { class: 'fh-kicker' }, 'Open water'),
      h('h1', {}, 'Choose an action'),
      kinds,
      h(
        'div',
        { class: 'fh-open__fields' },
        select(
          'The enemy',
          [
            [0, 'Raw recruits'],
            [1, 'Seasoned'],
            [2, 'Veterans'],
            [3, 'The best they have'],
          ],
          practice.pressure,
          (v) => (practice.pressure = v),
          'fh-open-pressure',
        ),
        select(
          'Your crew',
          [
            [2, 'Green'],
            [3, 'Steady'],
            [4, 'Crack'],
            [5, 'Elite'],
          ],
          practice.qual,
          (v) => (practice.qual = v as Quality),
          'fh-open-crew',
        ),
        h('label', { class: 'fh-field' }, h('span', {}, 'Sea code'), code),
      ),
      h(
        'div',
        { class: 'fh-actions' },
        button('Read the orders', {
          onClick: start,
          key: 'Enter',
          variant: 'primary',
          testId: 'fh-open-go',
        }),
        button('Game menu', { onClick: () => app.go.title(), testId: 'fh-open-menu' }),
      ),
    ),
  );
  return {
    element,
    onKey(event) {
      if (
        event.key === 'Enter' &&
        document.activeElement?.tagName !== 'BUTTON' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        start();
        return true;
      }
      if (event.key === 'Escape') {
        app.go.title();
        return true;
      }
      return false;
    },
    focus: () =>
      kinds.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true }),
  };
}
