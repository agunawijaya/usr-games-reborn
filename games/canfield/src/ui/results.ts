import { h } from './dom';

/**
 * The card over the table when a deal ends: what happened, the numbers, whether a lost deal
 * could have been won (settled by the solver while the card is shown), and the way on:
 * Play again (R) · Game menu · Back to the Hall (H), then anything the mode adds.
 */

export interface ResultsAction {
  id: string;
  label: string;
  key?: string;
  primary?: boolean;
  run: () => void;
}

export interface ResultsModel {
  kicker: string;
  title: string;
  story: string;
  mood: 'won' | 'lost' | 'ended';
  stats: { label: string; value: string }[];
  /** Points lines or the Bank statement, each `label · value`. */
  breakdown: { label: string; value: string; total?: boolean }[];
  /** "Was this deal winnable?" while the solver works; updated with `setVerdict`. */
  verdict: string | null;
  footnotes: string[];
  actions: ResultsAction[];
}

export interface ResultsCard {
  element: HTMLElement;
  setVerdict(text: string): void;
  addFootnotes(lines: string[]): void;
  focus(): void;
}

export function resultsCard(model: ResultsModel): ResultsCard {
  const verdict = h(
    'p',
    { class: 'td-results__verdict', 'data-testid': 'td-verdict' },
    model.verdict ?? '',
  );
  verdict.hidden = model.verdict === null;
  const notes = h(
    'ul',
    { class: 'td-results__notes' },
    ...model.footnotes.map((n) => h('li', {}, n)),
  );
  const title = h('h2', { class: 'td-results__title', tabindex: '-1' }, model.title);
  const card = h(
    'section',
    {
      class: `td-results td-results--${model.mood}`,
      role: 'dialog',
      'aria-modal': 'false',
      'aria-label': model.title,
      'data-testid': 'td-results',
    },
    h('p', { class: 'td-results__kicker' }, model.kicker),
    title,
    h('p', { class: 'td-results__story' }, model.story),
    verdict,
    h(
      'dl',
      { class: 'td-results__stats' },
      ...model.stats.map((s) => h('div', {}, h('dt', {}, s.label), h('dd', {}, s.value))),
    ),
    model.breakdown.length > 0
      ? h(
          'table',
          { class: 'td-results__breakdown' },
          h(
            'tbody',
            {},
            ...model.breakdown.map((line) =>
              h(
                'tr',
                { class: line.total ? 'is-total' : '' },
                h('th', { scope: 'row' }, line.label),
                h('td', {}, line.value),
              ),
            ),
          ),
        )
      : null,
    notes,
    h(
      'div',
      { class: 'td-results__actions' },
      ...model.actions.map((action) =>
        h(
          'button',
          {
            type: 'button',
            class: `td-button${action.primary ? ' td-button--primary' : ''}`,
            'data-action': action.id,
            'data-testid': `td-results-${action.id}`,
            onclick: () => action.run(),
          },
          action.label,
          action.key ? h('kbd', {}, action.key) : null,
        ),
      ),
    ),
  );
  const element = h('div', { class: 'td-results-layer' }, card);
  return {
    element,
    setVerdict(text) {
      verdict.textContent = text;
      verdict.hidden = false;
    },
    addFootnotes(lines) {
      for (const line of lines) notes.append(h('li', {}, line));
    },
    focus() {
      title.focus();
    },
  };
}
