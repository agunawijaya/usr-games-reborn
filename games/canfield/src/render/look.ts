import type { BackStyle, DeckLook, Suit } from '@usr-games/kit/cards';

/**
 * The two rooms the table stands in, each designed on its own: Sunroom by day (pale wood in a
 * glasshouse, plants at the edges, sunlight falling across the cards) and Observatory by night
 * (blue leather and brass under a dome of slowly turning stars, one warm lamp).
 */

export type LookName = 'sunroom' | 'observatory';

export interface Look {
  name: LookName;
  dark: boolean;
  deck: DeckLook;
  back: BackStyle;
  /** Lines engraved or inlaid in the table for empty places. */
  inlay: string;
  inlaySoft: string;
  /** Labels painted on the table beside the piles. */
  label: string;
  /** Card thickness and shadows. */
  cardEdge: string;
  shadow: string;
  /** Highlights for legal targets, the keyboard cursor and hints. */
  target: string;
  cursor: string;
  hint: string;
  /** The petals of each suit's bloom, and the gold that edges them. */
  petals: Record<Suit, { fill: string; deep: string }>;
  petalEdge: string;
  bloomHeart: string;
}

export const SUNROOM: Look = {
  name: 'sunroom',
  dark: false,
  deck: 'day',
  back: 'conservatory',
  inlay: 'rgba(122, 86, 38, 0.55)',
  inlaySoft: 'rgba(122, 86, 38, 0.22)',
  label: '#5a4426',
  cardEdge: '#cbb994',
  shadow: 'rgba(74, 48, 18, 0.34)',
  target: '#2f7d5b',
  cursor: '#1d5fa8',
  hint: '#c46a12',
  petals: {
    hearts: { fill: '#ee8f98', deep: '#c45664' },
    diamonds: { fill: '#f4b46c', deep: '#cf7d34' },
    clubs: { fill: '#94c08a', deep: '#5d8f57' },
    spades: { fill: '#a3a7de', deep: '#6a70b4' },
  },
  petalEdge: '#b8893a',
  bloomHeart: '#e7b54a',
};

export const OBSERVATORY: Look = {
  name: 'observatory',
  dark: true,
  deck: 'lamp',
  back: 'constellations',
  inlay: 'rgba(214, 178, 96, 0.62)',
  inlaySoft: 'rgba(214, 178, 96, 0.22)',
  label: '#e6d3a6',
  cardEdge: '#7d6b4c',
  shadow: 'rgba(2, 4, 16, 0.6)',
  target: '#7fe0b0',
  cursor: '#9cc8ff',
  hint: '#ffc46b',
  petals: {
    hearts: { fill: '#ff9fae', deep: '#d0566d' },
    diamonds: { fill: '#ffcb84', deep: '#d68a3c' },
    clubs: { fill: '#9fe6b5', deep: '#4f9f74' },
    spades: { fill: '#b7c0ff', deep: '#6d78d6' },
  },
  petalEdge: '#e3be6c',
  bloomHeart: '#ffd77a',
};

export function lookFor(dark: boolean): Look {
  return dark ? OBSERVATORY : SUNROOM;
}
