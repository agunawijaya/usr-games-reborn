// The Grand Tour: twelve matches across the stadiums of the galaxy, built on
// the original's own escalation. The robots keep coming in bigger numbers,
// then the matches start bending the rules, and the last two go past the
// forty robots the original ever sent at once.

import type { CallKind } from './calls';
import type { MatchPlan } from './plans';
import { TOUR_SEEDS } from './tour-seeds';

export type TourMatch = Readonly<{
  id: string;
  name: string;
  /** One line of flavour for the match card. */
  blurb: string;
  waves: readonly number[];
  teleports: number | null;
  tempo: number | null;
  /** The third star: a challenge for the whole match. */
  challenge: Readonly<{ kind: CallKind; target: number }>;
  /** How forgiving the match should be: the share of games a careful bot wins (see scripts/tour-search.ts). */
  ease: readonly [number, number];
}>;

export const TOUR: readonly TourMatch[] = [
  { id: 'opening-night', name: 'Opening Night', blurb: 'Ten robots, a full house and the lights on you.', waves: [10], teleports: null, tempo: null, challenge: { kind: 'no-teleport', target: 0 }, ease: [0.85, 1] },
  { id: 'second-leg', name: 'Second Leg', blurb: 'Fifteen this time. The crowd wants a chain.', waves: [15], teleports: null, tempo: null, challenge: { kind: 'chain', target: 3 }, ease: [0.75, 1] },
  { id: 'double-header', name: 'Double Header', blurb: 'Two waves back to back: ten, then twenty.', waves: [10, 20], teleports: null, tempo: null, challenge: { kind: 'hype', target: 1 }, ease: [0.65, 1] },
  { id: 'the-crunch', name: 'The Crunch', blurb: 'Twenty-five robots. Let a few of them come to you.', waves: [25], teleports: null, tempo: null, challenge: { kind: 'wait-crashes', target: 4 }, ease: [0.55, 1] },
  { id: 'short-fuse', name: 'Short Fuse', blurb: 'Only two teleports. Make every step count.', waves: [20], teleports: 2, tempo: null, challenge: { kind: 'no-teleport', target: 0 }, ease: [0.5, 1] },
  { id: 'triple-bill', name: 'Triple Bill', blurb: 'Fifteen, twenty-five, thirty-five. Keep the roof up.', waves: [15, 25, 35], teleports: null, tempo: null, challenge: { kind: 'hype', target: 2 }, ease: [0.45, 1] },
  { id: 'full-house', name: 'Full House', blurb: 'Forty robots: as many as the original ever sent.', waves: [40], teleports: null, tempo: null, challenge: { kind: 'chain', target: 5 }, ease: [0.4, 0.9] },
  { id: 'clockwork', name: 'Clockwork', blurb: 'The robots keep time: three seconds a step, ready or not.', waves: [20, 30], teleports: null, tempo: 3, challenge: { kind: 'close-calls', target: 5 }, ease: [0.35, 0.9] },
  { id: 'no-way-out', name: 'No Way Out', blurb: 'Twenty-five robots and no teleporter at all.', waves: [25], teleports: 0, tempo: null, challenge: { kind: 'chain', target: 4 }, ease: [0.15, 0.85] },
  { id: 'overtime', name: 'Overtime', blurb: 'Forty, and then forty more.', waves: [40, 40], teleports: null, tempo: null, challenge: { kind: 'hype', target: 3 }, ease: [0.25, 0.8] },
  { id: 'beyond-forty', name: 'Beyond Forty', blurb: 'Fifty robots. The original never dared.', waves: [50], teleports: null, tempo: null, challenge: { kind: 'chain', target: 6 }, ease: [0.2, 0.75] },
  { id: 'grand-final', name: 'The Grand Final', blurb: 'Thirty, forty, fifty, and six teleports to your name.', waves: [30, 40, 50], teleports: 6, tempo: null, challenge: { kind: 'hype', target: 3 }, ease: [0.1, 0.7] },
];

export function scoreTarget(match: TourMatch): number {
  return TOUR_SEEDS[match.id]?.target ?? 0;
}

export function tourPlan(index: number, seed = TOUR_SEEDS[TOUR[index].id]?.seed ?? 0): MatchPlan {
  const match = TOUR[index];
  return {
    mode: 'tour',
    title: `Match ${index + 1} · ${match.name}`,
    rule: match.blurb,
    seed,
    waves: match.waves,
    startWave: 1,
    teleports: match.teleports,
    tempo: match.tempo,
    allowWait: true,
    hypeGain: 1,
    startHype: 0,
    calls: false,
    tourIndex: index,
  };
}
