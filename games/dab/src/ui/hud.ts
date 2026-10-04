import type { Player } from '../engine/board';
import type { MarkId } from '../render/marks';
import { h, markIcon, svg } from './dom';

/** What the play screen shows around the board. */
export interface SideModel {
  readonly names: readonly [string, string];
  readonly marks: readonly [MarkId, MarkId];
  readonly scores: readonly [number, number];
  readonly toMove: Player;
  /** The game is over: nobody is to move. */
  readonly finished?: boolean;
  /** The line under the match name: the ladder step, the Daily Board's number, the board size. */
  readonly match: string;
  readonly matchDetail: string;
  readonly rival: { readonly name: string; readonly blurb: string; readonly says: string } | null;
  readonly puzzle?: { readonly goal: string; readonly hint: string | null } | null;
  readonly lens: boolean;
  /** Whether the lens may be used here (it is off in the Daily Board). */
  readonly lensAllowed: boolean;
  readonly longChains: number;
  readonly loops: number;
  readonly control: Player;
  /** A run of boxes is there for you to take with one key. */
  readonly runReady?: boolean;
}

export interface Handlers {
  readonly onMenu: () => void;
  readonly onLens: () => void;
  readonly onRun?: () => void;
  readonly onHint?: () => void;
}

const MENU_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;
const LENS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/><path d="M7 10.5h7M10.5 7v7" stroke-dasharray="1.6 2.2"/></svg>`;
const RUN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7l5 5-5 5M11 7l5 5-5 5M18 6v12"/></svg>`;

function playerChip(model: SideModel, player: Player): HTMLElement {
  const toMove = !model.finished && model.toMove === player;
  return h(
    'div',
    {
      class: `dx-player dx-player-${player}`,
      'data-turn': String(toMove),
      'aria-label': `${model.names[player]}: ${model.scores[player]} boxes${toMove ? ', to move' : ''}`,
    },
    markIcon(model.marks[player]),
    h('b', {}, model.names[player]),
    h('small', {}, toMove ? 'to move' : player === 0 ? 'hatched boxes' : 'dotted boxes'),
    h('span', { class: 'dx-points', 'aria-hidden': 'true' }, String(model.scores[player])),
  );
}

/** The Game menu button, and the score centred over the board (`--dx-centre` on the root). */
export function topBar(model: SideModel, handlers: Handlers): HTMLElement {
  return h(
    'div',
    { class: 'dx-top' },
    h(
      'button',
      { class: 'dx-btn', type: 'button', onclick: handlers.onMenu, 'data-testid': 'dx-menu' },
      svg(MENU_ICON),
      'Game menu',
    ),
    h(
      'div',
      { class: 'dx-score dx-panel', role: 'status', 'data-testid': 'dx-score' },
      playerChip(model, 0),
      playerChip(model, 1),
    ),
  );
}

export function sidePanel(model: SideModel, handlers: Handlers): HTMLElement {
  const controller = model.names[model.control];
  return h(
    'aside',
    { class: 'dx-side dx-panel', 'aria-label': 'Match, opponent and chain lens' },
    h('header', { class: 'dx-match' }, h('b', {}, model.match), h('span', {}, model.matchDetail)),
    model.rival
      ? h(
          'section',
          { class: 'dx-rival' },
          markIcon(model.marks[1]),
          h('b', {}, model.rival.name),
          h('p', {}, model.rival.blurb),
        )
      : null,
    model.rival
      ? h('p', { class: 'dx-quote', 'data-testid': 'dx-quote' }, `“${model.rival.says}”`)
      : null,
    model.puzzle ? puzzleSection(model.puzzle, handlers) : null,
    h(
      'button',
      {
        class: 'dx-toggle',
        type: 'button',
        onclick: handlers.onLens,
        'aria-pressed': String(model.lens),
        disabled: !model.lensAllowed || null,
        'data-testid': 'dx-lens',
      },
      svg(LENS_ICON),
      h('b', {}, 'Chain lens'),
      h(
        'small',
        {},
        model.lensAllowed
          ? model.lens
            ? 'On: chains, loops and control'
            : 'Off'
          : 'Off in the Daily Board',
      ),
      h('span', { class: 'dx-key', 'aria-hidden': 'true' }, 'C'),
    ),
    model.lens
      ? h(
          'section',
          { class: 'dx-control', 'data-testid': 'dx-reading' },
          h('h2', {}, 'Reading the board'),
          h(
            'div',
            { class: 'dx-control-row' },
            'Long chains',
            h('b', {}, String(model.longChains)),
          ),
          h('div', { class: 'dx-control-row' }, 'Loops', h('b', {}, String(model.loops))),
          h(
            'div',
            { class: 'dx-control-row' },
            'On course for control',
            h('span', { class: `dx-badge dx-badge-${model.control}` }, controller),
          ),
          h(
            'p',
            { class: 'dx-note' },
            'Whoever must open the first long chain usually hands over the rest. Count the long chains, and keep one move in hand.',
          ),
        )
      : null,
    handlers.onRun
      ? h(
          'button',
          {
            class: 'dx-btn dx-run',
            type: 'button',
            onclick: handlers.onRun,
            disabled: !model.runReady || null,
            'data-testid': 'dx-run',
          },
          svg(RUN_ICON),
          'Take the run',
          h('span', { class: 'dx-key', 'aria-hidden': 'true' }, 'T'),
        )
      : null,
    h(
      'section',
      { class: 'dx-keys' },
      h('h2', {}, 'Keys'),
      keyRow(['←', '↑', '→', '↓'], 'aim the line; again to walk on'),
      keyRow(['Enter'], 'draw it · Space too'),
      keyRow(['h', 'j', 'k', 'l'], 'the original’s keys; y u b n hop'),
    ),
  );
}

function puzzleSection(puzzle: NonNullable<SideModel['puzzle']>, handlers: Handlers): HTMLElement {
  return h(
    'section',
    { class: 'dx-goal', 'data-testid': 'dx-goal' },
    h('h2', {}, 'Goal'),
    h('p', {}, puzzle.goal),
    puzzle.hint
      ? h('p', { class: 'dx-note' }, puzzle.hint)
      : handlers.onHint
        ? h('button', { class: 'dx-link', type: 'button', onclick: handlers.onHint }, 'Show a hint')
        : null,
  );
}

function keyRow(keys: readonly string[], what: string): HTMLElement {
  return h(
    'div',
    { class: 'dx-keyrow' },
    h('span', {}, ...keys.map((k) => h('span', { class: 'dx-key' }, k))),
    what,
  );
}

export interface CoachModel {
  readonly step: number;
  readonly steps: number;
  readonly title: string;
  readonly body: string;
  readonly options?: ReadonlyArray<{
    title: string;
    detail: string;
    result: string;
    good: boolean;
  }>;
  readonly prompt: string;
  /** Shown when the step is done or should be tried again, with its buttons. */
  readonly outcome?: { readonly text: string; readonly done: boolean } | null;
}

export interface CoachHandlers {
  readonly onNext?: () => void;
  readonly onRetry?: () => void;
}

/** The tutorial's coach card: the step, the lesson, and what to try. */
export function coachCard(model: CoachModel, handlers: CoachHandlers = {}): HTMLElement {
  const outcome = model.outcome;
  return h(
    'section',
    {
      class: 'dx-card dx-panel dx-coach',
      role: 'region',
      'aria-labelledby': 'dx-coach-title',
      'data-testid': 'dx-coach',
    },
    h(
      'div',
      { class: 'dx-steps', 'aria-label': `Step ${model.step} of ${model.steps}` },
      ...Array.from({ length: model.steps }, (_, i) =>
        h('i', { class: i + 1 < model.step ? 'done' : i + 1 === model.step ? 'here' : '' }),
      ),
    ),
    h('span', { class: 'dx-eyebrow' }, `Tutorial · step ${model.step} of ${model.steps}`),
    h('h1', { id: 'dx-coach-title' }, model.title),
    h('p', {}, model.body),
    model.options
      ? h(
          'div',
          { class: 'dx-compare' },
          ...model.options.map((o) =>
            h(
              'div',
              { class: `dx-option${o.good ? ' dx-option-good' : ''}` },
              h('b', {}, o.title),
              h('span', {}, o.detail),
              h('em', {}, o.result),
            ),
          ),
        )
      : null,
    outcome
      ? h(
          'div',
          { class: `dx-outcome${outcome.done ? ' dx-outcome-done' : ''}`, role: 'status' },
          h('p', {}, outcome.text),
          h(
            'div',
            { class: 'dx-row' },
            outcome.done && handlers.onNext
              ? h(
                  'button',
                  {
                    class: 'dx-btn dx-btn-primary',
                    type: 'button',
                    onclick: handlers.onNext,
                    'data-testid': 'dx-coach-next',
                  },
                  model.step === model.steps ? 'Finish' : 'Next step',
                  h('span', { class: 'dx-key' }, 'Enter'),
                )
              : null,
            handlers.onRetry
              ? h(
                  'button',
                  {
                    class: outcome.done ? 'dx-btn' : 'dx-btn dx-btn-primary',
                    type: 'button',
                    onclick: handlers.onRetry,
                    'data-testid': 'dx-coach-retry',
                  },
                  'Try again',
                )
              : null,
          ),
        )
      : h('p', { class: 'dx-note', role: 'status', 'aria-live': 'polite' }, model.prompt),
  );
}

/** The banner that names the moment when the double cross is played. */
export function cutBanner(byName: string, handed: number, kept: number | null): HTMLElement {
  const what = handed === 4 ? 'four' : 'two';
  return h(
    'div',
    { class: 'dx-cut-banner dx-panel', role: 'status', 'data-testid': 'dx-cut-banner' },
    h('b', {}, 'Double cross!'),
    h(
      'span',
      {},
      kept === null
        ? `${byName} gave ${what} away to keep control.`
        : `${byName} gave ${what} away to keep control: ${kept} boxes follow.`,
    ),
  );
}
