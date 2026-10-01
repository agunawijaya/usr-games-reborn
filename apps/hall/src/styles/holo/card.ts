import type { ProcessRow } from '../../core/home-model';
import { achievementCount, CATEGORY_NAMES, gameHref } from '../../core/plain';
import { formatNumber } from '../../ui/format';
import { h } from '../../ui/h';
import type { HoloContext } from './context';
import { holoIcon } from './icons';
import { HALL_CARD_ART } from './hall-art';
import { type AlbumSlot, SET_LOOKS, TIER_NAMES } from './model';

/**
 * The collectible card. The outer link keeps the grid slot; inside it, the tilt layer leans
 * toward the pointer while the frame, art window, foil and highlight read the card's CSS
 * variables. Text sits on the solid face below the art, where no foil or glare ever reaches.
 */

const STATE_WORDS = { R: 'ready to play', D: 'arriving soon', S: 'coming soon' } as const;

function foilLayers(foil: string): HTMLElement[] {
  return [
    h('span', { class: ['hc-foil', `hc-foil--${foil}`], 'aria-hidden': 'true' }),
    h('span', { class: 'hc-glare', 'aria-hidden': 'true' }),
  ];
}

export interface GameCardOptions {
  size?: 'grid' | 'pick';
  /** The one card the hero-frame screenshot leans under the pointer. */
  heroHover?: boolean;
  /** A sticker in the corner, such as "Daily #31". */
  sticker?: string;
}

export function gameCard(
  row: ProcessRow,
  context: HoloContext,
  options: GameCardOptions = {},
): HTMLElement {
  const { manifest } = row.entry;
  const look = SET_LOOKS[manifest.category];
  const count = achievementCount(row.entry, context.snapshot.progression);
  const asleep = row.state !== 'R';
  const art = h(
    'span',
    { class: 'hc-card__art' },
    h('span', { class: 'hc-card__set' }, CATEGORY_NAMES[manifest.category]),
    ...foilLayers(count.mastered ? 'gold' : look.foil),
    asleep
      ? h('span', { class: 'hc-card__ribbon' }, row.state === 'D' ? 'Arriving soon' : 'Coming soon')
      : null,
  );
  const stats = asleep
    ? h('span', { class: 'hc-card__stats' }, h('span', null, 'Not playable yet'))
    : h(
        'span',
        { class: 'hc-card__stats' },
        h(
          'span',
          { class: 'hc-card__stat' },
          holoIcon('star', 'hc-icon hc-icon--small'),
          row.bestScore === null ? 'No best yet' : `Best ${formatNumber(row.bestScore)}`,
        ),
        count.total > 0
          ? h(
              'span',
              { class: 'hc-card__stat hc-card__stat--count' },
              holoIcon('trophy', 'hc-icon hc-icon--small'),
              `${count.earned} / ${count.total}`,
            )
          : null,
      );
  const card = h(
    'a',
    {
      class: [
        'hc-card',
        `hc-card--${options.size ?? 'grid'}`,
        asleep && 'hc-card--asleep',
        count.mastered && 'hc-card--mastered',
      ],
      href: gameHref(manifest.id),
      dataset: { game: manifest.id, focusKey: `card:${options.size ?? 'grid'}:${manifest.id}` },
      ...(options.heroHover ? { 'data-hero-hover': 'true' } : {}),
      style: {
        '--hc-frame-from': look.frameFrom,
        '--hc-frame-to': look.frameTo,
        '--hc-accent-raw': manifest.accent,
      },
      'aria-label': `${manifest.title}. ${manifest.tagline} ${CATEGORY_NAMES[manifest.category]}, ${STATE_WORDS[row.state]}.${
        count.total > 0 ? ` ${count.earned} of ${count.total} achievements.` : ''
      }`,
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
          h('span', { class: 'hc-card__name' }, manifest.title),
          h('span', { class: 'hc-card__tagline' }, manifest.tagline),
          stats,
        ),
      ),
      options.sticker ? h('span', { class: 'hc-card__sticker' }, options.sticker) : null,
    ),
  );
  const poster = context.posters.mount(art, row.entry);
  art.prepend(poster.canvas);
  if (context.interactive) context.tilt.attach({ card, poster });
  return card;
}

/** An achievement as a card: full foil when earned, a soft silhouette with its hint when not. */
export function achievementCard(
  slot: AlbumSlot,
  context: HoloContext,
  options: { size?: 'album' | 'mini' } = {},
): HTMLElement {
  const earned = slot.earnedOn !== null;
  const entry = slot.entry;
  const look = entry ? SET_LOOKS[entry.manifest.category] : null;
  const art = h(
    'span',
    {
      class: ['hc-card__art', !entry && 'hc-card__art--hall'],
      style: entry ? {} : { '--hc-hue': String(HALL_CARD_ART[slot.definition.id]?.hue ?? 280) },
    },
    entry
      ? null
      : holoIcon(HALL_CARD_ART[slot.definition.id]?.icon ?? 'sparkle', 'hc-icon hc-hall-mark'),
    earned ? foilLayers(slot.tier === 'rare' ? 'gold' : (look?.foil ?? 'sparkle')) : null,
    earned ? null : h('span', { class: 'hc-card__lock' }, holoIcon('lock')),
  );
  if (entry) art.prepend(context.posters.mount(art, entry).canvas);
  const card = h(
    'article',
    {
      class: [
        'hc-card',
        'hc-card--achievement',
        `hc-card--${options.size ?? 'album'}`,
        `hc-tier--${slot.tier}`,
        earned ? 'hc-card--earned' : 'hc-card--locked',
      ],
      'aria-label': `${slot.title}. ${slot.description} ${TIER_NAMES[slot.tier]}, ${slot.xp} XP. ${
        earned ? 'Earned.' : 'Not earned yet.'
      }`,
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
          h('span', { class: 'hc-card__tier' }, TIER_NAMES[slot.tier]),
          h('span', { class: 'hc-card__name' }, slot.title),
          h('span', { class: 'hc-card__tagline' }, slot.description),
          h(
            'span',
            { class: 'hc-card__stats' },
            h('span', null, `+${slot.xp} XP`),
            h('span', null, earned ? 'Earned' : entry ? entry.manifest.title : 'The Hall'),
          ),
        ),
      ),
    ),
  );
  if (context.interactive) context.tilt.attach({ card, poster: null });
  return card;
}
