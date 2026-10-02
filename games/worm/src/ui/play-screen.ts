import { TEMPO_MULTIPLIER, TEMPOS, type Tempo } from '../engine/tempo';
import type { LookId } from '../render/look';
import { GardenView } from '../render/view';
import { h, icon } from './dom';

/**
 * The play screen: a top bar (Game menu, the garden's name, length, score, chain, the tempo
 * meter and Pause) over the garden canvas. The session fills it; this module only lays it out.
 */

export interface BarModel {
  context: string;
  title: string;
  length: number;
  score: number;
  chain: number;
  tempo: Tempo;
  /** Endless at the 1980 pace: the meter says so, and there is no multiplier. */
  classic?: boolean;
  /** Fill puzzles show moves against par instead of the tempo. */
  par?: { moves: number; par: number } | null;
}

export interface PlayScreen {
  root: HTMLElement;
  stage: HTMLElement;
  overlay: HTMLElement;
  view: GardenView;
  renderBar(model: BarModel): void;
  setLook(look: LookId): void;
  onGameMenu(handler: () => void): void;
  onPause(handler: () => void): void;
  fit(): void;
}

const MENU_ICON = 'M4 7h16M4 12h16M4 17h16';
const PAUSE_ICON = 'M9 6v12M15 6v12';
const TEMPO_WORDS: Record<Tempo, string> = {
  creep: 'Creep',
  stroll: 'Stroll',
  rush: 'Rush',
  zoom: 'Zoom',
};

export function createPlayScreen(
  host: HTMLElement,
  look: LookId,
  options: { hallChrome?: boolean } = {},
): PlayScreen {
  let gameMenu: (() => void) | null = null;
  let pause: (() => void) | null = null;
  const canvas = h('canvas', { 'aria-label': 'The garden' });
  const overlay = h('div', { class: 'nn-overlay' });
  const stage = h('div', { class: 'nn-stage' }, canvas, overlay);
  const bar = h('header', { class: 'nn-bar' });
  const root = h(
    'div',
    { class: `nn-play${options.hallChrome ? ' is-in-hall' : ''}`, 'data-look': look },
    bar,
    stage,
  );
  host.append(root);
  const view = new GardenView(canvas);

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
    { class: 'nn-stat' },
    h('span', { class: 'nn-stat__label' }, label),
    h('span', { class: 'nn-stat__value' }, value, extra ?? null),
  );
}

function classicMeter(): HTMLElement {
  return h(
    'div',
    {
      class: 'nn-stat nn-tempo is-classic',
      'aria-label': 'Tempo: Classic, one move a second, points ×1',
    },
    h('span', { class: 'nn-stat__label' }, 'Tempo'),
    h('span', { class: 'nn-stat__value' }, h('b', {}, 'Classic'), h('small', {}, '×1')),
  );
}

function tempoMeter(tempo: Tempo): HTMLElement {
  const level = TEMPOS.indexOf(tempo);
  const bars = h('span', { class: 'nn-tempo__bars', 'aria-hidden': 'true' });
  TEMPOS.forEach((t, i) =>
    bars.append(h('i', { class: i <= level ? 'is-on' : undefined, 'data-tempo': t })),
  );
  return h(
    'div',
    {
      class: 'nn-stat nn-tempo',
      'data-tempo': tempo,
      'aria-label': `Tempo: ${TEMPO_WORDS[tempo]}, points ×${TEMPO_MULTIPLIER[tempo]}`,
    },
    h('span', { class: 'nn-stat__label' }, 'Tempo'),
    h(
      'span',
      { class: 'nn-stat__value' },
      bars,
      h('b', {}, TEMPO_WORDS[tempo]),
      h('small', {}, `×${TEMPO_MULTIPLIER[tempo]}`),
    ),
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
    { class: 'nn-button', type: 'button' },
    icon(MENU_ICON, { stroke: true }),
    'Game menu',
  );
  menu.addEventListener('click', onGameMenu);
  const title = h(
    'div',
    { class: 'nn-title' },
    h('span', { class: 'nn-wordmark' }, 'Noodle ', h('span', {}, 'Nine')),
    h('span', { class: 'nn-context' }, `${model.context} · `, h('strong', {}, model.title)),
  );
  const chain = h(
    'div',
    { class: `nn-stat nn-chain${model.chain >= 2 ? ' is-on' : ''}` },
    h('span', { class: 'nn-stat__label' }, 'Chain'),
    h('span', { class: 'nn-stat__value' }, model.chain >= 2 ? `×${model.chain}` : '—'),
  );
  const stats = h(
    'div',
    { class: 'nn-stats' },
    stat('Length', String(model.length)),
    stat('Score', model.score.toLocaleString('en-GB')),
    chain,
    model.par
      ? stat('Moves', String(model.par.moves), h('small', {}, ` / par ${model.par.par}`))
      : model.classic
        ? classicMeter()
        : tempoMeter(model.tempo),
  );
  if (ownPause) {
    const pause = h(
      'button',
      { class: 'nn-button', type: 'button', 'aria-keyshortcuts': 'Escape' },
      icon(PAUSE_ICON, { stroke: true }),
      'Pause',
      h('kbd', {}, 'Esc'),
    );
    pause.addEventListener('click', onPause);
    stats.append(pause);
  }
  return [menu, title, stats];
}
