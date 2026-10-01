import {
  COSMETICS,
  firstLevelOfRank,
  FREEZES_PER_WEEK,
  isUnlocked,
  levelForXp,
  questLabel,
  RANK_TOOLTIP,
  streakAsOf,
} from '@usr-games/kit/progression';
import { formatNumber, plural } from '../../ui/format';
import { h } from '../../ui/h';
import { achievementCard } from './card';
import type { HoloContext, HoloScreen } from './context';
import { holoIcon } from './icons';
import { CARD_RANKS, closetDoorCard, hasReached, levelCard } from './level-card';
import { type AlbumSort, albumGroups, albumSlots } from './model';

/**
 * The album: every achievement in the collection as a card slot. Earned cards shine in full
 * foil; the rest wait as soft silhouettes with their hint, so there is always a next card to
 * aim for. The last page keeps the level cards and the door to the server closet.
 */

const SORTS: { value: AlbumSort; label: string }[] = [
  { value: 'game', label: 'By game' },
  { value: 'rarity', label: 'By rarity' },
];

function albumHeader(context: HoloContext, earned: number, total: number): HTMLElement {
  const { progression, today, profile } = context.snapshot;
  const level = levelForXp(progression.xp);
  const toNext = level.nextLevelAt === null ? 0 : level.nextLevelAt - progression.xp;
  const quests = progression.cron.jobs;
  const finishes = COSMETICS.filter((c) => c.kind === 'finish' && isUnlocked(c, progression));
  return h(
    'section',
    { class: 'hc-album-head', 'aria-labelledby': 'hc-album-title' },
    h(
      'div',
      { class: 'hc-album-head__who' },
      h(
        'p',
        { class: 'hc-eyebrow' },
        holoIcon('trophy', 'hc-icon hc-icon--small'),
        `${profile.username ?? 'Guest'}’s album`,
      ),
      h(
        'h1',
        { id: 'hc-album-title', class: 'hc-album-head__title' },
        `${earned} of ${total} cards collected`,
      ),
      h(
        'div',
        {
          class: 'hc-album-progress',
          role: 'progressbar',
          'aria-label': 'Album completion',
          'aria-valuemin': '0',
          'aria-valuemax': String(total),
          'aria-valuenow': String(earned),
        },
        h('span', {
          class: 'hc-album-progress__fill',
          style: { width: `${total ? ((earned / total) * 100).toFixed(1) : 0}%` },
        }),
      ),
      hasReached(progression.xp, 'root')
        ? h(
            'a',
            {
              class: 'hc-button hc-button--primary hc-album-head__door',
              href: '#/closet',
              dataset: { focusKey: 'album:door' },
            },
            holoIcon('door', 'hc-icon hc-icon--line'),
            'Open the server closet',
          )
        : null,
    ),
    h(
      'div',
      { class: 'hc-album-head__level' },
      h('span', { class: 'hc-medal', 'aria-hidden': 'true' }, String(level.level)),
      h(
        'div',
        { class: 'hc-album-head__level-text' },
        h(
          'p',
          { class: 'hc-album-head__level-name' },
          `Level ${level.level}`,
          h('span', { class: 'hc-level__rank', title: RANK_TOOLTIP }, level.rank),
        ),
        h(
          'div',
          { class: 'hc-bar hc-bar--wide' },
          h('span', {
            class: 'hc-bar__fill',
            style: { width: `${(level.fraction * 100).toFixed(1)}%` },
          }),
        ),
        h(
          'p',
          { class: 'hc-album-head__note' },
          level.nextLevelAt === null
            ? 'Top level reached'
            : `${formatNumber(progression.xp)} XP · ${formatNumber(toNext)} to level ${level.level + 1}`,
        ),
        h('p', { class: 'hc-album-head__note hc-album-head__tip' }, RANK_TOOLTIP),
      ),
    ),
    h(
      'dl',
      { class: 'hc-album-stats' },
      h(
        'div',
        null,
        h('dt', null, holoIcon('flame', 'hc-icon hc-icon--small'), 'Streak'),
        progression.streak.best === 0
          ? [
              h('dd', null, 'Starts with your first game'),
              h(
                'dd',
                { class: 'hc-album-stats__sub' },
                `Play on any day to begin; ${FREEZES_PER_WEEK} missed days a week are covered.`,
              ),
            ]
          : [
              h('dd', null, plural(streakAsOf(progression.streak, today), 'day')),
              h(
                'dd',
                { class: 'hc-album-stats__sub' },
                `best ${plural(progression.streak.best, 'day')}, ${FREEZES_PER_WEEK} freezes a week`,
              ),
            ],
      ),
      h(
        'div',
        null,
        h('dt', null, holoIcon('quest', 'hc-icon hc-icon--small'), 'Weekly quests'),
        h('dd', null, `${quests.filter((q) => q.done).length} of ${quests.length} done`),
        h(
          'dd',
          { class: 'hc-album-stats__sub' },
          quests.find((q) => !q.done)
            ? `Next: ${questLabel(quests.find((q) => !q.done)!)}`
            : 'All done this week',
        ),
      ),
      h(
        'div',
        null,
        h('dt', null, holoIcon('sparkle', 'hc-icon hc-icon--small'), 'Foil finishes'),
        h('dd', null, `${finishes.length} of 4 unlocked`),
        h(
          'dd',
          { class: 'hc-album-stats__sub' },
          finishes.map((f) => f.name).join(', ') ||
            `The first one arrives at Level ${firstLevelOfRank('user')}`,
        ),
      ),
    ),
  );
}

/** How many album columns and rows a page takes, so the grid can pack small pages into gaps. */
function pageSpan(cards: number, maxColumns: number): Record<string, string> {
  // A page is at least two columns wide so its heading has room, even with a single card.
  const columns = Math.max(2, Math.min(cards, maxColumns));
  return { '--hc-cols': String(columns), '--hc-rows': String(Math.ceil(cards / columns)) };
}

/** Level cards, one per level milestone, and the closet door as the last pocket. */
function levelPage(context: HoloContext): HTMLElement {
  const xp = context.snapshot.progression.xp;
  const earned = CARD_RANKS.filter((rank) => hasReached(xp, rank)).length;
  return h(
    'section',
    {
      class: 'hc-album__page hc-album__page--levels',
      'aria-labelledby': 'hc-group-levels',
      style: pageSpan(CARD_RANKS.length + 1, 5),
    },
    h(
      'header',
      { class: 'hc-set__head' },
      h('h2', { id: 'hc-group-levels', class: 'hc-set__title' }, 'Level cards'),
      h('span', { class: 'hc-set__count' }, `${earned} / ${CARD_RANKS.length}`),
    ),
    h(
      'ul',
      { class: 'hc-album__slots' },
      CARD_RANKS.map((rank) =>
        h('li', null, levelCard(rank, context, { earned: hasReached(xp, rank) })),
      ),
      h('li', null, closetDoorCard(context)),
    ),
  );
}

export function albumScreen(context: HoloContext): HoloScreen {
  const slots = albumSlots(context.store.catalog.listed(), context.snapshot.progression);
  const earned = slots.filter((slot) => slot.earnedOn).length;
  const sort = context.ui.albumSort;
  const groups = albumGroups(slots, sort);
  const element = h(
    'div',
    { class: 'hc-album' },
    albumHeader(context, earned, slots.length),
    h(
      'div',
      { class: 'hc-album__bar' },
      h(
        'p',
        { class: 'hc-album__hint' },
        earned <= 1
          ? 'Your album is ready. Each faded card says how to earn it, and most games have an easy one to start.'
          : 'Earned cards shine. The faded ones tell you how to get them.',
      ),
      h(
        'div',
        { class: 'hc-segmented', role: 'group', 'aria-label': 'Sort the album' },
        SORTS.map(({ value, label }) =>
          h(
            'button',
            {
              class: ['hc-segmented__option', sort === value && 'is-current'],
              type: 'button',
              'aria-pressed': String(sort === value),
              dataset: { focusKey: `sort:${value}` },
              onclick: () => {
                context.ui.albumSort = value;
                context.refresh();
              },
            },
            label,
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'hc-album__pages' },
      groups.map((group) =>
        h(
          'section',
          {
            class: 'hc-album__page',
            'aria-labelledby': `hc-group-${group.key}`,
            style: pageSpan(group.slots.length, sort === 'rarity' ? 8 : 5),
          },
          h(
            'header',
            { class: 'hc-set__head' },
            h('h2', { id: `hc-group-${group.key}`, class: 'hc-set__title' }, group.title),
            h('span', { class: 'hc-set__count' }, `${group.earned} / ${group.slots.length}`),
          ),
          h(
            'ul',
            { class: 'hc-album__slots' },
            group.slots.map((slot) => h('li', null, achievementCard(slot, context))),
          ),
        ),
      ),
      levelPage(context),
    ),
  );
  return { element, title: 'Your album' };
}
