import { type Child, h } from '../../ui/h';
import { type HoloIcon, holoIcon } from './icons';

/**
 * The frame for the Hall's quieter pages (settings, about, the server closet): the way back to
 * the collection, a sticker-style eyebrow, a big friendly title and the page's own body, with an
 * optional side column that stays in view while the page scrolls.
 */

export interface PageFrameOptions {
  key: 'settings' | 'about' | 'closet';
  icon: HoloIcon;
  eyebrow: string;
  title: string;
  lede?: string;
  body: Child;
  aside?: Child;
}

export function pageFrame(options: PageFrameOptions): HTMLElement {
  const { key } = options;
  return h(
    'div',
    { class: ['hc-page', `hc-page--${key}`] },
    h(
      'header',
      { class: 'hc-page__head' },
      h(
        'div',
        { class: 'hc-page__topline' },
        h(
          'a',
          {
            class: 'hc-button hc-button--soft hc-page__back',
            href: '#/',
            dataset: { focusKey: `${key}:back` },
          },
          holoIcon('back'),
          'Back to the collection',
        ),
        h(
          'p',
          { class: 'hc-eyebrow' },
          holoIcon(options.icon, 'hc-icon hc-icon--small'),
          options.eyebrow,
        ),
      ),
      h('h1', { id: `hc-${key}-title`, class: 'hc-page__title' }, options.title),
      options.lede ? h('p', { class: 'hc-page__lede' }, options.lede) : null,
    ),
    h(
      'div',
      { class: ['hc-page__body', options.aside ? 'hc-page__body--aside' : null] },
      options.aside ? h('aside', { class: 'hc-page__aside' }, options.aside) : null,
      h('div', { class: 'hc-page__content' }, options.body),
    ),
  );
}
