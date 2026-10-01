import { packageKey, packageXp } from '@usr-games/kit';
import { processRows } from '../../core/home-model';
import {
  achievementCount,
  CATEGORY_NAMES,
  callToAction,
  gameHref,
  howToPlay,
  shortHistory,
} from '../../core/plain';
import { playSound } from '../../core/sound';
import { HOME } from '../../router';
import { formatMinutes, formatNumber } from '../../ui/format';
import { h } from '../../ui/h';
import type { HoloContext, HoloScreen } from './context';
import { holoIcon } from './icons';
import { SET_LOOKS } from './model';

/**
 * A game's page: its card, jumbo-sized, flips over (400 ms) to show the back: what it is, how
 * to play, its achievements, where it came from and what to try next. Reduced motion swaps the
 * flip for a cross-fade. Escape returns to the collection.
 */

const FLIP_DELAY_MS = 160;

/**
 * The back's text columns scroll when a game has a lot to say (twelve achievements do not fit
 * at 1280×720), so each is a named region that keyboard users can focus and scroll.
 */
function scrollingColumn(label: string) {
  return { class: 'hc-back__col', role: 'region', 'aria-label': label, tabindex: '0' };
}

function backFace(context: HoloContext, id: string): HTMLElement {
  const entry = context.store.catalog.byId(id)!;
  const { manifest } = entry;
  const row = processRows([entry], context.snapshot.progression, context.snapshot.today)[0]!;
  const cta = callToAction(row, context.snapshot.today);
  const count = achievementCount(entry, context.snapshot.progression);
  const packages = manifest.packages ?? [];
  const related = manifest.manPage.seeAlso
    .map((other) => context.store.catalog.byId(other))
    .filter((e) => e !== undefined);
  return h(
    'div',
    { class: 'hc-flip__back' },
    h(
      'div',
      { class: 'hc-back__col hc-back__col--intro' },
      h('p', { class: 'hc-eyebrow' }, `${CATEGORY_NAMES[manifest.category]} set`),
      h('h1', { class: 'hc-back__title' }, manifest.title),
      h('p', { class: 'hc-back__tagline' }, manifest.tagline),
      h('p', { class: 'hc-back__text' }, manifest.teaser),
      h(
        'div',
        { class: 'hc-actions' },
        cta.href
          ? h(
              'a',
              {
                class: 'hc-button hc-button--primary',
                href: cta.href,
                dataset: { focusKey: 'detail:play' },
              },
              holoIcon('play'),
              cta.label,
            )
          : h('span', { class: 'hc-button hc-button--asleep' }, cta.label),
      ),
      h(
        'dl',
        { class: 'hc-facts hc-facts--compact' },
        h(
          'div',
          { class: 'hc-fact' },
          h('dt', null, 'Best'),
          h('dd', null, row.bestScore === null ? 'Not yet' : formatNumber(row.bestScore)),
        ),
        h(
          'div',
          { class: 'hc-fact' },
          h('dt', null, 'Length'),
          h('dd', null, formatMinutes(manifest.sessionMinutes)),
        ),
        h(
          'div',
          { class: 'hc-fact' },
          h('dt', null, 'Daily'),
          h('dd', null, manifest.daily ? 'Yes' : 'No'),
        ),
      ),
    ),
    h(
      'div',
      scrollingColumn('How to play and where it comes from'),
      h('h2', { class: 'hc-back__heading' }, 'How to play'),
      h(
        'ol',
        { class: 'hc-steps' },
        howToPlay(entry).map((step) => h('li', null, step)),
      ),
      h('h2', { class: 'hc-back__heading' }, 'Where it comes from'),
      h('p', { class: 'hc-back__text' }, shortHistory(entry)),
    ),
    h(
      'div',
      scrollingColumn('Achievements'),
      h(
        'h2',
        { class: 'hc-back__heading' },
        'Achievements',
        h(
          'span',
          { class: 'hc-back__count' },
          count.total > 0 ? `${count.earned} / ${count.total}` : '',
        ),
      ),
      packages.length === 0
        ? h('p', { class: 'hc-back__text' }, 'This game’s achievement cards arrive with the game.')
        : h(
            'ul',
            { class: 'hc-minis' },
            packages.map((definition) => {
              const earned = Boolean(
                context.snapshot.progression.packages[packageKey(manifest.id, definition.id)],
              );
              return h(
                'li',
                {
                  class: [
                    'hc-mini',
                    earned ? 'is-earned' : 'is-locked',
                    `hc-tier--${definition.tier}`,
                  ],
                },
                h('span', { class: 'hc-mini__icon' }, holoIcon(earned ? 'trophy' : 'lock')),
                h('span', { class: 'hc-mini__name' }, definition.title),
                h(
                  'span',
                  { class: 'hc-mini__desc' },
                  definition.hidden && !earned ? 'A surprise.' : definition.description,
                ),
                h('span', { class: 'hc-mini__xp' }, `+${packageXp(definition)} XP`),
              );
            }),
          ),
      related.length > 0 ? h('h2', { class: 'hc-back__heading' }, 'Try next') : null,
      related.length > 0
        ? h(
            'ul',
            { class: 'hc-related' },
            related.map((other) =>
              h(
                'li',
                null,
                h(
                  'a',
                  {
                    class: 'hc-related__link',
                    href: gameHref(other.manifest.id),
                    style: {
                      '--hc-frame-from': SET_LOOKS[other.manifest.category].frameFrom,
                      '--hc-frame-to': SET_LOOKS[other.manifest.category].frameTo,
                    },
                  },
                  other.manifest.title,
                ),
              ),
            ),
          )
        : null,
    ),
  );
}

export function detailScreen(context: HoloContext, id: string): HoloScreen {
  const entry = context.store.catalog.byId(id);
  if (!entry) {
    const element = h(
      'div',
      { class: 'hc-panel hc-stub' },
      h('h1', { class: 'hc-stub__title' }, 'That card is not in the collection'),
      h(
        'a',
        { class: 'hc-button hc-button--soft', href: '#/' },
        holoIcon('back'),
        'Back to the collection',
      ),
    );
    return { element, title: 'Card not found' };
  }
  const { manifest } = entry;
  const look = SET_LOOKS[manifest.category];
  const front = h(
    'div',
    { class: 'hc-flip__front', 'aria-hidden': 'true' },
    h('span', { class: 'hc-flip__title' }, manifest.title),
  );
  const poster = context.posters.mount(front, entry, { className: 'hc-poster hc-flip__poster' });
  front.prepend(poster.canvas);
  const flip = h(
    'div',
    {
      class: 'hc-flip',
      style: { '--hc-frame-from': look.frameFrom, '--hc-frame-to': look.frameTo },
    },
    h('div', { class: 'hc-flip__inner' }, front, backFace(context, id)),
  );
  const toggle = h(
    'button',
    {
      class: 'hc-button hc-button--ghost',
      type: 'button',
      dataset: { focusKey: 'detail:flip' },
      onclick: () => {
        setFlipped(!flip.classList.contains('is-flipped'));
        playSound(context.store, 'select');
      },
    },
    holoIcon('flip'),
    'Turn the card over',
  );
  const element = h(
    'div',
    { class: 'hc-detail' },
    h(
      'div',
      { class: 'hc-detail__bar' },
      h(
        'a',
        { class: 'hc-button hc-button--soft', href: '#/', dataset: { focusKey: 'detail:back' } },
        holoIcon('back'),
        'Back to the collection',
      ),
      toggle,
    ),
    flip,
  );

  function setFlipped(flipped: boolean) {
    if (context.theme.reducedMotion) {
      // A calm cross-fade instead of the turn.
      flip.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    }
    flip.classList.toggle('is-flipped', flipped);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  if (context.frozen || !context.interactive) flip.classList.add('is-flipped');
  else timer = setTimeout(() => setFlipped(true), FLIP_DELAY_MS);

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented) context.router.go(HOME);
  };
  if (context.interactive) document.addEventListener('keydown', onKey);

  return {
    element,
    title: manifest.title,
    destroy() {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    },
  };
}
