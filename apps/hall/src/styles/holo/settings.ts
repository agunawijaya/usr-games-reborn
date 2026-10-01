import { COSMETICS, isUnlocked } from '@usr-games/kit/progression';
import { settingsPanel } from '../../core/screens/settings/settings-panel';
import { playSound } from '../../core/sound';
import type { HallSnapshot } from '../../store/hall-store';
import { h } from '../../ui/h';
import type { HoloContext, HoloScreen } from './context';
import { holoIcon } from './icons';
import { pageFrame } from './page-frame';

/**
 * Settings in the Holo Collection: the shared settings panel on the right, and beside it a sample
 * card wearing the chosen foil (lean it with the pointer) above a short list that jumps to each
 * section. The panel follows the store on its own, so the shell keeps this screen as it is.
 */

function finishName(snapshot: HallSnapshot): string {
  const chosen = snapshot.settings.holoFinish;
  const cosmetic = COSMETICS.find((c) => c.id === chosen);
  return cosmetic && isUnlocked(cosmetic, snapshot.progression) ? cosmetic.name : 'Standard foil';
}

function sampleCard(context: HoloContext): HTMLElement {
  const art = h(
    'span',
    { class: 'hc-card__art hc-card__art--hall', style: { '--hc-hue': '290' } },
    holoIcon('sparkle', 'hc-icon hc-hall-mark'),
    h('span', { class: 'hc-foil hc-foil--rainbow' }),
    h('span', { class: 'hc-glare' }),
  );
  const card = h(
    'div',
    {
      class:
        'hc-card hc-card--achievement hc-card--album hc-card--earned hc-tier--extra hc-card--sample',
      'aria-hidden': 'true',
    },
    h(
      'span',
      { class: 'hc-card__tilt' },
      h(
        'span',
        { class: 'hc-card__frame' },
        h(
          'span',
          { class: 'hc-card__face' },
          art,
          h('span', { class: 'hc-card__tier' }, 'Sample card'),
          h('span', { class: 'hc-card__name' }, 'Your foil'),
          h('span', { class: 'hc-card__tagline' }, 'Lean it with the pointer to see the sheen.'),
          h(
            'span',
            { class: 'hc-card__stats' },
            h('span', null, 'Every card'),
            h('span', null, 'Live'),
          ),
        ),
      ),
    ),
  );
  if (context.interactive) context.tilt.attach({ card, poster: null });
  return card;
}

const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), select:not([disabled])';

/** Buttons that bring a section into view and put focus on its first control. */
function sectionIndex(panel: HTMLElement, context: HoloContext): HTMLElement {
  const sections = [...panel.querySelectorAll<HTMLElement>('[data-section]')];
  return h(
    'nav',
    { class: 'hc-settings-index', 'aria-label': 'Settings sections' },
    h(
      'ul',
      null,
      sections.map((section) => {
        const key = section.dataset.section!;
        const title = section.querySelector('.set-section__title')?.textContent ?? key;
        return h(
          'li',
          null,
          h(
            'button',
            {
              class: 'hc-settings-index__link',
              type: 'button',
              dataset: { focusKey: `settings:jump:${key}` },
              onclick: () => {
                // The panel re-renders its sections, so look the target up at click time.
                const target = panel.querySelector<HTMLElement>(`[data-section="${key}"]`);
                if (!target) return;
                target.scrollIntoView({
                  block: 'start',
                  behavior: context.theme.reducedMotion ? 'auto' : 'smooth',
                });
                target.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
                playSound(context.store, 'keyClick');
              },
            },
            title,
          ),
        );
      }),
    ),
  );
}

export function settingsScreen(context: HoloContext): HoloScreen {
  const panel = settingsPanel({ store: context.store, wording: 'plain' });
  const caption = h('p', { class: 'hc-settings-sample__caption' }, finishName(context.snapshot));
  const aside = h(
    'div',
    { class: 'hc-settings-aside' },
    h(
      'figure',
      { class: 'hc-settings-sample' },
      sampleCard(context),
      h(
        'figcaption',
        null,
        h('span', { class: 'hc-settings-sample__label' }, 'Foil on every card'),
        caption,
      ),
    ),
    sectionIndex(panel.element, context),
  );
  const element = pageFrame({
    key: 'settings',
    icon: 'settings',
    eyebrow: 'Settings',
    title: 'Make the Hall yours',
    lede: 'Choose how the collection looks and sounds. Everything saves as you go.',
    body: panel.element,
    aside,
  });
  return {
    element,
    title: 'Settings',
    destroy: () => panel.destroy(),
    onStateChange(next) {
      caption.textContent = finishName(next);
      return 'keep';
    },
  };
}
