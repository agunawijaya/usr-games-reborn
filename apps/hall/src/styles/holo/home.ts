import { dailyNumber } from '@usr-games/kit';
import { CATEGORIES, type Category } from '@usr-games/kit/manifest';
import { didYouKnowFor } from '../../content/fortunes';
import { dailyPick, type ProcessRow, processRows, sortRows } from '../../core/home-model';
import { playSound } from '../../core/sound';
import { achievementCount, CATEGORY_NAMES, callToAction, gameHref } from '../../core/plain';
import { formatMinutes, formatNumber } from '../../ui/format';
import { h } from '../../ui/h';
import { achievementCard, gameCard } from './card';
import type { HoloContext, HoloScreen } from './context';
import { holoIcon } from './icons';
import { albumSlots, recentlyEarned, SET_LOOKS } from './model';
import { gridKeys } from './tilt';

/**
 * Home: today's pick as one oversized breathing card, the collection at a glance, then every
 * game as a card, set by set.
 */

/** The card the hero frame shows leaning under the pointer. */
const HERO_HOVER_GAME = 'robots';

function pickSection(pick: ProcessRow, context: HoloContext): HTMLElement {
  const { manifest } = pick.entry;
  const today = context.snapshot.today;
  const cta = callToAction(pick, today);
  const count = achievementCount(pick.entry, context.snapshot.progression);
  const facts = [
    ['Best', pick.bestScore === null ? 'Not yet' : formatNumber(pick.bestScore)],
    ['Achievements', count.total > 0 ? `${count.earned} / ${count.total}` : 'Coming with the game'],
    ['Length', formatMinutes(manifest.sessionMinutes)],
  ] as const;
  return h(
    'section',
    { class: 'hc-pick', 'aria-labelledby': 'hc-pick-title' },
    h(
      'div',
      { class: 'hc-pick__card', style: { '--hc-halo': SET_LOOKS[manifest.category].frameFrom } },
      gameCard(pick, context, { size: 'pick', sticker: `Daily #${dailyNumber(today)}` }),
    ),
    h(
      'div',
      { class: 'hc-pick__copy' },
      h(
        'p',
        { class: 'hc-eyebrow' },
        holoIcon('sparkle', 'hc-icon hc-icon--small'),
        'Today’s pick',
      ),
      h('h1', { id: 'hc-pick-title', class: 'hc-pick__title' }, manifest.title),
      h('p', { class: 'hc-pick__tagline' }, manifest.tagline),
      h(
        'div',
        { class: 'hc-actions' },
        cta.href
          ? h(
              'a',
              {
                class: 'hc-button hc-button--primary',
                href: cta.href,
                dataset: { focusKey: 'pick:play' },
              },
              holoIcon('play'),
              cta.label,
            )
          : h('span', { class: 'hc-button hc-button--asleep' }, cta.label),
        h(
          'a',
          {
            class: 'hc-button hc-button--ghost',
            href: gameHref(manifest.id),
            dataset: { focusKey: 'pick:flip' },
          },
          holoIcon('flip'),
          'Flip the card',
        ),
      ),
      h(
        'dl',
        { class: 'hc-facts' },
        facts.map(([label, value]) =>
          h('div', { class: 'hc-fact' }, h('dt', null, label), h('dd', null, value)),
        ),
      ),
    ),
  );
}

function collectionPanel(context: HoloContext, rows: readonly ProcessRow[]): HTMLElement {
  const entries = context.store.catalog.listed();
  const slots = albumSlots(entries, context.snapshot.progression);
  const earned = slots.filter((slot) => slot.earnedOn).length;
  const ready = rows.filter((row) => row.state === 'R').length;
  const recent = recentlyEarned(slots, 3);
  return h(
    'aside',
    { class: 'hc-collection', 'aria-labelledby': 'hc-collection-title' },
    h('h2', { id: 'hc-collection-title', class: 'hc-collection__title' }, 'Your collection'),
    h(
      'div',
      { class: 'hc-collection__numbers' },
      h(
        'p',
        { class: 'hc-big-number' },
        h('b', null, String(earned)),
        h('span', null, `of ${slots.length} achievements`),
      ),
      h(
        'p',
        { class: 'hc-big-number' },
        h('b', null, String(ready)),
        h('span', null, `of ${rows.length} games ready to play`),
      ),
    ),
    recent.length > 0
      ? h(
          'ol',
          { class: 'hc-fan', 'aria-label': 'Newest achievements' },
          recent.map((slot) => h('li', null, achievementCard(slot, context, { size: 'mini' }))),
        )
      : null,
    h(
      'a',
      {
        class: 'hc-button hc-button--soft',
        href: '#/home',
        dataset: { focusKey: 'collection:album' },
      },
      holoIcon('trophy'),
      'Open your album',
    ),
    h(
      'p',
      { class: 'hc-did-you-know' },
      h('b', null, 'Did you know? '),
      didYouKnowFor(context.snapshot.today),
    ),
  );
}

function chips(context: HoloContext, current: Category | null): HTMLElement {
  const chip = (label: string, dir: Category | null) =>
    h(
      'a',
      {
        class: ['hc-chip', current === dir && 'is-current', dir && `hc-chip--${dir}`],
        href: dir ? `#/games/${dir}` : '#/',
        'aria-current': current === dir ? 'page' : undefined,
        dataset: { focusKey: `chip:${dir ?? 'all'}` },
      },
      label,
    );
  return h(
    'nav',
    { class: 'hc-chips', 'aria-label': 'Card sets' },
    h(
      'ul',
      null,
      [
        chip('All sets', null),
        ...CATEGORIES.map((category) => chip(CATEGORY_NAMES[category], category)),
      ].map((item) => h('li', null, item)),
    ),
  );
}

function setSection(category: Category, rows: ProcessRow[], context: HoloContext): HTMLElement {
  const ready = rows.filter((row) => row.state === 'R').length;
  return h(
    'section',
    { class: ['hc-set', `hc-set--${category}`], 'aria-labelledby': `hc-set-${category}` },
    h(
      'header',
      { class: 'hc-set__head' },
      h('h2', { id: `hc-set-${category}`, class: 'hc-set__title' }, CATEGORY_NAMES[category]),
      h(
        'span',
        { class: 'hc-set__count' },
        ready > 0 ? `${ready} of ${rows.length} ready` : `${rows.length} coming soon`,
      ),
    ),
    h(
      'ul',
      { class: 'hc-grid' },
      rows.map((row) =>
        h(
          'li',
          null,
          gameCard(row, context, { heroHover: row.entry.manifest.id === HERO_HOVER_GAME }),
        ),
      ),
    ),
  );
}

export function homeScreen(context: HoloContext): HoloScreen {
  const { snapshot } = context;
  const route = context.route.name === 'home' ? context.route : null;
  const dir = route?.dir ?? null;
  const rows = processRows(context.store.catalog.listed(), snapshot.progression, snapshot.today);
  const pick = dailyPick(rows, snapshot.today);
  const sorted = sortRows(rows, route?.sort ?? 'recommended', snapshot.today);
  const sets = (dir ? [dir] : CATEGORIES)
    .map((category) => ({
      category,
      rows: sorted.filter((row) => row.entry.manifest.category === category),
    }))
    .filter((set) => set.rows.length > 0);

  const grid = h(
    'div',
    { class: 'hc-sets' },
    sets.map((set) => setSection(set.category, set.rows, context)),
  );
  const element = h(
    'div',
    { class: 'hc-home' },
    h(
      'div',
      { class: 'hc-stage' },
      pick
        ? pickSection(pick, context)
        : h(
            'section',
            { class: 'hc-pick hc-pick--empty' },
            h('h1', { class: 'hc-pick__title' }, 'Your collection is warming up'),
          ),
      collectionPanel(context, rows),
    ),
    chips(context, dir),
    grid,
  );
  const stopKeys = context.interactive
    ? gridKeys(grid, '.hc-card', () => playSound(context.store, 'keyClick'))
    : () => {};
  return {
    element,
    title: dir ? `${CATEGORY_NAMES[dir]} set` : 'Your collection',
    destroy: stopKeys,
  };
}
