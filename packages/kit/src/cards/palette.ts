import { type Suit, SUITS } from './deck';

/**
 * The colours a deck is printed in. Two printings, one for a bright room and one for a room lit
 * by a single warm lamp; neither is derived from the other. The four-colour option keeps the
 * red suits warm and the black suits dark, so the alternating-colour rule still reads at a
 * glance while every suit gets its own hue.
 */

export type DeckLook = 'day' | 'lamp';

export interface DeckPalette {
  /** Card stock. */
  face: string;
  faceShade: string;
  /** The thin printed rule and corner ornaments. */
  rule: string;
  /** Card edge seen from the side (thickness). */
  edge: string;
  ink: string;
  gold: string;
  goldDeep: string;
  cream: string;
  suit: Record<Suit, string>;
  /** Court panels and figure colours. */
  panel: string;
  robes: Record<Suit, { robe: string; robeDeep: string; accent: string }>;
  skin: readonly string[];
  hair: readonly string[];
  lips: string;
}

const DAY: DeckPalette = {
  face: '#fbf7ee',
  faceShade: '#f1e9d8',
  rule: '#b89a5c',
  edge: '#d9ccb0',
  ink: '#1d1d2a',
  gold: '#c79a3a',
  goldDeep: '#93702a',
  cream: '#fff8e8',
  suit: { clubs: '#1d1d2a', diamonds: '#c22a3c', hearts: '#c22a3c', spades: '#1d1d2a' },
  panel: '#f4e8cc',
  robes: {
    spades: { robe: '#24315f', robeDeep: '#161f40', accent: '#d7b45a' },
    hearts: { robe: '#a92a3c', robeDeep: '#741a29', accent: '#e2bf62' },
    diamonds: { robe: '#c25a2e', robeDeep: '#8a3a1c', accent: '#2d4f6e' },
    clubs: { robe: '#24614b', robeDeep: '#153d2f', accent: '#d9b356' },
  },
  skin: ['#f0c9a4', '#c98f62', '#8d5a3b', '#e3b083'],
  hair: ['#2b1d16', '#5a3420', '#1b1714', '#7a4a26'],
  lips: '#b3303f',
};

const LAMP: DeckPalette = {
  face: '#f3e6cb',
  faceShade: '#e3d0ad',
  rule: '#a8813e',
  edge: '#a8936c',
  ink: '#191723',
  gold: '#c5952f',
  goldDeep: '#86621f',
  cream: '#f8ecd2',
  suit: { clubs: '#191723', diamonds: '#b0222f', hearts: '#b0222f', spades: '#191723' },
  panel: '#ecd9b2',
  robes: {
    spades: { robe: '#22305d', robeDeep: '#141b38', accent: '#d2ab4c' },
    hearts: { robe: '#9e2433', robeDeep: '#661624', accent: '#ddb655' },
    diamonds: { robe: '#b65229', robeDeep: '#7c3218', accent: '#284865' },
    clubs: { robe: '#225b45', robeDeep: '#13372a', accent: '#d2aa4a' },
  },
  skin: ['#e6bb93', '#bf8457', '#835235', '#d8a273'],
  hair: ['#261a13', '#52301d', '#171411', '#704322'],
  lips: '#a72a38',
};

/** Four hues, warm for the red suits and dark for the black ones. */
const FOUR_COLOUR: Record<DeckLook, Record<Suit, string>> = {
  day: { clubs: '#1b6a3e', diamonds: '#b4570b', hearts: '#c22a3c', spades: '#1d1d2a' },
  lamp: { clubs: '#18603a', diamonds: '#a24f0a', hearts: '#b0222f', spades: '#191723' },
};

export function deckPalette(look: DeckLook, fourColour = false): DeckPalette {
  const base = look === 'day' ? DAY : LAMP;
  return fourColour ? { ...base, suit: FOUR_COLOUR[look] } : base;
}

export function suitColour(palette: DeckPalette, suit: Suit): string {
  return palette.suit[suit];
}

export const ALL_SUITS: readonly Suit[] = SUITS;
