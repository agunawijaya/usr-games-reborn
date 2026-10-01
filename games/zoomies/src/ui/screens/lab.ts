import { LAB_NIGHTS, type LabResult, pipResult, runPattern } from '../../game/lab';
import { createRoom, classicWaveSpec } from '../../engine/room';
import { applyAction } from '../../engine/rules';
import type { RoomState } from '../../engine/types';
import { BoardView } from '../../render/board-view';
import { RIVAL_COATS } from '../../render/palette';
import {
  createPatternMind,
  directionOf,
  PATTERN_LETTERS,
  type PatternLetter,
  PIP_PATTERN,
} from '../../rivals/pip';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { MOVES, type MoveAction } from '../keys';

/**
 * The Pattern Lab. The original hid an experiment in its source: a player that never thinks,
 * running as far as it can one way and then the next of eight directions. Here you write the
 * pattern, it plays five fixed nights by itself, and its total is set against Pip's.
 */

// The text-style selector keeps fonts from swapping the arrows for coloured emoji.
const TEXT = '︎';
const ARROW: Record<PatternLetter, string> = {
  Y: `↖${TEXT}`,
  K: `↑${TEXT}`,
  U: `↗${TEXT}`,
  H: `←${TEXT}`,
  L: `→${TEXT}`,
  B: `↙${TEXT}`,
  J: `↓${TEXT}`,
  N: `↘${TEXT}`,
};
const NAME: Record<PatternLetter, string> = {
  Y: 'up and left',
  K: 'up',
  U: 'up and right',
  H: 'left',
  L: 'right',
  B: 'down and left',
  J: 'down',
  N: 'down and right',
};
const MAX_SLOTS = 8;

function letterFor(dx: number, dy: number): PatternLetter | null {
  return PATTERN_LETTERS.find((l) => directionOf(l)[0] === dx && directionOf(l)[1] === dy) ?? null;
}

export function labScreen(app: App): Screen {
  const saved = app.saves.lab.load();
  let pattern: PatternLetter[] = [...(saved.best?.pattern ?? 'HL')] as PatternLetter[];
  let cursor = Math.min(pattern.length, MAX_SLOTS - 1);
  let result: LabResult | null = null;
  let watching: { stop(): void } | null = null;

  const slots = h('div', {
    class: 'zm-pattern',
    role: 'group',
    'aria-label': 'Your pattern, up to eight directions',
  });
  const compass = h('div', { class: 'zm-compass', role: 'group', 'aria-label': 'Directions' });
  const scores = h('div', {});
  const status = h(
    'p',
    { class: 'zm-status', role: 'status', 'aria-live': 'polite' },
    'Pick directions, then run the nights.',
  );
  const boardBox = h('div', { class: 'zm-lab-board zm-card' });
  const canvas = h('canvas', { 'aria-label': 'Night one, played by your pattern' });
  boardBox.append(canvas);
  const view = new BoardView(canvas, {
    look: app.look,
    theme: 'great-hall',
    coat: app.coat(),
    reducedMotion: app.reducedMotion,
    pace: 0.35,
    whiskers: false,
  });
  view.setRoom(createRoom(classicWaveSpec(LAB_NIGHTS[0], 1)), 'great-hall', 11);
  const observer = new ResizeObserver(() =>
    view.resize(boardBox.clientWidth, boardBox.clientHeight),
  );
  observer.observe(boardBox);
  view.start();

  function renderSlots() {
    slots.replaceChildren(
      ...Array.from({ length: MAX_SLOTS }, (_, i) => {
        const letter = pattern[i];
        return h(
          'button',
          {
            type: 'button',
            class: letter ? 'zm-slot' : 'zm-slot zm-slot--empty',
            'aria-pressed': String(i === cursor),
            'aria-label': letter ? `Step ${i + 1}: run ${NAME[letter]}` : `Step ${i + 1}: empty`,
            onclick: () => {
              cursor = Math.min(i, pattern.length);
              renderSlots();
            },
            dataset: { testid: `zm-slot-${i}` },
          },
          letter ? ARROW[letter] : '·',
          h('small', {}, letter ?? ''),
        );
      }),
    );
  }

  function put(letter: PatternLetter) {
    if (cursor >= pattern.length) pattern.push(letter);
    else pattern[cursor] = letter;
    pattern = pattern.slice(0, MAX_SLOTS);
    cursor = Math.min(cursor + 1, MAX_SLOTS - 1);
    renderSlots();
  }

  function removeLast() {
    if (pattern.length === 0) return;
    pattern.pop();
    cursor = Math.min(cursor, pattern.length);
    renderSlots();
  }

  const order: (PatternLetter | null)[] = ['Y', 'K', 'U', 'H', null, 'L', 'B', 'J', 'N'];
  compass.append(
    ...order.map((letter) =>
      letter
        ? h(
            'button',
            {
              type: 'button',
              class: 'zm-button',
              'aria-label': `Run ${NAME[letter]}`,
              onclick: () => put(letter),
              dataset: { testid: `zm-dir-${letter}` },
            },
            ARROW[letter],
          )
        : h(
            'button',
            {
              type: 'button',
              class: 'zm-button',
              'aria-label': 'Remove the last direction',
              onclick: removeLast,
            },
            '⌫',
          ),
    ),
  );

  function renderScores() {
    const pip = pipResult();
    if (!result) {
      scores.replaceChildren(
        h('p', {}, `Pip’s ${PIP_PATTERN} scores ${pip.total} over the five nights.`),
      );
      return;
    }
    const mine = result;
    scores.replaceChildren(
      h(
        'table',
        { class: 'zm-table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { scope: 'col' }, 'Night'),
            h('th', { scope: 'col' }, `You (${mine.pattern})`),
            h('th', { scope: 'col' }, `Pip (${PIP_PATTERN})`),
          ),
        ),
        h(
          'tbody',
          {},
          ...mine.nights.map((night, i) =>
            h(
              'tr',
              {},
              h('th', { scope: 'row' }, String(i + 1)),
              h('td', {}, `${night.score} · ${night.waves} waves`),
              h('td', {}, `${pip.nights[i]!.score} · ${pip.nights[i]!.waves} waves`),
            ),
          ),
          h(
            'tr',
            {},
            h('th', { scope: 'row' }, 'Total'),
            h('td', { style: 'font-weight:700' }, String(mine.total)),
            h('td', { style: 'font-weight:700' }, String(pip.total)),
          ),
        ),
      ),
    );
  }

  async function watch(text: string) {
    watching?.stop();
    let stopped = false;
    watching = { stop: () => (stopped = true) };
    view.setGhost({ ...RIVAL_COATS.pip, name: text === PIP_PATTERN ? 'Pip' : 'Your pattern' });
    const mind = createPatternMind(text);
    let wave = 1;
    while (!stopped && wave <= 6) {
      let state: RoomState = createRoom(classicWaveSpec(LAB_NIGHTS[0], wave));
      view.setRoom(state, 'great-hall', 11 + wave);
      mind.newRoom?.();
      while (!stopped && state.status === 'playing' && state.turn < 1500) {
        const action = mind.decide(state);
        const { state: next, events } = applyAction(state, action);
        await view.animateTurn(state, next, events);
        state = next;
      }
      if (state.status !== 'cleared') break;
      wave++;
    }
    view.setGhost(null);
  }

  function run() {
    if (pattern.length === 0) {
      status.textContent = 'Add at least one direction first.';
      return;
    }
    const text = pattern.join('');
    result = runPattern(text);
    const pip = pipResult().total;
    app.saves.lab.update((lab) => ({
      runs: lab.runs + 1,
      best:
        !lab.best || result!.total > lab.best.score
          ? { pattern: text, score: result!.total }
          : lab.best,
    }));
    if (result.total > pip * 2) app.install('pattern-prodigy');
    status.textContent =
      result.total > pip
        ? `${text} scored ${result.total}: ahead of Pip by ${result.total - pip}.${result.total > pip * 2 ? ' More than double!' : ''}`
        : `${text} scored ${result.total}. Pip still leads by ${pip - result.total}.`;
    renderScores();
    void watch(text);
  }

  renderSlots();
  renderScores();
  const back = h(
    'button',
    {
      type: 'button',
      class: 'zm-button zm-button--quiet',
      onclick: () => app.go.title(),
      dataset: { testid: 'zm-back' },
    },
    '← Game menu',
  );
  const element = h(
    'section',
    { class: 'zm-screen', 'aria-labelledby': 'zm-lab-title', dataset: { testid: 'zm-lab' } },
    h(
      'div',
      { class: 'zm-page' },
      h(
        'div',
        { class: 'zm-page__head' },
        back,
        h('h1', { class: 'zm-page__title', id: 'zm-lab-title' }, 'Pattern Lab'),
      ),
      h(
        'p',
        { class: 'zm-page__lede' },
        'Hidden in the original’s source is a player that never thinks: run as far as you can one way, then the next of eight directions, round and round. Pip still plays it. Write a pattern of your own and see whether it lasts longer over the same five nights.',
      ),
      h(
        'div',
        { class: 'zm-grid-2' },
        h(
          'section',
          { class: 'zm-card zm-section', 'aria-labelledby': 'zm-lab-pattern' },
          h('h2', { id: 'zm-lab-pattern' }, 'Your pattern'),
          slots,
          h(
            'div',
            { style: 'display:flex;gap:18px;align-items:end;flex-wrap:wrap' },
            compass,
            h(
              'div',
              { style: 'display:grid;gap:8px' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'zm-button zm-button--primary',
                  onclick: run,
                  dataset: { testid: 'zm-run' },
                },
                'Run five nights ',
                h('kbd', { class: 'zm-kbd' }, '⏎'),
              ),
              h(
                'button',
                { type: 'button', class: 'zm-button', onclick: () => void watch(PIP_PATTERN) },
                'Watch Pip',
              ),
            ),
          ),
          h(
            'p',
            { class: 'zm-ladder__note' },
            'Each direction runs until the next step would be unsafe or blocked. Zooms happen only when every square is deadly. Typing the movement keys fills the slots.',
          ),
          status,
          scores,
        ),
        boardBox,
      ),
    ),
  );
  return {
    element,
    focus: () => slots.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }),
    onLook: (look, reducedMotion) => view.setOptions({ look, reducedMotion }),
    onKey(event) {
      if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') {
        run();
        return true;
      }
      if (event.key === 'Backspace') {
        removeLast();
        return true;
      }
      const action = app.keys.actionFor(event);
      if (action && action in MOVES && action !== 'stay') {
        const [dx, dy] = MOVES[action as MoveAction];
        const letter = letterFor(dx, dy);
        if (letter) put(letter);
        return true;
      }
      return false;
    },
    destroy() {
      watching?.stop();
      observer.disconnect();
      view.destroy();
    },
  };
}
