// Orchard Crawl — the three stars of an orchard. Every star is earned on a crawl that reaches the
// burrow: one for coming home at all, one for the orchard's points, one for its feat, which is
// always about the thing the orchard brings in. Stars are kept for good once earned. Pure.

/**
 * What the desk learns about a crawl from the page's events. A chain is a bite eaten while the
 * worm was still growing from the one before, so it scored more than its own number.
 * @typedef {{ home: boolean, reason: string | null, score: number, harvested: number,
 *   length: number, bestBite: number, chains: number, frogs: number, birdVisits: number, stolen: number,
 *   rottenEaten: number, waspsHatched: number, rivalCrashes: number, gardenerVisits: number,
 *   gardenerSeenOff: number, seconds: number }} CrawlSummary
 * @typedef {{ text: string, met: (s: CrawlSummary) => boolean,
 *   progress?: (s: CrawlSummary) => string }} Feat
 */

/** A crawl's starting summary: nothing eaten, nothing seen. */
export function emptySummary() {
  return {
    home: false,
    reason: null,
    score: 0,
    harvested: 0,
    length: 5,
    bestBite: 0,
    chains: 0,
    frogs: 0,
    birdVisits: 0,
    stolen: 0,
    rottenEaten: 0,
    waspsHatched: 0,
    rivalCrashes: 0,
    gardenerVisits: 0,
    gardenerSeenOff: 0,
    seconds: 0,
  };
}

const SHORT_WORM = 50;

/** @type {Readonly<Record<string, Feat>>} */
export const FEATS = {
  chain: {
    text: 'Chain a bite: eat an apple while still growing from the last',
    met: (s) => s.chains >= 1,
  },
  frog: {
    text: 'Catch the frog',
    met: (s) => s.frogs >= 1,
  },
  short: {
    text: `Come home shorter than ${SHORT_WORM}`,
    met: (s) => s.length < SHORT_WORM,
    progress: (s) => `length ${s.length}`,
  },
  'no-theft': {
    text: 'Send the bird away with nothing: it comes, and takes no apple',
    met: (s) => s.birdVisits >= 1 && s.stolen === 0,
    progress: (s) => (s.stolen ? `${s.stolen} taken` : `${s.birdVisits} visits, none taken`),
  },
  rot: {
    text: 'Eat two over-ripe apples',
    met: (s) => s.rottenEaten >= 2,
    progress: (s) => `${Math.min(s.rottenEaten, 2)}/2`,
  },
  rival: {
    text: 'Make the rival worm crash',
    met: (s) => s.rivalCrashes >= 1,
  },
  gardener: {
    text: 'Stay out of reach until the gardener goes',
    met: (s) => s.gardenerSeenOff >= 1,
  },
  night: {
    text: 'Catch the frog and make the rival crash',
    met: (s) => s.frogs >= 1 && s.rivalCrashes >= 1,
    progress: (s) => `frog ${s.frogs ? '✓' : '—'} · rival ${s.rivalCrashes ? '✓' : '—'}`,
  },
};

/** The three stars of an orchard, in order. */
export function starsOf(orchard) {
  return [
    { id: 'home', text: 'Crawl home to the burrow', met: (s) => s.home },
    {
      id: 'points',
      text: `Score ${orchard.points} points`,
      met: (s) => s.home && s.score >= orchard.points,
      progress: (s) => `${Math.min(s.score, orchard.points)}/${orchard.points}`,
    },
    {
      id: 'feat',
      text: FEATS[orchard.feat].text,
      met: (s) => s.home && FEATS[orchard.feat].met(s),
      progress: FEATS[orchard.feat].progress,
    },
  ];
}

/** Whether a star's condition holds so far in a crawl still going (as if it came home now). */
export function onCourse(star, summary) {
  return star.met({ ...summary, home: true });
}

export const STARS_PER_ORCHARD = 3;

/** The stars this crawl earned that were not held before. */
export function newStars(orchard, summary, held = []) {
  return starsOf(orchard)
    .filter((star) => star.met(summary) && !held.includes(star.id))
    .map((star) => star.id);
}
