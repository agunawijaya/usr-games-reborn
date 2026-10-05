import { ALL_DECKS } from '../../decks/decks';
import { average, formatAverage } from '../../engine/score';
import type { App, Screen } from '../app';
import { h } from '../dom';

/** How to play, Records and Settings: cards over the beach, each with the way back. */
function page(app: App, title: string, testId: string, ...body: (HTMLElement | null)[]): Screen {
  app.stage.setExtras({ wordPatch: false, gauge: false });
  app.stage.relayout(12, { title: true });
  app.stage.director.settle(0, 9);
  const card = h(
    'section',
    {
      class: 'bt-card bt-card--page',
      'aria-labelledby': `${testId}-heading`,
      'data-testid': testId,
    },
    h('h2', { class: 'bt-card__title', id: `${testId}-heading` }, title),
    ...body,
    h(
      'div',
      { class: 'bt-card__actions' },
      h(
        'button',
        {
          class: 'bt-button bt-button--primary',
          type: 'button',
          'data-choice': 'menu',
          onclick: () => app.go.title(),
        },
        'Game menu',
      ),
    ),
  );
  return {
    element: h('div', { class: 'bt-setup' }, card),
    focus: () => card.querySelector<HTMLButtonElement>('[data-choice="menu"]')?.focus(),
  };
}

const CONTROLS: [string, string][] = [
  ['A to Z', 'Guess a letter (or click a shell)'],
  ['? or /', 'Light the Lighthouse: shows a letter, costs a wave'],
  ['Enter', 'Next word, or carry on after a moment'],
  ['Esc', 'Pause'],
  ['R / H', 'On the results: play again / back to the Hall'],
];

export function helpScreen(app: App): Screen {
  return page(
    app,
    'How to play',
    'bt-help',
    h(
      'p',
      { class: 'bt-card__note' },
      'A word is hidden in the wet sand. Guess it one letter at a time. A right letter writes itself in and decorates the castle; a wrong one sends a wave that washes part of it away. Seven waves and the tide takes the castle.',
    ),
    h(
      'p',
      { class: 'bt-card__note' },
      'Your score is the tide average: the waves each word took, averaged like golf. Lower is better, and a word the tide takes counts nine.',
    ),
    h(
      'dl',
      { class: 'bt-card__rows' },
      ...CONTROLS.flatMap(([keys, action]) => [
        h('dt', {}, h('kbd', { class: 'bt-kbd' }, keys)),
        h('dd', {}, action),
      ]),
    ),
    h(
      'p',
      { class: 'bt-card__note' },
      'Modes: the Daily Word (the same word for everyone), Beach day (pick a deck), Tide run (ten words against one castle, a clean word mends it), Duel (two players, secret words) and Classic (the 1983 rules).',
    ),
  );
}

export function recordsScreen(app: App): Screen {
  const records = app.saves.records.load();
  const days = Object.keys(records.dailies).sort().slice(-7);
  const rows: [string, string][] = [
    ['Tide average, all time', formatAverage(average(records.lifetime))],
    ['Words played', String(records.lifetime.words)],
    ['Words found', String(records.found)],
    ['Without a wave', String(records.clean)],
    [
      'Best beach of ten or more',
      records.bestBeach === null ? '–' : formatAverage(records.bestBeach),
    ],
    ['Best Tide run', `${records.bestRun} of 10`],
    ['Duels', String(records.duels)],
    ['Decks explored', `${records.decksFound.length} of ${ALL_DECKS.length}`],
    ['Daily Words', String(records.dailyCount)],
  ];
  return page(
    app,
    'Records',
    'bt-records',
    h(
      'dl',
      { class: 'bt-card__rows' },
      ...rows.flatMap(([term, value]) => [h('dt', {}, term), h('dd', {}, value)]),
    ),
    days.length > 0
      ? h(
          'p',
          { class: 'bt-card__note' },
          'Recent Daily Words: ',
          ...days.map((day) => {
            const entry = records.dailies[day]!;
            return h(
              'span',
              { class: 'bt-day' },
              `${day.slice(5)} ${entry.waves === null ? '🌊' : `🏰${entry.waves}`}`,
            );
          }),
        )
      : null,
  );
}

export function settingsScreen(app: App): Screen {
  const note = h('p', { class: 'bt-card__note', role: 'status' });
  return page(
    app,
    'Settings',
    'bt-settings',
    h(
      'p',
      { class: 'bt-card__note' },
      'Sound, light or dark, and reduced motion follow the Hall’s settings. Under reduced motion the waves become gentle fades.',
    ),
    h(
      'div',
      { class: 'bt-card__actions' },
      h(
        'button',
        { class: 'bt-button', type: 'button', onclick: () => app.context.openSettings() },
        'Open the Hall’s settings',
      ),
      h(
        'button',
        {
          class: 'bt-button',
          type: 'button',
          onclick: async () => {
            const forgotten = await app.context.forgetData();
            note.textContent = forgotten ? 'The beach has forgotten your words and records.' : '';
          },
        },
        'Forget Before the Tide’s data',
      ),
    ),
    note,
  );
}
