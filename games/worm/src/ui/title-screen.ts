import type { LookId } from '../render/look';
import { GardenView } from '../render/view';
import { h } from './dom';

/**
 * The game menu: the attract garden fills the screen, the house noodle playing in it, and the
 * menu sits on the left over a soft veil. Arrow keys move through the menu; Enter chooses.
 */

/** On a wide screen the box sits to the right of the menu, in the part the veil leaves clear. */
const TITLE_LAYOUT = {
  sideShare: 0.03,
  skyShare: 0.2,
  bottomShare: 0.06,
  widthShare: 0.6,
  shiftShare: 0.18,
};

export interface MenuEntry {
  label: string;
  meta: string;
  primary?: boolean;
  run: () => void;
}

export interface TitleScreen {
  root: HTMLElement;
  view: GardenView;
  setLook(look: LookId): void;
  fit(): void;
  focus(): void;
}

export function createTitleScreen(
  host: HTMLElement,
  look: LookId,
  entries: readonly MenuEntry[],
  options: { hallChrome?: boolean } = {},
): TitleScreen {
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const buttons = entries.map((entry) => {
    const button = h(
      'button',
      { type: 'button' },
      h('span', { class: 'nn-menu__label' }, entry.label),
      h('small', {}, entry.meta),
    );
    button.addEventListener('click', entry.run);
    return h('li', { class: entry.primary ? 'is-primary' : undefined }, button);
  });
  const menu = h('ol', { class: 'nn-menu', 'aria-label': 'Game menu' }, ...buttons);
  const column = h(
    'div',
    { class: 'nn-titlescreen__column' },
    h(
      'h1',
      { class: 'nn-titlescreen__mark' },
      h('span', {}, 'Noodle'),
      ' ',
      h('span', { class: 'nn-nine' }, 'Nine'),
    ),
    h('p', { class: 'nn-titlescreen__tagline' }, 'Eat the numbers. Chain the bites. Fill the box.'),
    menu,
    h(
      'p',
      { class: 'nn-titlescreen__credit' },
      'Inspired by worm, Michael Toy, UC Santa Cruz, 1980.',
    ),
  );
  const root = h(
    'section',
    {
      class: `nn-titlescreen${options.hallChrome ? ' is-in-hall' : ''}`,
      'data-look': look,
      'aria-label': 'Noodle Nine',
    },
    canvas,
    h('div', { class: 'nn-titlescreen__veil' }),
    column,
  );
  host.append(root);
  const view = new GardenView(canvas, TITLE_LAYOUT);
  menu.addEventListener('keydown', (event) => {
    const items = [...menu.querySelectorAll('button')];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (at + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      items[next]?.focus();
    }
  });
  return {
    root,
    view,
    setLook(next) {
      root.dataset.look = next;
    },
    fit() {
      const box = root.getBoundingClientRect();
      const wide = box.width >= 1100;
      view.resize(
        box.width,
        box.height,
        window.devicePixelRatio || 1,
        wide ? TITLE_LAYOUT : { skyShare: 0.2, bottomShare: 0.04 },
      );
    },
    focus() {
      menu.querySelector('button')?.focus();
    },
  };
}
