/**
 * When each Skyloom package is earned. The ones about a moment in the air are checked after every
 * tick, so they install as it happens; the rest wait for the end of the sky.
 */

/** What a sky has done so far, as far as packages care. */
export interface SkyProgress {
  arenaId: string;
  safe: number;
  landings: number;
  longestString: number;
  /** The least fuel any plane had left when it landed, or null before the first landing. */
  lowestLandingFuel: number | null;
  lettersFlown: number;
  beaconPasses: number;
  leftHolds: number;
}

/** What only the end of a sky can tell. */
export interface SkyEnd {
  starsEarned: number | null;
  shiftId: string | null;
  targetMet: boolean;
  terminalOrders: number;
  dailiesFlown: number;
}

export function packagesInTheAir(progress: SkyProgress): string[] {
  const earned: [string, boolean][] = [
    ['first-light', progress.landings > 0],
    ['beacon-weaver', progress.beaconPasses >= 5],
    ['left-turn-at-last', progress.leftHolds > 0],
    ['string-of-pearls', progress.longestString >= 3],
    ['running-on-fumes', progress.lowestLandingFuel !== null && progress.lowestLandingFuel <= 2],
    ['alphabet-soup', progress.lettersFlown >= 26],
    ['killer-instinct', progress.arenaId === 'overdrive' && progress.safe >= 25],
  ];
  return earned.filter(([, when]) => when).map(([id]) => id);
}

export function packagesAtTheEnd(end: SkyEnd): string[] {
  const earned: [string, boolean][] = [
    ['typist', end.terminalOrders >= 50],
    ['daily-regular', end.dailiesFlown >= 7],
    ['clean-shift', end.starsEarned === 3],
    ['night-owl', end.shiftId === 'tower-at-midnight' && end.targetMet],
  ];
  return earned.filter(([, when]) => when).map(([id]) => id);
}
