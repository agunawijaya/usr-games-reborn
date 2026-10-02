import {
  COSMETICS,
  firstLevelOfRank,
  levelForXp,
  RANK_IDS,
  rankById,
  type RankId,
  rankForXp,
} from '@usr-games/kit/progression';
import { h } from '../../ui/h';
import type { HoloContext } from './context';
import { holoIcon } from './icons';

/**
 * Level cards: one for each rank a player reaches, earned by playing and kept in the album. The
 * rank-up moment reveals the new one at full size; the album keeps the set, with the server
 * closet's door as its last pocket. Each card wears the foil its rank unlocks.
 */

export type CardRank = Exclude<RankId, 'guest'>;

export const CARD_RANKS: readonly CardRank[] = ['user', 'staff', 'wheel', 'root'];

interface RankCardLook {
  /** The foil finish this rank unlocks, shown on its own card. */
  finish: string;
  foil: 'rainbow' | 'sparkle' | 'gold' | 'chrome';
  frameFrom: string;
  frameTo: string;
}

export const RANK_CARD_LOOKS: Readonly<Record<CardRank, RankCardLook>> = {
  user: {
    finish: 'finish-prism',
    foil: 'rainbow',
    frameFrom: '#ff7ac6',
    frameTo: '#6fd3ff',
  },
  staff: {
    finish: 'finish-galaxy',
    foil: 'sparkle',
    frameFrom: '#5b5bff',
    frameTo: '#c07bff',
  },
  wheel: {
    finish: 'finish-gold',
    foil: 'gold',
    frameFrom: '#f7d774',
    frameTo: '#c9912f',
  },
  root: {
    finish: 'finish-chrome',
    foil: 'chrome',
    frameFrom: '#f1f4f9',
    frameTo: '#8b96a8',
  },
};

/** The card's line: the rank's welcome in the kit's plain words, shared with Console Home. */
export function cardLine(rank: CardRank): string {
  return rankById(rank).plainFlavour;
}

export function finishName(rank: CardRank): string {
  return COSMETICS.find((c) => c.id === RANK_CARD_LOOKS[rank].finish)?.name ?? 'A new foil';
}

export function hasReached(xp: number, rank: RankId): boolean {
  return RANK_IDS.indexOf(rankForXp(xp).id) >= RANK_IDS.indexOf(rank);
}

export interface LevelCardOptions {
  earned: boolean;
  size?: 'album' | 'reveal';
}

export function levelCard(
  rank: CardRank,
  context: HoloContext | null,
  options: LevelCardOptions,
): HTMLElement {
  const look = RANK_CARD_LOOKS[rank];
  const level = firstLevelOfRank(rank);
  const { earned } = options;
  const art = h(
    'span',
    { class: ['hc-card__art', 'hc-levelcard__art', `hc-levelcard__art--${rank}`] },
    h('span', { class: 'hc-card__set hc-levelcard__rank' }, rank),
    h(
      'span',
      { class: 'hc-levelcard__number', 'aria-hidden': 'true' },
      h('small', null, 'Level'),
      String(level),
    ),
    earned
      ? [
          h('span', { class: ['hc-foil', `hc-foil--${look.foil}`], 'aria-hidden': 'true' }),
          h('span', { class: 'hc-glare', 'aria-hidden': 'true' }),
        ]
      : h('span', { class: 'hc-card__lock' }, holoIcon('lock')),
  );
  const card = h(
    'article',
    {
      class: [
        'hc-card',
        'hc-card--level',
        `hc-card--${options.size ?? 'album'}`,
        `hc-levelcard--${rank}`,
        earned ? 'hc-card--earned' : 'hc-card--locked',
      ],
      style: { '--hc-frame-from': look.frameFrom, '--hc-frame-to': look.frameTo },
      dataset: { rank },
      'aria-label': earned
        ? `Level card: Level ${level}, ${rank}. ${cardLine(rank)} Unlocks ${finishName(rank)}. Earned.`
        : `Level card: Level ${level}. Reach Level ${level} to earn it. Not earned yet.`,
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
          h('span', { class: 'hc-card__tier' }, 'Level card'),
          h('span', { class: 'hc-card__name' }, `Level ${level}`),
          h(
            'span',
            { class: 'hc-card__tagline' },
            earned ? cardLine(rank) : `Reach Level ${level} to add this card.`,
          ),
          h(
            'span',
            { class: 'hc-card__stats' },
            h(
              'span',
              { class: 'hc-card__stat' },
              holoIcon('sparkle', 'hc-icon hc-icon--small'),
              finishName(rank),
            ),
          ),
        ),
      ),
    ),
  );
  if (context?.interactive && options.size !== 'reveal') {
    context.tilt.attach({ card, poster: null });
  }
  return card;
}

/** The last pocket of the level page: the server closet's door, open only at root. */
export function closetDoorCard(context: HoloContext): HTMLElement {
  const xp = context.snapshot.progression.xp;
  const open = hasReached(xp, 'root');
  const rootLevel = firstLevelOfRank('root');
  const door = h(
    'span',
    { class: 'hc-card__art hc-door__art', 'aria-hidden': 'true' },
    h(
      'span',
      { class: 'hc-door' },
      h('span', { class: 'hc-door__plate' }, 'Server'),
      h('span', { class: 'hc-door__handle' }),
      h('span', { class: 'hc-door__light' }),
    ),
  );
  const face = h(
    'span',
    { class: 'hc-card__face' },
    door,
    h('span', { class: 'hc-card__tier' }, open ? 'Open door' : 'Locked door'),
    h('span', { class: 'hc-card__name' }, 'The server closet'),
    h(
      'span',
      { class: 'hc-card__tagline' },
      open
        ? 'It hums. Go on in.'
        : `Opens at Level ${rootLevel}. You are Level ${levelForXp(xp).level}.`,
    ),
    h(
      'span',
      { class: 'hc-card__stats' },
      h('span', null, `Level ${rootLevel}`),
      h('span', null, open ? 'Open' : 'Locked'),
    ),
  );
  const inner = h('span', { class: 'hc-card__tilt' }, h('span', { class: 'hc-card__frame' }, face));
  const card = open
    ? h(
        'a',
        {
          class: 'hc-card hc-card--door hc-card--album is-open',
          href: '#/closet',
          dataset: { focusKey: 'album:closet' },
          'aria-label': 'The server closet. The door is open: go on in.',
        },
        inner,
      )
    : h(
        'article',
        {
          class: 'hc-card hc-card--door hc-card--album hc-card--locked',
          'aria-label': `The server closet. The door opens at Level ${rootLevel}.`,
        },
        inner,
      );
  if (context.interactive) context.tilt.attach({ card, poster: null });
  return card;
}
