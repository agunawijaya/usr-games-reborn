import type { LookId } from '../render/look';
import { TankView } from '../render/view';
import { h, icon } from './dom';

/**
 * The play screen: a top bar (Game menu, the dive's name, score, level, rows, the depth combo and
 * Pause) over the tank's canvas. The session fills it; this module only lays it out.
 */

export interface BarModel {
  context: string;
  title: string;
  score: number;
  level: number;
  rows: number;
  /** Plunges in a row: the depth combo. */
  combo: number;
  /** Classic 1992 shows its raw points and the level they will be multiplied by. */
  classic?: boolean;
  /** A dive's goal or the day's count of sinkers, in place of the rows: "Coral 3 / 14". */
  goal?: { label: string; done: number; of: number } | null;
}

export interface PlayScreen {
  root: HTMLElement;
  stage: HTMLElement;
  overlay: HTMLElement;
  view: TankView;
  renderBar(model: BarModel): void;
  setLook(look: LookId): void;
  onGameMenu(handler: () => void): void;
  onPause(handler: () => void): void;
  fit(): void;
}

const MENU_ICON = 'M4 7h16M4 12h16M4 17h16';
const PAUSE_ICON = 'M9 6v12M15 6v12';

export function createPlayScreen(
  host: HTMLElement,
  look: LookId,
  options: { hallChrome?: boolean } = {},
): PlayScreen {
  let gameMenu: (() => void) | null = null;
  let pause: (() => void) | null = null;
  const canvas = h('canvas', { 'aria-label': 'The tank' });
  const overlay = h('div', { class: 'snk-overlay' });
  const stage = h('div', { class: 'snk-stage' }, canvas, overlay);
  const bar = h('header', { class: 'snk-bar' });
  const root = h(
    'div',
    { class: `snk-play${options.hallChrome ? ' is-in-hall' : ''}`, 'data-look': look },
    bar,
    stage,
  );
  host.append(root);
  const view = new TankView(canvas);
  return {
    root,
    stage,
    overlay,
    view,
    renderBar(model) {
      bar.replaceChildren(
        ...barContent(
          model,
          !options.hallChrome,
          () => gameMenu?.(),
          () => pause?.(),
        ),
      );
    },
    setLook(next) {
      root.dataset.look = next;
    },
    onGameMenu(handler) {
      gameMenu = handler;
    },
    onPause(handler) {
      pause = handler;
    },
    fit() {
      const box = stage.getBoundingClientRect();
      view.resize(box.width, box.height, window.devicePixelRatio || 1);
    },
  };
}

function stat(label: string, value: string, extra?: Node | null): HTMLElement {
  return h(
    'div',
    { class: 'snk-stat' },
    h('span', { class: 'snk-stat__label' }, label),
    h('span', { class: 'snk-stat__value' }, value, extra ?? null),
  );
}

function barContent(
  model: BarModel,
  ownPause: boolean,
  onGameMenu: () => void,
  onPause: () => void,
): Node[] {
  const menu = h(
    'button',
    { class: 'snk-button', type: 'button', onclick: onGameMenu },
    icon(MENU_ICON, { stroke: true }),
    'Game menu',
  );
  const title = h(
    'div',
    { class: 'snk-title' },
    h('span', { class: 'snk-wordmark' }, 'Sinkers'),
    h('span', { class: 'snk-context' }, `${model.context} · `, h('strong', {}, model.title)),
  );
  const combo = h(
    'div',
    { class: `snk-stat snk-combo${model.combo >= 2 ? ' is-on' : ''}` },
    h('span', { class: 'snk-stat__label' }, 'Depth combo'),
    h('span', { class: 'snk-stat__value' }, model.combo >= 2 ? `×${model.combo}` : '—'),
  );
  const goal = model.goal
    ? h(
        'div',
        { class: 'snk-stat snk-goal' },
        h('span', { class: 'snk-stat__label' }, model.goal.label),
        h(
          'span',
          { class: 'snk-stat__value' },
          String(model.goal.done),
          h('small', {}, ` / ${model.goal.of}`),
        ),
      )
    : stat('Rows', String(model.rows));
  const stats = h(
    'div',
    { class: 'snk-stats' },
    stat(model.classic ? 'Points' : 'Score', model.score.toLocaleString('en-GB')),
    goal,
    stat('Level', String(model.level)),
    model.classic ? stat('Turns', '↺ only') : combo,
  );
  if (ownPause)
    stats.append(
      h(
        'button',
        { class: 'snk-button', type: 'button', 'aria-keyshortcuts': 'Escape', onclick: onPause },
        icon(PAUSE_ICON, { stroke: true }),
        'Pause',
        h('kbd', {}, 'Esc'),
      ),
    );
  return [menu, title, stats];
}
