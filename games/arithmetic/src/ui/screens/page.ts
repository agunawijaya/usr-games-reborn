import { layoutFor } from '../../render/layout';
import type { Look, ThemeId } from '../../render/look';
import type { App } from '../app';
import { makeWorld } from '../app';
import { h } from '../dom';
import { place } from '../hud';

/**
 * The frame every menu page shares: a big card over the world, a title, a way back to the game
 * menu, and a scroll area for long content.
 */
export function page(
  app: App,
  title: string,
  body: (HTMLElement | null)[],
  testId: string,
): { root: HTMLElement; layout: () => void; back: HTMLButtonElement } {
  const back = h(
    'button',
    { class: 'ns-button', type: 'button', onclick: () => app.go.menu(), 'data-testid': 'ns-back' },
    '← Game menu',
  );
  const card = h(
    'section',
    { class: 'ns-card ns-page', 'aria-label': title, 'data-testid': testId },
    h('header', { class: 'ns-page__head' }, h('h1', { class: 'ns-card__title' }, title), back),
    h('div', { class: 'ns-page__body' }, ...body),
  );
  const root = h('div', { class: 'ns-menu' }, card);
  const layout = () => {
    const l = app.layout;
    const width = Math.min(l.width - 2 * Math.max(24, 64 * l.s), 1320 * l.s + 80);
    const top = Math.max(76, 84 * l.s);
    place(card, { x: (l.width - width) / 2, y: top, w: width, h: 0 });
    card.style.height = 'auto';
    card.style.maxHeight = `${l.height - top - Math.max(20, 32 * l.s)}px`;
  };
  return { root, layout, back };
}

/** A still of a theme's world, for choosing between them. */
export function themePreview(
  theme: ThemeId,
  dark: boolean,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const scale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.className = 'ns-preview';
  canvas.setAttribute('aria-hidden', 'true');
  const look: Look = { theme, dark };
  const world = makeWorld(look, true, scale);
  world.resize(layoutFor(width, height, 'menu'));
  world.show({ kind: 'menu', featured: 360, daily: 1 }, 0);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  world.draw(ctx, 0);
  world.destroy();
  return canvas;
}

/** Two buttons that behave as a pair of radio choices. */
export function choiceRow<T extends string>(
  label: string,
  choices: readonly { value: T; text: string; note?: string }[],
  current: T,
  onPick: (value: T) => void,
): HTMLElement {
  const row = h('div', { class: 'ns-choices', role: 'radiogroup', 'aria-label': label });
  const buttons = choices.map((choice) =>
    h(
      'button',
      {
        class: 'ns-choice',
        type: 'button',
        role: 'radio',
        'aria-checked': String(choice.value === current),
        'data-value': choice.value,
        onclick: () => {
          for (const b of buttons)
            b.setAttribute('aria-checked', String(b === buttons[choices.indexOf(choice)]));
          onPick(choice.value);
        },
      },
      h('span', { class: 'ns-choice__text' }, choice.text),
      choice.note ? h('span', { class: 'ns-choice__note' }, choice.note) : null,
    ),
  );
  row.append(h('span', { class: 'ns-label' }, label), ...buttons);
  return row;
}
