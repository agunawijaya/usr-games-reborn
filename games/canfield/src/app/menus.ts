import { rankLabel, rankOf } from '@usr-games/kit/cards';
import {
  BANK,
  costsOf,
  netOf,
  type Scoring,
  type Statement,
  STATEMENT_ROWS,
} from '../engine/ledger';
import type { RuleSet } from '../engine/rules';
import { goalText, type Challenge } from '../modes/challenges';
import { formatTime } from '../play/clock';
import { h } from '../ui/dom';
import { money } from '../ui/panels';
import type { BankBook, ChallengeRecord, DailyRecord, Prefs, Records, RulesRecord } from './saves';

/**
 * The screens around the table: the game menu and the pages it opens. Each is a plain element
 * with its buttons wired to the actions the app gives it. Escape on any page but the game menu
 * returns to the game menu (the app listens); on the game menu the Hall takes Escape.
 */

export interface Screen {
  element: HTMLElement;
  /** The game menu: the Hall shows only "Back to the Hall" there, and Escape leaves. */
  isTitle?: boolean;
  focus(): void;
}

function menuItem(
  label: string,
  detail: string,
  key: string,
  run: () => void,
  testid: string,
  primary = false,
): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      class: `td-menu__item${primary ? ' is-primary' : ''}`,
      'data-testid': testid,
      'aria-keyshortcuts': key,
      onclick: run,
    },
    h('span', { class: 'td-menu__label' }, label),
    h('span', { class: 'td-menu__detail' }, detail),
    h('kbd', { class: 'td-menu__key' }, key),
  );
}

/** Letters on a page press its buttons: N for New deal, and so on. */
function withKeys(element: HTMLElement): HTMLElement {
  element.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if ((event.target as HTMLElement).closest('input, select, textarea')) return;
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    const button = element.querySelector<HTMLButtonElement>(
      `button[aria-keyshortcuts="${CSS.escape(key)}"]`,
    );
    if (button && !button.disabled) {
      event.preventDefault();
      button.click();
    }
  });
  return element;
}

function page(
  title: string,
  testid: string,
  back: { run: () => void; label: string } | (() => void),
  ...body: (HTMLElement | null)[]
): HTMLElement {
  const way = typeof back === 'function' ? { run: back, label: '← Game menu' } : back;
  return withKeys(
    h(
      'section',
      { class: 'td-page', 'aria-labelledby': `${testid}-title`, 'data-testid': testid },
      h(
        'header',
        { class: 'td-page__head' },
        h('h2', { class: 'td-page__title', id: `${testid}-title`, tabindex: '-1' }, title),
        h(
          'button',
          { type: 'button', class: 'td-button', onclick: way.run, 'data-testid': `${testid}-back` },
          way.label,
          h('kbd', {}, 'Esc'),
        ),
      ),
      ...body,
    ),
  );
}

function focusFirst(element: HTMLElement): () => void {
  return () =>
    (
      element.querySelector<HTMLElement>('.td-page__title, .td-menu__item, button') ?? element
    ).focus();
}

// —— the game menu ——

export interface TitleModel {
  continueLine: string | null;
  dailyNumber: number;
  dailyLine: string;
  challengesDone: number;
  challengesTotal: number;
  tutorialDone: boolean;
  scoring: Scoring;
  rules: RuleSet;
  balance: number;
}

export interface TitleActions {
  resume(): void;
  newDeal(): void;
  daily(): void;
  challenges(): void;
  tutorial(): void;
  help(): void;
  settings(): void;
  records(): void;
}

export function titleScreen(model: TitleModel, actions: TitleActions): Screen {
  const items = [
    model.continueLine
      ? menuItem('Continue', model.continueLine, 'C', actions.resume, 'td-menu-continue', true)
      : null,
    menuItem(
      'New deal',
      `${model.rules === 'standard' ? 'Standard' : 'Relaxed'} · ${model.scoring === 'bank' ? `Bank, ${money(model.balance)}` : 'Points'}`,
      'N',
      actions.newDeal,
      'td-menu-new',
      !model.continueLine,
    ),
    menuItem(
      `Daily Deal #${model.dailyNumber}`,
      model.dailyLine,
      'D',
      actions.daily,
      'td-menu-daily',
    ),
    menuItem(
      'Challenges',
      `${model.challengesDone} of ${model.challengesTotal} done`,
      'G',
      actions.challenges,
      'td-menu-challenges',
    ),
    menuItem(
      'Tutorial',
      model.tutorialDone ? 'Ninety seconds, again' : 'Ninety seconds to learn the table',
      'T',
      actions.tutorial,
      'td-menu-tutorial',
    ),
    menuItem(
      'How to play',
      'Rules, keys and the price of a peek',
      '?',
      actions.help,
      'td-menu-help',
    ),
    menuItem(
      'Records',
      'Best scores, runs of wins, the account book',
      'R',
      actions.records,
      'td-menu-records',
    ),
    menuItem(
      'Settings',
      'Scoring, rules, four-colour suits, sound',
      'S',
      actions.settings,
      'td-menu-settings',
    ),
  ];
  const element = withKeys(
    h(
      'section',
      { class: 'td-title', 'aria-labelledby': 'td-title-heading', 'data-testid': 'td-title' },
      h(
        'div',
        { class: 'td-title__card' },
        h('p', { class: 'td-title__kicker' }, 'Canfield, from the Berkeley games'),
        h('h1', { class: 'td-title__heading', id: 'td-title-heading' }, 'Thirteen Down'),
        h(
          'p',
          { class: 'td-title__tagline' },
          'Thirteen in reserve. Four to build. One bloom to finish.',
        ),
        h(
          'nav',
          { class: 'td-menu', 'aria-label': 'Game menu' },
          ...items.filter((i): i is HTMLButtonElement => i !== null),
        ),
      ),
    ),
  );
  return {
    element,
    isTitle: true,
    focus: () => element.querySelector<HTMLElement>('.td-menu__item')?.focus(),
  };
}

// —— a new deal ——

function choice<T extends string>(
  name: string,
  legend: string,
  options: { value: T; label: string; detail: string }[],
  current: T,
  change: (value: T) => void,
): HTMLElement {
  return h(
    'fieldset',
    { class: 'td-choice' },
    h('legend', { class: 'td-choice__legend' }, legend),
    ...options.map((option) =>
      h(
        'label',
        { class: 'td-choice__option' },
        h('input', {
          type: 'radio',
          name,
          value: option.value,
          checked: option.value === current,
          'data-testid': `td-${name}-${option.value}`,
          onchange: () => change(option.value),
        }),
        h('span', { class: 'td-choice__label' }, option.label),
        h('span', { class: 'td-choice__detail' }, option.detail),
      ),
    ),
  );
}

function toggle(
  label: string,
  detail: string,
  checked: boolean,
  change: (on: boolean) => void,
  testid: string,
): HTMLElement {
  return h(
    'label',
    { class: 'td-toggle' },
    h('input', {
      type: 'checkbox',
      checked,
      'data-testid': testid,
      onchange: (e: Event) => change((e.target as HTMLInputElement).checked),
    }),
    h('span', { class: 'td-toggle__label' }, label),
    h('span', { class: 'td-toggle__detail' }, detail),
  );
}

export interface DealActions {
  change(patch: Partial<Prefs>): void;
  deal(): void;
  back(): void;
}

export function dealScreen(prefs: Prefs, bank: BankBook, actions: DealActions): Screen {
  const element = page(
    'New deal',
    'td-deal',
    actions.back,
    h(
      'div',
      { class: 'td-page__body td-page__body--two' },
      choice<RuleSet>(
        'rules',
        'Rules',
        [
          {
            value: 'standard',
            label: 'Standard',
            detail:
              'Exactly as at Berkeley: whole piles move together, and four turn-overs in a row without a move end the deal.',
          },
          {
            value: 'relaxed',
            label: 'Relaxed',
            detail: 'Move any run of a pile, and go round the hand as often as you like, free.',
          },
        ],
        prefs.rules,
        (rules) => actions.change({ rules }),
      ),
      choice<Scoring>(
        'scoring',
        'Scoring',
        [
          {
            value: 'points',
            label: 'Points',
            detail:
              '+5 a card home and a bonus for the bloom; extra passes, Insight, undo and hints cost points.',
          },
          {
            value: 'bank',
            label: 'Bank',
            detail: `The original's account in play money: $13 to deal, $13 to inspect, $26 to play it out, $5 a card home. Your balance: ${money(bank.balance)}.`,
          },
        ],
        prefs.scoring,
        (scoring) => actions.change({ scoring }),
      ),
    ),
    toggle(
      'Winnable deals only',
      'Every deal is one the solver has proven can be won.',
      prefs.winnableOnly,
      (winnableOnly) => actions.change({ winnableOnly }),
      'td-winnable',
    ),
    h(
      'div',
      { class: 'td-page__actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'td-button td-button--primary td-button--large',
          'data-testid': 'td-deal-go',
          'aria-keyshortcuts': 'Enter',
          onclick: actions.deal,
        },
        'Deal',
        h('kbd', {}, 'Enter'),
      ),
    ),
  );
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !(event.target as HTMLElement).closest('button')) {
      event.preventDefault();
      actions.deal();
    }
  });
  return { element, focus: focusFirst(element) };
}

// —— the Daily Deal ——

export interface DailyModel {
  number: number;
  dateLabel: string;
  record: DailyRecord | undefined;
  played: number;
  won: number;
}

export function dailyScreen(
  model: DailyModel,
  actions: { play(): void; share(): void; back(): void },
): Screen {
  const record = model.record;
  const status = record
    ? record.won
      ? `In full bloom: all 52 home in ${formatTime(record.ms)}, ${record.insight} cards shown by Insight, ${record.score} points.`
      : `${record.cardsHome} cards home in ${formatTime(record.ms)}: ${record.score} points. Play it again if you like; your first finish is the one that counts.`
    : 'One deal for everyone today, Standard rules, scored in points. The solver has proven it can be won.';
  const element = page(
    `Daily Deal #${model.number}`,
    'td-daily',
    actions.back,
    h(
      'div',
      { class: 'td-page__body' },
      h('p', { class: 'td-page__kicker' }, model.dateLabel),
      h('p', { class: 'td-page__lead', 'data-testid': 'td-daily-status' }, status),
      h(
        'p',
        { class: 'td-page__note' },
        `Daily Deals played: ${model.played} · in full bloom: ${model.won}`,
      ),
    ),
    h(
      'div',
      { class: 'td-page__actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'td-button td-button--primary td-button--large',
          'data-testid': 'td-daily-play',
          'aria-keyshortcuts': 'P',
          onclick: actions.play,
        },
        record ? 'Play it again' : 'Play',
        h('kbd', {}, 'P'),
      ),
      record
        ? h(
            'button',
            {
              type: 'button',
              class: 'td-button td-button--large',
              'data-testid': 'td-daily-share',
              'aria-keyshortcuts': 'S',
              onclick: actions.share,
            },
            'Share the result',
            h('kbd', {}, 'S'),
          )
        : null,
    ),
  );
  return { element, focus: focusFirst(element) };
}

// —— challenges ——

export function challengesScreen(
  challenges: readonly Challenge[],
  records: Record<string, ChallengeRecord>,
  actions: { play(challenge: Challenge): void; back(): void },
): Screen {
  const sets = [...new Set(challenges.map((c) => c.set))];
  const element = page(
    'Challenges',
    'td-challenges',
    actions.back,
    h(
      'p',
      { class: 'td-page__note' },
      'Twenty-four hand-picked deals, each with a goal the solver has proven can be met.',
    ),
    ...sets.map((set) =>
      h(
        'section',
        { class: 'td-challenge-set', 'aria-label': set },
        h('h3', { class: 'td-challenge-set__title' }, set),
        h(
          'ol',
          { class: 'td-challenge-set__list' },
          ...challenges
            .filter((c) => c.set === set)
            .map((c) => {
              const done = records[c.id]?.done === true;
              return h(
                'li',
                {},
                h(
                  'button',
                  {
                    type: 'button',
                    class: `td-challenge${done ? ' is-done' : ''}`,
                    'data-testid': `td-challenge-${c.id}`,
                    onclick: () => actions.play(c),
                  },
                  h('span', { class: 'td-challenge__number' }, String(c.number)),
                  h('span', { class: 'td-challenge__title' }, c.title),
                  h(
                    'span',
                    { class: 'td-challenge__goal' },
                    `${goalText(c.conditions)}${c.rules === 'relaxed' ? ' Relaxed rules.' : ''} Base ${rankLabel(rankOf(c.deal[13]!))}.`,
                  ),
                  h(
                    'span',
                    { class: 'td-challenge__done', 'aria-label': done ? 'done' : 'not done yet' },
                    done ? '✓' : '',
                  ),
                ),
              );
            }),
        ),
      ),
    ),
  );
  return { element, focus: focusFirst(element) };
}

// —— how to play ——

const KEYS: [string, string][] = [
  ['Drag a card', 'Carry it; it snaps to a place it may go'],
  ['Click a card', 'Send it to its best place, home first'],
  ['Double-click', 'Send it home'],
  ['Click the hand, or D', 'Deal three (or turn the talon over)'],
  ['Arrow keys', 'Move the cursor between piles'],
  ['Enter', 'Pick cards up at the cursor, or put them down there'],
  ['Space', 'Send the cards at the cursor to their best place'],
  ['Z · H · C', 'Undo · Hint · Insight'],
  ['L', 'The account book (Bank)'],
  ['/', 'Type a move as in the original'],
  ['Esc', 'Pause'],
];

export function helpScreen(back: () => void, backLabel = '← Game menu'): Screen {
  const element = page(
    'How to play',
    'td-help',
    { run: back, label: backLabel },
    h(
      'div',
      { class: 'td-page__body td-help' },
      h('h3', {}, 'The layout'),
      h(
        'p',
        {},
        'The reserve holds thirteen cards, its top one face up. The first card turned to the foundations sets the base rank for all four; the other three bases go home by themselves when they show. Four piles start the tableau, and the other thirty-four cards make the hand.',
      ),
      h('h3', {}, 'Building'),
      h(
        'p',
        {},
        'Foundations build up in suit from the base, turning the corner from king to ace, until all thirteen of a suit are home. The tableau builds down in alternating colours, a king going on an ace. In Standard a pile moves only as a whole, onto a card its bottom card fits.',
      ),
      h(
        'p',
        {},
        'A space in the tableau takes the reserve’s top card, when you choose. Once the reserve is empty, the talon can fill spaces too. A pile never moves into a space.',
      ),
      h('h3', {}, 'The hand'),
      h(
        'p',
        {},
        'Deal three at a time to the talon; only the top card shows. When the hand is empty, the talon turns over to become the hand again, in the same order. In Standard, four turn-overs in a row without a card moving end the deal.',
      ),
      h('h3', {}, 'Insight, and the price of information'),
      h(
        'p',
        {},
        'Insight is the original’s card counter: it lists the cards you have already seen and where they now lie in the talon and the hand. It never shows a card you have not seen. Each card it lists costs a point (or $1) the first time; while it is on, so does every card that shows on the talon.',
      ),
      h('h3', {}, 'Scoring'),
      h(
        'table',
        { class: 'td-help__table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', {}, ''),
            h('th', { scope: 'col' }, 'Points'),
            h('th', { scope: 'col' }, 'Bank (play money)'),
          ),
        ),
        h(
          'tbody',
          {},
          ...[
            ['The deal', 'free', '$13'],
            ['Inspecting it', 'free', '$13'],
            ['Playing it out', 'free', '$26'],
            ['Each card home', '+5', '+$5, once the game is bought'],
            ['Each pass after the first', '−5 (Standard)', '$5 (Standard)'],
            ['Each card Insight lists', '−1', '$1, at most $34'],
            ['Undo · hint', '−2 · −5', '$2 · $5'],
            [
              'Time',
              'a bonus for a win: a point a 5 s under 15 min',
              '$1 a minute, at most $3 between two moves',
            ],
            ['A win', '+100', 'the cards home pay $260'],
          ].map(([what, points, bank]) =>
            h('tr', {}, h('th', { scope: 'row' }, what!), h('td', {}, points!), h('td', {}, bank!)),
          ),
        ),
      ),
      h(
        'p',
        { class: 'td-page__note' },
        'Bank money is play money: it cannot be bought, sold or spent, and resetting the account is free. The Daily Deal is always scored in points.',
      ),
      h('h3', {}, 'Keys and mouse'),
      h(
        'table',
        { class: 'td-help__table' },
        h(
          'tbody',
          {},
          ...KEYS.map(([key, what]) =>
            h('tr', {}, h('th', { scope: 'row' }, key), h('td', {}, what)),
          ),
        ),
      ),
      h('h3', {}, 'The original’s commands'),
      h(
        'p',
        {},
        'Press / and type: s1–s4 and sf move the reserve’s top card; t1–t4 and tf the talon’s; 12, 34 … move pile to pile; 1f–4f send a pile’s top card home; ht deals; c turns Insight on or off; b opens the account; q ends the deal.',
      ),
    ),
  );
  return { element, focus: focusFirst(element) };
}

// —— settings ——

export interface SettingsActions {
  change(patch: Partial<Prefs>): void;
  resetBank(): void;
  hallSettings(): void;
  forget(): void;
  back(): void;
}

export function settingsScreen(prefs: Prefs, bank: BankBook, actions: SettingsActions): Screen {
  const element = page(
    'Settings',
    'td-settings',
    actions.back,
    h(
      'div',
      { class: 'td-page__body td-page__body--two' },
      choice<Scoring>(
        'settings-scoring',
        'Scoring for new deals',
        [
          { value: 'points', label: 'Points', detail: 'The default.' },
          {
            value: 'bank',
            label: 'Bank',
            detail: 'Play money, the original’s account. A change applies from the next deal.',
          },
        ],
        prefs.scoring,
        (scoring) => actions.change({ scoring }),
      ),
      choice<RuleSet>(
        'settings-rules',
        'Rules for new deals',
        [
          { value: 'standard', label: 'Standard', detail: 'The original’s rules.' },
          { value: 'relaxed', label: 'Relaxed', detail: 'Any run moves; free, unlimited passes.' },
        ],
        prefs.rules,
        (rules) => actions.change({ rules }),
      ),
    ),
    h(
      'div',
      { class: 'td-page__body' },
      toggle(
        'Winnable deals only',
        'New deals are ones the solver has proven can be won.',
        prefs.winnableOnly,
        (winnableOnly) => actions.change({ winnableOnly }),
        'td-settings-winnable',
      ),
      toggle(
        'Four-colour suits',
        'Clubs green and diamonds amber; hearts stay red and spades dark.',
        prefs.fourColour,
        (fourColour) => actions.change({ fourColour }),
        'td-settings-four',
      ),
      toggle(
        'Sound',
        'The riffle, the chimes, the bloom.',
        prefs.sound,
        (sound) => actions.change({ sound }),
        'td-settings-sound',
      ),
    ),
    h(
      'div',
      { class: 'td-page__actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'td-button',
          'data-testid': 'td-reset-bank',
          onclick: actions.resetBank,
        },
        `Reset the account to ${money(BANK.openingBalance)} (now ${money(bank.balance)})`,
      ),
      h(
        'button',
        { type: 'button', class: 'td-button', onclick: actions.hallSettings },
        'Volume and appearance',
      ),
      h(
        'button',
        { type: 'button', class: 'td-button', onclick: actions.forget },
        'Forget my data for this game',
      ),
    ),
  );
  return { element, focus: focusFirst(element) };
}

// —— records and the account book ——

function recordRows(label: string, r: RulesRecord): HTMLElement {
  return h(
    'tr',
    {},
    h('th', { scope: 'row' }, label),
    h('td', {}, String(r.deals)),
    h('td', {}, String(r.wins)),
    h('td', {}, r.bestScore ? String(r.bestScore) : '—'),
    h('td', {}, r.bestMs ? formatTime(r.bestMs) : '—'),
    h('td', {}, `${r.run} · best ${r.bestRun}`),
    h('td', {}, String(r.cardsHome)),
  );
}

const STATEMENT_LABELS: Record<(typeof STATEMENT_ROWS)[number], string> = {
  deals: 'Deals',
  inspections: 'Inspections',
  games: 'Games played out',
  runs: 'Extra passes',
  information: 'Insight',
  thinkTime: 'Thinking time',
  undo: 'Undo',
  hints: 'Hints',
};

function accountCard(lifetime: Statement, bank: BankBook): HTMLElement {
  const net = netOf(lifetime);
  return h(
    'section',
    { class: 'td-account', 'aria-label': 'The account book', 'data-testid': 'td-account' },
    h('h3', { class: 'td-account__title' }, net >= 0 ? 'Winnings to date' : 'Losses to date'),
    h(
      'table',
      { class: 'td-account__table' },
      h(
        'tbody',
        {},
        ...STATEMENT_ROWS.map((row) =>
          h(
            'tr',
            {},
            h('th', { scope: 'row' }, STATEMENT_LABELS[row]),
            h('td', {}, money(lifetime[row])),
          ),
        ),
        h(
          'tr',
          { class: 'is-total' },
          h('th', { scope: 'row' }, 'Costs'),
          h('td', {}, money(costsOf(lifetime))),
        ),
        h(
          'tr',
          { class: 'is-total' },
          h('th', { scope: 'row' }, 'Winnings'),
          h('td', {}, money(lifetime.winnings)),
        ),
        h('tr', { class: 'is-total' }, h('th', { scope: 'row' }, 'Net'), h('td', {}, money(net))),
      ),
    ),
    h(
      'p',
      { class: 'td-account__balance' },
      `${bank.deals} Bank deals · balance ${money(bank.balance)} of play money`,
    ),
  );
}

export function recordsScreen(records: Records, bank: BankBook, back: () => void): Screen {
  const element = page(
    'Records',
    'td-records',
    back,
    h(
      'div',
      { class: 'td-page__body' },
      h(
        'table',
        { class: 'td-records__table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', {}, ''),
            ...['Deals', 'Wins', 'Best score', 'Fastest win', 'Wins in a row', 'Cards home'].map(
              (t) => h('th', { scope: 'col' }, t),
            ),
          ),
        ),
        h(
          'tbody',
          {},
          recordRows('Standard', records.standard),
          recordRows('Relaxed', records.relaxed),
        ),
      ),
      h(
        'p',
        { class: 'td-page__note' },
        `Daily Deals played to the end: ${records.dailies}, in full bloom: ${records.dailyWins}.`,
      ),
      accountCard(bank.lifetime, bank),
    ),
  );
  return { element, focus: focusFirst(element) };
}
