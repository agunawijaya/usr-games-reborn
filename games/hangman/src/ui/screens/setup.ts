import { ALL_DECKS } from '../../decks/decks';
import type { TierChoice } from '../../game/saves';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { playScreen } from './play';

/**
 * The two screens that come before a game: choosing a deck (and how hard) for a Beach day,
 * and setting up a Duel. Both sit on a card over the beach and remember the last choice.
 */
const TIERS: { id: TierChoice; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

function backButton(app: App) {
  return h(
    'button',
    { class: 'bt-button', type: 'button', 'data-choice': 'menu', onclick: () => app.go.title() },
    'Game menu',
  );
}

function calmBeach(app: App) {
  app.stage.setExtras({ wordPatch: false, gauge: false });
  app.stage.relayout(12, { title: true });
  app.stage.director.settle(0, 9);
}

export function deckScreen(app: App): Screen {
  const prefs = app.saves.prefs.load();
  const found = new Set(app.saves.records.load().decksFound);
  let deck = ALL_DECKS.some((d) => d.id === prefs.deck) ? prefs.deck : 'core';
  let tier: TierChoice = prefs.tier;

  const deckList = h('div', { class: 'bt-decks', role: 'radiogroup', 'aria-label': 'Deck' });
  const tierList = h('div', { class: 'bt-chips', role: 'radiogroup', 'aria-label': 'Difficulty' });
  const refresh = () => {
    for (const button of deckList.querySelectorAll<HTMLButtonElement>('button')) {
      button.setAttribute('aria-checked', String(button.dataset.deck === deck));
    }
    for (const button of tierList.querySelectorAll<HTMLButtonElement>('button')) {
      button.setAttribute('aria-checked', String(button.dataset.tier === tier));
    }
  };
  for (const option of ALL_DECKS) {
    deckList.append(
      h(
        'button',
        {
          class: 'bt-deck',
          type: 'button',
          role: 'radio',
          'data-deck': option.id,
          onclick: () => {
            deck = option.id;
            refresh();
          },
        },
        h(
          'span',
          { class: 'bt-deck__title' },
          option.title,
          found.has(option.id)
            ? h('span', { class: 'bt-deck__found', 'aria-label': 'explored' }, '✓')
            : null,
        ),
        h('span', { class: 'bt-deck__blurb' }, option.blurb),
        h(
          'span',
          { class: 'bt-deck__count' },
          `${option.words.length.toLocaleString('en-US')} words`,
        ),
      ),
    );
  }
  for (const option of TIERS) {
    tierList.append(
      h(
        'button',
        {
          class: 'bt-chip',
          type: 'button',
          role: 'radio',
          'data-tier': option.id,
          onclick: () => {
            tier = option.id;
            refresh();
          },
        },
        option.label,
      ),
    );
  }
  refresh();
  const start = () => {
    app.saves.prefs.update((p) => ({ ...p, deck, tier }));
    app.show(playScreen({ mode: 'beach', deckId: deck, tier }));
  };
  const card = h(
    'section',
    {
      class: 'bt-card bt-card--setup',
      'aria-labelledby': 'bt-deck-heading',
      'data-testid': 'bt-decks',
    },
    h('h2', { class: 'bt-card__title', id: 'bt-deck-heading' }, 'Beach day: choose a deck'),
    deckList,
    h(
      'div',
      { class: 'bt-setup-row' },
      h('span', { class: 'bt-setup-label' }, 'Difficulty'),
      tierList,
    ),
    h(
      'div',
      { class: 'bt-card__actions' },
      h(
        'button',
        {
          class: 'bt-button bt-button--primary',
          type: 'button',
          'data-choice': 'start',
          onclick: start,
        },
        'To the beach',
        h('kbd', { class: 'bt-kbd' }, 'Enter'),
      ),
      backButton(app),
    ),
  );
  calmBeach(app);
  return {
    element: h('div', { class: 'bt-setup' }, card),
    onKey(event) {
      if (
        event.key !== 'Enter' ||
        (event.target as HTMLElement).closest('.bt-deck, .bt-chip, .bt-button')
      )
        return false;
      start();
      return true;
    },
    focus() {
      deckList.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    },
  };
}

export function duelScreen(app: App): Screen {
  const prefs = app.saves.prefs.load();
  let turns = prefs.duelTurns;
  const nameInput = (index: 0 | 1) =>
    h('input', {
      class: 'bt-input',
      type: 'text',
      maxlength: 16,
      value: prefs.duelNames[index],
      'aria-label': `Player ${index + 1}'s name`,
      'data-testid': `bt-duel-name-${index + 1}`,
    });
  const first = nameInput(0);
  const second = nameInput(1);
  const turnList = h('div', { class: 'bt-chips', role: 'radiogroup', 'aria-label': 'Words each' });
  const refresh = () => {
    for (const button of turnList.querySelectorAll<HTMLButtonElement>('button')) {
      button.setAttribute('aria-checked', String(Number(button.dataset.turns) === turns));
    }
  };
  for (const count of [1, 2, 3]) {
    turnList.append(
      h(
        'button',
        {
          class: 'bt-chip',
          type: 'button',
          role: 'radio',
          'data-turns': count,
          onclick: () => {
            turns = count;
            refresh();
          },
        },
        `${count} each`,
      ),
    );
  }
  refresh();
  const start = (event?: Event) => {
    event?.preventDefault();
    const names: [string, string] = [
      first.value.trim() || 'Player 1',
      second.value.trim() || 'Player 2',
    ];
    if (names[0] === names[1]) names[1] = `${names[1]} 2`;
    app.saves.prefs.update((p) => ({ ...p, duelNames: names, duelTurns: turns }));
    app.show(playScreen({ mode: 'duel', duel: { names, turnsEach: turns } }));
  };
  const card = h(
    'form',
    {
      class: 'bt-card bt-card--setup',
      'aria-labelledby': 'bt-duel-heading',
      'data-testid': 'bt-duel-setup',
      onsubmit: start,
    },
    h('h2', { class: 'bt-card__title', id: 'bt-duel-heading' }, 'Duel on the sand'),
    h(
      'p',
      { class: 'bt-card__note' },
      'Take turns: one writes a secret word, the other guesses it. Fewer waves wins.',
    ),
    h('label', { class: 'bt-field' }, h('span', {}, 'First player'), first),
    h('label', { class: 'bt-field' }, h('span', {}, 'Second player'), second),
    h('div', { class: 'bt-setup-row' }, h('span', { class: 'bt-setup-label' }, 'Words'), turnList),
    h(
      'div',
      { class: 'bt-card__actions' },
      h(
        'button',
        { class: 'bt-button bt-button--primary', type: 'submit', 'data-choice': 'start' },
        'Start the duel',
      ),
      backButton(app),
    ),
  );
  calmBeach(app);
  return {
    element: h('div', { class: 'bt-setup' }, card),
    focus() {
      first.focus();
      first.select();
    },
  };
}
