import { RANKS } from '../../engine/params';
import type { RankId, RuleSet, WatchLength } from '../../engine/types';
import { normaliseCode } from '../../game/saves';
import type { App, Screen } from '../app';
import { button, h } from '../dom';

/**
 * An open watch: any rank, any length, career rules or the full 1976 set, and a code. The
 * original seeded its tournament games from a typed code; the same code here gives the same
 * Reach, so friends can keep the same watch and compare.
 */

const WORDS = [
  'harbour',
  'ember',
  'quill',
  'lantern',
  'tide',
  'rook',
  'amber',
  'gale',
  'beacon',
  'fen',
  'moth',
  'lark',
];

function randomCode(): string {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)]!;
  return `${pick()}-${pick()}-${Math.floor(Math.random() * 90 + 10)}`;
}

export function openWatchScreen(app: App): Screen {
  const saved = app.saves.open.load();
  let rank: RankId = saved.rank;
  let length: WatchLength = saved.length;
  let ruleSet: RuleSet = saved.ruleSet;

  const code = h('input', {
    type: 'text',
    class: 'lk-input',
    value: saved.code || randomCode(),
    maxlength: '24',
    'aria-label': 'Code',
    dataset: { testid: 'lk-open-code' },
  });
  const choice = <T extends string | number>(
    name: string,
    options: { value: T; label: string; note?: string }[],
    get: () => T,
    set: (value: T) => void,
  ) => {
    const group = h('div', { class: 'lk-choice', role: 'radiogroup', 'aria-label': name });
    const render = () => {
      group.replaceChildren(
        ...options.map((option) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(get() === option.value),
              class: 'lk-choice__option',
              onclick: () => {
                set(option.value);
                render();
              },
            },
            h('b', {}, option.label),
            option.note ? h('span', {}, option.note) : null,
          ),
        ),
      );
    };
    render();
    return group;
  };

  const begin = () => {
    const typed = normaliseCode(code.value) || randomCode();
    app.saves.open.save({ code: typed, rank, length, ruleSet });
    app.go.briefing({ kind: 'open', code: typed, rank, length, ruleSet });
  };

  const element = h(
    'section',
    { class: 'lk-screen lk-open', dataset: { testid: 'lk-open' } },
    h(
      'div',
      { class: 'lk-page lk-page--narrow' },
      h(
        'header',
        { class: 'lk-page__head' },
        h('p', { class: 'lk-kicker' }, 'Open watch'),
        h('h2', {}, 'Pick your Reach'),
      ),
      h(
        'p',
        {},
        'Type any code. The same code with the same settings always gives the same Reach, the way the original’s tournament codes did.',
      ),
      h(
        'label',
        { class: 'lk-field' },
        h('span', {}, 'Code'),
        h(
          'span',
          { class: 'lk-field__row' },
          code,
          button('Another', { onClick: () => (code.value = randomCode()), variant: 'quiet' }),
        ),
      ),
      h(
        'div',
        { class: 'lk-field' },
        h('span', {}, 'Rank'),
        choice(
          'Rank',
          RANKS.map((r) => ({ value: r.id, label: r.title, note: r.originalLevel })),
          () => rank,
          (v) => (rank = v),
        ),
      ),
      h(
        'div',
        { class: 'lk-field' },
        h('span', {}, 'Length'),
        choice<WatchLength>(
          'Length',
          [
            { value: 1, label: 'Short', note: 'about 10–20 minutes' },
            { value: 2, label: 'Medium', note: 'twice the swarm' },
            { value: 4, label: 'Long', note: 'an evening' },
          ],
          () => length,
          (v) => (length = v),
        ),
      ),
      h(
        'div',
        { class: 'lk-field' },
        h('span', {}, 'Rules'),
        choice<RuleSet>(
          'Rules',
          [
            {
              value: 'classic',
              label: '1976',
              note: 'every event at every rank, the original numbers',
            },
            { value: 'commission', label: 'Career', note: 'the career’s gentler curve' },
          ],
          () => ruleSet,
          (v) => (ruleSet = v),
        ),
      ),
      h(
        'div',
        { class: 'lk-page__actions' },
        button('Read the orders', {
          onClick: begin,
          key: 'Enter',
          variant: 'primary',
          testId: 'lk-open-begin',
        }),
        button('Game menu', { onClick: () => app.go.title(), variant: 'quiet' }),
      ),
    ),
  );

  return {
    element,
    onKey(event) {
      if (event.key === 'Enter' && document.activeElement === code) {
        begin();
        return true;
      }
      return false;
    },
    focus: () => code.focus({ preventScroll: true }),
  };
}
