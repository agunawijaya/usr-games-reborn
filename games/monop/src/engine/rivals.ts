/**
 * The rivals at the table: five personalities, each with a name, a one-line character and the
 * way they play. Their minds (valuation, bidding, trading) live with the engine; this is who
 * they are to the player. Friendly competitors: they tease, never sneer.
 */

export type PersonalityId = 'builder' | 'saver' | 'collector' | 'dealmaker' | 'steady';

export interface Personality {
  readonly id: PersonalityId;
  readonly name: string;
  /** Two or three words under the name. */
  readonly title: string;
  readonly blurb: string;
}

export const PERSONALITIES: Readonly<Record<PersonalityId, Personality>> = {
  builder: {
    id: 'builder',
    name: 'Marlowe',
    title: 'the daring builder',
    blurb: 'Borrows to build. Would rather owe the bank than leave a lot empty.',
  },
  saver: {
    id: 'saver',
    name: 'Ottilie',
    title: 'the careful saver',
    blurb: 'Keeps a fat purse and pounces when everyone else is short.',
  },
  collector: {
    id: 'collector',
    name: 'Colette',
    title: 'the collector',
    blurb: 'Picks one district and will not rest until she owns all of it.',
  },
  dealmaker: {
    id: 'dealmaker',
    name: 'Dex',
    title: 'the dealmaker',
    blurb: 'Loves a trade. Always has an offer, and a reason for it.',
  },
  steady: {
    id: 'steady',
    name: 'Stella',
    title: 'the steady one',
    blurb: 'Buys sensibly, builds evenly and rarely makes a mistake.',
  },
};
