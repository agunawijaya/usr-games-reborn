import { type CardId, cardName, CardSprites, sizeForHeight } from '@usr-games/kit/cards';
import { LEVELS, type Level } from '../engine/ai/minds';
import type { CountingMode, GameLength } from '../engine/match';
import { type AlbumEntry, perfectHand } from '../modes/album';
import type { Look } from '../render/look';
import { h } from '../ui/dom';
import type { DailyDay, Pace, Prefs, Records } from './saves';

/**
 * The screens around the table: the game menu and the pages it opens. Each is a plain element
 * with its buttons wired to the actions the app gives it. Letters press buttons (N for a new
 * game and so on); Escape on a page returns to the game menu, and on the game menu the Hall
 * takes it back to the Hall.
 */

export interface Screen {
  element: HTMLElement;
  /** The game menu: the Hall shows only "Back to the Hall" there, and Escape leaves. */
  isTitle?: boolean;
  focus(): void;
}

export const LEVEL_NAMES: Readonly<Record<Level, string>> = {
  beginner: 'Beginner',
  classic: 'Classic',
  sharp: 'Sharp',
};

const LEVEL_BLURBS: Readonly<Record<Level, string>> = {
  beginner: 'Plays by feel: keeps a pretty hand, takes points when it sees them.',
  classic: 'The Berkeley program’s own player from 1980, card for card.',
  sharp: 'Weighs every starter for each throw and looks ahead to the end of the play.',
};

export const COUNTING_NAMES: Readonly<Record<CountingMode, string>> = {
  automatic: 'Automatic',
  yourself: 'Count yourself',
  'classic-1980': 'Classic 1980',
};

const COUNTING_BLURBS: Readonly<Record<CountingMode, string>> = {
  automatic: 'Every combination lights up and is counted for you.',
  yourself: 'You type your total first; then the table counts it with you. No penalty.',
  'classic-1980':
    'The original’s rule: claim too much and the computer pegs 2; claim too little and the rest is lost. 19 means nothing.',
};

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
      class: `ft-menu-item${primary ? ' is-primary' : ''}`,
      'data-testid': testid,
      'aria-keyshortcuts': key,
      onclick: run,
    },
    h('span', { class: 'ft-menu-label' }, label),
    h('span', { class: 'ft-menu-detail' }, detail),
    h('kbd', { class: 'ft-menu-key' }, key),
  );
}

/** Letters on a page press its buttons; Escape on a page goes back to the game menu. */
function withKeys(element: HTMLElement, back?: () => void): HTMLElement {
  element.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if (event.key === 'Escape' && back) {
      // Handled here, before the Hall's pause menu hears it on the window.
      event.preventDefault();
      event.stopPropagation();
      back();
      return;
    }
    if ((event.target as HTMLElement).closest('input, select, textarea')) return;
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    const target = element.querySelector<HTMLButtonElement>(
      `button[aria-keyshortcuts="${CSS.escape(key)}"]`,
    );
    if (target && !target.disabled) {
      event.preventDefault();
      target.click();
    }
  });
  return element;
}

function page(
  title: string,
  testid: string,
  back: () => void,
  ...body: (HTMLElement | null)[]
): Screen {
  const heading = h('h2', { class: 'ft-page-title', id: `${testid}-title`, tabindex: '-1' }, title);
  const element = withKeys(
    h(
      'section',
      {
        class: 'ft-page ft-sheet-panel',
        'aria-labelledby': `${testid}-title`,
        'data-testid': testid,
      },
      h(
        'header',
        { class: 'ft-page-head' },
        heading,
        h(
          'button',
          {
            type: 'button',
            class: 'ft-button ft-button--quiet',
            onclick: back,
            'data-testid': `${testid}-back`,
          },
          '← Game menu',
          h('kbd', { class: 'ft-key' }, 'Esc'),
        ),
      ),
      h('div', { class: 'ft-page-body' }, ...body),
    ),
    back,
  );
  return { element, focus: () => heading.focus() };
}

// —— the game menu ——

export interface TitleModel {
  continueLine: string | null;
  newGameLine: string;
  trainerLine: string;
  dailyNumber: number;
  dailyLine: string;
  albumLine: string;
}

export interface TitleActions {
  continueGame(): void;
  newGame(): void;
  trainer(): void;
  daily(): void;
  album(): void;
  help(): void;
  settings(): void;
}

export function titleScreen(model: TitleModel, actions: TitleActions): Screen {
  const items: HTMLButtonElement[] = [];
  if (model.continueLine) {
    items.push(
      menuItem('Continue', model.continueLine, 'C', actions.continueGame, 'ft-menu-continue', true),
    );
  }
  items.push(
    menuItem(
      'New game',
      model.newGameLine,
      'N',
      actions.newGame,
      'ft-menu-new',
      !model.continueLine,
    ),
    menuItem('Counting trainer', model.trainerLine, 'T', actions.trainer, 'ft-menu-trainer'),
    menuItem(
      `Daily Discard #${model.dailyNumber}`,
      model.dailyLine,
      'D',
      actions.daily,
      'ft-menu-daily',
    ),
    menuItem('Hand records', model.albumLine, 'A', actions.album, 'ft-menu-album'),
    menuItem(
      'How to play',
      'The deal, the play to 31, the show, and the keys',
      '?',
      actions.help,
      'ft-menu-help',
    ),
    menuItem(
      'Settings',
      'Counting, the coach and the pace',
      'S',
      actions.settings,
      'ft-menu-settings',
    ),
  );
  const element = withKeys(
    h(
      'section',
      {
        class: 'ft-title ft-sheet-panel',
        'aria-labelledby': 'ft-title-heading',
        'data-testid': 'ft-title',
      },
      h('p', { class: 'ft-title-kicker' }, 'Cribbage, from the Berkeley games'),
      h('h1', { class: 'ft-title-heading', id: 'ft-title-heading' }, 'Fifteen-Two'),
      h('p', { class: 'ft-title-tagline' }, 'Fifteen-two, fifteen-four… see every point.'),
      h('nav', { class: 'ft-menu', 'aria-label': 'Game menu' }, ...items),
    ),
  );
  return { element, isTitle: true, focus: () => items[0]!.focus() };
}

// —— a new game ——

function choice(
  name: string,
  value: string,
  label: string,
  detail: string,
  checked: boolean,
  onchange: () => void,
): HTMLLabelElement {
  return h(
    'label',
    { class: 'ft-choice' },
    h('input', {
      type: 'radio',
      name,
      value,
      checked,
      onchange,
      'data-testid': `ft-choice-${name}-${value}`,
    }),
    h('span', { class: 'ft-choice-text' }, h('strong', {}, label), h('span', {}, detail)),
  );
}

function group(legend: string, ...choices: HTMLElement[]): HTMLFieldSetElement {
  return h('fieldset', { class: 'ft-group' }, h('legend', {}, legend), ...choices);
}

function toggle(
  label: string,
  detail: string,
  checked: boolean,
  onchange: (on: boolean) => void,
  testid: string,
) {
  const input = h('input', { type: 'checkbox', checked, 'data-testid': testid });
  input.addEventListener('change', () => onchange(input.checked));
  return h(
    'label',
    { class: 'ft-toggle' },
    input,
    h('span', { class: 'ft-choice-text' }, h('strong', {}, label), h('span', {}, detail)),
  );
}

export interface NewGameActions {
  change(patch: Partial<Prefs>): void;
  start(): void;
  back(): void;
}

export function newGameScreen(prefs: Prefs, records: Records, actions: NewGameActions): Screen {
  const record = (level: Level) => {
    const r = records.byLevel[level];
    return r.games > 0 ? ` You have won ${r.wins} of ${r.games}.` : '';
  };
  const start = h(
    'button',
    {
      type: 'button',
      class: 'ft-button',
      onclick: actions.start,
      'aria-keyshortcuts': 'Enter',
      'data-testid': 'ft-start',
    },
    'Deal the cards',
    h('kbd', { class: 'ft-key' }, 'Enter'),
  );
  const screen = page(
    'A new game',
    'ft-new',
    actions.back,
    h(
      'div',
      { class: 'ft-columns' },
      group(
        'Your opponent',
        ...LEVELS.map((level) =>
          choice(
            'level',
            level,
            LEVEL_NAMES[level],
            LEVEL_BLURBS[level] + record(level),
            prefs.level === level,
            () => actions.change({ level }),
          ),
        ),
      ),
      h(
        'div',
        {},
        group(
          'How long',
          ...([61, 121] as GameLength[]).map((length) =>
            choice(
              'length',
              String(length),
              length === 61 ? 'Short: to 61' : 'Long: to 121',
              length === 61
                ? 'Once around the board, ten minutes or so.'
                : 'Twice around, the usual game.',
              prefs.length === length,
              () => actions.change({ length }),
            ),
          ),
        ),
        group(
          'Counting your hands',
          ...(['automatic', 'yourself', 'classic-1980'] as CountingMode[]).map((counting) =>
            choice(
              'counting',
              counting,
              COUNTING_NAMES[counting],
              COUNTING_BLURBS[counting],
              prefs.counting === counting,
              () => actions.change({ counting }),
            ),
          ),
        ),
        toggle(
          'Coach',
          'Hints for the throw and the play.',
          prefs.coach,
          (coach) => actions.change({ coach }),
          'ft-coach-toggle',
        ),
      ),
    ),
    h('div', { class: 'ft-page-actions' }, start),
  );
  screen.element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !(event.target as HTMLElement).closest('button, input')) {
      event.preventDefault();
      actions.start();
    }
  });
  return screen;
}

// —— settings ——

export interface SettingsActions {
  change(patch: Partial<Prefs>): void;
  hallSettings(): void;
  forget(): void;
  back(): void;
}

export function settingsScreen(prefs: Prefs, actions: SettingsActions): Screen {
  return page(
    'Settings',
    'ft-settings',
    actions.back,
    h(
      'div',
      { class: 'ft-columns' },
      group(
        'Counting your hands',
        ...(['automatic', 'yourself', 'classic-1980'] as CountingMode[]).map((counting) =>
          choice(
            'counting',
            counting,
            COUNTING_NAMES[counting],
            COUNTING_BLURBS[counting],
            prefs.counting === counting,
            () => actions.change({ counting }),
          ),
        ),
      ),
      h(
        'div',
        {},
        group(
          'Pace',
          ...(['relaxed', 'brisk'] as Pace[]).map((pace) =>
            choice(
              'pace',
              pace,
              pace === 'relaxed' ? 'Relaxed' : 'Brisk',
              pace === 'relaxed'
                ? 'Time to watch every card and peg.'
                : 'Cards and pegs move along smartly.',
              prefs.pace === pace,
              () => actions.change({ pace }),
            ),
          ),
        ),
        toggle(
          'Coach',
          'Hints for the throw and the play in a game (never in the Daily).',
          prefs.coach,
          (coach) => actions.change({ coach }),
          'ft-settings-coach',
        ),
        h(
          'div',
          { class: 'ft-page-actions ft-page-actions--start' },
          h(
            'button',
            { type: 'button', class: 'ft-button ft-button--quiet', onclick: actions.hallSettings },
            'Sound and motion…',
          ),
          h(
            'button',
            { type: 'button', class: 'ft-button ft-button--quiet', onclick: actions.forget },
            'Forget this game’s data…',
          ),
        ),
      ),
    ),
  );
}

// —— how to play ——

export function helpScreen(back: () => void): Screen {
  const section = (title: string, ...paragraphs: (string | HTMLElement)[]) =>
    h(
      'section',
      { class: 'ft-help-section' },
      h('h3', {}, title),
      ...paragraphs.map((p) => (typeof p === 'string' ? h('p', {}, p) : p)),
    );
  const keys: [string, string][] = [
    ['← →', 'Move between your cards'],
    ['Space', 'Pick a card for the crib, or put it back'],
    ['Enter', 'Lay the card; throw two to the crib once both are chosen'],
    ['T', 'Throw the two chosen cards to the crib'],
    ['0–9, Enter', 'Type your count and count it'],
    ['Space, Enter', 'While a hand is counted: speed it up'],
    ['C', 'Coach on or off'],
    ['Esc', 'Pause'],
  ];
  return page(
    'How to play',
    'ft-help',
    back,
    h(
      'div',
      { class: 'ft-help' },
      section(
        'The aim',
        'Be first round the board: 121 holes in a long game, 61 in a short one. Points come in three ways: in the play, in the show, and from the crib.',
      ),
      section(
        'The deal and the crib',
        'Each player gets six cards and lays away two of them face down. The four make the crib, an extra hand that belongs to the dealer. When it is your crib, throw cards that go well together; when it is theirs, throw cards that do not.',
      ),
      section(
        'The starter',
        'The non-dealer cuts and the dealer turns up the top card: the starter. It belongs to every hand at the show. If it is a jack, the dealer pegs 2 for his heels.',
      ),
      section(
        'The play to 31',
        'Lay cards in turn, calling the running total; courts count 10, aces 1. Score 2 for making 15 or exactly 31; 2 for a pair with the card before, 6 for three of a kind in a row, 12 for four; and a point a card for a run of three or more among the last cards laid, in any order. If you cannot lay a card without passing 31 you say go; your opponent plays on while they can, then pegs 1 (2 if they make 31). The count starts again from zero. The last card of all scores 1.',
      ),
      section(
        'The show',
        'Hands are counted with the starter, the non-dealer first, then the dealer, then the crib: 2 for every combination that makes 15, 2 for every pair, 1 a card for every run of three or more, 4 for four cards of one suit in the hand (5 with the starter; the crib needs all five), and 1 for his nobs, the jack of the starter’s suit. The best hand of all is 29; no hand can make 19, which is why old players call a hand of nothing "nineteen".',
      ),
      section(
        'Counting modes',
        'Automatic counts for you, lighting up each combination. Count yourself asks for your total first and then shows the true one. Classic 1980 is the original program’s way: claim too much and you get the true count while your opponent pegs 2; claim too little and the rest is lost.',
      ),
      section(
        'Skunks',
        'A win while the loser is still more than 30 holes short of the end is a skunk; in a long game, more than 60 short is a double skunk.',
      ),
      section(
        'Keys',
        h(
          'table',
          { class: 'ft-keys-table' },
          h(
            'tbody',
            {},
            ...keys.map(([key, what]) =>
              h('tr', {}, h('th', { scope: 'row' }, h('kbd', {}, key)), h('td', {}, what)),
            ),
          ),
        ),
      ),
    ),
  );
}

// —— hand records ——

/** A row of small cards drawn with the table's deck, read aloud as their names. */
export function cardRow(
  cards: readonly CardId[],
  starter: CardId | null,
  look: Look,
  height = 74,
): HTMLCanvasElement {
  const { width, height: cardHeight } = sizeForHeight(height);
  const scale = window.devicePixelRatio || 1;
  const sprites = new CardSprites({
    width,
    height: cardHeight,
    scale,
    look: look.deck,
    fourColour: false,
    back: look.back,
  });
  const gap = Math.round(width * 0.12);
  const starterGap = starter === null ? 0 : Math.round(width * 0.35);
  const total = cards.length + (starter === null ? 0 : 1);
  const canvas = h('canvas', {
    class: 'ft-card-row',
    role: 'img',
    'aria-label': [...cards, ...(starter === null ? [] : [starter])].map(cardName).join(', '),
  });
  const cssWidth = total * width + (total - 1) * gap + starterGap;
  canvas.width = Math.ceil(cssWidth * scale);
  canvas.height = Math.ceil(cardHeight * scale);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cardHeight}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  [...cards, ...(starter === null ? [] : [starter])].forEach((card, i) => {
    const x = i * (width + gap) + (i === cards.length ? starterGap : 0);
    ctx.drawImage(sprites.face(card) as CanvasImageSource, x, 0, width, cardHeight);
  });
  return canvas;
}

export function albumScreen(album: readonly AlbumEntry[], look: Look, back: () => void): Screen {
  const perfect = perfectHand(album);
  const slot = h(
    'section',
    { class: `ft-perfect-slot${perfect ? ' is-filled' : ''}`, 'data-testid': 'ft-perfect-slot' },
    h('h3', {}, 'The perfect hand'),
    perfect
      ? h(
          'div',
          { class: 'ft-album-cards' },
          cardRow(perfect.hand, perfect.starter, look, 64),
          h('span', { class: 'ft-album-total' }, '29'),
        )
      : h(
          'p',
          {},
          'Three fives and the jack, with the last five cut to match. About one deal in 216,580. This slot is waiting for it.',
        ),
  );
  const rows = album
    .filter((entry) => entry.total < 29 || entry !== perfect)
    .map((entry, i) =>
      h(
        'li',
        { class: `ft-album-row${entry.total >= 20 ? ' is-big' : ''}` },
        h('span', { class: 'ft-album-place' }, String(i + 1)),
        cardRow(entry.hand, entry.starter, look, 56),
        h(
          'span',
          { class: 'ft-album-meta' },
          h('strong', {}, `${entry.total} points`),
          h(
            'span',
            {},
            `${entry.isCrib ? 'Crib' : 'Hand'} · ${entry.date} · against ${LEVEL_NAMES[entry.opponent] ?? 'the table'}`,
          ),
        ),
      ),
    );
  return page(
    'Hand records',
    'ft-album',
    back,
    slot,
    rows.length > 0
      ? h('ol', { class: 'ft-album-list' }, ...rows)
      : h('p', { class: 'ft-empty' }, 'Your best hands and cribs will gather here as you play.'),
  );
}

// —— the Daily Discard ——

export interface DailyModel {
  number: number;
  dateLabel: string;
  today: DailyDay | undefined;
  days: number;
}

export function dailyScreen(
  model: DailyModel,
  actions: { play(): void; share(): void; back(): void },
): Screen {
  const body = model.today
    ? [
        h(
          'p',
          { class: 'ft-daily-done' },
          `You have laid away today: ${model.today.percent}% of the best${model.today.place === 1 ? ', the best throw there is' : ''}.`,
        ),
        h(
          'div',
          { class: 'ft-page-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'ft-button',
              onclick: actions.play,
              'aria-keyshortcuts': 'P',
              'data-testid': 'ft-daily-review',
            },
            'See the cards again',
            h('kbd', { class: 'ft-key' }, 'P'),
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'ft-button ft-button--quiet',
              onclick: actions.share,
              'aria-keyshortcuts': 'S',
              'data-testid': 'ft-daily-share',
            },
            'Share',
            h('kbd', { class: 'ft-key' }, 'S'),
          ),
        ),
      ]
    : [
        h(
          'p',
          {},
          'The same six cards for everyone today. Choose the two to lay away, and see how your choice stands against all fifteen, averaged over every card that could be cut.',
        ),
        h(
          'div',
          { class: 'ft-page-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'ft-button',
              onclick: actions.play,
              'aria-keyshortcuts': 'P',
              'data-testid': 'ft-daily-play',
            },
            'See today’s cards',
            h('kbd', { class: 'ft-key' }, 'P'),
          ),
        ),
      ];
  return page(
    `Daily Discard #${model.number}`,
    'ft-daily',
    actions.back,
    h('p', { class: 'ft-page-kicker' }, model.dateLabel),
    ...body,
    h(
      'p',
      { class: 'ft-page-note' },
      model.days > 0
        ? `Days laid away: ${model.days}.`
        : 'No coach in the Daily: it is just you and the cards.',
    ),
  );
}

// —— the counting trainer ——

export function trainerScreen(
  records: Records,
  actions: { sprint(): void; relaxed(): void; back(): void },
): Screen {
  return page(
    'Counting trainer',
    'ft-trainer',
    actions.back,
    h(
      'p',
      {},
      'Hands to count, one after another: type the total, and every combination lights up to show how it adds up. A hand of nothing can be called nineteen, as the old players do.',
    ),
    h(
      'nav',
      { class: 'ft-menu ft-menu--compact', 'aria-label': 'Trainer' },
      menuItem(
        'Two-minute sprint',
        records.bestSprint > 0
          ? `Your best: ${records.bestSprint} right`
          : 'As many as you can count right in two minutes',
        'P',
        actions.sprint,
        'ft-trainer-sprint',
        true,
      ),
      menuItem(
        'Ten hands, no clock',
        'Take your time with each one',
        'R',
        actions.relaxed,
        'ft-trainer-relaxed',
      ),
    ),
    h('p', { class: 'ft-page-note' }, `Hands counted right so far: ${records.trainerRight}.`),
  );
}
