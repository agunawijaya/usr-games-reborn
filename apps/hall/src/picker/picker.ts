import '@fontsource-variable/bricolage-grotesque/wght.css';
import './picker.css';
import { type Appearance, STYLE_IDS, type StyleId } from '@usr-games/kit';
import { applyTheme } from '../core/palette';
import { STYLE_COPY, type StyleDeps, type StyleModule } from '../core/style-module';
import { HOME } from '../router';
import { h, mount } from '../ui/h';
import { icon } from '../ui/icons';

/**
 * The first-visit style picker: the three Hall styles side by side, each showing the real Home
 * in miniature. Console Home is pre-selected as the most familiar for new players; the choice
 * is remembered and can be changed any time in Settings.
 */

/** Previews render the real Home at desktop width, then scale down. */
const PREVIEW_WIDTH = 1920;

type Loaders = Record<StyleId, () => Promise<StyleModule>>;

/** Loaded lazily, like the host does, so choosing costs nothing extra later. */
const LOADERS: Loaders = {
  console: () => import('../styles/console/index').then((module) => module.default),
  holo: () => import('../styles/holo/index').then((module) => module.default),
  'machine-room': () => import('../styles/machine-room/index').then((module) => module.default),
};

const APPEARANCE_LABELS: Record<'light' | 'dark' | 'system', string> = {
  light: 'Day',
  dark: 'Night',
  system: 'Auto',
};

function greeting(deps: StyleDeps): string {
  const name = deps.store.snapshot().profile.username;
  return name ? `Welcome, ${name}.` : 'Welcome in.';
}

/** Keeps a 1920×1080 frame scaled to whatever width its box has. */
function fitFrame(box: HTMLElement, frame: HTMLElement): ResizeObserver {
  const observer = new ResizeObserver(() => {
    frame.style.transform = `scale(${box.clientWidth / PREVIEW_WIDTH})`;
  });
  observer.observe(box);
  return observer;
}

function styleCard(style: StyleId, selected: boolean, onPick: (style: StyleId) => void) {
  const frame = h('div', { class: 'style-preview sp-frame', inert: true, 'aria-hidden': 'true' });
  const screen = h('div', { class: 'sp-screen' }, frame);
  const copy = STYLE_COPY[style];
  const input = h('input', {
    type: 'radio',
    name: 'hall-style',
    value: style,
    class: 'sp-radio',
    checked: selected,
    onchange: () => onPick(style),
  });
  const card = h(
    'label',
    { class: ['sp-card', selected && 'is-selected'], dataset: { style } },
    input,
    screen,
    h(
      'span',
      { class: 'sp-card__copy' },
      h(
        'span',
        { class: 'sp-card__title' },
        h('span', { class: 'sp-card__name' }, copy.name),
        style === 'console' ? h('span', { class: 'sp-card__tag' }, 'Most familiar') : null,
      ),
      h('span', { class: 'sp-card__pitch' }, copy.pitch),
    ),
    h('span', { class: 'sp-card__check', 'aria-hidden': 'true' }, icon('check')),
  );
  return { card, frame, screen };
}

const picker: Pick<StyleModule, 'start'> = {
  start(root, deps) {
    const { store, router } = deps;
    const html = document.documentElement;
    let selected: StyleId = store.snapshot().profile.styleChosen
      ? store.snapshot().settings.style
      : 'console';
    const cleanups: (() => void)[] = [];
    let disposed = false;

    function paintPage() {
      const snapshot = store.snapshot();
      applyTheme(html, {
        style: 'console',
        theme: 'console',
        appearance: snapshot.appearance,
        colorBlindPalette: snapshot.settings.colorBlindPalette,
        reducedMotion: snapshot.reducedMotion,
      });
      // The picker belongs to no style; its own stylesheet keys on this.
      html.dataset.style = 'picker';
      document.title = 'Pick your Hall · /usr/games Reborn';
    }

    async function render() {
      for (const cleanup of cleanups.splice(0)) cleanup();
      paintPage();
      const snapshot = store.snapshot();
      const appearance: Appearance = snapshot.appearance;
      const cards = STYLE_IDS.map((style) =>
        styleCard(style, style === selected, (next) => {
          selected = next;
          for (const { card } of cards)
            card.classList.toggle('is-selected', card.dataset.style === next);
          start.querySelector('.sp-start__style')!.textContent = STYLE_COPY[next].name;
        }),
      );
      const start = h(
        'button',
        {
          type: 'button',
          class: 'sp-start',
          onclick: () => {
            store.chooseStyle(selected);
            router.go(HOME);
          },
        },
        h(
          'span',
          null,
          'Start with ',
          h('span', { class: 'sp-start__style' }, STYLE_COPY[selected].name),
        ),
        icon('run'),
      );
      const appearanceChoice = h(
        'div',
        { class: 'sp-appearance', role: 'radiogroup', 'aria-label': 'Day or night' },
        (['light', 'dark', 'system'] as const).map((value) =>
          h(
            'label',
            {
              class: [
                'sp-appearance__option',
                snapshot.settings.appearance === value && 'is-selected',
              ],
            },
            h('input', {
              type: 'radio',
              name: 'hall-appearance',
              value,
              class: 'sp-radio',
              checked: snapshot.settings.appearance === value,
              onchange: () => store.settings.update({ appearance: value }),
            }),
            APPEARANCE_LABELS[value],
          ),
        ),
      );
      mount(
        root,
        h(
          'main',
          { id: 'screen', class: 'sp-page', tabindex: '-1' },
          h('div', { class: 'sp-glow', 'aria-hidden': 'true' }),
          h(
            'header',
            { class: 'sp-header' },
            h(
              'p',
              { class: 'sp-brand' },
              icon('brand', 'icon sp-brand__mark'),
              h('span', null, '/usr/games'),
              h('b', null, 'Reborn'),
            ),
            appearanceChoice,
          ),
          h(
            'section',
            { class: 'sp-intro', 'aria-labelledby': 'sp-title' },
            h('p', { class: 'sp-kicker' }, greeting(deps)),
            h('h1', { id: 'sp-title', class: 'sp-title' }, 'How should your Hall look?'),
            h(
              'p',
              { class: 'sp-lede' },
              'Three ways to walk into the same thirty games. Your progress is the same in all of them, and you can switch any time in Settings.',
            ),
          ),
          h(
            'fieldset',
            { class: 'sp-choices' },
            h('legend', { class: 'visually-hidden' }, 'Hall style'),
            cards.map(({ card }) => card),
          ),
          h('div', { class: 'sp-actions' }, start),
        ),
      );
      for (const { frame, screen } of cards) {
        const observer = fitFrame(screen, frame);
        cleanups.push(() => observer.disconnect());
      }
      // Previews load their styles lazily; each fills in when it arrives.
      await Promise.all(
        cards.map(async ({ frame, card }) => {
          const style = card.dataset.style as StyleId;
          const module = await LOADERS[style]();
          if (disposed || !frame.isConnected) return;
          cleanups.push(
            module.preview(frame, {
              store,
              appearance,
              theme: snapshot.settings.theme,
            }),
          );
          // A style's preview paints its own frame; the page stays the picker's.
          html.dataset.style = 'picker';
        }),
      );
    }

    const stop = store.subscribe((_, change) => {
      if (change === 'settings') void render();
    });
    void render();
    root.querySelector<HTMLElement>('#screen')?.focus({ preventScroll: true });

    return {
      destroy() {
        disposed = true;
        stop();
        for (const cleanup of cleanups.splice(0)) cleanup();
        root.replaceChildren();
      },
    };
  },
};

export default picker;
