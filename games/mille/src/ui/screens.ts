import type { Level } from '../ai/players';
import type { Length } from '../engine/match';
import type { DailyRecord } from '../modes/daily';
import { type Journal, STOPS, openRoutes } from '../modes/journal';
import { ROUTES, type RouteId } from '../render/routes';
import { formatPoints, h } from './dom';

/**
 * The pages around the table: the game menu, the set-up for a game, the Daily Road, the travel
 * journal and how to play. Each is plain markup over the living backdrop.
 */

export interface Screen {
  element: HTMLElement;
  isTitle: boolean;
  focus(): void;
}

function page(className: string, isTitle: boolean, ...children: (Node | null)[]): Screen {
  const element = h('section', { class: `dt-page ${className}` }, ...children);
  return {
    element,
    isTitle,
    focus: () => element.querySelector<HTMLElement>('[data-autofocus], button')?.focus(),
  };
}

function menuButton(
  title: string,
  detail: string,
  run: () => void,
  attrs: Record<string, string> = {},
): HTMLButtonElement {
  return h(
    'button',
    { class: 'dt-menu__item', type: 'button', onclick: run, ...attrs },
    h('span', { class: 'dt-menu__title' }, title),
    h('span', { class: 'dt-menu__detail' }, detail),
  ) as HTMLButtonElement;
}

function back(run: () => void, label = '← Game menu'): HTMLButtonElement {
  return h(
    'button',
    { class: 'dt-button dt-back', type: 'button', onclick: run },
    label,
  ) as HTMLButtonElement;
}

// —— the game menu ——

export interface TitleFacts {
  continueLine: string | null;
  dailyNumber: number;
  dailyLine: string;
  journalLine: string;
  recordLine: string;
}

export interface TitleActions {
  resume(): void;
  quick(): void;
  game(): void;
  teams(): void;
  daily(): void;
  journal(): void;
  help(): void;
  options(): void;
}

export function titleScreen(facts: TitleFacts, act: TitleActions): Screen {
  const items = [
    facts.continueLine
      ? menuButton('Continue', facts.continueLine, act.resume, { 'data-autofocus': '' })
      : null,
    menuButton(
      'Quick hand',
      'One hand to 700 against the computer: about five minutes',
      act.quick,
      facts.continueLine ? {} : { 'data-autofocus': '' },
    ),
    menuButton('Full game', 'Hand after hand to 5000, or 2500 for a shorter run', act.game),
    menuButton('Teams', 'You and a partner against two rivals, to 1000 a hand', act.teams),
    menuButton(`Daily Road #${facts.dailyNumber}`, facts.dailyLine, act.daily),
    menuButton('Travel journal', facts.journalLine, act.journal),
  ].filter((b): b is HTMLButtonElement => b !== null);
  return page(
    'dt-title',
    true,
    h(
      'div',
      { class: 'dt-title__card' },
      h('h1', { class: 'dt-title__name' }, 'Detour'),
      h('p', { class: 'dt-title__tag' }, 'Race to 700 miles. Block. Repair. Counter.'),
      h('nav', { class: 'dt-menu', 'aria-label': 'Game menu' }, ...items),
      h(
        'div',
        { class: 'dt-title__small' },
        h('button', { class: 'dt-link', type: 'button', onclick: act.help }, 'How to play'),
        h('button', { class: 'dt-link', type: 'button', onclick: act.options }, 'Options'),
      ),
      h('p', { class: 'dt-title__record' }, facts.recordLine),
    ),
  );
}

// —— setting up a game ——

export interface SetupChoices {
  rival: Level;
  length: Length;
  helper: boolean;
}

export interface SetupOptions {
  title: string;
  lead: string;
  lengths: readonly Length[];
  choices: SetupChoices;
}

const RIVALS: { level: Level; name: string; line: string }[] = [
  {
    level: 'rookie',
    name: 'Rookie',
    line: 'Plays whatever will go down. Good company while you learn.',
  },
  {
    level: 'classic',
    name: 'Classic',
    line: 'The Berkeley program of 1982, move for move: it never throws a safety away.',
  },
  {
    level: 'sly',
    name: 'Sly',
    line: 'Classic with a second look: it plays the hand out in its head before it commits.',
  },
];

const LENGTHS: Record<Length, { name: string; line: string }> = {
  single: { name: 'One hand', line: 'About five minutes' },
  short: { name: 'To 2500', line: 'Two or three hands' },
  full: { name: 'To 5000', line: 'The original length, four or five hands' },
};

function choiceGroup<T extends string>(
  legend: string,
  name: string,
  options: { value: T; title: string; line: string }[],
  current: T,
  change: (value: T) => void,
): HTMLFieldSetElement {
  return h(
    'fieldset',
    { class: 'dt-choices' },
    h('legend', { class: 'dt-choices__legend' }, legend),
    ...options.map((option) => {
      const input = h('input', {
        type: 'radio',
        name,
        value: option.value,
        class: 'dt-choice__input',
      }) as HTMLInputElement;
      input.checked = option.value === current;
      input.addEventListener('change', () => input.checked && change(option.value));
      return h(
        'label',
        { class: 'dt-choice' },
        input,
        h('span', { class: 'dt-choice__title' }, option.title),
        h('span', { class: 'dt-choice__line' }, option.line),
      );
    }),
  ) as HTMLFieldSetElement;
}

export function setupScreen(
  options: SetupOptions,
  act: { start(choices: SetupChoices): void; back(): void },
): Screen {
  const choices = { ...options.choices };
  const helper = h('input', { type: 'checkbox', class: 'dt-switch__input' }) as HTMLInputElement;
  helper.checked = choices.helper;
  helper.addEventListener('change', () => (choices.helper = helper.checked));
  const start = h(
    'button',
    { class: 'dt-button dt-button--primary dt-start', type: 'button', 'data-autofocus': '' },
    'Start',
    h('kbd', {}, 'Enter'),
  ) as HTMLButtonElement;
  start.addEventListener('click', () => act.start(choices));
  const form = h(
    'div',
    { class: 'dt-panel dt-setup' },
    h('h1', { class: 'dt-panel__title' }, options.title),
    h('p', { class: 'dt-panel__lead' }, options.lead),
    choiceGroup(
      'Your rival',
      'rival',
      RIVALS.map((r) => ({ value: r.level, title: r.name, line: r.line })),
      choices.rival,
      (v) => (choices.rival = v),
    ),
    options.lengths.length > 1
      ? choiceGroup(
          'How long',
          'length',
          options.lengths.map((l) => ({ value: l, title: LENGTHS[l].name, line: LENGTHS[l].line })),
          choices.length,
          (v) => (choices.length = v),
        )
      : null,
    h(
      'label',
      { class: 'dt-switch' },
      helper,
      h(
        'span',
        { class: 'dt-switch__text' },
        'Helper: grey out what cannot be played, say why, and explain the score',
      ),
    ),
    h('div', { class: 'dt-panel__buttons' }, start, back(act.back)),
  );
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      act.start(choices);
    }
  });
  return page('dt-setup-page', false, form);
}

// —— the Daily Road ——

export interface DailyFacts {
  number: number;
  dateLabel: string;
  route: RouteId;
  record: DailyRecord | undefined;
  played: number;
}

export function dailyScreen(
  facts: DailyFacts,
  act: { play(): void; share(): void; back(): void },
): Screen {
  const record = facts.record;
  const route = ROUTES[facts.route];
  return page(
    'dt-daily-page',
    false,
    h(
      'div',
      { class: 'dt-panel dt-daily' },
      h('p', { class: 'dt-panel__kicker' }, facts.dateLabel),
      h('h1', { class: 'dt-panel__title' }, `Daily Road #${facts.number}`),
      h(
        'p',
        { class: 'dt-panel__lead' },
        `Today's hand runs along the ${route.name}: one hand to 700 against Classic, from the same shuffled deck for everyone.`,
      ),
      record
        ? h(
            'div',
            { class: 'dt-daily__record' },
            h('p', {}, record.won ? 'You won today’s road.' : 'You drove today’s road.'),
            h(
              'dl',
              { class: 'dt-stats' },
              h('div', {}, h('dt', {}, 'Score'), h('dd', {}, formatPoints(record.score))),
              h('div', {}, h('dt', {}, 'Miles'), h('dd', {}, String(record.miles))),
              h('div', {}, h('dt', {}, 'Coups fourrés'), h('dd', {}, String(record.coups))),
            ),
          )
        : null,
      h(
        'div',
        { class: 'dt-panel__buttons' },
        h(
          'button',
          {
            class: 'dt-button dt-button--primary',
            type: 'button',
            'data-autofocus': '',
            onclick: act.play,
          },
          record ? 'Drive it again' : 'Drive today’s road',
        ),
        record
          ? h('button', { class: 'dt-button', type: 'button', onclick: act.share }, 'Share')
          : null,
        back(act.back),
      ),
      record
        ? h('p', { class: 'dt-panel__note' }, 'Your first drive of the day is the one that counts.')
        : null,
    ),
  );
}

// —— the travel journal ——

export function journalScreen(
  journal: Journal,
  act: { back(): void },
  paintMap: (canvas: HTMLCanvasElement) => void,
): Screen {
  const open = openRoutes(journal);
  const map = h('canvas', {
    class: 'dt-journal__map',
    role: 'img',
    'aria-label': 'Map of the routes',
  }) as HTMLCanvasElement;
  const entries = STOPS.map((stop) => {
    const route = ROUTES[stop.id];
    const isOpen = open.includes(stop.id);
    const stamps = journal.stamps[stop.id] ?? 0;
    return h(
      'li',
      { class: `dt-stop${isOpen ? '' : ' is-locked'}` },
      h('span', { class: 'dt-stop__name' }, route.name),
      h(
        'span',
        { class: 'dt-stop__line' },
        isOpen
          ? journal.stickers.includes(stop.id)
            ? `Sticker: ${stop.sticker} · ${stamps} stamp${stamps === 1 ? '' : 's'}`
            : journal.driven.includes(stop.id)
              ? 'Win a hand here for its sticker'
              : 'Open: it comes up in your next games'
          : `Opens after ${stop.opensAfter} hands won (${journal.handsWon} so far)`,
      ),
    );
  });
  const screen = page(
    'dt-journal-page',
    false,
    h(
      'div',
      { class: 'dt-panel dt-journal' },
      h('h1', { class: 'dt-panel__title' }, 'Travel journal'),
      h(
        'p',
        { class: 'dt-panel__lead' },
        'Every hand runs along one of these roads. Win hands to open new ones; the first win on a road earns its sticker, and every win stamps the passport.',
      ),
      h('div', { class: 'dt-journal__body' }, map, h('ul', { class: 'dt-stops' }, ...entries)),
      h('div', { class: 'dt-panel__buttons' }, back(act.back)),
    ),
  );
  requestAnimationFrame(() => paintMap(map));
  return screen;
}

// —— how to play ——

export function helpScreen(act: { back(): void }, backLabel = '← Game menu'): Screen {
  const section = (title: string, ...lines: string[]) =>
    h(
      'section',
      { class: 'dt-help__section' },
      h('h2', {}, title),
      ...lines.map((line) => h('p', {}, line)),
    );
  return page(
    'dt-help-page',
    false,
    h(
      'div',
      { class: 'dt-panel dt-help' },
      h('h1', { class: 'dt-panel__title' }, 'How to play'),
      section(
        'The race',
        'Each hand is a race to exactly 700 miles. On your turn you draw a card, then play one or throw one away. Lay miles to move; throw hazards at your rival to stop them; fix your own trouble with remedies.',
      ),
      section(
        'Rolling',
        'You need a green light before you can lay miles. A hazard (out of fuel, a flat, a fender bender, a red light) stops you until you lay its remedy and then a green light. A slow zone lets only 25s and 50s through until an open road.',
      ),
      section(
        'Safeties',
        'There is one of each safety. Laid, it keeps you safe from its hazard for the rest of the hand, scores 100 and gives you another turn. Lay it the moment its hazard hits you, before you draw, and it is a coup fourré: 300 more, the hazard bounced back, and the turn is yours.',
      ),
      section(
        'Scoring',
        'Every mile scores a point, every safety 100, all four 300 more, every coup fourré 300. The side that completes the trip adds 400, 300 more for a safe trip without 200s, 300 for finishing after the deck runs out, 200 for an extension to 1000, and 500 for a shut-out when the rival has not moved.',
      ),
      section(
        'Keys',
        'Pick a card with 1–6, or P for the card you just drew; U uses it, D throws it away. Arrow keys move between cards. At a coup fourré, C lays the safety and P lets the moment pass. Esc pauses.',
      ),
      h('div', { class: 'dt-panel__buttons' }, back(act.back, backLabel)),
    ),
  );
}

// —— options ——

export function optionsScreen(
  prefs: { helper: boolean; sound: boolean },
  act: {
    change(patch: Partial<{ helper: boolean; sound: boolean }>): void;
    hallSettings(): void;
    forget(): void;
    back(): void;
  },
): Screen {
  const toggle = (label: string, value: boolean, change: (on: boolean) => void) => {
    const input = h('input', { type: 'checkbox', class: 'dt-switch__input' }) as HTMLInputElement;
    input.checked = value;
    input.addEventListener('change', () => change(input.checked));
    return h(
      'label',
      { class: 'dt-switch' },
      input,
      h('span', { class: 'dt-switch__text' }, label),
    );
  };
  return page(
    'dt-options-page',
    false,
    h(
      'div',
      { class: 'dt-panel' },
      h('h1', { class: 'dt-panel__title' }, 'Options'),
      toggle(
        'Helper: grey out what cannot be played, say why, and explain the score',
        prefs.helper,
        (on) => act.change({ helper: on }),
      ),
      toggle('Game sounds (the Hall’s volume still applies)', prefs.sound, (on) =>
        act.change({ sound: on }),
      ),
      h(
        'div',
        { class: 'dt-panel__buttons' },
        h(
          'button',
          { class: 'dt-button', type: 'button', onclick: act.hallSettings },
          'Hall settings',
        ),
        h(
          'button',
          { class: 'dt-button', type: 'button', onclick: act.forget },
          'Forget Detour’s data',
        ),
        back(act.back),
      ),
    ),
  );
}
