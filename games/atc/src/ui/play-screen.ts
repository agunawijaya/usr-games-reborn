import type { LookId } from '../render/look';
import { Radar } from '../render/radar';
import { append, h } from './dom';
import { readyElement, type StripModel, stripElement } from './strips';

/**
 * The play screen: the top bar, the radar on the left, the strip board on the right and the
 * command bar along the bottom. It only lays things out and fills them in; the controller
 * decides what they say.
 */

export interface BarModel {
  context: string;
  title: string;
  arena: string;
  safe: number;
  target: number | null;
  tick: number;
  /** 0–1: how much of the current tick has passed, drawn as a ring beside the tick number. */
  tickProgress: number;
  /** Landings in the current string (consecutive ticks), shown as pearls. */
  string: number;
  speed: string;
}

export type FootModel =
  /** The control hints; with a plane selected, the keys that work on it. */
  | { kind: 'hints'; selected?: string | null }
  /** Terminal mode's live command line, built by the play session. */
  | { kind: 'terminal'; bar: HTMLElement }
  /** A still of a typed order, for documentation scenes. */
  | { kind: 'echo'; echo: { letter: string; words: string }; choices: readonly string[] };

export interface KeyLabels {
  nextTick: string;
  nextPlane: string;
  terminal: string;
  holdLeft: string;
  holdRight: string;
}

const DEFAULT_LABELS: KeyLabels = {
  nextTick: 'Space',
  nextPlane: 'Tab',
  terminal: '`',
  holdLeft: '[',
  holdRight: ']',
};

export interface PlayScreenOptions {
  /** Inside the Hall its own pause button sits at the top right, so the bar leaves room for it. */
  hallChrome?: boolean;
}

export interface PlayScreen {
  /** The look's root element: overlays such as results cards are appended here. */
  root: HTMLElement;
  radar: Radar;
  radarHost: HTMLElement;
  overlay: HTMLElement;
  setLook(look: LookId): void;
  renderBar(model: BarModel): void;
  renderStrips(models: readonly StripModel[], airborne: number, ready: number): void;
  renderFoot(model: FootModel): void;
  /** The keycaps the hints show for the keys a player can remap. */
  setKeyLabels(labels: KeyLabels): void;
  /** The top bar's Game menu button. */
  onGameMenu(handler: () => void): void;
  /** Sizes the radar canvas to its panel; call after layout changes. */
  fit(): void;
}

const MENU_ICON = 'M4 7h16M4 12h16M4 17h16';
const PAUSE_ICON = 'M9 6v12M15 6v12';

export function createPlayScreen(
  host: HTMLElement,
  look: LookId,
  options: PlayScreenOptions = {},
): PlayScreen {
  let gameMenu: (() => void) | null = null;
  let labels = DEFAULT_LABELS;
  const canvas = h('canvas', { 'aria-label': 'Radar' });
  const radarHost = h('div', { class: 'sk-radar' }, canvas);
  const overlay = h('div', { class: 'sk-overlay', style: 'inset:0' });
  radarHost.append(overlay);
  const bar = h('header', { class: 'sk-bar' });
  // Both lists are listboxes: arrow keys move the selection through the strips (see the session).
  const list = h('ol', {
    class: 'sk-strips',
    role: 'listbox',
    tabindex: 0,
    'aria-label': 'Flight strips',
  });
  const count = h('span', { class: 'sk-board__count' });
  const readyList = h('ol', {
    class: 'sk-bay__list',
    role: 'listbox',
    tabindex: 0,
    'aria-label': 'Waiting for take-off',
  });
  const bay = h(
    'section',
    { class: 'sk-bay' },
    h(
      'h3',
      { class: 'sk-bay__title' },
      'Waiting on the ground',
      h('span', {}, 'give an altitude to take off'),
    ),
    readyList,
  );
  const board = h(
    'aside',
    { class: 'sk-board' },
    h(
      'div',
      { class: 'sk-board__head' },
      h('h2', { class: 'sk-board__title' }, 'Flight strips'),
      count,
    ),
    list,
    bay,
  );
  const foot = h('footer', { class: 'sk-foot' });
  const root = h(
    'div',
    { class: `skyloom${options.hallChrome ? ' skyloom--in-hall' : ''}`, 'data-look': look },
    bar,
    h('main', { class: 'sk-main' }, radarHost, board),
    foot,
  );
  host.append(root);
  const radar = new Radar(canvas);

  return {
    root,
    radar,
    radarHost,
    overlay,
    setLook(next) {
      root.dataset.look = next;
    },
    renderBar(model) {
      bar.replaceChildren(...barContent(model, !options.hallChrome, () => gameMenu?.()));
    },
    renderStrips(models, airborne, ready) {
      count.textContent = `${airborne} airborne · ${ready} waiting`;
      const flying = models.filter((m) => m.urgency !== 'ready');
      const waiting = models.filter((m) => m.urgency === 'ready');
      readyList.replaceChildren(...waiting.map(readyElement));
      bay.hidden = waiting.length === 0;
      list.replaceChildren(
        h(
          'li',
          { class: 'sk-strips__fields', 'aria-hidden': 'true' },
          h('span'),
          h('span', {}, 'ID'),
          h('span', { style: 'padding-left:0.75em' }, 'Flight'),
          h('span', {}, 'Alt'),
          h('span', {}, 'Fuel'),
        ),
        ...flying.map(stripElement),
      );
      const selected = models.find((m) => m.selected);
      for (const box of [list, readyList]) {
        const holds = selected && box.querySelector(`#sk-strip-${selected.name}`);
        if (holds) box.setAttribute('aria-activedescendant', `sk-strip-${selected.name}`);
        else box.removeAttribute('aria-activedescendant');
      }
    },
    renderFoot(model) {
      foot.replaceChildren(...footContent(model, labels));
    },
    setKeyLabels(next) {
      labels = next;
    },
    onGameMenu(handler) {
      gameMenu = handler;
    },
    fit() {
      const box = radarHost.getBoundingClientRect();
      radar.resize(box.width, box.height, window.devicePixelRatio || 1);
    },
  };
}

function stat(label: string, ...value: (Node | string)[]): HTMLElement {
  return h(
    'div',
    { class: 'sk-stat' },
    h('span', { class: 'sk-stat__label' }, label),
    h('span', { class: 'sk-stat__value' }, ...value),
  );
}

function pearls(count: number): HTMLElement {
  const shown = Math.max(4, count + 1);
  const row = h('span', { class: 'sk-pearls', 'aria-hidden': 'true' });
  for (let i = 0; i < Math.min(shown, 8); i++)
    row.append(h('i', { class: i < count ? 'is-lit' : undefined }));
  return row;
}

function barContent(model: BarModel, ownPause: boolean, onGameMenu: () => void): Node[] {
  const menu = h('button', { class: 'sk-button', type: 'button' }, menuIcon(), 'Game menu');
  menu.addEventListener('click', onGameMenu);
  const title = h(
    'div',
    { class: 'sk-title' },
    h('span', { class: 'sk-wordmark' }, 'Sky', h('span', {}, 'loom')),
    h(
      'span',
      { class: 'sk-shift' },
      `${model.context} · `,
      h('strong', {}, model.title),
      // Endless skies are named after their arena; the chip would only repeat the title.
      model.arena === model.title ? null : h('span', { class: 'sk-arena' }, model.arena),
    ),
  );
  const safe = stat(
    'Safe',
    String(model.safe),
    model.target === null ? '' : h('small', {}, ` / ${model.target}`),
  );
  const string = stat('String', `×${model.string}`, pearls(model.string));
  const tick = stat('Tick', String(model.tick), tickRing(model.tickProgress));
  const speed = h('span', { class: 'sk-speed' }, model.speed);
  const pause = ownPause
    ? h(
        'button',
        { class: 'sk-button', type: 'button', 'aria-keyshortcuts': 'Escape' },
        pauseIcon(),
        'Pause',
        h('span', { class: 'sk-key' }, 'Esc'),
      )
    : null;
  const stats = h('div', { class: 'sk-stats' }, safe, string, tick, speed);
  if (pause) stats.append(pause);
  return [menu, title, stats];
}

/** A small ring that fills as the next tick approaches. */
function tickRing(progress: number): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('class', 'sk-tick-ring');
  svg.setAttribute('aria-hidden', 'true');
  const circumference = 2 * Math.PI * 7;
  for (const part of ['track', 'fill'] as const) {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '10');
    circle.setAttribute('cy', '10');
    circle.setAttribute('r', '7');
    circle.setAttribute('class', `sk-tick-ring__${part}`);
    if (part === 'fill') {
      circle.setAttribute('stroke-dasharray', `${circumference}`);
      circle.setAttribute('stroke-dashoffset', `${circumference * (1 - progress)}`);
    }
    svg.append(circle);
  }
  return svg;
}

function menuIcon(): SVGSVGElement {
  return strokeIcon(MENU_ICON);
}

function pauseIcon(): SVGSVGElement {
  return strokeIcon(PAUSE_ICON);
}

function strokeIcon(d: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.2');
  path.setAttribute('stroke-linecap', 'round');
  svg.append(path);
  return svg;
}

function key(text: string): HTMLElement {
  return h('span', { class: 'sk-key' }, text);
}

function footContent(model: FootModel, labels: KeyLabels): Node[] {
  const terminalOn = model.kind !== 'hints';
  const mode = h(
    'span',
    { class: 'sk-mode' },
    terminalOn ? 'Terminal on' : 'Terminal',
    key(labels.terminal),
  );
  if (model.kind === 'terminal') return [model.bar, mode];
  if (model.kind === 'hints') {
    const hints = h('div', { class: 'sk-hints' });
    if (model.selected) {
      append(hints, [
        h('strong', { class: 'sk-hints__plane' }, model.selected),
        h('span', {}, key('w e d c x z a q'), 'heading'),
        h('span', {}, key('0–9'), 'altitude'),
        h('span', {}, key(labels.holdLeft), key(labels.holdRight), 'hold'),
        h('span', {}, 'or drag a route'),
        h('span', {}, key('Enter'), 'let go'),
      ]);
    } else {
      append(hints, [
        h('span', {}, 'Drag from a plane to weave its route'),
        h('span', {}, key('Scroll'), 'altitude'),
        h('span', {}, 'Hold', key('Right mouse'), 'to tilt'),
        h('span', {}, key(labels.nextTick), 'next tick'),
        h('span', {}, key(labels.nextPlane), 'most urgent'),
      ]);
    }
    return [hints, mode];
  }
  const echo = h(
    'span',
    { class: 'sk-terminal__echo' },
    h('b', {}, `${model.echo.letter}:`),
    ` ${model.echo.words}`,
    h('span', { class: 'sk-caret', 'aria-hidden': 'true' }),
  );
  const choices = h(
    'span',
    { class: 'sk-terminal__choices' },
    ...model.choices.map((c) => h('span', {}, c)),
  );
  return [
    h(
      'div',
      { class: 'sk-terminal' },
      h('span', { class: 'sk-terminal__prompt' }, '›'),
      echo,
      choices,
    ),
    mode,
  ];
}
